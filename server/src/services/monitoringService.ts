// server/src/services/monitoringService.ts
import axios from 'axios';
import { performance } from 'perf_hooks';
import {
    PrismaClient, // Keep PrismaClient import
    Website as PrismaWebsite, // Use Prisma type internally, alias for clarity
    MonitoringResult as PrismaMonitoringResult, // Use Prisma type internally
    WebsiteUser as PrismaWebsiteUser, // Use Prisma type internally
    Prisma // Keep Prisma namespace import
} from '@prisma/client';
import { TIMEOUT_MS } from '../config/config';
import { processAlerts } from './alertService'; // Assuming this uses Prisma types
import prisma from '../prisma/prismaClient';
import {
    subHours, subDays, subMonths, subYears,
    startOfDay, endOfDay, startOfMonth, endOfMonth,
    eachDayOfInterval, eachMonthOfInterval, format, getUnixTime
} from 'date-fns';

// --- Import SHARED Types ---
// Adjust path/scope as needed (e.g., '@shared/types')
import {
    MonitoringResponse, // Specific to this service's check result
    ResultsQueryOptions,
    WebsiteStatsData,
    OverallStats, // Use shared OverallStats for return type
    TimeframeKey,
    ChartDataPoint,
    MonitoringResult // Use shared MonitoringResult definition for comparison/mapping if needed
} from '../types'; // Adjust path/scope as needed

// --- WebsiteMonitor Class ---
// Uses Prisma types internally
export class WebsiteMonitor {
  /**
   * Performs the actual HTTP request to check a website's status
   */
  static async performWebsiteCheck(url: string): Promise<MonitoringResponse> { // Returns internal MonitoringResponse type
    const start = performance.now();
    let responseTime: number | null = null;
    let isAvailable = false;
    let statusCode: number | null = null;
    let errorMessage: string | null = null;

    try {
      const response = await axios.get(url, {
        timeout: TIMEOUT_MS,
        headers: { 'User-Agent': 'Website-Monitor/1.0' },
        validateStatus: () => true, // Validate all status codes to get the actual code
      });
      responseTime = Math.round(performance.now() - start);
      statusCode = response.status;
      isAvailable = statusCode >= 200 && statusCode < 400; // Consider 2xx/3xx as available
    } catch (error: any) {
      responseTime = Math.round(performance.now() - start); // Still record time taken
      errorMessage = this.parseErrorMessage(error);
      // Attempt to get status code even from error response if available
      if (axios.isAxiosError(error) && error.response) {
        statusCode = error.response.status;
      }
      isAvailable = false; // Explicitly set to false on error
    }
    return { responseTime, isAvailable, statusCode, errorMessage };
  }

  /**
   * Parses common axios error types into a readable string.
   */
  private static parseErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // Include status code in the error message from response
        return `HTTP Error: ${error.response.status}`;
      } else if (error.request) {
        // Request was made but no response received
        if (error.code === 'ECONNABORTED') {
          return `Request timed out after ${TIMEOUT_MS}ms`;
        }
        return 'No response received from server';
      } else {
        // Something happened in setting up the request that triggered an Error
        return error.message || 'Request setup error';
      }
    }
    // Fallback for non-axios errors
    return error.message || 'Unknown check error';
  }

  /**
   * Checks a single website, records the result, and triggers alerts.
   * Returns the newly created PrismaMonitoringResult.
   */
  // Expects Prisma types from the DB query
  // --- MODIFIED SIGNATURE ---
  static async checkWebsite(website: PrismaWebsite): Promise<PrismaMonitoringResult> {
    console.log(`[checkWebsite] Starting check for: ${website.url} (ID: ${website.id})`);
    let savedResult: PrismaMonitoringResult; // Variable to hold the result

    try {
      const checkResponse = await this.performWebsiteCheck(website.url);

      // Save the result using the ResultsManager
      // saveResult should ideally return the created PrismaMonitoringResult
      savedResult = await ResultsManager.saveResult(website.id, checkResponse);
      console.log(`[checkWebsite] Result saved for ${website.url}, Result ID: ${savedResult.id}`);

      // Fetch users associated with alerts *after* saving the result
      const websiteUsers = await prisma.websiteUser.findMany({
        where: { websiteId: website.id, alertEnabled: true }
      });

      // Process alerts for each relevant user
      // Pass the saved result's data (or the original checkResponse)
      for (const websiteUser of websiteUsers) {
        console.log(`[checkWebsite] Processing alerts for user ${websiteUser.userId}, website ${website.id}`);
        await processAlerts(
          website,
          websiteUser,
          savedResult.isAvailable, // Use data from saved result
          savedResult.responseTime,
          savedResult.statusCode,
          savedResult.errorMessage
        );
      }

      // --- MODIFIED: RETURN THE SAVED RESULT ---
      return savedResult;

    } catch (error: any) {
      console.error(`[checkWebsite] Failed to process monitoring for ${website.url}:`, error.message || error);
      // Re-throw the error so the calling controller knows something went wrong
      // The controller's catch block will handle the final response
      throw error;
    }
  }

  /**
   * Get all active websites that need checking
   */
   // Returns Prisma type array
  static async getWebsitesToCheck(): Promise<PrismaWebsite[]> {
    return prisma.website.findMany({ where: { isActive: true } });
  }
} // End of WebsiteMonitor Class

// --- ResultsManager Class ---
// Methods generally return Prisma types as they interact directly with the DB
export class ResultsManager {
  /**
   * Saves the monitoring result to the database within a transaction.
   * Returns the created PrismaMonitoringResult.
   */
   // Returns Prisma type
  static async saveResult(
    websiteId: number,
    result: MonitoringResponse // Expects internal MonitoringResponse type
  ): Promise<PrismaMonitoringResult> { // Ensure return type matches
    const { responseTime, isAvailable, statusCode, errorMessage } = result;
    // Use transaction to update lastChecked and create result atomically
    return prisma.$transaction(async (tx) => {
      // 1. Update the website's lastChecked timestamp
      await tx.website.update({
        where: { id: websiteId },
        data: { lastChecked: new Date() },
      });

      // 2. Create the monitoring result record
      const monitoringResult = await tx.monitoringResult.create({
        data: {
            websiteId: websiteId, // Ensure relation is set via ID
            responseTime: responseTime,
            isAvailable: isAvailable,
            statusCode: statusCode,
            errorMessage: errorMessage
        },
      });
       console.log(`[saveResult] Saved result ID: ${monitoringResult.id} for website ID: ${websiteId}`);
      // 3. Return the created result
      return monitoringResult;
    });
  }

  /**
   * Gets the latest monitoring result ID for a website
   */
  static async getLatestResultId(websiteId: number): Promise<number> {
    const result = await prisma.monitoringResult.findFirst({
      where: { websiteId }, orderBy: { checkedAt: 'desc' }, select: { id: true },
    });
    return result?.id || 0;
  }

  /**
   * Gets monitoring results for a specific website
   */
   // Returns Prisma type array
  static async getResultsForWebsite(websiteId: number, limit = 100): Promise<PrismaMonitoringResult[]> {
    return prisma.monitoringResult.findMany({
      where: { websiteId }, orderBy: { checkedAt: 'desc' }, take: limit,
    });
  }

  /**
   * Get all monitoring results with optional filtering
   * Returns Prisma types with relations - Controller may need to map this later
   */
  static async getAllResults(options: ResultsQueryOptions = {}): Promise<any[]> { // Use any[] if relations make type complex
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
      include: { website: { select: { url: true } } } // Example relation
    });
  }

  /**
   * Get monitoring results for a specific website with filtering
   */
   // Returns Prisma type array
  static async getFilteredResultsByWebsite(
    websiteId: number,
    options: ResultsQueryOptions = {}
  ): Promise<PrismaMonitoringResult[]> {
    const { limit = 100, from, to } = options;
    const whereClause: Prisma.MonitoringResultWhereInput = { websiteId };
    if (from || to) {
      whereClause.checkedAt = {};
      if (from) whereClause.checkedAt.gte = from;
      if (to) whereClause.checkedAt.lte = to;
    }
    return prisma.monitoringResult.findMany({
      where: whereClause,
      orderBy: { checkedAt: 'desc' },
      take: limit
    });
  }

  /**
   * Get monitoring results for a user's websites
   * Returns Prisma types with relations - Controller may need to map this later
   */
   // Returns Prisma type array potentially with relations
  static async getResultsForUser(
    userId: number,
    options: ResultsQueryOptions = {}
  ): Promise<PrismaMonitoringResult[]> { // Type annotation might need adjustment based on include
    const { limit = 100, from, to } = options;
    const whereClause: Prisma.MonitoringResultWhereInput = {
      website: { websiteUsers: { some: { userId } } }
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
      include: { // Example relation
        website: { include: { websiteUsers: { where: { userId }, select: { name: true } } } }
      }
    });
  }
} // End of ResultsManager Class


// --- StatsCalculator Class ---
// This class calculates stats and formats data matching SHARED types where needed for API responses.
export class StatsCalculator {

    /**
     * Calculate uptime percentage between two dates. Returns number.
     */
    static async calculateUptimeBetweenDates(websiteId: number, startDate: Date, endDate: Date = new Date()): Promise<number> {
        const totalChecks = await prisma.monitoringResult.count({
            where: { websiteId, checkedAt: { gte: startDate, lte: endDate } },
        });
        if (totalChecks === 0) return 100; // Assume 100% if no checks (no failures)
        const successfulChecks = await prisma.monitoringResult.count({
            where: { websiteId, checkedAt: { gte: startDate, lte: endDate }, isAvailable: true },
        });
        const uptimePercentage = (successfulChecks / totalChecks) * 100;
        return parseFloat(uptimePercentage.toFixed(2)); // Return rounded number
    }

     /**
     * Get average response time between two dates. Returns number | null.
     */
    // UPDATED return type
    static async getAverageResponseTimeBetweenDates(websiteId: number, startDate: Date, endDate: Date = new Date()): Promise<number | null> {
        const result = await prisma.monitoringResult.aggregate({
            where: {
                websiteId,
                checkedAt: { gte: startDate, lte: endDate },
                isAvailable: true,
                responseTime: { not: null } // Exclude nulls from average
            },
            _avg: { responseTime: true }
        });
        // Return rounded average or null if no valid points found
        return result._avg.responseTime ? Math.round(result._avg.responseTime) : null;
    }

    /**
     * Get consecutive failures for a website. Returns number.
     */
    static async getConsecutiveFailures(websiteId: number): Promise<number> {
        const results = await prisma.monitoringResult.findMany({
            where: { websiteId }, orderBy: { checkedAt: 'desc' }, take: 100, select: { isAvailable: true }
        });
        let count = 0;
        for (const result of results) {
            if (!result.isAvailable) count++; else break;
        }
        return count;
    }

    /**
     * Convert period string to days. Returns number.
     */
    private static periodToDays(period: TimeframeKey | string): number { // Use TimeframeKey
        if (typeof period !== 'string') return 7;
        const value = parseInt(period);
        if (isNaN(value)) { // Handle cases like 'week', 'month' etc.
            switch(period) {
                case 'hour': return 1/24;
                case 'day': return 1;
                case 'week': return 7;
                case 'month': return 30;
                case 'year': return 365;
                default: return 7;
            }
        }
        // Assume numeric string is days if no unit, otherwise default
        return value > 0 ? value : 7;
    }

    /**
     * Get detailed stats for a specific website.
     * Returns data structure matching the SHARED WebsiteStatsData type.
     */
    static async getWebsiteStats(
        websiteId: number,
        userId?: number,
        period: TimeframeKey | string = 'week'
    ): Promise<WebsiteStatsData> { // Return shared type
        const days = this.periodToDays(period);
        // Use precise start date for calculations
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Fetch Prisma types
        const website = await prisma.website.findUnique({ where: { id: websiteId } });
        if (!website) throw new Error(`Website with ID ${websiteId} not found`);

        let websiteName = website.url; // Default name is URL
        if (userId) {
            const userWebsite = await prisma.websiteUser.findUnique({
                where: { userId_websiteId: { userId, websiteId } }
            });
            // Use user's custom name if available AND not empty string
            if (userWebsite?.name) websiteName = userWebsite.name;
        }

        const [uptime, averageResponseTime, lastResultData, consecutiveFailures, totalChecks] = await Promise.all([
            this.calculateUptimeBetweenDates(websiteId, startDate), // Use date range
            this.getAverageResponseTimeBetweenDates(websiteId, startDate), // Use date range (returns number | null)
            prisma.monitoringResult.findFirst({ where: { websiteId }, orderBy: { checkedAt: 'desc' } }), // Returns PrismaMonitoringResult | null
            this.getConsecutiveFailures(websiteId),
            prisma.monitoringResult.count({ where: { websiteId, checkedAt: { gte: startDate } } })
        ]);

        // Construct object matching shared WebsiteStatsData
        return {
            websiteId,
            websiteName,
            url: website.url,
            uptime, // Already a number %
            averageResponseTime: averageResponseTime, // number | null matches expected type
            totalChecks,
            // Convert Date to ISO string or null for shared type
            lastCheck: lastResultData?.checkedAt ? lastResultData.checkedAt.toISOString() : null,
            consecutiveFailures
        };
    }

    /**
     * Get overview statistics for all websites or a user's websites.
     * Returns data structure matching the SHARED OverallStats type.
     */
    static async getOverallStats(
        userId?: number,
        period: TimeframeKey | string = 'week'
    ): Promise<OverallStats> { // Return shared type
        const days = this.periodToDays(period);
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const websiteWhere: Prisma.WebsiteWhereInput = userId ? { websiteUsers: { some: { userId } } } : {};

        const totalWebsites = await prisma.website.count({ where: websiteWhere });
        // Correctly calculate active websites based on the filter
        const activeWebsites = await prisma.website.count({ where: { ...websiteWhere, isActive: true } });

        // Fetch only active websites to calculate stats for
        const activeWebsitesList = await prisma.website.findMany({ where: { ...websiteWhere, isActive: true } });

        // Get stats for each *active* website
        const websiteStatsPromises = activeWebsitesList.map(website =>
            this.getWebsiteStats(website.id, userId, period) // This now returns WebsiteStatsData
        );
        const websiteStats: WebsiteStatsData[] = await Promise.all(websiteStatsPromises);

        // Calculate overall metrics based ONLY on websites with checks in the period
        const validUptimeStats = websiteStats.filter(stat => stat.totalChecks > 0);
        const overallUptime = validUptimeStats.length > 0
            ? validUptimeStats.reduce((sum, stat) => sum + stat.uptime, 0) / validUptimeStats.length
            : 100; // Default to 100% if no checks means no failures

        // Calculate overall avg response time based ONLY on websites with valid avg times
        const validResponseStats = websiteStats.filter(stat => stat.averageResponseTime !== null && stat.averageResponseTime > 0);
         const overallResponseTime = validResponseStats.length > 0
            ? Math.round(validResponseStats.reduce((sum, stat) => sum + stat.averageResponseTime!, 0) / validResponseStats.length) // Use non-null assertion
            : null; // Return null if no valid avg times

        // Construct object matching shared OverallStats
        return {
            totalWebsites,
            activeWebsites, // Include the calculated active count
            websiteStats, // Already WebsiteStatsData[]
            overallUptime: parseFloat(overallUptime.toFixed(2)),
            overallResponseTime // number | null matches expected type
        };
    }

    /**
     * Get stats for a specific user's dashboard.
     * Returns data structure matching the SHARED OverallStats type.
     */
    static async getUserDashboardStats(
        userId: number,
        period: TimeframeKey | string = 'week'
    ): Promise<OverallStats> { // Return shared type
        // Call the general method which correctly calculates and returns OverallStats
        const stats = await this.getOverallStats(userId, period);
        return stats; // Return the full object
    }

    /**
     * Get data formatted for charts.
     * Returns array matching the SHARED ChartDataPoint type.
     */
   static async getChartDataForWebsite(
        websiteId: number,
        timeframe: TimeframeKey
    ): Promise<ChartDataPoint[]> { // Return shared type

        const endDate = new Date();
        let chartData: ChartDataPoint[] = [];
        let startDate: Date; // Define startDate within the switch

        switch (timeframe) {
            case 'hour': {
                startDate = subHours(endDate, 1);
                const rawResults = await prisma.monitoringResult.findMany({
                    where: { websiteId, checkedAt: { gte: startDate, lte: endDate } },
                    orderBy: { checkedAt: 'asc' }, take: 1000, // Adjust take limit if needed
                });
                chartData = rawResults.map(r => ({
                    label: format(new Date(r.checkedAt), 'HH:mm'),
                    timestamp: getUnixTime(new Date(r.checkedAt)),
                    avgResponseTime: r.isAvailable ? r.responseTime : null,
                    uptimeRatio: r.isAvailable ? 1.0 : 0.0,
                    checkCount: 1,
                }));
                break;
            }
            case 'day': {
                startDate = subDays(endDate, 1);
                const rawResults = await prisma.monitoringResult.findMany({
                    where: { websiteId, checkedAt: { gte: startDate, lte: endDate } },
                    orderBy: { checkedAt: 'asc' }, take: 1000, // Adjust take limit if needed
                });
                 // Limit points for better chart rendering if too many results
                const limitedResults = rawResults.length > 96 ? rawResults.slice(-96) : rawResults; // e.g., Limit to 96 points (every 15 min)
                chartData = limitedResults.map(r => ({
                    label: format(new Date(r.checkedAt), 'HH:mm'),
                    timestamp: getUnixTime(new Date(r.checkedAt)),
                    avgResponseTime: r.isAvailable ? r.responseTime : null,
                    uptimeRatio: r.isAvailable ? 1.0 : 0.0,
                    checkCount: 1,
                }));
                break;
            }
            case 'week': {
                startDate = subDays(endDate, 7);
                const intervalStart = startOfDay(startDate);
                const intervalEnd = endOfDay(endDate);
                const daysInPeriod = eachDayOfInterval({ start: intervalStart, end: intervalEnd });

                const dailyStatsPromises = daysInPeriod.map(async (day): Promise<ChartDataPoint> => {
                    const dayStart = startOfDay(day); const dayEnd = endOfDay(day);
                    // Use number | null for avgResponseTime
                    const avgResponseTime: number | null = await this.getAverageResponseTimeBetweenDates(websiteId, dayStart, dayEnd);
                    const totalChecks = await prisma.monitoringResult.count({ where: { websiteId, checkedAt: { gte: dayStart, lte: dayEnd } } });
                    const successfulChecks = await prisma.monitoringResult.count({ where: { websiteId, checkedAt: { gte: dayStart, lte: dayEnd }, isAvailable: true } });
                    const uptimeRatio = totalChecks > 0 ? successfulChecks / totalChecks : 0;
                    return { label: format(dayStart, 'MMM d'), timestamp: getUnixTime(dayStart), avgResponseTime, uptimeRatio: parseFloat(uptimeRatio.toFixed(4)), checkCount: totalChecks };
                });
                chartData = await Promise.all(dailyStatsPromises);
                break;
            }
            case 'month': {
                startDate = subDays(endDate, 30);
                const intervalStart = startOfDay(startDate); const intervalEnd = endOfDay(endDate);
                const daysInPeriod = eachDayOfInterval({ start: intervalStart, end: intervalEnd });
                const rawResultsForPeriod = await prisma.monitoringResult.findMany({
                     where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } }, orderBy: { checkedAt: 'asc' },
                 });
                const resultsByDay = new Map<string, PrismaMonitoringResult[]>(); // Group Prisma results
                rawResultsForPeriod.forEach(r => {
                    const dayKey = format(new Date(r.checkedAt), 'yyyy-MM-dd');
                    if (!resultsByDay.has(dayKey)) resultsByDay.set(dayKey, []);
                    resultsByDay.get(dayKey)?.push(r);
                });
                chartData = daysInPeriod.map((day): ChartDataPoint => {
                    const dayKey = format(day, 'yyyy-MM-dd'); const dayStart = startOfDay(day);
                    const results = resultsByDay.get(dayKey) || [];
                    const totalChecks = results.length;
                    const successfulChecks = results.filter(r => r.isAvailable).length;
                    const validResponseTimes = results.filter(r => r.isAvailable && r.responseTime !== null).map(r => r.responseTime!);
                    const avgResponseTime = validResponseTimes.length > 0 ? Math.round(validResponseTimes.reduce((s, rt) => s + rt, 0) / validResponseTimes.length) : null;
                    const uptimeRatio = totalChecks > 0 ? successfulChecks / totalChecks : 0;
                    return { label: format(dayStart, 'MMM d'), timestamp: getUnixTime(dayStart), avgResponseTime, uptimeRatio: parseFloat(uptimeRatio.toFixed(4)), checkCount: totalChecks };
                });
                break;
            }
            case 'year': {
                startDate = subYears(endDate, 1);
                const intervalStart = startOfMonth(startDate); const intervalEnd = endOfDay(endDate);
                const monthsInPeriod = eachMonthOfInterval({ start: intervalStart, end: intervalEnd });
                const rawResultsForPeriod = await prisma.monitoringResult.findMany({
                     where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } }, orderBy: { checkedAt: 'asc' },
                 });
                const resultsByMonth = new Map<string, PrismaMonitoringResult[]>(); // Group Prisma results
                 rawResultsForPeriod.forEach(r => {
                    const monthKey = format(new Date(r.checkedAt), 'yyyy-MM');
                    if (!resultsByMonth.has(monthKey)) resultsByMonth.set(monthKey, []);
                    resultsByMonth.get(monthKey)?.push(r);
                 });
                chartData = monthsInPeriod.map((monthDate): ChartDataPoint => {
                    const monthKey = format(monthDate, 'yyyy-MM'); const monthStart = startOfMonth(monthDate);
                    const results = resultsByMonth.get(monthKey) || [];
                    const totalChecks = results.length;
                    const successfulChecks = results.filter(r => r.isAvailable).length;
                    const validResponseTimes = results.filter(r => r.isAvailable && r.responseTime !== null).map(r => r.responseTime!);
                    const avgResponseTime = validResponseTimes.length > 0 ? Math.round(validResponseTimes.reduce((s, rt) => s + rt, 0) / validResponseTimes.length) : null;
                    const uptimeRatio = totalChecks > 0 ? successfulChecks / totalChecks : 0;
                    return { label: format(monthStart, 'MMM yyyy'), timestamp: getUnixTime(monthStart), avgResponseTime, uptimeRatio: parseFloat(uptimeRatio.toFixed(4)), checkCount: totalChecks };
                });
                break;
            }
        }
        // Ensure data is sorted by timestamp regardless of calculation method
        chartData.sort((a, b) => a.timestamp - b.timestamp);
        return chartData; // Returns ChartDataPoint[]
    }

} // End of StatsCalculator Class