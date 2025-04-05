// server/src/controllers/monitoringController.ts
import { PrismaClient, Prisma } from '@prisma/client'; // Keep Prisma imports for backend use
import { Request, Response, NextFunction } from 'express';

// --- Import Services ---
// Assuming ChartDataPoint is exported from monitoringService or imported there
import { ResultsManager, WebsiteMonitor, StatsCalculator } from '../services/monitoringService';
import * as websiteService from '../services/websiteService';

// --- Import SHARED Types ---
// UPDATED import path (replace '@shared/types' with your actual alias/relative path)
import {
    WebsiteDetailsData,
    TimeframeKey,
    MonitoringResult, // Import shared MonitoringResult for explicit mapping
    WebsiteStatsData, // Import if needed for other functions
    OverallStats      // Import if needed for other functions
} from '../types';
// If ChartDataPoint isn't exported/imported via monitoringService, import it here too:
// import { ChartDataPoint } from '@shared/types';

// --- Import Backend-Specific Helpers/Clients ---
import prisma from '../prisma/prismaClient';
import { subHours, subDays, subYears } from 'date-fns'; // Keep date-fns

// Helper function - can stay as is
const getStartDateForTimeframe = (timeframe: TimeframeKey): Date => {
    const now = new Date();
    switch (timeframe) {
        case 'hour': return subHours(now, 1);
        case 'day': default: return subDays(now, 1);
        case 'week': return subDays(now, 7);
        case 'month': return subDays(now, 30);
        case 'year': return subYears(now, 1);
    }
};


/**
 * Get all monitoring results with optional filtering (Admin)
 */
export const getAllResults = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const { limit = '100', from, to } = req.query;
    // Note: ResultsManager might return types including Prisma relations.
    // Map to shared types here if the frontend expects a specific structure without extra relations.
    const results = await ResultsManager.getAllResults({
      limit: parseInt(limit as string, 10),
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined
    });
    res.json(results); // Assuming frontend consuming this can handle the structure from getAllResults
  } catch (error) {
    next(error);
  }
};

/**
 * Get monitoring results for the current user
 */
export const getUserResults = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
     const userId = req.user!.id; // Ensure req.user is properly typed and attached by middleware
     const { limit = '100', from, to } = req.query;
     // Note: ResultsManager might return types including Prisma relations (WebsiteUser etc.)
     const results = await ResultsManager.getResultsForUser(userId, {
        limit: parseInt(limit as string, 10),
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined
      });
     // Map results to shared MonitoringResult[] if frontend expects only that structure
     // const responseData: MonitoringResult[] = results.map(r => ({ /* map fields */ }));
     res.json(results); // Assuming frontend consuming this can handle the structure from getResultsForUser
  } catch (error) {
    next(error);
  }
};

/**
 * Get monitoring results for a specific website (requires user access)
 */
export const getResultsByWebsite = async ( req: Request<{ websiteId: string }>, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const { websiteId: websiteIdParam } = req.params;
    const { limit = '100', from, to } = req.query;
    const userId = req.user!.id;
    const websiteId = parseInt(websiteIdParam, 10);

    if (isNaN(websiteId) || websiteId <= 0) {
        res.status(400).json({ message: 'Invalid Website ID format.' });
        return;
    }
    const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
    if (!hasAccess) {
        res.status(404).json({ message: 'Website not found or access denied.' });
        return;
    }
    // This returns PrismaMonitoringResult[]
    const results = await ResultsManager.getFilteredResultsByWebsite(websiteId, {
        limit: parseInt(limit as string, 10),
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined
      });

    // Map to shared MonitoringResult type before sending
    const responseData: MonitoringResult[] = results.map(check => ({
        id: check.id,
        websiteId: check.websiteId,
        checkedAt: check.checkedAt.toISOString(), // Date -> string
        responseTime: check.responseTime,
        isAvailable: check.isAvailable,
        statusCode: check.statusCode,
        errorMessage: check.errorMessage,
        // Explicitly exclude relations if not needed by this specific endpoint's consumer
    }));

    res.json(responseData);
  } catch (error) {
    next(error);
  }
};

/**
 * Trigger an immediate check for a website (requires user access)
 */
export const triggerWebsiteCheck = async ( req: Request<{ websiteId: string }>, res: Response, next: NextFunction ): Promise<void> => {
  try {
     const { websiteId: websiteIdParam } = req.params;
     const userId = req.user!.id;
     const websiteId = parseInt(websiteIdParam, 10);
     if (isNaN(websiteId) || websiteId <= 0) {
        res.status(400).json({ message: 'Invalid Website ID format.' });
        return;
     }
     const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
     if (!hasAccess) {
        res.status(404).json({ message: 'Website not found or access denied.' });
        return;
     }
     const website = await websiteService.getWebsiteById(websiteId); // Returns WebsitePrisma
     if (!website) {
        res.status(404).json({ message: 'Website core data not found.' });
        return;
     }
     // Pass WebsitePrisma to service
     WebsiteMonitor.checkWebsite(website);
     res.json({ message: 'Check triggered successfully. Results will update shortly.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get monitoring statistics for all websites (Admin)
 */
export const getOverallStats = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const { period = 'week' } = req.query;
    // Ensure service returns data matching shared OverallStats
    const stats: OverallStats = await StatsCalculator.getOverallStats(undefined, period as string );
    // Map date strings if necessary (e.g., lastCheck in WebsiteStatsData)
    // Example: stats.websiteStats = stats.websiteStats.map(ws => ({...ws, lastCheck: ws.lastCheck ? new Date(ws.lastCheck).toISOString() : null }));
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

/**
 * Get monitoring statistics for current user's websites
 */
export const getUserStats = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { period = 'week' } = req.query;
    // Ensure service returns data matching shared OverallStats
    const stats: OverallStats = await StatsCalculator.getUserDashboardStats(userId, period as string );
     // Map date strings if necessary
    // Example: stats.websiteStats = stats.websiteStats.map(ws => ({...ws, lastCheck: ws.lastCheck ? new Date(ws.lastCheck).toISOString() : null }));
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

/**
 * Get monitoring statistics for a specific website (requires user access)
 */
export const getWebsiteStats = async ( req: Request<{ websiteId: string }>, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const { websiteId: websiteIdParam } = req.params;
    const userId = req.user!.id;
    const { period = 'week' } = req.query;
    const websiteId = parseInt(websiteIdParam, 10);
    if (isNaN(websiteId) || websiteId <= 0) {
        res.status(400).json({ message: 'Invalid Website ID format.' });
        return;
    }
    const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
    if (!hasAccess) {
        res.status(404).json({ message: 'Website not found or access denied.' });
        return;
    }
    // Ensure service returns data matching shared WebsiteStatsData
    const stats: WebsiteStatsData = await StatsCalculator.getWebsiteStats(websiteId, userId, period as string );
     // Map date strings if necessary
    // Example: const responseData = {...stats, lastCheck: stats.lastCheck ? new Date(stats.lastCheck).toISOString() : null };
    res.json(stats); // Send potentially mapped data
  } catch (error) {
    next(error);
  }
};


/**
 * Get comprehensive details for a specific website view (requires user access)
 */
export const getWebsiteDetails = async (
    req: Request<{ websiteId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { websiteId: websiteIdParam } = req.params;
        const userId = req.user!.id;

        const websiteId = parseInt(websiteIdParam, 10);
        if (isNaN(websiteId) || websiteId <= 0) {
            res.status(400).json({ message: 'Invalid Website ID format.' });
            return;
        }

        // Use TimeframeKey from shared types
        const timeframe = (req.query.timeframe as TimeframeKey) || 'day';
        const limit = parseInt(req.query.limit as string, 10) || 25;
        const sortBy = (req.query.sortBy as 'timestamp' | 'isAvailable' | 'statusCode' | 'responseTime') || 'timestamp';
        const sortDir = (req.query.sortDir as 'asc' | 'desc') || 'desc';

        // This likely returns WebsiteUserPrisma including nested WebsitePrisma
        const userWebsite = await websiteService.getUserWebsiteById(userId, websiteId);
        if (!userWebsite || !userWebsite.website) {
            res.status(404).json({ message: 'Website not found or access denied.' });
            return;
        }

        const startDate = getStartDateForTimeframe(timeframe);
        const endDate = new Date();

        // Prisma types are backend-specific
        let orderByClause: Prisma.MonitoringResultOrderByWithRelationInput[] = [];
        let primarySort: Prisma.MonitoringResultOrderByWithRelationInput = {};
        switch (sortBy) {
            case 'isAvailable': primarySort = { isAvailable: sortDir }; break;
            case 'statusCode': primarySort = { statusCode: { sort: sortDir, nulls: 'last' } }; break;
            case 'responseTime': primarySort = { responseTime: { sort: sortDir, nulls: 'last' } }; break;
            case 'timestamp': default: primarySort = { checkedAt: sortDir }; break;
        }
        orderByClause.push(primarySort);
        if (sortBy !== 'timestamp') {
            orderByClause.push({ checkedAt: 'desc' });
        }

        const [
            latestResultData, // MonitoringResultPrisma | null
            chartDataResult,  // ChartDataPoint[] (from shared types via service)
            recentChecksData, // MonitoringResultPrisma[]
            uptimePercentData // number
        ] = await Promise.all([
            prisma.monitoringResult.findFirst({ where: { websiteId }, orderBy: { checkedAt: 'desc' }}),
            StatsCalculator.getChartDataForWebsite(websiteId, timeframe),
            prisma.monitoringResult.findMany({ where: { websiteId: websiteId }, orderBy: orderByClause, take: limit }),
            StatsCalculator.calculateUptimeBetweenDates(websiteId, startDate, endDate),
        ]);

        // Map Prisma results to Shared types before sending the response
        // Ensures Dates -> strings and structure matches WebsiteDetailsData
        const responseData: WebsiteDetailsData = {
            websiteId: userWebsite.websiteId,
            // Use data from fetched userWebsite (assume WebsiteUserPrisma compatible enough with shared WebsiteUser for these fields)
            name: userWebsite.name || userWebsite.website.url,
            url: userWebsite.website.url,
            // Map latestResultData (Prisma type) to shared MonitoringResult type
            latestResult: latestResultData ? {
                id: latestResultData.id,
                websiteId: latestResultData.websiteId,
                checkedAt: latestResultData.checkedAt.toISOString(), // Date -> string
                responseTime: latestResultData.responseTime,
                isAvailable: latestResultData.isAvailable,
                statusCode: latestResultData.statusCode,
                errorMessage: latestResultData.errorMessage,
                // Explicitly exclude relations unless needed by frontend ('website' field is optional in shared MonitoringResult)
            } : null,
            chartData: chartDataResult, // Already ChartDataPoint[] from service
            // Map recentChecksData (Prisma type[]) to shared MonitoringResult type[]
            recentChecks: recentChecksData.map(check => ({
                 id: check.id,
                 websiteId: check.websiteId,
                 checkedAt: check.checkedAt.toISOString(), // Date -> string
                 responseTime: check.responseTime,
                 isAvailable: check.isAvailable,
                 statusCode: check.statusCode,
                 errorMessage: check.errorMessage,
                 // Explicitly exclude relations ('website' field is optional in shared MonitoringResult)
            })),
            uptimePercent: uptimePercentData,
        };

        res.json(responseData);

    } catch (error) {
        console.error(`Error fetching website details for ID ${req.params.websiteId}:`, error);
        next(error);
    }
};