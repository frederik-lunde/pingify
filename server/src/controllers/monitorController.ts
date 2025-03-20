import { Request, Response, NextFunction } from 'express';
import * as monitoringService from '../services/monitoring-service';
import * as websiteService from '../services/website-service';
import * as alertService from '../services/alert-service';

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
    
    const results = await monitoringService.getAllResults({
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
    
    const results = await monitoringService.getResultsByWebsite(
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
    
    await monitoringService.checkWebsite(website);
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
      ? await monitoringService.getWebsiteStats(parseInt(websiteId as string, 10), period as string)
      : await monitoringService.getOverallStats(period as string);
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

/**
 * Get recent alerts
 */
export const getRecentAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { limit = '50', type } = req.query;
    
    const alerts = await alertService.getRecentAlerts({
      limit: parseInt(limit as string, 10),
      type: type as string
    });
    
    res.json(alerts);
  } catch (error) {
    next(error);
  }
};

/**
 * Get alerts for a specific website
 */
export const getAlertsByWebsite = async (
  req: Request<{ websiteId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { websiteId } = req.params;
    const { limit = '50', type } = req.query;
    
    const alerts = await alertService.getAlertsByWebsite(
      parseInt(websiteId, 10),
      {
        limit: parseInt(limit as string, 10),
        type: type as string
      }
    );
    
    res.json(alerts);
  } catch (error) {
    next(error);
  }
};