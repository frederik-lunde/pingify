// server/src/services/monitoringService.ts
import axios, { AxiosError } from 'axios';
import { performance } from 'perf_hooks';
import {
    Website as PrismaWebsite,
    MonitoringResult as PrismaMonitoringResult,
    WebsiteUser as PrismaWebsiteUser, // Import the full type
    PrismaClient,
    Prisma
} from '@prisma/client';
import { TIMEOUT_MS, RECHECK_DELAY_SECONDS } from '../config/config';
import { processAlerts } from './alertService'; // Ensure this path is correct
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
    MonitoringResult as SharedMonitoringResult
} from '../types'; // Adjust path/scope as needed

// --- Internal state for pending re-checks ---
const pendingRechecks = new Set<number>();


// ============================================================================
// WebsiteMonitor Class
// ============================================================================
export class WebsiteMonitor {

    static async performWebsiteCheck(url: string): Promise<MonitoringResponse> {
        // ... (implementation remains the same)
        const start = performance.now(); let responseTime: number | null = null; let isAvailable = false; let statusCode: number | null = null; let errorMessage: string | null = null; try { const response = await axios.get(url, { timeout: TIMEOUT_MS, headers: { 'User-Agent': 'UptimeMonitor/1.0 (+https://yourdomain.com/monitor)', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8', 'Accept-Encoding': 'gzip, deflate, br', }, validateStatus: () => true, }); responseTime = Math.round(performance.now() - start); statusCode = response.status; isAvailable = statusCode >= 200 && statusCode < 300; if (!isAvailable) { errorMessage = `HTTP Status ${statusCode}`; } } catch (error: unknown) { responseTime = Math.round(performance.now() - start); isAvailable = false; if (axios.isAxiosError(error)) { statusCode = error.response?.status ?? null; errorMessage = this.parseAxiosErrorMessage(error); } else if (error instanceof Error) { errorMessage = error.message; } else { errorMessage = 'Unknown error occurred during check.'; } console.error(`Check failed for ${url}: ${errorMessage} (Status: ${statusCode ?? 'N/A'})`); } return { responseTime, isAvailable, statusCode, errorMessage };
    }

    private static parseAxiosErrorMessage(error: AxiosError): string {
        // ... (implementation remains the same)
        if (error.response) { return `HTTP Error ${error.response.status}`; } else if (error.request) { if (error.code === 'ECONNABORTED') return `Request timed out (${TIMEOUT_MS}ms)`; if (error.code === 'ENOTFOUND') return 'DNS lookup failed'; if (error.code === 'ECONNREFUSED') return 'Connection refused'; if (error.code === 'ETIMEDOUT') return 'Connection timed out'; return 'No response from server'; } else { return `Request setup error: ${error.message}`; }
    }

    static async checkWebsite(website: PrismaWebsite): Promise<void> {
        // ... (implementation remains the same - Step 1, 2) ...
         console.log(`[Check 1] Starting for ${website.url} (ID: ${website.id})`); let savedFirstResult: PrismaMonitoringResult | null = null; try { const firstCheckResultData = await this.performWebsiteCheck(website.url); savedFirstResult = await ResultsManager.saveResult(website.id, firstCheckResultData); console.log(`[Check 1] Saved for ${website.id}: Avail=${savedFirstResult.isAvailable}, RT=${savedFirstResult.responseTime}ms, Status=${savedFirstResult.statusCode}, Err=${savedFirstResult.errorMessage ?? 'None'}`); const websiteUsers = await prisma.websiteUser.findMany({ where: { websiteId: website.id, alertEnabled: true }, select: { userId: true, alertThreshold: true } }); if (websiteUsers.length === 0) { console.log(`[Check 1] No users with alerts enabled for ${website.id}.`); return; } let needsRecheck = false; if (!savedFirstResult.isAvailable) { needsRecheck = true; console.log(`[Check 1] Status DOWN for ${website.id}. Scheduling re-check.`); } else if (savedFirstResult.responseTime !== null) { const isSlowForSomeone = websiteUsers.some(user => user.alertThreshold !== null && savedFirstResult!.responseTime! > user.alertThreshold ); if (isSlowForSomeone) { needsRecheck = true; console.log(`[Check 1] Status potentially SLOW for ${website.id}. Scheduling re-check.`); } } if (needsRecheck) { if (!pendingRechecks.has(website.id)) { pendingRechecks.add(website.id); console.log(`[Re-check] Scheduling for ${website.id} in ${RECHECK_DELAY_SECONDS}s.`); setTimeout(() => { (async () => { try { await this.performRecheckAndProcessAlerts(website, savedFirstResult!.id); } catch (recheckError) { console.error(`[Re-check] Error during re-check execution for ${website.id}:`, recheckError); } finally { pendingRechecks.delete(website.id); console.log(`[Re-check] Completed for ${website.id}.`); } })(); }, RECHECK_DELAY_SECONDS * 1000); } else { console.log(`[Check 1] Re-check already pending for ${website.id}.`); } } else { console.log(`[Check 1] Status OK for ${website.id}. Processing potential recovery.`); await this.processRecoveryAlerts(website, savedFirstResult); } } catch (error: any) { console.error(`[Check 1] Critical failure during checkWebsite for ${website.id}: ${error.message}`, error.stack); }
    }

    /**
     * Performs the second check and triggers alert processing.
     */
    static async performRecheckAndProcessAlerts(
        website: PrismaWebsite,
        firstResultId: number
    ): Promise<void> {
        console.log(`[Re-check] Starting for ${website.url} (ID: ${website.id}), comparing with result ${firstResultId}`);
        let savedSecondResult: PrismaMonitoringResult | null = null;

        try {
            const secondCheckResultData = await this.performWebsiteCheck(website.url);
            savedSecondResult = await ResultsManager.saveResult(website.id, secondCheckResultData);
            console.log(`[Re-check] Saved for ${website.id}: Avail=${savedSecondResult.isAvailable}, RT=${savedSecondResult.responseTime}ms, Status=${savedSecondResult.statusCode}, Err=${savedSecondResult.errorMessage ?? 'None'}`);
        } catch (error: any) {
            console.error(`[Re-check] Failed second check/save for ${website.id}: ${error.message}`, error.stack);
            return; // Exit if the re-check itself fails
        }

        try {
            const savedFirstResult = await prisma.monitoringResult.findUnique({
                where: { id: firstResultId }
            });

            if (!savedFirstResult) {
                console.error(`[Re-check] CRITICAL: Could not find first result (ID: ${firstResultId}) for ${website.id}. Processing recovery based on second check only.`);
                await this.processRecoveryAlerts(website, savedSecondResult); // Fallback to recovery check
                return;
            }

            // *** FIX: Fetch the FULL WebsiteUser object, not just selected fields ***
            const websiteUsers = await prisma.websiteUser.findMany({
                where: { websiteId: website.id, alertEnabled: true },
                // NO select clause here, get all fields needed by processAlerts
            });

            console.log(`[Re-check] Processing alerts for ${websiteUsers.length} users for ${website.id}.`);
            for (const websiteUser of websiteUsers) {
                 // Now 'websiteUser' has the full PrismaWebsiteUser type
                await processAlerts(
                    website,
                    websiteUser,      // Pass the full object
                    savedFirstResult,
                    savedSecondResult
                );
            }
        } catch (error: any) {
            console.error(`[Re-check] Error during alert processing after re-check for ${website.id}: ${error.message}`, error.stack);
        }
    }

    /**
     * Processes potential recovery alerts after a single OK check.
     */
    static async processRecoveryAlerts(
        website: PrismaWebsite,
        currentOkResult: PrismaMonitoringResult
    ): Promise<void> {
        console.log(`[Recovery Proc] Checking for recoveries for ${website.id} based on OK result ${currentOkResult.id}`);
        try {
            // *** FIX: Fetch the FULL WebsiteUser object ***
            const websiteUsers = await prisma.websiteUser.findMany({
                where: { websiteId: website.id, alertEnabled: true },
                 // NO select clause here
            });

            for (const websiteUser of websiteUsers) {
                // Now 'websiteUser' has the full PrismaWebsiteUser type
                await processAlerts(
                    website,
                    websiteUser,      // Pass the full object
                    null,             // Signal recovery check mode
                    currentOkResult
                );
            }
        } catch (error: any) {
            console.error(`[Recovery Proc] Error processing recovery alerts for ${website.id}: ${error.message}`, error.stack);
        }
    }

} // End WebsiteMonitor Class


// ============================================================================
// ResultsManager Class
// ============================================================================
export class ResultsManager {
    // ... (Implementations for saveResult, getLatestResultId, etc. remain the same) ...
    static async saveResult( websiteId: number, result: MonitoringResponse ): Promise<PrismaMonitoringResult> { const { responseTime, isAvailable, statusCode, errorMessage } = result; const checkedAt = new Date(); try { return await prisma.$transaction(async (tx) => { await tx.website.update({ where: { id: websiteId }, data: { lastChecked: checkedAt }, }); const monitoringResult = await tx.monitoringResult.create({ data: { websiteId, responseTime, isAvailable, statusCode, errorMessage, checkedAt }, }); return monitoringResult; }); } catch (error) { console.error(`Error saving monitoring result for website ${websiteId}:`, error); throw error; } }
    static async getLatestResultId(websiteId: number): Promise<number> { const result = await prisma.monitoringResult.findFirst({ where: { websiteId }, orderBy: { checkedAt: 'desc' }, select: { id: true }, }); return result?.id || 0; }
    static async getResultsForWebsite(websiteId: number, limit = 100): Promise<PrismaMonitoringResult[]> { return prisma.monitoringResult.findMany({ where: { websiteId }, orderBy: { checkedAt: 'desc' }, take: limit, }); }
    static async getAllResults(options: ResultsQueryOptions = {}): Promise<PrismaMonitoringResult[]> { const { limit = 100, from, to } = options; const whereClause: Prisma.MonitoringResultWhereInput = {}; if (from || to) { whereClause.checkedAt = {}; if (from) whereClause.checkedAt.gte = from; if (to) whereClause.checkedAt.lte = to; } return prisma.monitoringResult.findMany({ where: whereClause, orderBy: { checkedAt: 'desc' }, take: limit, include: { website: { select: { url: true } } } }); }
    static async getFilteredResultsByWebsite( websiteId: number, options: ResultsQueryOptions = {} ): Promise<PrismaMonitoringResult[]> { const { limit = 100, from, to } = options; const whereClause: Prisma.MonitoringResultWhereInput = { websiteId }; if (from || to) { whereClause.checkedAt = {}; if (from) whereClause.checkedAt.gte = from; if (to) whereClause.checkedAt.lte = to; } return prisma.monitoringResult.findMany({ where: whereClause, orderBy: { checkedAt: 'desc' }, take: limit }); }
    static async getResultsForUser( userId: number, options: ResultsQueryOptions = {} ): Promise<PrismaMonitoringResult[]> { const { limit = 100, from, to } = options; const whereClause: Prisma.MonitoringResultWhereInput = { website: { websiteUsers: { some: { userId } } } }; if (from || to) { whereClause.checkedAt = {}; if (from) whereClause.checkedAt.gte = from; if (to) whereClause.checkedAt.lte = to; } return prisma.monitoringResult.findMany({ where: whereClause, orderBy: { checkedAt: 'desc' }, take: limit, include: { website: { include: { websiteUsers: { where: { userId }, select: { name: true } } } } } }); }
} // End ResultsManager Class


// ============================================================================
// StatsCalculator Class
// ============================================================================
export class StatsCalculator {
    // ... (Implementations for calculateUptime, getAverageResponseTime, etc. remain the same) ...
    static async calculateUptimeBetweenDates(websiteId: number, startDate: Date, endDate: Date = new Date()): Promise<number> { const totalChecks = await prisma.monitoringResult.count({ where: { websiteId, checkedAt: { gte: startDate, lte: endDate } }, }); if (totalChecks === 0) return 100; const successfulChecks = await prisma.monitoringResult.count({ where: { websiteId, checkedAt: { gte: startDate, lte: endDate }, isAvailable: true }, }); const uptimePercentage = (successfulChecks / totalChecks) * 100; return parseFloat(uptimePercentage.toFixed(2)); }
    static async getAverageResponseTimeBetweenDates(websiteId: number, startDate: Date, endDate: Date = new Date()): Promise<number | null> { const result = await prisma.monitoringResult.aggregate({ _avg: { responseTime: true }, where: { websiteId, checkedAt: { gte: startDate, lte: endDate }, isAvailable: true, responseTime: { not: null } }, }); return result._avg.responseTime !== null ? Math.round(result._avg.responseTime) : null; }
    static async getConsecutiveFailures(websiteId: number): Promise<number> { const results = await prisma.monitoringResult.findMany({ where: { websiteId }, orderBy: { checkedAt: 'desc' }, take: 100, select: { isAvailable: true } }); let count = 0; for (const result of results) { if (!result.isAvailable) { count++; } else { break; } } return count; }
    private static periodToDays(period: TimeframeKey | string): number { if (typeof period === 'number') return period > 0 ? period : 7; if (typeof period !== 'string') return 7; const value = parseInt(period); if (!isNaN(value) && value > 0) return value; switch (period) { case 'hour': return 1 / 24; case 'day': return 1; case 'week': return 7; case 'month': return 30; case 'year': return 365; default: return 7; } }
    static async getWebsiteStats( websiteId: number, userId?: number, period: TimeframeKey | string = 'week' ): Promise<WebsiteStatsData> { const days = this.periodToDays(period); const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000); const website = await prisma.website.findUnique({ where: { id: websiteId } }); if (!website) throw new Error(`Website with ID ${websiteId} not found`); let websiteName = website.url; if (userId) { const userWebsite = await prisma.websiteUser.findUnique({ where: { userId_websiteId: { userId, websiteId } }, select: { name: true } }); if (userWebsite?.name) { websiteName = userWebsite.name; } } const [ uptime, averageResponseTime, lastResultData, consecutiveFailures, totalChecks ] = await Promise.all([ this.calculateUptimeBetweenDates(websiteId, startDate), this.getAverageResponseTimeBetweenDates(websiteId, startDate), prisma.monitoringResult.findFirst({ where: { websiteId }, orderBy: { checkedAt: 'desc' } }), this.getConsecutiveFailures(websiteId), prisma.monitoringResult.count({ where: { websiteId, checkedAt: { gte: startDate } } }) ]); return { websiteId, websiteName, url: website.url, uptime, averageResponseTime, totalChecks, lastCheck: lastResultData?.checkedAt?.toISOString() ?? null, consecutiveFailures }; }
    static async getOverallStats( userId?: number, period: TimeframeKey | string = 'week' ): Promise<OverallStats> { const days = this.periodToDays(period); const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000); const websiteWhere: Prisma.WebsiteWhereInput = userId ? { websiteUsers: { some: { userId } } } : {}; const [totalWebsites, activeWebsitesCount] = await Promise.all([ prisma.website.count({ where: websiteWhere }), prisma.website.count({ where: { ...websiteWhere, isActive: true } }) ]); const activeWebsitesList = await prisma.website.findMany({ where: { ...websiteWhere, isActive: true }, select: { id: true } }); const websiteStatsPromises = activeWebsitesList.map(website => this.getWebsiteStats(website.id, userId, period)); const websiteStats: WebsiteStatsData[] = await Promise.all(websiteStatsPromises); const validUptimeStats = websiteStats.filter(stat => stat.totalChecks > 0); const overallUptime = validUptimeStats.length > 0 ? validUptimeStats.reduce((sum, stat) => sum + stat.uptime, 0) / validUptimeStats.length : 100; const validResponseStats = websiteStats.filter(stat => stat.averageResponseTime !== null); const overallResponseTime = validResponseStats.length > 0 ? Math.round(validResponseStats.reduce((sum, stat) => sum + stat.averageResponseTime!, 0) / validResponseStats.length) : null; return { totalWebsites, activeWebsites: activeWebsitesCount, websiteStats, overallUptime: parseFloat(overallUptime.toFixed(2)), overallResponseTime }; }
    static async getUserDashboardStats( userId: number, period: TimeframeKey | string = 'week' ): Promise<OverallStats> { return this.getOverallStats(userId, period); }
    static async getChartDataForWebsite( websiteId: number, timeframe: TimeframeKey ): Promise<ChartDataPoint[]> { // ... (implementation remains the same - requires date-fns and aggregation logic) ...
        const endDate = new Date(); let chartData: ChartDataPoint[] = []; let startDate: Date; let intervalStart: Date, intervalEnd: Date; const calculatePeriodStats = (resultsInPeriod: PrismaMonitoringResult[]): { avgResponseTime: number | null, uptimeRatio: number, checkCount: number } => { const totalChecks = resultsInPeriod.length; if (totalChecks === 0) return { avgResponseTime: null, uptimeRatio: 1.0, checkCount: 0 }; const successfulChecks = resultsInPeriod.filter(r => r.isAvailable).length; const validResponseTimes = resultsInPeriod.filter(r => r.isAvailable && r.responseTime !== null).map(r => r.responseTime!); const avgResponseTime = validResponseTimes.length > 0 ? Math.round(validResponseTimes.reduce((s, rt) => s + rt, 0) / validResponseTimes.length) : null; const uptimeRatio = successfulChecks / totalChecks; return { avgResponseTime, uptimeRatio: parseFloat(uptimeRatio.toFixed(4)), checkCount: totalChecks }; }; switch (timeframe) { case 'hour': startDate = subHours(endDate, 1); const hourResults = await prisma.monitoringResult.findMany({ where: { websiteId, checkedAt: { gte: startDate, lte: endDate } }, orderBy: { checkedAt: 'asc' }, take: 200, }); chartData = hourResults.map(r => ({ label: format(new Date(r.checkedAt), 'HH:mm'), timestamp: getUnixTime(new Date(r.checkedAt)), avgResponseTime: r.isAvailable ? r.responseTime : null, uptimeRatio: r.isAvailable ? 1.0 : 0.0, checkCount: 1, })); break; case 'day': startDate = subDays(endDate, 1); intervalStart = startOfDay(startDate); intervalEnd = endOfDay(endDate); const dayResults = await prisma.monitoringResult.findMany({ where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } }, orderBy: { checkedAt: 'asc' }, }); const intervalMinutes = 30; const intervals = new Map<number, PrismaMonitoringResult[]>(); dayResults.forEach(r => { const intervalTimestamp = Math.floor(getUnixTime(new Date(r.checkedAt)) / (intervalMinutes * 60)) * (intervalMinutes * 60); if (!intervals.has(intervalTimestamp)) intervals.set(intervalTimestamp, []); intervals.get(intervalTimestamp)?.push(r); }); chartData = Array.from(intervals.entries()).map(([timestamp, results]) => { const stats = calculatePeriodStats(results); return { label: format(new Date(timestamp * 1000), 'HH:mm'), timestamp: timestamp, ...stats }; }); break; case 'week': case 'month': startDate = (timeframe === 'week') ? subDays(endDate, 7) : subMonths(endDate, 1); intervalStart = startOfDay(startDate); intervalEnd = endOfDay(endDate); const daysInPeriod = eachDayOfInterval({ start: intervalStart, end: intervalEnd }); const periodResults = await prisma.monitoringResult.findMany({ where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } }, orderBy: { checkedAt: 'asc' }, }); const resultsByDay = new Map<string, PrismaMonitoringResult[]>(); periodResults.forEach(r => { const dayKey = format(new Date(r.checkedAt), 'yyyy-MM-dd'); if (!resultsByDay.has(dayKey)) resultsByDay.set(dayKey, []); resultsByDay.get(dayKey)?.push(r); }); chartData = daysInPeriod.map((day): ChartDataPoint => { const dayKey = format(day, 'yyyy-MM-dd'); const dayStart = startOfDay(day); const results = resultsByDay.get(dayKey) || []; const stats = calculatePeriodStats(results); return { label: format(dayStart, 'MMM d'), timestamp: getUnixTime(dayStart), ...stats }; }); break; case 'year': startDate = subYears(endDate, 1); intervalStart = startOfMonth(startDate); intervalEnd = endOfDay(endDate); const monthsInPeriod = eachMonthOfInterval({ start: intervalStart, end: intervalEnd }); const yearResults = await prisma.monitoringResult.findMany({ where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } }, orderBy: { checkedAt: 'asc' }, }); const resultsByMonth = new Map<string, PrismaMonitoringResult[]>(); yearResults.forEach(r => { const monthKey = format(new Date(r.checkedAt), 'yyyy-MM'); if (!resultsByMonth.has(monthKey)) resultsByMonth.set(monthKey, []); resultsByMonth.get(monthKey)?.push(r); }); chartData = monthsInPeriod.map((monthDate): ChartDataPoint => { const monthKey = format(monthDate, 'yyyy-MM'); const monthStart = startOfMonth(monthDate); const results = resultsByMonth.get(monthKey) || []; const stats = calculatePeriodStats(results); return { label: format(monthStart, 'MMM yyyy'), timestamp: getUnixTime(monthStart), ...stats }; }); break; default: console.warn(`Unsupported timeframe for chart data: ${timeframe}`); startDate = subDays(endDate, 7); break; } chartData.sort((a, b) => a.timestamp - b.timestamp); return chartData;
    }
} // End StatsCalculator Class