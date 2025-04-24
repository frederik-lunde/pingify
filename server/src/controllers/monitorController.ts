// server/src/controllers/monitoringController.ts
import { PrismaClient, Prisma, Website as PrismaWebsite, MonitoringResult as PrismaMonitoringResult } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';

// --- Import Services ---
import { ResultsManager, WebsiteMonitor, StatsCalculator } from '../services/monitoringService';
import * as websiteService from '../services/websiteService';
import * as IncidentService from '../services/incidentService';

// --- Import SHARED Types ---
import {
    WebsiteDetailsData,
    TimeframeKey,
    MonitoringResult as SharedMonitoringResult,
    ChartDataPoint,
    WebsiteStatsData,
    OverallStats,
    Incident,
    SortDirection,
    MonitoringResultSortBy
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
        errorMessage: prismaResult.errorMessage
    };
    return coreData as SharedMonitoringResult;
};

// --- Controller Functions ---

/**
 * GET /api/monitoring/admin/results - Get all results (admin).
 * Validation handled by middleware.
 */
export const getAllResults = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const { limit, from, to } = req.query;

    const results = await ResultsManager.getAllResults({
        limit: limit as unknown as number | undefined,
        from: from as unknown as Date | undefined,
        to: to as unknown as Date | undefined
    });

    const responseData: SharedMonitoringResult[] = results.map((r: any): SharedMonitoringResult | null => {
        const coreData = mapPrismaResultToSharedCore(r);
        if (!coreData) return null;
        const mappedResult: SharedMonitoringResult = {
            ...coreData,
            website: r.website ? { url: r.website.url } : undefined
        };
        return mappedResult;
    }).filter((r): r is SharedMonitoringResult => r !== null);

    res.json(responseData);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/monitoring/user/results - Get results for the authenticated user.
 * Validation handled by middleware.
 */
export const getUserResults = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
     if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
     const userId = req.user.id;
     const { limit, from, to } = req.query;

     const results = await ResultsManager.getResultsForUser(userId, {
         limit: limit as unknown as number | undefined,
         from: from as unknown as Date | undefined,
         to: to as unknown as Date | undefined
     });

     const responseData: SharedMonitoringResult[] = results.map((r: any): SharedMonitoringResult | null => {
         const coreData = mapPrismaResultToSharedCore(r);
         if (!coreData) return null;
         const mappedResult: SharedMonitoringResult = {
             ...coreData,
             website: r.website ? {
                 url: r.website.url,
                 name: r.website.websiteUsers?.[0]?.name ?? undefined
                } : undefined
            };
         return mappedResult;
        }).filter((r): r is SharedMonitoringResult => r !== null);

     res.json(responseData);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/monitoring/website/:websiteId/results - Get results for a specific website.
 * Validation handled by middleware.
 */
export const getResultsByWebsite = async ( req: Request<{ websiteId: string }>, res: Response, next: NextFunction ): Promise<void> => {
  try {
     if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
    const userId = req.user.id;
    const websiteId = req.params.websiteId as unknown as number;
    const { limit, from, to } = req.query;

    const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
    if (!hasAccess) {
        res.status(404).json({ message: 'Website not found or access denied.' });
        return;
    }

    const results = await ResultsManager.getFilteredResultsByWebsite(websiteId, {
        limit: limit as unknown as number | undefined,
        from: from as unknown as Date | undefined,
        to: to as unknown as Date | undefined
    });

    const responseData: SharedMonitoringResult[] = results
        .map(mapPrismaResultToSharedCore)
        .filter((r): r is SharedMonitoringResult => r !== null);

    res.json(responseData);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/monitoring/check/:websiteId - Trigger a manual check for a website.
 * Validation handled by middleware.
 */
export const triggerWebsiteCheck = async ( req: Request<{ websiteId: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;
        const websiteId = req.params.websiteId as unknown as number;

        const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
        if (!hasAccess) {
            res.status(404).json({ message: 'Website not found or access denied.' });
            return;
        }

        const websitePrisma: PrismaWebsite | null = await prisma.website.findUnique({ where: { id: websiteId } });
        if (!websitePrisma) {
            res.status(404).json({ message: 'Website data not found.' });
            return;
        }

        console.log(`[triggerWebsiteCheck] User ${userId} starting check for website ID: ${websiteId}`);
        const newPrismaResult: PrismaMonitoringResult = await WebsiteMonitor.checkWebsite(websitePrisma);
        console.log(`[triggerWebsiteCheck] Check completed for website ID: ${websiteId}. Result ID: ${newPrismaResult?.id}`);

        const newSharedResult: SharedMonitoringResult | null = mapPrismaResultToSharedCore(newPrismaResult);
         if (!newSharedResult) {
            console.error(`[triggerWebsiteCheck] Failed to map Prisma result for website ID: ${websiteId}`);
            return next(new Error('Failed to process check result after execution.'));
         }
        res.status(200).json(newSharedResult);
     } catch (error) {
        next(error);
     }
};

/**
 * GET /api/monitoring/admin/stats - Get overall stats (admin).
 * Validation handled by middleware.
 */
export const getOverallStats = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
      const period = req.query.period as string;
      const stats: OverallStats = await StatsCalculator.getOverallStats(undefined, period );
      res.json(stats);
    } catch (error) {
      next(error);
    }
};

/**
 * GET /api/monitoring/user/stats - Get stats for the authenticated user's dashboard.
 * Validation handled by middleware.
 */
export const getUserStats = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
      if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
      const userId = req.user.id;
      const period = req.query.period as string;
      const stats: OverallStats = await StatsCalculator.getUserDashboardStats(userId, period );
      res.json(stats);
    } catch (error) {
      next(error);
    }
};

/**
 * GET /api/monitoring/website/:websiteId/stats - Get stats for a specific website.
 * Validation handled by middleware.
 */
export const getWebsiteStats = async ( req: Request<{ websiteId: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
      if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
      const userId = req.user.id;
      const websiteId = req.params.websiteId as unknown as number;
      const period = req.query.period as string;

      const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
       if (!hasAccess) {
           res.status(404).json({ message: 'Website not found or access denied.' });
           return;
       }

      const stats: WebsiteStatsData = await StatsCalculator.getWebsiteStats(websiteId, userId, period );
      res.json(stats);
    } catch (error) {
      next(error);
    }
};

/**
 * GET /api/monitoring/website/:websiteId - Get detailed data for a single website view.
 * Validation handled by middleware.
 * --- MODIFIED: Added safety checks for data from Promise.all ---
 */
export const getWebsiteDetails = async (
    req: Request<{ websiteId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;

        const websiteId = req.params.websiteId as unknown as number;
        const timeframe = req.query.timeframe as TimeframeKey;
        const limit = req.query.limit as unknown as number;
        const incidentLimit = req.query.incidentLimit as unknown as number;
        const sortBy = req.query.sortBy as MonitoringResultSortBy;
        const sortDir = req.query.sortDir as SortDirection;

        const userWebsite = await websiteService.getUserWebsiteById(userId, websiteId);
        if (!userWebsite || !userWebsite.website) {
            res.status(404).json({ message: 'Website not found or access denied.' });
            return;
        }

        const startDate = getStartDateForTimeframe(timeframe);
        const endDate = new Date();

        let orderByClause: Prisma.MonitoringResultOrderByWithRelationInput[] = [];
        if (sortBy === 'statusCode' || sortBy === 'responseTime') {
            orderByClause.push({ [sortBy]: { sort: sortDir, nulls: 'last' } });
        } else {
            orderByClause.push({ [sortBy]: sortDir });
        }
        if (sortBy !== 'checkedAt') {
            orderByClause.push({ checkedAt: 'desc' });
        }

        // Fetch data in parallel
        const [
            latestResultData,
            chartDataResult,
            recentChecksData,
            uptimePercentData,
            currentIncidentData,
            recentIncidentsData
        ] = await Promise.all([
            prisma.monitoringResult.findFirst({ where: { websiteId }, orderBy: { checkedAt: 'desc' }}),
            StatsCalculator.getChartDataForWebsite(websiteId, timeframe),
            prisma.monitoringResult.findMany({ where: { websiteId: websiteId }, orderBy: orderByClause, take: limit }),
            StatsCalculator.calculateUptimeBetweenDates(websiteId, startDate, endDate),
            IncidentService.getCurrentOpenIncidentForWebsite(websiteId),
            IncidentService.getIncidents({ websiteId: websiteId, limit: incidentLimit }, userId)
        ]);

        // --- Safety Checks and Mapping ---
        const latestSharedResult = mapPrismaResultToSharedCore(latestResultData);
        // Ensure arrays are arrays, provide defaults if null/undefined unexpectedly
        const safeChartData = Array.isArray(chartDataResult) ? chartDataResult : [];
        const safeRecentChecksPrisma = Array.isArray(recentChecksData) ? recentChecksData : [];
        const safeRecentIncidents = Array.isArray(recentIncidentsData) ? recentIncidentsData : [];

        const mappedRecentChecks = safeRecentChecksPrisma
            .map(mapPrismaResultToSharedCore)
            .filter((r): r is SharedMonitoringResult => r !== null);

        const responseData: WebsiteDetailsData = {
            websiteId: userWebsite.websiteId,
            name: userWebsite.name || userWebsite.website.url,
            url: userWebsite.website.url,
            latestResult: latestSharedResult, // Already handles null
            chartData: safeChartData,
            recentChecks: mappedRecentChecks,
            uptimePercent: typeof uptimePercentData === 'number' ? uptimePercentData : 100, // Default to 100 if calculation failed? Or handle error earlier.
            currentIncident: currentIncidentData ?? null, // Ensure null if undefined
            recentIncidents: safeRecentIncidents,
        };
        res.json(responseData);
    } catch (error) {
        console.error(`[getWebsiteDetails] Error fetching details for website ${req.params.websiteId}:`, error);
        next(error); // Pass to error handler middleware
    }
};