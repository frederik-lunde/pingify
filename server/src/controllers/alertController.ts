// server/src/controllers/alertController.ts

import { Request, Response, NextFunction } from 'express';
import * as AlertService from '../services/alertService';
import * as WebsiteService from '../services/websiteService';
import { AlertType } from '../types'; // <-- Import AlertType

// Helper Type Guard to check if a string is a valid AlertType
const isValidAlertType = (type: any): type is AlertType => {
    return typeof type === 'string' && (type === 'down' || type === 'slow');
};

/**
 * Get recent alerts (admin function)
 */
export const getRecentAlerts = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            limit = '50',
            type: typeQuery, // Rename query param variable
            from,
            to,
            isResolved
        } = req.query;

        // Validate type parameter
        const validatedType = isValidAlertType(typeQuery) ? typeQuery : undefined;

        const alerts = await AlertService.getRecentAlerts({
            limit: parseInt(limit as string, 10),
            type: validatedType, // <-- Use validated type
            from: from ? new Date(from as string) : undefined,
            to: to ? new Date(to as string) : undefined,
            isResolved: isResolved !== undefined ? isResolved === 'true' : undefined
        });

        res.json(alerts);
    } catch (error) {
        next(error);
    }
};

/**
 * Get alerts for the current user
 */
export const getUserAlerts = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const {
            limit = '50',
            type: typeQuery, // Rename query param variable
            from,
            to,
            isResolved
        } = req.query;

        // Validate type parameter
        const validatedType = isValidAlertType(typeQuery) ? typeQuery : undefined;

        const alerts = await AlertService.getAlertsForUser(
            userId,
            {
                limit: parseInt(limit as string, 10),
                type: validatedType, // <-- Use validated type
                from: from ? new Date(from as string) : undefined,
                to: to ? new Date(to as string) : undefined,
                isResolved: isResolved !== undefined ? isResolved === 'true' : undefined
            }
        );

        res.json(alerts);
    } catch (error) {
        next(error);
    }
};

/**
 * Get unread alerts for the current user
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
            type: typeQuery, // Rename query param variable
            from,
            to,
            isResolved
        } = req.query;

         // Validate type parameter
        const validatedType = isValidAlertType(typeQuery) ? typeQuery : undefined;

        const alerts = await AlertService.getUserUnreadAlerts(
            userId,
            {
                limit: parseInt(limit as string, 10),
                type: validatedType, // <-- Use validated type
                from: from ? new Date(from as string) : undefined,
                to: to ? new Date(to as string) : undefined,
                isResolved: isResolved !== undefined ? isResolved === 'true' : undefined
            }
        );

        res.json(alerts);
    } catch (error) {
        next(error);
    }
};

/**
 * Mark an alert as read
 */
export const markAlertAsRead = async (
    req: Request<{ alertId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { alertId } = req.params;
        const parsedAlertId = parseInt(alertId, 10);

        if (isNaN(parsedAlertId)) {
             res.status(400).json({ message: 'Invalid Alert ID format.' });
             return;
        }

        await AlertService.markAlertAsRead(userId, parsedAlertId);

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * Mark all alerts as read
 */
export const markAllAlertsAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id;

        await AlertService.markAllAlertsAsRead(userId);

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * Get alerts for a specific website
 */
export const getAlertsByWebsite = async (
    req: Request<{ websiteId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { websiteId } = req.params;
        const {
            limit = '50',
            type: typeQuery, // Rename query param variable
            from,
            to,
            isResolved
        } = req.query;
        const userId = req.user?.id; // User might be admin, so ID can be optional

        const parsedWebsiteId = parseInt(websiteId, 10);
        if (isNaN(parsedWebsiteId)) {
            res.status(400).json({ message: 'Invalid Website ID format.' });
            return;
        }

        // Check if the user (if not admin) has access to this website
        if (userId) {
            const hasAccess = await WebsiteService.hasUserWebsite(userId, parsedWebsiteId);
            if (!hasAccess) {
                res.status(404).json({ message: 'Website not found or access denied.' });
                return;
            }
        } // If userId is undefined, assume admin access (adjust logic if needed)


         // Validate type parameter
        const validatedType = isValidAlertType(typeQuery) ? typeQuery : undefined;

        const alerts = await AlertService.getAlertsByWebsite(
            parsedWebsiteId,
            {
                limit: parseInt(limit as string, 10),
                type: validatedType, // <-- Use validated type
                from: from ? new Date(from as string) : undefined,
                to: to ? new Date(to as string) : undefined,
                isResolved: isResolved !== undefined ? isResolved === 'true' : undefined
            }
        );

        res.json(alerts);
    } catch (error) {
        next(error);
    }
};

/**
 * Get alert statistics (admin function)
 */
export const getAlertStats = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { days = '7' } = req.query;
        const parsedDays = parseInt(days as string, 10);

        if (isNaN(parsedDays)) {
            res.status(400).json({ message: 'Invalid days format.' });
            return;
        }

        const stats = await AlertService.getAlertStats(parsedDays);

        res.json(stats);
    } catch (error) {
        next(error);
    }
};

/**
 * Get alert statistics for the current user
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

        if (isNaN(parsedDays)) {
            res.status(400).json({ message: 'Invalid days format.' });
            return;
        }

        const stats = await AlertService.getUserAlertStats(userId, parsedDays);

        res.json(stats);
    } catch (error) {
        next(error);
    }
};