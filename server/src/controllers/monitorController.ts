//server\src\controllers\monitorController.ts
import { Request, Response, NextFunction } from 'express';
import { ResultsManager, WebsiteMonitor, StatsCalculator } from '../services/monitoringService';
import * as websiteService from '../services/websiteService';

/**
 * Get all monitoring results with optional filtering
 */
export const getAllResults = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { limit = '100', from, to } = req.query;
    
    const results = await ResultsManager.getAllResults({
      limit: parseInt(limit as string, 10),
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined
    });
    
    res.json(results);
  } catch (error) {
    next(error);
  }
};

/**
 * Get monitoring results for the current user
 */
export const getUserResults = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { limit = '100', from, to } = req.query;
    
    const results = await ResultsManager.getResultsForUser(
      userId,
      {
        limit: parseInt(limit as string, 10),
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined
      }
    );
    
    res.json(results);
  } catch (error) {
    next(error);
  }
};

/**
 * Get monitoring results for a specific website
 */
export const getResultsByWebsite = async (
  req: Request<{ websiteId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { websiteId } = req.params;
    const { limit = '100', from, to } = req.query;
    
    // Check if the user has access to this website
    const userId = req.user?.id;
    if (userId) {
      const hasAccess = await websiteService.hasUserWebsite(userId, parseInt(websiteId, 10));
      if (!hasAccess) {
        res.status(404).json({ message: 'Website not found' });
        return;
      }
    }
    
    const results = await ResultsManager.getFilteredResultsByWebsite(
      parseInt(websiteId, 10),
      {
        limit: parseInt(limit as string, 10),
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined
      }
    );
    
    res.json(results);
  } catch (error) {
    next(error);
  }
};

/**
 * Trigger an immediate check for a website
 */
export const triggerWebsiteCheck = async (
  req: Request<{ websiteId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { websiteId } = req.params;
    const userId = req.user?.id;
    
    // Check if the user has access to this website
    if (userId) {
      const hasAccess = await websiteService.hasUserWebsite(userId, parseInt(websiteId, 10));
      if (!hasAccess) {
        res.status(404).json({ message: 'Website not found' });
        return;
      }
    }
    
    const website = await websiteService.getWebsiteById(parseInt(websiteId, 10));
    
    if (!website) {
      res.status(404).json({ message: 'Website not found' });
      return;
    }
    
    await WebsiteMonitor.checkWebsite(website);
    res.json({ message: 'Check triggered successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get monitoring statistics for all websites (admin)
 */
export const getOverallStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { period = '7d' } = req.query;
    
    const stats = await StatsCalculator.getOverallStats(
      undefined,
      period as string
    );
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

/**
 * Get monitoring statistics for current user's websites
 */
export const getUserStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { period = '7d' } = req.query;
    
    const stats = await StatsCalculator.getUserDashboardStats(
      userId,
      period as string
    );
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

/**
 * Get monitoring statistics for a specific website
 */
export const getWebsiteStats = async (
  req: Request<{ websiteId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { websiteId } = req.params;
    const userId = req.user?.id;
    const { period = '7d' } = req.query;
    
    // Check if the user has access to this website
    if (userId) {
      const hasAccess = await websiteService.hasUserWebsite(userId, parseInt(websiteId, 10));
      if (!hasAccess) {
        res.status(404).json({ message: 'Website not found' });
        return;
      }
    }
    
    const stats = await StatsCalculator.getWebsiteStats(
      parseInt(websiteId, 10),
      userId,
      period as string
    );
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
};