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

/**
* Checks if a website has any associated users left. If not, sets it to inactive.
* Intended to be called after a user deletion or removal that might orphan a website.
* @param websiteId - The ID of the website to check.
*/
export async function checkAndDeactivateWebsiteIfOrphaned(websiteId: number): Promise<void> {
  const logPrefix = `[Orphan Check W:${websiteId}]`;
  try {
      const remainingUsersCount = await prisma.websiteUser.count({
          where: { websiteId: websiteId }
      });

      console.log(`${logPrefix} Found ${remainingUsersCount} remaining users.`);

      if (remainingUsersCount === 0) {
          // Check current status before updating unnecessarily
          const currentWebsite = await prisma.website.findUnique({
              where: { id: websiteId },
              select: { isActive: true }
          });

          // Only update if it's currently active
          if (currentWebsite?.isActive) {
              await prisma.website.update({
                  where: { id: websiteId },
                  data: { isActive: false }
              });
              console.log(`${logPrefix} Deactivated website as it has no more users.`);
          } else if (currentWebsite) {
               console.log(`${logPrefix} Website already inactive.`);
          } else {
              console.warn(`${logPrefix} Website not found during deactivation check.`);
          }
      }
  } catch (error) {
      // Log errors but don't let this fail the calling process (like user deletion)
      console.error(`${logPrefix} Error during orphan check/deactivation:`, error);
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