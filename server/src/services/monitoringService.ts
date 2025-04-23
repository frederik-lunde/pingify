// server/src/services/monitoringService.ts
import axios, { AxiosError } from 'axios';
import { performance } from 'perf_hooks';
import {
  Website as PrismaWebsite,
  MonitoringResult as PrismaMonitoringResult,
  PrismaClient,
  Prisma,
  Incident as PrismaIncident,
} from '@prisma/client';
//
// Import config
//
import { monitoringConfig } from '../config/config';
import { handleResultProcessing } from './alertService';
import * as IncidentService from './incidentService';
import prisma from '../prisma/prismaClient';
import {
  subHours, subDays, subYears, subMonths,
  startOfDay, endOfDay, startOfMonth, endOfMonth,
  eachDayOfInterval, eachMonthOfInterval, format, getUnixTime,
  sub
} from 'date-fns';

// --- Import SHARED Types ---
import {
  MonitoringResponse,
  ResultsQueryOptions,
  WebsiteStatsData,
  OverallStats,
  TimeframeKey,
  ChartDataPoint,
  Incident,
  IncidentType,
} from '../types';

//
// Use constants from config
//
const REQUEST_TIMEOUT_MS = monitoringConfig.requestTimeoutMs;
const MONITOR_USER_AGENT = monitoringConfig.monitorUserAgent;

// ============================================================================
// WebsiteMonitor Class
// ============================================================================
export class WebsiteMonitor {
  static async performWebsiteCheck(url: string): Promise<MonitoringResponse> {
      const start = performance.now();
      let responseTime: number | null = null;
      let isAvailable = false;
      let statusCode: number | null = null;
      let errorMessage: string | null = null;

      try {
          const response = await axios.get(url, {
              //
              // Use timeout from config
              //
              timeout: REQUEST_TIMEOUT_MS,
              headers: {
                  //
                  // Use user agent from config
                  //
                  'User-Agent': MONITOR_USER_AGENT,
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                  'Accept-Encoding': 'gzip, deflate, br', // Allow compressed responses
              },
              //
              // Don't throw errors for non-2xx/3xx status codes
              //
              validateStatus: () => true,
          });

          responseTime = Math.round(performance.now() - start);
          statusCode = response.status;
          //
          // Consider only 2xx codes as strictly 'available'
          //
          isAvailable = statusCode >= 200 && statusCode < 300;

          if (!isAvailable) {
              errorMessage = `HTTP Status ${statusCode}`;
          }
      } catch (error: unknown) {
          //
          // Ensure responseTime is recorded even on error
          //
          responseTime = Math.round(performance.now() - start);
          isAvailable = false;
          if (axios.isAxiosError(error)) {
              statusCode = error.response?.status ?? null;
              errorMessage = this.parseAxiosErrorMessage(error);
          } else if (error instanceof Error) {
              errorMessage = error.message;
          } else {
              errorMessage = 'Unknown error occurred during check.';
          }
          console.error(`[Check Error] ${url}: ${errorMessage} (Status: ${statusCode ?? 'N/A'})`);
      }

      return { responseTime, isAvailable, statusCode, errorMessage };
  }

  private static parseAxiosErrorMessage(error: AxiosError): string {
      if (error.response) {
          //
          // Error received a response from the server (e.g., 4xx, 5xx)
          //
          return `HTTP Error ${error.response.status}`;
      } else if (error.request) {
          //
          // Error made a request but received no response (network issues, timeout)
          //
          //
          // Use timeout from config in error message
          //
          if (error.code === 'ECONNABORTED') return `Request timed out (${REQUEST_TIMEOUT_MS}ms)`;
          if (error.code === 'ENOTFOUND') return 'DNS lookup failed (domain not found)';
          if (error.code === 'ECONNREFUSED') return 'Connection refused by server';
          if (error.code === 'ETIMEDOUT') return 'Connection timed out'; // Network level timeout
          if (error.code === 'EHOSTUNREACH') return 'No route to host';
          if (error.code === 'ECONNRESET') return 'Connection reset by peer';
          // Add more specific codes if needed
          return 'No response received from server';
      } else {
          //
          // Error occurred setting up the request
          //
          return `Request setup error: ${error.message}`;
      }
  }


  /**
   * Performs a check, saves the result, and triggers incident/recovery processing.
   */
  static async checkWebsite(website: PrismaWebsite): Promise<PrismaMonitoringResult> {
      const logPrefix = `[Monitor W:${website.id} ${website.url}]`;
      console.log(`${logPrefix} Starting check.`);
      let savedResult: PrismaMonitoringResult | null = null;

      try {
          const checkResultData = await this.performWebsiteCheck(website.url);

          //
          // Save the result first (includes updating lastChecked)
          //
          savedResult = await ResultsManager.saveResult(website.id, checkResultData);
          console.log(`${logPrefix} Result saved (ID: ${savedResult.id}): Avail=${savedResult.isAvailable}, RT=${savedResult.responseTime}ms, Status=${savedResult.statusCode}, Err=${savedResult.errorMessage ?? 'None'}`);

          // --- Process the result for incidents/recoveries ---
          if (savedResult) {
              //
              // Call the central processing function from AlertService (which now handles incidents too)
              // Run this asynchronously (don't wait for it) but catch errors
              //
              handleResultProcessing(website, savedResult).catch(procError => {
                  console.error(`${logPrefix} Error during post-check result processing for R:${savedResult?.id}:`, procError);
              });
          } else {
              // This case should ideally not happen if saveResult throws on failure
              console.error(`${logPrefix} Saved result was unexpectedly null after save attempt.`);
              throw new Error("Failed to obtain saved result after check.");
          }

          return savedResult; // Return the saved result immediately

      } catch (error: any) {
          console.error(`${logPrefix} Critical failure during checkWebsite process: ${error.message}`, error.stack);
          //
          // Attempt to update lastChecked even on error, but only if saveResult failed before updating
          //
          try {
              if (!savedResult) {
                  await prisma.website.update({
                      where: { id: website.id },
                      data: { lastChecked: new Date() }
                  });
                   console.warn(`${logPrefix} Updated lastChecked after error during check/processing.`);
              }
          } catch (updateError) {
               console.error(`${logPrefix} Failed to update lastChecked after error:`, updateError);
          }
          throw error; // Re-throw the original error
      }
  }
}

// ============================================================================
// ResultsManager Class
// ============================================================================
export class ResultsManager {
  /**
   * Saves a monitoring result and updates the website's lastChecked timestamp in a transaction.
   */
  static async saveResult( websiteId: number, result: MonitoringResponse ): Promise<PrismaMonitoringResult> {
    const { responseTime, isAvailable, statusCode, errorMessage } = result;
    const checkedAt = new Date(); // Use a single timestamp for consistency

    try {
      const savedMonitoringResult = await prisma.$transaction(async (tx) => {
        //
        // Update lastChecked on the website
        //
        await tx.website.update({
          where: { id: websiteId },
          data: { lastChecked: checkedAt },
        });

        //
        // Create the monitoring result record
        //
        const monitoringResult = await tx.monitoringResult.create({
          data: {
            websiteId,
            responseTime,
            isAvailable,
            statusCode,
            errorMessage,
            checkedAt, // Use the consistent timestamp
          },
        });
        return monitoringResult;
      });

      return savedMonitoringResult;
    } catch (error) {
      console.error(`[ResultsManager] Error saving result for website ${websiteId}:`, error);
      throw error; // Re-throw to be handled by the caller (checkWebsite)
    }
  }

  /**
   * Gets the ID of the most recent monitoring result for a website.
   */
  static async getLatestResultId(websiteId: number): Promise<number> {
      const result = await prisma.monitoringResult.findFirst({
          where: { websiteId }, orderBy: { checkedAt: 'desc' }, select: { id: true },
      });
      return result?.id || 0; // Return 0 if no results found
  }

  /**
   * Gets the most recent monitoring results for a specific website.
   */
  static async getResultsForWebsite(websiteId: number, limit = 100): Promise<PrismaMonitoringResult[]> {
      return prisma.monitoringResult.findMany({
          where: { websiteId }, orderBy: { checkedAt: 'desc' }, take: limit,
      });
  }

  /**
   * Gets all monitoring results, optionally filtered by date range. Includes website URL.
   */
  static async getAllResults(options: ResultsQueryOptions = {}): Promise< (PrismaMonitoringResult & { website: { url: string } | null })[] > {
      const { limit = 100, from, to } = options;
      const whereClause: Prisma.MonitoringResultWhereInput = {};
      if (from || to) {
          whereClause.checkedAt = {};
          if (from) whereClause.checkedAt.gte = from;
          if (to) whereClause.checkedAt.lte = to;
      }

      return prisma.monitoringResult.findMany({
          where: whereClause,
          orderBy: { checkedAt: 'desc' },
          take: limit,
          include: { website: { select: { url: true } } } // Include URL for context
      });
  }

  /**
   * Gets monitoring results for a specific website, optionally filtered by date range.
   */
  static async getFilteredResultsByWebsite( websiteId: number, options: ResultsQueryOptions = {} ): Promise<PrismaMonitoringResult[]> {
      const { limit = 100, from, to } = options;
      const whereClause: Prisma.MonitoringResultWhereInput = { websiteId };
      if (from || to) {
          whereClause.checkedAt = {};
          if (from) whereClause.checkedAt.gte = from;
          if (to) whereClause.checkedAt.lte = to;
      }

      return prisma.monitoringResult.findMany({
          where: whereClause, orderBy: { checkedAt: 'desc' }, take: limit
      });
  }

  /**
   * Gets monitoring results for websites monitored by a specific user, optionally filtered by date range.
   * Includes the user-specific name for the website.
   */
  static async getResultsForUser( userId: number, options: ResultsQueryOptions = {} ): Promise< (PrismaMonitoringResult & { website: { websiteUsers: { name: string | null }[] } | null })[] > {
      const { limit = 100, from, to } = options;
      //
      // Filter results where the related website has a WebsiteUser entry for the given userId
      //
      const whereClause: Prisma.MonitoringResultWhereInput = {
          website: {
              websiteUsers: { some: { userId } }
          }
      };

      if (from || to) {
          whereClause.checkedAt = {};
          if (from) whereClause.checkedAt.gte = from;
          if (to) whereClause.checkedAt.lte = to;
      }

      return prisma.monitoringResult.findMany({
          where: whereClause,
          orderBy: { checkedAt: 'desc' },
          take: limit,
          include: {
              website: {
                  include: {
                      //
                      // Include the specific WebsiteUser entry to get the user's custom name
                      //
                      websiteUsers: {
                          where: { userId }, // Filter to only this user's relation
                          select: { name: true } // Select only the name
                      }
                  }
              }
          }
      });
  }
}

// ============================================================================
// StatsCalculator Class
// ============================================================================
export class StatsCalculator {
  /**
   * Calculates uptime percentage between two dates for a website.
   */
  static async calculateUptimeBetweenDates(websiteId: number, startDate: Date, endDate: Date = new Date()): Promise<number> {
      const results = await prisma.monitoringResult.findMany({
          where: {
              websiteId,
              checkedAt: { gte: startDate, lte: endDate }
          },
          select: { isAvailable: true }
      });

      const totalChecks = results.length;
      if (totalChecks === 0) return 100; // Assume 100% if no checks in the period

      const successfulChecks = results.filter(r => r.isAvailable).length;
      const uptimePercentage = (successfulChecks / totalChecks) * 100;

      //
      // Return rounded percentage
      //
      return parseFloat(uptimePercentage.toFixed(2));
  }

  /**
   * Calculates average response time between two dates for available checks.
   */
  static async getAverageResponseTimeBetweenDates(websiteId: number, startDate: Date, endDate: Date = new Date()): Promise<number | null> {
      const result = await prisma.monitoringResult.aggregate({
          _avg: { responseTime: true },
          where: {
              websiteId,
              checkedAt: { gte: startDate, lte: endDate },
              isAvailable: true, // Only average successful checks
              responseTime: { not: null } // Exclude null response times
          },
      });

      //
      // Return rounded average or null
      //
      return result._avg.responseTime !== null ? Math.round(result._avg.responseTime) : null;
  }

  /**
   * Helper to convert timeframe key or string/number to days.
   */
  private static periodToDays(period: TimeframeKey | string | number): number {
      switch (period) {
          case 'hour': return 1 / 24;
          case 'day': return 1;
          case 'week': return 7;
          case 'month': return 30; // Approximation
          case 'year': return 365; // Approximation
      }
      // Handle numeric input
      if (typeof period === 'number') return period > 0 ? period : 7; // Default to 7 if invalid number
      // Handle string number input
      if (typeof period === 'string') {
          const value = parseInt(period);
          if (!isNaN(value) && value > 0) return value;
      }
      return 7; // Default to 'week' (7 days) if invalid input
  }

  /**
   * Calculates statistics for a single website over a given period.
   * Includes uptime, avg response time, and incident counts for the period.
   */
  static async getWebsiteStats( websiteId: number, userId?: number, period: TimeframeKey | string | number = 'week' ): Promise<WebsiteStatsData> {
      const days = this.periodToDays(period);
      const startDate = sub(new Date(), { days: days });
      const endDate = new Date();

      const website = await prisma.website.findUnique({
          where: { id: websiteId },
          select: { url: true }
      });
      if (!website) throw new Error(`Website with ID ${websiteId} not found`);

      //
      // Determine the display name (user's custom name or URL)
      //
      let websiteName = website.url;
      if (userId) {
          const userWebsite = await prisma.websiteUser.findUnique({
              where: { userId_websiteId: { userId, websiteId } }, select: { name: true }
          });
          if (userWebsite?.name) websiteName = userWebsite.name;
      }

      //
      // Fetch stats based on MonitoringResult within the period
      //
      const [ uptime, averageResponseTime, totalChecks, lastResultData ] = await Promise.all([
          this.calculateUptimeBetweenDates(websiteId, startDate, endDate),
          this.getAverageResponseTimeBetweenDates(websiteId, startDate, endDate),
          prisma.monitoringResult.count({ where: { websiteId, checkedAt: { gte: startDate, lte: endDate } } }),
          prisma.monitoringResult.findFirst({ where: { websiteId }, orderBy: { checkedAt: 'desc' }, select: { checkedAt: true } })
      ]);

      //
      // Fetch incident counts where startTime falls within the period
      //
      const incidentCounts = await prisma.incident.groupBy({
          by: ['type'],
          where: {
              websiteId: websiteId,
              startTime: { gte: startDate, lte: endDate } // Incident started within the period
          },
          _count: { type: true }
      });

      let totalIncidentCount = 0;
      let downIncidentCount = 0;
      let slowIncidentCount = 0;
      incidentCounts.forEach(group => {
          const count = group._count.type;
          totalIncidentCount += count;
          if (group.type === 'down') downIncidentCount = count;
          else if (group.type === 'slow') slowIncidentCount = count;
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
          downIncidentCount: downIncidentCount,
          slowIncidentCount: slowIncidentCount,
      };
  }

  /**
   * Calculates overall stats for all websites or only those monitored by a user.
   * Returns the SHARED OverallStats type.
   * Uses Incident table for incident-related stats (last 24h count, most recent).
   */
  static async getOverallStats( userId?: number, period: TimeframeKey | string | number = 'week' ): Promise<OverallStats> {
      const days = this.periodToDays(period);
      //
      // Start date for calculating uptime/avg response time over the selected period
      //
      const periodStartDate = sub(new Date(), { days });
      //
      // Separate date for counting incidents in the last 24 hours specifically
      //
      const twentyFourHoursAgo = sub(new Date(), { hours: 24 });

      //
      // Base filter for websites (all or user-specific)
      //
      const websiteWhere: Prisma.WebsiteWhereInput = userId ? { websiteUsers: { some: { userId } } } : {};

      const [totalWebsites, activeWebsitesCount] = await Promise.all([
          prisma.website.count({ where: websiteWhere }),
          prisma.website.count({ where: { ...websiteWhere, isActive: true } })
      ]);

      //
      // Get IDs of active websites relevant to the query
      //
      const activeWebsitesList = await prisma.website.findMany({
          where: { ...websiteWhere, isActive: true },
          select: { id: true }
      });
      const activeWebsiteIds = activeWebsitesList.map(w => w.id);

      // --- Calculate Overall Uptime/Response Time (using the selected period) ---
      const websiteStatsPromises = activeWebsiteIds.map(websiteId =>
          //
          // Get individual website stats over the specified period
          //
          this.getWebsiteStats(websiteId, userId, period)
      );
      const websiteStats = await Promise.all(websiteStatsPromises);

      //
      // Calculate overall uptime average (only for sites with checks in the period)
      //
      const validUptimeStats = websiteStats.filter(stat => stat.totalChecks > 0);
      const overallUptime = validUptimeStats.length > 0
          ? validUptimeStats.reduce((sum, stat) => sum + stat.uptime, 0) / validUptimeStats.length
          : 100; // Default to 100% if no data

      //
      // Calculate overall response time average (only for sites with valid avg times)
      //
      const validResponseStats = websiteStats.filter(stat => stat.averageResponseTime !== null);
      const overallResponseTime = validResponseStats.length > 0
          ? Math.round(validResponseStats.reduce((sum, stat) => sum + stat.averageResponseTime!, 0) / validResponseStats.length)
          : null; // Null if no valid data

      // --- Calculate Incidents Data (using Incident table) ---
      let incidentsLast24h = 0;
      let lastIncident: PrismaIncident | null = null;

      if (activeWebsiteIds.length > 0) {
          //
          // Count incidents started in the last 24 hours for the relevant websites
          //
          incidentsLast24h = await IncidentService.countIncidents({
              from: twentyFourHoursAgo, // Use 24-hour mark specifically for this count
              //
              // Filter by user's websites if userId is provided
              //
              ...(userId && { userId: userId }),
          });

          //
          // Find the most recent incident overall (or for the user) regardless of timeframe
          //
          lastIncident = await IncidentService.getMostRecentIncident(userId);
      }

      // --- Return OverallStats Object ---
      return {
          totalWebsites,
          activeWebsites: activeWebsitesCount,
          //
          // Individual stats calculated over the 'period'
          //
          websiteStats,
          overallUptime: parseFloat(overallUptime.toFixed(2)),
          overallResponseTime,
          //
          // Count from Incident table (specifically last 24h)
          //
          incidentsLast24h,
          lastIncidentTimestamp: lastIncident ? lastIncident.startTime.toISOString() : null,
          lastIncidentWebsiteId: lastIncident ? lastIncident.websiteId : null,
      };
  }

  /**
   * Convenience method to get stats specifically for a user's dashboard.
   */
  static async getUserDashboardStats( userId: number, period: TimeframeKey | string | number = 'week' ): Promise<OverallStats> {
      return this.getOverallStats(userId, period);
  }

  /**
   * Generates aggregated chart data points for a website over a specific timeframe.
   */
  static async getChartDataForWebsite( websiteId: number, timeframe: TimeframeKey ): Promise<ChartDataPoint[]> {
      const endDate = new Date();
      let chartData: ChartDataPoint[] = [];
      let startDate: Date;
      let intervalStart: Date, intervalEnd: Date;

      //
      // Helper to calculate stats for a group of results within a time interval
      //
      const calculatePeriodStats = (resultsInPeriod: PrismaMonitoringResult[]): { avgResponseTime: number | null, uptimeRatio: number, checkCount: number } => {
          const totalChecks = resultsInPeriod.length;
          if (totalChecks === 0) return { avgResponseTime: null, uptimeRatio: 1.0, checkCount: 0 }; // Default to 100% uptime if no checks

          const successfulChecks = resultsInPeriod.filter(r => r.isAvailable).length;
          const validResponseTimes = resultsInPeriod
              .filter(r => r.isAvailable && r.responseTime !== null)
              .map(r => r.responseTime!);

          const avgResponseTime = validResponseTimes.length > 0
              ? Math.round(validResponseTimes.reduce((s, rt) => s + rt, 0) / validResponseTimes.length)
              : null;

          const uptimeRatio = successfulChecks / totalChecks;
          return { avgResponseTime, uptimeRatio: parseFloat(uptimeRatio.toFixed(4)), checkCount: totalChecks };
      };

      switch (timeframe) {
          case 'hour':
              //
              // For 'hour', return individual results (up to a limit)
              //
              startDate = subHours(endDate, 1);
              const hourResults = await prisma.monitoringResult.findMany({
                  where: { websiteId, checkedAt: { gte: startDate, lte: endDate } },
                  orderBy: { checkedAt: 'asc' },
                  take: 200 // Limit raw results for performance
              });
              chartData = hourResults.map(r => ({
                  label: format(new Date(r.checkedAt), 'HH:mm'),
                  timestamp: getUnixTime(new Date(r.checkedAt)),
                  avgResponseTime: r.isAvailable ? r.responseTime : null, // Null RT if down
                  uptimeRatio: r.isAvailable ? 1.0 : 0.0, // 1 or 0 for individual checks
                  checkCount: 1
              }));
              break;

          case 'day':
              //
              // Aggregate results into 30-minute intervals for the last 24 hours
              //
              startDate = subDays(endDate, 1);
              intervalStart = startOfDay(startDate); // Start from beginning of yesterday for full day context
              intervalEnd = endOfDay(endDate); // End at end of today
              const dayResults = await prisma.monitoringResult.findMany({
                  where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } },
                  orderBy: { checkedAt: 'asc' }
              });

              const intervalMinutesDay = 30;
              const intervalsDay = new Map<number, PrismaMonitoringResult[]>();
              dayResults.forEach(r => {
                  // Group results by the start timestamp of their 30-min interval
                  const intervalTimestamp = Math.floor(getUnixTime(new Date(r.checkedAt)) / (intervalMinutesDay * 60)) * (intervalMinutesDay * 60);
                  if (!intervalsDay.has(intervalTimestamp)) intervalsDay.set(intervalTimestamp, []);
                  intervalsDay.get(intervalTimestamp)?.push(r);
              });

              chartData = Array.from(intervalsDay.entries()).map(([timestamp, results]) => {
                  const stats = calculatePeriodStats(results);
                  return {
                      label: format(new Date(timestamp * 1000), 'HH:mm'), // Label with interval start time
                      timestamp: timestamp,
                      ...stats
                  };
              });
              break;

          case 'week':
          case 'month':
              //
              // Aggregate results by day for the last week or month
              //
              startDate = (timeframe === 'week') ? subDays(endDate, 7) : subMonths(endDate, 1);
              intervalStart = startOfDay(startDate); // Align to start of the day
              intervalEnd = endOfDay(endDate); // Align to end of the day

              const daysInPeriod = eachDayOfInterval({ start: intervalStart, end: intervalEnd });

              const periodResultsWkMo = await prisma.monitoringResult.findMany({
                  where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } },
                  orderBy: { checkedAt: 'asc' }
              });

              //
              // Group results by day (YYYY-MM-DD)
              //
              const resultsByDay = new Map<string, PrismaMonitoringResult[]>();
              periodResultsWkMo.forEach(r => {
                  const dayKey = format(new Date(r.checkedAt), 'yyyy-MM-dd');
                  if (!resultsByDay.has(dayKey)) resultsByDay.set(dayKey, []);
                  resultsByDay.get(dayKey)?.push(r);
              });

              //
              // Create a data point for each day in the interval
              //
              chartData = daysInPeriod.map((day): ChartDataPoint => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const dayStart = startOfDay(day); // Timestamp represents start of the day
                  const results = resultsByDay.get(dayKey) || []; // Get results for this day
                  const stats = calculatePeriodStats(results);
                  return {
                      label: format(dayStart, 'MMM d'), // Label like 'Jan 15'
                      timestamp: getUnixTime(dayStart),
                      ...stats
                  };
              });
              break;

          case 'year':
              //
              // Aggregate results by month for the last year
              //
              startDate = subYears(endDate, 1);
              intervalStart = startOfMonth(startDate); // Align to start of the month
              intervalEnd = endOfDay(endDate); // Align to end of today

              const monthsInPeriod = eachMonthOfInterval({ start: intervalStart, end: intervalEnd });

              const yearResults = await prisma.monitoringResult.findMany({
                  where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } },
                  orderBy: { checkedAt: 'asc' }
              });

              //
              // Group results by month (YYYY-MM)
              //
              const resultsByMonth = new Map<string, PrismaMonitoringResult[]>();
              yearResults.forEach(r => {
                  const monthKey = format(new Date(r.checkedAt), 'yyyy-MM');
                  if (!resultsByMonth.has(monthKey)) resultsByMonth.set(monthKey, []);
                  resultsByMonth.get(monthKey)?.push(r);
              });

              //
              // Create a data point for each month in the interval
              //
              chartData = monthsInPeriod.map((monthDate): ChartDataPoint => {
                  const monthKey = format(monthDate, 'yyyy-MM');
                  const monthStart = startOfMonth(monthDate); // Timestamp represents start of the month
                  const results = resultsByMonth.get(monthKey) || []; // Get results for this month
                  const stats = calculatePeriodStats(results);
                  return {
                      label: format(monthStart, 'MMM yyyy'), // Label like 'Jan 2023'
                      timestamp: getUnixTime(monthStart),
                      ...stats
                  };
              });
              break;

          default:
              console.warn(`[StatsCalculator] Unsupported timeframe for chart data: ${timeframe}. Defaulting to 'week'.`);
              //
              // Fallback to 'week' if timeframe is invalid
              //
              return this.getChartDataForWebsite(websiteId, 'week');
      }

      //
      // Ensure data is sorted by timestamp before returning
      //
      chartData.sort((a, b) => a.timestamp - b.timestamp);
      return chartData;
  }
} // End StatsCalculator Class