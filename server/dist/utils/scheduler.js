"use strict";
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
exports.runResultsPurge = exports.runUnusedCleanup = exports.runMonitoringCheck = void 0;
exports.checkDueWebsites = checkDueWebsites;
exports.cleanupUnusedWebsites = cleanupUnusedWebsites;
exports.purgeOldMonitoringResults = purgeOldMonitoringResults;
exports.scheduleMonitoring = scheduleMonitoring;
// server/src/utils/scheduler.ts
const node_cron_1 = __importDefault(require("node-cron"));
const config_1 = require("../config/config");
const monitoringService_1 = require("../services/monitoringService");
const prismaClient_1 = __importDefault(require("../prisma/prismaClient"));
// Use constants from config
const BATCH_CONCURRENCY = config_1.monitoringConfig.concurrency;
const DEFAULT_WEBSITE_INTERVAL = config_1.monitoringConfig.defaultIntervalSeconds;
const RESULTS_TO_KEEP_PER_WEBSITE = config_1.monitoringConfig.resultsToKeep;
const MINIMUM_INTERVAL_SECONDS = config_1.monitoringConfig.minimumIntervalSeconds;
// --- Website Monitoring Logic ---
function isWebsiteDueForCheck(website) {
    var _a;
    if (!website.lastChecked) {
        return true;
    }
    const intervalInSeconds = (_a = website.globalInterval) !== null && _a !== void 0 ? _a : DEFAULT_WEBSITE_INTERVAL;
    const effectiveIntervalSeconds = Math.max(MINIMUM_INTERVAL_SECONDS, intervalInSeconds);
    const millisecondsSinceLastCheck = Date.now() - new Date(website.lastChecked).getTime();
    return millisecondsSinceLastCheck >= (effectiveIntervalSeconds * 1000);
}
function getActiveWebsites() {
    return __awaiter(this, void 0, void 0, function* () {
        return prismaClient_1.default.website.findMany({
            where: { isActive: true },
        });
    });
}
//Processes websites in batches to limit concurrency during checks.
function processBatches(websites) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[Scheduler] Processing ${websites.length} websites in batches of ${BATCH_CONCURRENCY}...`);
        for (let i = 0; i < websites.length; i += BATCH_CONCURRENCY) {
            const batch = websites.slice(i, i + BATCH_CONCURRENCY);
            const batchNum = Math.floor(i / BATCH_CONCURRENCY) + 1;
            const totalBatches = Math.ceil(websites.length / BATCH_CONCURRENCY);
            console.log(`[Scheduler] Starting batch ${batchNum}/${totalBatches} (Size: ${batch.length})`);
            const results = yield Promise.allSettled(batch.map(website => {
                return monitoringService_1.WebsiteMonitor.checkWebsite(website).catch(err => {
                    console.error(`[Scheduler Batch Error] Unhandled error checking website ${website.id} (${website.url}):`, err);
                    return { websiteId: website.id, error: true };
                });
            }));
            //logging
            results.forEach((result, index) => {
                const websiteId = batch[index].id;
                if (result.status === 'rejected') {
                    console.error(`[Scheduler Batch Result] Check Failed (Promise Rejected) for Website ID ${websiteId}:`, result.reason);
                }
                else if (result.value && result.value.error === true) {
                    console.warn(`[Scheduler Batch Result] Check Completed with Error for Website ID ${websiteId}. See previous logs.`);
                }
            });
            console.log(`[Scheduler] Finished batch ${batchNum}/${totalBatches}.`);
        }
    });
}
function checkDueWebsites() {
    return __awaiter(this, void 0, void 0, function* () {
        const startTime = Date.now();
        console.log(`[Scheduler - ${new Date().toISOString()}] Starting check for due websites...`);
        try {
            const activeWebsites = yield getActiveWebsites();
            if (activeWebsites.length === 0) {
                console.log("[Scheduler] No active websites found.");
                return;
            }
            const dueWebsites = activeWebsites.filter(isWebsiteDueForCheck);
            if (dueWebsites.length === 0) {
                console.log('[Scheduler] No websites currently due for checking.');
                return;
            }
            console.log(`[Scheduler] Found ${dueWebsites.length} websites due for monitoring.`);
            yield processBatches(dueWebsites);
            const duration = Date.now() - startTime;
            console.log(`[Scheduler] Completed checking cycle for ${dueWebsites.length} websites in ${duration}ms.`);
        }
        catch (error) {
            console.error('[Scheduler] CRITICAL error during checkDueWebsites execution:', error);
        }
    });
}
// --- Cleanup Tasks ---
function cleanupUnusedWebsites() {
    return __awaiter(this, void 0, void 0, function* () {
        const startTime = Date.now();
        console.log(`[Scheduler Cleanup - ${new Date().toISOString()}] Starting cleanup of unused websites...`);
        try {
            const whereClause = {
                isActive: true,
                websiteUsers: { none: {} },
            };
            const unusedWebsites = yield prismaClient_1.default.website.findMany({
                where: whereClause,
                select: { id: true, url: true }
            });
            if (unusedWebsites.length === 0) {
                console.log('[Scheduler Cleanup] No unused websites found to deactivate.');
                return;
            }
            console.log(`[Scheduler Cleanup] Found ${unusedWebsites.length} active websites without any users. Deactivating...`);
            unusedWebsites.forEach(w => console.log(`  - Deactivating ID: ${w.id}, URL: ${w.url}`));
            const updateResult = yield prismaClient_1.default.website.updateMany({
                where: whereClause,
                data: { isActive: false },
            });
            const duration = Date.now() - startTime;
            console.log(`[Scheduler Cleanup] Deactivated ${updateResult.count} unused websites in ${duration}ms.`);
        }
        catch (error) {
            console.error('[Scheduler Cleanup] Failed to cleanup unused websites:', error);
        }
    });
}
//Purges old monitoring results for each website, keeping only the most recent N records.
function purgeOldMonitoringResults() {
    return __awaiter(this, arguments, void 0, function* (resultsToKeep = RESULTS_TO_KEEP_PER_WEBSITE) {
        const startTime = Date.now();
        console.log(`[Scheduler Purge - ${new Date().toISOString()}] Starting purge of old monitoring results (keeping last ${resultsToKeep} per website)...`);
        try {
            const websites = yield prismaClient_1.default.website.findMany({
                select: { id: true }
            });
            if (websites.length === 0) {
                console.log("[Scheduler Purge] No websites found. Skipping monitoring results purge.");
                return;
            }
            let totalPurgedCount = 0;
            let websitesProcessed = 0;
            for (const website of websites) {
                try {
                    const recentResults = yield prismaClient_1.default.monitoringResult.findMany({
                        where: { websiteId: website.id },
                        orderBy: { checkedAt: 'desc' },
                        take: resultsToKeep,
                        select: { id: true }
                    });
                    const resultIdsToKeep = recentResults.map(r => r.id);
                    // Only delete if the number of results exceeds the keep threshold
                    const totalCount = yield prismaClient_1.default.monitoringResult.count({ where: { websiteId: website.id } });
                    if (totalCount > resultsToKeep) {
                        const deleteResult = yield prismaClient_1.default.monitoringResult.deleteMany({
                            where: {
                                websiteId: website.id,
                                id: { notIn: resultIdsToKeep }
                            }
                        });
                        if (deleteResult.count > 0) {
                            totalPurgedCount += deleteResult.count;
                        }
                    }
                    websitesProcessed++;
                }
                catch (innerError) {
                    console.error(`[Scheduler Purge] Error purging results for website ${website.id}:`, innerError);
                }
            }
            const duration = Date.now() - startTime;
            if (totalPurgedCount > 0) {
                console.log(`[Scheduler Purge] Purged a total of ${totalPurgedCount} old monitoring results across ${websitesProcessed} websites in ${duration}ms.`);
            }
            else {
                console.log(`[Scheduler Purge] No old monitoring results found to purge across ${websitesProcessed} websites in ${duration}ms.`);
            }
        }
        catch (error) {
            console.error('[Scheduler Purge] Failed during the overall process of purging old monitoring results:', error);
        }
    });
}
// --- Scheduler Setup ---
function scheduleMonitoring() {
    console.log("[Scheduler] Initializing schedulers...");
    //
    // 1. Website Monitoring Check
    //
    const monitorCron = config_1.schedulerConfig.monitorCronPattern;
    if (node_cron_1.default.validate(monitorCron)) {
        node_cron_1.default.schedule(monitorCron, checkDueWebsites, { name: "websiteChecker" });
        console.log(`[Scheduler] Website monitoring scheduler started: runs based on '${monitorCron}'.`);
    }
    else {
        console.error(`[Scheduler] Invalid cron pattern for monitoring: ${monitorCron}`);
    }
    // 2. Unused Website Cleanup
    const cleanupCron = config_1.schedulerConfig.cleanupCronPattern;
    if (node_cron_1.default.validate(cleanupCron)) {
        node_cron_1.default.schedule(cleanupCron, cleanupUnusedWebsites, { name: "unusedWebsiteCleanup" });
        console.log(`[Scheduler] Unused website cleanup scheduler started: runs based on '${cleanupCron}'.`);
    }
    else {
        console.error(`[Scheduler] Invalid cron pattern for cleanup: ${cleanupCron}`);
    }
    //
    // 3. Old Monitoring Results Purge
    //
    const purgeCron = config_1.schedulerConfig.purgeCronPattern;
    if (node_cron_1.default.validate(purgeCron)) {
        node_cron_1.default.schedule(purgeCron, () => purgeOldMonitoringResults(RESULTS_TO_KEEP_PER_WEBSITE), { name: "resultsPurge" });
        console.log(`[Scheduler] Database monitoring results purge scheduler started: runs based on '${purgeCron}', keeping ${RESULTS_TO_KEEP_PER_WEBSITE} results.`);
    }
    else {
        console.error(`[Scheduler] Invalid cron pattern for purge: ${purgeCron}`);
    }
    console.log("[Scheduler] All schedulers initialized.");
}
exports.runMonitoringCheck = checkDueWebsites;
exports.runUnusedCleanup = cleanupUnusedWebsites;
const runResultsPurge = () => purgeOldMonitoringResults(RESULTS_TO_KEEP_PER_WEBSITE);
exports.runResultsPurge = runResultsPurge;
