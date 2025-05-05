// server/src/controllers/websiteController.ts
import { Request, Response, NextFunction } from 'express';
import * as websiteService from '../services/websiteService';
import {
    AddWebsiteUserDTO,
    UpdateWebsiteUserDTO,
    Website,
    WebsiteUser,
    SetPinStatusDTO
} from '../types';

/**
 * GET /api/websites/admin/all - Get all websites (admin function).
 * No input validation needed beyond auth/admin check.
 */
export const getAllWebsites = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Optional: Add admin role check here if needed
        const websites: Website[] = await websiteService.getAllWebsites();
        res.json(websites);
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/websites/user/dashboard - Get websites for the authenticated user.
 * No input validation needed beyond auth.
 */
export const getUserWebsites = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;

        const websiteUsers: WebsiteUser[] = await websiteService.getWebsitesForUser(userId);
        res.json(websiteUsers);
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/websites/:id - Get website by ID (publicly accessible info).
 * Validation handled by middleware.
 */
export const getWebsiteById = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Access validated ID (already parsed to int)
        const websiteId = req.params.id as unknown as number;

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
 * GET /api/websites/user/dashboard/:id - Get user's specific website configuration by ID.
 * Validation handled by middleware.
 */
export const getUserWebsiteById = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;

        // Access validated ID (already parsed to int)
        const websiteId = req.params.id as unknown as number;

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
 * POST /api/websites/admin/create - Create a new website (admin function).
 * Validation handled by middleware.
 */
export const createWebsite = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Optional: Add admin role check here if needed

        // Access validated body data
        const { url, interval } = req.body;

        const createData = { url, interval }; // Pass validated data
        const website: Website = await websiteService.createWebsite(createData);
        res.status(201).json(website);
    } catch (error) {
        // Handle specific service errors
        if (error instanceof Error && (error.message.includes('Invalid URL') || error.message.includes('already exists'))) {
            res.status(400).json({ message: error.message });
        } else {
            next(error);
        }
    }
};

/**
 * PUT /api/websites/admin/:id - Update a website's core properties (admin function).
 * Validation handled by middleware.
 */
export const updateWebsite = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Optional: Add admin role check here if needed

        // Access validated params and body
        const websiteId = req.params.id as unknown as number;
        const updateData = req.body; // Contains validated url or isActive

        const website: Website | null = await websiteService.updateWebsiteCore(websiteId, updateData);
        if (!website) {
            res.status(404).json({ message: 'Website not found' });
            return;
        }
        res.json(website);
    } catch (error) {
         // Handle specific service errors
        if (error instanceof Error && (error.message.includes('Invalid URL') || error.message.includes('already exists'))) {
            res.status(400).json({ message: error.message });
        } else {
            next(error);
        }
    }
};

/**
 * PUT /api/websites/user/dashboard/:id - Update a user's website configuration.
 * Validation handled by middleware.
 */
export const updateUserWebsite = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;

        // Access validated params and body
        const websiteId = req.params.id as unknown as number;
        const updateDto = req.body as UpdateWebsiteUserDTO; // Contains validated fields

        const userWebsite: WebsiteUser | null = await websiteService.updateUserWebsite( userId, websiteId, updateDto );
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
 * PATCH /api/websites/user/dashboard/:id/pin - Set the pin status for a user's website.
 * Validation handled by middleware.
 */
export const setPinStatus = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;

        // Access validated params and body
        const websiteId = req.params.id as unknown as number;
        const { isPinned } = req.body as SetPinStatusDTO; // Contains validated boolean

        const userWebsite: WebsiteUser | null = await websiteService.setPinStatusForUser( userId, websiteId, isPinned );
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
 * DELETE /api/websites/admin/:id - Delete a website (admin function).
 * Validation handled by middleware.
 */
export const deleteWebsite = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
         // Optional: Add admin role check here if needed

        // Access validated ID (already parsed to int)
        const websiteId = req.params.id as unknown as number;

        const deletedWebsite = await websiteService.deleteWebsite(websiteId);
        if (!deletedWebsite) {
            res.status(404).json({ message: 'Website not found for deletion' });
            return;
        }
        res.status(204).send(); // Success, no content
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/websites/admin/:id/toggle - Toggle a website's active status (admin function).
 * Validation handled by middleware.
 */
export const toggleWebsiteStatus = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Optional: Add admin role check here if needed

        // Access validated ID (already parsed to int)
        const websiteId = req.params.id as unknown as number;

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
 * POST /api/websites/user/dashboard - Add a website to user's dashboard.
 * Validation handled by middleware.
 */
export const addWebsiteToUser = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;

        // Access validated body data
        const websiteData = req.body as AddWebsiteUserDTO; // Contains validated fields

        const websiteUser: WebsiteUser = await websiteService.addWebsiteToUser(userId, websiteData);
        res.status(201).json(websiteUser);
    } catch (error) {
         // Handle specific service errors
        if (error instanceof Error && (error.message.includes('Invalid URL') || error.message.includes('Failed to add website'))) {
             res.status(400).json({ message: error.message });
        } else {
            next(error);
        }
    }
};

/**
 * DELETE /api/websites/user/dashboard/:id - Remove a website from user's dashboard.
 * Validation handled by middleware.
 */
export const removeWebsiteFromUser = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;

        // Access validated ID (already parsed to int)
        const websiteId = req.params.id as unknown as number;

        // Service handles "not found" internally, just call it
        await websiteService.removeWebsiteFromUser(userId, websiteId);
        res.status(204).send(); // Success, no content
    } catch (error) {
        // Handle potential generic error from service if needed
        if (error instanceof Error && error.message.includes('Failed to remove website')) {
             res.status(500).json({ message: error.message });
        } else {
            next(error);
        }
    }
};

/**
 * GET /api/websites/search - Search websites by URL.
 * Validation handled by middleware.
 */
export const searchWebsites = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Access validated & escaped query
        const query = req.query.query as string;

        const websites: Website[] = await websiteService.searchWebsites(query);
        res.json(websites);
    } catch (error) {
        next(error);
    }
};