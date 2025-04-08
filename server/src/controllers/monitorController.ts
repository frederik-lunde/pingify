// server/src/controllers/monitoringController.ts
import { PrismaClient, Prisma, Website as PrismaWebsite, MonitoringResult as PrismaMonitoringResult } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';

// --- Import Services ---
import { ResultsManager, WebsiteMonitor, StatsCalculator } from '../services/monitoringService';
import * as websiteService from '../services/websiteService';

// --- Import SHARED Types ---
import {
    WebsiteDetailsData,
    TimeframeKey,
    MonitoringResult as SharedMonitoringResult,
    ChartDataPoint,
    WebsiteStatsData,
    OverallStats,
    DowntimeInfo,
    IncidentCountResponse // <-- Import type
} from '../types';

// --- Import Backend-Specific Helpers/Clients ---
import prisma from '../prisma/prismaClient';
import { subHours, subDays, subYears, subMonths } from 'date-fns';

// Helper function to get start date based on timeframe
const getStartDateForTimeframe = (timeframe: TimeframeKey): Date => {
    const now = new Date();
    switch (timeframe) {
        case 'hour': return subHours(now, 1);
        case 'day': default: return subDays(now, 1);
        case 'week': return subDays(now, 7);
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
 */
const mapPrismaResultToSharedCore = (
    prismaResult: PrismaMonitoringResult | null
): SharedMonitoringResult | null => {
    if (!prismaResult) return null;
    const coreData: Omit<SharedMonitoringResult, 'website'> = {
        id: prismaResult.id,
        websiteId: prismaResult.websiteId,
        checkedAt: prismaResult.checkedAt.toISOString(),
        responseTime: prismaResult.responseTime,
        isAvailable: prismaResult.isAvailable,
        statusCode: prismaResult.statusCode,
        errorMessage: prismaResult.errorMessage,
    };
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
    const results = await ResultsManager.getAllResults({
      limit: parsedLimit,
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined
    });

    const responseData: SharedMonitoringResult[] = results.map((r: any) => {
        const coreData = mapPrismaResultToSharedCore(r);
        if (!coreData) return null;
        return {
            ...coreData,
            website: r.website ? { url: r.website.url } : undefined
        };
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
     const userId = req.user!.id;
     const { limit = '100', from, to } = req.query;
     const parsedLimit = parseInt(limit as string, 10);
     if (isNaN(parsedLimit) || parsedLimit <= 0) {
         res.status(400).json({ message: 'Invalid limit format.' }); return;
     }
     const results = await ResultsManager.getResultsForUser(userId, {
        limit: parsedLimit,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined
      });

     const responseData: SharedMonitoringResult[] = results.map((r: any) => {
        const coreData = mapPrismaResultToSharedCore(r);
        if (!coreData) return null;
        return {
            ...coreData,
            website: r.website ? { url: r.website.url, name: r.website.websiteUsers?.[0]?.name ?? undefined } : undefined
        };
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
    const userId = req.user!.id;
    const websiteId = parseIdParam(websiteIdParam);

    if (websiteId === null) {
        res.status(400).json({ message: 'Invalid Website ID format.' }); return;
    }
    const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
    if (!hasAccess) {
        res.status(404).json({ message: 'Website not found or access denied.' }); return;
    }

    const { limit = '100', from, to } = req.query;
    const parsedLimit = parseInt(limit as string, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
        res.status(400).json({ message: 'Invalid limit format.' }); return;
    }
    const results = await ResultsManager.getFilteredResultsByWebsite(websiteId, {
        limit: parsedLimit,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined
      });

    const responseData: SharedMonitoringResult[] = results
        .map(mapPrismaResultToSharedCore)
        .filter(r => r !== null) as SharedMonitoringResult[];
    res.json(responseData);
  } catch (error) {
    next(error);
  }
};


/**
 * POST /api/monitoring/check/:websiteId - Trigger an immediate check for a website (requires user access).
 */
export const triggerWebsiteCheck = async (
    req: Request<{ websiteId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { websiteId: websiteIdParam } = req.params;
        const userId = req.user!.id;
        const websiteId = parseIdParam(websiteIdParam);

        if (websiteId === null) {
           res.status(400).json({ message: 'Invalid Website ID format.' }); return;
        }

        const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
        if (!hasAccess) {
           res.status(404).json({ message: 'Website not found or access denied.' }); return;
        }

        const websitePrisma: PrismaWebsite | null = await prisma.website.findUnique({ where: { id: websiteId } });
        if (!websitePrisma) {
           res.status(404).json({ message: 'Website data not found.' }); return;
        }

        console.log(`[triggerWebsiteCheck] Starting check for website ID: ${websiteId}`);
        const newPrismaResult: PrismaMonitoringResult = await WebsiteMonitor.checkWebsite(websitePrisma);
        console.log(`[triggerWebsiteCheck] Check completed for website ID: ${websiteId}. Result ID: ${newPrismaResult?.id}`);

        const newSharedResult: SharedMonitoringResult | null = mapPrismaResultToSharedCore(newPrismaResult);
         if (!newSharedResult) {
             console.error(`[triggerWebsiteCheck] Failed to map Prisma result for website ID: ${websiteId}`);
             res.status(500).json({ message: 'Failed to process check result after execution.' });
             return;
         }

        res.status(200).json(newSharedResult);

     } catch (error) {
        console.error(`[triggerWebsiteCheck] Error checking website ID ${req.params.websiteId}:`, error);
       next(error);
     }
};

/**
 * GET /api/monitoring/admin/stats - Get monitoring statistics for all websites (Admin)
 */
export const getOverallStats = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
      const { period = 'week' } = req.query;
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
      const websiteId = parseIdParam(websiteIdParam);
      if (websiteId === null) {
          res.status(400).json({ message: 'Invalid Website ID format.' }); return;
      }

      const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
       if (!hasAccess) {
          res.status(404).json({ message: 'Website not found or access denied.' }); return;
      }

      const { period = 'week' } = req.query;
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
        const websiteId = parseIdParam(websiteIdParam);

        if (websiteId === null) {
            res.status(400).json({ message: 'Invalid Website ID format.' }); return;
        }

        const timeframe = (req.query.timeframe as TimeframeKey) || 'day';
        const limit = parseInt(req.query.limit as string, 10) || 25;
        if (isNaN(limit) || limit <= 0) {
             res.status(400).json({ message: 'Invalid limit format.' }); return;
        }

        const validSortByFields = ['checkedAt', 'isAvailable', 'responseTime', 'statusCode', 'id'];
        const sortByInput = req.query.sortBy as string | undefined;
        const sortBy = (sortByInput && validSortByFields.includes(sortByInput)) ? sortByInput : 'checkedAt';
        const sortDirInput = req.query.sortDir as string | undefined;
        const sortDir: Prisma.SortOrder = (sortDirInput === 'asc') ? 'asc' : 'desc';

        const userWebsite = await websiteService.getUserWebsiteById(userId, websiteId);
        if (!userWebsite || !userWebsite.website) {
            res.status(404).json({ message: 'Website not found or access denied.' }); return;
        }

        const startDate = getStartDateForTimeframe(timeframe);
        const endDate = new Date();

        let orderByClause: Prisma.MonitoringResultOrderByWithRelationInput[] = [];
        const sortField = sortBy as keyof Prisma.MonitoringResultOrderByWithRelationInput;
        if (sortField === 'statusCode' || sortField === 'responseTime') {
             orderByClause.push({ [sortField]: { sort: sortDir, nulls: 'last' } });
        } else if (sortField === 'isAvailable' || sortField === 'checkedAt' || sortField === 'id' ) {
             orderByClause.push({ [sortField]: sortDir });
        } else {
             orderByClause.push({ checkedAt: sortDir });
        }
        if (sortBy !== 'checkedAt') {
            orderByClause.push({ checkedAt: 'desc' });
        }

        const [ latestResultData, chartDataResult, recentChecksData, uptimePercentData, downtimeInfoResult ] = await Promise.all([
            prisma.monitoringResult.findFirst({ where: { websiteId }, orderBy: { checkedAt: 'desc' }}),
            StatsCalculator.getChartDataForWebsite(websiteId, timeframe),
            prisma.monitoringResult.findMany({ where: { websiteId: websiteId }, orderBy: orderByClause, take: limit }),
            StatsCalculator.calculateUptimeBetweenDates(websiteId, startDate, endDate),
            StatsCalculator.getCurrentDowntimeInfo(websiteId)
        ]);

        const latestSharedResult = mapPrismaResultToSharedCore(latestResultData);

        const responseData: WebsiteDetailsData = {
            websiteId: userWebsite.websiteId,
            name: userWebsite.name || userWebsite.website.url,
            url: userWebsite.website.url,
            latestResult: latestSharedResult,
            chartData: chartDataResult,
            recentChecks: recentChecksData.map(mapPrismaResultToSharedCore).filter(r => r !== null) as SharedMonitoringResult[],
            uptimePercent: uptimePercentData,
            consecutiveFailures: latestSharedResult?.isAvailable === false ? downtimeInfoResult.consecutiveFailures : undefined,
            downtimeStartedAt: latestSharedResult?.isAvailable === false ? downtimeInfoResult.downtimeStartedAt?.toISOString() ?? null : null,
        };
        res.json(responseData);
    } catch (error) {
        console.error(`Error fetching website details for ID ${req.params.websiteId}:`, error);
        next(error);
    }
};

/**
 * NEW: GET /api/monitoring/user/incidents/last24h
 * Gets the count of distinct websites with incidents (down/slow based on user threshold) in the last 24h.
 */
export const getUserIncidentCountLast24h = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.id;

        // Call the new service function from StatsCalculator
        const count = await StatsCalculator.countUserDistinctWebsiteIncidentsLast24h(userId);

        const response: IncidentCountResponse = { incidentCount: count };
        res.json(response);

    } catch (error) {
        console.error(`Error fetching monitoring-based incident count for user ${req.user?.id}:`, error);
        next(error);
    }
};