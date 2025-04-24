// server/src/controllers/userController.ts
import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/userService';
import { UpdateUserData, UpdatePasswordData } from '../services/userService'; // Import interfaces

/**
 * GET /api/users/me - Get the current user's profile.
 * No input validation needed beyond authentication.
 */
export const getMyProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        const user = await userService.findUserById(req.user.id);
        if (!user) {
            // Should not happen if token is valid, but good practice
            res.status(404).json({ message: 'User associated with token not found' });
            return;
        }
        res.json({ user });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/users/me - Update the current user's profile (name, email).
 * Validation handled by middleware.
 */
export const updateMyProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        const userId = req.user.id;

        // Access validated and potentially sanitized body data
        const updateData = req.body as UpdateUserData;

        const updatedUser = await userService.updateUserProfile(userId, updateData);
        res.json({ user: updatedUser, message: 'Profile updated successfully.' });
    } catch (error) {
        // Handle specific service errors (like email conflict)
        if (error instanceof Error && error.message.includes('Email already in use')) {
             res.status(409).json({ message: error.message });
        } else if (error instanceof Error && error.message.includes('No update data provided')) {
             res.status(400).json({ message: error.message }); // Should be caught by validator, but good fallback
        } else {
             next(error);
        }
    }
};

/**
 * PATCH /api/users/me/password - Update the current user's password.
 * Validation handled by middleware.
 */
export const updateMyPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        const userId = req.user.id;

        // Access validated body data
        const passwordData = req.body as UpdatePasswordData;

        await userService.updateUserPassword(userId, passwordData);
        res.json({ message: 'Password updated successfully.' });
    } catch (error) {
         // Handle specific service errors
         if (error instanceof Error && error.message.includes('Invalid current password')) {
             res.status(400).json({ message: error.message });
         } else if (error instanceof Error && error.message.includes('required')) {
             res.status(400).json({ message: error.message }); // Should be caught by validator
         } else if (error instanceof Error && error.message.includes('User not found')) {
             res.status(404).json({ message: error.message });
         }
         else {
             next(error);
         }
    }
};

/**
 * DELETE /api/users/me - Delete the current user's account.
 * No input validation needed beyond authentication.
 */
export const deleteMyAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        const userId = req.user.id;

        await userService.deleteUserAccount(userId);
        res.status(204).send(); // Success, no content
    } catch (error) {
         // Handle specific service errors
         if (error instanceof Error && error.message.includes('not found during deletion')) {
             // Log the error server-side, but maybe return 404 or 204 to client?
             // Let's return 404 as the primary resource (user) wasn't found for the action.
             console.warn(`Attempted to delete non-existent user or related record: ${req.user?.id}`);
             res.status(404).json({ message: 'User not found or already deleted.' });
         } else {
            next(error);
         }
    }
};