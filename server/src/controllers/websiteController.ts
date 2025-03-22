// server/src/controllers/websiteController.ts
import { Request, Response, NextFunction } from 'express';
import * as websiteService from '../services/websiteService';
import { WebsiteUserDTO } from '../types';

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
    const websiteUsers = await websiteService.getWebsitesForUser(userId);
    res.json(websiteUsers);
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
 * Get user's website configuration by ID
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
    
    const userWebsite = await websiteService.getUserWebsiteById(userId, websiteId);
    
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
 * Create a new website (admin function)
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
 * Update a website's core properties (admin function)
 */
export const updateWebsite = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const website = await websiteService.updateWebsiteCore(parseInt(id, 10), req.body);
    res.json(website);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a user's website configuration
 */
export const updateUserWebsite = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const websiteId = parseInt(id, 10);
    
    // Validate if user has access to this website
    const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
    
    if (!hasAccess) {
      res.status(404).json({ message: 'Website not found in your dashboard' });
      return;
    }
    
    // Cast to Partial<WebsiteUserDTO> to make types compatible
    const userWebsite = await websiteService.updateUserWebsite(
      userId, 
      websiteId, 
      req.body as Partial<WebsiteUserDTO>
    );
    
    res.json(userWebsite);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a website (admin function)
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
 * Toggle a website's active status (admin function)
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
    const websiteData = req.body as WebsiteUserDTO;
    
    const websiteUser = await websiteService.addWebsiteToUser(userId, websiteData);
    res.status(201).json(websiteUser);
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

/**
 * Get alerts for the authenticated user
 */
export const getUserAlerts = async (
  req: Request<{}, {}, {}, { limit?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    
    const alerts = await websiteService.getAlertsForUser(userId, limit);
    res.json(alerts);
  } catch (error) {
    next(error);
  }
};

export const searchWebsites = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { query } = req.query;
    const websites = await websiteService.searchWebsites(query as string);
    res.json(websites);
  } catch (error) {
    next(error);
  }
};