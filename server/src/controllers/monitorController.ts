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
 * Get monitoring statistics (uptime, avg response time, etc)
 */
export const getMonitoringStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { websiteId, period = '7d' } = req.query;
    
    const stats = websiteId 
      ? await StatsCalculator.getWebsiteStats(parseInt(websiteId as string, 10), period as string)
      : await StatsCalculator.getOverallStats(period as string);
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
};