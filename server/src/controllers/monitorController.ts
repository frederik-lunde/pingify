// server/src/controllers/monitoringController.ts
import { PrismaClient, Prisma, MonitoringResult as PrismaMonitoringResult } from '@prisma/client'; // Keep Prisma imports for backend use
import { Request, Response, NextFunction } from 'express';

// Assuming ChartDataPoint is exported from monitoringService or imported there
import { ResultsManager, WebsiteMonitor, StatsCalculator } from '../services/monitoringService';
import * as websiteService from '../services/websiteService';

// --- Import SHARED Types ---
// UPDATED import path (replace '@shared/types' with your actual alias/relative path)
import {
    WebsiteDetailsData,
    TimeframeKey,
    MonitoringResult as SharedMonitoringResult, // Alias shared type
    WebsiteStatsData, // Import if needed for other functions
    OverallStats      // Import if needed for other functions
} from '../types'; // Adjust path as needed
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

// Helper function to map Prisma result to Shared result type
const mapPrismaResultToShared = (prismaResult: PrismaMonitoringResult | null): SharedMonitoringResult | null => {
    // Handle null case explicitly
    if (!prismaResult) {
        return null;
    }
    return {
        id: prismaResult.id,
        websiteId: prismaResult.websiteId,
        checkedAt: prismaResult.checkedAt.toISOString(), // Convert Date to ISO string
        responseTime: prismaResult.responseTime,
        isAvailable: prismaResult.isAvailable,
        statusCode: prismaResult.statusCode,
        errorMessage: prismaResult.errorMessage,
        // Explicitly exclude relations like 'website' unless the shared type includes them
    };
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
    // Use the helper function for mapping
    const responseData: (SharedMonitoringResult | null)[] = results.map(mapPrismaResultToShared);

    // Filter out potential nulls if mapPrismaResultToShared could return null
    // and the endpoint guarantees an array of MonitoringResult
    const nonNullResponseData = responseData.filter(r => r !== null) as SharedMonitoringResult[];

    res.json(nonNullResponseData);
  } catch (error) {
    next(error);
  }
};

/**
 * Trigger an immediate check for a website (requires user access).
 * Waits for the check to complete and returns the new result.
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

     // Verify user access
     const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
     if (!hasAccess) {
        res.status(404).json({ message: 'Website not found or access denied.' });
        return;
     }

     // Get website core data needed for the check
     const website = await websiteService.getWebsiteById(websiteId); // Returns WebsitePrisma
     if (!website) {
        // This case might be redundant if hasUserWebsite already checks existence, but good for safety
        res.status(404).json({ message: 'Website core data not found.' });
        return;
     }

     console.log(`[triggerWebsiteCheck] Starting check for website ID: ${websiteId}`);

     // --- MODIFICATION START ---
     // Await the actual check execution from the service.
     // Assumes WebsiteMonitor.checkWebsite is async and returns the created PrismaMonitoringResult.
     const newPrismaResult: PrismaMonitoringResult = await WebsiteMonitor.checkWebsite(website);
     console.log(`[triggerWebsiteCheck] Check completed for website ID: ${websiteId}. Result ID: ${newPrismaResult?.id}`);

     // Map the Prisma result object to the shared DTO/type for the response
     // Use the helper function which handles potential nulls
     const newSharedResult: SharedMonitoringResult | null = mapPrismaResultToShared(newPrismaResult);

     // Check if mapping was successful (it should be if checkWebsite returns a valid result)
     if (!newSharedResult) {
         // This indicates an unexpected issue either in checkWebsite or the mapping
         console.error(`[triggerWebsiteCheck] Failed to map Prisma result for website ID: ${websiteId}`);
         // Send a server error response
         res.status(500).json({ message: 'Failed to process check result after execution.' });
         return;
     }

     // Respond with the newly created check result object
     res.status(200).json(newSharedResult);
     // --- MODIFICATION END ---

  } catch (error) {
     // Log the error for debugging on the server
     console.error(`[triggerWebsiteCheck] Error checking website ID ${req.params.websiteId}:`, error);
     // Pass error to the global error handler
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
            // Map latestResultData (Prisma type) to shared MonitoringResult type using helper
            latestResult: mapPrismaResultToShared(latestResultData),
            chartData: chartDataResult, // Already ChartDataPoint[] from service
            // Map recentChecksData (Prisma type[]) to shared MonitoringResult type[] using helper
            recentChecks: recentChecksData.map(mapPrismaResultToShared).filter(r => r !== null) as SharedMonitoringResult[], // Map and filter nulls
            uptimePercent: uptimePercentData,
        };

        res.json(responseData);

    } catch (error) {
        console.error(`Error fetching website details for ID ${req.params.websiteId}:`, error);
        next(error);
    }
};