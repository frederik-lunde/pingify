import { Request, Response, NextFunction } from 'express';
import * as AlertService from '../services/alertService';

/**
 * Get recent alerts
 */
export const getRecentAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { limit = '50', type, from, to } = req.query;
    
    const alerts = await AlertService.getRecentAlerts({
      limit: parseInt(limit as string, 10),
      type: type as string,
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined
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
    const { limit = '50', type, from, to } = req.query;
    
    const alerts = await AlertService.getAlertsByWebsite(
      parseInt(websiteId, 10),
      {
        limit: parseInt(limit as string, 10),
        type: type as string,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined
      }
    );
    
    res.json(alerts);
  } catch (error) {
    next(error);
  }
};

/**
 * Get alert statistics
 */
export const getAlertStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { days = '7' } = req.query;
    
    const stats = await AlertService.getAlertStats(parseInt(days as string, 10));
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
};