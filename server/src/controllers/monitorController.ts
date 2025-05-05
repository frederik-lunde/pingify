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
    MonitoringResultSortBy,
    VALID_TIMEFRAMES // Assuming VALID_TIMEFRAMES is exported from types
} from '../types'; // Adjust path if needed

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
 */
export const getAllResults = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const { limit, from, to } = req.query;
    const results = await ResultsManager.getAllResults({
        limit: limit ? parseInt(limit as string, 10) : undefined,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined
    });

    const responseData: SharedMonitoringResult[] = results.map((r: any): SharedMonitoringResult | null => {
        const coreData = mapPrismaResultToSharedCore(r);
        if (!coreData) return null;
        return { ...coreData, website: r.website ? { url: r.website.url } : undefined };
    }).filter((r): r is SharedMonitoringResult => r !== null);
    res.json(responseData);
  } catch (error) { next(error); }
};

/**
 * GET /api/monitoring/user/results - Get results for the authenticated user.
 */
export const getUserResults = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
     if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
     const userId = req.user.id;
     const { limit, from, to } = req.query;
     const results = await ResultsManager.getResultsForUser(userId, {
         limit: limit ? parseInt(limit as string, 10) : undefined,
         from: from ? new Date(from as string) : undefined,
         to: to ? new Date(to as string) : undefined
     });

     const responseData: SharedMonitoringResult[] = results.map((r: any): SharedMonitoringResult | null => {
         const coreData = mapPrismaResultToSharedCore(r);
         if (!coreData) return null;
         return {
             ...coreData,
             website: r.website ? { url: r.website.url, name: r.website.websiteUsers?.[0]?.name ?? undefined } : undefined
            };
        }).filter((r): r is SharedMonitoringResult => r !== null);
     res.json(responseData);
  } catch (error) { next(error); }
};

/**
 * GET /api/monitoring/website/:websiteId/results - Get results for a specific website.
 */
export const getResultsByWebsite = async ( req: Request<{ websiteId: string }>, res: Response, next: NextFunction ): Promise<void> => {
  try {
     if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
    const userId = req.user.id;
    const websiteId = parseInt(req.params.websiteId, 10);
    if (isNaN(websiteId)) { res.status(400).json({ message: 'Invalid Website ID.' }); return; }
    const { limit, from, to } = req.query;

    const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
    if (!hasAccess) { res.status(404).json({ message: 'Website not found or access denied.' }); return; }

    const results = await ResultsManager.getFilteredResultsByWebsite(websiteId, {
        limit: limit ? parseInt(limit as string, 10) : undefined,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined
    });

    const responseData: SharedMonitoringResult[] = results
        .map(mapPrismaResultToSharedCore)
        .filter((r): r is SharedMonitoringResult => r !== null);
    res.json(responseData);
  } catch (error) { next(error); }
};

/**
 * POST /api/monitoring/check/:websiteId - Trigger a manual check for a website.
 */
export const triggerWebsiteCheck = async ( req: Request<{ websiteId: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;
        const websiteId = parseInt(req.params.websiteId, 10);
        if (isNaN(websiteId)) { res.status(400).json({ message: 'Invalid Website ID.' }); return; }

        const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
        if (!hasAccess) { res.status(404).json({ message: 'Website not found or access denied.' }); return; }

        const websitePrisma = await prisma.website.findUnique({ where: { id: websiteId } });
        if (!websitePrisma) { res.status(404).json({ message: 'Website data not found.' }); return; }

        console.log(`[triggerWebsiteCheck] User ${userId} starting check for website ID: ${websiteId}`);
        const newPrismaResult = await WebsiteMonitor.checkWebsite(websitePrisma);
        console.log(`[triggerWebsiteCheck] Check completed for website ID: ${websiteId}. Result ID: ${newPrismaResult?.id}`);

        const newSharedResult = mapPrismaResultToSharedCore(newPrismaResult);
        if (!newSharedResult) { return next(new Error('Failed to process check result after execution.')); }
        res.status(200).json(newSharedResult);
     } catch (error) { next(error); }
};

/**
 * GET /api/monitoring/admin/stats - Get overall stats (admin).
 * (Ensures full breakdown is requested)
 */
export const getOverallStats = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
      // Add validation/default for period if desired
      const period = (req.query.period as string) ?? 'week';
      // Explicitly request the website breakdown for the admin view
      const stats: OverallStats = await StatsCalculator.getOverallStats(undefined, period, true );
      res.json(stats);
    } catch (error) {
      next(error);
    }
};

/**
 * GET /api/monitoring/user/stats - Get stats for the authenticated user's dashboard.
 * (No changes needed - calls the correct lean service function)
 */
export const getUserStats = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
      if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
      const userId = req.user.id;
      // Add validation/default for period if desired
      const period = (req.query.period as string) ?? 'week';
      // Calls the service function that explicitly requests NO breakdown
      const stats: OverallStats = await StatsCalculator.getUserDashboardStats(userId, period );
      res.json(stats);
    } catch (error) {
      next(error);
    }
};

/**
 * GET /api/monitoring/website/:websiteId/stats - Get stats for a specific website.
 */
export const getWebsiteStats = async ( req: Request<{ websiteId: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
      if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
      const userId = req.user.id;
      const websiteId = parseInt(req.params.websiteId, 10);
      if (isNaN(websiteId)) { res.status(400).json({ message: 'Invalid Website ID.' }); return; }
      // Add validation/default for period if desired
      const period = (req.query.period as string) ?? 'week';

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
 */
export const getWebsiteDetails = async (
    req: Request<{ websiteId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;

        const websiteId = parseInt(req.params.websiteId, 10);
        if (isNaN(websiteId)) { res.status(400).json({ message: 'Invalid Website ID.' }); return; }

        // Add validation/default for timeframe if desired
        const timeframe = (req.query.timeframe as TimeframeKey) ?? 'day';
        if (VALID_TIMEFRAMES && !VALID_TIMEFRAMES.includes(timeframe)) {
            // Handle invalid timeframe - default or error
        }
        // Add similar validation/defaults for limit, incidentLimit, sortBy, sortDir

        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
        const incidentLimit = req.query.incidentLimit ? parseInt(req.query.incidentLimit as string, 10) : 10;
        const sortBy = (req.query.sortBy as MonitoringResultSortBy) ?? 'checkedAt';
        const sortDir = (req.query.sortDir as SortDirection) ?? 'desc';

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
            StatsCalculator.calculateUptimeBetweenDates(websiteId, startDate, endDate), // Uses optimized version
            IncidentService.getCurrentOpenIncidentForWebsite(websiteId),
            IncidentService.getIncidents({ websiteId: websiteId, limit: incidentLimit }, userId)
        ]);

        const latestSharedResult = mapPrismaResultToSharedCore(latestResultData);
        const safeChartData = Array.isArray(chartDataResult) ? chartDataResult : [];
        const safeRecentChecksPrisma = Array.isArray(recentChecksData) ? recentChecksData : [];
        // Ensure IncidentService.getIncidents returns the shared Incident type or map here
        const safeRecentIncidents = Array.isArray(recentIncidentsData) ? recentIncidentsData : [];

        const mappedRecentChecks = safeRecentChecksPrisma
            .map(mapPrismaResultToSharedCore)
            .filter((r): r is SharedMonitoringResult => r !== null);

        const responseData: WebsiteDetailsData = {
            websiteId: userWebsite.websiteId,
            name: userWebsite.name || userWebsite.website.url,
            url: userWebsite.website.url,
            latestResult: latestSharedResult,
            chartData: safeChartData,
            recentChecks: mappedRecentChecks,
            uptimePercent: typeof uptimePercentData === 'number' ? uptimePercentData : 100,
            currentIncident: currentIncidentData ?? null, // Ensure IncidentService maps correctly
            recentIncidents: safeRecentIncidents, // Ensure IncidentService maps correctly
        };
        res.json(responseData);
    } catch (error) {
        console.error(`[getWebsiteDetails] Error fetching details for website ${req.params.websiteId}:`, error);
        next(error);
    }
};