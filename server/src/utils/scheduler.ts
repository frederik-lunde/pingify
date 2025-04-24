// server/src/utils/scheduler.ts
import cron from 'node-cron';
import { Website as PrismaWebsite, Prisma } from '@prisma/client';
//
// Import structured config objects
//
import { monitoringConfig, schedulerConfig } from '../config/config';
import { WebsiteMonitor } from '../services/monitoringService';
import prisma from '../prisma/prismaClient';

//
// Use constants from config
//
const BATCH_CONCURRENCY = monitoringConfig.concurrency;
const DEFAULT_WEBSITE_INTERVAL = monitoringConfig.defaultIntervalSeconds;
const RESULTS_TO_KEEP_PER_WEBSITE = monitoringConfig.resultsToKeep;
const MINIMUM_INTERVAL_SECONDS = monitoringConfig.minimumIntervalSeconds;

// --- Website Monitoring Logic ---

/**
 * Determines if a website is due for checking based on its interval and last check time.
 */
function isWebsiteDueForCheck(website: PrismaWebsite): boolean {
  if (!website.lastChecked) {
    return true; // Never checked
  }
  const intervalInSeconds = website.globalInterval ?? DEFAULT_WEBSITE_INTERVAL;
  //
  // Use minimum interval from config
  //
  const effectiveIntervalSeconds = Math.max(MINIMUM_INTERVAL_SECONDS, intervalInSeconds);
  const millisecondsSinceLastCheck = Date.now() - new Date(website.lastChecked).getTime();
  return millisecondsSinceLastCheck >= (effectiveIntervalSeconds * 1000);
}

/**
 * Retrieves all websites marked as active from the database.
 */
async function getActiveWebsites(): Promise<PrismaWebsite[]> {
  return prisma.website.findMany({
    where: { isActive: true },
  });
}

/**
 * Processes websites in batches to limit concurrency during checks.
 * Uses the static method from WebsiteMonitor.
 */
async function processBatches(websites: PrismaWebsite[]): Promise<void> {
  console.log(`[Scheduler] Processing ${websites.length} websites in batches of ${BATCH_CONCURRENCY}...`);
  for (let i = 0; i < websites.length; i += BATCH_CONCURRENCY) {
    const batch = websites.slice(i, i + BATCH_CONCURRENCY);
    const batchNum = Math.floor(i / BATCH_CONCURRENCY) + 1;
    const totalBatches = Math.ceil(websites.length / BATCH_CONCURRENCY);
    console.log(`[Scheduler] Starting batch ${batchNum}/${totalBatches} (Size: ${batch.length})`);

    const results = await Promise.allSettled(batch.map(website => {
      return WebsiteMonitor.checkWebsite(website).catch(err => {
        console.error(`[Scheduler Batch Error] Unhandled error checking website ${website.id} (${website.url}):`, err);
        return { websiteId: website.id, error: true };
      });
    }));

    //
    // Optional: Log detailed batch results if needed
    //
    results.forEach((result, index) => {
      const websiteId = batch[index].id;
      if (result.status === 'rejected') {
        console.error(`[Scheduler Batch Result] Check Failed (Promise Rejected) for Website ID ${websiteId}:`, result.reason);
      } else if (result.value && (result.value as any).error === true) {
        console.warn(`[Scheduler Batch Result] Check Completed with Error for Website ID ${websiteId}. See previous logs.`);
      }
    });

    console.log(`[Scheduler] Finished batch ${batchNum}/${totalBatches}.`);
  }
}

/**
 * Main function executed by the cron job to find and check websites that are due.
 */
export async function checkDueWebsites(): Promise<void> {
  const startTime = Date.now();
  console.log(`[Scheduler - ${new Date().toISOString()}] Starting check for due websites...`);
  try {
    const activeWebsites = await getActiveWebsites();
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
    await processBatches(dueWebsites);

    const duration = Date.now() - startTime;
    console.log(`[Scheduler] Completed checking cycle for ${dueWebsites.length} websites in ${duration}ms.`);

  } catch (error) {
    console.error('[Scheduler] CRITICAL error during checkDueWebsites execution:', error);
  }
}

// --- Cleanup Tasks ---

/**
 * Deactivates websites that are marked active but have no associated users.
 */
export async function cleanupUnusedWebsites(): Promise<void> {
  const startTime = Date.now();
  console.log(`[Scheduler Cleanup - ${new Date().toISOString()}] Starting cleanup of unused websites...`);
  try {
    const whereClause: Prisma.WebsiteWhereInput = {
      isActive: true,
      websiteUsers: { none: {} },
    };

    const unusedWebsites = await prisma.website.findMany({
      where: whereClause,
      select: { id: true, url: true }
    });

    if (unusedWebsites.length === 0) {
      console.log('[Scheduler Cleanup] No unused websites found to deactivate.');
      return;
    }

    console.log(`[Scheduler Cleanup] Found ${unusedWebsites.length} active websites without any users. Deactivating...`);
    unusedWebsites.forEach(w => console.log(`  - Deactivating ID: ${w.id}, URL: ${w.url}`));

    const updateResult = await prisma.website.updateMany({
      where: whereClause,
      data: { isActive: false },
    });

    const duration = Date.now() - startTime;
    console.log(`[Scheduler Cleanup] Deactivated ${updateResult.count} unused websites in ${duration}ms.`);
  } catch (error) {
    console.error('[Scheduler Cleanup] Failed to cleanup unused websites:', error);
  }
}

/**
 * Purges old monitoring results for each website, keeping only the most recent N records.
 */
//
// Pass the configured value directly
//
export async function purgeOldMonitoringResults(resultsToKeep: number = RESULTS_TO_KEEP_PER_WEBSITE): Promise<void> {
  const startTime = Date.now();
  console.log(`[Scheduler Purge - ${new Date().toISOString()}] Starting purge of old monitoring results (keeping last ${resultsToKeep} per website)...`);
  try {
    const websites = await prisma.website.findMany({
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
        const recentResults = await prisma.monitoringResult.findMany({
          where: { websiteId: website.id },
          orderBy: { checkedAt: 'desc' },
          take: resultsToKeep,
          select: { id: true }
        });

        const resultIdsToKeep = recentResults.map(r => r.id);

        //
        // Only delete if the number of results exceeds the keep threshold
        //
        const totalCount = await prisma.monitoringResult.count({ where: { websiteId: website.id } });

        if (totalCount > resultsToKeep) {
            const deleteResult = await prisma.monitoringResult.deleteMany({
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
      } catch (innerError) {
          console.error(`[Scheduler Purge] Error purging results for website ${website.id}:`, innerError);
      }
    }

    const duration = Date.now() - startTime;
    if (totalPurgedCount > 0) {
      console.log(`[Scheduler Purge] Purged a total of ${totalPurgedCount} old monitoring results across ${websitesProcessed} websites in ${duration}ms.`);
    } else {
      console.log(`[Scheduler Purge] No old monitoring results found to purge across ${websitesProcessed} websites in ${duration}ms.`);
    }

  } catch (error) {
    console.error('[Scheduler Purge] Failed during the overall process of purging old monitoring results:', error);
  }
}

// --- Scheduler Setup ---

/**
 * Initializes and starts all scheduled cron jobs.
 */
export function scheduleMonitoring(): void {
  console.log("[Scheduler] Initializing schedulers...");

  //
  // 1. Website Monitoring Check (Use config pattern)
  //
  const monitorCron = schedulerConfig.monitorCronPattern;
  if (cron.validate(monitorCron)) {
    cron.schedule(monitorCron, checkDueWebsites, { name: "websiteChecker" });
    console.log(`[Scheduler] Website monitoring scheduler started: runs based on '${monitorCron}'.`);
  } else {
    console.error(`[Scheduler] Invalid cron pattern for monitoring: ${monitorCron}`);
  }

  //
  // 2. Unused Website Cleanup (Use config pattern)
  //
  const cleanupCron = schedulerConfig.cleanupCronPattern;
  if (cron.validate(cleanupCron)) {
    cron.schedule(cleanupCron, cleanupUnusedWebsites, { name: "unusedWebsiteCleanup" });
    console.log(`[Scheduler] Unused website cleanup scheduler started: runs based on '${cleanupCron}'.`);
  } else {
    console.error(`[Scheduler] Invalid cron pattern for cleanup: ${cleanupCron}`);
  }

  //
  // 3. Old Monitoring Results Purge (Use config pattern)
  //
  const purgeCron = schedulerConfig.purgeCronPattern;
  if (cron.validate(purgeCron)) {
    cron.schedule(purgeCron, () => purgeOldMonitoringResults(RESULTS_TO_KEEP_PER_WEBSITE), { name: "resultsPurge" });
    console.log(`[Scheduler] Database monitoring results purge scheduler started: runs based on '${purgeCron}', keeping ${RESULTS_TO_KEEP_PER_WEBSITE} results.`);
  } else {
    console.error(`[Scheduler] Invalid cron pattern for purge: ${purgeCron}`);
  }

  console.log("[Scheduler] All schedulers initialized.");
}

// --- Manual Execution Exports ---
export const runMonitoringCheck = checkDueWebsites;
export const runUnusedCleanup = cleanupUnusedWebsites;
//
// Ensure manual run uses the config value
//
export const runResultsPurge = () => purgeOldMonitoringResults(RESULTS_TO_KEEP_PER_WEBSITE);