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
 * Handles the request to get all websites for the authenticated user.
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
 * Handles the request to get a specific website by ID for the authenticated user.
 */
export const getUserWebsiteById = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;


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
 * Handles the request to update a specific website's settings for the authenticated user.
 */
export const updateUserWebsite = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;


        const websiteId = req.params.id as unknown as number;
        const updateDto = req.body as UpdateWebsiteUserDTO;

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
 * Handles the request to set the pin status of a website for the authenticated user.
 */
export const setPinStatus = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;


        const websiteId = req.params.id as unknown as number;
        const { isPinned } = req.body as SetPinStatusDTO;

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
 * Handles the request to add a new website to the authenticated user's dashboard.
 */
export const addWebsiteToUser = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;


        const websiteData = req.body as AddWebsiteUserDTO;

        const websiteUser: WebsiteUser = await websiteService.addWebsiteToUser(userId, websiteData);
        res.status(201).json(websiteUser);
    } catch (error) {

        if (error instanceof Error && (error.message.includes('Invalid URL') || error.message.includes('Failed to add website'))) {
             res.status(400).json({ message: error.message });
        } else {
            next(error);
        }
    }
};

/**
 * Handles the request to remove a website from the authenticated user's dashboard.
 */
export const removeWebsiteFromUser = async ( req: Request<{ id: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;


        const websiteId = req.params.id as unknown as number;


        await websiteService.removeWebsiteFromUser(userId, websiteId);
        res.status(204).send();
    } catch (error) {

        if (error instanceof Error && error.message.includes('Failed to remove website')) {
             res.status(500).json({ message: error.message });
        } else {
            next(error);
        }
    }
};

/**
 * Handles the request to search for websites based on a query string.
 */
export const searchWebsites = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {

        const query = req.query.query as string;

        const websites: Website[] = await websiteService.searchWebsites(query);
        res.json(websites);
    } catch (error) {
        next(error);
    }
};