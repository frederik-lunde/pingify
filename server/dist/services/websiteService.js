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
exports.getAllWebsites = getAllWebsites;
exports.getWebsitesForUser = getWebsitesForUser;
exports.getWebsiteById = getWebsiteById;
exports.getWebsiteByUrl = getWebsiteByUrl;
exports.getUserWebsiteById = getUserWebsiteById;
exports.createWebsite = createWebsite;
exports.updateGlobalInterval = updateGlobalInterval;
exports.checkAndDeactivateWebsiteIfOrphaned = checkAndDeactivateWebsiteIfOrphaned;
exports.updateWebsiteCore = updateWebsiteCore;
exports.updateUserWebsite = updateUserWebsite;
exports.setPinStatusForUser = setPinStatusForUser;
exports.deleteWebsite = deleteWebsite;
exports.toggleWebsiteStatus = toggleWebsiteStatus;
exports.addWebsiteToUser = addWebsiteToUser;
exports.removeWebsiteFromUser = removeWebsiteFromUser;
exports.hasUserWebsite = hasUserWebsite;
exports.searchWebsites = searchWebsites;
// server/src/services/websiteService.ts
const client_1 = require("@prisma/client");
const prismaClient_1 = __importDefault(require("../prisma/prismaClient"));
const monitoringService_1 = require("./monitoringService");
const IncidentService = __importStar(require("./incidentService"));
const date_fns_1 = require("date-fns");
const config_1 = require("../config/config");
// --- Constants ---
const DEFAULT_GLOBAL_INTERVAL = config_1.monitoringConfig.defaultIntervalSeconds;
const CARD_TIMEFRAME = 'day';
const MAX_CARD_DATA_POINTS = 24;
// --- Mapping Helper Functions ---
// No changes needed in mapping functions unless they explicitly handle userId as number
const mapPrismaWebsiteToShared = (website) => {
    var _a, _b, _c, _d, _e, _f;
    if (!website)
        return null;
    return {
        id: website.id,
        url: website.url,
        isActive: website.isActive,
        lastChecked: (_b = (_a = website.lastChecked) === null || _a === void 0 ? void 0 : _a.toISOString()) !== null && _b !== void 0 ? _b : null,
        globalInterval: website.globalInterval,
        createdAt: (_d = (_c = website.createdAt) === null || _c === void 0 ? void 0 : _c.toISOString()) !== null && _d !== void 0 ? _d : undefined,
        updatedAt: (_f = (_e = website.updatedAt) === null || _e === void 0 ? void 0 : _e.toISOString()) !== null && _f !== void 0 ? _f : undefined
    };
};
const mapPrismaResultToSharedBasic = (prismaResult) => {
    if (!prismaResult)
        return null;
    // Assuming SharedMonitoringResult doesn't directly include detailed user info
    const coreData = {
        id: prismaResult.id,
        websiteId: prismaResult.websiteId,
        checkedAt: prismaResult.checkedAt.toISOString(),
        responseTime: prismaResult.responseTime,
        isAvailable: prismaResult.isAvailable,
        statusCode: prismaResult.statusCode,
        errorMessage: prismaResult.errorMessage
    };
    // Cast needed if SharedMonitoringResult has mandatory fields not present in Omit
    return coreData;
};
// Ensure the input 'websiteUser' object from Prisma has userId as string
const mapPrismaWebsiteUserToSharedBase = (websiteUser) => {
    if (!websiteUser)
        return null;
    const sharedWebsiteNested = websiteUser.website ? mapPrismaWebsiteToShared(websiteUser.website) : undefined;
    // The userId here comes directly from the Prisma result, which should be string
    return {
        id: websiteUser.id,
        userId: websiteUser.userId, // This should now be a string from Prisma
        websiteId: websiteUser.websiteId,
        name: websiteUser.name,
        interval: websiteUser.interval,
        alertEnabled: websiteUser.alertEnabled,
        alertThreshold: websiteUser.alertThreshold,
        notifyEmail: websiteUser.notifyEmail,
        createdAt: websiteUser.createdAt.toISOString(),
        isPinned: websiteUser.isPinned,
        website: sharedWebsiteNested !== null && sharedWebsiteNested !== void 0 ? sharedWebsiteNested : undefined
        // Remove properties not defined in WebsiteUser type if necessary
    };
};
// --- Service Functions ---
// No changes needed
function getAllWebsites() {
    return __awaiter(this, void 0, void 0, function* () {
        const websitesPrisma = yield prismaClient_1.default.website.findMany({ orderBy: { createdAt: 'desc' } });
        return websitesPrisma.map(w => mapPrismaWebsiteToShared(w));
    });
}
// Changed userId type to string
function getWebsitesForUser(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        // 1. Fetch base WebsiteUser data with Website included, sorted
        const websiteUsersPrisma = yield prismaClient_1.default.websiteUser.findMany({
            where: { userId: userId }, // Use string ID
            include: { website: true },
            orderBy: [{ isPinned: 'desc' }, { website: { url: 'asc' } }]
        });
        if (websiteUsersPrisma.length === 0)
            return [];
        const websiteIds = websiteUsersPrisma.map(wu => wu.websiteId);
        // 2. Fetch Latest Results (no change)
        const latestResultsPromises = websiteIds.map(id => prismaClient_1.default.monitoringResult.findFirst({
            where: { websiteId: id }, orderBy: { checkedAt: 'desc' },
            select: { id: true, websiteId: true, checkedAt: true, responseTime: true, isAvailable: true, statusCode: true, errorMessage: true }
        }));
        const latestResultsRaw = (yield Promise.all(latestResultsPromises)).filter(r => r !== null);
        const latestResultMap = new Map();
        latestResultsRaw.forEach(result => {
            latestResultMap.set(result.websiteId, mapPrismaResultToSharedBasic(result));
        });
        // 3. Fetch Current Open Incidents (no change)
        const openIncidentsPromises = websiteIds.map(id => IncidentService.getCurrentOpenIncidentForWebsite(id) // Assuming IncidentService doesn't need userId here
        );
        const openIncidents = (yield Promise.all(openIncidentsPromises)).filter(inc => inc !== null);
        const openIncidentMap = new Map();
        openIncidents.forEach(incident => {
            openIncidentMap.set(incident.websiteId, incident);
        });
        // 4. Fetch Chart Data (no change)
        const chartDataPromises = websiteIds.map(id => monitoringService_1.StatsCalculator.getChartDataForWebsite(id, CARD_TIMEFRAME)
            .then(data => ({ websiteId: id, chartData: data.slice(-MAX_CARD_DATA_POINTS) })));
        const chartDataResults = yield Promise.all(chartDataPromises);
        const chartDataMap = new Map();
        chartDataResults.forEach(result => { chartDataMap.set(result.websiteId, result.chartData); });
        // 5. Fetch Uptime Percentage (no change)
        const dailyStartDate = (0, date_fns_1.subDays)(new Date(), 1);
        const uptimePromises = websiteIds.map(id => monitoringService_1.StatsCalculator.calculateUptimeBetweenDates(id, dailyStartDate, new Date())
            .then(uptime => ({ websiteId: id, uptimePercent: uptime })));
        const uptimeResults = yield Promise.all(uptimePromises);
        const uptimeMap = new Map();
        uptimeResults.forEach(result => { uptimeMap.set(result.websiteId, result.uptimePercent); });
        // 6. Map Prisma results to Shared type and augment
        const results = websiteUsersPrisma.map(wuPrisma => {
            var _a, _b, _c, _d;
            // mapPrismaWebsiteUserToSharedBase handles the string userId from wuPrisma
            const sharedWu = mapPrismaWebsiteUserToSharedBase(wuPrisma);
            if (!sharedWu)
                return null;
            // Add dynamic data (no change)
            sharedWu.latestResult = (_a = latestResultMap.get(sharedWu.websiteId)) !== null && _a !== void 0 ? _a : null;
            sharedWu.chartData = (_b = chartDataMap.get(sharedWu.websiteId)) !== null && _b !== void 0 ? _b : [];
            sharedWu.uptimePercent = (_c = uptimeMap.get(sharedWu.websiteId)) !== null && _c !== void 0 ? _c : 100;
            sharedWu.currentIncident = (_d = openIncidentMap.get(sharedWu.websiteId)) !== null && _d !== void 0 ? _d : null;
            return sharedWu;
        }).filter(wu => wu !== null); // Ensure non-null results
        return results;
    });
}
// No changes needed
function getWebsiteById(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const websitePrisma = yield prismaClient_1.default.website.findUnique({ where: { id } });
        return mapPrismaWebsiteToShared(websitePrisma);
    });
}
// No changes needed
function getWebsiteByUrl(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const websitePrisma = yield prismaClient_1.default.website.findUnique({ where: { url } });
        return mapPrismaWebsiteToShared(websitePrisma);
    });
}
// Changed userId type to string
function getUserWebsiteById(userId, websiteId) {
    return __awaiter(this, void 0, void 0, function* () {
        const userWebsitePrisma = yield prismaClient_1.default.websiteUser.findUnique({
            where: { userId_websiteId: { userId: userId, websiteId: websiteId } }, // Use string ID
            include: { website: true }
        });
        return mapPrismaWebsiteUserToSharedBase(userWebsitePrisma);
    });
}
// No changes needed
function createWebsite(data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data.url || !/^https?:\/\/.+/.test(data.url)) {
            throw new Error('Invalid URL format provided for website creation.');
        }
        try {
            const websitePrisma = yield prismaClient_1.default.website.create({
                data: {
                    url: data.url,
                    globalInterval: DEFAULT_GLOBAL_INTERVAL,
                    isActive: true // Typically start active when created
                }
            });
            return mapPrismaWebsiteToShared(websitePrisma);
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                console.error(`Website creation failed: URL '${data.url}' already exists.`);
                throw new Error(`Website with URL '${data.url}' already exists.`);
            }
            console.error("Error creating website:", error);
            throw error; // Re-throw other errors
        }
    });
}
// No changes needed
function updateGlobalInterval(websiteId) {
    return __awaiter(this, void 0, void 0, function* () {
        const websiteUsers = yield prismaClient_1.default.websiteUser.findMany({
            where: {
                websiteId: websiteId,
                interval: { not: null, gt: 0 } // Only consider positive intervals
            },
            select: { interval: true }
        });
        // Filter out nulls explicitly just in case, though 'not: null' should handle it
        const intervals = websiteUsers.map(wu => wu.interval).filter((i) => i !== null && i > 0);
        let newGlobalInterval;
        if (intervals.length > 0) {
            newGlobalInterval = Math.min(...intervals);
        }
        else {
            newGlobalInterval = DEFAULT_GLOBAL_INTERVAL;
        }
        const currentWebsite = yield prismaClient_1.default.website.findUnique({
            where: { id: websiteId },
            select: { globalInterval: true }
        });
        if (currentWebsite && currentWebsite.globalInterval !== newGlobalInterval) {
            try {
                yield prismaClient_1.default.website.update({
                    where: { id: websiteId },
                    data: { globalInterval: newGlobalInterval }
                });
                console.log(`[Interval Update] Updated global interval for website ${websiteId} to ${newGlobalInterval} seconds.`);
            }
            catch (error) {
                console.error(`[Interval Update] Failed to update global interval for website ${websiteId}:`, error);
                // Decide if this error should propagate
            }
        }
        else if (!currentWebsite) {
            console.warn(`[Interval Update] Website with ID ${websiteId} not found during interval update check.`);
        }
    });
}
// No changes needed
function checkAndDeactivateWebsiteIfOrphaned(websiteId) {
    return __awaiter(this, void 0, void 0, function* () {
        const logPrefix = `[Orphan Check W:${websiteId}]`;
        try {
            const remainingUsersCount = yield prismaClient_1.default.websiteUser.count({
                where: { websiteId: websiteId }
            });
            console.log(`${logPrefix} Found ${remainingUsersCount} remaining users.`);
            if (remainingUsersCount === 0) {
                const currentWebsite = yield prismaClient_1.default.website.findUnique({
                    where: { id: websiteId },
                    select: { isActive: true }
                });
                if (currentWebsite === null || currentWebsite === void 0 ? void 0 : currentWebsite.isActive) {
                    yield prismaClient_1.default.website.update({
                        where: { id: websiteId },
                        data: { isActive: false }
                    });
                    console.log(`${logPrefix} Deactivated website as it has no more users.`);
                }
                else if (currentWebsite) {
                    console.log(`${logPrefix} Website already inactive.`);
                }
                else {
                    console.warn(`${logPrefix} Website not found during deactivation check.`);
                }
            }
        }
        catch (error) {
            console.error(`${logPrefix} Error during orphan check/deactivation:`, error);
            // Don't propagate error, as this is often a cleanup task
        }
    });
}
// No changes needed
function updateWebsiteCore(id, data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Validate URL only if it's provided and not null
            if (data.url !== undefined && data.url !== null && !/^https?:\/\/.+/.test(data.url)) {
                throw new Error('Invalid URL format provided for website update.');
            }
            const updatePayload = {};
            // Allow setting url to null if needed? Schema might not allow it. Assuming not.
            if (data.url !== undefined)
                updatePayload.url = data.url;
            if (data.isActive !== undefined)
                updatePayload.isActive = data.isActive;
            if (Object.keys(updatePayload).length === 0) {
                console.warn(`No core website data provided for update on ID ${id}. Fetching current state.`);
                const currentWebsite = yield prismaClient_1.default.website.findUnique({ where: { id } });
                return mapPrismaWebsiteToShared(currentWebsite);
            }
            const websitePrisma = yield prismaClient_1.default.website.update({ where: { id }, data: updatePayload });
            return mapPrismaWebsiteToShared(websitePrisma);
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') { // Record to update not found
                    console.warn(`Website with ID ${id} not found for update.`);
                    return null;
                }
                if (error.code === 'P2002') { // Unique constraint failed (likely URL)
                    console.error(`Website update failed: URL '${data.url}' already exists.`);
                    throw new Error(`Another website with URL '${data.url}' already exists.`);
                }
            }
            console.error(`Error updating core website ${id}:`, error);
            throw error; // Re-throw other errors
        }
    });
}
// Changed userId type to string
function updateUserWebsite(userId, websiteId, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const prismaUpdateData = {}; // Correct type for nested update
        // Check for undefined to allow setting null/empty values if needed by schema
        if (data.name !== undefined)
            prismaUpdateData.name = data.name;
        if (data.interval !== undefined)
            prismaUpdateData.interval = data.interval;
        if (data.alertThreshold !== undefined)
            prismaUpdateData.alertThreshold = data.alertThreshold;
        if (data.notifyEmail !== undefined)
            prismaUpdateData.notifyEmail = data.notifyEmail;
        if (typeof data.alertEnabled === 'boolean')
            prismaUpdateData.alertEnabled = data.alertEnabled;
        if (typeof data.isPinned === 'boolean')
            prismaUpdateData.isPinned = data.isPinned;
        if (Object.keys(prismaUpdateData).length === 0) {
            console.warn(`No update data provided for user ${userId}, website ${websiteId}. Skipping update.`);
            // Fetch and return current data if no changes provided
            return getUserWebsiteById(userId, websiteId);
        }
        try {
            const updatedWebsiteUserPrisma = yield prismaClient_1.default.websiteUser.update({
                where: { userId_websiteId: { userId: userId, websiteId: websiteId } }, // Use string ID
                data: prismaUpdateData,
                include: { website: true } // Include website for mapping response
            });
            // Trigger interval update if interval was part of the update
            if (data.interval !== undefined) {
                // Run async, don't wait or block response
                updateGlobalInterval(websiteId).catch(err => console.error(`[Interval Update Post-UserUpdate] Error updating global interval for website ${websiteId}:`, err));
            }
            return mapPrismaWebsiteUserToSharedBase(updatedWebsiteUserPrisma);
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                console.warn(`WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for update.`);
                return null; // Return null if the relation doesn't exist
            }
            console.error(`Error updating user website settings for user ${userId}, website ${websiteId}:`, error);
            throw error; // Re-throw other errors
        }
    });
}
// Changed userId type to string
function setPinStatusForUser(userId, websiteId, isPinned) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const updatedWebsiteUserPrisma = yield prismaClient_1.default.websiteUser.update({
                where: { userId_websiteId: { userId: userId, websiteId: websiteId } }, // Use string ID
                data: { isPinned: isPinned },
                include: { website: true }, // Include website for mapping response
            });
            return mapPrismaWebsiteUserToSharedBase(updatedWebsiteUserPrisma);
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                console.warn(`WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for pin update.`);
                return null; // Return null if the relation doesn't exist
            }
            console.error(`Error setting pin status for user ${userId}, website ${websiteId}:`, error);
            throw error; // Re-throw other errors
        }
    });
}
// No changes needed
function deleteWebsite(id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Cascade delete is defined in the schema, handles related records
            const websitePrisma = yield prismaClient_1.default.website.delete({ where: { id } });
            return mapPrismaWebsiteToShared(websitePrisma);
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                console.warn(`Website with ID ${id} not found for deletion.`);
                return null; // Return null if already deleted
            }
            console.error(`Error deleting website ${id}:`, error);
            throw error; // Re-throw other errors
        }
    });
}
// No changes needed
function toggleWebsiteStatus(id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Use transaction for read-then-write safety
            const updatedWebsitePrisma = yield prismaClient_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const website = yield tx.website.findUnique({ where: { id }, select: { isActive: true } });
                if (!website) {
                    // Use a custom error or specific handling for 'not found'
                    throw new client_1.Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '?.?.?' });
                }
                return tx.website.update({ where: { id }, data: { isActive: !website.isActive } });
            }));
            return mapPrismaWebsiteToShared(updatedWebsitePrisma);
        }
        catch (error) {
            // Check specifically for the P2025 code we might throw or that Prisma might throw
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                console.warn(`Website with ID ${id} not found for toggle.`);
                return null;
            }
            console.error(`Error toggling status for website ${id}:`, error);
            throw error; // Re-throw other errors
        }
    });
}
// Changed userId type to string
function addWebsiteToUser(userId, websiteData) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!websiteData.url || !/^https?:\/\/.+/.test(websiteData.url)) {
            throw new Error('Invalid URL format provided.');
        }
        try {
            const websiteUserPrisma = yield prismaClient_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d;
                // 1. Upsert the website: find existing or create new
                const website = yield tx.website.upsert({
                    where: { url: websiteData.url },
                    update: { isActive: true }, // Ensure active if existing
                    create: {
                        url: websiteData.url,
                        globalInterval: DEFAULT_GLOBAL_INTERVAL,
                        isActive: true
                    },
                });
                // 2. Upsert the user-website relationship
                // Use the string userId here
                const websiteUser = yield tx.websiteUser.upsert({
                    where: { userId_websiteId: { userId: userId, websiteId: website.id } },
                    update: {
                        name: websiteData.name,
                        interval: websiteData.interval,
                        alertThreshold: websiteData.alertThreshold,
                        alertEnabled: (_a = websiteData.alertEnabled) !== null && _a !== void 0 ? _a : false,
                        notifyEmail: websiteData.notifyEmail,
                        isPinned: (_b = websiteData.isPinned) !== null && _b !== void 0 ? _b : false
                    },
                    create: {
                        userId: userId, // Use string ID
                        websiteId: website.id,
                        name: websiteData.name,
                        interval: websiteData.interval,
                        alertThreshold: websiteData.alertThreshold,
                        alertEnabled: (_c = websiteData.alertEnabled) !== null && _c !== void 0 ? _c : false,
                        notifyEmail: websiteData.notifyEmail,
                        isPinned: (_d = websiteData.isPinned) !== null && _d !== void 0 ? _d : false
                    },
                    include: { website: true } // Include for mapping response
                });
                // 3. Trigger global interval update (async)
                // Use 'await' only if the result of this is critical before returning
                // Otherwise, let it run in the background
                updateGlobalInterval(website.id).catch(err => console.error(`[Interval Update Post-Add] Error updating global interval for website ${website.id}:`, err));
                return websiteUser; // Return the result of the upsert
            }));
            // Map the final Prisma result (including website) to the shared type
            return mapPrismaWebsiteUserToSharedBase(websiteUserPrisma); // Add '!' if confident it won't be null
        }
        catch (error) {
            // Catch potential errors (like DB connection issues, unexpected problems)
            console.error(`Error in addWebsiteToUser transaction for user ${userId}, URL ${websiteData.url}:`, error);
            // Provide a generic error to the client
            throw new Error(`Failed to add website '${websiteData.url}' to your dashboard.`);
        }
    });
}
/**
* Removes a website from a user's dashboard.
* After removing the user link, it checks if any other users are monitoring the site.
* If not, it deactivates the website.
* It also triggers an update to the global interval regardless.
*/
// Changed userId type to string
function removeWebsiteFromUser(userId, websiteId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield prismaClient_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // 1. Delete the user's association
                yield tx.websiteUser.delete({
                    where: { userId_websiteId: { userId: userId, websiteId: websiteId } } // Use string ID
                });
                console.log(`[User Website] Removed website ${websiteId} from user ${userId}`);
                // 2. Check if any users remain for this website
                const remainingUsersCount = yield tx.websiteUser.count({
                    where: { websiteId: websiteId }
                });
                // 3. If no users remain, deactivate the website
                if (remainingUsersCount === 0) {
                    // Check current status before update
                    const currentWebsite = yield tx.website.findUnique({ where: { id: websiteId }, select: { isActive: true } });
                    if (currentWebsite === null || currentWebsite === void 0 ? void 0 : currentWebsite.isActive) {
                        yield tx.website.update({
                            where: { id: websiteId },
                            data: { isActive: false }
                        });
                        console.log(`[User Website] Deactivated website ${websiteId} as it has no more users.`);
                    }
                }
            }));
            // 4. Update the global interval (outside transaction, runs async)
            // Run this regardless of whether the transaction succeeded or hit P2025 initially
            updateGlobalInterval(websiteId).catch(err => console.error(`[Interval Update Post-Remove] Error updating global interval for website ${websiteId}:`, err));
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                // P2025: Record to delete not found (user link already gone)
                console.warn(`[User Website Removal] WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found (already removed?). Proceeding with orphan check.`);
                // Still need to check for orphans and update interval even if the delete failed because the record was gone
                try {
                    const remainingUsersCount = yield prismaClient_1.default.websiteUser.count({
                        where: { websiteId: websiteId }
                    });
                    if (remainingUsersCount === 0) {
                        const currentWebsite = yield prismaClient_1.default.website.findUnique({ where: { id: websiteId }, select: { isActive: true } });
                        if (currentWebsite === null || currentWebsite === void 0 ? void 0 : currentWebsite.isActive) {
                            yield prismaClient_1.default.website.update({
                                where: { id: websiteId },
                                data: { isActive: false }
                            });
                            console.log(`[User Website Removal] Deactivated website ${websiteId} after P2025 on user link removal.`);
                        }
                    }
                    // Trigger interval update after handling P2025
                    updateGlobalInterval(websiteId).catch(err => console.error(`[Interval Update Post-Remove P2025] Error updating global interval for website ${websiteId}:`, err));
                }
                catch (cleanupError) {
                    console.error(`[User Website Removal] Error during cleanup check after P2025 for user ${userId}, website ${websiteId}:`, cleanupError);
                    // Decide if this error should be thrown
                }
            }
            else {
                // Re-throw other unexpected errors
                console.error(`Error removing website ${websiteId} from user ${userId}:`, error);
                throw new Error(`Failed to remove website from dashboard (User: ${userId}, Website: ${websiteId}).`);
            }
        }
    });
}
// Changed userId type to string
function hasUserWebsite(userId, websiteId) {
    return __awaiter(this, void 0, void 0, function* () {
        const count = yield prismaClient_1.default.websiteUser.count({
            where: { userId: userId, websiteId: websiteId } // Use string ID
        });
        return count > 0;
    });
}
// No changes needed
function searchWebsites(searchTerm_1) {
    return __awaiter(this, arguments, void 0, function* (searchTerm, limit = 10) {
        if (!searchTerm || searchTerm.trim().length < 2)
            return [];
        const websitesPrisma = yield prismaClient_1.default.website.findMany({
            where: { url: { contains: searchTerm } },
            take: limit,
            orderBy: { url: 'asc' }
        });
        return websitesPrisma.map(w => mapPrismaWebsiteToShared(w)); // Use non-null assertion if confident
    });
}
