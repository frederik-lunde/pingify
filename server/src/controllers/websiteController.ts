// server/src/controllers/websiteController.ts
import { Request, Response, NextFunction } from 'express';
import * as websiteService from '../services/websiteService';
// Import needed DTOs and response types from shared types
import {
    AddWebsiteUserDTO,
    UpdateWebsiteUserDTO,
    Website,
    WebsiteUser,
    SetPinStatusDTO
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
export const getAllWebsites = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
        const websites: Website[] = await websiteService.getAllWebsites();
        res.json(websites);
    } catch (error) {
        // Pass all errors to middleware
        next(error);
    }
};

/**
 * GET /api/websites/user/dashboard - Get websites for the authenticated user
 */
export const getUserWebsites = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;

        const websiteUsers: WebsiteUser[] = await websiteService.getWebsitesForUser(userId);
        res.json(websiteUsers);
    } catch (error) {
        // Pass all errors to middleware
        next(error);
    }
};

/**
 * GET /api/websites/:id - Get website by ID
 */
export const getWebsiteById = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Input validation
        const websiteId = parseIdParam(req.params.id);
        if (websiteId === null) { res.status(400).json({ message: 'Invalid Website ID format.' }); return; }

        const website: Website | null = await websiteService.getWebsiteById(websiteId);
        // Handle service returning null (not found)
        if (!website) { res.status(404).json({ message: 'Website not found' }); return; }
        res.json(website);
    } catch (error) {
        // Pass all errors to middleware
        next(error);
    }
};

/**
 * GET /api/websites/user/dashboard/:id - Get user's specific website configuration by ID
 */
export const getUserWebsiteById = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;

        // Input validation
        const websiteId = parseIdParam(req.params.id);
        if (websiteId === null) { res.status(400).json({ message: 'Invalid Website ID format.' }); return; }

        const userWebsite: WebsiteUser | null = await websiteService.getUserWebsiteById(userId, websiteId);
        // Handle service returning null (not found)
        if (!userWebsite) { res.status(404).json({ message: 'Website not found in your dashboard' }); return; }
        res.json(userWebsite);
    } catch (error) {
        // Pass all errors to middleware
        next(error);
    }
};

/**
 * POST /api/websites/admin/create - Create a new website (admin function)
 */
export const createWebsite = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Input validation
        const { url, interval } = req.body;
        if (!url || typeof url !== 'string') { res.status(400).json({ message: 'Missing or invalid URL in request body.' }); return; }
        if (interval !== undefined && (typeof interval !== 'number' || interval <= 0)) { res.status(400).json({ message: 'Invalid interval format. Must be a positive number.' }); return; }

        const createData = { url, interval };
        const website: Website = await websiteService.createWebsite(createData);
        res.status(201).json(website);
    } catch (error) {
        // Pass errors like 'Invalid URL', 'already exists', or others to middleware
        next(error);
    }
};

/**
 * PUT /api/websites/admin/:id - Update a website's core properties (admin function)
 */
export const updateWebsite = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Input validation
        const websiteId = parseIdParam(req.params.id);
        if (websiteId === null) { res.status(400).json({ message: 'Invalid Website ID format.' }); return; }
        if (typeof req.body !== 'object' || req.body === null) { res.status(400).json({ message: 'Invalid request body.' }); return; }
        const updateData = req.body; // Service layer validates URL format

        const website: Website | null = await websiteService.updateWebsiteCore(websiteId, updateData);
        // Handle service returning null (not found)
        if (!website) { res.status(404).json({ message: 'Website not found' }); return; }
        res.json(website);
    } catch (error) {
        // Pass errors like 'Invalid URL', 'already exists', or others to middleware
        next(error);
    }
};

/**
 * PUT /api/websites/user/dashboard/:id - Update a user's website configuration
 */
export const updateUserWebsite = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;

        // Input validation
        const websiteId = parseIdParam(req.params.id);
        if (websiteId === null) { res.status(400).json({ message: 'Invalid Website ID format.' }); return; }
        if (typeof req.body !== 'object' || req.body === null) { res.status(400).json({ message: 'Invalid request body. Expected an object.' }); return; }
        const updateDto = req.body as UpdateWebsiteUserDTO;

        const userWebsite: WebsiteUser | null = await websiteService.updateUserWebsite( userId, websiteId, updateDto );
        // Handle service returning null (not found)
        if (!userWebsite) { res.status(404).json({ message: 'Website not found in your dashboard for update' }); return; }
        res.json(userWebsite);
    } catch (error) {
        // Pass all errors to middleware
        next(error);
    }
};

/**
 * PATCH /api/websites/user/dashboard/:id/pin - Set the pin status for a user's website
 */
export const setPinStatus = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;

        // Input validation
        const websiteId = parseIdParam(req.params.id);
        if (websiteId === null) { res.status(400).json({ message: 'Invalid Website ID format.' }); return; }
        const { isPinned } = req.body as SetPinStatusDTO;
        if (typeof isPinned !== 'boolean') { res.status(400).json({ message: 'Invalid request body. "isPinned" must be a boolean.' }); return; }

        const userWebsite: WebsiteUser | null = await websiteService.setPinStatusForUser( userId, websiteId, isPinned );
        // Handle service returning null (not found)
        if (!userWebsite) { res.status(404).json({ message: 'Website not found in your dashboard to update pin status.' }); return; }
        res.json(userWebsite);
    } catch (error) {
        // Pass all errors to middleware
        next(error);
    }
};

/**
 * DELETE /api/websites/admin/:id - Delete a website (admin function)
 */
export const deleteWebsite = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Input validation
        const websiteId = parseIdParam(req.params.id);
        if (websiteId === null) { res.status(400).json({ message: 'Invalid Website ID format.' }); return; }

        const deletedWebsite = await websiteService.deleteWebsite(websiteId);
        // Handle service returning null (not found)
        if (!deletedWebsite) { res.status(404).json({ message: 'Website not found for deletion' }); return; }
        res.status(204).send(); // Success, no content
    } catch (error) {
        // Pass all errors to middleware
        next(error);
    }
};

/**
 * PATCH /api/websites/admin/:id/toggle - Toggle a website's active status (admin function)
 */
export const toggleWebsiteStatus = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Input validation
        const websiteId = parseIdParam(req.params.id);
        if (websiteId === null) { res.status(400).json({ message: 'Invalid Website ID format.' }); return; }

        const website: Website | null = await websiteService.toggleWebsiteStatus(websiteId);
        // Handle service returning null (not found)
        if (!website) { res.status(404).json({ message: 'Website not found for toggle' }); return; }
        res.json(website);
    } catch (error) {
        // Pass all errors to middleware
        next(error);
    }
};

/**
 * POST /api/websites/user/dashboard - Add a website to user's dashboard
 */
export const addWebsiteToUser = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;

        // Input validation
        if (typeof req.body !== 'object' || req.body === null) { res.status(400).json({ message: 'Invalid request body. Expected an object.' }); return; }
        const websiteData = req.body as AddWebsiteUserDTO;
        if (!websiteData.url) { res.status(400).json({ message: 'Missing "url" in request body.' }); return; }

        const websiteUser: WebsiteUser = await websiteService.addWebsiteToUser(userId, websiteData);
        res.status(201).json(websiteUser);
    } catch (error) {
        // Pass errors like 'Invalid URL' or others to middleware
        next(error);
    }
};

/**
 * DELETE /api/websites/user/dashboard/:id - Remove a website from user's dashboard
 */
export const removeWebsiteFromUser = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Pre-check authentication
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;

        // Input validation
        const websiteId = parseIdParam(req.params.id);
        if (websiteId === null) { res.status(400).json({ message: 'Invalid Website ID format.' }); return; }

        await websiteService.removeWebsiteFromUser(userId, websiteId);
        // Service handles P2025 internally, so we assume success if no error is thrown
        res.status(204).send(); // Success, no content
    } catch (error) {
        // Pass all errors to middleware
        next(error);
    }
};

/**
 * GET /api/websites/search - Search websites by URL
 */
export const searchWebsites = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
        // Input validation
        const { query } = req.query;
        if (typeof query !== 'string' || query.trim().length < 2) { res.status(400).json({ message: 'Search query must be at least 2 characters long.' }); return; }

        const websites: Website[] = await websiteService.searchWebsites(query);
        res.json(websites);
    } catch (error) {
        // Pass all errors to middleware
        next(error);
    }
};