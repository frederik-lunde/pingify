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
    MonitoringResult, // Use shared MonitoringResult definition for comparison/mapping if needed
    DowntimeInfo // <-- Import new type
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
                    // Standard User-Agent
                    'User-Agent': 'PingifyMonitor/1.0 (+https://pingify.com/monitor)', // Replace with your actual app name/URL
                    // Standard Accept header
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    // Allow compressed responses
                    'Accept-Encoding': 'gzip, deflate, br',
                },
                // Handle all status codes manually below
                validateStatus: () => true,
            });

            responseTime = Math.round(performance.now() - start);
            statusCode = response.status;
            // Consider 2xx successful. Adjust if 3xx redirects should be treated differently.
            isAvailable = statusCode >= 200 && statusCode < 300;

            if (!isAvailable) {
                errorMessage = `HTTP Status ${statusCode}`;
            }
        } catch (error: unknown) {
            // Record time even on failure
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
            // Log check errors
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
            // Provide more specific network error messages
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
        // Log prefix for easier debugging
        const logPrefix = `[Monitor W:${website.id} ${website.url}]`;
        // Log start of check
        console.log(`${logPrefix} Starting check.`);
        // Initialize as potentially null
        let savedResult: PrismaMonitoringResult | null = null;

        try {
            // 1. Perform the actual HTTP check
            const checkResultData = await this.performWebsiteCheck(website.url);

            // 2. Save the result using ResultsManager
            // saveResult handles updating website.lastChecked within its transaction
            // AND now we capture the returned result
            savedResult = await ResultsManager.saveResult(website.id, checkResultData);
            // Log saved result details
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
            // Log critical failures during the check process
            console.error(`${logPrefix} Critical failure during checkWebsite process: ${error.message}`, error.stack);
            // Attempt to update lastChecked even if saving/alerting failed, so scheduler doesn't retry immediately
            try {
                await prisma.website.update({
                    where: { id: website.id },
                    // Mark as checked to avoid rapid retries on error
                    data: { lastChecked: new Date() }
                });
                // Warn about updating lastChecked despite error
                 console.warn(`${logPrefix} Updated lastChecked despite error during check/alert processing.`);
            } catch (updateError) {
                // Log failure to update lastChecked
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
        // Use a single timestamp for consistency
        const checkedAt = new Date();
        try {
            // Use transaction to ensure website update and result creation are atomic
            // Renamed variable for clarity
            const savedMonitoringResult = await prisma.$transaction(async (tx) => {
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
                        // Use the consistent timestamp
                        checkedAt,
                    },
                });
                // Return from the transaction callback
                return monitoringResult;
            });
            // --- RETURN THE RESULT FROM THE FUNCTION ---
            return savedMonitoringResult;
        } catch (error) {
            // Log error saving result
            console.error(`[ResultsManager] Error saving result for website ${websiteId}:`, error);
            // Re-throw to be handled by caller (checkWebsite)
            throw error;
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
        // Return 0 or handle case where no results exist appropriately
        return result?.id || 0;
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
            // Include URL for context
            include: { website: { select: { url: true } } }
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
                            // Filter to get only THIS user's settings/name
                            where: { userId },
                            // Select the custom name
                            select: { name: true }
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
     * DEPRECATED in favor of getCurrentDowntimeInfo which provides more context.
     * Kept for potential use in WebsiteStatsData if needed differently.
     */
    static async getConsecutiveFailures(websiteId: number): Promise<number> {
        const results = await prisma.monitoringResult.findMany({
            where: { websiteId },
            orderBy: { checkedAt: 'desc' },
            // Look at last N checks (adjust N based on typical check intervals)
            take: 100,
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
     * NEW: Calculates the current consecutive failures and the start time of the downtime.
     * Returns an object with consecutiveFailures count and downtimeStartedAt Date or null.
     */
    static async getCurrentDowntimeInfo(websiteId: number): Promise<DowntimeInfo> {
        // Fetch recent results, ordered newest first
        const recentResults = await prisma.monitoringResult.findMany({
            where: { websiteId },
            orderBy: { checkedAt: 'desc' },
            // Fetch a reasonable number to cover potential long downtimes
            // Adjust based on typical check frequency (e.g., 5 min interval * 288 = 1 day)
            take: 300,
            select: { isAvailable: true, checkedAt: true }
        });

        // If no results, it's not down
        if (recentResults.length === 0) {
            return { consecutiveFailures: 0, downtimeStartedAt: null };
        }

        // If the most recent check was successful, it's not down
        if (recentResults[0].isAvailable) {
            return { consecutiveFailures: 0, downtimeStartedAt: null };
        }

        let consecutiveFailures = 0;
        // Initialize with the timestamp of the latest failure
        let downtimeStartedAt: Date | null = recentResults[0].checkedAt;

        // Iterate through results (newest to oldest)
        for (const result of recentResults) {
            if (!result.isAvailable) {
                consecutiveFailures++;
                // Keep updating to the older timestamp as long as we find failures
                downtimeStartedAt = result.checkedAt;
            } else {
                // Stop as soon as we find a successful check
                break;
            }
        }

        return { consecutiveFailures, downtimeStartedAt };
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
            // Approximate
            case 'month': return 30;
            // Approximate
            case 'year': return 365;
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
     * NOTE: The 'consecutiveFailures' here might differ from the live downtime count.
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

        // Default name
        let websiteName = website.url;
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
            // Use the older getConsecutiveFailures for this historical stat view if desired
            // Or potentially remove it if getCurrentDowntimeInfo is always preferred
            consecutiveFailuresHistorical,
            totalChecks
        ] = await Promise.all([
            this.calculateUptimeBetweenDates(websiteId, startDate),
            this.getAverageResponseTimeBetweenDates(websiteId, startDate),
            prisma.monitoringResult.findFirst({
                where: { websiteId },
                orderBy: { checkedAt: 'desc' },
                // Select only the date
                select: { checkedAt: true }
            }),
            // This calculates failures *right now*, might not fit historical view perfectly
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
            // number (percentage)
            uptime,
            // number | null
            averageResponseTime,
            // number
            totalChecks,
            // string | null
            lastCheck: lastResultData?.checkedAt?.toISOString() ?? null,
            // number - Using the historical/simple count here
            consecutiveFailures: consecutiveFailuresHistorical
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
            // Count only active ones
            prisma.website.count({ where: { ...websiteWhere, isActive: true } })
        ]);

        // Fetch only the IDs of active websites matching the filter
        const activeWebsitesList = await prisma.website.findMany({
            where: { ...websiteWhere, isActive: true },
            select: { id: true }
        });

        // Get detailed stats for each *active* website
        const websiteStatsPromises = activeWebsitesList.map(website =>
            // This returns WebsiteStatsData
            this.getWebsiteStats(website.id, userId, period)
        );
        // Array of WebsiteStatsData
        const websiteStats: WebsiteStatsData[] = await Promise.all(websiteStatsPromises);

        // --- Calculate overall metrics based on the fetched detailed stats ---

        // Filter stats to include only those with checks in the period for accurate uptime avg
        const validUptimeStats = websiteStats.filter(stat => stat.totalChecks > 0);
        const overallUptime = validUptimeStats.length > 0
            ? validUptimeStats.reduce((sum, stat) => sum + stat.uptime, 0) / validUptimeStats.length
            // Default to 100% if no checks performed (no downtime recorded)
            : 100;

        // Filter stats for valid average response times
        // No need to check > 0
        const validResponseStats = websiteStats.filter(stat => stat.averageResponseTime !== null);
        const overallResponseTime = validResponseStats.length > 0
            // Use non-null assertion as we've filtered out nulls
            ? Math.round(validResponseStats.reduce((sum, stat) => sum + stat.averageResponseTime!, 0) / validResponseStats.length)
            // Return null if no websites had valid response times
            : null;

        // Construct object matching the SHARED OverallStats type
        return {
            totalWebsites,
            // Use the accurate count of active sites
            activeWebsites: activeWebsitesCount,
            // Array of WebsiteStatsData
            websiteStats,
            // number (percentage)
            overallUptime: parseFloat(overallUptime.toFixed(2)),
            // number | null
            overallResponseTime
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
                // Use non-null assertion after filter
                .map(r => r.responseTime!);
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
                    // Limit points if checks are very frequent
                    take: 200,
                });
                // Map each result to a chart point
                chartData = hourResults.map(r => ({
                    // Format time
                    label: format(new Date(r.checkedAt), 'HH:mm'),
                    // Unix timestamp
                    timestamp: getUnixTime(new Date(r.checkedAt)),
                    // Use individual response time
                    avgResponseTime: r.isAvailable ? r.responseTime : null,
                    // 100% or 0% for individual check
                    uptimeRatio: r.isAvailable ? 1.0 : 0.0,
                    // Each point represents one check
                    checkCount: 1,
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
                 // Aggregate into 30-min buckets
                const intervalMinutesDay = 30;
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
                        // Label is the start time of interval
                        label: format(new Date(timestamp * 1000), 'HH:mm'),
                        timestamp: timestamp,
                        // Spread calculated avgResponseTime, uptimeRatio, checkCount
                        ...stats
                    };
                });
                break;

            case 'week':
            case 'month':
                // Determine start date based on timeframe
                 // Use subMonths
                startDate = (timeframe === 'week') ? subDays(endDate, 7) : subMonths(endDate, 1);
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
                    // Get results for the day
                    const results = resultsByDay.get(dayKey) || [];
                    // Calculate stats for that day
                    const stats = calculatePeriodStats(results);
                    return {
                        // Label is Month Day
                        label: format(dayStart, 'MMM d'),
                        // Timestamp is start of day
                        timestamp: getUnixTime(dayStart),
                        // Spread calculated stats
                        ...stats
                    };
                });
                break;

            case 'year':
                startDate = subYears(endDate, 1);
                 // Start from beginning of the first month
                intervalStart = startOfMonth(startDate);
                 // End at the end of today
                intervalEnd = endOfDay(endDate);
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
                    // Get results for the month
                    const results = resultsByMonth.get(monthKey) || [];
                    // Calculate stats for that month
                    const stats = calculatePeriodStats(results);
                    return {
                        // Label is Month Year
                        label: format(monthStart, 'MMM yyyy'),
                        // Timestamp is start of month
                        timestamp: getUnixTime(monthStart),
                        // Spread calculated stats
                        ...stats
                    };
                });
                break;

            default:
                 // Fallback or error for unsupported timeframe
                console.warn(`[StatsCalculator] Unsupported timeframe for chart data: ${timeframe}. Defaulting to 'week'.`);
                 // Recursive call with default
                return this.getChartDataForWebsite(websiteId, 'week');
        }

        // Ensure final data is sorted by timestamp before returning
        chartData.sort((a, b) => a.timestamp - b.timestamp);
         // Returns ChartDataPoint[]
        return chartData;
    }

} // End StatsCalculator Class