import axios, { AxiosError } from "axios";
import { performance } from "perf_hooks";
import { Prisma, Incident as PrismaIncident } from "@prisma/client";
import { monitoringConfig } from "../config/config";
import { handleResultProcessing } from "./alertService";
import * as IncidentService from "./incidentService";
import prisma from "../prisma/prismaClient";
import {
  subHours,
  subDays,
  subYears,
  subMonths,
  startOfDay,
  endOfDay,
  startOfMonth,
  eachDayOfInterval,
  eachMonthOfInterval,
  format,
  getUnixTime,
  sub,
} from "date-fns";

import {
  MonitoringResponse,
  ResultsQueryOptions,
  WebsiteStatsData,
  OverallStats,
  TimeframeKey,
  ChartDataPoint,
  WebsitePrisma,
  MonitoringResultPrisma,
} from "../types";

const REQUEST_TIMEOUT_MS = monitoringConfig.requestTimeoutMs;
const MONITOR_USER_AGENT = monitoringConfig.monitorUserAgent;

/**
 * Handles website monitoring checks.
 */
export class WebsiteMonitor {
  /**
   * Performs an HTTP GET request to the given URL and measures its availability and response time.
   * @param url - The URL of the website to check.
   * @returns A promise that resolves to a MonitoringResponse object.
   */
  static async performWebsiteCheck(url: string): Promise<MonitoringResponse> {
    const CHECK_COUNT = 3;
    const CHECK_DELAY_MS = 5000;

    let failures = 0;
    let worstStatus: number | null = null;
    let worstError: string | null = null;
    let totalResponseTime = 0;
    let successfulChecksCount = 0;
    let sumOfSuccessfulResponseTimes = 0;

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const singleCheck = async (): Promise<MonitoringResponse> => {
      const start = performance.now();
      let responseTime: number | null = null;
      let isAvailable = false;
      let statusCode: number | null = null;
      let errorMessage: string | null = null;

      try {
        const response = await axios.get(url, {
          timeout: REQUEST_TIMEOUT_MS,
          headers: {
            "User-Agent": MONITOR_USER_AGENT,
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
          },
          validateStatus: () => true,
        });

        responseTime = Math.round(performance.now() - start);
        statusCode = response.status;
        isAvailable = statusCode >= 200 && statusCode < 300;

        if (statusCode === 200 && typeof response.data === "string") {
          const lowerCaseBody = response.data.toLowerCase();
          if (
            lowerCaseBody.includes("502 bad gateway") ||
            lowerCaseBody.includes("error 502")
          ) {
            statusCode = 502;
            isAvailable = false;
            errorMessage = "Detected 502 message in body";
          }
        }

        if (!isAvailable && !errorMessage) {
          errorMessage = `HTTP Status ${statusCode}`;
        }
      } catch (error: unknown) {
        responseTime = Math.round(performance.now() - start);
        isAvailable = false;
        if (axios.isAxiosError(error)) {
          statusCode = error.response?.status ?? null;
          errorMessage = this.parseAxiosErrorMessage(error);
        } else if (error instanceof Error) {
          errorMessage = error.message;
        } else {
          errorMessage = "Unknown error occurred during check.";
        }
        console.error(`[Check Error] ${url}: ${errorMessage} (Status: ${statusCode ?? "N/A"})`);
      }

      return { responseTime, isAvailable, statusCode, errorMessage };
    };

    for (let i = 0; i < CHECK_COUNT; i++) {
      const result = await singleCheck();

      if (!result.isAvailable) {
        failures++;
        if (worstStatus === null || (result.statusCode !== null && result.statusCode > (worstStatus || 0))) {
          worstStatus = result.statusCode;
        }
        if (result.errorMessage && (!worstError || (worstError && result.errorMessage !== worstError))) {
          worstError = result.errorMessage;
        }
      } else {
        successfulChecksCount++;
        if (result.responseTime !== null) {
          sumOfSuccessfulResponseTimes += result.responseTime;
        }
      }

      totalResponseTime += result.responseTime ?? REQUEST_TIMEOUT_MS;

      if (i < CHECK_COUNT - 1) {
        await delay(CHECK_DELAY_MS);
      }
    }

    const isAvailable = failures < 2;

    const avgResponseTime = successfulChecksCount > 0
      ? Math.round(sumOfSuccessfulResponseTimes / successfulChecksCount)
      : null;

    return {
      responseTime: avgResponseTime,
      isAvailable,
      statusCode: isAvailable ? 200 : (worstStatus ?? 500),
      errorMessage: isAvailable ? null : (worstError ?? "Multiple checks failed"),
    };
  }

  /**
   * Parses an AxiosError to generate a readable error message.
   * @param error - The AxiosError object.
   * @returns A string describing the error.
   */
  private static parseAxiosErrorMessage(error: AxiosError): string {
    if (error.response) return `HTTP Error ${error.response.status}`;
    if (error.request) {
      if (error.code === "ECONNABORTED")
        return `Request timed out (${REQUEST_TIMEOUT_MS}ms)`;
      if (error.code === "ENOTFOUND")
        return "DNS lookup failed (domain not found)";
      if (error.code === "ECONNREFUSED") return "Connection refused by server";
      if (error.code === "ETIMEDOUT") return "Connection timed out";
      if (error.code === "EHOSTUNREACH") return "No route to host";
      if (error.code === "ECONNRESET") return "Connection reset by peer";
      return "No response received from server";
    }
    return `Request setup error: ${error.message}`;
  }

  /**
   * Checks a website, saves the result, and triggers post-check processing (alerts, incidents).
   * @param website - The Prisma Website object to check.
   * @returns A promise that resolves to the saved MonitoringResultPrisma object.
   * @throws Will throw an error if the check or saving process fails critically.
   */
  static async checkWebsite(
    website: WebsitePrisma,
  ): Promise<MonitoringResultPrisma> {
    const logPrefix = `[Monitor W:${website.id} ${website.url}]`;
    console.log(`${logPrefix} Starting check.`);
    let savedResult: MonitoringResultPrisma | null = null;

    try {
      const checkResultData = await this.performWebsiteCheck(website.url);
      savedResult = await ResultsManager.saveResult(
        website.id,
        checkResultData,
      );
      console.log(
        `${logPrefix} Result saved (ID: ${savedResult.id}): Avail=${savedResult.isAvailable}, RT=${savedResult.responseTime}ms, Status=${savedResult.statusCode}, Err=${savedResult.errorMessage ?? "None"}`,
      );

      if (savedResult) {
        handleResultProcessing(website, savedResult).catch((procError) => {
          console.error(
            `${logPrefix} Error during post-check result processing for R:${savedResult?.id}:`,
            procError,
          );
        });
      }
      return savedResult;
    } catch (error: any) {
      console.error(
        `${logPrefix} Critical failure during checkWebsite process: ${error.message}`,
        error.stack,
      );
      try {
        if (!savedResult) {
          await prisma.website.update({
            where: { id: website.id },
            data: { lastChecked: new Date() },
          });
          console.warn(
            `${logPrefix} Updated lastChecked after error during check/processing (result not saved).`,
          );
        }
      } catch (updateError) {
        console.error(
          `${logPrefix} Failed to update lastChecked after error:`,
          updateError,
        );
      }
      throw error;
    }
  }
}

/**
 * Manages the storage and retrieval of monitoring results.
 */
export class ResultsManager {
  /**
   * Saves a monitoring result to the database and updates the website's lastChecked timestamp.
   * @param websiteId - The ID of the website the result belongs to.
   * @param result - The MonitoringResponse data to save.
   * @returns A promise that resolves to the saved MonitoringResultPrisma object.
   */
  static async saveResult(
    websiteId: number,
    result: MonitoringResponse,
  ): Promise<MonitoringResultPrisma> {
    const { responseTime, isAvailable, statusCode, errorMessage } = result;
    const checkedAt = new Date();
    try {
      const savedMonitoringResult = await prisma.$transaction(async (tx) => {
        await tx.website.update({
          where: { id: websiteId },
          data: { lastChecked: checkedAt },
        });
        return tx.monitoringResult.create({
          data: {
            websiteId,
            responseTime,
            isAvailable,
            statusCode,
            errorMessage,
            checkedAt,
          },
        });
      });
      return savedMonitoringResult;
    } catch (error) {
      console.error(
        `[ResultsManager] Error saving result for website ${websiteId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Retrieves the ID of the latest monitoring result for a given website.
   * @param websiteId - The ID of the website.
   * @returns A promise that resolves to the latest result ID, or 0 if no results exist.
   */
  static async getLatestResultId(websiteId: number): Promise<number> {
    const result = await prisma.monitoringResult.findFirst({
      where: { websiteId },
      orderBy: { checkedAt: "desc" },
      select: { id: true },
    });
    return result?.id || 0;
  }

  /**
   * Retrieves the most recent monitoring results for a website.
   * @param websiteId - The ID of the website.
   * @param limit - The maximum number of results to return. Defaults to 100.
   * @returns A promise that resolves to an array of MonitoringResultPrisma objects.
   */
  static async getResultsForWebsite(
    websiteId: number,
    limit = 100,
  ): Promise<MonitoringResultPrisma[]> {
    return prisma.monitoringResult.findMany({
      where: { websiteId },
      orderBy: { checkedAt: "desc" },
      take: limit,
    });
  }

  /**
   * Retrieves monitoring results for a website, filtered by date range and limit.
   * @param websiteId - The ID of the website.
   * @param options - Optional query parameters including limit, from date, and to date.
   * @returns A promise that resolves to an array of MonitoringResultPrisma objects.
   */
  static async getFilteredResultsByWebsite(
    websiteId: number,
    options: ResultsQueryOptions = {},
  ): Promise<MonitoringResultPrisma[]> {
    const { limit = 100, from, to } = options;
    const whereClause: Prisma.MonitoringResultWhereInput = { websiteId };
    if (from || to) {
      whereClause.checkedAt = {};
      if (from) whereClause.checkedAt.gte = from;
      if (to) whereClause.checkedAt.lte = to;
    }
    return prisma.monitoringResult.findMany({
      where: whereClause,
      orderBy: { checkedAt: "desc" },
      take: limit,
    });
  }

  /**
   * Retrieves monitoring results for all websites associated with a specific user.
   * Includes website URL and user-specific website name.
   * @param userId - The ID of the user.
   * @param options - Optional query parameters including limit, from date, and to date.
   * @returns A promise that resolves to an array of MonitoringResultPrisma objects, augmented with website details.
   */
  static async getResultsForUser(
    userId: string,
    options: ResultsQueryOptions = {},
  ): Promise<
    (MonitoringResultPrisma & {
      website: { url: string; websiteUsers: { name: string | null }[] } | null;
    })[]
  > {
    const { limit = 100, from, to } = options;
    const whereClause: Prisma.MonitoringResultWhereInput = {
      website: {
        websiteUsers: { some: { userId: userId } },
      },
    };

    if (from || to) {
      whereClause.checkedAt = {};
      if (from) whereClause.checkedAt.gte = from;
      if (to) whereClause.checkedAt.lte = to;
    }

    type ResultWithUserWebsite = MonitoringResultPrisma & {
      website: { url: string; websiteUsers: { name: string | null }[] } | null;
    };

    return prisma.monitoringResult.findMany({
      where: whereClause,
      orderBy: { checkedAt: "desc" },
      take: limit,
      include: {
        website: {
          select: {
            url: true,
            websiteUsers: {
              where: { userId: userId },
              select: { name: true },
            },
          },
        },
      },
    }) as Promise<ResultWithUserWebsite[]>;
  }
}

/**
 * Calculates various statistics based on monitoring results.
 */
export class StatsCalculator {
  /**
   * Calculates the uptime percentage for a website between two dates.
   * @param websiteId - The ID of the website.
   * @param startDate - The start date of the period.
   * @param endDate - The end date of the period. Defaults to the current date.
   * @returns A promise that resolves to the uptime percentage (0-100).
   */
  static async calculateUptimeBetweenDates(
    websiteId: number,
    startDate: Date,
    endDate: Date = new Date(),
  ): Promise<number> {
    const resultsAggregate = await prisma.monitoringResult.groupBy({
      by: ["isAvailable"],
      where: {
        websiteId: websiteId,
        checkedAt: { gte: startDate, lte: endDate },
      },
      _count: {
        isAvailable: true,
      },
    });

    let successfulChecks = 0;
    let failedChecks = 0;

    resultsAggregate.forEach((group) => {
      if (group.isAvailable === true) {
        successfulChecks = group._count.isAvailable;
      } else if (group.isAvailable === false) {
        failedChecks = group._count.isAvailable;
      }
    });

    const totalChecks = successfulChecks + failedChecks;

    if (totalChecks === 0) return 100;

    const uptimePercentage = (successfulChecks / totalChecks) * 100;
    return parseFloat(uptimePercentage.toFixed(2));
  }

  /**
   * Calculates the average response time for a website between two dates, considering only available checks.
   * @param websiteId - The ID of the website.
   * @param startDate - The start date of the period.
   * @param endDate - The end date of the period. Defaults to the current date.
   * @returns A promise that resolves to the average response time in milliseconds, or null if no valid data.
   */
  static async getAverageResponseTimeBetweenDates(
    websiteId: number,
    startDate: Date,
    endDate: Date = new Date(),
  ): Promise<number | null> {
    const result = await prisma.monitoringResult.aggregate({
      _avg: { responseTime: true },
      where: {
        websiteId,
        checkedAt: { gte: startDate, lte: endDate },
        isAvailable: true,
        responseTime: { not: null },
      },
    });
    return result._avg.responseTime !== null
      ? Math.round(result._avg.responseTime)
      : null;
  }

  /**
   * Converts a timeframe key or number of days into a number of days.
   * @param period - The timeframe key ('hour', 'day', 'week', 'month', 'year'), a number of days, or a string representing days.
   * @returns The number of days. Defaults to 7 if input is invalid.
   */
  private static periodToDays(period: TimeframeKey | string | number): number {
    switch (period) {
      case "hour":
        return 1 / 24;
      case "day":
        return 1;
      case "week":
        return 7;
      case "month":
        return 30;
      case "year":
        return 365;
    }
    if (typeof period === "number") return period > 0 ? period : 7;
    if (typeof period === "string") {
      const value = parseInt(period);
      if (!isNaN(value) && value > 0) return value;
    }
    return 7;
  }

  /**
   * Retrieves detailed statistics for a specific website over a given period.
   * @param websiteId - The ID of the website.
   * @param userId - Optional. The ID of the user to fetch user-specific website name.
   * @param period - The time period for which to calculate stats. Defaults to 'week'.
   * @returns A promise that resolves to a WebsiteStatsData object.
   * @throws Error if the website is not found.
   */
  static async getWebsiteStats(
    websiteId: number,
    userId?: string,
    period: TimeframeKey | string | number = "week",
  ): Promise<WebsiteStatsData> {
    const days = this.periodToDays(period);
    const startDate = sub(new Date(), { days: days });
    const endDate = new Date();

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { url: true },
    });
    if (!website) throw new Error(`Website with ID ${websiteId} not found`);

    let websiteName = website.url;
    if (userId) {
      const userWebsite = await prisma.websiteUser.findUnique({
        where: { userId_websiteId: { userId: userId, websiteId: websiteId } },
        select: { name: true },
      });
      if (userWebsite?.name) websiteName = userWebsite.name;
    }

    const [uptime, averageResponseTime, totalChecksData, lastResultData] =
      await Promise.all([
        this.calculateUptimeBetweenDates(websiteId, startDate, endDate),
        this.getAverageResponseTimeBetweenDates(websiteId, startDate, endDate),
        prisma.monitoringResult.count({
          where: { websiteId, checkedAt: { gte: startDate, lte: endDate } },
        }),
        prisma.monitoringResult.findFirst({
          where: { websiteId },
          orderBy: { checkedAt: "desc" },
          select: { checkedAt: true },
        }),
      ]);

    const totalChecks = totalChecksData;

    const incidentCounts = await prisma.incident.groupBy({
      by: ["type"],
      where: {
        websiteId: websiteId,
        OR: [
          { startTime: { gte: startDate, lte: endDate } },
          { endTime: { gte: startDate, lte: endDate } },
          { startTime: { lt: startDate }, endTime: null },
          { startTime: { lt: startDate }, endTime: { gt: endDate } },
        ],
      },
      _count: { type: true },
    });

    let totalIncidentCount = 0,
      downIncidentCount = 0,
      slowIncidentCount = 0;
    incidentCounts.forEach((group) => {
      const count = group._count.type;
      totalIncidentCount += count;
      if (group.type === "down") downIncidentCount = count;
      else if (group.type === "slow") slowIncidentCount = count;
    });

    return {
      websiteId,
      websiteName,
      url: website.url,
      uptime,
      averageResponseTime,
      totalChecks,
      lastCheck: lastResultData?.checkedAt?.toISOString() ?? null,
      incidentCount: totalIncidentCount,
      downIncidentCount,
      slowIncidentCount,
    };
  }

  /**
   * Calculates overall statistics for all websites or a specific user's websites.
   * Can optionally include a detailed breakdown per website.
   * @param userId - Optional user ID to filter stats for. If not provided, stats are for all websites.
   * @param period - Time period for stats calculation (e.g., 'day', 'week', 7). Defaults to 'week'.
   * @param includeWebsiteBreakdown - If true, calculates and includes the full `websiteStats` array. Defaults to false for performance.
   * @returns A promise that resolves to an OverallStats object.
   */
  static async getOverallStats(
    userId?: string,
    period: TimeframeKey | string | number = "week",
    includeWebsiteBreakdown = false,
  ): Promise<OverallStats> {
    const days = this.periodToDays(period);
    const periodStartDate = sub(new Date(), { days: days });
    const twentyFourHoursAgo = sub(new Date(), { hours: 24 });
    const websiteWhere: Prisma.WebsiteWhereInput = userId
      ? { websiteUsers: { some: { userId: userId } } }
      : {};

    const [totalWebsites, activeWebsitesCount] = await Promise.all([
      prisma.website.count({ where: websiteWhere }),
      prisma.website.count({ where: { ...websiteWhere, isActive: true } }),
    ]);

    const activeWebsitesList = await prisma.website.findMany({
      where: { ...websiteWhere, isActive: true },
      select: { id: true },
    });
    const activeWebsiteIds = activeWebsitesList.map((w) => w.id);

    let websiteStats: WebsiteStatsData[] = [];
    let overallUptime = 100;
    let overallResponseTime = null;

    if (activeWebsiteIds.length === 0) {
    } else if (includeWebsiteBreakdown) {
      const websiteStatsPromises = activeWebsiteIds.map((websiteId) =>
        this.getWebsiteStats(websiteId, userId, period),
      );
      websiteStats = await Promise.all(websiteStatsPromises);

      const validUptimeStats = websiteStats.filter(
        (stat) => stat.totalChecks > 0,
      );
      overallUptime =
        validUptimeStats.length > 0
          ? validUptimeStats.reduce((sum, stat) => sum + stat.uptime, 0) /
          validUptimeStats.length
          : 100;

      const validResponseStats = websiteStats.filter(
        (stat) => stat.averageResponseTime !== null,
      );
      overallResponseTime =
        validResponseStats.length > 0
          ? Math.round(
            validResponseStats.reduce(
              (sum, stat) => sum + stat.averageResponseTime!,
              0,
            ) / validResponseStats.length,
          )
          : null;
    } else {
      const websiteUptimeAndCheckCounts = await Promise.all(
        activeWebsiteIds.map(async (id) => {
          const uptime = await this.calculateUptimeBetweenDates(id, periodStartDate, new Date());
          const checkCount = await prisma.monitoringResult.count({
            where: {
              websiteId: id,
              checkedAt: { gte: periodStartDate, lte: new Date() },
            },
          });
          return { id, uptime, checkCount };
        })
      );

      const websitesWithChecksInPeriod = websiteUptimeAndCheckCounts.filter(
        (site) => site.checkCount > 0
      );

      if (websitesWithChecksInPeriod.length > 0) {
        overallUptime =
          websitesWithChecksInPeriod.reduce((sum, site) => sum + site.uptime, 0) /
          websitesWithChecksInPeriod.length;
      } else if (activeWebsiteIds.length > 0) {
        overallUptime = 100;
      }

      const avgRespResult = await prisma.monitoringResult.aggregate({
        _avg: { responseTime: true },
        where: {
          websiteId: { in: activeWebsiteIds },
          checkedAt: { gte: periodStartDate, lte: new Date() },
          isAvailable: true,
          responseTime: { not: null },
        },
      });
      overallResponseTime =
        avgRespResult._avg.responseTime !== null
          ? Math.round(avgRespResult._avg.responseTime)
          : null;
    }

    let incidentsLast24h = 0;
    let lastIncident: PrismaIncident | null = null;
    if (activeWebsiteIds.length > 0) {
      incidentsLast24h = await IncidentService.countIncidents({
        from: twentyFourHoursAgo,
        to: new Date(),
        ...(userId ? { userId: userId } : { websiteIds: activeWebsiteIds }),
      });
      lastIncident = await IncidentService.getMostRecentIncident(
        userId,
        userId ? undefined : activeWebsiteIds
      );
    }

    return {
      totalWebsites,
      activeWebsites: activeWebsitesCount,
      websiteStats: websiteStats,
      overallUptime: parseFloat(overallUptime.toFixed(2)),
      overallResponseTime,
      incidentsLast24h,
      lastIncidentTimestamp: lastIncident?.startTime.toISOString() ?? null,
      lastIncidentWebsiteId: lastIncident?.websiteId ?? null,
    };
  }

  /**
   * Gets overall stats specifically tailored for the user dashboard header,
   * omitting the detailed website breakdown for efficiency.
   * @param userId - The ID of the user.
   * @param period - The time period for which to calculate stats. Defaults to 'week'.
   * @returns A promise that resolves to an OverallStats object without detailed website breakdown.
   */
  static async getUserDashboardStats(
    userId: string,
    period: TimeframeKey | string | number = "week",
  ): Promise<OverallStats> {
    return this.getOverallStats(userId, period, false);
  }

  /**
   * Generates chart data (uptime and average response time) for a website over a specified timeframe.
   * Data points are aggregated based on the timeframe.
   * @param websiteId - The ID of the website.
   * @param timeframe - The timeframe for the chart data ('hour', 'day', 'week', 'month', 'year').
   * @returns A promise that resolves to an array of ChartDataPoint objects.
   */
  static async getChartDataForWebsite(
    websiteId: number,
    timeframe: TimeframeKey,
  ): Promise<ChartDataPoint[]> {
    const endDate = new Date();
    let chartData: ChartDataPoint[] = [];
    let startDate: Date;
    let intervalStart: Date, intervalEnd: Date;

    const calculatePeriodStats = (
      resultsInPeriod: MonitoringResultPrisma[],
    ): {
      avgResponseTime: number | null;
      uptimeRatio: number;
      checkCount: number;
    } => {
      const totalChecks = resultsInPeriod.length;
      if (totalChecks === 0)
        return { avgResponseTime: null, uptimeRatio: 1.0, checkCount: 0 };

      const successfulChecks = resultsInPeriod.filter(
        (r) => r.isAvailable,
      ).length;
      const validResponseTimes = resultsInPeriod
        .filter((r) => r.isAvailable && r.responseTime !== null)
        .map((r) => r.responseTime!);
      const avgResponseTime =
        validResponseTimes.length > 0
          ? Math.round(
            validResponseTimes.reduce((s, rt) => s + rt, 0) /
            validResponseTimes.length,
          )
          : null;
      const uptimeRatio = successfulChecks / totalChecks;

      return {
        avgResponseTime,
        uptimeRatio: parseFloat(uptimeRatio.toFixed(4)),
        checkCount: totalChecks,
      };
    };

    try {
      switch (timeframe) {
        case "hour":
          startDate = subHours(endDate, 1);
          const hourResults = await prisma.monitoringResult.findMany({
            where: { websiteId, checkedAt: { gte: startDate, lte: endDate } },
            orderBy: { checkedAt: "asc" },
          });

          const intervalMinutesHour = 5; 
          const intervalsHour = new Map<number, MonitoringResultPrisma[]>();

          hourResults.forEach((r) => {
            const intervalTimestamp =
              Math.floor(
                getUnixTime(new Date(r.checkedAt)) / (intervalMinutesHour * 60),
              ) *
              (intervalMinutesHour * 60);
            if (!intervalsHour.has(intervalTimestamp)) {
              intervalsHour.set(intervalTimestamp, []);
            }
            intervalsHour.get(intervalTimestamp)?.push(r);
          });

          chartData = Array.from(intervalsHour.entries()).map(
            ([timestamp, results]) => ({
              label: format(new Date(timestamp * 1000), "HH:mm"),
              timestamp: timestamp,
              ...calculatePeriodStats(results),
            }),
          );
          break;
        case "day":
          startDate = subDays(endDate, 1);
          intervalStart = startOfDay(startDate);
          intervalEnd = endOfDay(endDate);
          const dayResults = await prisma.monitoringResult.findMany({
            where: {
              websiteId,
              checkedAt: { gte: intervalStart, lte: intervalEnd },
            },
            orderBy: { checkedAt: "asc" },
          });

          const intervalMinutesDay = 30;
          const intervalsDay = new Map<number, MonitoringResultPrisma[]>();
          dayResults.forEach((r) => {
            const intervalTimestamp =
              Math.floor(
                getUnixTime(new Date(r.checkedAt)) / (intervalMinutesDay * 60),
              ) *
              (intervalMinutesDay * 60);
            if (!intervalsDay.has(intervalTimestamp))
              intervalsDay.set(intervalTimestamp, []);
            intervalsDay.get(intervalTimestamp)?.push(r);
          });
          chartData = Array.from(intervalsDay.entries()).map(
            ([timestamp, results]) => ({
              label: format(new Date(timestamp * 1000), "HH:mm"),
              timestamp: timestamp,
              ...calculatePeriodStats(results),
            }),
          );
          break;
        case "week":
        case "month":
          startDate =
            timeframe === "week" ? subDays(endDate, 7) : subMonths(endDate, 1);
          intervalStart = startOfDay(startDate);
          intervalEnd = endOfDay(endDate);
          const daysInPeriod = eachDayOfInterval({
            start: intervalStart,
            end: intervalEnd,
          });
          const periodResultsWkMo = await prisma.monitoringResult.findMany({
            where: {
              websiteId,
              checkedAt: { gte: intervalStart, lte: intervalEnd },
            },
            orderBy: { checkedAt: "asc" },
          });

          const resultsByDay = new Map<string, MonitoringResultPrisma[]>();
          periodResultsWkMo.forEach((r) => {
            const dayKey = format(new Date(r.checkedAt), "yyyy-MM-dd");
            if (!resultsByDay.has(dayKey)) resultsByDay.set(dayKey, []);
            resultsByDay.get(dayKey)?.push(r);
          });
          chartData = daysInPeriod.map((day): ChartDataPoint => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayStart = startOfDay(day);
            const results = resultsByDay.get(dayKey) || [];
            const stats = calculatePeriodStats(results);
            return {
              label: format(dayStart, "MMM d"),
              timestamp: getUnixTime(dayStart),
              ...stats,
            };
          });
          break;
        case "year":
          startDate = subYears(endDate, 1);
          intervalStart = startOfMonth(startDate);
          intervalEnd = endOfDay(endDate);
          const monthsInPeriod = eachMonthOfInterval({
            start: intervalStart,
            end: intervalEnd,
          });
          const yearResults = await prisma.monitoringResult.findMany({
            where: {
              websiteId,
              checkedAt: { gte: intervalStart, lte: intervalEnd },
            },
            orderBy: { checkedAt: "asc" },
          });

          const resultsByMonth = new Map<string, MonitoringResultPrisma[]>();
          yearResults.forEach((r) => {
            const monthKey = format(new Date(r.checkedAt), "yyyy-MM");
            if (!resultsByMonth.has(monthKey)) resultsByMonth.set(monthKey, []);
            resultsByMonth.get(monthKey)?.push(r);
          });
          chartData = monthsInPeriod.map((monthDate): ChartDataPoint => {
            const monthKey = format(monthDate, "yyyy-MM");
            const monthStart = startOfMonth(monthDate);
            const results = resultsByMonth.get(monthKey) || [];
            const stats = calculatePeriodStats(results);
            return {
              label: format(monthStart, "MMM yyyy"),
              timestamp: getUnixTime(monthStart),
              ...stats,
            };
          });
          break;
        default:
          console.warn(
            `[StatsCalculator] Unsupported timeframe for chart data: ${timeframe}. Defaulting to 'week'.`,
          );
          return this.getChartDataForWebsite(websiteId, "week");
      }
      chartData.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error(
        `[StatsCalculator] Error generating chart data for website ${websiteId}, timeframe ${timeframe}:`,
        error,
      );
      return [];
    }
    return chartData;
  }
}