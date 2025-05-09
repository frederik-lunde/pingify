import { User } from "@prisma/client";
import bcrypt from "bcrypt";
import prisma from "../prisma/prismaClient";
import { Prisma } from "@prisma/client";
import {
  updateGlobalInterval,
  checkAndDeactivateWebsiteIfOrphaned,
} from "./websiteService";

const SALT_ROUNDS = 10;

export interface UpdateUserData {
  name?: string;
  email?: string;
}

export interface UpdatePasswordData {
  currentPassword?: string;
  newPassword?: string;
}

type UserWithoutPassword = Omit<User, "password">;

/**
 * Finds a user by their ID, excluding the password field.
 */
export async function findUserById(
  userId: string,
): Promise<UserWithoutPassword | null> {
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
 * Updates a user's profile information (name and/or email).
 */
export async function updateUserProfile(
  userId: string,
  data: UpdateUserData,
): Promise<UserWithoutPassword> {
  if (!data.name && !data.email) {
    throw new Error("No update data provided.");
  }

  const updatePayload: Partial<User> = {};
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new Error("Email already in use by another account.");
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
 * Updates a user's password after verifying their current password.
 */
export async function updateUserPassword(
  userId: string,
  passwordData: UpdatePasswordData,
): Promise<void> {
  if (!passwordData.currentPassword || !passwordData.newPassword) {
    throw new Error("Current and new password are required.");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found.");
  }

  const isPasswordValid = await bcrypt.compare(
    passwordData.currentPassword,
    user.password,
  );
  if (!isPasswordValid) {
    throw new Error("Invalid current password.");
  }

  if (passwordData.newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters long.");
  }

  const hashedNewPassword = await bcrypt.hash(
    passwordData.newPassword,
    SALT_ROUNDS,
  );

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedNewPassword },
  });
}

/**
 * Deletes a user's account and all associated data (alerts, website user links).
 * Also triggers checks for orphaned websites.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  console.log(
    `[User Deletion] Attempting to delete user ${userId} and associated data.`,
  );
  let affectedWebsiteIds: number[] = [];

  try {
    const userWebsiteLinks = await prisma.websiteUser.findMany({
      where: { userId: userId },
      select: { websiteId: true },
    });
    affectedWebsiteIds = userWebsiteLinks.map((link) => link.websiteId);

    if (affectedWebsiteIds.length > 0) {
      console.log(
        `[User Deletion] User ${userId} is associated with website IDs: ${affectedWebsiteIds.join(", ")}. Post-deletion checks will be triggered.`,
      );
    } else {
      console.log(`[User Deletion] User ${userId} has no associated websites.`);
    }

    await prisma.$transaction(async (tx) => {
      const deletedAlerts = await tx.alert.deleteMany({
        where: { userId: userId },
      });
      console.log(
        `[User Deletion Tx] Deleted ${deletedAlerts.count} Alert records for user ${userId}.`,
      );

      const deletedWebsiteUsers = await tx.websiteUser.deleteMany({
        where: { userId: userId },
      });
      console.log(
        `[User Deletion Tx] Deleted ${deletedWebsiteUsers.count} WebsiteUser records for user ${userId}.`,
      );

      const deletedUser = await tx.user.delete({ where: { id: userId } });
      console.log(
        `[User Deletion Tx] Successfully deleted User record for user ${userId} (Email: ${deletedUser.email}).`,
      );
    });

    console.log(
      `[User Deletion] Successfully completed deletion transaction for user ${userId}.`,
    );
  } catch (error: any) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      console.warn(
        `[User Deletion] Failed: A required record for user ID ${userId} was not found during deletion transaction. It might have been deleted already. Error: ${error.message}`,
      );

      throw new Error(
        `User or associated record not found during deletion (ID: ${userId}).`,
      );
    }
    console.error(
      `[User Deletion] Error during transaction for user ${userId}:`,
      error,
    );
    throw new Error(
      `Failed to delete user account (ID: ${userId}). Reason: ${error.message || "Unknown error"}`,
    );
  }

  if (affectedWebsiteIds.length > 0) {
    console.log(
      `[User Deletion] Triggering ${affectedWebsiteIds.length} post-deletion checks asynchronously for user ${userId}.`,
    );

    const checkPromises = affectedWebsiteIds.map((websiteId) => {
      console.log(
        `[User Deletion] Queuing checks for website ${websiteId} after user ${userId} deletion.`,
      );
      return Promise.allSettled([
        updateGlobalInterval(websiteId).catch((err) => {
          console.error(
            `[Interval Update Post-Delete] Error updating global interval for website ${websiteId} after user ${userId} deletion:`,
            err,
          );
        }),
        checkAndDeactivateWebsiteIfOrphaned(websiteId).catch((err) => {
          console.error(
            `[Orphan Check Post-Delete] Error checking/deactivating website ${websiteId} after user ${userId} deletion:`,
            err,
          );
        }),
      ]);
    });

    await Promise.all(checkPromises);
    console.log(
      `[User Deletion] Completed all post-deletion checks for user ${userId}.`,
    );
  }
}

import { Request, Response, NextFunction } from "express";
import * as userService from "../services/userService";
// UpdateUserData and UpdatePasswordData are already defined above in this file.
// If they were meant to be imported from a different types file, the import path would need adjustment.
// For now, assuming they refer to the interfaces defined in this service file.

/**
 * Handles the request to get the authenticated user's profile.
 */
export const getMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    const user = await userService.findUserById(req.user.id);
    if (!user) {
      res.status(404).json({ message: "User associated with token not found" });
      return;
    }
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles the request to update the authenticated user's profile.
 */
export const updateMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    const userId = req.user.id;

    const updateData = req.body as UpdateUserData;

    const updatedUser = await userService.updateUserProfile(userId, updateData);
    res.json({ user: updatedUser, message: "Profile updated successfully." });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Email already in use")
    ) {
      res.status(409).json({ message: error.message });
    } else if (
      error instanceof Error &&
      error.message.includes("No update data provided")
    ) {
      res.status(400).json({ message: error.message });
    } else {
      next(error);
    }
  }
};
/**
 * Handles the request to update the authenticated user's password.
 */
export const updateMyPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    const userId = req.user.id;

    const passwordData = req.body as UpdatePasswordData;

    await userService.updateUserPassword(userId, passwordData);
    res.json({ message: "Password updated successfully." });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Invalid current password")
    ) {
      res.status(400).json({ message: error.message });
    } else if (error instanceof Error && error.message.includes("required")) {
      res.status(400).json({ message: error.message });
    } else if (
      error instanceof Error &&
      error.message.includes("User not found")
    ) {
      res.status(404).json({ message: error.message });
    } else {
      next(error);
    }
  }
};

/**
 * Handles the request to delete the authenticated user's account.
 */
export const deleteMyAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    const userId = req.user.id;

    await userService.deleteUserAccount(userId);
    res.status(204).send();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("not found during deletion")
    ) {
      console.warn(
        `Attempted to delete non-existent user or related record: ${req.user?.id}`,
      );
      res.status(404).json({ message: "User not found or already deleted." });
    } else {
      next(error);
    }
  }
};
