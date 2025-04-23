// src/services/userService.ts
import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import prisma from '../prisma/prismaClient';
import { securityConfig } from '../config/config';
// Import Prisma namespace for transaction type checking if needed
import { Prisma } from '@prisma/client';
// Import BOTH functions from websiteService
import { updateGlobalInterval, checkAndDeactivateWebsiteIfOrphaned } from './websiteService';

const SALT_ROUNDS = 10;

export interface UpdateUserData {
    name?: string;
    email?: string;
}

export interface UpdatePasswordData {
    currentPassword?: string;
    newPassword?: string;
}


/**
 * Finds a user by their ID.
 * @param userId - The ID of the user to find.
 * @returns The user object without the password, or null if not found.
 */
export async function findUserById(userId: number): Promise<Omit<User, 'password'> | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    return user;
}


/**
 * Updates user profile information (name, email).
 * @param userId - The ID of the user to update.
 * @param data - The data to update (name, email).
 * @returns The updated user object without the password.
 * @throws Error if the new email already exists for another user.
 */
export async function updateUserProfile(userId: number, data: UpdateUserData): Promise<Omit<User, 'password'>> {
    // Validate input: Ensure at least one field is being updated
    if (!data.name && !data.email) {
        throw new Error("No update data provided.");
    }

    const updatePayload: Partial<User> = {};
    if (data.name) updatePayload.name = data.name;
    if (data.email) {
        // Check if the new email is already taken by another user
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });
        if (existingUser && existingUser.id !== userId) {
            throw new Error('Email already in use by another account.');
        }
        updatePayload.email = data.email;
    }

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updatePayload,
        select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return updatedUser;
}

/**
 * Updates a user's password after verifying the current one.
 * @param userId - The ID of the user whose password is to be updated.
 * @param passwordData - Contains currentPassword and newPassword.
 * @throws Error if current password doesn't match or new password is missing.
 */
export async function updateUserPassword(userId: number, passwordData: UpdatePasswordData): Promise<void> {
    if (!passwordData.currentPassword || !passwordData.newPassword) {
        throw new Error('Current and new password are required.');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new Error('User not found.'); // Should not happen if called after authentication
    }

    const isPasswordValid = await bcrypt.compare(passwordData.currentPassword, user.password);
    if (!isPasswordValid) {
        throw new Error('Invalid current password.');
    }

    // Basic validation for new password (add more rules as needed)
    if (passwordData.newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long.');
    }

    const hashedNewPassword = await bcrypt.hash(passwordData.newPassword, SALT_ROUNDS);

    await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
    });
}

/**
 * Deletes a user account and all associated WebsiteUser and Alert records.
 * Uses a transaction to ensure atomicity.
 * Triggers global interval updates AND orphan checks for affected websites after successful deletion.
 * @param userId - The ID of the user to delete.
 * @throws Error if the user cannot be found or deletion fails.
 * @returns Promise<void>
 */
export async function deleteUserAccount(userId: number): Promise<void> {
    console.log(`[User Deletion] Attempting to delete user ${userId} and associated data.`);
    let affectedWebsiteIds: number[] = []; // Store IDs of websites linked to the user

    try {
        // 1. Find associated website IDs BEFORE the transaction
        const userWebsiteLinks = await prisma.websiteUser.findMany({
            where: { userId: userId },
            select: { websiteId: true },
        });
        affectedWebsiteIds = userWebsiteLinks.map(link => link.websiteId);

        if (affectedWebsiteIds.length > 0) {
             console.log(`[User Deletion] User ${userId} is associated with website IDs: ${affectedWebsiteIds.join(', ')}. Post-deletion checks will be triggered.`);
        } else {
             console.log(`[User Deletion] User ${userId} has no associated websites.`);
        }

        // 2. Use a transaction to delete the user and related data atomically
        await prisma.$transaction(async (tx) => {
            // a. Delete associated Alerts
            const deletedAlerts = await tx.alert.deleteMany({ where: { userId: userId } });
            console.log(`[User Deletion Tx] Deleted ${deletedAlerts.count} Alert records for user ${userId}.`);

            // b. Delete associated WebsiteUser records
            const deletedWebsiteUsers = await tx.websiteUser.deleteMany({ where: { userId: userId } });
            console.log(`[User Deletion Tx] Deleted ${deletedWebsiteUsers.count} WebsiteUser records for user ${userId}.`);

            // c. Delete the User record itself
            const deletedUser = await tx.user.delete({ where: { id: userId } });
            console.log(`[User Deletion Tx] Successfully deleted User record for user ${userId} (Email: ${deletedUser.email}).`);
        });

        console.log(`[User Deletion] Successfully completed deletion transaction for user ${userId}.`);

    } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
             console.warn(`[User Deletion] Failed: A required record (User, Alert, or WebsiteUser) for user ID ${userId} was not found during deletion transaction. It might have been deleted already. Error: ${error.message}`);
            throw new Error(`User or associated record not found during deletion (ID: ${userId}).`);
        }
        console.error(`[User Deletion] Error during transaction for user ${userId}:`, error);
        throw new Error(`Failed to delete user account (ID: ${userId}). Reason: ${error.message || 'Unknown error'}`);
    }

    // 3. Trigger post-deletion checks AFTER successful transaction (asynchronously)
    if (affectedWebsiteIds.length > 0) {
        console.log(`[User Deletion] Triggering ${affectedWebsiteIds.length} post-deletion checks asynchronously.`);
        for (const websiteId of affectedWebsiteIds) {
            // Trigger interval update
            updateGlobalInterval(websiteId)
                .catch(err => {
                    console.error(`[Interval Update Post-Delete] Error updating global interval for website ${websiteId} after user ${userId} deletion:`, err);
                });

            // Trigger orphan check and potential deactivation
            checkAndDeactivateWebsiteIfOrphaned(websiteId)
                .catch(err => {
                    // Log error, but don't fail the overall process
                    console.error(`[Orphan Check Post-Delete] Error checking/deactivating website ${websiteId} after user ${userId} deletion:`, err);
                });
        }
    }
}