import { Request, Response, NextFunction } from 'express';
import * as AlertService from '../services/alertService';
import * as WebsiteService from '../services/websiteService';

/**
 * Get recent alerts (admin function)
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
 * Get alerts for the current user
 */
export const getUserAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { limit = '50', type, from, to } = req.query;
    
    const alerts = await AlertService.getAlertsForUser(
      userId,
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
    const userId = req.user?.id;
    
    // Check if the user has access to this website
    if (userId) {
      const hasAccess = await WebsiteService.hasUserWebsite(userId, parseInt(websiteId, 10));
      if (!hasAccess) {
        res.status(404).json({ message: 'Website not found' });
        return;
      }
    }
    
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
 * Get alert statistics (admin function)
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

/**
 * Get alert statistics for the current user
 */
export const getUserAlertStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { days = '7' } = req.query;
    
    const stats = await AlertService.getUserAlertStats(userId, parseInt(days as string, 10));
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
};