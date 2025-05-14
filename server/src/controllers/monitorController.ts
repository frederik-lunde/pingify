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
    default: 
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
  return coreData as SharedMonitoringResult; 
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
                name: r.website.websiteUsers?.[0]?.name ?? undefined, 
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

    
    WebsiteMonitor.checkWebsite(websitePrisma)
      .then(result => {
        console.log(
          `[triggerWebsiteCheck BG] Background check completed for website ID: ${websiteId}. Result ID: ${result?.id}`,
        );
        
        
      })
      .catch(error => {
        console.error(
          `[triggerWebsiteCheck BG] Error during background check for website ID: ${websiteId}:`,
          error,
        );
      });

    
    res.status(202).json({ message: "Website check initiated." });

  } catch (error) {
    
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
    const period = (req.query.period as string) ?? "week"; 
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
    const period = (req.query.period as string) ?? "week"; 

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
    // Assuming VALID_TIMEFRAMES is defined in your types.ts and imported
    if (VALID_TIMEFRAMES && !VALID_TIMEFRAMES.includes(timeframe)) {
        console.warn(`Invalid timeframe '${req.query.timeframe}' provided for getWebsiteDetails, defaulting to 'day'.`);
        // timeframe = "day"; // No need to reassign if already defaulted above
    }

    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 50;
    const incidentLimit = req.query.incidentLimit
      ? parseInt(req.query.incidentLimit as string, 10)
      : 10; // Default incident limit
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
    const endDate = new Date(); // endDate is always now for recent incidents within the timeframe

    let orderByClause: Prisma.MonitoringResultOrderByWithRelationInput[] = [];
    if (sortBy === "statusCode" || sortBy === "responseTime") {
      orderByClause.push({ [sortBy]: { sort: sortDir, nulls: "last" } });
    } else {
      orderByClause.push({ [sortBy]: sortDir });
    }

    if (sortBy !== "checkedAt") {
      orderByClause.push({ checkedAt: "desc" });
    }

    const [
      latestResultData,
      chartDataResult,
      recentChecksData,
      uptimePercentData,
      currentIncidentData,
      recentIncidentsData, // This is the one we're focusing on
    ] = await Promise.all([
      prisma.monitoringResult.findFirst({
        where: { websiteId },
        orderBy: { checkedAt: "desc" },
      }),
      StatsCalculator.getChartDataForWebsite(websiteId, timeframe),
      prisma.monitoringResult.findMany({
        where: { websiteId: websiteId }, // You might want to filter recent checks by timeframe too if desired
        orderBy: orderByClause,
        take: limit,
      }),
      StatsCalculator.calculateUptimeBetweenDates(
        websiteId,
        startDate, // Uptime is already calculated for the timeframe
        endDate,
      ),
      IncidentService.getCurrentOpenIncidentForWebsite(websiteId),
      IncidentService.getIncidents( // MODIFIED PART
        {
          websiteId: websiteId,
          limit: incidentLimit,
          from: startDate, // Pass the calculated start date
          to: endDate,     // Pass the calculated end date (now)
          // You might also want to consider how 'status' (open/closed) interacts here
          // For "Recent Incidents" usually you want both open and closed within the timeframe.
          // If getIncidents defaults to only open or closed, you might need to adjust its logic
          // or pass an explicit status filter if applicable.
        },
        userId,
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
        typeof uptimePercentData === "number" ? uptimePercentData : 100,
      currentIncident: currentIncidentData ?? null,
      recentIncidents: safeRecentIncidents, // This will now be filtered by timeframe
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