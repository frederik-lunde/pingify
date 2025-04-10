// server/src/controllers/monitoringController.ts
import { PrismaClient, Prisma, Website as PrismaWebsite, MonitoringResult as PrismaMonitoringResult } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';

// --- Import Services ---
import { ResultsManager, WebsiteMonitor, StatsCalculator } from '../services/monitoringService';
import * as websiteService from '../services/websiteService';
import * as IncidentService from '../services/incidentService'; // Import IncidentService

// --- Import SHARED Types ---
import {
    WebsiteDetailsData,
    TimeframeKey,
    MonitoringResult as SharedMonitoringResult,
    ChartDataPoint,
    WebsiteStatsData,
    OverallStats,
    // DownWebsite, // Removed
    Incident, // Import Incident
    IncidentCountResponse // Keep for reference, but endpoint moved
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
    const coreData: Omit<SharedMonitoringResult, 'website'> = { id: prismaResult.id, websiteId: prismaResult.websiteId, checkedAt: prismaResult.checkedAt.toISOString(), responseTime: prismaResult.responseTime, isAvailable: prismaResult.isAvailable, statusCode: prismaResult.statusCode, errorMessage: prismaResult.errorMessage };
    return coreData as SharedMonitoringResult;
};


// --- Controller Functions ---

// getAllResults remains unchanged
export const getAllResults = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const { limit = '100', from, to } = req.query;
    const parsedLimit = parseInt(limit as string, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) { res.status(400).json({ message: 'Invalid limit format.' }); return; }
    const results = await ResultsManager.getAllResults({ limit: parsedLimit, from: from ? new Date(from as string) : undefined, to: to ? new Date(to as string) : undefined });
    const responseData: SharedMonitoringResult[] = results.map((r: any) => { const coreData = mapPrismaResultToSharedCore(r); if (!coreData) return null; return { ...coreData, website: r.website ? { url: r.website.url } : undefined }; }).filter(r => r !== null) as SharedMonitoringResult[];
    res.json(responseData);
  } catch (error) { next(error); }
};

// getUserResults remains unchanged
export const getUserResults = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
     if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
     const userId = req.user.id;
     const { limit = '100', from, to } = req.query;
     const parsedLimit = parseInt(limit as string, 10);
     if (isNaN(parsedLimit) || parsedLimit <= 0) { res.status(400).json({ message: 'Invalid limit format.' }); return; }
     const results = await ResultsManager.getResultsForUser(userId, { limit: parsedLimit, from: from ? new Date(from as string) : undefined, to: to ? new Date(to as string) : undefined });
     const responseData: SharedMonitoringResult[] = results.map((r: any) => { const coreData = mapPrismaResultToSharedCore(r); if (!coreData) return null; return { ...coreData, website: r.website ? { url: r.website.url, name: r.website.websiteUsers?.[0]?.name ?? undefined } : undefined }; }).filter(r => r !== null) as SharedMonitoringResult[];
     res.json(responseData);
  } catch (error) { next(error); }
};

// getResultsByWebsite remains unchanged
export const getResultsByWebsite = async ( req: Request<{ websiteId: string }>, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const { websiteId: websiteIdParam } = req.params;
     if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
    const userId = req.user.id;
    const websiteId = parseIdParam(websiteIdParam);
    if (websiteId === null) { res.status(400).json({ message: 'Invalid Website ID format.' }); return; }
    const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
    if (!hasAccess) { res.status(404).json({ message: 'Website not found or access denied.' }); return; }
    const { limit = '100', from, to } = req.query;
    const parsedLimit = parseInt(limit as string, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) { res.status(400).json({ message: 'Invalid limit format.' }); return; }
    const results = await ResultsManager.getFilteredResultsByWebsite(websiteId, { limit: parsedLimit, from: from ? new Date(from as string) : undefined, to: to ? new Date(to as string) : undefined });
    const responseData: SharedMonitoringResult[] = results.map(mapPrismaResultToSharedCore).filter(r => r !== null) as SharedMonitoringResult[];
    res.json(responseData);
  } catch (error) { next(error); }
};


// triggerWebsiteCheck remains unchanged
export const triggerWebsiteCheck = async ( req: Request<{ websiteId: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
        const { websiteId: websiteIdParam } = req.params;
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;
        const websiteId = parseIdParam(websiteIdParam);
        if (websiteId === null) { res.status(400).json({ message: 'Invalid Website ID format.' }); return; }
        const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
        if (!hasAccess) { res.status(404).json({ message: 'Website not found or access denied.' }); return; }
        const websitePrisma: PrismaWebsite | null = await prisma.website.findUnique({ where: { id: websiteId } });
        if (!websitePrisma) { res.status(404).json({ message: 'Website data not found.' }); return; }
        console.log(`[triggerWebsiteCheck] Starting check for website ID: ${websiteId}`);
        // checkWebsite now triggers incident processing asynchronously
        const newPrismaResult: PrismaMonitoringResult = await WebsiteMonitor.checkWebsite(websitePrisma);
        console.log(`[triggerWebsiteCheck] Check completed for website ID: ${websiteId}. Result ID: ${newPrismaResult?.id}`);
        const newSharedResult: SharedMonitoringResult | null = mapPrismaResultToSharedCore(newPrismaResult);
         if (!newSharedResult) { console.error(`[triggerWebsiteCheck] Failed to map Prisma result for website ID: ${websiteId}`); res.status(500).json({ message: 'Failed to process check result after execution.' }); return; }
        res.status(200).json(newSharedResult);
     } catch (error) { console.error(`[triggerWebsiteCheck] Error checking website ID ${req.params.websiteId}:`, error); next(error); }
};

// getOverallStats remains unchanged (uses updated StatsCalculator)
export const getOverallStats = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
      const { period = 'week' } = req.query;
      const stats: OverallStats = await StatsCalculator.getOverallStats(undefined, period as string );
      res.json(stats);
    } catch (error) { next(error); }
};

// getUserStats remains unchanged (uses updated StatsCalculator)
export const getUserStats = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
    try {
     if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
      const userId = req.user.id;
      const { period = 'week' } = req.query;
      const stats: OverallStats = await StatsCalculator.getUserDashboardStats(userId, period as string );
      res.json(stats);
    } catch (error) { next(error); }
};

// getWebsiteStats remains unchanged (uses updated StatsCalculator)
export const getWebsiteStats = async ( req: Request<{ websiteId: string }>, res: Response, next: NextFunction ): Promise<void> => {
    try {
      const { websiteId: websiteIdParam } = req.params;
     if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
      const userId = req.user.id;
      const websiteId = parseIdParam(websiteIdParam);
      if (websiteId === null) { res.status(400).json({ message: 'Invalid Website ID format.' }); return; }
      const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
       if (!hasAccess) { res.status(404).json({ message: 'Website not found or access denied.' }); return; }
      const { period = 'week' } = req.query;
      // Pass userId for correct name mapping in stats
      const stats: WebsiteStatsData = await StatsCalculator.getWebsiteStats(websiteId, userId, period as string );
      res.json(stats);
    } catch (error) { next(error); }
};


/**
 * GET /api/monitoring/website/:websiteId - Get comprehensive details for a specific website view (requires user access)
 * UPDATED: Includes current open incident and recent incidents.
 */
export const getWebsiteDetails = async (
    req: Request<{ websiteId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { websiteId: websiteIdParam } = req.params;
        if (!req.user?.id) { res.status(401).json({ message: 'Authentication required.' }); return; }
        const userId = req.user.id;
        const websiteId = parseIdParam(websiteIdParam);
        if (websiteId === null) { res.status(400).json({ message: 'Invalid Website ID format.' }); return; }

        const timeframe = (req.query.timeframe as TimeframeKey) || 'day';
        const limit = parseInt(req.query.limit as string, 10) || 25; // Limit for recent checks
        const incidentLimit = parseInt(req.query.incidentLimit as string, 10) || 10; // Limit for recent incidents
        if (isNaN(limit) || limit <= 0) { res.status(400).json({ message: 'Invalid limit format.' }); return; }
        if (isNaN(incidentLimit) || incidentLimit <= 0) { res.status(400).json({ message: 'Invalid incidentLimit format.' }); return; }

        const validSortByFields = ['checkedAt', 'isAvailable', 'responseTime', 'statusCode', 'id'];
        const sortByInput = req.query.sortBy as string | undefined;
        const sortBy = (sortByInput && validSortByFields.includes(sortByInput)) ? sortByInput : 'checkedAt';
        const sortDirInput = req.query.sortDir as string | undefined;
        const sortDir: Prisma.SortOrder = (sortDirInput === 'asc') ? 'asc' : 'desc';

        const userWebsite = await websiteService.getUserWebsiteById(userId, websiteId);
        if (!userWebsite || !userWebsite.website) { res.status(404).json({ message: 'Website not found or access denied.' }); return; }

        const startDate = getStartDateForTimeframe(timeframe);
        const endDate = new Date();

        let orderByClause: Prisma.MonitoringResultOrderByWithRelationInput[] = [];
        const sortField = sortBy as keyof Prisma.MonitoringResultOrderByWithRelationInput;
        if (sortField === 'statusCode' || sortField === 'responseTime') { orderByClause.push({ [sortField]: { sort: sortDir, nulls: 'last' } }); }
        else if (sortField === 'isAvailable' || sortField === 'checkedAt' || sortField === 'id' ) { orderByClause.push({ [sortField]: sortDir }); }
        else { orderByClause.push({ checkedAt: sortDir }); }
        if (sortBy !== 'checkedAt') { orderByClause.push({ checkedAt: 'desc' }); }

        // Fetch data in parallel
        const [
            latestResultData,
            chartDataResult,
            recentChecksData,
            uptimePercentData,
            currentIncidentData, // Fetch current open incident
            recentIncidentsData // Fetch recent incidents
        ] = await Promise.all([
            prisma.monitoringResult.findFirst({ where: { websiteId }, orderBy: { checkedAt: 'desc' }}),
            StatsCalculator.getChartDataForWebsite(websiteId, timeframe),
            prisma.monitoringResult.findMany({ where: { websiteId: websiteId }, orderBy: orderByClause, take: limit }),
            StatsCalculator.calculateUptimeBetweenDates(websiteId, startDate, endDate),
            IncidentService.getCurrentOpenIncidentForWebsite(websiteId), // Use service function
            IncidentService.getIncidents({ websiteId: websiteId, limit: incidentLimit }, userId) // Use service function, pass userId for name mapping
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
            currentIncident: currentIncidentData, // Assign fetched open incident
            recentIncidents: recentIncidentsData, // Assign fetched recent incidents
            // --- REMOVED: Old downtime fields ---
            // consecutiveFailures: undefined,
            // downtimeStartedAt: null,
        };
        res.json(responseData);
    } catch (error) {
        console.error(`Error fetching website details for ID ${req.params.websiteId}:`, error);
        next(error);
    }
};