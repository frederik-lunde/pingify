// src/services/userService.ts
import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import prisma from '../prisma/prismaClient';
import { securityConfig } from '../config/config';
import { Prisma } from '@prisma/client'; // Keep for transaction types/errors
import { updateGlobalInterval, checkAndDeactivateWebsiteIfOrphaned } from './websiteService';

const SALT_ROUNDS = 10;

// Types for input data remain the same
export interface UpdateUserData {
    name?: string;
    email?: string;
}

export interface UpdatePasswordData {
    currentPassword?: string;
    newPassword?: string;
}

// Define UserWithoutPassword based on Prisma's User model, reflecting id: string
type UserWithoutPassword = Omit<User, 'password'>;


/**
 * Finds a user by their ID.
 * @param userId - The ID (CUID string) of the user to find.
 * @returns The user object without the password, or null if not found.
 */
// Changed userId type to string
export async function findUserById(userId: string): Promise<UserWithoutPassword | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId }, // Prisma handles string ID lookup
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
 * @param userId - The ID (CUID string) of the user to update.
 * @param data - The data to update (name, email).
 * @returns The updated user object without the password.
 * @throws Error if the new email already exists for another user.
 */
// Changed userId type to string
export async function updateUserProfile(userId: string, data: UpdateUserData): Promise<UserWithoutPassword> {
    if (!data.name && !data.email) {
        throw new Error("No update data provided.");
    }

    const updatePayload: Partial<User> = {};
    if (data.name !== undefined) updatePayload.name = data.name; // Check for undefined to allow setting null/empty string
    if (data.email) {
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });
        // Comparison works correctly with string IDs
        if (existingUser && existingUser.id !== userId) {
            throw new Error('Email already in use by another account.');
        }
        updatePayload.email = data.email;
    }

    const updatedUser = await prisma.user.update({
        where: { id: userId }, // Prisma handles string ID lookup
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
 * @param userId - The ID (CUID string) of the user whose password is to be updated.
 * @param passwordData - Contains currentPassword and newPassword.
 * @throws Error if current password doesn't match or new password is missing/invalid.
 */
// Changed userId type to string
export async function updateUserPassword(userId: string, passwordData: UpdatePasswordData): Promise<void> {
    if (!passwordData.currentPassword || !passwordData.newPassword) {
        throw new Error('Current and new password are required.');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } }); // Prisma handles string ID lookup
    if (!user) {
        // Although unlikely if auth is working, good to keep the check
        throw new Error('User not found.');
    }

    const isPasswordValid = await bcrypt.compare(passwordData.currentPassword, user.password);
    if (!isPasswordValid) {
        throw new Error('Invalid current password.');
    }

    if (passwordData.newPassword.length < 6) { // Example validation
        throw new Error('New password must be at least 6 characters long.');
    }

    const hashedNewPassword = await bcrypt.hash(passwordData.newPassword, SALT_ROUNDS);

    await prisma.user.update({
        where: { id: userId }, // Prisma handles string ID lookup
        data: { password: hashedNewPassword },
    });
}

/**
 * Deletes a user account and all associated WebsiteUser and Alert records.
 * Uses a transaction to ensure atomicity.
 * Triggers global interval updates AND orphan checks for affected websites after successful deletion.
 * @param userId - The ID (CUID string) of the user to delete.
 * @throws Error if the user cannot be found or deletion fails.
 * @returns Promise<void>
 */
// Changed userId type to string
export async function deleteUserAccount(userId: string): Promise<void> {
    console.log(`[User Deletion] Attempting to delete user ${userId} and associated data.`);
    let affectedWebsiteIds: number[] = [];

    try {
        // 1. Find associated website IDs BEFORE the transaction
        const userWebsiteLinks = await prisma.websiteUser.findMany({
            where: { userId: userId }, // Prisma handles string ID lookup
            select: { websiteId: true },
        });
        affectedWebsiteIds = userWebsiteLinks.map(link => link.websiteId); // websiteId is still number

        if (affectedWebsiteIds.length > 0) {
             console.log(`[User Deletion] User ${userId} is associated with website IDs: ${affectedWebsiteIds.join(', ')}. Post-deletion checks will be triggered.`);
        } else {
             console.log(`[User Deletion] User ${userId} has no associated websites.`);
        }

        // 2. Use a transaction to delete the user and related data atomically
        await prisma.$transaction(async (tx) => {
            // Use the Prisma Client type provided by the transaction `tx`
            // a. Delete associated Alerts
            const deletedAlerts = await tx.alert.deleteMany({ where: { userId: userId } }); // String ID
            console.log(`[User Deletion Tx] Deleted ${deletedAlerts.count} Alert records for user ${userId}.`);

            // b. Delete associated WebsiteUser records
            const deletedWebsiteUsers = await tx.websiteUser.deleteMany({ where: { userId: userId } }); // String ID
            console.log(`[User Deletion Tx] Deleted ${deletedWebsiteUsers.count} WebsiteUser records for user ${userId}.`);

            // c. Delete the User record itself
            // Note: delete throws if the record doesn't exist by default
            const deletedUser = await tx.user.delete({ where: { id: userId } }); // String ID
            console.log(`[User Deletion Tx] Successfully deleted User record for user ${userId} (Email: ${deletedUser.email}).`);
        });

        console.log(`[User Deletion] Successfully completed deletion transaction for user ${userId}.`);

    } catch (error: any) {
        // Prisma's P2025 error signifies "Record to delete does not exist."
        // This can happen in any of the deleteMany or delete operations within the transaction.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
             console.warn(`[User Deletion] Failed: A required record for user ID ${userId} was not found during deletion transaction. It might have been deleted already. Error: ${error.message}`);
            // Decide if this should be a user-facing error or just a logged warning.
            // If the end result (user is gone) is achieved, maybe don't throw?
            // For now, keeping the throw as it indicates the operation didn't proceed exactly as expected.
            throw new Error(`User or associated record not found during deletion (ID: ${userId}).`);
        }
        console.error(`[User Deletion] Error during transaction for user ${userId}:`, error);
        throw new Error(`Failed to delete user account (ID: ${userId}). Reason: ${error.message || 'Unknown error'}`);
    }

    // 3. Trigger post-deletion checks AFTER successful transaction
    if (affectedWebsiteIds.length > 0) {
        console.log(`[User Deletion] Triggering ${affectedWebsiteIds.length} post-deletion checks asynchronously for user ${userId}.`);
        // Run checks concurrently for efficiency
        const checkPromises = affectedWebsiteIds.map(websiteId => {
            console.log(`[User Deletion] Queuing checks for website ${websiteId} after user ${userId} deletion.`);
            return Promise.allSettled([ // Use allSettled to avoid one failure stopping others
                updateGlobalInterval(websiteId)
                    .catch(err => {
                        console.error(`[Interval Update Post-Delete] Error updating global interval for website ${websiteId} after user ${userId} deletion:`, err);
                        // Potentially re-throw or handle differently if needed
                    }),
                checkAndDeactivateWebsiteIfOrphaned(websiteId)
                    .catch(err => {
                        console.error(`[Orphan Check Post-Delete] Error checking/deactivating website ${websiteId} after user ${userId} deletion:`, err);
                        // Potentially re-throw or handle differently if needed
                    })
            ]);
        });
        // Wait for all checks to complete (or fail)
        await Promise.all(checkPromises);
        console.log(`[User Deletion] Completed all post-deletion checks for user ${userId}.`);
    }
}