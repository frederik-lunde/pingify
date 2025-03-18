// server/src/controllers/websiteController.ts
import { Request, Response, NextFunction } from 'express';
import * as websiteService from '../services/websiteService';

export const getWebsitesForUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const websites = await websiteService.getWebsitesForUser(parseInt(userId, 10));
    res.json(websites);
  } catch (error) {
    next(error);
  }
};

export const createWebsite = async (
  req: Request<{}, {}, { name: string; url: string; interval?: number; isActive?: boolean; userId: number }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, url, interval, isActive, userId } = req.body;
    const website = await websiteService.createWebsite({ name, url, interval, isActive, userId });
    res.json(website);
  } catch (error) {
    next(error);
  }
};

// New: Get monitoring results for a given website
export const getMonitoringResultsForWebsite = async (
  req: Request<{ websiteId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { websiteId } = req.params;
    const results = await websiteService.getMonitoringResultsForWebsite(parseInt(websiteId, 10));
    res.json(results);
  } catch (error) {
    next(error);
  }
};
