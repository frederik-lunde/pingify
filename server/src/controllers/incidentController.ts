// server/src/controllers/incidentController.ts
import { Request, Response, NextFunction } from 'express';
import * as IncidentService from '../services/incidentService';
import * as WebsiteService from '../services/websiteService'; // For access checks
import { IncidentQueryOptions, Incident, IncidentCountResponse, IncidentType, VALID_INCIDENT_TYPES } from '../types'; // Adjust path if necessary
import { subHours } from 'date-fns';

// --- Helper Type Guards & Validators ---
const isValidIncidentType = (type: any): type is IncidentType => {
    return typeof type === 'string' && VALID_INCIDENT_TYPES.includes(type as IncidentType);
};

const isValidId = (id: any): id is number => {
    const num = parseInt(id, 10);
    return !isNaN(num) && num > 0;
};

const isValidStatus = (status: any): status is 'open' | 'closed' => {
    return status === 'open' || status === 'closed';
};

// --- Controller Functions ---

/**
 * GET /api/incidents/user - Get incidents for websites monitored by the authenticated user.
 */
export const getUserIncidents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) {
             res.status(401).json({ message: 'Authentication required.' });
             return;
        }
        const userId = req.user.id;

        // Input validation
        const { limit = '50', type: typeQuery, from, to, websiteId: websiteIdQuery, status: statusQuery } = req.query;
        const parsedLimit = parseInt(limit as string, 10);
        if (isNaN(parsedLimit) || parsedLimit <= 0) { res.status(400).json({ message: 'Invalid limit format.' }); return; }
        const validatedType = isValidIncidentType(typeQuery) ? typeQuery : undefined;
        const parsedWebsiteId = websiteIdQuery ? parseInt(websiteIdQuery as string, 10) : undefined;
        if (websiteIdQuery && (isNaN(parsedWebsiteId as number) || (parsedWebsiteId as number) <= 0)) { res.status(400).json({ message: 'Invalid websiteId format.' }); return; }
        const validatedStatus = isValidStatus(statusQuery) ? statusQuery : undefined;

        const options: IncidentQueryOptions = { limit: parsedLimit, type: validatedType, from: from ? new Date(from as string) : undefined, to: to ? new Date(to as string) : undefined, userId: userId, websiteId: parsedWebsiteId, status: validatedStatus };
        const incidents: Incident[] = await IncidentService.getIncidents(options, userId);
        res.json(incidents);

    } catch (error) {
        // Pass all errors to middleware
        next(error);
    }
};

/**
 * GET /api/incidents/website/:websiteId - Get incidents for a specific website.
 */
export const getWebsiteIncidents = async (req: Request<{ websiteId: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) {
             res.status(401).json({ message: 'Authentication required.' });
             return;
        }
        const userId = req.user.id;

        // Input validation
        const { websiteId: websiteIdParam } = req.params;
        const { limit = '50', type: typeQuery, from, to, status: statusQuery } = req.query;
        if (!isValidId(websiteIdParam)) { res.status(400).json({ message: 'Invalid Website ID format.' }); return; }
        const websiteId = parseInt(websiteIdParam, 10);

        // Access Check
        const hasAccess = await WebsiteService.hasUserWebsite(userId, websiteId);
        if (!hasAccess) { res.status(404).json({ message: 'Website not found or access denied.' }); return; }

        const parsedLimit = parseInt(limit as string, 10);
        if (isNaN(parsedLimit) || parsedLimit <= 0) { res.status(400).json({ message: 'Invalid limit format.' }); return; }
        const validatedType = isValidIncidentType(typeQuery) ? typeQuery : undefined;
        const validatedStatus = isValidStatus(statusQuery) ? statusQuery : undefined;

        const options: IncidentQueryOptions = { limit: parsedLimit, type: validatedType, from: from ? new Date(from as string) : undefined, to: to ? new Date(to as string) : undefined, websiteId: websiteId, status: validatedStatus };
        const incidents: Incident[] = await IncidentService.getIncidents(options, userId);
        res.json(incidents);

    } catch (error) {
        // Pass all errors to middleware
        next(error);
    }
};

/**
 * GET /api/incidents/user/count/last24h - Get count of incidents started in last 24h for user.
 */
export const getUserIncidentCountLast24h = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) {
             res.status(401).json({ message: 'Authentication required.' });
             return;
        }
        const userId = req.user.id;

        const twentyFourHoursAgo = subHours(new Date(), 24);
        const count = await IncidentService.countIncidents({ userId: userId, from: twentyFourHoursAgo });
        const response: IncidentCountResponse = { incidentCount: count };
        res.json(response);

    } catch (error) {
        // Pass all errors to middleware
        next(error);
    }
};