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
     * Checks a website, saves the result, and triggers the alert condition handler.
     * This is the main method called by the scheduler.
     */
    static async checkWebsite(website: PrismaWebsite): Promise<void> {
        const logPrefix = `[Monitor W:${website.id} ${website.url}]`;
        console.log(`${logPrefix} Starting check.`);
        let savedResult: PrismaMonitoringResult | null = null;

        try {
            // 1. Perform the actual HTTP check
            const checkResultData = await this.performWebsiteCheck(website.url);

            // 2. Save the result using ResultsManager
            // saveResult handles updating website.lastChecked within its transaction
            savedResult = await ResultsManager.saveResult(website.id, checkResultData);
            console.log(`${logPrefix} Result saved (ID: ${savedResult.id}): Avail=${savedResult.isAvailable}, RT=${savedResult.responseTime}ms, Status=${savedResult.statusCode}, Err=${savedResult.errorMessage ?? 'None'}`);

            // 3. Trigger the NEW Alert Service condition handler
            // Pass the website object and the *saved* result. AlertService handles the rest.
            await AlertService.handlePotentialAlertCondition(website, savedResult);

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
        }
    }

} // End WebsiteMonitor Class


// ============================================================================
// ResultsManager Class
// ============================================================================
export class ResultsManager {
    /**
     * Saves a monitoring result and updates the website's lastChecked time within a transaction.
     */
    static async saveResult( websiteId: number, result: MonitoringResponse ): Promise<PrismaMonitoringResult> {
        const { responseTime, isAvailable, statusCode, errorMessage } = result;
        const checkedAt = new Date(); // Use a single timestamp for consistency
        try {
            // Use transaction to ensure website update and result creation are atomic
            return await prisma.$transaction(async (tx) => {
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
                return monitoringResult;
            });
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
     */
    static async getAllResults(options: ResultsQueryOptions = {}): Promise<PrismaMonitoringResult[]> {
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
     */
    static async getResultsForUser( userId: number, options: ResultsQueryOptions = {} ): Promise<PrismaMonitoringResult[]> {
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
            take: 100,
            select: { isAvailable: true }
        });

        let count = 0;
        for (const result of results) {
            if (!result.isAvailable) {
                count++;
            } else {
                break;
            }
        }
        return count;
    }

    /**
     * Helper to convert timeframe keys or days string to number of days.
     */
    private static periodToDays(period: TimeframeKey | string): number {
        if (typeof period === 'number') return period > 0 ? period : 7;
        if (typeof period !== 'string') return 7;

        const value = parseInt(period);
        if (!isNaN(value) && value > 0) return value;

        switch (period) {
            case 'hour': return 1 / 24;
            case 'day': return 1;
            case 'week': return 7;
            case 'month': return 30;
            case 'year': return 365;
            default: return 7;
        }
    }

    /**
     * Calculates detailed stats for a single website over a period.
     */
    static async getWebsiteStats( websiteId: number, userId?: number, period: TimeframeKey | string = 'week' ): Promise<WebsiteStatsData> {
        const days = this.periodToDays(period);
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const website = await prisma.website.findUnique({
            where: { id: websiteId },
            select: { url: true }
        });
        if (!website) throw new Error(`Website with ID ${websiteId} not found`);

        let websiteName = website.url;
        if (userId) {
            const userWebsite = await prisma.websiteUser.findUnique({
                where: { userId_websiteId: { userId, websiteId } },
                select: { name: true }
            });
            if (userWebsite?.name) {
                websiteName = userWebsite.name;
            }
        }

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
                select: { checkedAt: true }
            }),
            this.getConsecutiveFailures(websiteId),
            prisma.monitoringResult.count({
                where: { websiteId, checkedAt: { gte: startDate } }
            })
        ]);

        return {
            websiteId,
            websiteName,
            url: website.url,
            uptime,
            averageResponseTime,
            totalChecks,
            lastCheck: lastResultData?.checkedAt?.toISOString() ?? null,
            consecutiveFailures
        };
    }

    /**
     * Calculates overall stats for all websites or only those monitored by a user.
     */
    static async getOverallStats( userId?: number, period: TimeframeKey | string = 'week' ): Promise<OverallStats> {
        const days = this.periodToDays(period);
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const websiteWhere: Prisma.WebsiteWhereInput = userId
            ? { websiteUsers: { some: { userId } } }
            : {};

        const [totalWebsites, activeWebsitesCount] = await Promise.all([
            prisma.website.count({ where: websiteWhere }),
            prisma.website.count({ where: { ...websiteWhere, isActive: true } })
        ]);

        const activeWebsitesList = await prisma.website.findMany({
            where: { ...websiteWhere, isActive: true },
            select: { id: true }
        });

        const websiteStatsPromises = activeWebsitesList.map(website =>
            this.getWebsiteStats(website.id, userId, period)
        );
        const websiteStats: WebsiteStatsData[] = await Promise.all(websiteStatsPromises);

        const validUptimeStats = websiteStats.filter(stat => stat.totalChecks > 0);
        const overallUptime = validUptimeStats.length > 0
            ? validUptimeStats.reduce((sum, stat) => sum + stat.uptime, 0) / validUptimeStats.length
            : 100;

        const validResponseStats = websiteStats.filter(stat => stat.averageResponseTime !== null);
        const overallResponseTime = validResponseStats.length > 0
            ? Math.round(validResponseStats.reduce((sum, stat) => sum + stat.averageResponseTime!, 0) / validResponseStats.length)
            : null;

        return {
            totalWebsites,
            activeWebsites: activeWebsitesCount,
            websiteStats,
            overallUptime: parseFloat(overallUptime.toFixed(2)),
            overallResponseTime
        };
    }

    /**
     * Convenience method specifically for getting a user's dashboard stats.
     */
    static async getUserDashboardStats( userId: number, period: TimeframeKey | string = 'week' ): Promise<OverallStats> {
        return this.getOverallStats(userId, period);
    }

    /**
     * Generates aggregated data points for chart display over a specified timeframe.
     */
    static async getChartDataForWebsite( websiteId: number, timeframe: TimeframeKey ): Promise<ChartDataPoint[]> {
        const endDate = new Date();
        let chartData: ChartDataPoint[] = [];
        let startDate: Date;
        let intervalStart: Date, intervalEnd: Date;

        const calculatePeriodStats = (resultsInPeriod: PrismaMonitoringResult[]): { avgResponseTime: number | null, uptimeRatio: number, checkCount: number } => {
            const totalChecks = resultsInPeriod.length;
            if (totalChecks === 0) {
                return { avgResponseTime: null, uptimeRatio: 1.0, checkCount: 0 };
            }
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
                startDate = subHours(endDate, 1);
                const hourResults = await prisma.monitoringResult.findMany({
                    where: { websiteId, checkedAt: { gte: startDate, lte: endDate } },
                    orderBy: { checkedAt: 'asc' },
                    take: 200,
                });
                chartData = hourResults.map(r => ({
                    label: format(new Date(r.checkedAt), 'HH:mm'),
                    timestamp: getUnixTime(new Date(r.checkedAt)),
                    avgResponseTime: r.isAvailable ? r.responseTime : null,
                    uptimeRatio: r.isAvailable ? 1.0 : 0.0,
                    checkCount: 1,
                }));
                break;

            case 'day':
                startDate = subDays(endDate, 1);
                intervalStart = startOfDay(startDate);
                intervalEnd = endOfDay(endDate);
                const dayResults = await prisma.monitoringResult.findMany({
                    where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } },
                    orderBy: { checkedAt: 'asc' },
                });
                const intervalMinutes = 30;
                const intervals = new Map<number, PrismaMonitoringResult[]>();
                dayResults.forEach(r => {
                    const intervalTimestamp = Math.floor(getUnixTime(new Date(r.checkedAt)) / (intervalMinutes * 60)) * (intervalMinutes * 60);
                    if (!intervals.has(intervalTimestamp)) intervals.set(intervalTimestamp, []);
                    intervals.get(intervalTimestamp)?.push(r);
                });
                chartData = Array.from(intervals.entries()).map(([timestamp, results]) => {
                    const stats = calculatePeriodStats(results);
                    return {
                        label: format(new Date(timestamp * 1000), 'HH:mm'),
                        timestamp: timestamp,
                        ...stats
                    };
                });
                break;

            case 'week':
            case 'month':
                startDate = (timeframe === 'week') ? subDays(endDate, 7) : subMonths(endDate, 1);
                intervalStart = startOfDay(startDate);
                intervalEnd = endOfDay(endDate);
                const daysInPeriod = eachDayOfInterval({ start: intervalStart, end: intervalEnd });
                const periodResults = await prisma.monitoringResult.findMany({
                    where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } },
                    orderBy: { checkedAt: 'asc' },
                });
                const resultsByDay = new Map<string, PrismaMonitoringResult[]>();
                periodResults.forEach(r => {
                    const dayKey = format(new Date(r.checkedAt), 'yyyy-MM-dd');
                    if (!resultsByDay.has(dayKey)) resultsByDay.set(dayKey, []);
                    resultsByDay.get(dayKey)?.push(r);
                });
                chartData = daysInPeriod.map((day): ChartDataPoint => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const dayStart = startOfDay(day);
                    const results = resultsByDay.get(dayKey) || [];
                    const stats = calculatePeriodStats(results);
                    return {
                        label: format(dayStart, 'MMM d'),
                        timestamp: getUnixTime(dayStart),
                        ...stats
                    };
                });
                break;

            case 'year':
                startDate = subYears(endDate, 1);
                intervalStart = startOfMonth(startDate);
                intervalEnd = endOfDay(endDate);
                const monthsInPeriod = eachMonthOfInterval({ start: intervalStart, end: intervalEnd });
                const yearResults = await prisma.monitoringResult.findMany({
                    where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } },
                    orderBy: { checkedAt: 'asc' },
                });
                const resultsByMonth = new Map<string, PrismaMonitoringResult[]>();
                yearResults.forEach(r => {
                    const monthKey = format(new Date(r.checkedAt), 'yyyy-MM');
                    if (!resultsByMonth.has(monthKey)) resultsByMonth.set(monthKey, []);
                    resultsByMonth.get(monthKey)?.push(r);
                });
                chartData = monthsInPeriod.map((monthDate): ChartDataPoint => {
                    const monthKey = format(monthDate, 'yyyy-MM');
                    const monthStart = startOfMonth(monthDate);
                    const results = resultsByMonth.get(monthKey) || [];
                    const stats = calculatePeriodStats(results);
                    return {
                        label: format(monthStart, 'MMM yyyy'),
                        timestamp: getUnixTime(monthStart),
                        ...stats
                    };
                });
                break;

            default:
                console.warn(`[StatsCalculator] Unsupported timeframe for chart data: ${timeframe}. Defaulting to week.`);
                return this.getChartDataForWebsite(websiteId, 'week');
        }

        chartData.sort((a, b) => a.timestamp - b.timestamp);
        return chartData;
    }

} // End StatsCalculator Class