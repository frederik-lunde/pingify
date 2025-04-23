// server/src/controllers/alertController.ts
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import * as AlertService from '../services/alertService';
import * as WebsiteService from '../services/websiteService';
import {
    AlertType,
    VALID_ALERT_TYPES,
    Alert as SharedAlert,
    AlertQueryOptions,
    AlertStats,
} from '../types';

// --- Helper Type Guards & Validators ---
const isValidAlertType = (type: any): type is AlertType => {
    return typeof type === 'string' && VALID_ALERT_TYPES.includes(type as AlertType);
};

const isValidId = (id: any): id is number => {
    const num = parseInt(id, 10);
    return !isNaN(num) && num > 0;
};

/**
 * Maps a Prisma Alert (potentially with relations) to the shared Alert type.
 */
const mapPrismaAlertToShared = ( prismaAlert: any ): SharedAlert => {
    const sharedAlert: SharedAlert = {
        id: prismaAlert.id,
        websiteId: prismaAlert.websiteId,
        userId: prismaAlert.userId,
        type: prismaAlert.type as AlertType,
        message: prismaAlert.message,
        createdAt: prismaAlert.createdAt.toISOString(),
        incidentId: prismaAlert.incidentId ?? undefined,
    };
    if (prismaAlert.website) {
        sharedAlert.website = {
            id: prismaAlert.website.id,
            url: prismaAlert.website.url,
            name: prismaAlert.website.websiteUsers?.[0]?.name ?? undefined
        };
    }
    if (prismaAlert.user) {
        sharedAlert.user = { id: prismaAlert.user.id, name: prismaAlert.user.name };
    }
    if (prismaAlert.incident) {
         sharedAlert.incident = {
             id: prismaAlert.incident.id,
             startTime: prismaAlert.incident.startTime?.toISOString(),
             endTime: prismaAlert.incident.endTime?.toISOString() ?? null,
         };
    }
    return sharedAlert;
};

// --- Controller Functions ---

/**
 * GET /api/alerts/user - Get *active* alerts for the authenticated user.
 */
export const getUserAlerts = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) {
             res.status(401).json({ message: 'Authentication required.' });
             return;
        }
        const userId = req.user.id;

        // Input validation
        const { limit = '50', type: typeQuery, from, to, websiteId } = req.query;
        const parsedLimit = parseInt(limit as string, 10);
        if (isNaN(parsedLimit) || parsedLimit <= 0) { res.status(400).json({ message: 'Invalid limit format.' }); return; }
        const validatedType = isValidAlertType(typeQuery) ? typeQuery : undefined;
        const parsedWebsiteId = websiteId ? parseInt(websiteId as string, 10) : undefined;
        if (websiteId && (isNaN(parsedWebsiteId as number) || (parsedWebsiteId as number) <= 0)) { res.status(400).json({ message: 'Invalid websiteId format.' }); return; }

        const options: AlertQueryOptions = { limit: parsedLimit, type: validatedType, from: from ? new Date(from as string) : undefined, to: to ? new Date(to as string) : undefined, websiteId: parsedWebsiteId };
        const alerts = await AlertService.getAlertsForUser(userId, options);
        const responseAlerts: SharedAlert[] = alerts.map(mapPrismaAlertToShared);
        res.json(responseAlerts);
    } catch (error) {
        // Pass all errors from service or unexpected issues to middleware
        next(error);
    }
};

/**
 * DELETE /api/alerts/:alertId - Dismiss (delete) an alert for the user.
 */
export const dismissAlert = async ( req: Request<{ alertId: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) {
             res.status(401).json({ message: 'Authentication required.' });
             return;
        }
        const userId = req.user.id;

        // Input validation
        const { alertId: alertIdParam } = req.params;
        if (!isValidId(alertIdParam)) { res.status(400).json({ message: 'Invalid Alert ID format.' }); return; }
        const alertId = parseInt(alertIdParam, 10);

        const deletedAlert = await AlertService.dismissAlert(userId, alertId);

        // Handle service returning null (not found), not an error
        if (deletedAlert === null) {
            res.status(404).json({ message: 'Alert not found or already dismissed.' });
        } else {
            res.status(204).send(); // Success, no content
        }
    } catch (error) {
        // Pass errors like 'Forbidden' or unexpected ones to middleware
        next(error);
    }
};

/**
 * GET /api/alerts/website/:websiteId - Get *active* alerts for a specific website.
 */
export const getAlertsByWebsite = async ( req: Request<{ websiteId: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) {
             res.status(401).json({ message: 'Authentication required.' });
             return;
        }
        const userId = req.user.id;

        // Input validation
        const { websiteId: websiteIdParam } = req.params;
        const { limit = '50', type: typeQuery, from, to } = req.query;
        if (!isValidId(websiteIdParam)) { res.status(400).json({ message: 'Invalid Website ID format.' }); return; }
        const websiteId = parseInt(websiteIdParam, 10);

        // Access check
        const hasAccess = await WebsiteService.hasUserWebsite(userId, websiteId);
        if (!hasAccess) { res.status(404).json({ message: 'Website not found or access denied.' }); return; }

        const parsedLimit = parseInt(limit as string, 10);
         if (isNaN(parsedLimit) || parsedLimit <= 0) { res.status(400).json({ message: 'Invalid limit format.' }); return; }
        const validatedType = isValidAlertType(typeQuery) ? typeQuery : undefined;

        const options: AlertQueryOptions = { limit: parsedLimit, type: validatedType, from: from ? new Date(from as string) : undefined, to: to ? new Date(to as string) : undefined };
        const alerts = await AlertService.getAlertsByWebsite(websiteId, options);
        const responseAlerts: SharedAlert[] = alerts.map(mapPrismaAlertToShared);
        res.json(responseAlerts);
    } catch (error) {
        // Pass all errors to middleware
        next(error);
    }
};

/**
 * GET /api/alerts/user/stats - Get *active* alert statistics for the authenticated user.
 */
export const getUserAlertStats = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) {
             res.status(401).json({ message: 'Authentication required.' });
             return;
        }
        const userId = req.user.id;

        // Input validation
        const { days = '7' } = req.query;
        const parsedDays = parseInt(days as string, 10);
         if (isNaN(parsedDays) || parsedDays <= 0) { res.status(400).json({ message: 'Invalid days format.' }); return; }

        const stats: AlertStats = await AlertService.getUserAlertStats(userId, parsedDays);
        res.json(stats);
    } catch (error) {
        // Pass all errors to middleware
        next(error);
    }
};