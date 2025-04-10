// server/src/services/monitoringService.ts
import axios, { AxiosError } from 'axios';
import { performance } from 'perf_hooks';
import {
    Website as PrismaWebsite,
    MonitoringResult as PrismaMonitoringResult,
    PrismaClient,
    Prisma,
    Incident as PrismaIncident, // Import Incident
} from '@prisma/client';
import { TIMEOUT_MS } from '../config/config';
// --- UPDATED: Import handleResultProcessing from AlertService ---
import { handleResultProcessing } from './alertService';
// --- NEW: Import IncidentService ---
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
    // DownWebsite, // Removed
    // DowntimeInfo, // Removed
    Incident, // Import Incident type
    IncidentType, // Import IncidentType
} from '../types';

// ============================================================================
// WebsiteMonitor Class
// ============================================================================
export class WebsiteMonitor {
    // performWebsiteCheck and parseAxiosErrorMessage remain unchanged

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


    /**
     * Performs a check, saves the result, and triggers incident/recovery processing.
     */
    static async checkWebsite(website: PrismaWebsite): Promise<PrismaMonitoringResult> {
        const logPrefix = `[Monitor W:${website.id} ${website.url}]`;
        console.log(`${logPrefix} Starting check.`);
        let savedResult: PrismaMonitoringResult | null = null;

        try {
            const checkResultData = await this.performWebsiteCheck(website.url);
            // Save the result first (includes updating lastChecked)
            savedResult = await ResultsManager.saveResult(website.id, checkResultData);
            console.log(`${logPrefix} Result saved (ID: ${savedResult.id}): Avail=${savedResult.isAvailable}, RT=${savedResult.responseTime}ms, Status=${savedResult.statusCode}, Err=${savedResult.errorMessage ?? 'None'}`);

            // --- NEW: Process the result for incidents/recoveries ---
            if (savedResult) {
                // Call the central processing function from AlertService (which now handles incidents too)
                // Run this asynchronously (don't wait for it) but catch errors
                handleResultProcessing(website, savedResult).catch(procError => {
                    console.error(`${logPrefix} Error during post-check result processing for R:${savedResult?.id}:`, procError);
                });
            } else {
                console.error(`${logPrefix} Saved result was unexpectedly null after save attempt.`);
                throw new Error("Failed to obtain saved result after check.");
            }

            return savedResult; // Return the saved result immediately

        } catch (error: any) {
            console.error(`${logPrefix} Critical failure during checkWebsite process: ${error.message}`, error.stack);
            // Attempt to update lastChecked even on error, but this might already be done by saveResult
            try {
                if (!savedResult) { // Only update if saveResult failed before updating
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
// ResultsManager Class (No changes needed)
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
                        websiteId, responseTime, isAvailable, statusCode, errorMessage, checkedAt,
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
            where: { websiteId }, orderBy: { checkedAt: 'desc' }, select: { id: true },
        });
        return result?.id || 0;
    }

    static async getResultsForWebsite(websiteId: number, limit = 100): Promise<PrismaMonitoringResult[]> {
        return prisma.monitoringResult.findMany({
            where: { websiteId }, orderBy: { checkedAt: 'desc' }, take: limit,
        });
    }

    static async getAllResults(options: ResultsQueryOptions = {}): Promise< (PrismaMonitoringResult & { website: { url: string } | null })[] > {
        const { limit = 100, from, to } = options;
        const whereClause: Prisma.MonitoringResultWhereInput = {};
        if (from || to) { whereClause.checkedAt = {}; if (from) whereClause.checkedAt.gte = from; if (to) whereClause.checkedAt.lte = to; }
        return prisma.monitoringResult.findMany({
            where: whereClause, orderBy: { checkedAt: 'desc' }, take: limit,
            include: { website: { select: { url: true } } }
        });
    }

    static async getFilteredResultsByWebsite( websiteId: number, options: ResultsQueryOptions = {} ): Promise<PrismaMonitoringResult[]> {
        const { limit = 100, from, to } = options;
        const whereClause: Prisma.MonitoringResultWhereInput = { websiteId };
        if (from || to) { whereClause.checkedAt = {}; if (from) whereClause.checkedAt.gte = from; if (to) whereClause.checkedAt.lte = to; }
        return prisma.monitoringResult.findMany({
            where: whereClause, orderBy: { checkedAt: 'desc' }, take: limit
        });
    }

    static async getResultsForUser( userId: number, options: ResultsQueryOptions = {} ): Promise< (PrismaMonitoringResult & { website: { websiteUsers: { name: string | null }[] } | null })[] > {
        const { limit = 100, from, to } = options;
        const whereClause: Prisma.MonitoringResultWhereInput = { website: { websiteUsers: { some: { userId } } } };
        if (from || to) { whereClause.checkedAt = {}; if (from) whereClause.checkedAt.gte = from; if (to) whereClause.checkedAt.lte = to; }
        return prisma.monitoringResult.findMany({
            where: whereClause, orderBy: { checkedAt: 'desc' }, take: limit,
            include: { website: { include: { websiteUsers: { where: { userId }, select: { name: true } } } } }
        });
    }
}
// ============================================================================
// StatsCalculator Class (MODIFIED)
// ============================================================================
export class StatsCalculator {
    // calculateUptimeBetweenDates remains the same
    static async calculateUptimeBetweenDates(websiteId: number, startDate: Date, endDate: Date = new Date()): Promise<number> {
        const results = await prisma.monitoringResult.findMany({
            where: { websiteId, checkedAt: { gte: startDate, lte: endDate } },
            select: { isAvailable: true }
        });
        const totalChecks = results.length;
        if (totalChecks === 0) return 100;
        const successfulChecks = results.filter(r => r.isAvailable).length;
        const uptimePercentage = (successfulChecks / totalChecks) * 100;
        return parseFloat(uptimePercentage.toFixed(2));
    }

    // getAverageResponseTimeBetweenDates remains the same
    static async getAverageResponseTimeBetweenDates(websiteId: number, startDate: Date, endDate: Date = new Date()): Promise<number | null> {
        const result = await prisma.monitoringResult.aggregate({
            _avg: { responseTime: true },
            where: {
                websiteId, checkedAt: { gte: startDate, lte: endDate }, isAvailable: true, responseTime: { not: null }
            },
        });
        return result._avg.responseTime !== null ? Math.round(result._avg.responseTime) : null;
    }

    // --- REMOVED: getConsecutiveFailures (Incident model tracks duration) ---
    // --- REMOVED: getDownWebsitesLast24h (Query Incident table instead) ---
    // --- REMOVED: getCurrentDowntimeInfo (Incident model tracks start/end) ---

    // periodToDays remains the same
    private static periodToDays(period: TimeframeKey | string): number {
        switch (period) {
            case 'hour': return 1 / 24; case 'day': return 1; case 'week': return 7; case 'month': return 30; case 'year': return 365;
        }
        if (typeof period === 'number') return period > 0 ? period : 7;
        if (typeof period === 'string') { const value = parseInt(period); if (!isNaN(value) && value > 0) return value; }
        return 7;
    }

    /**
     * Calculates statistics for a single website over a given period.
     * Includes uptime, avg response time, and incident counts for the period.
     */
    static async getWebsiteStats( websiteId: number, userId?: number, period: TimeframeKey | string = 'week' ): Promise<WebsiteStatsData> {
        const days = this.periodToDays(period);
        const startDate = sub(new Date(), { days: days });
        const endDate = new Date(); // Use current time as end date for period

        const website = await prisma.website.findUnique({
            where: { id: websiteId },
            select: { url: true }
        });
        if (!website) throw new Error(`Website with ID ${websiteId} not found`);

        let websiteName = website.url;
        if (userId) {
            const userWebsite = await prisma.websiteUser.findUnique({
                where: { userId_websiteId: { userId, websiteId } }, select: { name: true }
            });
            if (userWebsite?.name) websiteName = userWebsite.name;
        }

        // Fetch stats based on MonitoringResult within the period
        const [ uptime, averageResponseTime, totalChecks, lastResultData ] = await Promise.all([
            this.calculateUptimeBetweenDates(websiteId, startDate, endDate),
            this.getAverageResponseTimeBetweenDates(websiteId, startDate, endDate),
            prisma.monitoringResult.count({ where: { websiteId, checkedAt: { gte: startDate, lte: endDate } } }),
            prisma.monitoringResult.findFirst({ where: { websiteId }, orderBy: { checkedAt: 'desc' }, select: { checkedAt: true } })
        ]);

        // Fetch incident counts where startTime falls within the period
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
            // Add incident counts for the period
            incidentCount: totalIncidentCount,
            downIncidentCount: downIncidentCount,
            slowIncidentCount: slowIncidentCount,
        };
    }

    /**
     * Calculates overall stats for all websites or only those monitored by a user.
     * Returns the SHARED OverallStats type.
     * UPDATED: Uses Incident table for incident-related stats.
     */
    static async getOverallStats( userId?: number, period: TimeframeKey | string = 'week' ): Promise<OverallStats> {
        const days = this.periodToDays(period);
        const periodStartDate = sub(new Date(), { days }); // Start date for uptime/avg response time stats
        const twentyFourHoursAgo = sub(new Date(), { hours: 24 }); // For 24h incident count

        const websiteWhere: Prisma.WebsiteWhereInput = userId ? { websiteUsers: { some: { userId } } } : {};

        const [totalWebsites, activeWebsitesCount] = await Promise.all([
            prisma.website.count({ where: websiteWhere }),
            prisma.website.count({ where: { ...websiteWhere, isActive: true } })
        ]);

        const activeWebsitesList = await prisma.website.findMany({
            where: { ...websiteWhere, isActive: true },
            select: { id: true }
        });
        const activeWebsiteIds = activeWebsitesList.map(w => w.id);

        // --- Calculate Overall Uptime/Response Time (using period) ---
        const websiteStatsPromises = activeWebsiteIds.map(websiteId =>
            // Get stats for the specified period
            this.getWebsiteStats(websiteId, userId, period)
        );
        const websiteStats = await Promise.all(websiteStatsPromises);

        const validUptimeStats = websiteStats.filter(stat => stat.totalChecks > 0);
        const overallUptime = validUptimeStats.length > 0
            ? validUptimeStats.reduce((sum, stat) => sum + stat.uptime, 0) / validUptimeStats.length
            : 100;

        const validResponseStats = websiteStats.filter(stat => stat.averageResponseTime !== null);
        const overallResponseTime = validResponseStats.length > 0
            ? Math.round(validResponseStats.reduce((sum, stat) => sum + stat.averageResponseTime!, 0) / validResponseStats.length)
            : null;

        // --- Calculate Incidents Data (using Incident table) ---
        let incidentsLast24h = 0;
        let lastIncident: PrismaIncident | null = null;

        if (activeWebsiteIds.length > 0) {
            // Count incidents started in the last 24 hours for the relevant websites
            incidentsLast24h = await IncidentService.countIncidents({
                from: twentyFourHoursAgo,
                // Filter by user's websites if userId is provided
                ...(userId && { userId: userId }),
                // Only count incidents for currently active websites if needed (optional refinement)
                // websiteId: { in: activeWebsiteIds }
            });

            // Find the most recent incident overall (or for the user)
            lastIncident = await IncidentService.getMostRecentIncident(userId);
        }

        // --- Return OverallStats Object ---
        return {
            totalWebsites,
            activeWebsites: activeWebsitesCount,
            websiteStats, // Individual stats calculated over the 'period'
            overallUptime: parseFloat(overallUptime.toFixed(2)),
            overallResponseTime,
            incidentsLast24h, // Count from Incident table (last 24h)
            lastIncidentTimestamp: lastIncident ? lastIncident.startTime.toISOString() : null,
            lastIncidentWebsiteId: lastIncident ? lastIncident.websiteId : null,
        };
    }

    // getUserDashboardStats remains the same (delegates to getOverallStats)
    static async getUserDashboardStats( userId: number, period: TimeframeKey | string = 'week' ): Promise<OverallStats> {
        return this.getOverallStats(userId, period);
    }

    // getChartDataForWebsite remains the same
    static async getChartDataForWebsite( websiteId: number, timeframe: TimeframeKey ): Promise<ChartDataPoint[]> {
        const endDate = new Date();
        let chartData: ChartDataPoint[] = [];
        let startDate: Date;
        let intervalStart: Date, intervalEnd: Date;

        const calculatePeriodStats = (resultsInPeriod: PrismaMonitoringResult[]): { avgResponseTime: number | null, uptimeRatio: number, checkCount: number } => {
            const totalChecks = resultsInPeriod.length;
            if (totalChecks === 0) return { avgResponseTime: null, uptimeRatio: 1.0, checkCount: 0 };
            const successfulChecks = resultsInPeriod.filter(r => r.isAvailable).length;
            const validResponseTimes = resultsInPeriod.filter(r => r.isAvailable && r.responseTime !== null).map(r => r.responseTime!);
            const avgResponseTime = validResponseTimes.length > 0 ? Math.round(validResponseTimes.reduce((s, rt) => s + rt, 0) / validResponseTimes.length) : null;
            const uptimeRatio = successfulChecks / totalChecks;
            return { avgResponseTime, uptimeRatio: parseFloat(uptimeRatio.toFixed(4)), checkCount: totalChecks };
        };

        switch (timeframe) {
            case 'hour':
                startDate = subHours(endDate, 1);
                const hourResults = await prisma.monitoringResult.findMany({ where: { websiteId, checkedAt: { gte: startDate, lte: endDate } }, orderBy: { checkedAt: 'asc' }, take: 200 });
                chartData = hourResults.map(r => ({ label: format(new Date(r.checkedAt), 'HH:mm'), timestamp: getUnixTime(new Date(r.checkedAt)), avgResponseTime: r.isAvailable ? r.responseTime : null, uptimeRatio: r.isAvailable ? 1.0 : 0.0, checkCount: 1 }));
                break;
            case 'day':
                startDate = subDays(endDate, 1); intervalStart = startOfDay(startDate); intervalEnd = endOfDay(endDate);
                const dayResults = await prisma.monitoringResult.findMany({ where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } }, orderBy: { checkedAt: 'asc' } });
                const intervalMinutesDay = 30; const intervalsDay = new Map<number, PrismaMonitoringResult[]>();
                dayResults.forEach(r => { const intervalTimestamp = Math.floor(getUnixTime(new Date(r.checkedAt)) / (intervalMinutesDay * 60)) * (intervalMinutesDay * 60); if (!intervalsDay.has(intervalTimestamp)) intervalsDay.set(intervalTimestamp, []); intervalsDay.get(intervalTimestamp)?.push(r); });
                chartData = Array.from(intervalsDay.entries()).map(([timestamp, results]) => { const stats = calculatePeriodStats(results); return { label: format(new Date(timestamp * 1000), 'HH:mm'), timestamp: timestamp, ...stats }; });
                break;
            case 'week': case 'month':
                startDate = (timeframe === 'week') ? subDays(endDate, 7) : subMonths(endDate, 1); intervalStart = startOfDay(startDate); intervalEnd = endOfDay(endDate);
                const daysInPeriod = eachDayOfInterval({ start: intervalStart, end: intervalEnd });
                const periodResultsWkMo = await prisma.monitoringResult.findMany({ where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } }, orderBy: { checkedAt: 'asc' } });
                const resultsByDay = new Map<string, PrismaMonitoringResult[]>();
                periodResultsWkMo.forEach(r => { const dayKey = format(new Date(r.checkedAt), 'yyyy-MM-dd'); if (!resultsByDay.has(dayKey)) resultsByDay.set(dayKey, []); resultsByDay.get(dayKey)?.push(r); });
                chartData = daysInPeriod.map((day): ChartDataPoint => { const dayKey = format(day, 'yyyy-MM-dd'); const dayStart = startOfDay(day); const results = resultsByDay.get(dayKey) || []; const stats = calculatePeriodStats(results); return { label: format(dayStart, 'MMM d'), timestamp: getUnixTime(dayStart), ...stats }; });
                break;
            case 'year':
                startDate = subYears(endDate, 1); intervalStart = startOfMonth(startDate); intervalEnd = endOfDay(endDate);
                const monthsInPeriod = eachMonthOfInterval({ start: intervalStart, end: intervalEnd });
                const yearResults = await prisma.monitoringResult.findMany({ where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } }, orderBy: { checkedAt: 'asc' } });
                const resultsByMonth = new Map<string, PrismaMonitoringResult[]>();
                yearResults.forEach(r => { const monthKey = format(new Date(r.checkedAt), 'yyyy-MM'); if (!resultsByMonth.has(monthKey)) resultsByMonth.set(monthKey, []); resultsByMonth.get(monthKey)?.push(r); });
                chartData = monthsInPeriod.map((monthDate): ChartDataPoint => { const monthKey = format(monthDate, 'yyyy-MM'); const monthStart = startOfMonth(monthDate); const results = resultsByMonth.get(monthKey) || []; const stats = calculatePeriodStats(results); return { label: format(monthStart, 'MMM yyyy'), timestamp: getUnixTime(monthStart), ...stats }; });
                break;
            default:
                console.warn(`[StatsCalculator] Unsupported timeframe for chart data: ${timeframe}. Defaulting to 'week'.`);
                return this.getChartDataForWebsite(websiteId, 'week');
        }
        chartData.sort((a, b) => a.timestamp - b.timestamp);
        return chartData;
    }

    // --- REMOVED: countUserDistinctWebsiteIncidentsLast24h (Replaced by IncidentService.countIncidents) ---

} // End StatsCalculator Class