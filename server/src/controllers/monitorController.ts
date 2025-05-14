// server/src/controllers/monitoringController.ts
import {
  Prisma,
  MonitoringResult as PrismaMonitoringResult,
} from "@prisma/client";
import { Request, Response, NextFunction } from "express";
import {
  ResultsManager,
  WebsiteMonitor,
  StatsCalculator,
} from "../services/monitoringService";
import * as websiteService from "../services/websiteService";
import * as IncidentService from "../services/incidentService";
import {
  WebsiteDetailsData,
  TimeframeKey,
  MonitoringResult as SharedMonitoringResult,
  WebsiteStatsData,
  OverallStats,
  SortDirection,
  MonitoringResultSortBy,
  VALID_TIMEFRAMES,
} from "../types";
import prisma from "../prisma/prismaClient";
import { subHours, subDays, subYears, subMonths } from "date-fns";

const getStartDateForTimeframe = (timeframe: TimeframeKey): Date => {
  const now = new Date();
  switch (timeframe) {
    case "hour":
      return subHours(now, 1);
    case "day":
    default: // Default to 'day' if timeframe is invalid or not provided
      return subDays(now, 1);
    case "week":
      return subDays(now, 7);
    case "month":
      return subMonths(now, 1);
    case "year":
      return subYears(now, 1);
  }
};

/**
 * Maps a Prisma MonitoringResult's core fields to the shared MonitoringResult type.
 */
const mapPrismaResultToSharedCore = (
  prismaResult: PrismaMonitoringResult | null,
): SharedMonitoringResult | null => {
  if (!prismaResult) return null;
  const coreData: Omit<SharedMonitoringResult, "website"> = {
    id: prismaResult.id,
    websiteId: prismaResult.websiteId,
    checkedAt: prismaResult.checkedAt.toISOString(),
    responseTime: prismaResult.responseTime,
    isAvailable: prismaResult.isAvailable,
    statusCode: prismaResult.statusCode,
    errorMessage: prismaResult.errorMessage,
  };
  return coreData as SharedMonitoringResult; // Cast as we'll add website later if needed
};

/**
 * GET /api/monitoring/user/results - Get results for the authenticated user.
 */
export const getUserResults = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }
    const userId = req.user.id;
    const { limit, from, to } = req.query;
    const results = await ResultsManager.getResultsForUser(userId, {
      limit: limit ? parseInt(limit as string, 10) : undefined,
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined,
    });

    // Type assertion for results from ResultsManager.getResultsForUser
    const typedResults = results as (PrismaMonitoringResult & {
        website: { url: string; websiteUsers: { name: string | null }[] } | null;
    })[];


    const responseData: SharedMonitoringResult[] = typedResults
      .map((r): SharedMonitoringResult | null => {
        const coreData = mapPrismaResultToSharedCore(r);
        if (!coreData) return null;
        return {
          ...coreData,
          website: r.website
            ? {
                url: r.website.url,
                name: r.website.websiteUsers?.[0]?.name ?? undefined, // Use undefined if name is null
              }
            : undefined,
        };
      })
      .filter((r): r is SharedMonitoringResult => r !== null);
    res.json(responseData);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/monitoring/website/:websiteId/results - Get results for a specific website.
 */
export const getResultsByWebsite = async (
  req: Request<{ websiteId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }
    const userId = req.user.id;
    const websiteId = parseInt(req.params.websiteId, 10);
    if (isNaN(websiteId)) {
      res.status(400).json({ message: "Invalid Website ID." });
      return;
    }
    const { limit, from, to } = req.query;

    const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
    if (!hasAccess) {
      res.status(404).json({ message: "Website not found or access denied." });
      return;
    }

    const results = await ResultsManager.getFilteredResultsByWebsite(
      websiteId,
      {
        limit: limit ? parseInt(limit as string, 10) : undefined,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined,
      },
    );

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
 * This endpoint is now non-blocking for the check itself.
 */
export const triggerWebsiteCheck = async (
  req: Request<{ websiteId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }
    const userId = req.user.id;
    const websiteId = parseInt(req.params.websiteId, 10);

    if (isNaN(websiteId)) {
      res.status(400).json({ message: "Invalid Website ID." });
      return;
    }

    const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
    if (!hasAccess) {
      res.status(404).json({ message: "Website not found or access denied." });
      return;
    }

    const websitePrisma = await prisma.website.findUnique({
      where: { id: websiteId },
    });

    if (!websitePrisma) {
      res.status(404).json({ message: "Website data not found." });
      return;
    }

    if (!websitePrisma.isActive) {
        res.status(400).json({ message: "Cannot check an inactive website." });
        return;
    }

    console.log(
      `[triggerWebsiteCheck] User ${userId} initiating check for website ID: ${websiteId}`,
    );

    // Don't await WebsiteMonitor.checkWebsite. Let it run in the background.
    WebsiteMonitor.checkWebsite(websitePrisma)
      .then(result => {
        console.log(
          `[triggerWebsiteCheck BG] Background check completed for website ID: ${websiteId}. Result ID: ${result?.id}`,
        );
        // Here you could potentially emit a WebSocket event or log,
        // but the HTTP response has already been sent.
      })
      .catch(error => {
        console.error(
          `[triggerWebsiteCheck BG] Error during background check for website ID: ${websiteId}:`,
          error,
        );
      });

    // Respond immediately to the client that the check has been initiated.
    res.status(202).json({ message: "Website check initiated." });

  } catch (error) {
    // Catch errors from the synchronous part (auth, findUnique, etc.)
    console.error(`[triggerWebsiteCheck SYNC ERR] Failed to initiate check for website ${req.params.websiteId}:`, error);
    next(error);
  }
};


/**
 * GET /api/monitoring/user/stats - Get stats for the authenticated user's dashboard.
 */
export const getUserStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }
    const userId = req.user.id;
    const period = (req.query.period as string) ?? "week"; // Default to 'week'
    const stats: OverallStats = await StatsCalculator.getUserDashboardStats(
      userId,
      period,
    );
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/monitoring/website/:websiteId/stats - Get stats for a specific website.
 */
export const getWebsiteStats = async (
  req: Request<{ websiteId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }
    const userId = req.user.id;
    const websiteId = parseInt(req.params.websiteId, 10);
    if (isNaN(websiteId)) {
      res.status(400).json({ message: "Invalid Website ID." });
      return;
    }
    const period = (req.query.period as string) ?? "week"; // Default to 'week'

    const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
    if (!hasAccess) {
      res.status(404).json({ message: "Website not found or access denied." });
      return;
    }

    const stats: WebsiteStatsData = await StatsCalculator.getWebsiteStats(
      websiteId,
      userId,
      period,
    );
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
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }
    const userId = req.user.id;

    const websiteId = parseInt(req.params.websiteId, 10);
    if (isNaN(websiteId)) {
      res.status(400).json({ message: "Invalid Website ID." });
      return;
    }

    const timeframe = (req.query.timeframe as TimeframeKey) ?? "day";
    if (VALID_TIMEFRAMES && !VALID_TIMEFRAMES.includes(timeframe)) {
        // Log warning or default, current getStartDateForTimeframe defaults to 'day'
        console.warn(`Invalid timeframe '${req.query.timeframe}' provided, defaulting to 'day'.`);
    }

    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 50;
    const incidentLimit = req.query.incidentLimit
      ? parseInt(req.query.incidentLimit as string, 10)
      : 10;
    const sortBy = (req.query.sortBy as MonitoringResultSortBy) ?? "checkedAt";
    const sortDir = (req.query.sortDir as SortDirection) ?? "desc";

    const userWebsite = await websiteService.getUserWebsiteById(
      userId,
      websiteId,
    );
    if (!userWebsite || !userWebsite.website) {
      res.status(404).json({ message: "Website not found or access denied." });
      return;
    }

    const startDate = getStartDateForTimeframe(timeframe);
    const endDate = new Date();

    let orderByClause: Prisma.MonitoringResultOrderByWithRelationInput[] = [];
    if (sortBy === "statusCode" || sortBy === "responseTime") {
      orderByClause.push({ [sortBy]: { sort: sortDir, nulls: "last" } });
    } else { // Default to checkedAt or other direct fields
      orderByClause.push({ [sortBy]: sortDir });
    }
    // Add secondary sort by checkedAt if primary sort is not checkedAt, to ensure consistent ordering
    if (sortBy !== "checkedAt") {
      orderByClause.push({ checkedAt: "desc" }); // Or 'asc' depending on desired secondary tie-breaker
    }

    const [
      latestResultData,
      chartDataResult,
      recentChecksData,
      uptimePercentData,
      currentIncidentData,
      recentIncidentsData,
    ] = await Promise.all([
      prisma.monitoringResult.findFirst({
        where: { websiteId },
        orderBy: { checkedAt: "desc" },
      }),
      StatsCalculator.getChartDataForWebsite(websiteId, timeframe),
      prisma.monitoringResult.findMany({
        where: { websiteId: websiteId },
        orderBy: orderByClause,
        take: limit,
      }),
      StatsCalculator.calculateUptimeBetweenDates(
        websiteId,
        startDate,
        endDate,
      ),
      IncidentService.getCurrentOpenIncidentForWebsite(websiteId),
      IncidentService.getIncidents(
        { websiteId: websiteId, limit: incidentLimit },
        userId, // Pass userId for correct website name mapping in incident DTO
      ),
    ]);

    const latestSharedResult = mapPrismaResultToSharedCore(latestResultData);
    const safeChartData = Array.isArray(chartDataResult) ? chartDataResult : [];
    const safeRecentChecksPrisma = Array.isArray(recentChecksData)
      ? recentChecksData
      : [];
    const safeRecentIncidents = Array.isArray(recentIncidentsData)
      ? recentIncidentsData
      : [];

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
      uptimePercent:
        typeof uptimePercentData === "number" ? uptimePercentData : 100, // Default to 100 if not a number
      currentIncident: currentIncidentData ?? null,
      recentIncidents: safeRecentIncidents,
    };
    res.json(responseData);
  } catch (error) {
    console.error(
      `[getWebsiteDetails] Error fetching details for website ${req.params.websiteId}:`,
      error,
    );
    next(error);
  }
};