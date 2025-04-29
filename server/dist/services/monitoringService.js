"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsCalculator = exports.ResultsManager = exports.WebsiteMonitor = void 0;
// server/src/services/monitoringService.ts
const axios_1 = __importDefault(require("axios"));
const perf_hooks_1 = require("perf_hooks");
const config_1 = require("../config/config");
const alertService_1 = require("./alertService");
const IncidentService = __importStar(require("./incidentService"));
const prismaClient_1 = __importDefault(require("../prisma/prismaClient"));
const date_fns_1 = require("date-fns");
const REQUEST_TIMEOUT_MS = config_1.monitoringConfig.requestTimeoutMs;
const MONITOR_USER_AGENT = config_1.monitoringConfig.monitorUserAgent;
// ============================================================================
// WebsiteMonitor Class
// ============================================================================
class WebsiteMonitor {
    static performWebsiteCheck(url) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const start = perf_hooks_1.performance.now();
            let responseTime = null;
            let isAvailable = false;
            let statusCode = null;
            let errorMessage = null;
            try {
                const response = yield axios_1.default.get(url, {
                    timeout: REQUEST_TIMEOUT_MS,
                    headers: {
                        'User-Agent': MONITOR_USER_AGENT,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Encoding': 'gzip, deflate, br',
                    },
                    validateStatus: () => true, // Handle all status codes without throwing error
                });
                responseTime = Math.round(perf_hooks_1.performance.now() - start);
                statusCode = response.status;
                isAvailable = statusCode >= 200 && statusCode < 300;
                if (!isAvailable)
                    errorMessage = `HTTP Status ${statusCode}`;
            }
            catch (error) {
                responseTime = Math.round(perf_hooks_1.performance.now() - start);
                isAvailable = false;
                if (axios_1.default.isAxiosError(error)) {
                    statusCode = (_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.status) !== null && _b !== void 0 ? _b : null;
                    errorMessage = this.parseAxiosErrorMessage(error);
                }
                else if (error instanceof Error) {
                    errorMessage = error.message;
                }
                else {
                    errorMessage = 'Unknown error occurred during check.';
                }
                console.error(`[Check Error] ${url}: ${errorMessage} (Status: ${statusCode !== null && statusCode !== void 0 ? statusCode : 'N/A'})`);
            }
            return { responseTime, isAvailable, statusCode, errorMessage };
        });
    }
    static parseAxiosErrorMessage(error) {
        if (error.response)
            return `HTTP Error ${error.response.status}`;
        if (error.request) {
            if (error.code === 'ECONNABORTED')
                return `Request timed out (${REQUEST_TIMEOUT_MS}ms)`;
            if (error.code === 'ENOTFOUND')
                return 'DNS lookup failed (domain not found)';
            if (error.code === 'ECONNREFUSED')
                return 'Connection refused by server';
            if (error.code === 'ETIMEDOUT')
                return 'Connection timed out';
            if (error.code === 'EHOSTUNREACH')
                return 'No route to host';
            if (error.code === 'ECONNRESET')
                return 'Connection reset by peer';
            return 'No response received from server';
        }
        return `Request setup error: ${error.message}`;
    }
    static checkWebsite(website) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const logPrefix = `[Monitor W:${website.id} ${website.url}]`;
            console.log(`${logPrefix} Starting check.`);
            let savedResult = null;
            try {
                const checkResultData = yield this.performWebsiteCheck(website.url);
                savedResult = yield ResultsManager.saveResult(website.id, checkResultData);
                console.log(`${logPrefix} Result saved (ID: ${savedResult.id}): Avail=${savedResult.isAvailable}, RT=${savedResult.responseTime}ms, Status=${savedResult.statusCode}, Err=${(_a = savedResult.errorMessage) !== null && _a !== void 0 ? _a : 'None'}`);
                if (savedResult) {
                    // Process result async, don't block return
                    (0, alertService_1.handleResultProcessing)(website, savedResult).catch(procError => {
                        console.error(`${logPrefix} Error during post-check result processing for R:${savedResult === null || savedResult === void 0 ? void 0 : savedResult.id}:`, procError);
                    });
                }
                else {
                    // This case should ideally not happen if saveResult throws on failure
                    console.error(`${logPrefix} Saved result was unexpectedly null after save attempt.`);
                    throw new Error("Failed to obtain saved result after check.");
                }
                return savedResult; // Return the saved result immediately
            }
            catch (error) {
                console.error(`${logPrefix} Critical failure during checkWebsite process: ${error.message}`, error.stack);
                // Attempt to update lastChecked even if check/save failed to prevent immediate re-check loops
                try {
                    // Ensure we don't overwrite a successful lastChecked from saveResult if it partially succeeded
                    if (!savedResult) {
                        yield prismaClient_1.default.website.update({ where: { id: website.id }, data: { lastChecked: new Date() } });
                        console.warn(`${logPrefix} Updated lastChecked after error during check/processing.`);
                    }
                }
                catch (updateError) {
                    console.error(`${logPrefix} Failed to update lastChecked after error:`, updateError);
                }
                // Re-throw the original error to signal failure
                throw error;
            }
        });
    }
}
exports.WebsiteMonitor = WebsiteMonitor;
// ============================================================================
// ResultsManager Class
// ============================================================================
class ResultsManager {
    static saveResult(websiteId, result) {
        return __awaiter(this, void 0, void 0, function* () {
            const { responseTime, isAvailable, statusCode, errorMessage } = result;
            const checkedAt = new Date();
            try {
                // Use transaction to ensure website lastChecked is updated along with result creation
                const savedMonitoringResult = yield prismaClient_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    yield tx.website.update({ where: { id: websiteId }, data: { lastChecked: checkedAt } });
                    return tx.monitoringResult.create({
                        data: { websiteId, responseTime, isAvailable, statusCode, errorMessage, checkedAt },
                    });
                }));
                return savedMonitoringResult;
            }
            catch (error) {
                console.error(`[ResultsManager] Error saving result for website ${websiteId}:`, error);
                throw error; // Propagate error for checkWebsite to handle
            }
        });
    }
    static getLatestResultId(websiteId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield prismaClient_1.default.monitoringResult.findFirst({ where: { websiteId }, orderBy: { checkedAt: 'desc' }, select: { id: true } });
            return (result === null || result === void 0 ? void 0 : result.id) || 0; // Return 0 if no result found
        });
    }
    static getResultsForWebsite(websiteId_1) {
        return __awaiter(this, arguments, void 0, function* (websiteId, limit = 100) {
            return prismaClient_1.default.monitoringResult.findMany({ where: { websiteId }, orderBy: { checkedAt: 'desc' }, take: limit });
        });
    }
    static getAllResults() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            const { limit = 100, from, to } = options;
            const whereClause = {};
            if (from || to) {
                whereClause.checkedAt = {};
                if (from)
                    whereClause.checkedAt.gte = from;
                if (to)
                    whereClause.checkedAt.lte = to;
            }
            return prismaClient_1.default.monitoringResult.findMany({
                where: whereClause, orderBy: { checkedAt: 'desc' }, take: limit,
                include: { website: { select: { url: true } } } // Include website URL
            });
        });
    }
    static getFilteredResultsByWebsite(websiteId_1) {
        return __awaiter(this, arguments, void 0, function* (websiteId, options = {}) {
            const { limit = 100, from, to } = options;
            const whereClause = { websiteId };
            if (from || to) {
                whereClause.checkedAt = {};
                if (from)
                    whereClause.checkedAt.gte = from;
                if (to)
                    whereClause.checkedAt.lte = to;
            }
            return prismaClient_1.default.monitoringResult.findMany({ where: whereClause, orderBy: { checkedAt: 'desc' }, take: limit });
        });
    }
    static getResultsForUser(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
            const { limit = 100, from, to } = options;
            const whereClause = {
                website: {
                    websiteUsers: { some: { userId: userId } }
                }
            };
            if (from || to) {
                whereClause.checkedAt = {};
                if (from)
                    whereClause.checkedAt.gte = from;
                if (to)
                    whereClause.checkedAt.lte = to;
            }
            return prismaClient_1.default.monitoringResult.findMany({
                where: whereClause,
                orderBy: { checkedAt: 'desc' },
                take: limit,
                include: {
                    website: {
                        select: {
                            url: true,
                            websiteUsers: {
                                where: { userId: userId }, // Filter for the specific user's name
                                select: { name: true }
                            }
                        }
                    }
                }
            }); // Cast needed because Prisma's inferred type might be slightly different
        });
    }
}
exports.ResultsManager = ResultsManager;
// ============================================================================
// StatsCalculator Class
// ============================================================================
class StatsCalculator {
    static calculateUptimeBetweenDates(websiteId_1, startDate_1) {
        return __awaiter(this, arguments, void 0, function* (websiteId, startDate, endDate = new Date()) {
            const results = yield prismaClient_1.default.monitoringResult.findMany({ where: { websiteId, checkedAt: { gte: startDate, lte: endDate } }, select: { isAvailable: true } });
            const totalChecks = results.length;
            if (totalChecks === 0)
                return 100; // Assume 100% uptime if no checks in the period
            const successfulChecks = results.filter(r => r.isAvailable).length;
            const uptimePercentage = (successfulChecks / totalChecks) * 100;
            return parseFloat(uptimePercentage.toFixed(2)); // Return with 2 decimal places
        });
    }
    static getAverageResponseTimeBetweenDates(websiteId_1, startDate_1) {
        return __awaiter(this, arguments, void 0, function* (websiteId, startDate, endDate = new Date()) {
            const result = yield prismaClient_1.default.monitoringResult.aggregate({ _avg: { responseTime: true }, where: { websiteId, checkedAt: { gte: startDate, lte: endDate }, isAvailable: true, responseTime: { not: null } } });
            return result._avg.responseTime !== null ? Math.round(result._avg.responseTime) : null;
        });
    }
    static periodToDays(period) {
        switch (period) {
            case 'hour': return 1 / 24;
            case 'day': return 1;
            case 'week': return 7;
            case 'month': return 30;
            case 'year': return 365;
        }
        if (typeof period === 'number')
            return period > 0 ? period : 7;
        if (typeof period === 'string') {
            const value = parseInt(period);
            if (!isNaN(value) && value > 0)
                return value;
        }
        return 7; // Default to 7 days (week) if invalid
    }
    static getWebsiteStats(websiteId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (websiteId, userId, period = 'week') {
            var _a, _b;
            const days = this.periodToDays(period);
            const startDate = (0, date_fns_1.sub)(new Date(), { days: days });
            const endDate = new Date();
            const website = yield prismaClient_1.default.website.findUnique({ where: { id: websiteId }, select: { url: true } });
            if (!website)
                throw new Error(`Website with ID ${websiteId} not found`);
            let websiteName = website.url; // Default to URL
            if (userId) {
                const userWebsite = yield prismaClient_1.default.websiteUser.findUnique({
                    where: { userId_websiteId: { userId: userId, websiteId: websiteId } }, select: { name: true }
                });
                if (userWebsite === null || userWebsite === void 0 ? void 0 : userWebsite.name)
                    websiteName = userWebsite.name; // Use user's custom name if available
            }
            // Fetch stats in parallel
            const [uptime, averageResponseTime, totalChecks, lastResultData] = yield Promise.all([
                this.calculateUptimeBetweenDates(websiteId, startDate, endDate),
                this.getAverageResponseTimeBetweenDates(websiteId, startDate, endDate),
                prismaClient_1.default.monitoringResult.count({ where: { websiteId, checkedAt: { gte: startDate, lte: endDate } } }),
                prismaClient_1.default.monitoringResult.findFirst({ where: { websiteId }, orderBy: { checkedAt: 'desc' }, select: { checkedAt: true } })
            ]);
            // Fetch incident counts for the period
            const incidentCounts = yield prismaClient_1.default.incident.groupBy({
                by: ['type'],
                where: { websiteId: websiteId, startTime: { gte: startDate, lte: endDate } },
                _count: { type: true }
            });
            let totalIncidentCount = 0, downIncidentCount = 0, slowIncidentCount = 0;
            incidentCounts.forEach(group => {
                const count = group._count.type;
                totalIncidentCount += count;
                if (group.type === 'down')
                    downIncidentCount = count;
                else if (group.type === 'slow')
                    slowIncidentCount = count;
            });
            return { websiteId, websiteName, url: website.url, uptime, averageResponseTime, totalChecks, lastCheck: (_b = (_a = lastResultData === null || lastResultData === void 0 ? void 0 : lastResultData.checkedAt) === null || _a === void 0 ? void 0 : _a.toISOString()) !== null && _b !== void 0 ? _b : null, incidentCount: totalIncidentCount, downIncidentCount, slowIncidentCount };
        });
    }
    static getOverallStats(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, period = 'week') {
            var _a, _b;
            const days = this.periodToDays(period);
            const periodStartDate = (0, date_fns_1.sub)(new Date(), { days: days });
            const twentyFourHoursAgo = (0, date_fns_1.sub)(new Date(), { hours: 24 });
            // Define base where clause for websites (all or user-specific)
            const websiteWhere = userId ? { websiteUsers: { some: { userId: userId } } } : {};
            // Get total and active website counts
            const [totalWebsites, activeWebsitesCount] = yield Promise.all([
                prismaClient_1.default.website.count({ where: websiteWhere }),
                prismaClient_1.default.website.count({ where: Object.assign(Object.assign({}, websiteWhere), { isActive: true }) })
            ]);
            // Get IDs of active websites for further processing
            const activeWebsitesList = yield prismaClient_1.default.website.findMany({ where: Object.assign(Object.assign({}, websiteWhere), { isActive: true }), select: { id: true } });
            const activeWebsiteIds = activeWebsitesList.map(w => w.id);
            // Fetch individual stats for all active websites in parallel
            const websiteStatsPromises = activeWebsiteIds.map(websiteId => this.getWebsiteStats(websiteId, userId, period));
            const websiteStats = yield Promise.all(websiteStatsPromises);
            // Calculate overall averages
            const validUptimeStats = websiteStats.filter(stat => stat.totalChecks > 0);
            const overallUptime = validUptimeStats.length > 0 ? validUptimeStats.reduce((sum, stat) => sum + stat.uptime, 0) / validUptimeStats.length : 100;
            const validResponseStats = websiteStats.filter(stat => stat.averageResponseTime !== null);
            const overallResponseTime = validResponseStats.length > 0 ? Math.round(validResponseStats.reduce((sum, stat) => sum + stat.averageResponseTime, 0) / validResponseStats.length) : null;
            // Get incident data (last 24h count and most recent incident)
            let incidentsLast24h = 0;
            let lastIncident = null;
            if (activeWebsiteIds.length > 0) {
                // Use IncidentService to get counts/latest based on website IDs or user ID
                incidentsLast24h = yield IncidentService.countIncidents(Object.assign({ from: twentyFourHoursAgo }, (userId && { userId: userId })));
                lastIncident = yield IncidentService.getMostRecentIncident(userId); // Pass userId if filtering by user
            }
            return {
                totalWebsites, activeWebsites: activeWebsitesCount, websiteStats,
                overallUptime: parseFloat(overallUptime.toFixed(2)), overallResponseTime,
                incidentsLast24h, lastIncidentTimestamp: (_a = lastIncident === null || lastIncident === void 0 ? void 0 : lastIncident.startTime.toISOString()) !== null && _a !== void 0 ? _a : null,
                lastIncidentWebsiteId: (_b = lastIncident === null || lastIncident === void 0 ? void 0 : lastIncident.websiteId) !== null && _b !== void 0 ? _b : null,
            };
        });
    }
    static getUserDashboardStats(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, period = 'week') {
            return this.getOverallStats(userId, period); // Pass user ID
        });
    }
    static getChartDataForWebsite(websiteId, timeframe) {
        return __awaiter(this, void 0, void 0, function* () {
            const endDate = new Date();
            let chartData = [];
            let startDate;
            let intervalStart, intervalEnd;
            // Helper to calculate stats for a period's results
            const calculatePeriodStats = (resultsInPeriod) => {
                const totalChecks = resultsInPeriod.length;
                if (totalChecks === 0)
                    return { avgResponseTime: null, uptimeRatio: 1.0, checkCount: 0 };
                const successfulChecks = resultsInPeriod.filter(r => r.isAvailable).length;
                const validResponseTimes = resultsInPeriod.filter(r => r.isAvailable && r.responseTime !== null).map(r => r.responseTime);
                const avgResponseTime = validResponseTimes.length > 0
                    ? Math.round(validResponseTimes.reduce((s, rt) => s + rt, 0) / validResponseTimes.length)
                    : null;
                const uptimeRatio = successfulChecks / totalChecks;
                return { avgResponseTime, uptimeRatio: parseFloat(uptimeRatio.toFixed(4)), checkCount: totalChecks };
            };
            // --- MODIFIED: Added try...catch block ---
            try {
                switch (timeframe) {
                    case 'hour':
                        startDate = (0, date_fns_1.subHours)(endDate, 1);
                        const hourResults = yield prismaClient_1.default.monitoringResult.findMany({ where: { websiteId, checkedAt: { gte: startDate, lte: endDate } }, orderBy: { checkedAt: 'asc' }, take: 200 }); // Limit results for performance
                        chartData = hourResults.map(r => ({
                            label: (0, date_fns_1.format)(new Date(r.checkedAt), 'HH:mm'),
                            timestamp: (0, date_fns_1.getUnixTime)(new Date(r.checkedAt)),
                            avgResponseTime: r.isAvailable ? r.responseTime : null,
                            uptimeRatio: r.isAvailable ? 1.0 : 0.0,
                            checkCount: 1
                        }));
                        break;
                    case 'day':
                        startDate = (0, date_fns_1.subDays)(endDate, 1);
                        intervalStart = (0, date_fns_1.startOfDay)(startDate);
                        intervalEnd = (0, date_fns_1.endOfDay)(endDate);
                        const dayResults = yield prismaClient_1.default.monitoringResult.findMany({ where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } }, orderBy: { checkedAt: 'asc' } });
                        // Group results into 30-minute intervals
                        const intervalMinutesDay = 30;
                        const intervalsDay = new Map();
                        dayResults.forEach(r => {
                            var _a;
                            const intervalTimestamp = Math.floor((0, date_fns_1.getUnixTime)(new Date(r.checkedAt)) / (intervalMinutesDay * 60)) * (intervalMinutesDay * 60);
                            if (!intervalsDay.has(intervalTimestamp))
                                intervalsDay.set(intervalTimestamp, []);
                            (_a = intervalsDay.get(intervalTimestamp)) === null || _a === void 0 ? void 0 : _a.push(r);
                        });
                        chartData = Array.from(intervalsDay.entries()).map(([timestamp, results]) => (Object.assign({ label: (0, date_fns_1.format)(new Date(timestamp * 1000), 'HH:mm'), timestamp: timestamp }, calculatePeriodStats(results))));
                        break;
                    case 'week':
                    case 'month':
                        startDate = (timeframe === 'week') ? (0, date_fns_1.subDays)(endDate, 7) : (0, date_fns_1.subMonths)(endDate, 1);
                        intervalStart = (0, date_fns_1.startOfDay)(startDate);
                        intervalEnd = (0, date_fns_1.endOfDay)(endDate);
                        const daysInPeriod = (0, date_fns_1.eachDayOfInterval)({ start: intervalStart, end: intervalEnd });
                        const periodResultsWkMo = yield prismaClient_1.default.monitoringResult.findMany({ where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } }, orderBy: { checkedAt: 'asc' } });
                        // Group results by day
                        const resultsByDay = new Map();
                        periodResultsWkMo.forEach(r => {
                            var _a;
                            const dayKey = (0, date_fns_1.format)(new Date(r.checkedAt), 'yyyy-MM-dd');
                            if (!resultsByDay.has(dayKey))
                                resultsByDay.set(dayKey, []);
                            (_a = resultsByDay.get(dayKey)) === null || _a === void 0 ? void 0 : _a.push(r);
                        });
                        chartData = daysInPeriod.map((day) => {
                            const dayKey = (0, date_fns_1.format)(day, 'yyyy-MM-dd');
                            const dayStart = (0, date_fns_1.startOfDay)(day);
                            const results = resultsByDay.get(dayKey) || [];
                            const stats = calculatePeriodStats(results);
                            return Object.assign({ label: (0, date_fns_1.format)(dayStart, 'MMM d'), timestamp: (0, date_fns_1.getUnixTime)(dayStart) }, stats);
                        });
                        break;
                    case 'year':
                        startDate = (0, date_fns_1.subYears)(endDate, 1);
                        intervalStart = (0, date_fns_1.startOfMonth)(startDate); // Start from beginning of the month
                        intervalEnd = (0, date_fns_1.endOfDay)(endDate);
                        const monthsInPeriod = (0, date_fns_1.eachMonthOfInterval)({ start: intervalStart, end: intervalEnd });
                        const yearResults = yield prismaClient_1.default.monitoringResult.findMany({ where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } }, orderBy: { checkedAt: 'asc' } });
                        // Group results by month
                        const resultsByMonth = new Map();
                        yearResults.forEach(r => {
                            var _a;
                            const monthKey = (0, date_fns_1.format)(new Date(r.checkedAt), 'yyyy-MM');
                            if (!resultsByMonth.has(monthKey))
                                resultsByMonth.set(monthKey, []);
                            (_a = resultsByMonth.get(monthKey)) === null || _a === void 0 ? void 0 : _a.push(r);
                        });
                        chartData = monthsInPeriod.map((monthDate) => {
                            const monthKey = (0, date_fns_1.format)(monthDate, 'yyyy-MM');
                            const monthStart = (0, date_fns_1.startOfMonth)(monthDate);
                            const results = resultsByMonth.get(monthKey) || [];
                            const stats = calculatePeriodStats(results);
                            return Object.assign({ label: (0, date_fns_1.format)(monthStart, 'MMM yyyy'), timestamp: (0, date_fns_1.getUnixTime)(monthStart) }, stats);
                        });
                        break;
                    default:
                        // Should not happen if TimeframeKey is used, but good practice
                        console.warn(`[StatsCalculator] Unsupported timeframe for chart data: ${timeframe}. Defaulting to 'week'.`);
                        return this.getChartDataForWebsite(websiteId, 'week'); // Recursive call with default
                }
                // Ensure data is sorted chronologically
                chartData.sort((a, b) => a.timestamp - b.timestamp);
            }
            catch (error) {
                console.error(`[StatsCalculator] Error generating chart data for website ${websiteId}, timeframe ${timeframe}:`, error);
                // Return an empty array on error to prevent breaking Promise.all in controller
                return [];
            }
            // --- END MODIFIED SECTION ---
            return chartData;
        });
    }
}
exports.StatsCalculator = StatsCalculator;
