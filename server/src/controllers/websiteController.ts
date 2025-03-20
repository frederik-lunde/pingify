// server/src/controllers/websiteController.ts
import { Request, Response, NextFunction } from 'express';
import * as websiteService from '../services/website-service';

/**
 * Get all websites (admin function)
 */
export const getAllWebsites = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const websites = await websiteService.getAllWebsites();
    res.json(websites);
  } catch (error) {
    next(error);
  }
};

/**
 * Get websites for the authenticated user
 */
export const getUserWebsites = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const websites = await websiteService.getWebsitesForUser(userId);
    res.json(websites);
  } catch (error) {
    next(error);
  }
};

/**
 * Get website by ID
 */
export const getWebsiteById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const website = await websiteService.getWebsiteById(parseInt(id, 10));
    
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
 * Get website by ID (only if in user's dashboard)
 */
export const getUserWebsiteById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const websiteId = parseInt(id, 10);
    
    // Check if user has access to this website
    const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
    
    if (!hasAccess) {
      res.status(404).json({ message: 'Website not found in your dashboard' });
      return;
    }
    
    const website = await websiteService.getWebsiteById(websiteId);
    res.json(website);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new website
 */
export const createWebsite = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const website = await websiteService.createWebsite(req.body);
    res.status(201).json(website);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a website
 */
export const updateWebsite = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const website = await websiteService.updateWebsite(parseInt(id, 10), req.body);
    res.json(website);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a website
 */
export const deleteWebsite = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    await websiteService.deleteWebsite(parseInt(id, 10));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle a website's active status
 */
export const toggleWebsiteStatus = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const website = await websiteService.toggleWebsiteStatus(parseInt(id, 10));
    res.json(website);
  } catch (error) {
    next(error);
  }
};

/**
 * Get monitoring results for a website
 */
export const getMonitoringResults = async (
  req: Request<{ id: string }, {}, {}, { limit?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    
    const results = await websiteService.getWebsiteResults(parseInt(id, 10), limit);
    res.json(results);
  } catch (error) {
    next(error);
  }
};

/**
 * Add a website to user's dashboard
 */
export const addWebsiteToUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const websiteData = req.body;
    
    const website = await websiteService.addWebsiteToUser(userId, websiteData);
    res.status(201).json(website);
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a website from user's dashboard
 */
export const removeWebsiteFromUser = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    await websiteService.removeWebsiteFromUser(userId, parseInt(id, 10));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};