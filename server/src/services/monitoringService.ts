// server/src/services/monitoringService.ts
import axios, { AxiosError } from 'axios';
import { performance } from 'perf_hooks';
import {
    Website as PrismaWebsite,
    MonitoringResult as PrismaMonitoringResult,
    PrismaClient,
    Prisma
} from '@prisma/client';
import { TIMEOUT_MS } from '../config/config';
import * as AlertService from './alertService';
import prisma from '../prisma/prismaClient';
import {
    subHours, subDays, subYears, subMonths,
    startOfDay, endOfDay, startOfMonth, endOfMonth,
    eachDayOfInterval, eachMonthOfInterval, format, getUnixTime,
    sub // Import 'sub' for date subtraction
} from 'date-fns';

// --- Import SHARED Types ---
import {
    MonitoringResponse,
    ResultsQueryOptions,
    WebsiteStatsData,
    OverallStats,
    TimeframeKey,
    ChartDataPoint,
    MonitoringResult,
    DowntimeInfo
} from '../types';

// ============================================================================
// WebsiteMonitor Class (No changes needed here)
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
                timeout: TIMEOUT_MS ?? 15000,
                headers: {
                    'User-Agent': 'PingifyMonitor/1.0 (+https://pingify.com/monitor)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                },
                validateStatus: () => true,
            });

            responseTime = Math.round(performance.now() - start);
            statusCode = response.status;
            isAvailable = statusCode >= 200 && statusCode < 300;

            if (!isAvailable) {
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
                errorMessage = 'Unknown error occurred during check.';
            }
            console.error(`[Check Error] ${url}: ${errorMessage} (Status: ${statusCode ?? 'N/A'})`);
        }

        return { responseTime, isAvailable, statusCode, errorMessage };
    }

    private static parseAxiosErrorMessage(error: AxiosError): string {
        if (error.response) {
            return `HTTP Error ${error.response.status}`;
        } else if (error.request) {
            if (error.code === 'ECONNABORTED') return `Request timed out (${TIMEOUT_MS ?? 15000}ms)`;
            if (error.code === 'ENOTFOUND') return 'DNS lookup failed (domain not found)';
            if (error.code === 'ECONNREFUSED') return 'Connection refused by server';
            if (error.code === 'ETIMEDOUT') return 'Connection timed out';
            if (error.code === 'EHOSTUNREACH') return 'No route to host';
            if (error.code === 'ECONNRESET') return 'Connection reset by peer';
            return 'No response received from server';
        } else {
            return `Request setup error: ${error.message}`;
        }
    }

    static async checkWebsite(website: PrismaWebsite): Promise<PrismaMonitoringResult> {
        const logPrefix = `[Monitor W:${website.id} ${website.url}]`;
        console.log(`${logPrefix} Starting check.`);
        let savedResult: PrismaMonitoringResult | null = null;

        try {
            const checkResultData = await this.performWebsiteCheck(website.url);
            savedResult = await ResultsManager.saveResult(website.id, checkResultData);
            console.log(`${logPrefix} Result saved (ID: ${savedResult.id}): Avail=${savedResult.isAvailable}, RT=${savedResult.responseTime}ms, Status=${savedResult.statusCode}, Err=${savedResult.errorMessage ?? 'None'}`);

            if (savedResult) {
                 await AlertService.handlePotentialAlertCondition(website, savedResult);
            } else {
                console.error(`${logPrefix} Saved result was unexpectedly null after save attempt.`);
                throw new Error("Failed to obtain saved result after check.");
            }

            return savedResult;

        } catch (error: any) {
            console.error(`${logPrefix} Critical failure during checkWebsite process: ${error.message}`, error.stack);
            try {
                await prisma.website.update({
                    where: { id: website.id },
                    data: { lastChecked: new Date() }
                });
                 console.warn(`${logPrefix} Updated lastChecked despite error during check/alert processing.`);
            } catch (updateError) {
                 console.error(`${logPrefix} Failed to update lastChecked after error:`, updateError);
            }
            throw error;
        }
    }

}

// ============================================================================
// ResultsManager Class (No changes needed here)
// ============================================================================
export class ResultsManager {

    static async saveResult( websiteId: number, result: MonitoringResponse ): Promise<PrismaMonitoringResult> {
        const { responseTime, isAvailable, statusCode, errorMessage } = result;
        const checkedAt = new Date();
        try {
            const savedMonitoringResult = await prisma.$transaction(async (tx) => {
                await tx.website.update({
                    where: { id: websiteId },
                    data: { lastChecked: checkedAt },
                });
                const monitoringResult = await tx.monitoringResult.create({
                    data: {
                        websiteId,
                        responseTime,
                        isAvailable,
                        statusCode,
                        errorMessage,
                        checkedAt,
                    },
                });
                return monitoringResult;
            });
            return savedMonitoringResult;
        } catch (error) {
            console.error(`[ResultsManager] Error saving result for website ${websiteId}:`, error);
            throw error;
        }
    }

    static async getLatestResultId(websiteId: number): Promise<number> {
        const result = await prisma.monitoringResult.findFirst({
            where: { websiteId },
            orderBy: { checkedAt: 'desc' },
            select: { id: true },
        });
        return result?.id || 0;
    }

    static async getResultsForWebsite(websiteId: number, limit = 100): Promise<PrismaMonitoringResult[]> {
        return prisma.monitoringResult.findMany({
            where: { websiteId },
            orderBy: { checkedAt: 'desc' },
            take: limit,
        });
    }

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
            include: { website: { select: { url: true } } }
        });
    }

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
        });
    }

    static async getResultsForUser( userId: number, options: ResultsQueryOptions = {} ): Promise< (PrismaMonitoringResult & { website: { websiteUsers: { name: string | null }[] } | null })[] > {
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
            include: {
                website: {
                    include: {
                        websiteUsers: {
                            where: { userId },
                            select: { name: true }
                        }
                    }
                }
            }
        });
    }
}


// ============================================================================
// StatsCalculator Class (MODIFIED getOverallStats)
// ============================================================================
export class StatsCalculator {

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

    static async getCurrentDowntimeInfo(websiteId: number): Promise<DowntimeInfo> {
        const recentResults = await prisma.monitoringResult.findMany({
            where: { websiteId },
            orderBy: { checkedAt: 'desc' },
            take: 300,
            select: { isAvailable: true, checkedAt: true }
        });

        if (recentResults.length === 0) {
            return { consecutiveFailures: 0, downtimeStartedAt: null };
        }

        if (recentResults[0].isAvailable) {
            return { consecutiveFailures: 0, downtimeStartedAt: null };
        }

        let consecutiveFailures = 0;
        let downtimeStartedAt: Date | null = recentResults[0].checkedAt;

        for (const result of recentResults) {
            if (!result.isAvailable) {
                consecutiveFailures++;
                downtimeStartedAt = result.checkedAt;
            } else {
                break;
            }
        }

        return { consecutiveFailures, downtimeStartedAt };
    }

    private static periodToDays(period: TimeframeKey | string): number {
        switch (period) {
            case 'hour': return 1 / 24;
            case 'day': return 1;
            case 'week': return 7;
            case 'month': return 30;
            case 'year': return 365;
        }
        if (typeof period === 'number') return period > 0 ? period : 7;
        if (typeof period === 'string') {
             const value = parseInt(period);
             if (!isNaN(value) && value > 0) return value;
        }
        return 7;
    }

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
            consecutiveFailuresHistorical,
            totalChecks
        ] = await Promise.all([
            this.calculateUptimeBetweenDates(websiteId, startDate),
            this.getAverageResponseTimeBetweenDates(websiteId, startDate),
            prisma.monitoringResult.findFirst({
                where: { websiteId },
                orderBy: { checkedAt: 'desc' },
                select: { checkedAt: true }
            }),
            this.getConsecutiveFailures(websiteId), // Kept for potential separate use
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
            consecutiveFailures: consecutiveFailuresHistorical
        };
    }

    /**
     * Calculates overall stats for all websites or only those monitored by a user.
     * Returns the SHARED OverallStats type.
     * MODIFIED: Changed calculation for incidentsLast24h to count failed MonitoringResult records.
     */
    static async getOverallStats( userId?: number, period: TimeframeKey | string = 'week' ): Promise<OverallStats> {
        const days = this.periodToDays(period);
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        // Calculate start time for 24-hour incident window
        const twentyFourHoursAgo = sub(new Date(), { hours: 24 });

        // Define the base filter for websites (all or user-specific)
        const websiteWhere: Prisma.WebsiteWhereInput = userId
            ? { websiteUsers: { some: { userId } } }
            : {};

        // Get total and active counts based on the filter
        const [totalWebsites, activeWebsitesCount] = await Promise.all([
            prisma.website.count({ where: websiteWhere }),
            prisma.website.count({ where: { ...websiteWhere, isActive: true } })
        ]);

        // Fetch only the IDs of active websites matching the filter
        const activeWebsitesList = await prisma.website.findMany({
            where: { ...websiteWhere, isActive: true },
            select: { id: true }
        });
        const activeWebsiteIds = activeWebsitesList.map(w => w.id);

        // Get detailed stats for each *active* website
        const websiteStatsPromises = activeWebsiteIds.map(websiteId =>
            this.getWebsiteStats(websiteId, userId, period)
        );

        // --- MODIFIED: Calculate incidents based on MonitoringResult ---
        let incidentCountPromise: Promise<number>;
        if (userId) {
            // Count failed checks for websites monitored by this user in the last 24h
            if (activeWebsiteIds.length > 0) {
                incidentCountPromise = prisma.monitoringResult.count({
                    where: {
                        websiteId: { in: activeWebsiteIds }, // Only user's websites
                        checkedAt: { gte: twentyFourHoursAgo },
                        isAvailable: false // Count checks where site was down
                        // NOTE: Slow incidents are not counted here for simplicity
                    }
                });
            } else {
                // If user monitors no websites, count is 0
                incidentCountPromise = Promise.resolve(0);
            }
        } else {
            // System-wide: Count all failed checks in the last 24h
            incidentCountPromise = prisma.monitoringResult.count({
                where: {
                    checkedAt: { gte: twentyFourHoursAgo },
                    isAvailable: false // Count checks where site was down
                }
            });
        }
        // --- END MODIFIED ---

        // Wait for all promises including the new incident count
        const [websiteStats, incidentsLast24h] = await Promise.all([
            Promise.all(websiteStatsPromises), // Existing website stats calculation
            incidentCountPromise // New incident count calculation
        ]);

        // Calculate overall metrics based on the fetched detailed stats
        const validUptimeStats = websiteStats.filter(stat => stat.totalChecks > 0);
        const overallUptime = validUptimeStats.length > 0
            ? validUptimeStats.reduce((sum, stat) => sum + stat.uptime, 0) / validUptimeStats.length
            : 100;

        const validResponseStats = websiteStats.filter(stat => stat.averageResponseTime !== null);
        const overallResponseTime = validResponseStats.length > 0
            ? Math.round(validResponseStats.reduce((sum, stat) => sum + stat.averageResponseTime!, 0) / validResponseStats.length)
            : null;

        // Construct object matching the SHARED OverallStats type
        return {
            totalWebsites,
            activeWebsites: activeWebsitesCount,
            websiteStats,
            overallUptime: parseFloat(overallUptime.toFixed(2)),
            overallResponseTime,
            // Include the fetched count (now based on failed checks)
            incidentsLast24h
        };
    }


    static async getUserDashboardStats( userId: number, period: TimeframeKey | string = 'week' ): Promise<OverallStats> {
        // The main function now calculates incidents based on MonitoringResult for the specific user
        return this.getOverallStats(userId, period);
    }


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
                const intervalMinutesDay = 30;
                const intervalsDay = new Map<number, PrismaMonitoringResult[]>();
                dayResults.forEach(r => {
                    const intervalTimestamp = Math.floor(getUnixTime(new Date(r.checkedAt)) / (intervalMinutesDay * 60)) * (intervalMinutesDay * 60);
                    if (!intervalsDay.has(intervalTimestamp)) intervalsDay.set(intervalTimestamp, []);
                    intervalsDay.get(intervalTimestamp)?.push(r);
                });
                chartData = Array.from(intervalsDay.entries()).map(([timestamp, results]) => {
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
                const periodResultsWkMo = await prisma.monitoringResult.findMany({
                    where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } },
                    orderBy: { checkedAt: 'asc' },
                });
                const resultsByDay = new Map<string, PrismaMonitoringResult[]>();
                periodResultsWkMo.forEach(r => {
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
                console.warn(`[StatsCalculator] Unsupported timeframe for chart data: ${timeframe}. Defaulting to 'week'.`);
                return this.getChartDataForWebsite(websiteId, 'week');
        }

        chartData.sort((a, b) => a.timestamp - b.timestamp);
        return chartData;
    }

}