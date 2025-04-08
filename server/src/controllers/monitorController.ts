// server/src/controllers/monitoringController.ts
import { PrismaClient, Prisma, Website as PrismaWebsite, MonitoringResult as PrismaMonitoringResult } from '@prisma/client'; // Import Prisma types
import { Request, Response, NextFunction } from 'express';

// --- Import Services ---
import { ResultsManager, WebsiteMonitor, StatsCalculator } from '../services/monitoringService';
// Still needed for access check and fetching userWebsite
import * as websiteService from '../services/websiteService';

// --- Import SHARED Types ---
import {
    WebsiteDetailsData,
    TimeframeKey,
    MonitoringResult as SharedMonitoringResult, // Alias shared type for clarity
    ChartDataPoint,
    WebsiteStatsData,
    OverallStats,
    DowntimeInfo // <-- Import DowntimeInfo
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
         // Corrected to use subMonths(now, 1)
        case 'month': return subMonths(now, 1);
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
 * Converts Date to ISO string. Handles null input.
 */
const mapPrismaResultToSharedCore = (
    prismaResult: PrismaMonitoringResult | null
): SharedMonitoringResult | null => { // Accept and return null
    if (!prismaResult) {
        return null;
    }
    // Return type excludes optional 'website' relation by default
    const coreData: Omit<SharedMonitoringResult, 'website'> = {
        id: prismaResult.id,
        websiteId: prismaResult.websiteId,
        // Convert Date to ISO string
        checkedAt: prismaResult.checkedAt.toISOString(),
        responseTime: prismaResult.responseTime,
        isAvailable: prismaResult.isAvailable,
        statusCode: prismaResult.statusCode,
        errorMessage: prismaResult.errorMessage,
    };
    // Return the core data, expecting the caller to add relations if needed
     // Cast needed if 'website' is optional
    return coreData as SharedMonitoringResult;
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
    const responseData: SharedMonitoringResult[] = results.map((r: any) => {
        const coreData = mapPrismaResultToSharedCore(r);
        // Need null check for coreData as well
         // Skip if mapping fails (shouldn't happen if r is valid)
        if (!coreData) return null;

        return {
            ...coreData,
            // Safely access r.website assuming service included it
            website: r.website ? {
                url: r.website.url,
                // Add other fields from shared Website type if needed/available
            } : undefined
        };
     // Filter out nulls and assert type
    }).filter(r => r !== null) as SharedMonitoringResult[];
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
      // Ensure req.user is attached by middleware
     if (!req.user?.id) {
         res.status(401).json({ message: 'Authentication required.' });
         return;
     }
     const userId = req.user.id;
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
     const responseData: SharedMonitoringResult[] = results.map((r: any) => {
        const coreData = mapPrismaResultToSharedCore(r);
        if (!coreData) return null;

        return {
            ...coreData,
            // Safely access r.website and nested relations assuming service included them
            website: r.website ? {
                url: r.website.url,
                 // Get name from relation
                name: r.website.websiteUsers?.[0]?.name ?? undefined
                 // Add other fields from shared Website type if needed/available
            } : undefined
        };
      // Filter out nulls and assert type
     }).filter(r => r !== null) as SharedMonitoringResult[];
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
     // Used for access check
     if (!req.user?.id) {
         res.status(401).json({ message: 'Authentication required.' });
         return;
     }
    const userId = req.user.id;
     // Use helper
    const websiteId = parseIdParam(websiteIdParam);

    if (websiteId === null) {
        res.status(400).json({ message: 'Invalid Website ID format.' }); return;
    }
    // Access check
    const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
     // Add admin check if needed
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
    const responseData: SharedMonitoringResult[] = results
        .map(mapPrismaResultToSharedCore)
         // Map, filter nulls, assert type
        .filter(r => r !== null) as SharedMonitoringResult[];

     // Changed variable name
    res.json(responseData);
  } catch (error) {
    next(error);
  }
};


// ============================================================
// MODIFIED SECTION START (triggerWebsiteCheck - no changes needed here)
// ============================================================

/**
 * POST /api/monitoring/check/:websiteId - Trigger an immediate check for a website (requires user access).
 * Waits for the check to complete and returns the new result.
 */
export const triggerWebsiteCheck = async (
    req: Request<{ websiteId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { websiteId: websiteIdParam } = req.params;
        if (!req.user?.id) {
             res.status(401).json({ message: 'Authentication required.' });
             return;
        }
        const userId = req.user.id;
         // Use helper
        const websiteId = parseIdParam(websiteIdParam);

        if (websiteId === null) {
           res.status(400).json({ message: 'Invalid Website ID format.' }); return;
        }

        // 1. Access check (still use websiteService for this)
        const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
         // Add admin check if needed
        if (!hasAccess /* && !isAdmin(req.user) */) {
           res.status(404).json({ message: 'Website not found or access denied.' }); return;
        }

        // 2. Fetch the RAW PrismaWebsite object needed by WebsiteMonitor.checkWebsite
        // Use prisma client directly here
        const websitePrisma: PrismaWebsite | null = await prisma.website.findUnique({
            where: { id: websiteId }
        });

        if (!websitePrisma) {
           // This case should ideally be caught by hasAccess, but good safety check
           res.status(404).json({ message: 'Website data not found.' }); return;
        }

        // Log start of trigger check
        console.log(`[triggerWebsiteCheck] Starting check for website ID: ${websiteId}`);

        // 3. Call checkWebsite with the Prisma object and AWAIT the result
        // This assumes WebsiteMonitor.checkWebsite was modified to return PrismaMonitoringResult
         // Pass the Prisma type
        const newPrismaResult: PrismaMonitoringResult = await WebsiteMonitor.checkWebsite(websitePrisma);
        // Log completion of trigger check
        console.log(`[triggerWebsiteCheck] Check completed for website ID: ${websiteId}. Result ID: ${newPrismaResult?.id}`);


        // 4. Map the Prisma result object to the shared DTO/type for the response
        const newSharedResult: SharedMonitoringResult | null = mapPrismaResultToSharedCore(newPrismaResult);

        // 5. Check if mapping was successful
         if (!newSharedResult) {
              // Log mapping failure
             console.error(`[triggerWebsiteCheck] Failed to map Prisma result for website ID: ${websiteId}`);
             res.status(500).json({ message: 'Failed to process check result after execution.' });
             return;
         }

        // 6. Respond with the newly created check result object and 200 OK
        res.status(200).json(newSharedResult);

     } catch (error) {
        // Log the error for debugging on the server
        console.error(`[triggerWebsiteCheck] Error checking website ID ${req.params.websiteId}:`, error);
       // Pass error to the global error handling middleware
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
      // Passing userId as undefined calculates stats system-wide
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
      // Ensure user is authenticated
     if (!req.user?.id) {
         res.status(401).json({ message: 'Authentication required.' });
         return;
     }
      const userId = req.user.id;
      const { period = 'week' } = req.query;
      // Service already returns the shared OverallStats type with dates as strings
      // The service function getUserDashboardStats will handle fetching the incident count for this user
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
        // Ensure user is authenticated
     if (!req.user?.id) {
         res.status(401).json({ message: 'Authentication required.' });
         return;
     }
      const userId = req.user.id;
       // Use helper
      const websiteId = parseIdParam(websiteIdParam);
      if (websiteId === null) {
          res.status(400).json({ message: 'Invalid Website ID format.' }); return;
      }

      // Access check
      const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
        // Add admin check if needed
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
 * MODIFIED to include downtime info.
 */
export const getWebsiteDetails = async (
    req: Request<{ websiteId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { websiteId: websiteIdParam } = req.params;
        // Ensure user is authenticated
        if (!req.user?.id) {
             res.status(401).json({ message: 'Authentication required.' });
             return;
        }
        const userId = req.user.id;
         // Use helper
        const websiteId = parseIdParam(websiteIdParam);

        if (websiteId === null) {
            res.status(400).json({ message: 'Invalid Website ID format.' }); return;
        }

        // Validate timeframe and limit
        const timeframe = (req.query.timeframe as TimeframeKey) || 'day';
        const limit = parseInt(req.query.limit as string, 10) || 25;
        if (isNaN(limit) || limit <= 0) {
             res.status(400).json({ message: 'Invalid limit format.' }); return;
        }

        // Validate sortBy and sortDir more robustly
         // Use string array
        const validSortByFields = ['checkedAt', 'isAvailable', 'responseTime', 'statusCode', 'id'];
        const sortByInput = req.query.sortBy as string | undefined;
        const sortBy = (sortByInput && validSortByFields.includes(sortByInput))
            ? sortByInput
            : 'checkedAt';
        const sortDirInput = req.query.sortDir as string | undefined;
        const sortDir: Prisma.SortOrder = (sortDirInput === 'asc') ? 'asc' : 'desc';


        // Access check - Fetch userWebsite (includes nested Website)
         // Fetches MAPPED WebsiteUser
        const userWebsite = await websiteService.getUserWebsiteById(userId, websiteId);
         // Check if userWebsite or nested website is missing
        if (!userWebsite || !userWebsite.website) {
            res.status(404).json({ message: 'Website not found or access denied.' }); return;
        }

        const startDate = getStartDateForTimeframe(timeframe);
        const endDate = new Date();

        // Construct order by clause safely using indexed access type
        let orderByClause: Prisma.MonitoringResultOrderByWithRelationInput[] = [];
         // Assert as key
        const sortField = sortBy as keyof Prisma.MonitoringResultOrderByWithRelationInput;

        if (sortField === 'statusCode' || sortField === 'responseTime') {
             orderByClause.push({ [sortField]: { sort: sortDir, nulls: 'last' } });
         // Handle other valid fields
        } else if (sortField === 'isAvailable' || sortField === 'checkedAt' || sortField === 'id' ) {
             orderByClause.push({ [sortField]: sortDir });
        } else {
            // Default or handle invalid sortBy field if necessary, though validation helps prevent this
             orderByClause.push({ checkedAt: sortDir });
        }
        // Add secondary sort by timestamp if primary wasn't timestamp
        if (sortBy !== 'checkedAt') {
            orderByClause.push({ checkedAt: 'desc' });
        }

        // Fetch data concurrently
        const [
            latestResultData, // PrismaMonitoringResult | null
            chartDataResult,  // ChartDataPoint[] (shared type from service)
            recentChecksData, // PrismaMonitoringResult[]
            uptimePercentData, // number
            downtimeInfoResult // DowntimeInfo { consecutiveFailures, downtimeStartedAt }
        ] = await Promise.all([
            prisma.monitoringResult.findFirst({ where: { websiteId }, orderBy: { checkedAt: 'desc' }}),
            StatsCalculator.getChartDataForWebsite(websiteId, timeframe),
            prisma.monitoringResult.findMany({
                where: { websiteId: websiteId },
                orderBy: orderByClause,
                take: limit
            }),
            StatsCalculator.calculateUptimeBetweenDates(websiteId, startDate, endDate),
            // Fetch current downtime info regardless, we'll only add it if latestResult is down
            StatsCalculator.getCurrentDowntimeInfo(websiteId)
        ]);

        // Map the latest result to shared type
        const latestSharedResult = mapPrismaResultToSharedCore(latestResultData);

        // Build the response using the simplified mapper and data from userWebsite
        const responseData: WebsiteDetailsData = {
            websiteId: userWebsite.websiteId,
             // Name from mapped userWebsite
            name: userWebsite.name || userWebsite.website.url,
             // URL from mapped userWebsite
            url: userWebsite.website.url,
            latestResult: latestSharedResult,
            chartData: chartDataResult,
             // Map, filter nulls, assert
            recentChecks: recentChecksData.map(mapPrismaResultToSharedCore).filter(r => r !== null) as SharedMonitoringResult[],
            uptimePercent: uptimePercentData,
            // Conditionally add downtime info based on the *latest* result status
            consecutiveFailures: latestSharedResult?.isAvailable === false ? downtimeInfoResult.consecutiveFailures : undefined,
            downtimeStartedAt: latestSharedResult?.isAvailable === false ? downtimeInfoResult.downtimeStartedAt?.toISOString() ?? null : null,
        };

        res.json(responseData);

    } catch (error) {
        // Log error fetching website details
        console.error(`Error fetching website details for ID ${req.params.websiteId}:`, error);
         // Pass to error handling middleware
        next(error);
    }
};
