// server/src/controllers/websiteController.ts
import { Request, Response, NextFunction } from 'express';
import * as websiteService from '../services/websiteService';
// Import needed DTOs and response types from shared types
import {
    AddWebsiteUserDTO,
    UpdateWebsiteUserDTO,
    Website,
    WebsiteUser,
    SetPinStatusDTO // <-- Import new DTO
} from '../types';

// Helper for safe ID parsing
const parseIdParam = (idParam: string | undefined): number | null => {
    if (!idParam) return null;
    const id = parseInt(idParam, 10);
    return !isNaN(id) && id > 0 ? id : null;
};

/**
 * GET /api/websites/admin/all - Get all websites (admin function)
 */
export const getAllWebsites = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const websites: Website[] = await websiteService.getAllWebsites();
        res.json(websites);
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/websites/user/dashboard - Get websites for the authenticated user (sorted by pin)
 */
export const getUserWebsites = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id;
        // Service function now handles sorting by pin status
        const websiteUsers: WebsiteUser[] = await websiteService.getWebsitesForUser(userId);
        res.json(websiteUsers);
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/websites/:id - Get website by ID
 */
export const getWebsiteById = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const websiteId = parseIdParam(req.params.id);
        if (websiteId === null) {
            res.status(400).json({ message: 'Invalid Website ID format.' });
            return;
        }
        const website: Website | null = await websiteService.getWebsiteById(websiteId);
        if (!website) {
            res.status(404).json({ message: 'Website not found' });
            return;
        }
        res.json(website);
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/websites/user/dashboard/:id - Get user's specific website configuration by ID
 */
export const getUserWebsiteById = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const websiteId = parseIdParam(req.params.id);
        if (websiteId === null) {
            res.status(400).json({ message: 'Invalid Website ID format.' });
            return;
        }
        const userWebsite: WebsiteUser | null = await websiteService.getUserWebsiteById(userId, websiteId);
        if (!userWebsite) {
            res.status(404).json({ message: 'Website not found in your dashboard' });
            return;
        }
        res.json(userWebsite);
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/websites/admin/create - Create a new website (admin function)
 */
export const createWebsite = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { url, interval } = req.body;
        if (!url || typeof url !== 'string') {
             res.status(400).json({ message: 'Missing or invalid URL in request body.' });
             return;
        }
         if (interval !== undefined && (typeof interval !== 'number' || interval <= 0)) {
            res.status(400).json({ message: 'Invalid interval format. Must be a positive number.' });
            return;
        }

        const createData = { url, interval };
        const website: Website = await websiteService.createWebsite(createData);
        res.status(201).json(website);
    } catch (error: any) {
        if (error.message?.includes('already exists')) {
            res.status(409).json({ message: error.message });
        } else if (error.message?.includes('Invalid URL')) {
             res.status(400).json({ message: error.message });
        } else {
            next(error);
        }
    }
};

/**
 * PUT /api/websites/admin/:id - Update a website's core properties (admin function)
 */
export const updateWebsite = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const websiteId = parseIdParam(req.params.id);
        if (websiteId === null) {
            res.status(400).json({ message: 'Invalid Website ID format.' });
            return;
        }
        const updateData = req.body; // Should match Partial<{ url: string; isActive?: boolean }>
        const website: Website | null = await websiteService.updateWebsiteCore(websiteId, updateData);
        if (!website) {
             res.status(404).json({ message: 'Website not found' });
             return;
        }
        res.json(website);
    } catch (error: any) {
        if (error.message?.includes('already exists')) {
            res.status(409).json({ message: error.message });
        } else if (error.message?.includes('Invalid URL')) {
            res.status(400).json({ message: error.message });
        } else {
            next(error);
        }
    }
};

/**
 * PUT /api/websites/user/dashboard/:id - Update a user's website configuration
 */
export const updateUserWebsite = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const websiteId = parseIdParam(req.params.id);
        if (websiteId === null) {
            res.status(400).json({ message: 'Invalid Website ID format.' });
            return;
        }
        // Basic validation: Ensure body is an object
        if (typeof req.body !== 'object' || req.body === null) {
            res.status(400).json({ message: 'Invalid request body. Expected an object.' });
            return;
        }
        // Can add more specific validation (e.g., with zod) later
        const updateDto = req.body as UpdateWebsiteUserDTO;

        const userWebsite: WebsiteUser | null = await websiteService.updateUserWebsite(
            userId,
            websiteId,
            updateDto
        );

        if (!userWebsite) {
            res.status(404).json({ message: 'Website not found in your dashboard for update' });
            return;
        }
        res.json(userWebsite);
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/websites/user/dashboard/:id/pin - Set the pin status for a user's website
 */
export const setPinStatus = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const websiteId = parseIdParam(req.params.id);
        if (websiteId === null) {
            res.status(400).json({ message: 'Invalid Website ID format.' });
            return;
        }

        const { isPinned } = req.body as SetPinStatusDTO;

        // Validate input
        if (typeof isPinned !== 'boolean') {
            res.status(400).json({ message: 'Invalid request body. "isPinned" must be a boolean.' });
            return;
        }

        const userWebsite: WebsiteUser | null = await websiteService.setPinStatusForUser(
            userId,
            websiteId,
            isPinned
        );

        if (!userWebsite) {
            res.status(404).json({ message: 'Website not found in your dashboard to update pin status.' });
            return;
        }
        res.json(userWebsite);
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/websites/admin/:id - Delete a website (admin function)
 */
export const deleteWebsite = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const websiteId = parseIdParam(req.params.id);
        if (websiteId === null) {
            res.status(400).json({ message: 'Invalid Website ID format.' });
            return;
        }
        const deletedWebsite = await websiteService.deleteWebsite(websiteId);
        if (!deletedWebsite) {
             res.status(404).json({ message: 'Website not found for deletion' });
             return;
        }
        // Successful deletion
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/websites/admin/:id/toggle - Toggle a website's active status (admin function)
 */
export const toggleWebsiteStatus = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const websiteId = parseIdParam(req.params.id);
        if (websiteId === null) {
            res.status(400).json({ message: 'Invalid Website ID format.' });
            return;
        }
        const website: Website | null = await websiteService.toggleWebsiteStatus(websiteId);
        if (!website) {
            res.status(404).json({ message: 'Website not found for toggle' });
            return;
        }
        res.json(website);
    } catch (error) {
        next(error);
    }
};


/**
 * POST /api/websites/user/dashboard - Add a website to user's dashboard
 */
export const addWebsiteToUser = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id;
        // Basic validation: Ensure body is an object
        if (typeof req.body !== 'object' || req.body === null) {
            res.status(400).json({ message: 'Invalid request body. Expected an object.' });
            return;
        }
        // Can add more specific validation (e.g., with zod) later
        const websiteData = req.body as AddWebsiteUserDTO;

        // Ensure URL is present (service layer also checks format)
        if (!websiteData.url) {
             res.status(400).json({ message: 'Missing "url" in request body.' });
             return;
        }

        const websiteUser: WebsiteUser = await websiteService.addWebsiteToUser(userId, websiteData);
        res.status(201).json(websiteUser);
    } catch (error: any) {
        if (error.message?.includes('Invalid URL')) {
            res.status(400).json({ message: error.message });
        } else if (error.message?.includes('Failed to add website')) {
             res.status(500).json({ message: error.message });
        } else {
            next(error);
        }
    }
};

/**
 * DELETE /api/websites/user/dashboard/:id - Remove a website from user's dashboard
 */
export const removeWebsiteFromUser = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const websiteId = parseIdParam(req.params.id);
        if (websiteId === null) {
            res.status(400).json({ message: 'Invalid Website ID format.' });
            return;
        }
        await websiteService.removeWebsiteFromUser(userId, websiteId);
        // Successful removal
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/websites/search - Search websites by URL
 */
export const searchWebsites = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { query } = req.query;
        if (typeof query !== 'string' || query.trim().length < 2) {
             res.status(400).json({ message: 'Search query must be at least 2 characters long.' });
             return;
        }
        const websites: Website[] = await websiteService.searchWebsites(query);
        res.json(websites);
    } catch (error) {
        next(error);
    }
};