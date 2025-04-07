// server/src/controllers/monitoringController.ts
import { PrismaClient, Prisma, Website as PrismaWebsite } from '@prisma/client'; // Import PrismaWebsite
import { Request, Response, NextFunction } from 'express';

// --- Import Services ---
import { ResultsManager, WebsiteMonitor, StatsCalculator } from '../services/monitoringService';
import * as websiteService from '../services/websiteService'; // Still needed for access check

// --- Import SHARED Types ---
import {
    WebsiteDetailsData,
    TimeframeKey,
    MonitoringResult, // Use this for mapping API responses
    ChartDataPoint,
    WebsiteStatsData,
    OverallStats
} from '../types'; // Adjust path if necessary

// --- Import Backend-Specific Helpers/Clients ---
import prisma from '../prisma/prismaClient'; // Import prisma client directly
import { subHours, subDays, subYears, subMonths } from 'date-fns';

// Helper function to get start date based on timeframe (no change needed)
const getStartDateForTimeframe = (timeframe: TimeframeKey): Date => {
    const now = new Date();
    switch (timeframe) {
        case 'hour': return subHours(now, 1);
        case 'day': default: return subDays(now, 1);
        case 'week': return subDays(now, 7);
        case 'month': return subMonths(now, 30); // Use subMonths
        case 'year': return subYears(now, 1);
    }
};

// Helper for safe ID parsing
const parseIdParam = (idParam: string | undefined): number | null => {
    if (!idParam) return null;
    const id = parseInt(idParam, 10);
    return !isNaN(id) && id > 0 ? id : null;
};


/**
 * Maps a Prisma MonitoringResult's core fields to the shared MonitoringResult type.
 * Converts Date to ISO string. Does NOT handle nested relations itself.
 */
const mapPrismaResultToSharedCore = (
    prismaResult: Prisma.MonitoringResultGetPayload<{}>
): Omit<MonitoringResult, 'website'> => { // Return type excludes optional 'website'
    return {
        id: prismaResult.id,
        websiteId: prismaResult.websiteId,
        checkedAt: prismaResult.checkedAt.toISOString(), // Convert Date to ISO string
        responseTime: prismaResult.responseTime,
        isAvailable: prismaResult.isAvailable,
        statusCode: prismaResult.statusCode,
        errorMessage: prismaResult.errorMessage,
    };
};


// --- Controller Functions ---

/**
 * GET /api/monitoring/admin/results - Get all monitoring results with optional filtering (Admin)
 */
export const getAllResults = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const { limit = '100', from, to } = req.query;
    const parsedLimit = parseInt(limit as string, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
        res.status(400).json({ message: 'Invalid limit format.' }); return;
    }
    // Service includes website { url }
    const results = await ResultsManager.getAllResults({
      limit: parsedLimit,
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined
    });

    // Map core fields, then add website info from the included relation
    // Use 'any' here to bypass TypeScript's potential inability to infer the included relation perfectly
    const responseData: MonitoringResult[] = results.map((r: any) => {
        const coreData = mapPrismaResultToSharedCore(r);
        return {
            ...coreData,
            // Safely access r.website assuming service included it
            website: r.website ? {
                url: r.website.url,
            } : undefined
        };
    });
    res.json(responseData);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/monitoring/user/results - Get monitoring results for the current user
 */
export const getUserResults = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
     const userId = req.user!.id; // Ensure req.user is attached by middleware
     const { limit = '100', from, to } = req.query;
     const parsedLimit = parseInt(limit as string, 10);
     if (isNaN(parsedLimit) || parsedLimit <= 0) {
         res.status(400).json({ message: 'Invalid limit format.' }); return;
     }
     // Service includes website { url, websiteUsers { name } }
     const results = await ResultsManager.getResultsForUser(userId, {
        limit: parsedLimit,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined
      });

     // Map core fields, then add website info including the user's custom name
     // Use 'any' here to bypass TypeScript's potential inability to infer the included relations perfectly
     const responseData: MonitoringResult[] = results.map((r: any) => {
        const coreData = mapPrismaResultToSharedCore(r);
        return {
            ...coreData,
            // Safely access r.website and nested relations assuming service included them
            website: r.website ? {
                url: r.website.url,
                name: r.website.websiteUsers?.[0]?.name ?? undefined // Get name from relation
            } : undefined
        };
     });
     res.json(responseData);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/monitoring/website/:websiteId/results - Get monitoring results for a specific website (requires user access)
 */
export const getResultsByWebsite = async ( req: Request<{ websiteId: string }>, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const { websiteId: websiteIdParam } = req.params;
    const userId = req.user!.id; // Used for access check
    const websiteId = parseIdParam(websiteIdParam); // Use helper

    if (websiteId === null) {
        res.status(400).json({ message: 'Invalid Website ID format.' }); return;
    }
    // Access check
    const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
    if (!hasAccess /* && !isAdmin(req.user) */) {
        res.status(404).json({ message: 'Website not found or access denied.' }); return;
    }

    const { limit = '100', from, to } = req.query;
    const parsedLimit = parseInt(limit as string, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
        res.status(400).json({ message: 'Invalid limit format.' }); return;
    }
    // Service does NOT include relations here
    const results = await ResultsManager.getFilteredResultsByWebsite(websiteId, {
        limit: parsedLimit,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined
      });

    // Map only core fields, website relation will be undefined
    const responseData: MonitoringResult[] = results.map(mapPrismaResultToSharedCore);

    res.json(nonNullResponseData);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/monitoring/check/:websiteId - Trigger an immediate check for a website (requires user access)
 */
export const triggerWebsiteCheck = async (
    req: Request<{ websiteId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { websiteId: websiteIdParam } = req.params;
        const userId = req.user!.id;
        const websiteId = parseIdParam(websiteIdParam); // Use helper

        if (websiteId === null) {
           res.status(400).json({ message: 'Invalid Website ID format.' }); return;
        }

        // 1. Access check (still use websiteService for this)
        const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
        if (!hasAccess /* && !isAdmin(req.user) */) {
           res.status(404).json({ message: 'Website not found or access denied.' }); return;
        }

        // 2. Fetch the RAW PrismaWebsite object needed by WebsiteMonitor.checkWebsite
        const websitePrisma: PrismaWebsite | null = await prisma.website.findUnique({
            where: { id: websiteId }
        });

        if (!websitePrisma) {
           res.status(404).json({ message: 'Website data not found.' }); return;
        }

        // 3. Call checkWebsite with the Prisma object - NO await
        WebsiteMonitor.checkWebsite(websitePrisma); // Pass the Prisma type

        // Return 202 Accepted
        res.status(202).json({ message: 'Check triggered successfully. Results will update shortly.' });
     } catch (error) {
       next(error);
     }
};

/**
 * GET /api/monitoring/admin/stats - Get monitoring statistics for all websites (Admin)
 */
export const getOverallStats = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
      const { period = 'week' } = req.query;
      // Service already returns the shared OverallStats type with dates as strings
      const stats: OverallStats = await StatsCalculator.getOverallStats(undefined, period as string );
      res.json(stats);
    } catch (error) {
      next(error);
    }
};

/**
 * GET /api/monitoring/user/stats - Get monitoring statistics for current user's websites
 */
export const getUserStats = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { period = 'week' } = req.query;
      // Service already returns the shared OverallStats type with dates as strings
      const stats: OverallStats = await StatsCalculator.getUserDashboardStats(userId, period as string );
      res.json(stats);
    } catch (error) {
      next(error);
    }
};

/**
 * GET /api/monitoring/website/:websiteId/stats - Get monitoring statistics for a specific website (requires user access)
 */
export const getWebsiteStats = async ( req: Request<{ websiteId: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
      const { websiteId: websiteIdParam } = req.params;
      const userId = req.user!.id;
      const websiteId = parseIdParam(websiteIdParam); // Use helper
      if (websiteId === null) {
          res.status(400).json({ message: 'Invalid Website ID format.' }); return;
      }

      // Access check
      const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
       if (!hasAccess /* && !isAdmin(req.user) */) {
          res.status(404).json({ message: 'Website not found or access denied.' }); return;
      }

      const { period = 'week' } = req.query;
      // Service already returns the shared WebsiteStatsData type with dates as strings
      const stats: WebsiteStatsData = await StatsCalculator.getWebsiteStats(websiteId, userId, period as string );
      res.json(stats);
    } catch (error) {
      next(error);
    }
};


/**
 * GET /api/monitoring/website/:websiteId - Get comprehensive details for a specific website view (requires user access)
 */
export const getWebsiteDetails = async (
    req: Request<{ websiteId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { websiteId: websiteIdParam } = req.params;
        const userId = req.user!.id;
        const websiteId = parseIdParam(websiteIdParam); // Use helper

        if (websiteId === null) {
            res.status(400).json({ message: 'Invalid Website ID format.' }); return;
        }

        // Validate timeframe and limit
        const timeframe = (req.query.timeframe as TimeframeKey) || 'day';
        const limit = parseInt(req.query.limit as string, 10) || 25;
        if (isNaN(limit) || limit <= 0) {
             res.status(400).json({ message: 'Invalid limit format.' }); return;
        }

        // Validate sortBy and sortDir
        const validSortByFields: Prisma.MonitoringResultScalarFieldEnum[] = [
            'checkedAt', 'isAvailable', 'responseTime', 'statusCode', 'id'
        ];
        const sortByInput = req.query.sortBy as string | undefined;
        const sortBy: Prisma.MonitoringResultScalarFieldEnum = (sortByInput && validSortByFields.includes(sortByInput as any))
            ? sortByInput as Prisma.MonitoringResultScalarFieldEnum
            : 'checkedAt';
        const sortDirInput = req.query.sortDir as string | undefined;
        const sortDir: Prisma.SortOrder = (sortDirInput === 'asc') ? 'asc' : 'desc';


        // Access check - Fetch userWebsite (includes nested Website)
        const userWebsite = await websiteService.getUserWebsiteById(userId, websiteId); // Fetches MAPPED WebsiteUser
        if (!userWebsite || !userWebsite.website) { // Check if userWebsite or nested website is missing
            res.status(404).json({ message: 'Website not found or access denied.' }); return;
        }

        const startDate = getStartDateForTimeframe(timeframe);
        const endDate = new Date();

        // Construct order by clause
        let orderByClause: Prisma.MonitoringResultOrderByWithRelationInput[] = [];
        if (sortBy === 'statusCode' || sortBy === 'responseTime') {
             orderByClause.push({ [sortBy]: { sort: sortDir, nulls: 'last' } });
        } else {
             orderByClause.push({ [sortBy]: sortDir });
        }
        if (sortBy !== 'checkedAt') {
            orderByClause.push({ checkedAt: 'desc' });
        }

        // Fetch data concurrently
        const [
            latestResultData, // PrismaMonitoringResult | null
            chartDataResult,  // ChartDataPoint[] (shared type from service)
            recentChecksData, // PrismaMonitoringResult[]
            uptimePercentData // number
        ] = await Promise.all([
            prisma.monitoringResult.findFirst({ where: { websiteId }, orderBy: { checkedAt: 'desc' }}),
            StatsCalculator.getChartDataForWebsite(websiteId, timeframe),
            prisma.monitoringResult.findMany({
                where: { websiteId: websiteId },
                orderBy: orderByClause,
                take: limit
            }),
            StatsCalculator.calculateUptimeBetweenDates(websiteId, startDate, endDate),
        ]);

        // Build the response using the simplified mapper and data from userWebsite
        const responseData: WebsiteDetailsData = {
            websiteId: userWebsite.websiteId,
            name: userWebsite.name || userWebsite.website.url, // Name from mapped userWebsite
            url: userWebsite.website.url,                      // URL from mapped userWebsite
            latestResult: latestResultData ? mapPrismaResultToSharedCore(latestResultData) : null,
            chartData: chartDataResult,
            recentChecks: recentChecksData.map(mapPrismaResultToSharedCore),
            uptimePercent: uptimePercentData,
        };

        res.json(responseData);

    } catch (error) {
        console.error(`Error fetching website details for ID ${req.params.websiteId}:`, error);
        next(error); // Pass to error handling middleware
    }
};