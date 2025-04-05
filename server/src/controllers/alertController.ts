// server/src/controllers/alertController.ts

import { Request, Response, NextFunction } from 'express';
import * as AlertService from '../services/alertService';
import * as WebsiteService from '../services/websiteService'; // Needed for access checks
import { AlertType } from '../types'; // Assuming shared types are in '../types'
import { Prisma } from '@prisma/client'; // Import Prisma types if needed for detailed error handling

// --- Helper Type Guard ---

// Validates if a string matches one of the defined AlertType values.
const VALID_ALERT_TYPES: AlertType[] = ["down", "slow", "recovered", "ssl", "dns"];
const isValidAlertType = (type: any): type is AlertType => {
    return typeof type === 'string' && VALID_ALERT_TYPES.includes(type as AlertType);
};

// --- Input Validation Helper ---

// Simple helper to validate if an ID is a positive integer
const isValidId = (id: any): id is number => {
    const num = parseInt(id, 10);
    return !isNaN(num) && num > 0;
};


// --- Controller Functions ---

/**
 * GET /api/alerts/admin/all - Get recent alerts system-wide (Admin).
 */
export const getRecentAlerts = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            limit = '50', // Default limit
            type: typeQuery,
            from,
            to,
            isResolved
        } = req.query;

        const parsedLimit = parseInt(limit as string, 10);
        if (isNaN(parsedLimit) || parsedLimit <= 0) {
            res.status(400).json({ message: 'Invalid limit format. Must be a positive number.' });
            return;
        }

        const validatedType = isValidAlertType(typeQuery) ? typeQuery : undefined;

        const options = {
            limit: parsedLimit,
            type: validatedType,
            from: from ? new Date(from as string) : undefined,
            to: to ? new Date(to as string) : undefined,
            isResolved: isResolved !== undefined ? isResolved === 'true' : undefined
        };

        const alerts = await AlertService.getRecentAlerts(options);
        res.json(alerts); // Return PrismaAlert[]

    } catch (error) {
        console.error("Error fetching recent alerts (admin):", error);
        next(error); // Pass to error handling middleware
    }
};

/**
 * GET /api/alerts/user - Get alerts associated with the authenticated user.
 */
export const getUserAlerts = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id; // Assumes authenticate middleware sets req.user
        const {
            limit = '50',
            type: typeQuery,
            from,
            to,
            isResolved,
            isRead // Allow filtering by read status
        } = req.query;

        const parsedLimit = parseInt(limit as string, 10);
         if (isNaN(parsedLimit) || parsedLimit <= 0) {
             res.status(400).json({ message: 'Invalid limit format.' });
             return;
         }

        const validatedType = isValidAlertType(typeQuery) ? typeQuery : undefined;

        const options = {
            limit: parsedLimit,
            type: validatedType,
            from: from ? new Date(from as string) : undefined,
            to: to ? new Date(to as string) : undefined,
            isResolved: isResolved !== undefined ? isResolved === 'true' : undefined,
            isRead: isRead !== undefined ? isRead === 'true' : undefined // Pass isRead filter
        };

        const alerts = await AlertService.getAlertsForUser(userId, options);
        res.json(alerts); // Return PrismaAlert[] with specific AlertUser relation included

    } catch (error) {
         console.error(`Error fetching alerts for user ${req.user?.id}:`, error);
        next(error);
    }
};

/**
 * GET /api/alerts/user/unread - Get unread alerts for the authenticated user.
 */
export const getUserUnreadAlerts = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const {
            limit = '50',
            type: typeQuery,
            from,
            to,
            isResolved // Allow filtering unread alerts by resolved status
        } = req.query;

         const parsedLimit = parseInt(limit as string, 10);
         if (isNaN(parsedLimit) || parsedLimit <= 0) {
             res.status(400).json({ message: 'Invalid limit format.' });
             return;
         }

        const validatedType = isValidAlertType(typeQuery) ? typeQuery : undefined;

        const options = {
            limit: parsedLimit,
            type: validatedType,
            from: from ? new Date(from as string) : undefined,
            to: to ? new Date(to as string) : undefined,
            isResolved: isResolved !== undefined ? isResolved === 'true' : undefined
            // isRead is implicitly false here, handled by the service function
        };

        // Service returns PrismaAlertUser[] with nested Alert/Website
        const alertUsers = await AlertService.getUserUnreadAlerts(userId, options);
        res.json(alertUsers);

    } catch (error) {
         console.error(`Error fetching unread alerts for user ${req.user?.id}:`, error);
        next(error);
    }
};

/**
 * POST /api/alerts/user/read/:alertId - Mark a specific alert as read for the user.
 */
export const markAlertAsRead = async (
    req: Request<{ alertId: string }>, // Define params structure
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { alertId: alertIdParam } = req.params;

        if (!isValidId(alertIdParam)) {
             res.status(400).json({ message: 'Invalid Alert ID format. Must be a positive number.' });
             return;
        }
        const alertId = parseInt(alertIdParam, 10);

        const result = await AlertService.markAlertAsRead(userId, alertId);

        // Optional: Log if no rows were affected (alert didn't exist for user or was already read)
        if (result.count === 0) {
           console.log(`MarkAsRead: Alert ${alertId} not found or already read for user ${userId}.`);
        }

        res.status(204).send(); // Success, no content to return

    } catch (error) {
         console.error(`Error marking alert ${req.params.alertId} as read for user ${req.user?.id}:`, error);
        next(error);
    }
};

/**
 * POST /api/alerts/user/read-all - Mark all alerts as read for the user.
 */
export const markAllAlertsAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const result = await AlertService.markAllAlertsAsRead(userId);

        console.log(`MarkAllAsRead: Marked ${result.count} alerts as read for user ${userId}.`);
        res.status(204).send(); // Success, no content

    } catch (error) {
         console.error(`Error marking all alerts as read for user ${req.user?.id}:`, error);
        next(error);
    }
};

/**
 * DELETE /api/alerts/user/:alertId - Dismiss (delete link) an alert for the user.
 */
export const deleteAlertForUser = async (
    req: Request<{ alertId: string }>, // Define params structure
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { alertId: alertIdParam } = req.params;

        if (!isValidId(alertIdParam)) {
            res.status(400).json({ message: 'Invalid Alert ID format. Must be a positive number.' });
            return;
        }
         const alertId = parseInt(alertIdParam, 10);

        const result = await AlertService.deleteAlertForUser(userId, alertId);

        // Optional: Log if the link didn't exist
        if (result.count === 0) {
            console.log(`DeleteAlertForUser: AlertUser link for user ${userId} / alert ${alertId} not found.`);
        } else {
            console.log(`DeleteAlertForUser: Successfully dismissed alert ${alertId} for user ${userId}.`);
        }

        res.status(204).send(); // Success, no content (even if link didn't exist - idempotent)

    } catch (error) {
        console.error(`Error dismissing alert ${req.params.alertId} for user ${req.user?.id}:`, error);
        next(error);
    }
};


/**
 * GET /api/alerts/website/:websiteId - Get alerts for a specific website.
 * Requires user to have access to the website.
 */
export const getAlertsByWebsite = async (
    req: Request<{ websiteId: string }>, // Define params structure
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id; // Assuming user must be logged in to access this
        const { websiteId: websiteIdParam } = req.params;
        const {
            limit = '50',
            type: typeQuery,
            from,
            to,
            isResolved
        } = req.query;


        if (!isValidId(websiteIdParam)) {
            res.status(400).json({ message: 'Invalid Website ID format. Must be a positive number.' });
            return;
        }
        const websiteId = parseInt(websiteIdParam, 10);

        // Authorization Check: Ensure the user has access to this website
        // Adjust if admins have universal access without needing WebsiteUser link
        const hasAccess = await WebsiteService.hasUserWebsite(userId, websiteId);
        if (!hasAccess) {
            // Use 404 Not Found to avoid revealing existence of website user doesn't own
            res.status(404).json({ message: 'Website not found or access denied.' });
            return;
        }

        // Input validation for query params
        const parsedLimit = parseInt(limit as string, 10);
         if (isNaN(parsedLimit) || parsedLimit <= 0) {
             res.status(400).json({ message: 'Invalid limit format.' });
             return;
         }

        const validatedType = isValidAlertType(typeQuery) ? typeQuery : undefined;

        const options = {
            limit: parsedLimit,
            type: validatedType,
            from: from ? new Date(from as string) : undefined,
            to: to ? new Date(to as string) : undefined,
            isResolved: isResolved !== undefined ? isResolved === 'true' : undefined
        };

        const alerts = await AlertService.getAlertsByWebsite(websiteId, options);
        res.json(alerts); // Returns PrismaAlert[]

    } catch (error) {
         console.error(`Error fetching alerts for website ${req.params.websiteId}, user ${req.user?.id}:`, error);
        next(error);
    }
};

/**
 * GET /api/alerts/admin/stats - Get system-wide alert statistics (Admin).
 */
export const getAlertStats = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { days = '7' } = req.query; // Default to 7 days
        const parsedDays = parseInt(days as string, 10);

        if (isNaN(parsedDays) || parsedDays <= 0) {
            res.status(400).json({ message: 'Invalid days format. Must be a positive number.' });
            return;
        }

        const stats = await AlertService.getAlertStats(parsedDays);
        res.json(stats); // Returns AlertStats object

    } catch (error) {
         console.error("Error fetching admin alert stats:", error);
        next(error);
    }
};

/**
 * GET /api/alerts/user/stats - Get alert statistics for the authenticated user.
 */
export const getUserAlertStats = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { days = '7' } = req.query;
        const parsedDays = parseInt(days as string, 10);

         if (isNaN(parsedDays) || parsedDays <= 0) {
            res.status(400).json({ message: 'Invalid days format.' });
            return;
        }

        const stats = await AlertService.getUserAlertStats(userId, parsedDays);
        res.json(stats); // Returns AlertStats object tailored to the user

    } catch (error) {
        console.error(`Error fetching stats for user ${req.user?.id}:`, error);
        next(error);
    }
};