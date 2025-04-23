
```typescript
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
```

**4. Update `server/src/services/websiteService.ts`**

Import and use the config value for the default interval.

```typescript
// server/src/services/websiteService.ts
import {
  PrismaClient,
  Website as PrismaWebsite,
  WebsiteUser as PrismaWebsiteUser,
  MonitoringResult as PrismaMonitoringResult,
  Prisma
} from '@prisma/client';
import prisma from '../prisma/prismaClient';
import { StatsCalculator } from './monitoringService';
import * as IncidentService from './incidentService';
import { subDays } from 'date-fns';
//
// Import config
//
import { monitoringConfig } from '../config/config';

// --- Import SHARED Types ---
import {
  AddWebsiteUserDTO,
  Website,
  WebsiteUser,
  UpdateWebsiteUserDTO,
  SetPinStatusDTO,
  MonitoringResult as SharedMonitoringResult,
  ChartDataPoint,
  TimeframeKey,
  Incident,
} from '../types';

// --- Constants ---
//
// Use default interval from config
//
const DEFAULT_GLOBAL_INTERVAL = monitoringConfig.defaultIntervalSeconds;
//
// These seem specific to the UI/card display, keeping them here is reasonable
// unless you foresee needing to configure them via .env
//
const CARD_TIMEFRAME: TimeframeKey = 'day';
const MAX_CARD_DATA_POINTS = 24;

// --- Mapping Helper Functions ---
const mapPrismaWebsiteToShared = (website: PrismaWebsite | null): Website | null => {
  if (!website) return null;
  return {
    id: website.id,
    url: website.url,
    isActive: website.isActive,
    lastChecked: website.lastChecked?.toISOString() ?? null,
    globalInterval: website.globalInterval,
    createdAt: website.createdAt?.toISOString() ?? undefined,
    updatedAt: website.updatedAt?.toISOString() ?? undefined
  };
};

const mapPrismaResultToSharedBasic = ( prismaResult: PrismaMonitoringResult | null ): SharedMonitoringResult | null => {
  if (!prismaResult) return null;
  const coreData: Omit<SharedMonitoringResult, 'website'> = {
    id: prismaResult.id,
    websiteId: prismaResult.websiteId,
    checkedAt: prismaResult.checkedAt.toISOString(),
    responseTime: prismaResult.responseTime,
    isAvailable: prismaResult.isAvailable,
    statusCode: prismaResult.statusCode,
    errorMessage: prismaResult.errorMessage
  };
  return coreData as SharedMonitoringResult;
};

const mapPrismaWebsiteUserToSharedBase = ( websiteUser: any ): WebsiteUser | null => {
  if (!websiteUser) return null;
  const sharedWebsiteNested = websiteUser.website ? mapPrismaWebsiteToShared(websiteUser.website) : undefined;
  return {
    id: websiteUser.id,
    userId: websiteUser.userId,
    websiteId: websiteUser.websiteId,
    name: websiteUser.name,
    interval: websiteUser.interval,
    alertEnabled: websiteUser.alertEnabled,
    alertThreshold: websiteUser.alertThreshold,
    notifyEmail: websiteUser.notifyEmail,
    createdAt: websiteUser.createdAt.toISOString(),
    isPinned: websiteUser.isPinned,
    website: sharedWebsiteNested ?? undefined
  };
};

// --- Service Functions ---

export async function getAllWebsites(): Promise<Website[]> {
  const websitesPrisma = await prisma.website.findMany({ orderBy: { createdAt: 'desc' } });
  return websitesPrisma.map(w => mapPrismaWebsiteToShared(w)!);
}

export async function getWebsitesForUser(userId: number): Promise<WebsiteUser[]> {
  //
  // 1. Fetch base WebsiteUser data with Website included, sorted
  //
  const websiteUsersPrisma = await prisma.websiteUser.findMany({
      where: { userId },
      include: { website: true },
      orderBy: [ { isPinned: 'desc' }, { website: { url: 'asc' } } ]
  });

  if (websiteUsersPrisma.length === 0) return [];

  const websiteIds = websiteUsersPrisma.map(wu => wu.websiteId);

  //
  // 2. Fetch Latest Results
  //
  const latestResultsPromises = websiteIds.map(id =>
      prisma.monitoringResult.findFirst({
          where: { websiteId: id }, orderBy: { checkedAt: 'desc' },
          select: { id: true, websiteId: true, checkedAt: true, responseTime: true, isAvailable: true, statusCode: true, errorMessage: true }
      })
  );
  const latestResultsRaw = (await Promise.all(latestResultsPromises)).filter(r => r !== null) as PrismaMonitoringResult[];
  const latestResultMap = new Map<number, SharedMonitoringResult | null>();
  latestResultsRaw.forEach(result => {
      latestResultMap.set(result.websiteId, mapPrismaResultToSharedBasic(result));
  });

  //
  // 3. Fetch Current Open Incidents
  //
  const openIncidentsPromises = websiteIds.map(id =>
      IncidentService.getCurrentOpenIncidentForWebsite(id)
  );
  const openIncidents = (await Promise.all(openIncidentsPromises)).filter(inc => inc !== null) as Incident[];
  const openIncidentMap = new Map<number, Incident>();
  openIncidents.forEach(incident => {
      openIncidentMap.set(incident.websiteId, incident);
  });

  //
  // 4. Fetch Chart Data (Using local constants CARD_TIMEFRAME, MAX_CARD_DATA_POINTS)
  //
  const chartDataPromises = websiteIds.map(id =>
      StatsCalculator.getChartDataForWebsite(id, CARD_TIMEFRAME)
          .then(data => ({ websiteId: id, chartData: data.slice(-MAX_CARD_DATA_POINTS) }))
  );
  const chartDataResults = await Promise.all(chartDataPromises);
  const chartDataMap = new Map<number, ChartDataPoint[]>();
  chartDataResults.forEach(result => { chartDataMap.set(result.websiteId, result.chartData); });

  //
  // 5. Fetch Uptime Percentage (Daily)
  //
  const dailyStartDate = subDays(new Date(), 1);
  const uptimePromises = websiteIds.map(id =>
      StatsCalculator.calculateUptimeBetweenDates(id, dailyStartDate, new Date())
          .then(uptime => ({ websiteId: id, uptimePercent: uptime }))
  );
  const uptimeResults = await Promise.all(uptimePromises);
  const uptimeMap = new Map<number, number>();
  uptimeResults.forEach(result => { uptimeMap.set(result.websiteId, result.uptimePercent); });

  //
  // 6. Map Prisma results to Shared type and augment
  //
  const results: WebsiteUser[] = websiteUsersPrisma.map(wuPrisma => {
      const sharedWu = mapPrismaWebsiteUserToSharedBase(wuPrisma);
      if (!sharedWu) return null;

      //
      // Add dynamic data
      //
      sharedWu.latestResult = latestResultMap.get(sharedWu.websiteId) ?? null;
      sharedWu.chartData = chartDataMap.get(sharedWu.websiteId) ?? [];
      sharedWu.uptimePercent = uptimeMap.get(sharedWu.websiteId) ?? 100;
      sharedWu.currentIncident = openIncidentMap.get(sharedWu.websiteId) ?? null;

      return sharedWu;
  }).filter(wu => wu !== null) as WebsiteUser[];

  return results;
}

export async function getWebsiteById(id: number): Promise<Website | null> {
  const websitePrisma = await prisma.website.findUnique({ where: { id } });
  return mapPrismaWebsiteToShared(websitePrisma);
}

export async function getWebsiteByUrl(url: string): Promise<Website | null> {
  const websitePrisma = await prisma.website.findUnique({ where: { url } });
  return mapPrismaWebsiteToShared(websitePrisma);
}

export async function getUserWebsiteById(userId: number, websiteId: number): Promise<WebsiteUser | null> {
  const userWebsitePrisma = await prisma.websiteUser.findUnique({
    where: { userId_websiteId: { userId, websiteId } }, include: { website: true }
  });
  return mapPrismaWebsiteUserToSharedBase(userWebsitePrisma);
}

export async function createWebsite(data: { url: string; interval?: number }): Promise<Website> {
  if (!data.url || !/^https?:\/\/.+/.test(data.url)) {
      throw new Error('Invalid URL format provided for website creation.');
  }
  try {
    const websitePrisma = await prisma.website.create({
      data: {
        url: data.url,
        //
        // Use config value here
        //
        globalInterval: DEFAULT_GLOBAL_INTERVAL,
        isActive: true
      }
    });
    return mapPrismaWebsiteToShared(websitePrisma)!;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      console.error(`Website creation failed: URL '${data.url}' already exists.`);
      throw new Error(`Website with URL '${data.url}' already exists.`);
    }
    console.error("Error creating website:", error);
    throw error;
  }
}

export async function updateGlobalInterval(websiteId: number): Promise<void> {
  const websiteUsers = await prisma.websiteUser.findMany({
    where: {
      websiteId: websiteId,
      interval: {
        not: null,
        gt: 0
      }
    },
    select: { interval: true }
  });

  const intervals = websiteUsers.map(wu => wu.interval!).filter((i): i is number => i !== null);

  let newGlobalInterval: number;
  if (intervals.length > 0) {
      newGlobalInterval = Math.min(...intervals);
  } else {
      //
      // Use config value here
      //
      newGlobalInterval = DEFAULT_GLOBAL_INTERVAL;
  }

  const currentWebsite = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { globalInterval: true }
  });

  if (currentWebsite && currentWebsite.globalInterval !== newGlobalInterval) {
      try {
          await prisma.website.update({
              where: { id: websiteId },
              data: { globalInterval: newGlobalInterval }
          });
          console.log(`[Interval Update] Updated global interval for website ${websiteId} to ${newGlobalInterval} seconds.`);
      } catch (error) {
          console.error(`[Interval Update] Failed to update global interval for website ${websiteId}:`, error);
      }
  } else if (!currentWebsite) {
       console.warn(`[Interval Update] Website with ID ${websiteId} not found during interval update check.`);
  }
}

export async function updateWebsiteCore(id: number, data: Partial<{ url: string; isActive?: boolean }>): Promise<Website | null> {
  try {
    if (data.url !== undefined && (data.url === null || !/^https?:\/\/.+/.test(data.url))) {
      throw new Error('Invalid URL format provided for website update.');
    }
    const updatePayload: Prisma.WebsiteUpdateInput = {};
    if (data.url !== undefined) updatePayload.url = data.url;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

    if (Object.keys(updatePayload).length === 0) {
        console.warn(`No core website data provided for update on ID ${id}.`);
         const currentWebsite = await prisma.website.findUnique({ where: { id } });
         return mapPrismaWebsiteToShared(currentWebsite);
    }

    const websitePrisma = await prisma.website.update({ where: { id }, data: updatePayload });
    return mapPrismaWebsiteToShared(websitePrisma);
  } catch (error) {
     if (error instanceof Prisma.PrismaClientKnownRequestError) {
         if (error.code === 'P2025') {
             console.warn(`Website with ID ${id} not found for update.`);
             return null;
         }
         if (error.code === 'P2002') {
             console.error(`Website update failed: URL '${data.url}' already exists.`);
             throw new Error(`Another website with URL '${data.url}' already exists.`);
         }
     }
    console.error(`Error updating core website ${id}:`, error);
    throw error;
  }
}

export async function updateUserWebsite( userId: number, websiteId: number, data: UpdateWebsiteUserDTO ): Promise<WebsiteUser | null> {
  const prismaUpdateData: Prisma.WebsiteUserUpdateWithoutUserInput = {};
  if (data.name !== undefined) prismaUpdateData.name = data.name;
  if (data.interval !== undefined) prismaUpdateData.interval = data.interval;
  if (data.alertThreshold !== undefined) prismaUpdateData.alertThreshold = data.alertThreshold;
  if (data.notifyEmail !== undefined) prismaUpdateData.notifyEmail = data.notifyEmail;
  if (typeof data.alertEnabled === 'boolean') prismaUpdateData.alertEnabled = data.alertEnabled;
  if (typeof data.isPinned === 'boolean') prismaUpdateData.isPinned = data.isPinned;

  if (Object.keys(prismaUpdateData).length === 0) {
      console.warn(`No update data provided for user ${userId}, website ${websiteId}. Skipping update.`);
      return getUserWebsiteById(userId, websiteId);
  }

  try {
      const updatedWebsiteUserPrisma = await prisma.websiteUser.update({
          where: { userId_websiteId: { userId, websiteId } },
          data: prismaUpdateData,
          include: { website: true }
      });

      //
      // Trigger interval update if interval was changed
      //
      if (data.interval !== undefined) {
          updateGlobalInterval(websiteId).catch(err => console.error("Error updating global interval post-update:", err));
      }

      return mapPrismaWebsiteUserToSharedBase(updatedWebsiteUserPrisma);
  } catch (error) {
       if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          console.warn(`WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for update.`);
          return null;
       }
      console.error(`Error updating user website settings for user ${userId}, website ${websiteId}:`, error);
      throw error;
  }
}

export async function setPinStatusForUser( userId: number, websiteId: number, isPinned: boolean ): Promise<WebsiteUser | null> {
  try {
    const updatedWebsiteUserPrisma = await prisma.websiteUser.update({
      where: { userId_websiteId: { userId, websiteId } },
      data: { isPinned: isPinned },
      include: { website: true },
    });
    return mapPrismaWebsiteUserToSharedBase(updatedWebsiteUserPrisma);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      console.warn(`WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for pin update.`);
      return null;
    }
    console.error(`Error setting pin status for user ${userId}, website ${websiteId}:`, error);
    throw error;
  }
}

export async function deleteWebsite(id: number): Promise<Website | null> {
  try {
    //
    // Note: Deleting a website cascades to WebsiteUser, MonitoringResult, Incident, Alert due to schema relations
    //
    const websitePrisma = await prisma.website.delete({ where: { id } });
    return mapPrismaWebsiteToShared(websitePrisma);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      console.warn(`Website with ID ${id} not found for deletion.`);
      return null;
    }
    console.error(`Error deleting website ${id}:`, error);
    throw error;
  }
}

export async function toggleWebsiteStatus(id: number): Promise<Website | null> {
  try {
    const updatedWebsitePrisma = await prisma.$transaction(async (tx) => {
      const website = await tx.website.findUnique({ where: { id }, select: { isActive: true } });
      if (!website) throw new Error(`Website with ID ${id} not found`);
      return tx.website.update({ where: { id }, data: { isActive: !website.isActive } });
    });
    return mapPrismaWebsiteToShared(updatedWebsitePrisma);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      console.warn(`Website with ID ${id} not found for toggle.`);
      return null;
    }
    console.error(`Error toggling status for website ${id}:`, error);
    throw error;
  }
}

export async function addWebsiteToUser(userId: number, websiteData: AddWebsiteUserDTO): Promise<WebsiteUser> {
  if (!websiteData.url || !/^https?:\/\/.+/.test(websiteData.url)) {
      throw new Error('Invalid URL format provided.');
  }

  try {
    const websiteUserPrisma = await prisma.$transaction(async (tx) => {
      //
      // Upsert the website: find existing or create new
      // Ensure it's marked active if found
      //
      let website = await tx.website.upsert({
        where: { url: websiteData.url },
        update: {
          //
          // Ensure existing website is activated if user adds it
          //
          isActive: true
        },
        create: {
          url: websiteData.url,
          //
          // Use config value for new website interval
          //
          globalInterval: DEFAULT_GLOBAL_INTERVAL,
          isActive: true
        },
      });

      //
      // Upsert the user-website relationship
      //
      const websiteUser = await tx.websiteUser.upsert({
            where: { userId_websiteId: { userId, websiteId: website.id } },
            update: {
                name: websiteData.name,
                interval: websiteData.interval,
                alertThreshold: websiteData.alertThreshold,
                alertEnabled: websiteData.alertEnabled ?? false,
                notifyEmail: websiteData.notifyEmail,
                isPinned: websiteData.isPinned ?? false
            },
            create: {
                userId,
                websiteId: website.id,
                name: websiteData.name,
                interval: websiteData.interval,
                alertThreshold: websiteData.alertThreshold,
                alertEnabled: websiteData.alertEnabled ?? false,
                notifyEmail: websiteData.notifyEmail,
                isPinned: websiteData.isPinned ?? false
            },
            include: { website: true } // Include website for mapping
        });

        //
        // Trigger global interval update after adding/updating user preference
        // Run async, don't wait for it
        //
        updateGlobalInterval(website.id).catch(err => console.error("Error updating global interval post-add:", err));

        return websiteUser;
    });

    return mapPrismaWebsiteUserToSharedBase(websiteUserPrisma)!;
  } catch (error) {
      console.error(`Error in addWebsiteToUser for user ${userId}, URL ${websiteData.url}:`, error);
      // Provide a more user-friendly error message
      throw new Error(`Failed to add website '${websiteData.url}' to your dashboard. Please try again.`);
  }
}

/**
 * Removes a website from a user's dashboard.
 * After removing the user link, it checks if any other users are monitoring the site.
 * If not, it deactivates the website.
 * It also triggers an update to the global interval regardless.
 */
export async function removeWebsiteFromUser(userId: number, websiteId: number): Promise<void> {
  try {
    //
    // Use a transaction to ensure atomicity of delete and potential deactivate
    //
    await prisma.$transaction(async (tx) => {
      //
      // 1. Delete the user's association
      //
      await tx.websiteUser.delete({
        where: { userId_websiteId: { userId, websiteId } }
      });
      console.log(`[User Website] Removed website ${websiteId} from user ${userId}`);

      //
      // 2. Check if any users remain for this website
      //
      const remainingUsersCount = await tx.websiteUser.count({
          where: { websiteId: websiteId }
      });

      //
      // 3. If no users remain, deactivate the website
      //
      if (remainingUsersCount === 0) {
          await tx.website.update({
              where: { id: websiteId },
              data: { isActive: false }
          });
          console.log(`[User Website] Deactivated website ${websiteId} as it has no more users.`);
      }
    });

    //
    // 4. Update the global interval (outside transaction, runs async)
    // This will reset it to default if the website was deactivated or if remaining users have no preference.
    //
    updateGlobalInterval(websiteId).catch(err => console.error("Error updating global interval post-remove:", err));

  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      //
      // Record already deleted - this is okay for removal.
      // Still check if the website needs deactivation and update interval,
      // as the cleanup job might not have run yet.
      //
      console.warn(`WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for deletion (already removed?). Checking for deactivation and interval update.`);

      //
      // Perform the check and potential deactivation outside the failed transaction
      //
      const remainingUsersCount = await prisma.websiteUser.count({
          where: { websiteId: websiteId }
      });

      if (remainingUsersCount === 0) {
          try {
              await prisma.website.update({
                  where: { id: websiteId },
                  data: { isActive: false }
              });
              console.log(`[User Website] Deactivated website ${websiteId} after finding P2025 on user removal (no remaining users).`);
          } catch (updateError) {
                //
                // Log error if deactivation fails (e.g., website deleted concurrently)
                //
                console.error(`[User Website] Failed to deactivate website ${websiteId} after P2025:`, updateError);
          }
      }
      //
      // Always trigger interval update
      //
      updateGlobalInterval(websiteId).catch(err => console.error("Error updating global interval post-remove (after P2025):", err));

    } else {
        //
        // Re-throw other errors
        //
        console.error(`Error removing website ${websiteId} from user ${userId}:`, error);
        throw error;
    }
  }
}

export async function hasUserWebsite(userId: number, websiteId: number): Promise<boolean> {
  const count = await prisma.websiteUser.count({ where: { userId: userId, websiteId: websiteId } });
  return count > 0;
}

export async function searchWebsites(searchTerm: string, limit = 10): Promise<Website[]> {
  if (!searchTerm || searchTerm.trim().length < 2) return [];
  const websitesPrisma = await prisma.website.findMany({
    where: { url: { contains: searchTerm } }, take: limit, orderBy: { url: 'asc' }
  });
  return websitesPrisma.map(w => mapPrismaWebsiteToShared(w)!);
}

```

**5. Update `server/src/services/monitoringService.ts`**

Import and use config values for timeout and user agent.

```typescript
// server/src/services/monitoringService.ts
import axios, { AxiosError } from 'axios';
import { performance } from 'perf_hooks';
import {
  Website as PrismaWebsite,
  MonitoringResult as PrismaMonitoringResult,
  PrismaClient,
  Prisma,
  Incident as PrismaIncident,
} from '@prisma/client';
//
// Import config
//
import { monitoringConfig } from '../config/config';
import { handleResultProcessing } from './alertService';
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
  Incident,
  IncidentType,
} from '../types';

//
// Use constants from config
//
const REQUEST_TIMEOUT_MS = monitoringConfig.requestTimeoutMs;
const MONITOR_USER_AGENT = monitoringConfig.monitorUserAgent;

// ============================================================================
// WebsiteMonitor Class
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
              //
              // Use timeout from config
              //
              timeout: REQUEST_TIMEOUT_MS,
              headers: {
                  //
                  // Use user agent from config
                  //
                  'User-Agent': MONITOR_USER_AGENT,
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                  'Accept-Encoding': 'gzip, deflate, br', // Allow compressed responses
              },
              //
              // Don't throw errors for non-2xx/3xx status codes
              //
              validateStatus: () => true,
          });

          responseTime = Math.round(performance.now() - start);
          statusCode = response.status;
          //
          // Consider only 2xx codes as strictly 'available'
          //
          isAvailable = statusCode >= 200 && statusCode < 300;

          if (!isAvailable) {
              errorMessage = `HTTP Status ${statusCode}`;
          }
      } catch (error: unknown) {
          //
          // Ensure responseTime is recorded even on error
          //
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
          //
          // Error received a response from the server (e.g., 4xx, 5xx)
          //
          return `HTTP Error ${error.response.status}`;
      } else if (error.request) {
          //
          // Error made a request but received no response (network issues, timeout)
          //
          //
          // Use timeout from config in error message
          //
          if (error.code === 'ECONNABORTED') return `Request timed out (${REQUEST_TIMEOUT_MS}ms)`;
          if (error.code === 'ENOTFOUND') return 'DNS lookup failed (domain not found)';
          if (error.code === 'ECONNREFUSED') return 'Connection refused by server';
          if (error.code === 'ETIMEDOUT') return 'Connection timed out'; // Network level timeout
          if (error.code === 'EHOSTUNREACH') return 'No route to host';
          if (error.code === 'ECONNRESET') return 'Connection reset by peer';
          // Add more specific codes if needed
          return 'No response received from server';
      } else {
          //
          // Error occurred setting up the request
          //
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

          //
          // Save the result first (includes updating lastChecked)
          //
          savedResult = await ResultsManager.saveResult(website.id, checkResultData);
          console.log(`${logPrefix} Result saved (ID: ${savedResult.id}): Avail=${savedResult.isAvailable}, RT=${savedResult.responseTime}ms, Status=${savedResult.statusCode}, Err=${savedResult.errorMessage ?? 'None'}`);

          // --- Process the result for incidents/recoveries ---
          if (savedResult) {
              //
              // Call the central processing function from AlertService (which now handles incidents too)
              // Run this asynchronously (don't wait for it) but catch errors
              //
              handleResultProcessing(website, savedResult).catch(procError => {
                  console.error(`${logPrefix} Error during post-check result processing for R:${savedResult?.id}:`, procError);
              });
          } else {
              // This case should ideally not happen if saveResult throws on failure
              console.error(`${logPrefix} Saved result was unexpectedly null after save attempt.`);
              throw new Error("Failed to obtain saved result after check.");
          }

          return savedResult; // Return the saved result immediately

      } catch (error: any) {
          console.error(`${logPrefix} Critical failure during checkWebsite process: ${error.message}`, error.stack);
          //
          // Attempt to update lastChecked even on error, but only if saveResult failed before updating
          //
          try {
              if (!savedResult) {
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
// ResultsManager Class
// ============================================================================
export class ResultsManager {
  /**
   * Saves a monitoring result and updates the website's lastChecked timestamp in a transaction.
   */
  static async saveResult( websiteId: number, result: MonitoringResponse ): Promise<PrismaMonitoringResult> {
    const { responseTime, isAvailable, statusCode, errorMessage } = result;
    const checkedAt = new Date(); // Use a single timestamp for consistency

    try {
      const savedMonitoringResult = await prisma.$transaction(async (tx) => {
        //
        // Update lastChecked on the website
        //
        await tx.website.update({
          where: { id: websiteId },
          data: { lastChecked: checkedAt },
        });

        //
        // Create the monitoring result record
        //
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

      return savedMonitoringResult;
    } catch (error) {
      console.error(`[ResultsManager] Error saving result for website ${websiteId}:`, error);
      throw error; // Re-throw to be handled by the caller (checkWebsite)
    }
  }

  /**
   * Gets the ID of the most recent monitoring result for a website.
   */
  static async getLatestResultId(websiteId: number): Promise<number> {
      const result = await prisma.monitoringResult.findFirst({
          where: { websiteId }, orderBy: { checkedAt: 'desc' }, select: { id: true },
      });
      return result?.id || 0; // Return 0 if no results found
  }

  /**
   * Gets the most recent monitoring results for a specific website.
   */
  static async getResultsForWebsite(websiteId: number, limit = 100): Promise<PrismaMonitoringResult[]> {
      return prisma.monitoringResult.findMany({
          where: { websiteId }, orderBy: { checkedAt: 'desc' }, take: limit,
      });
  }

  /**
   * Gets all monitoring results, optionally filtered by date range. Includes website URL.
   */
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
          include: { website: { select: { url: true } } } // Include URL for context
      });
  }

  /**
   * Gets monitoring results for a specific website, optionally filtered by date range.
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
          where: whereClause, orderBy: { checkedAt: 'desc' }, take: limit
      });
  }

  /**
   * Gets monitoring results for websites monitored by a specific user, optionally filtered by date range.
   * Includes the user-specific name for the website.
   */
  static async getResultsForUser( userId: number, options: ResultsQueryOptions = {} ): Promise< (PrismaMonitoringResult & { website: { websiteUsers: { name: string | null }[] } | null })[] > {
      const { limit = 100, from, to } = options;
      //
      // Filter results where the related website has a WebsiteUser entry for the given userId
      //
      const whereClause: Prisma.MonitoringResultWhereInput = {
          website: {
              websiteUsers: { some: { userId } }
          }
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
                      //
                      // Include the specific WebsiteUser entry to get the user's custom name
                      //
                      websiteUsers: {
                          where: { userId }, // Filter to only this user's relation
                          select: { name: true } // Select only the name
                      }
                  }
              }
          }
      });
  }
}

// ============================================================================
// StatsCalculator Class
// ============================================================================
export class StatsCalculator {
  /**
   * Calculates uptime percentage between two dates for a website.
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
      if (totalChecks === 0) return 100; // Assume 100% if no checks in the period

      const successfulChecks = results.filter(r => r.isAvailable).length;
      const uptimePercentage = (successfulChecks / totalChecks) * 100;

      //
      // Return rounded percentage
      //
      return parseFloat(uptimePercentage.toFixed(2));
  }

  /**
   * Calculates average response time between two dates for available checks.
   */
  static async getAverageResponseTimeBetweenDates(websiteId: number, startDate: Date, endDate: Date = new Date()): Promise<number | null> {
      const result = await prisma.monitoringResult.aggregate({
          _avg: { responseTime: true },
          where: {
              websiteId,
              checkedAt: { gte: startDate, lte: endDate },
              isAvailable: true, // Only average successful checks
              responseTime: { not: null } // Exclude null response times
          },
      });

      //
      // Return rounded average or null
      //
      return result._avg.responseTime !== null ? Math.round(result._avg.responseTime) : null;
  }

  /**
   * Helper to convert timeframe key or string/number to days.
   */
  private static periodToDays(period: TimeframeKey | string | number): number {
      switch (period) {
          case 'hour': return 1 / 24;
          case 'day': return 1;
          case 'week': return 7;
          case 'month': return 30; // Approximation
          case 'year': return 365; // Approximation
      }
      // Handle numeric input
      if (typeof period === 'number') return period > 0 ? period : 7; // Default to 7 if invalid number
      // Handle string number input
      if (typeof period === 'string') {
          const value = parseInt(period);
          if (!isNaN(value) && value > 0) return value;
      }
      return 7; // Default to 'week' (7 days) if invalid input
  }

  /**
   * Calculates statistics for a single website over a given period.
   * Includes uptime, avg response time, and incident counts for the period.
   */
  static async getWebsiteStats( websiteId: number, userId?: number, period: TimeframeKey | string | number = 'week' ): Promise<WebsiteStatsData> {
      const days = this.periodToDays(period);
      const startDate = sub(new Date(), { days: days });
      const endDate = new Date();

      const website = await prisma.website.findUnique({
          where: { id: websiteId },
          select: { url: true }
      });
      if (!website) throw new Error(`Website with ID ${websiteId} not found`);

      //
      // Determine the display name (user's custom name or URL)
      //
      let websiteName = website.url;
      if (userId) {
          const userWebsite = await prisma.websiteUser.findUnique({
              where: { userId_websiteId: { userId, websiteId } }, select: { name: true }
          });
          if (userWebsite?.name) websiteName = userWebsite.name;
      }

      //
      // Fetch stats based on MonitoringResult within the period
      //
      const [ uptime, averageResponseTime, totalChecks, lastResultData ] = await Promise.all([
          this.calculateUptimeBetweenDates(websiteId, startDate, endDate),
          this.getAverageResponseTimeBetweenDates(websiteId, startDate, endDate),
          prisma.monitoringResult.count({ where: { websiteId, checkedAt: { gte: startDate, lte: endDate } } }),
          prisma.monitoringResult.findFirst({ where: { websiteId }, orderBy: { checkedAt: 'desc' }, select: { checkedAt: true } })
      ]);

      //
      // Fetch incident counts where startTime falls within the period
      //
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
          incidentCount: totalIncidentCount,
          downIncidentCount: downIncidentCount,
          slowIncidentCount: slowIncidentCount,
      };
  }

  /**
   * Calculates overall stats for all websites or only those monitored by a user.
   * Returns the SHARED OverallStats type.
   * Uses Incident table for incident-related stats (last 24h count, most recent).
   */
  static async getOverallStats( userId?: number, period: TimeframeKey | string | number = 'week' ): Promise<OverallStats> {
      const days = this.periodToDays(period);
      //
      // Start date for calculating uptime/avg response time over the selected period
      //
      const periodStartDate = sub(new Date(), { days });
      //
      // Separate date for counting incidents in the last 24 hours specifically
      //
      const twentyFourHoursAgo = sub(new Date(), { hours: 24 });

      //
      // Base filter for websites (all or user-specific)
      //
      const websiteWhere: Prisma.WebsiteWhereInput = userId ? { websiteUsers: { some: { userId } } } : {};

      const [totalWebsites, activeWebsitesCount] = await Promise.all([
          prisma.website.count({ where: websiteWhere }),
          prisma.website.count({ where: { ...websiteWhere, isActive: true } })
      ]);

      //
      // Get IDs of active websites relevant to the query
      //
      const activeWebsitesList = await prisma.website.findMany({
          where: { ...websiteWhere, isActive: true },
          select: { id: true }
      });
      const activeWebsiteIds = activeWebsitesList.map(w => w.id);

      // --- Calculate Overall Uptime/Response Time (using the selected period) ---
      const websiteStatsPromises = activeWebsiteIds.map(websiteId =>
          //
          // Get individual website stats over the specified period
          //
          this.getWebsiteStats(websiteId, userId, period)
      );
      const websiteStats = await Promise.all(websiteStatsPromises);

      //
      // Calculate overall uptime average (only for sites with checks in the period)
      //
      const validUptimeStats = websiteStats.filter(stat => stat.totalChecks > 0);
      const overallUptime = validUptimeStats.length > 0
          ? validUptimeStats.reduce((sum, stat) => sum + stat.uptime, 0) / validUptimeStats.length
          : 100; // Default to 100% if no data

      //
      // Calculate overall response time average (only for sites with valid avg times)
      //
      const validResponseStats = websiteStats.filter(stat => stat.averageResponseTime !== null);
      const overallResponseTime = validResponseStats.length > 0
          ? Math.round(validResponseStats.reduce((sum, stat) => sum + stat.averageResponseTime!, 0) / validResponseStats.length)
          : null; // Null if no valid data

      // --- Calculate Incidents Data (using Incident table) ---
      let incidentsLast24h = 0;
      let lastIncident: PrismaIncident | null = null;

      if (activeWebsiteIds.length > 0) {
          //
          // Count incidents started in the last 24 hours for the relevant websites
          //
          incidentsLast24h = await IncidentService.countIncidents({
              from: twentyFourHoursAgo, // Use 24-hour mark specifically for this count
              //
              // Filter by user's websites if userId is provided
              //
              ...(userId && { userId: userId }),
          });

          //
          // Find the most recent incident overall (or for the user) regardless of timeframe
          //
          lastIncident = await IncidentService.getMostRecentIncident(userId);
      }

      // --- Return OverallStats Object ---
      return {
          totalWebsites,
          activeWebsites: activeWebsitesCount,
          //
          // Individual stats calculated over the 'period'
          //
          websiteStats,
          overallUptime: parseFloat(overallUptime.toFixed(2)),
          overallResponseTime,
          //
          // Count from Incident table (specifically last 24h)
          //
          incidentsLast24h,
          lastIncidentTimestamp: lastIncident ? lastIncident.startTime.toISOString() : null,
          lastIncidentWebsiteId: lastIncident ? lastIncident.websiteId : null,
      };
  }

  /**
   * Convenience method to get stats specifically for a user's dashboard.
   */
  static async getUserDashboardStats( userId: number, period: TimeframeKey | string | number = 'week' ): Promise<OverallStats> {
      return this.getOverallStats(userId, period);
  }

  /**
   * Generates aggregated chart data points for a website over a specific timeframe.
   */
  static async getChartDataForWebsite( websiteId: number, timeframe: TimeframeKey ): Promise<ChartDataPoint[]> {
      const endDate = new Date();
      let chartData: ChartDataPoint[] = [];
      let startDate: Date;
      let intervalStart: Date, intervalEnd: Date;

      //
      // Helper to calculate stats for a group of results within a time interval
      //
      const calculatePeriodStats = (resultsInPeriod: PrismaMonitoringResult[]): { avgResponseTime: number | null, uptimeRatio: number, checkCount: number } => {
          const totalChecks = resultsInPeriod.length;
          if (totalChecks === 0) return { avgResponseTime: null, uptimeRatio: 1.0, checkCount: 0 }; // Default to 100% uptime if no checks

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
              //
              // For 'hour', return individual results (up to a limit)
              //
              startDate = subHours(endDate, 1);
              const hourResults = await prisma.monitoringResult.findMany({
                  where: { websiteId, checkedAt: { gte: startDate, lte: endDate } },
                  orderBy: { checkedAt: 'asc' },
                  take: 200 // Limit raw results for performance
              });
              chartData = hourResults.map(r => ({
                  label: format(new Date(r.checkedAt), 'HH:mm'),
                  timestamp: getUnixTime(new Date(r.checkedAt)),
                  avgResponseTime: r.isAvailable ? r.responseTime : null, // Null RT if down
                  uptimeRatio: r.isAvailable ? 1.0 : 0.0, // 1 or 0 for individual checks
                  checkCount: 1
              }));
              break;

          case 'day':
              //
              // Aggregate results into 30-minute intervals for the last 24 hours
              //
              startDate = subDays(endDate, 1);
              intervalStart = startOfDay(startDate); // Start from beginning of yesterday for full day context
              intervalEnd = endOfDay(endDate); // End at end of today
              const dayResults = await prisma.monitoringResult.findMany({
                  where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } },
                  orderBy: { checkedAt: 'asc' }
              });

              const intervalMinutesDay = 30;
              const intervalsDay = new Map<number, PrismaMonitoringResult[]>();
              dayResults.forEach(r => {
                  // Group results by the start timestamp of their 30-min interval
                  const intervalTimestamp = Math.floor(getUnixTime(new Date(r.checkedAt)) / (intervalMinutesDay * 60)) * (intervalMinutesDay * 60);
                  if (!intervalsDay.has(intervalTimestamp)) intervalsDay.set(intervalTimestamp, []);
                  intervalsDay.get(intervalTimestamp)?.push(r);
              });

              chartData = Array.from(intervalsDay.entries()).map(([timestamp, results]) => {
                  const stats = calculatePeriodStats(results);
                  return {
                      label: format(new Date(timestamp * 1000), 'HH:mm'), // Label with interval start time
                      timestamp: timestamp,
                      ...stats
                  };
              });
              break;

          case 'week':
          case 'month':
              //
              // Aggregate results by day for the last week or month
              //
              startDate = (timeframe === 'week') ? subDays(endDate, 7) : subMonths(endDate, 1);
              intervalStart = startOfDay(startDate); // Align to start of the day
              intervalEnd = endOfDay(endDate); // Align to end of the day

              const daysInPeriod = eachDayOfInterval({ start: intervalStart, end: intervalEnd });

              const periodResultsWkMo = await prisma.monitoringResult.findMany({
                  where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } },
                  orderBy: { checkedAt: 'asc' }
              });

              //
              // Group results by day (YYYY-MM-DD)
              //
              const resultsByDay = new Map<string, PrismaMonitoringResult[]>();
              periodResultsWkMo.forEach(r => {
                  const dayKey = format(new Date(r.checkedAt), 'yyyy-MM-dd');
                  if (!resultsByDay.has(dayKey)) resultsByDay.set(dayKey, []);
                  resultsByDay.get(dayKey)?.push(r);
              });

              //
              // Create a data point for each day in the interval
              //
              chartData = daysInPeriod.map((day): ChartDataPoint => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const dayStart = startOfDay(day); // Timestamp represents start of the day
                  const results = resultsByDay.get(dayKey) || []; // Get results for this day
                  const stats = calculatePeriodStats(results);
                  return {
                      label: format(dayStart, 'MMM d'), // Label like 'Jan 15'
                      timestamp: getUnixTime(dayStart),
                      ...stats
                  };
              });
              break;

          case 'year':
              //
              // Aggregate results by month for the last year
              //
              startDate = subYears(endDate, 1);
              intervalStart = startOfMonth(startDate); // Align to start of the month
              intervalEnd = endOfDay(endDate); // Align to end of today

              const monthsInPeriod = eachMonthOfInterval({ start: intervalStart, end: intervalEnd });

              const yearResults = await prisma.monitoringResult.findMany({
                  where: { websiteId, checkedAt: { gte: intervalStart, lte: intervalEnd } },
                  orderBy: { checkedAt: 'asc' }
              });

              //
              // Group results by month (YYYY-MM)
              //
              const resultsByMonth = new Map<string, PrismaMonitoringResult[]>();
              yearResults.forEach(r => {
                  const monthKey = format(new Date(r.checkedAt), 'yyyy-MM');
                  if (!resultsByMonth.has(monthKey)) resultsByMonth.set(monthKey, []);
                  resultsByMonth.get(monthKey)?.push(r);
              });

              //
              // Create a data point for each month in the interval
              //
              chartData = monthsInPeriod.map((monthDate): ChartDataPoint => {
                  const monthKey = format(monthDate, 'yyyy-MM');
                  const monthStart = startOfMonth(monthDate); // Timestamp represents start of the month
                  const results = resultsByMonth.get(monthKey) || []; // Get results for this month
                  const stats = calculatePeriodStats(results);
                  return {
                      label: format(monthStart, 'MMM yyyy'), // Label like 'Jan 2023'
                      timestamp: getUnixTime(monthStart),
                      ...stats
                  };
              });
              break;

          default:
              console.warn(`[StatsCalculator] Unsupported timeframe for chart data: ${timeframe}. Defaulting to 'week'.`);
              //
              // Fallback to 'week' if timeframe is invalid
              //
              return this.getChartDataForWebsite(websiteId, 'week');
      }

      //
      // Ensure data is sorted by timestamp before returning
      //
      chartData.sort((a, b) => a.timestamp - b.timestamp);
      return chartData;
  }
} // End StatsCalculator Class

```

**6. Update `server/src/services/alertService.ts`**

Import and use the config value for recheck delay.

```typescript
// server/src/services/alertService.ts
import {
  Website as PrismaWebsite,
  Alert as PrismaAlert,
  WebsiteUser as PrismaWebsiteUser,
  MonitoringResult as PrismaMonitoringResult,
  Prisma,
  Incident as PrismaIncident,
} from '@prisma/client';
//
// Import config
//
import { monitoringConfig } from '../config/config';
import prisma from '../prisma/prismaClient';
import { subHours, differenceInSeconds } from 'date-fns';
import { AlertQueryOptions, AlertType, AlertStats, VALID_ALERT_TYPES, MonitoringResponse, IncidentType } from '../types';
import { WebsiteMonitor, ResultsManager } from './monitoringService';
import * as IncidentService from './incidentService';
import { sendMail } from './mailService';

//
// Use constant from config
//
const RECHECK_DELAY_SECONDS = monitoringConfig.recheckDelaySeconds;

// --- Central Result Processing Logic ---

/**
 * Handles processing of a new monitoring result: checks for recoveries,
 * potential new incidents, and schedules confirmation checks.
 */
export async function handleResultProcessing( website: PrismaWebsite, result: PrismaMonitoringResult ): Promise<void> {
  const logPrefix = `[ResultProc W:${website.id} R:${result.id}]`;
  console.log(`${logPrefix} Processing result. Available: ${result.isAvailable}, RT: ${result.responseTime}ms`);
  let recoveryProcessed = false;

  // --- Check for Recovery FIRST ---

  //
  // Check DOWN recovery
  //
  const openDownIncident = await IncidentService.getOpenIncident(website.id, 'down');
  if (openDownIncident && result.isAvailable) {
      console.log(`${logPrefix} Recovery detected for DOWN incident (ID: ${openDownIncident.id}).`);
      await IncidentService.resolveIncident(openDownIncident.id, result.checkedAt, result.id);
      //
      // Dismiss alerts for ALL users monitoring this site for this type upon recovery
      //
      await dismissAlertsByType(website.id, 'down');
      recoveryProcessed = true; // Mark recovery as processed
  }

  //
  // Check SLOW recovery
  //
  const openSlowIncident = await IncidentService.getOpenIncident(website.id, 'slow');
  if (openSlowIncident) {
      //
      // Determine the *lowest* alertThreshold among users who *could* be alerted for slowness on this site.
      // This ensures recovery is detected based on the most sensitive threshold defined for the site.
      //
      const usersPotentiallyAlerted = await prisma.websiteUser.findMany({
          where: {
              websiteId: website.id,
              alertThreshold: { not: null, gt: 0 } // Consider users with a valid threshold set
          },
          select: { alertThreshold: true }
      });
      const relevantThresholds = usersPotentiallyAlerted
          .map(u => u.alertThreshold)
          .filter((t): t is number => t !== null); // Filter out nulls safely

      //
      // Lowest threshold among relevant users determines the recovery point
      //
      const recoveryThreshold = relevantThresholds.length > 0 ? Math.min(...relevantThresholds) : null;

      //
      // Check if the current result meets recovery criteria:
      // 1. Must be available.
      // 2. If a recovery threshold exists, response time must be at or below it.
      //
      const isRecoveredSlow = result.isAvailable && (
          recoveryThreshold === null || // Recovers if no threshold ever set
          (result.responseTime !== null && result.responseTime <= recoveryThreshold)
      );

      if (isRecoveredSlow) {
          console.log(`${logPrefix} Recovery detected for SLOW incident (ID: ${openSlowIncident.id}). RT: ${result.responseTime}ms <= Lowest Threshold: ${recoveryThreshold ?? 'N/A'}`);
          await IncidentService.resolveIncident(openSlowIncident.id, result.checkedAt, result.id);
          //
          // Dismiss alerts for ALL users monitoring this site for this type upon recovery
          //
          await dismissAlertsByType(website.id, 'slow');
          recoveryProcessed = true; // Mark recovery as processed
      }
  }

  // --- Check for Potential New Incidents (only if no recovery was just processed) ---
  if (recoveryProcessed) {
      console.log(`${logPrefix} Skipping new incident check as recovery was just processed.`);
      return; // Exit early if recovery handled
  }

  let potentialType: IncidentType | null = null;
  let thresholdForSlow: number | null = null; // Store the threshold that was exceeded if slow

  //
  // Check for DOWN condition
  //
  if (!result.isAvailable) {
      //
      // Check if a 'down' incident is already open for this site
      //
      const isDownIncidentOpen = !!(await IncidentService.getOpenIncident(website.id, 'down'));
      if (!isDownIncidentOpen) {
          potentialType = 'down';
          console.log(`${logPrefix} Potential DOWN incident detected (Result unavailable, no open 'down' incident).`);
      } else {
          console.log(`${logPrefix} Result unavailable, but DOWN incident already open. No action needed.`);
      }
  }
  //
  // Check for SLOW condition (only if available and has response time)
  //
  else if (result.responseTime !== null) {
      //
      // Check if a 'slow' incident is already open for this site
      //
      const isSlowIncidentOpen = !!(await IncidentService.getOpenIncident(website.id, 'slow'));
      if (!isSlowIncidentOpen) {
          //
          // Find the lowest threshold exceeded among *any* user monitoring this site,
          // regardless of whether their individual alerts are enabled. The incident affects the site globally.
          //
          const allUserThresholds = await prisma.websiteUser.findMany({
              where: {
                  websiteId: website.id,
                  alertThreshold: { not: null, gt: 0 } // Consider only valid, positive thresholds
              },
              select: { alertThreshold: true }
          });
          const relevantThresholds = allUserThresholds
              .map(u => u.alertThreshold)
              .filter((t): t is number => t !== null); // Filter nulls safely

          let lowestExceededThreshold: number | null = null;
          for (const threshold of relevantThresholds) {
              //
              // Check if the current result's response time exceeds this user's threshold
              //
              if (result.responseTime > threshold) {
                  //
                  // If it's the first exceeded threshold or lower than the current lowest, update
                  //
                  if (lowestExceededThreshold === null || threshold < lowestExceededThreshold) {
                      lowestExceededThreshold = threshold;
                  }
              }
          }

          //
          // If at least one threshold was exceeded, mark as potential 'slow' incident
          //
          if (lowestExceededThreshold !== null) {
              potentialType = 'slow';
              thresholdForSlow = lowestExceededThreshold; // Store the specific threshold that triggered this potential incident
              console.log(`${logPrefix} Potential SLOW incident detected (RT: ${result.responseTime}ms > Lowest Exceeded Threshold: ${thresholdForSlow}ms, no open 'slow' incident).`);
          }
      } else {
           console.log(`${logPrefix} Result is slow (RT: ${result.responseTime}ms), but SLOW incident already open. No action needed.`);
      }
  }

  //
  // If a potential incident was detected, schedule the confirmation check
  //
  if (potentialType) {
      await scheduleIncidentConfirmationCheck(website.id, result, potentialType, thresholdForSlow);
  } else {
       console.log(`${logPrefix} No new potential incident detected.`);
  }
}

/**
 * Schedules a delayed check to confirm if a potential incident condition persists.
 */
async function scheduleIncidentConfirmationCheck(
  websiteId: number,
  initialResult: PrismaMonitoringResult,
  potentialType: IncidentType,
  thresholdForSlow: number | null // Pass the threshold if it's a slow check
): Promise<void> {
  //
  // Use delay from config
  //
  const delayMs = RECHECK_DELAY_SECONDS * 1000;
  const logPrefix = `[IncidentConfirmSched W:${websiteId} T:${potentialType}]`;
  console.log(`${logPrefix} Scheduling confirmation check in ${RECHECK_DELAY_SECONDS}s. Initial Result ID: ${initialResult.id}`);

  setTimeout(async () => {
    console.log(`${logPrefix} Executing delayed ${potentialType} confirmation check.`);
    try {
      //
      // Fetch the website again in case its status changed (e.g., deactivated)
      //
      const website = await prisma.website.findUnique({ where: { id: websiteId } });
      if (!website || !website.isActive) {
        console.log(`${logPrefix} Confirmation check cancelled (website not found or inactive).`);
        return;
      }

      //
      // Fetch the initial result again in case it was deleted (unlikely but possible)
      //
      const freshInitialResult = await prisma.monitoringResult.findUnique({ where: { id: initialResult.id } });
      if (!freshInitialResult) {
        console.log(`${logPrefix} Confirmation check cancelled (initial result ${initialResult.id} missing).`);
        return;
      }

      //
      // Proceed with the confirmation check using fresh data
      //
      await handleIncidentConfirmation(website, freshInitialResult, potentialType, thresholdForSlow);

    } catch (error) {
      console.error(`${logPrefix} Error during delayed confirmation check execution:`, error);
    }
  }, delayMs);
}

/**
 * Performs the confirmation check after the delay and handles incident creation and user alerting.
 */
async function handleIncidentConfirmation(
  website: PrismaWebsite,
  initialResult: PrismaMonitoringResult, // The result that first indicated a potential issue
  potentialType: IncidentType,
  thresholdForSlow: number | null // The specific threshold that triggered the initial 'slow' check
): Promise<void> {
  const logPrefix = `[IncidentConfirm W:${website.id} T:${potentialType}]`;
  console.log(`${logPrefix} Performing confirmation check.`);

  //
  // Re-check if the incident is already open (could have been created by another process/race condition)
  //
  const existingOpenIncident = await IncidentService.getOpenIncident(website.id, potentialType);
  if (existingOpenIncident) {
    console.log(`${logPrefix} Confirmation check skipped: An incident (ID: ${existingOpenIncident.id}) of type '${potentialType}' was already opened.`);
    return;
  }

  //
  // Perform the actual confirmation check
  //
  const confirmationCheckData: MonitoringResponse = await WebsiteMonitor.performWebsiteCheck(website.url);
  let confirmingResultDb: PrismaMonitoringResult;

  try {
    //
    // Save the result of the confirmation check
    //
    confirmingResultDb = await ResultsManager.saveResult(website.id, confirmationCheckData);
    console.log(`${logPrefix} Confirmation check result saved (ID: ${confirmingResultDb.id}). Avail=${confirmingResultDb.isAvailable}, RT=${confirmingResultDb.responseTime}ms`);
  } catch (saveError) {
    console.error(`${logPrefix} CRITICAL: Failed to save confirmation check result:`, saveError);
    // Cannot proceed without saving the confirmation result
    return;
  }

  let issueConfirmed = false;
  let confirmedType: IncidentType | null = null;

  //
  // --- Determine if the issue is confirmed ---
  //
  // Confirm DOWN: Still unavailable in the confirmation check
  //
  if (potentialType === 'down' && !confirmingResultDb.isAvailable) {
    issueConfirmed = true;
    confirmedType = 'down';
    console.log(`${logPrefix} CONFIRMED DOWN.`);
  }
  //
  // Confirm SLOW: Still available AND response time is still above the *original* threshold that triggered the check
  //
  else if (
    potentialType === 'slow' &&
    confirmingResultDb.isAvailable && // Must be available
    thresholdForSlow !== null && // Must have had an initial threshold
    confirmingResultDb.responseTime !== null && // Must have a response time in confirmation
    confirmingResultDb.responseTime > thresholdForSlow // Must exceed the original trigger threshold
  ) {
    issueConfirmed = true;
    confirmedType = 'slow';
    console.log(`${logPrefix} CONFIRMED SLOW (RT: ${confirmingResultDb.responseTime}ms > Original Threshold: ${thresholdForSlow}ms).`);
  }
  //
  // If neither condition is met, the issue is not confirmed
  //
  else {
    console.log(`${logPrefix} ${potentialType.toUpperCase()} condition NOT confirmed by check. Check Result -> Avail: ${confirmingResultDb.isAvailable}, RT: ${confirmingResultDb.responseTime}ms. Original Threshold (if slow): ${thresholdForSlow ?? 'N/A'}`);
  }

  // --- Create Incident if Confirmed (Independent of Alerting Users) ---
  if (issueConfirmed && confirmedType) {
    const newIncident = await IncidentService.createIncident(
      website.id,
      confirmedType,
      confirmingResultDb.checkedAt, // Incident starts at the time of confirmation
      initialResult.id, // Link to the initial result that triggered the check
      confirmingResultDb.id // Link to the result that confirmed the incident
    );

    if (!newIncident) {
      // Incident creation failed (logged within createIncident), cannot proceed with alerts
      console.error(`${logPrefix} Failed to create incident record. Aborting alert generation.`);
      return;
    }

    console.log(`${logPrefix} Incident ${newIncident.id} created/confirmed. Checking users for alerts.`);

    // --- Find users who have ALERTS ENABLED for this specific incident type ---

    // Base criteria: User monitors this website and has alerts enabled globally for it
    const baseWhereClause: Prisma.WebsiteUserWhereInput = {
        websiteId: website.id,
        alertEnabled: true,
    };

    // Specific criteria for SLOW alerts
    if (confirmedType === 'slow') {
        // A slow alert requires the confirming result to have a valid response time
        if (confirmingResultDb.responseTime !== null) {
            // User must have a threshold set, AND that threshold must be less than or equal to the measured response time
            baseWhereClause.alertThreshold = {
                not: null, // Threshold must be set
                lte: confirmingResultDb.responseTime // Threshold must be met/exceeded by the measured time
            };
        } else {
            // If the confirming result for a SLOW incident has no response time, no threshold-based alert can be sent.
            console.log(`${logPrefix} Confirmed SLOW incident ${newIncident.id} but confirmation check had null responseTime. No threshold-based alerts will be sent.`);
            // Set an impossible condition to ensure no users are matched for slow alerts in this case
            baseWhereClause.id = -1;
        }
    }
    // For 'down' alerts, no additional threshold check is needed, baseWhereClause is sufficient.

    const usersToAlert = await prisma.websiteUser.findMany({
        where: baseWhereClause, // Use the dynamically constructed where clause
        // Select all fields needed by createAlertAndNotify
        select: {
             id: true,
             userId: true,
             websiteId: true,
             name: true,
             interval: true,
             alertThreshold: true,
             alertEnabled: true,
             notifyEmail: true,
             createdAt: true,
             isPinned: true
         }
    });

    if (usersToAlert.length === 0) {
        console.log(`${logPrefix} No users found requiring an alert for this confirmed ${confirmedType} incident ${newIncident.id}.`);
        return;
    }

    console.log(`${logPrefix} Found ${usersToAlert.length} users to notify for incident ${newIncident.id}.`);

    //
    // Create alert record and send notification for each relevant user
    //
    for (const user of usersToAlert) {
        // Pass the confirmingResult for alert message details
        await createAlertAndNotify(website, user, newIncident, confirmingResultDb);
    }
  }
}

/**
 * Creates an Alert record and sends an email notification for a confirmed incident.
 */
async function createAlertAndNotify(
  website: PrismaWebsite,
  websiteUser: PrismaWebsiteUser,
  incident: PrismaIncident, // The confirmed incident
  confirmingResult: PrismaMonitoringResult // The result that confirmed the incident
): Promise<void> {
  const logPrefix = `[AlertNotify U:${websiteUser.userId} W:${website.id} I:${incident.id}]`;
  //
  // Alert type matches the incident type
  //
  const alertType = incident.type as AlertType;

  //
  // Check if an alert for this specific incident/user/type already exists (prevent duplicates)
  //
  const existingAlert = await prisma.alert.findFirst({
    where: {
      userId: websiteUser.userId,
      websiteId: website.id,
      type: alertType,
      incidentId: incident.id // Crucial: Check against the specific incident ID
    },
    select: { id: true }
  });

  if (existingAlert) {
    console.log(`${logPrefix} Skipped ${alertType.toUpperCase()} alert creation (Alert ID: ${existingAlert.id} already exists for Incident ${incident.id}).`);
    return; // Don't create or notify again for this incident
  }

  //
  // Construct the alert message based on the type and confirming result
  //
  let message = '';
  const websiteDisplayName = websiteUser.name || website.url; // Use custom name or URL

  if (alertType === 'down') {
    message = `Website is down: ${websiteDisplayName}`;
    if (confirmingResult.statusCode) message += ` (Status: ${confirmingResult.statusCode})`;
    if (confirmingResult.errorMessage) message += ` - Error: ${confirmingResult.errorMessage}`;
    message += ` (Incident ID: ${incident.id})`;
  } else if (alertType === 'slow') {
    const responseTimeMsg = confirmingResult.responseTime !== null ? `${confirmingResult.responseTime}ms` : 'N/A';
    message = `Website is responding slowly: ${websiteDisplayName} (${responseTimeMsg} > ${websiteUser.alertThreshold ?? 'N/A'}ms) (Incident ID: ${incident.id})`;
  }

  let newAlert: PrismaAlert | null = null;
  try {
    //
    // Create the actual Alert record in the database
    //
    newAlert = await prisma.alert.create({
      data: {
        userId: websiteUser.userId,
        websiteId: website.id,
        type: alertType,
        message: message,
        incidentId: incident.id // Associate Alert with the specific Incident
      }
    });
    console.log(`${logPrefix} Created ${alertType.toUpperCase()} Alert ID: ${newAlert.id} linked to Incident ID: ${incident.id}.`);
  } catch (error) {
    // Handle potential race conditions if two processes try to create the alert simultaneously
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      console.warn(`${logPrefix} Alert creation race condition likely occurred for ${alertType} alert for Incident ${incident.id}. Skipping notification.`);
      return; // Don't proceed to notify if alert wasn't created by this process
    } else {
      // Log other errors during alert creation
      console.error(`${logPrefix} Error creating ${alertType.toUpperCase()} alert for Incident ${incident.id}:`, error);
      return; // Don't notify if alert creation failed
    }
  }

  // --- Send Email Notification ---
  //
  // Proceed only if the alert was successfully created by this process AND the user has an email configured
  //
  if (newAlert && websiteUser.notifyEmail) {
    let emailSubject = '';
    let emailBody = '';

    //
    // Use confirmingResult details for the email content
    //
    if (alertType === 'down') {
      emailSubject = `🔴 CONFIRMED DOWN: ${websiteDisplayName}`;
      emailBody = `<p>Your monitored website <strong>${websiteDisplayName}</strong> is confirmed to be down.</p>` +
                  `<p>Status Code: ${confirmingResult.statusCode ?? 'N/A'}<br>` +
                  `Error Message: ${confirmingResult.errorMessage ?? 'No specific error reported'}<br>` +
                  `Time Confirmed: ${incident.startTime.toLocaleString()}</p>` + // Use incident start time (confirmation time)
                  `<p>Incident ID: ${incident.id}</p>` +
                  `<p>Alert ID: ${newAlert.id}</p>` +
                  `<p>Please check the dashboard for details and recovery status.</p>`;
    } else { // 'slow'
      // Handle potential null responseTime in email body
      const responseTimeBody = confirmingResult.responseTime !== null ? `${confirmingResult.responseTime}ms` : 'N/A';
      emailSubject = `🟠 CONFIRMED SLOW: ${websiteDisplayName}`;
      emailBody = `<p>Your monitored website <strong>${websiteDisplayName}</strong> is confirmed to be responding slowly.</p>` +
                  `<p>Response Time: ${responseTimeBody} (Your Threshold: ${websiteUser.alertThreshold ?? 'N/A'}ms)<br>` +
                  `Time Confirmed: ${incident.startTime.toLocaleString()}</p>` + // Use incident start time (confirmation time)
                  `<p>Incident ID: ${incident.id}</p>` +
                  `<p>Alert ID: ${newAlert.id}</p>` +
                  `<p>Please check the dashboard for details and recovery status.</p>`;
    }

    try {
      console.log(`${logPrefix} Attempting to send ${alertType} email alert to ${websiteUser.notifyEmail}`);
      await sendMail({ to: websiteUser.notifyEmail, subject: emailSubject, html: emailBody });
      console.log(`${logPrefix} Successfully sent ${alertType} email alert.`);
    } catch (emailError) {
      console.error(`${logPrefix} Failed to send ${alertType} email notification for Alert ID ${newAlert.id}:`, emailError);
      // Consider adding retry logic or marking the alert for later notification attempt
    }
  } else if (newAlert && !websiteUser.notifyEmail) {
    // Log if email wasn't sent due to missing user email config
    console.log(`${logPrefix} Skipped email notification for Alert ID ${newAlert.id} (User has no notification email).`);
  }
}


/**
 * Dismisses (deletes) all active alerts of a specific type for a given website.
 * Typically called upon incident recovery.
 */
async function dismissAlertsByType(websiteId: number, type: AlertType): Promise<void> {
  const logPrefix = `[AlertDismiss W:${websiteId} T:${type}]`;
  try {
    //
    // Delete alerts based on website and type, regardless of the specific incident ID,
    // as recovery resolves the underlying condition for that type.
    //
    const deleteResult = await prisma.alert.deleteMany({
      where: {
        websiteId: websiteId,
        type: type
        // No incidentId filter here - dismiss all active alerts of this type for the site
      }
    });

    if (deleteResult.count > 0) {
      console.log(`${logPrefix} Dismissed ${deleteResult.count} active '${type}' alerts upon recovery.`);
    }
  } catch (error) {
    console.error(`${logPrefix} Error dismissing alerts upon recovery:`, error);
  }
}

// --- Alert Querying Functions ---

/**
 * Retrieves alerts for a specific user, with optional filtering.
 * Includes website details (URL and user-specific name) and related incident info.
 */
export async function getAlertsForUser( userId: number, options: AlertQueryOptions = {} ): Promise<PrismaAlert[]> {
  const { limit = 50, type, from, to, websiteId } = options;

  const whereClause: Prisma.AlertWhereInput = { userId };
  if (type && VALID_ALERT_TYPES.includes(type)) whereClause.type = type;
  if (from || to) {
    whereClause.createdAt = {};
    if (from) whereClause.createdAt.gte = from;
    if (to) whereClause.createdAt.lte = to;
  }
  if (websiteId !== undefined) whereClause.websiteId = websiteId;

  return prisma.alert.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      website: {
        select: {
          id: true,
          url: true,
          //
          // Include WebsiteUsers relation filtered to this user to get the custom name
          //
          websiteUsers: {
            where: { userId },
            select: { name: true }
          }
        }
      },
      //
      // Include associated incident details
      //
      incident: {
        select: { id: true, startTime: true, endTime: true }
      }
    }
  });
}

/**
 * Retrieves alerts for a specific website, with optional filtering.
 * Includes website URL, user details (ID, name, email), and related incident info.
 */
export async function getAlertsByWebsite( websiteId: number, options: AlertQueryOptions = {} ): Promise<PrismaAlert[]> {
  const { limit = 50, type, from, to } = options;

  const whereClause: Prisma.AlertWhereInput = { websiteId };
  if (type && VALID_ALERT_TYPES.includes(type)) whereClause.type = type;
  if (from || to) {
    whereClause.createdAt = {};
    if (from) whereClause.createdAt.gte = from;
    if (to) whereClause.createdAt.lte = to;
  }

  return prisma.alert.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      website: { select: { id: true, url: true } }, // Basic website info
      user: { select: { id: true, name: true, email: true } }, // User who received the alert
      incident: { select: { id: true, startTime: true, endTime: true } } // Associated incident details
    }
  });
}

/**
 * Dismisses (deletes) a specific alert if the user owns it.
 */
export async function dismissAlert( userId: number, alertId: number ): Promise<PrismaAlert | null> {
  const logPrefix = `[Alert Dismiss U:${userId} A:${alertId}]`;
  console.log(`${logPrefix} Attempting to dismiss alert.`);

  //
  // First, verify the alert exists and belongs to the requesting user
  //
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    select: { userId: true } // Only need userId for verification
  });

  if (!alert) {
    console.log(`${logPrefix} Alert not found.`);
    return null; // Or throw a NotFound error
  }

  if (alert.userId !== userId) {
    console.warn(`${logPrefix} User does not own this alert. Dismissal denied.`);
    // Throw a Forbidden error - important for security
    throw new Error('Forbidden: User does not own this alert');
  }

  //
  // If verification passes, proceed with deletion
  //
  try {
    const deletedAlert = await prisma.alert.delete({
      where: { id: alertId }
    });
    console.log(`${logPrefix} Alert successfully dismissed.`);
    return deletedAlert;
  } catch (error) {
    // Handle case where the alert might have been deleted between the check and the delete operation
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      console.log(`${logPrefix} Alert was already deleted.`);
      return null; // Return null indicating it's gone
    }
    // Log and re-throw other errors
    console.error(`${logPrefix} Error dismissing alert:`, error);
    throw error;
  }
}

/**
 * Calculates statistics about alerts for a specific user over a given period (default 7 days).
 */
export async function getUserAlertStats(userId: number, days = 7): Promise<AlertStats> {
  const startDate = subHours(new Date(), days * 24);

  const alerts = await prisma.alert.findMany({
    where: {
      userId: userId,
      createdAt: { gte: startDate } // Filter by creation date within the period
    },
    select: {
      type: true,
      websiteId: true,
      incidentId: true, // Include incidentId for potential future analysis
      website: {
        select: {
          url: true,
          //
          // Include WebsiteUsers relation filtered to this user to get the custom name
          //
          websiteUsers: {
            where: { userId },
            select: { name: true }
          }
        }
      }
    }
  });

  const totalAlerts = alerts.length;
  const byType: Partial<Record<AlertType, number>> = {};
  //
  // Use a Map to aggregate counts by website, handling custom names
  //
  const websiteMap = new Map<number, { websiteId: number, websiteName: string, count: number }>();

  alerts.forEach(alert => {
    //
    // Count alerts by type
    //
    const alertType = alert.type as AlertType;
    byType[alertType] = (byType[alertType] || 0) + 1;

    //
    // Count alerts by website, using custom name if available
    //
    const customName = alert.website?.websiteUsers?.[0]?.name; // Get name from the filtered relation
    const websiteName = customName || alert.website?.url || `Website ${alert.websiteId}`; // Fallback logic for name

    if (!websiteMap.has(alert.websiteId)) {
      websiteMap.set(alert.websiteId, { websiteId: alert.websiteId, websiteName: websiteName, count: 0 });
    }
    //
    // Increment count for this website
    //
    websiteMap.get(alert.websiteId)!.count++;
  });

  //
  // Convert map values to an array and sort by count descending
  //
  const byWebsite = Array.from(websiteMap.values()).sort((a, b) => b.count - a.count);

  return { totalAlerts, byType, byWebsite };
}
```

**7. Update `server/src/services/incidentService.ts` (No changes needed for config, but added logging)**

While no config values were directly used here, I've added logging similar to other services for consistency, which helps in debugging.

```typescript
// server/src/services/incidentService.ts
import {
  PrismaClient,
  Incident as PrismaIncident,
  MonitoringResult as PrismaMonitoringResult,
  Website as PrismaWebsite,
  Prisma,
  } from '@prisma/client';
  import prisma from '../prisma/prismaClient';
  import { subHours, differenceInSeconds } from 'date-fns';
  import {
  Incident,
  IncidentType,
  IncidentQueryOptions,
  VALID_INCIDENT_TYPES,
  MonitoringResult,
  WebsiteUser,
  } from '../types'; // Adjust path if necessary

  // Helper Type Definition for Included Relation
  type IncidentWithIncludedWebsite = PrismaIncident & {
  website?: {
      url: string;
      // Include potential user-specific names if needed
      websiteUsers?: {
          name: string | null;
          userId: number;
      }[];
  } | null;
  };

  // Helper: Map Prisma Incident to Shared Type
  const mapPrismaIncidentToShared = (
  incident: IncidentWithIncludedWebsite | null,
  userId?: number // Optional: User requesting the data, for name mapping
  ): Incident | null => {
  if (!incident) return null;

  let websiteName: string | null | undefined = incident.website?.url; // Default to URL

  // Attempt to find user-specific name if userId is provided and relations exist
  if (userId && incident.website?.websiteUsers && incident.website.websiteUsers.length > 0) {
      // Find the specific WebsiteUser relation for the requesting user
      const userWebsite = incident.website.websiteUsers.find(wu => wu.userId === userId);
      // If found and has a name, use it
      if (userWebsite?.name) {
          websiteName = userWebsite.name;
      }
  }

  return {
      id: incident.id,
      websiteId: incident.websiteId,
      type: incident.type as IncidentType, // Assume type is valid based on creation logic
      startTime: incident.startTime.toISOString(),
      endTime: incident.endTime?.toISOString() ?? null,
      durationSeconds: incident.durationSeconds,
      initialResultId: incident.initialResultId,
      confirmingResultId: incident.confirmingResultId,
      resolvingResultId: incident.resolvingResultId,
      // Include website details, using the potentially mapped name
      website: incident.website ? {
           id: incident.websiteId,
           url: incident.website.url,
           name: websiteName // Use the determined name
       } : undefined,
  };
  };

  // --- Incident Management Functions ---

  /**
   * Finds the currently open incident of a specific type for a website.
   */
  export async function getOpenIncident( websiteId: number, type: IncidentType ): Promise<PrismaIncident | null> {
  return prisma.incident.findFirst({
      where: {
          websiteId: websiteId,
          type: type,
          endTime: null // Key condition: incident is open
      },
      orderBy: { startTime: 'desc' } // Get the most recent open one if multiple somehow exist
  });
  }

  /**
   * Creates a new incident if one of the same type isn't already open.
   */
  export async function createIncident(
  websiteId: number,
  type: IncidentType,
  confirmedAt: Date, // The timestamp when the incident condition was confirmed
  initialResultId?: number, // Optional: Result that triggered the check
  confirmingResultId?: number // Optional: Result that confirmed the incident
  ): Promise<PrismaIncident | null> {
  const logPrefix = `[IncidentService W:${websiteId} T:${type}]`;
  console.log(`${logPrefix} Attempting to create/get incident. Confirmed At: ${confirmedAt.toISOString()}`);

  //
  // Check if an incident of this type is already open to prevent duplicates
  //
  const existingOpenIncident = await getOpenIncident(websiteId, type);
  if (existingOpenIncident) {
      console.log(`${logPrefix} Incident creation skipped: An open incident (ID: ${existingOpenIncident.id}) of type '${type}' already exists.`);
      return existingOpenIncident; // Return the existing open incident
  }

  try {
      //
      // Use the confirmedAt timestamp as the official start time of the incident
      //
      const incidentStartTime = confirmedAt;
      console.log(`${logPrefix} Creating new incident with startTime: ${incidentStartTime.toISOString()}. InitialResult: ${initialResultId ?? 'N/A'}, ConfirmingResult: ${confirmingResultId ?? 'N/A'}`);

      const newIncident = await prisma.incident.create({
          data: {
              websiteId: websiteId,
              type: type,
              startTime: incidentStartTime, // Save the exact start time
              endTime: null, // Initially unresolved
              durationSeconds: null, // Initially no duration
              initialResultId: initialResultId,
              confirmingResultId: confirmingResultId
          }
      });
      console.log(`${logPrefix} Successfully created Incident ID: ${newIncident.id}`);
      return newIncident;
  } catch (error) {
      console.error(`${logPrefix} Error creating incident:`, error);
      // Handle potential race condition where another process created the incident between the check and create
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          console.warn(`${logPrefix} Potential race condition (P2002) creating incident. Re-checking for open incident.`);
          return getOpenIncident(websiteId, type); // Try fetching again
      }
      throw error; // Re-throw other errors
  }
  }

  /**
   * Resolves an open incident by setting its end time and duration.
   */
  export async function resolveIncident(
  incidentId: number,
  resolvedAt: Date, // The timestamp when the recovery was detected
  resolvingResultId?: number // Optional: The result that indicated recovery
  ): Promise<PrismaIncident | null> {
  const logPrefix = `[IncidentService I:${incidentId}]`;
  try {
      //
      // Fetch the incident to ensure it exists and get its start time
      //
      const incident = await prisma.incident.findUnique({ where: { id: incidentId } });

      if (!incident) {
          console.warn(`${logPrefix} Resolve failed: Incident not found.`);
          return null;
      }
      //
      // Prevent resolving an already resolved incident
      //
      if (incident.endTime !== null) {
          console.log(`${logPrefix} Resolve skipped: Incident already resolved at ${incident.endTime.toISOString()}.`);
          return incident;
      }

      //
      // Calculate duration in seconds
      //
      const duration = differenceInSeconds(resolvedAt, incident.startTime);
      console.log(`${logPrefix} Resolving incident. Resolved At: ${resolvedAt.toISOString()}, ResolvingResult: ${resolvingResultId ?? 'N/A'}, Duration: ${duration}s`);

      const updatedIncident = await prisma.incident.update({
          where: { id: incidentId },
          data: {
              endTime: resolvedAt,
              durationSeconds: duration,
              resolvingResultId: resolvingResultId
          }
      });
      console.log(`${logPrefix} Successfully resolved incident.`);
      return updatedIncident;
  } catch (error) {
      console.error(`${logPrefix} Error resolving incident:`, error);
      // Handle case where incident was deleted between find and update
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          console.warn(`${logPrefix} Resolve failed: Incident not found during update attempt.`);
          return null;
      }
      throw error;
  }
  }

  // --- Incident Querying Functions ---

  /**
   * Retrieves incidents based on query options, mapping to shared type.
   * Includes user-specific website names if requestingUserId or options.userId is provided.
   */
  export async function getIncidents(
  options: IncidentQueryOptions = {},
  requestingUserId?: number // Optional: User ID from the authenticated request for name mapping
  ): Promise<Incident[]> {
  const logPrefix = `[IncidentService.getIncidents] User: ${requestingUserId ?? 'N/A'}`;
  const { limit = 50, type, from, to, userId, websiteId, status } = options;
  console.log(`${logPrefix} Received options:`, JSON.stringify(options));

  const whereClause: Prisma.IncidentWhereInput = {};

  //
  // Apply filters based on options
  //
  if (websiteId !== undefined) {
      whereClause.websiteId = websiteId;
  } else if (userId !== undefined) {
      // Filter incidents belonging to websites the specified user monitors
      whereClause.website = {
          websiteUsers: { some: { userId: userId } }
      };
  }
  // Note: If neither websiteId nor userId is provided, it fetches for all websites (admin use?)

  if (type && VALID_INCIDENT_TYPES.includes(type)) {
      whereClause.type = type;
  }

  if (from || to) {
      whereClause.startTime = {};
      if (from) whereClause.startTime.gte = from;
      // Filter incidents that *started* within the date range
      if (to) whereClause.startTime.lte = to;
  }

  if (status === 'open') {
      whereClause.endTime = null;
  } else if (status === 'closed') {
      whereClause.endTime = { not: null };
  }

  //
  // Determine if we need to fetch websiteUsers for name mapping
  // We need it if a specific userId was passed in options OR if a requestingUserId is available
  //
  const needsWebsiteUsers = !!(userId || requestingUserId);
  //
  // The specific user ID whose name we want to retrieve
  //
  const targetUserIdForName = userId ?? requestingUserId;

  console.log(`${logPrefix} Constructed Prisma Where Clause:`, JSON.stringify(whereClause));

  try {
      const incidentsPrisma = await prisma.incident.findMany({
          where: whereClause,
          orderBy: { startTime: 'desc' },
          take: limit,
          include: {
              //
              // Include website details, and user-specific names if needed
              //
              website: {
                  select: {
                      url: true,
                      //
                      // Conditionally include websiteUsers only if we need a specific user's name
                      //
                      ...(needsWebsiteUsers && targetUserIdForName && {
                          websiteUsers: {
                              // Filter websiteUsers to only the relevant user for name mapping
                              where: { userId: targetUserIdForName },
                              select: { name: true, userId: true }
                          }
                      })
                  }
              }
          }
      });

      console.log(`${logPrefix} Prisma findMany returned ${incidentsPrisma.length} raw records.`);

      //
      // Map Prisma results to the shared Incident type, passing the target user ID for name mapping
      //
      const mappedIncidents = incidentsPrisma
          // Cast is necessary because Prisma's generated type for include might not perfectly match IncidentWithIncludedWebsite yet
          .map(inc => mapPrismaIncidentToShared(inc as IncidentWithIncludedWebsite, targetUserIdForName))
          // Filter out any null results from mapping (shouldn't happen if inc is valid)
          .filter(inc => inc !== null) as Incident[];

      console.log(`${logPrefix} Returning ${mappedIncidents.length} mapped incidents.`);
      return mappedIncidents;

  } catch (error) {
      console.error(`${logPrefix} Error executing Prisma findMany:`, error);
      throw error; // Re-throw the error to be handled by the controller
  }
  }

  /**
   * Counts incidents based on query options.
   */
  export async function countIncidents(options: IncidentQueryOptions = {}): Promise<number> {
  const { type, from, to, userId, websiteId, status } = options;
  const whereClause: Prisma.IncidentWhereInput = {};

  // Apply filters similarly to getIncidents
  if (websiteId !== undefined) whereClause.websiteId = websiteId;
  else if (userId !== undefined) whereClause.website = { websiteUsers: { some: { userId } } };

  if (type && VALID_INCIDENT_TYPES.includes(type)) whereClause.type = type;

  if (from || to) {
      whereClause.startTime = {};
      if (from) whereClause.startTime.gte = from;
      if (to) whereClause.startTime.lte = to;
  }

  if (status === 'open') whereClause.endTime = null;
  else if (status === 'closed') whereClause.endTime = { not: null };

  return prisma.incident.count({ where: whereClause });
  }

  /**
   * Gets the most recent incident overall, or for a specific user.
   */
  export async function getMostRecentIncident(userId?: number): Promise<PrismaIncident | null> {
  const whereClause: Prisma.IncidentWhereInput = {};
  if (userId) {
      // Filter to incidents on websites the user monitors
      whereClause.website = { websiteUsers: { some: { userId } } };
  }

  return prisma.incident.findFirst({
      where: whereClause,
      orderBy: { startTime: 'desc' }, // Find the latest one
      // Select all necessary fields of the Incident model
      select: {
          id: true, websiteId: true, type: true, startTime: true, endTime: true,
          durationSeconds: true, initialResultId: true, confirmingResultId: true,
          resolvingResultId: true,
      }
  });
  }

  /**
   * Gets the current open incident (if any) for a specific website.
   * Maps to the shared Incident type, defaulting website name to URL.
   */
  export async function getCurrentOpenIncidentForWebsite(websiteId: number): Promise<Incident | null> {
  const openIncidentPrisma = await prisma.incident.findFirst({
      where: {
          websiteId: websiteId,
          endTime: null // Ensure it's open
      },
      orderBy: { startTime: 'desc' },
      include: {
          // Include basic website info needed for mapping
          website: { select: { url: true } }
      }
  });

  //
  // Use requestingUserId = undefined here, as this function is internal
  // and doesn't have user context. The name will default to the URL.
  //
  return mapPrismaIncidentToShared(openIncidentPrisma as IncidentWithIncludedWebsite);
  }

```

**Summary of Changes:**

1.  **`.env`:** Added new variables for scheduler patterns, minimum interval, user agent, etc. Ensured `MAIL_FROM` format is standard.
2.  **`src/config/config.ts`:**
    *   Moved `dotenv.config()` to the top.
    *   Added validation for all required environment variables at startup.
    *   Parsed and structured configuration into logical objects (`appConfig`, `dbConfig`, `mailConfig`, `monitoringConfig`, `schedulerConfig`, `securityConfig`).
    *   Correctly parsed boolean strings (`MAIL_SECURE`, `MAIL_TLS`) into booleans.
    *   Added validation for numeric config values.
    *   Exported the structured config objects.
3.  **`server/src/utils/scheduler.ts`:**
    *   Imported `monitoringConfig` and `schedulerConfig`.
    *   Replaced hardcoded cron patterns, concurrency, intervals, and results-to-keep limits with values from the config.
    *   Used `monitoringConfig.minimumIntervalSeconds` in `isWebsiteDueForCheck`.
4.  **`server/src/services/websiteService.ts`:**
    *   Imported `monitoringConfig`.
    *   Replaced hardcoded `DEFAULT_GLOBAL_INTERVAL` with `monitoringConfig.defaultIntervalSeconds` in `createWebsite` and `updateGlobalInterval`.
    *   Kept `CARD_TIMEFRAME` and `MAX_CARD_DATA_POINTS` as local constants as they seem UI-specific for now.
5.  **`server/src/services/monitoringService.ts`:**
    *   Imported `monitoringConfig`.
    *   Replaced hardcoded `TIMEOUT_MS` with `monitoringConfig.requestTimeoutMs`.
    *   Replaced hardcoded User-Agent string with `monitoringConfig.monitorUserAgent`.
    *   Updated timeout values in error messages to use the config value.
6.  **`server/src/services/alertService.ts`:**
    *   Imported `monitoringConfig`.
    *   Replaced the local `RECHECK_DELAY_SECONDS` constant with `monitoringConfig.recheckDelaySeconds`.
7.  **`server/src/services/incidentService.ts`:**
    *   No direct config changes, but added more consistent logging.

Remember to restart your Node.js application after making these changes for the `.env` and config updates to take effect.