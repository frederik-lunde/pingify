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
exports.getWebsiteDetails = exports.getWebsiteStats = exports.getUserStats = exports.getOverallStats = exports.triggerWebsiteCheck = exports.getResultsByWebsite = exports.getUserResults = exports.getAllResults = void 0;
// --- Import Services ---
const monitoringService_1 = require("../services/monitoringService");
const websiteService = __importStar(require("../services/websiteService"));
const IncidentService = __importStar(require("../services/incidentService"));
// --- Import Backend-Specific Helpers/Clients ---
const prismaClient_1 = __importDefault(require("../prisma/prismaClient"));
const date_fns_1 = require("date-fns");
// Helper function to get start date based on timeframe
const getStartDateForTimeframe = (timeframe) => {
    const now = new Date();
    switch (timeframe) {
        case 'hour': return (0, date_fns_1.subHours)(now, 1);
        case 'day':
        default: return (0, date_fns_1.subDays)(now, 1);
        case 'week': return (0, date_fns_1.subDays)(now, 7);
        case 'month': return (0, date_fns_1.subMonths)(now, 1);
        case 'year': return (0, date_fns_1.subYears)(now, 1);
    }
};
/**
 * Maps a Prisma MonitoringResult's core fields to the shared MonitoringResult type.
 */
const mapPrismaResultToSharedCore = (prismaResult) => {
    if (!prismaResult)
        return null;
    const coreData = {
        id: prismaResult.id,
        websiteId: prismaResult.websiteId,
        checkedAt: prismaResult.checkedAt.toISOString(),
        responseTime: prismaResult.responseTime,
        isAvailable: prismaResult.isAvailable,
        statusCode: prismaResult.statusCode,
        errorMessage: prismaResult.errorMessage
    };
    return coreData;
};
// --- Controller Functions ---
/**
 * GET /api/monitoring/admin/results - Get all results (admin).
 * Validation handled by middleware.
 */
const getAllResults = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { limit, from, to } = req.query;
        const results = yield monitoringService_1.ResultsManager.getAllResults({
            limit: limit,
            from: from,
            to: to
        });
        const responseData = results.map((r) => {
            const coreData = mapPrismaResultToSharedCore(r);
            if (!coreData)
                return null;
            const mappedResult = Object.assign(Object.assign({}, coreData), { website: r.website ? { url: r.website.url } : undefined });
            return mappedResult;
        }).filter((r) => r !== null);
        res.json(responseData);
    }
    catch (error) {
        next(error);
    }
});
exports.getAllResults = getAllResults;
/**
 * GET /api/monitoring/user/results - Get results for the authenticated user.
 * Validation handled by middleware.
 */
const getUserResults = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Authentication required.' });
            return;
        }
        const userId = req.user.id;
        const { limit, from, to } = req.query;
        const results = yield monitoringService_1.ResultsManager.getResultsForUser(userId, {
            limit: limit,
            from: from,
            to: to
        });
        const responseData = results.map((r) => {
            var _a, _b, _c;
            const coreData = mapPrismaResultToSharedCore(r);
            if (!coreData)
                return null;
            const mappedResult = Object.assign(Object.assign({}, coreData), { website: r.website ? {
                    url: r.website.url,
                    name: (_c = (_b = (_a = r.website.websiteUsers) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : undefined
                } : undefined });
            return mappedResult;
        }).filter((r) => r !== null);
        res.json(responseData);
    }
    catch (error) {
        next(error);
    }
});
exports.getUserResults = getUserResults;
/**
 * GET /api/monitoring/website/:websiteId/results - Get results for a specific website.
 * Validation handled by middleware.
 */
const getResultsByWebsite = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Authentication required.' });
            return;
        }
        const userId = req.user.id;
        const websiteId = req.params.websiteId;
        const { limit, from, to } = req.query;
        const hasAccess = yield websiteService.hasUserWebsite(userId, websiteId);
        if (!hasAccess) {
            res.status(404).json({ message: 'Website not found or access denied.' });
            return;
        }
        const results = yield monitoringService_1.ResultsManager.getFilteredResultsByWebsite(websiteId, {
            limit: limit,
            from: from,
            to: to
        });
        const responseData = results
            .map(mapPrismaResultToSharedCore)
            .filter((r) => r !== null);
        res.json(responseData);
    }
    catch (error) {
        next(error);
    }
});
exports.getResultsByWebsite = getResultsByWebsite;
/**
 * POST /api/monitoring/check/:websiteId - Trigger a manual check for a website.
 * Validation handled by middleware.
 */
const triggerWebsiteCheck = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Authentication required.' });
            return;
        }
        const userId = req.user.id;
        const websiteId = req.params.websiteId;
        const hasAccess = yield websiteService.hasUserWebsite(userId, websiteId);
        if (!hasAccess) {
            res.status(404).json({ message: 'Website not found or access denied.' });
            return;
        }
        const websitePrisma = yield prismaClient_1.default.website.findUnique({ where: { id: websiteId } });
        if (!websitePrisma) {
            res.status(404).json({ message: 'Website data not found.' });
            return;
        }
        console.log(`[triggerWebsiteCheck] User ${userId} starting check for website ID: ${websiteId}`);
        const newPrismaResult = yield monitoringService_1.WebsiteMonitor.checkWebsite(websitePrisma);
        console.log(`[triggerWebsiteCheck] Check completed for website ID: ${websiteId}. Result ID: ${newPrismaResult === null || newPrismaResult === void 0 ? void 0 : newPrismaResult.id}`);
        const newSharedResult = mapPrismaResultToSharedCore(newPrismaResult);
        if (!newSharedResult) {
            console.error(`[triggerWebsiteCheck] Failed to map Prisma result for website ID: ${websiteId}`);
            return next(new Error('Failed to process check result after execution.'));
        }
        res.status(200).json(newSharedResult);
    }
    catch (error) {
        next(error);
    }
});
exports.triggerWebsiteCheck = triggerWebsiteCheck;
/**
 * GET /api/monitoring/admin/stats - Get overall stats (admin).
 * Validation handled by middleware.
 */
const getOverallStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const period = req.query.period;
        const stats = yield monitoringService_1.StatsCalculator.getOverallStats(undefined, period);
        res.json(stats);
    }
    catch (error) {
        next(error);
    }
});
exports.getOverallStats = getOverallStats;
/**
 * GET /api/monitoring/user/stats - Get stats for the authenticated user's dashboard.
 * Validation handled by middleware.
 */
const getUserStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Authentication required.' });
            return;
        }
        const userId = req.user.id;
        const period = req.query.period;
        const stats = yield monitoringService_1.StatsCalculator.getUserDashboardStats(userId, period);
        res.json(stats);
    }
    catch (error) {
        next(error);
    }
});
exports.getUserStats = getUserStats;
/**
 * GET /api/monitoring/website/:websiteId/stats - Get stats for a specific website.
 * Validation handled by middleware.
 */
const getWebsiteStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Authentication required.' });
            return;
        }
        const userId = req.user.id;
        const websiteId = req.params.websiteId;
        const period = req.query.period;
        const hasAccess = yield websiteService.hasUserWebsite(userId, websiteId);
        if (!hasAccess) {
            res.status(404).json({ message: 'Website not found or access denied.' });
            return;
        }
        const stats = yield monitoringService_1.StatsCalculator.getWebsiteStats(websiteId, userId, period);
        res.json(stats);
    }
    catch (error) {
        next(error);
    }
});
exports.getWebsiteStats = getWebsiteStats;
/**
 * GET /api/monitoring/website/:websiteId - Get detailed data for a single website view.
 * Validation handled by middleware.
 * --- MODIFIED: Added safety checks for data from Promise.all ---
 */
const getWebsiteDetails = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Authentication required.' });
            return;
        }
        const userId = req.user.id;
        const websiteId = req.params.websiteId;
        const timeframe = req.query.timeframe;
        const limit = req.query.limit;
        const incidentLimit = req.query.incidentLimit;
        const sortBy = req.query.sortBy;
        const sortDir = req.query.sortDir;
        const userWebsite = yield websiteService.getUserWebsiteById(userId, websiteId);
        if (!userWebsite || !userWebsite.website) {
            res.status(404).json({ message: 'Website not found or access denied.' });
            return;
        }
        const startDate = getStartDateForTimeframe(timeframe);
        const endDate = new Date();
        let orderByClause = [];
        if (sortBy === 'statusCode' || sortBy === 'responseTime') {
            orderByClause.push({ [sortBy]: { sort: sortDir, nulls: 'last' } });
        }
        else {
            orderByClause.push({ [sortBy]: sortDir });
        }
        if (sortBy !== 'checkedAt') {
            orderByClause.push({ checkedAt: 'desc' });
        }
        // Fetch data in parallel
        const [latestResultData, chartDataResult, recentChecksData, uptimePercentData, currentIncidentData, recentIncidentsData] = yield Promise.all([
            prismaClient_1.default.monitoringResult.findFirst({ where: { websiteId }, orderBy: { checkedAt: 'desc' } }),
            monitoringService_1.StatsCalculator.getChartDataForWebsite(websiteId, timeframe),
            prismaClient_1.default.monitoringResult.findMany({ where: { websiteId: websiteId }, orderBy: orderByClause, take: limit }),
            monitoringService_1.StatsCalculator.calculateUptimeBetweenDates(websiteId, startDate, endDate),
            IncidentService.getCurrentOpenIncidentForWebsite(websiteId),
            IncidentService.getIncidents({ websiteId: websiteId, limit: incidentLimit }, userId)
        ]);
        // --- Safety Checks and Mapping ---
        const latestSharedResult = mapPrismaResultToSharedCore(latestResultData);
        // Ensure arrays are arrays, provide defaults if null/undefined unexpectedly
        const safeChartData = Array.isArray(chartDataResult) ? chartDataResult : [];
        const safeRecentChecksPrisma = Array.isArray(recentChecksData) ? recentChecksData : [];
        const safeRecentIncidents = Array.isArray(recentIncidentsData) ? recentIncidentsData : [];
        const mappedRecentChecks = safeRecentChecksPrisma
            .map(mapPrismaResultToSharedCore)
            .filter((r) => r !== null);
        const responseData = {
            websiteId: userWebsite.websiteId,
            name: userWebsite.name || userWebsite.website.url,
            url: userWebsite.website.url,
            latestResult: latestSharedResult, // Already handles null
            chartData: safeChartData,
            recentChecks: mappedRecentChecks,
            uptimePercent: typeof uptimePercentData === 'number' ? uptimePercentData : 100, // Default to 100 if calculation failed? Or handle error earlier.
            currentIncident: currentIncidentData !== null && currentIncidentData !== void 0 ? currentIncidentData : null, // Ensure null if undefined
            recentIncidents: safeRecentIncidents,
        };
        res.json(responseData);
    }
    catch (error) {
        console.error(`[getWebsiteDetails] Error fetching details for website ${req.params.websiteId}:`, error);
        next(error); // Pass to error handler middleware
    }
});
exports.getWebsiteDetails = getWebsiteDetails;
