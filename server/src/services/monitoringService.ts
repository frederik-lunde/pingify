// server/src/services/monitoringService.ts
import axios, { AxiosError } from 'axios';
import { performance } from 'perf_hooks';
import {
    Website as PrismaWebsite,
    MonitoringResult as PrismaMonitoringResult,
    PrismaClient, // Keep if extending PrismaClient directly, otherwise remove
    Prisma // Keep for types like Prisma.SortOrder etc.
} from '@prisma/client';
import { TIMEOUT_MS } from '../config/config'; // Ensure TIMEOUT_MS is defined in your config
// Import the NEW Alert Service function
import * as AlertService from './alertService'; // Ensure this path is correct
import prisma from '../prisma/prismaClient'; // Ensure this path is correct
import {
    subHours, subDays, subYears, subMonths,
    startOfDay, endOfDay, startOfMonth, endOfMonth,
    eachDayOfInterval, eachMonthOfInterval, format, getUnixTime
} from 'date-fns';

// --- Import SHARED Types ---
import {
    MonitoringResponse,
    ResultsQueryOptions,
    WebsiteStatsData,
    OverallStats,
    TimeframeKey,
    ChartDataPoint,
    MonitoringResult // Use shared MonitoringResult definition for comparison/mapping if needed
} from '../types'; // Adjust path/scope as needed

// ============================================================================
// WebsiteMonitor Class
// ============================================================================
export class WebsiteMonitor {

    /**
     * Performs the core HTTP check for a given URL.
     * Returns raw monitoring data.
     */
    static async performWebsiteCheck(url: string): Promise<MonitoringResponse> {
        const start = performance.now();
        let responseTime: number | null = null;
        let isAvailable = false;
        let statusCode: number | null = null;
        let errorMessage: string | null = null;

        try {
            const response = await axios.get(url, {
                timeout: TIMEOUT_MS ?? 15000, // Use config or default timeout
                headers: {
                    'User-Agent': 'PingifyMonitor/1.0 (+https://pingify.com/monitor)', // Replace with your actual app name/URL
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br', // Allow compressed responses
                },
                validateStatus: () => true, // Handle all status codes manually below
            });

            responseTime = Math.round(performance.now() - start);
            statusCode = response.status;
            // Consider 2xx successful. Adjust if 3xx redirects should be treated differently.
            isAvailable = statusCode >= 200 && statusCode < 300;

            if (!isAvailable) {
                errorMessage = `HTTP Status ${statusCode}`;
            }
        } catch (error: unknown) {
            responseTime = Math.round(performance.now() - start); // Record time even on failure
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

    /**
     * Parses Axios errors into user-friendly messages.
     */
    private static parseAxiosErrorMessage(error: AxiosError): string {
        if (error.response) {
            // Server responded with a status code outside the 2xx range
            return `HTTP Error ${error.response.status}`;
        } else if (error.request) {
            // Request was made but no response received
            if (error.code === 'ECONNABORTED') return `Request timed out (${TIMEOUT_MS ?? 15000}ms)`;
            if (error.code === 'ENOTFOUND') return 'DNS lookup failed (domain not found)';
            if (error.code === 'ECONNREFUSED') return 'Connection refused by server';
            if (error.code === 'ETIMEDOUT') return 'Connection timed out';
            if (error.code === 'EHOSTUNREACH') return 'No route to host';
            if (error.code === 'ECONNRESET') return 'Connection reset by peer';
            // Add more specific codes as encountered
            return 'No response received from server';
        } else {
            // Error setting up the request (e.g., invalid URL format before request is sent)
            return `Request setup error: ${error.message}`;
        }
    }

    /**
     * Checks a website, saves the result, triggers the alert condition handler,
     * and returns the saved result record.
     */
     // --- MODIFIED SIGNATURE ---
    static async checkWebsite(website: PrismaWebsite): Promise<PrismaMonitoringResult> {
        const logPrefix = `[Monitor W:${website.id} ${website.url}]`;
        console.log(`${logPrefix} Starting check.`);
        let savedResult: PrismaMonitoringResult | null = null; // Initialize as potentially null

        try {
            // 1. Perform the actual HTTP check
            const checkResultData = await this.performWebsiteCheck(website.url);

            // 2. Save the result using ResultsManager
            // saveResult handles updating website.lastChecked within its transaction
            // AND now we capture the returned result
            savedResult = await ResultsManager.saveResult(website.id, checkResultData);
            console.log(`${logPrefix} Result saved (ID: ${savedResult.id}): Avail=${savedResult.isAvailable}, RT=${savedResult.responseTime}ms, Status=${savedResult.statusCode}, Err=${savedResult.errorMessage ?? 'None'}`);

            // 3. Trigger the NEW Alert Service condition handler
            // Pass the website object and the *saved* result. AlertService handles the rest.
            // Ensure savedResult is not null before proceeding (though saveResult should throw on failure)
            if (savedResult) {
                 await AlertService.handlePotentialAlertCondition(website, savedResult);
            } else {
                // This case should technically not be reached if saveResult throws on error,
                // but it's a defensive check.
                console.error(`${logPrefix} Saved result was unexpectedly null after save attempt.`);
                throw new Error("Failed to obtain saved result after check.");
            }

            // --- MODIFIED: RETURN THE SAVED RESULT ---
            return savedResult;

        } catch (error: any) {
            console.error(`${logPrefix} Critical failure during checkWebsite process: ${error.message}`, error.stack);
            // Attempt to update lastChecked even if saving/alerting failed, so scheduler doesn't retry immediately
            try {
                await prisma.website.update({
                    where: { id: website.id },
                    data: { lastChecked: new Date() } // Mark as checked to avoid rapid retries on error
                });
                 console.warn(`${logPrefix} Updated lastChecked despite error during check/alert processing.`);
            } catch (updateError) {
                 console.error(`${logPrefix} Failed to update lastChecked after error:`, updateError);
            }
            // Re-throw the original error to propagate it up (e.g., to the controller)
            throw error;
        }
    } // --- END OF MODIFIED checkWebsite ---

} // End WebsiteMonitor Class


// ============================================================================
// ResultsManager Class
// ============================================================================
export class ResultsManager {
    /**
     * Saves a monitoring result and updates the website's lastChecked time within a transaction.
     * Returns the created PrismaMonitoringResult.
     */
     // --- ENSURE RETURN TYPE IS CORRECT ---
    static async saveResult( websiteId: number, result: MonitoringResponse ): Promise<PrismaMonitoringResult> {
        const { responseTime, isAvailable, statusCode, errorMessage } = result;
        const checkedAt = new Date(); // Use a single timestamp for consistency
        try {
            // Use transaction to ensure website update and result creation are atomic
            const savedMonitoringResult = await prisma.$transaction(async (tx) => { // Renamed variable for clarity
                // Update the website's last checked time
                await tx.website.update({
                    where: { id: websiteId },
                    data: { lastChecked: checkedAt },
                });
                // Create the monitoring result record
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
                return monitoringResult; // Return from the transaction callback
            });
            // --- RETURN THE RESULT FROM THE FUNCTION ---
            return savedMonitoringResult;
        } catch (error) {
            console.error(`[ResultsManager] Error saving result for website ${websiteId}:`, error);
            throw error; // Re-throw to be handled by caller (checkWebsite)
        }
    }

    /**
     * Gets the ID of the most recent result for a website.
     */
    static async getLatestResultId(websiteId: number): Promise<number> {
        const result = await prisma.monitoringResult.findFirst({
            where: { websiteId },
            orderBy: { checkedAt: 'desc' },
            select: { id: true },
        });
        return result?.id || 0; // Return 0 or handle case where no results exist appropriately
    }

    /**
     * Gets the most recent N results for a specific website.
     */
    static async getResultsForWebsite(websiteId: number, limit = 100): Promise<PrismaMonitoringResult[]> {
        return prisma.monitoringResult.findMany({
            where: { websiteId },
            orderBy: { checkedAt: 'desc' },
            take: limit,
        });
    }

    /**
     * Gets results system-wide with basic filters, includes website URL.
     * Returns Prisma type array, controller needs to map.
     */
     // --- Adjusted return type hint based on include ---
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
     * Gets results for a specific website based on filters (used by controller).
     * Returns Prisma type array, controller needs to map.
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
            where: whereClause,
            orderBy: { checkedAt: 'desc' },
            take: limit
            // No include needed here usually, controller adds context if required
        });
    }

    /**
     * Gets results for websites a specific user monitors, includes user's custom name.
     * Returns Prisma type array, controller needs to map.
     */
     // --- Adjusted return type hint based on include ---
    static async getResultsForUser( userId: number, options: ResultsQueryOptions = {} ): Promise< (PrismaMonitoringResult & { website: { websiteUsers: { name: string | null }[] } | null })[] > {
        const { limit = 100, from, to } = options;
        const whereClause: Prisma.MonitoringResultWhereInput = {
            // Filter results belonging to websites associated with the user
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
            include: {
                // Include website and the specific user's WebsiteUser data
                website: {
                    include: {
                        websiteUsers: {
                            where: { userId }, // Filter to get only THIS user's settings/name
                            select: { name: true } // Select the custom name
                        }
                    }
                }
            }
        });
    }
} // End ResultsManager Class


// ============================================================================
// StatsCalculator Class
// ============================================================================
export class StatsCalculator {
    /**
     * Calculates uptime percentage for a website between two dates.
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
        if (totalChecks === 0) return 100;

        const successfulChecks = results.filter(r => r.isAvailable).length;
        const uptimePercentage = (successfulChecks / totalChecks) * 100;

        return parseFloat(uptimePercentage.toFixed(2));
    }

    /**
     * Calculates average response time for available checks between two dates.
     */
    static async getAverageResponseTimeBetweenDates(websiteId: number, startDate: Date, endDate: Date = new Date()): Promise<number | null> {
        const result = await prisma.monitoringResult.aggregate({
            _avg: { responseTime: true },
            where: {
                websiteId,
                checkedAt: { gte: startDate, lte: endDate },
                isAvailable: true,
                responseTime: { not: null }
            },
        });
        return result._avg.responseTime !== null ? Math.round(result._avg.responseTime) : null;
    }

    /**
     * Counts consecutive failures from the most recent checks.
     */
    static async getConsecutiveFailures(websiteId: number): Promise<number> {
        const results = await prisma.monitoringResult.findMany({
            where: { websiteId },
            orderBy: { checkedAt: 'desc' },
            take: 100, // Look at last 100 checks for consecutive failures
            select: { isAvailable: true }
        });

        let count = 0;
        for (const result of results) {
            if (!result.isAvailable) {
                count++;
            } else {
                // Stop counting as soon as an available check is found
                break;
            }
        }
        return count;
    }

    /**
     * Helper to convert timeframe keys or days string to number of days.
     */
    private static periodToDays(period: TimeframeKey | string): number {
        // Prioritize TimeframeKey check
        switch (period) {
            case 'hour': return 1 / 24;
            case 'day': return 1;
            case 'week': return 7;
            case 'month': return 30; // Approximate
            case 'year': return 365; // Approximate
        }
        // Handle numeric string or direct number
        if (typeof period === 'number') return period > 0 ? period : 7;
        if (typeof period === 'string') {
             const value = parseInt(period);
             if (!isNaN(value) && value > 0) return value;
        }
        // Default fallback
        return 7;
    }

    /**
     * Calculates detailed stats for a single website over a period.
     * Returns the SHARED WebsiteStatsData type.
     */
     // --- ENSURE RETURN TYPE MATCHES SHARED TYPE ---
    static async getWebsiteStats( websiteId: number, userId?: number, period: TimeframeKey | string = 'week' ): Promise<WebsiteStatsData> {
        const days = this.periodToDays(period);
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Fetch only necessary fields from website
        const website = await prisma.website.findUnique({
            where: { id: websiteId },
            select: { url: true }
        });
        if (!website) throw new Error(`Website with ID ${websiteId} not found`);

        let websiteName = website.url; // Default name
        if (userId) {
            // Fetch only the name field for efficiency
            const userWebsite = await prisma.websiteUser.findUnique({
                where: { userId_websiteId: { userId, websiteId } },
                select: { name: true }
            });
            // Use custom name only if it's defined and not an empty string
            if (userWebsite?.name) {
                websiteName = userWebsite.name;
            }
        }

        // Fetch stats concurrently
        const [
            uptime,
            averageResponseTime,
            lastResultData,
            consecutiveFailures,
            totalChecks
        ] = await Promise.all([
            this.calculateUptimeBetweenDates(websiteId, startDate),
            this.getAverageResponseTimeBetweenDates(websiteId, startDate),
            prisma.monitoringResult.findFirst({
                where: { websiteId },
                orderBy: { checkedAt: 'desc' },
                select: { checkedAt: true } // Select only the date
            }),
            this.getConsecutiveFailures(websiteId),
            prisma.monitoringResult.count({
                where: { websiteId, checkedAt: { gte: startDate } }
            })
        ]);

        // Construct object matching the SHARED WebsiteStatsData type
        return {
            websiteId,
            websiteName,
            url: website.url,
            uptime, // number (percentage)
            averageResponseTime, // number | null
            totalChecks, // number
            lastCheck: lastResultData?.checkedAt?.toISOString() ?? null, // string | null
            consecutiveFailures // number
        };
    }

    /**
     * Calculates overall stats for all websites or only those monitored by a user.
     * Returns the SHARED OverallStats type.
     */
     // --- ENSURE RETURN TYPE MATCHES SHARED TYPE ---
    static async getOverallStats( userId?: number, period: TimeframeKey | string = 'week' ): Promise<OverallStats> {
        const days = this.periodToDays(period);
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Define the base filter for websites (all or user-specific)
        const websiteWhere: Prisma.WebsiteWhereInput = userId
            ? { websiteUsers: { some: { userId } } }
            : {};

        // Get total and active counts based on the filter
        const [totalWebsites, activeWebsitesCount] = await Promise.all([
            prisma.website.count({ where: websiteWhere }),
            prisma.website.count({ where: { ...websiteWhere, isActive: true } }) // Count only active ones
        ]);

        // Fetch only the IDs of active websites matching the filter
        const activeWebsitesList = await prisma.website.findMany({
            where: { ...websiteWhere, isActive: true },
            select: { id: true }
        });

        // Get detailed stats for each *active* website
        const websiteStatsPromises = activeWebsitesList.map(website =>
            this.getWebsiteStats(website.id, userId, period) // This returns WebsiteStatsData
        );
        const websiteStats: WebsiteStatsData[] = await Promise.all(websiteStatsPromises);

        // --- Calculate overall metrics based on the fetched detailed stats ---

        // Filter stats to include only those with checks in the period for accurate uptime avg
        const validUptimeStats = websiteStats.filter(stat => stat.totalChecks > 0);
        const overallUptime = validUptimeStats.length > 0
            ? validUptimeStats.reduce((sum, stat) => sum + stat.uptime, 0) / validUptimeStats.length
            : 100; // Default to 100% if no checks performed (no downtime recorded)

        // Filter stats for valid average response times
        const validResponseStats = websiteStats.filter(stat => stat.averageResponseTime !== null); // No need to check > 0
        const overallResponseTime = validResponseStats.length > 0
            // Use non-null assertion as we've filtered out nulls
            ? Math.round(validResponseStats.reduce((sum, stat) => sum + stat.averageResponseTime!, 0) / validResponseStats.length)
            : null; // Return null if no websites had valid response times

        // Construct object matching the SHARED OverallStats type
        return {
            totalWebsites,
            activeWebsites: activeWebsitesCount, // Use the accurate count of active sites
            websiteStats, // Array of WebsiteStatsData
            overallUptime: parseFloat(overallUptime.toFixed(2)), // number (percentage)
            overallResponseTime // number | null
        };
    }

    /**
     * Convenience method specifically for getting a user's dashboard stats.
     * Returns the SHARED OverallStats type.
     */
     // --- ENSURE RETURN TYPE MATCHES SHARED TYPE ---
    static async getUserDashboardStats( userId: number, period: TimeframeKey | string = 'week' ): Promise<OverallStats> {
        // Simply delegate to the main function with the userId
        return this.getOverallStats(userId, period);
    }

    /**
     * Generates aggregated data points for chart display over a specified timeframe.
     * Returns array matching the SHARED ChartDataPoint type.
     */
     // --- ENSURE RETURN TYPE MATCHES SHARED TYPE ---
    static async getChartDataForWebsite( websiteId: number, timeframe: TimeframeKey ): Promise<ChartDataPoint[]> {
        const endDate = new Date();
        let chartData: ChartDataPoint[] = [];
        let startDate: Date;
        let intervalStart: Date, intervalEnd: Date;

        // Helper to calculate stats for a given set of results within a period
        const calculatePeriodStats = (resultsInPeriod: PrismaMonitoringResult[]): { avgResponseTime: number | null, uptimeRatio: number, checkCount: number } => {
            const totalChecks = resultsInPeriod.length;
            if (totalChecks === 0) {
                // If no checks, assume 100% uptime for the period, no avg response time
                return { avgResponseTime: null, uptimeRatio: 1.0, checkCount: 0 };
            }
            const successfulChecks = resultsInPeriod.filter(r => r.isAvailable).length;
            const validResponseTimes = resultsInPeriod
                .filter(r => r.isAvailable && r.responseTime !== null)
                .map(r => r.responseTime!); // Use non-null assertion after filter
            const avgResponseTime = validResponseTimes.length > 0
                ? Math.round(validResponseTimes.reduce((s, rt) => s + rt, 0) / validResponseTimes.length)
                : null;
            // Uptime ratio for the period
            const uptimeRatio = successfulChecks / totalChecks;
            return { avgResponseTime, uptimeRatio: parseFloat(uptimeRatio.toFixed(4)), checkCount: totalChecks };
        };

        // Fetch results based on timeframe and aggregate
        switch (timeframe) {
            case 'hour':
                startDate = subHours(endDate, 1);
                // Fetch individual results for the last hour
                const hourResults = await prisma.monitoringResult.findMany({
                    where: { websiteId, checkedAt: { gte: startDate, lte: endDate } },
                    orderBy: { checkedAt: 'asc' },
                    take: 200, // Limit points if checks are very frequent
                });
                // Map each result to a chart point
                chartData = hourResults.map(r => ({
                    label: format(new Date(r.checkedAt), 'HH:mm'), // Format time
                    timestamp: getUnixTime(new Date(r.checkedAt)), // Unix timestamp
                    avgResponseTime: r.isAvailable ? r.responseTime : null, // Use individual response time
                    uptimeRatio: r.isAvailable ? 1.0 : 0.0, // 100% or 0% for individual check
                    checkCount: 1, // Each point represents one check
                }));
                break;

            case 'day':
                startDate = subDays(endDate, 1);
                intervalStart = startOfDay(startDate);
                intervalEnd = endOfDay(endDate);
                // Fetch all results for the day
                const dayResults = await prisma.monitoringResult.findMany({
                    where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } },
                    orderBy: { checkedAt: 'asc' },
                });
                // Aggregate results into 30-minute intervals
                const intervalMinutesDay = 30; // Aggregate into 30-min buckets
                const intervalsDay = new Map<number, PrismaMonitoringResult[]>();
                dayResults.forEach(r => {
                    // Calculate the timestamp for the start of the 30-min interval
                    const intervalTimestamp = Math.floor(getUnixTime(new Date(r.checkedAt)) / (intervalMinutesDay * 60)) * (intervalMinutesDay * 60);
                    if (!intervalsDay.has(intervalTimestamp)) intervalsDay.set(intervalTimestamp, []);
                    intervalsDay.get(intervalTimestamp)?.push(r);
                });
                 // Calculate stats for each interval and map to ChartDataPoint
                chartData = Array.from(intervalsDay.entries()).map(([timestamp, results]) => {
                    const stats = calculatePeriodStats(results);
                    return {
                        label: format(new Date(timestamp * 1000), 'HH:mm'), // Label is the start time of interval
                        timestamp: timestamp,
                        ...stats // Spread calculated avgResponseTime, uptimeRatio, checkCount
                    };
                });
                break;

            case 'week':
            case 'month':
                // Determine start date based on timeframe
                startDate = (timeframe === 'week') ? subDays(endDate, 7) : subMonths(endDate, 1); // Use subMonths
                intervalStart = startOfDay(startDate);
                intervalEnd = endOfDay(endDate);
                 // Define the days within the period
                const daysInPeriod = eachDayOfInterval({ start: intervalStart, end: intervalEnd });
                 // Fetch all results for the entire period once
                const periodResultsWkMo = await prisma.monitoringResult.findMany({
                    where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } },
                    orderBy: { checkedAt: 'asc' },
                });
                // Group results by day (YYYY-MM-DD)
                const resultsByDay = new Map<string, PrismaMonitoringResult[]>();
                periodResultsWkMo.forEach(r => {
                    const dayKey = format(new Date(r.checkedAt), 'yyyy-MM-dd');
                    if (!resultsByDay.has(dayKey)) resultsByDay.set(dayKey, []);
                    resultsByDay.get(dayKey)?.push(r);
                });
                // Calculate stats for each day and map to ChartDataPoint
                chartData = daysInPeriod.map((day): ChartDataPoint => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const dayStart = startOfDay(day);
                    const results = resultsByDay.get(dayKey) || []; // Get results for the day
                    const stats = calculatePeriodStats(results); // Calculate stats for that day
                    return {
                        label: format(dayStart, 'MMM d'), // Label is Month Day
                        timestamp: getUnixTime(dayStart), // Timestamp is start of day
                        ...stats // Spread calculated stats
                    };
                });
                break;

            case 'year':
                startDate = subYears(endDate, 1);
                intervalStart = startOfMonth(startDate); // Start from beginning of the first month
                intervalEnd = endOfDay(endDate); // End at the end of today
                // Define the months within the period
                const monthsInPeriod = eachMonthOfInterval({ start: intervalStart, end: intervalEnd });
                // Fetch all results for the entire year once
                const yearResults = await prisma.monitoringResult.findMany({
                    where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } },
                    orderBy: { checkedAt: 'asc' },
                });
                 // Group results by month (YYYY-MM)
                const resultsByMonth = new Map<string, PrismaMonitoringResult[]>();
                yearResults.forEach(r => {
                    const monthKey = format(new Date(r.checkedAt), 'yyyy-MM');
                    if (!resultsByMonth.has(monthKey)) resultsByMonth.set(monthKey, []);
                    resultsByMonth.get(monthKey)?.push(r);
                });
                 // Calculate stats for each month and map to ChartDataPoint
                chartData = monthsInPeriod.map((monthDate): ChartDataPoint => {
                    const monthKey = format(monthDate, 'yyyy-MM');
                    const monthStart = startOfMonth(monthDate);
                    const results = resultsByMonth.get(monthKey) || []; // Get results for the month
                    const stats = calculatePeriodStats(results); // Calculate stats for that month
                    return {
                        label: format(monthStart, 'MMM yyyy'), // Label is Month Year
                        timestamp: getUnixTime(monthStart), // Timestamp is start of month
                        ...stats // Spread calculated stats
                    };
                });
                break;

            default:
                 // Fallback or error for unsupported timeframe
                console.warn(`[StatsCalculator] Unsupported timeframe for chart data: ${timeframe}. Defaulting to 'week'.`);
                return this.getChartDataForWebsite(websiteId, 'week'); // Recursive call with default
        }

        // Ensure final data is sorted by timestamp before returning
        chartData.sort((a, b) => a.timestamp - b.timestamp);
        return chartData; // Returns ChartDataPoint[]
    }

} // End StatsCalculator Class