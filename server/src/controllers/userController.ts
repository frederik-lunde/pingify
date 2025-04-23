// server/src/controllers/userController.ts
import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/userService';
import { UpdateUserData, UpdatePasswordData } from '../services/userService'; // Import interfaces

// Controller to get the current user's profile
export const getMyProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        const user = await userService.findUserById(req.user.id);
        // Handle service returning null (not found)
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        res.json({ user });
    } catch (error) {
        // Pass all errors to middleware
        next(error);
    }
};

// Controller to update the current user's profile (name, email)
export const updateMyProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        const userId = req.user.id;

        // Input validation
        const { name, email } = req.body as UpdateUserData;
        if (!name && !email) { res.status(400).json({ message: 'Name or email must be provided for update.' }); return; }
        if (email && typeof email !== 'string') { res.status(400).json({ message: 'Invalid email format.' }); return; }
        if (name && typeof name !== 'string') { res.status(400).json({ message: 'Invalid name format.' }); return; }

        const updatedUser = await userService.updateUserProfile(userId, { name, email });
        // Assuming service throws on conflict or other errors
        res.json({ user: updatedUser, message: 'Profile updated successfully.' });
    } catch (error) {
        // Pass errors like 'Email already in use' or others to middleware
        next(error);
    }
};

// Controller to update the current user's password
export const updateMyPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        const userId = req.user.id;

        // Input validation
        const { currentPassword, newPassword } = req.body as UpdatePasswordData;
        if (!currentPassword || !newPassword) { res.status(400).json({ message: 'Current password and new password are required.' }); return; }
        if (typeof newPassword !== 'string' || newPassword.length < 6) { res.status(400).json({ message: 'New password must be at least 6 characters long.' }); return; }

        await userService.updateUserPassword(userId, { currentPassword, newPassword });
        // Assuming service throws on invalid current password or other errors
        res.json({ message: 'Password updated successfully.' });
    } catch (error) {
        // Pass errors like 'Invalid current password' or others to middleware
        next(error);
    }
};

// Controller to delete the current user's account
export const deleteMyAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        const userId = req.user.id;

        await userService.deleteUserAccount(userId);
        // Assuming service throws if user not found
        res.status(204).send(); // Success, no content
    } catch (error) {
        // Pass errors like 'User not found' or others to middleware
        next(error);
    }
};