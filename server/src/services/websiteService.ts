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
import { monitoringConfig } from '../config/config';

// --- Import SHARED Types ---
// Assuming these types have been updated to reflect User.id as string
// Specifically, WebsiteUser should have userId: string
import {
  AddWebsiteUserDTO,
  Website,
  WebsiteUser, // Ensure this type has userId: string
  UpdateWebsiteUserDTO,
  SetPinStatusDTO,
  MonitoringResult as SharedMonitoringResult,
  ChartDataPoint,
  TimeframeKey,
  Incident,
} from '../types';

// --- Constants ---
const DEFAULT_GLOBAL_INTERVAL = monitoringConfig.defaultIntervalSeconds;
const CARD_TIMEFRAME: TimeframeKey = 'day';
const MAX_CARD_DATA_POINTS = 24;

// --- Mapping Helper Functions ---
// No changes needed in mapping functions unless they explicitly handle userId as number

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

const mapPrismaResultToSharedBasic = (prismaResult: PrismaMonitoringResult | null): SharedMonitoringResult | null => {
  if (!prismaResult) return null;
  // Assuming SharedMonitoringResult doesn't directly include detailed user info
  const coreData: Omit<SharedMonitoringResult, 'website'> = {
      id: prismaResult.id,
      websiteId: prismaResult.websiteId,
      checkedAt: prismaResult.checkedAt.toISOString(),
      responseTime: prismaResult.responseTime,
      isAvailable: prismaResult.isAvailable,
      statusCode: prismaResult.statusCode,
      errorMessage: prismaResult.errorMessage
  };
  // Cast needed if SharedMonitoringResult has mandatory fields not present in Omit
  return coreData as SharedMonitoringResult;
};

// Ensure the input 'websiteUser' object from Prisma has userId as string
const mapPrismaWebsiteUserToSharedBase = (websiteUser: any): WebsiteUser | null => {
  if (!websiteUser) return null;
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
      website: sharedWebsiteNested ?? undefined
      // Remove properties not defined in WebsiteUser type if necessary
  };
};


// --- Service Functions ---

// No changes needed
export async function getAllWebsites(): Promise<Website[]> {
  const websitesPrisma = await prisma.website.findMany({ orderBy: { createdAt: 'desc' } });
  return websitesPrisma.map(w => mapPrismaWebsiteToShared(w)!);
}

// Changed userId type to string
export async function getWebsitesForUser(userId: string): Promise<WebsiteUser[]> {
  // 1. Fetch base WebsiteUser data with Website included, sorted
  const websiteUsersPrisma = await prisma.websiteUser.findMany({
      where: { userId: userId }, // Use string ID
      include: { website: true },
      orderBy: [{ isPinned: 'desc' }, { website: { url: 'asc' } }]
  });

  if (websiteUsersPrisma.length === 0) return [];

  const websiteIds = websiteUsersPrisma.map(wu => wu.websiteId);

  // 2. Fetch Latest Results (no change)
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

  // 3. Fetch Current Open Incidents (no change)
  const openIncidentsPromises = websiteIds.map(id =>
      IncidentService.getCurrentOpenIncidentForWebsite(id) // Assuming IncidentService doesn't need userId here
  );
  const openIncidents = (await Promise.all(openIncidentsPromises)).filter(inc => inc !== null) as Incident[];
  const openIncidentMap = new Map<number, Incident>();
  openIncidents.forEach(incident => {
      openIncidentMap.set(incident.websiteId, incident);
  });

  // 4. Fetch Chart Data (no change)
  const chartDataPromises = websiteIds.map(id =>
      StatsCalculator.getChartDataForWebsite(id, CARD_TIMEFRAME)
          .then(data => ({ websiteId: id, chartData: data.slice(-MAX_CARD_DATA_POINTS) }))
  );
  const chartDataResults = await Promise.all(chartDataPromises);
  const chartDataMap = new Map<number, ChartDataPoint[]>();
  chartDataResults.forEach(result => { chartDataMap.set(result.websiteId, result.chartData); });

  // 5. Fetch Uptime Percentage (no change)
  const dailyStartDate = subDays(new Date(), 1);
  const uptimePromises = websiteIds.map(id =>
      StatsCalculator.calculateUptimeBetweenDates(id, dailyStartDate, new Date())
          .then(uptime => ({ websiteId: id, uptimePercent: uptime }))
  );
  const uptimeResults = await Promise.all(uptimePromises);
  const uptimeMap = new Map<number, number>();
  uptimeResults.forEach(result => { uptimeMap.set(result.websiteId, result.uptimePercent); });

  // 6. Map Prisma results to Shared type and augment
  const results: WebsiteUser[] = websiteUsersPrisma.map(wuPrisma => {
      // mapPrismaWebsiteUserToSharedBase handles the string userId from wuPrisma
      const sharedWu = mapPrismaWebsiteUserToSharedBase(wuPrisma);
      if (!sharedWu) return null;

      // Add dynamic data (no change)
      sharedWu.latestResult = latestResultMap.get(sharedWu.websiteId) ?? null;
      sharedWu.chartData = chartDataMap.get(sharedWu.websiteId) ?? [];
      sharedWu.uptimePercent = uptimeMap.get(sharedWu.websiteId) ?? 100;
      sharedWu.currentIncident = openIncidentMap.get(sharedWu.websiteId) ?? null;

      return sharedWu;
  }).filter(wu => wu !== null) as WebsiteUser[]; // Ensure non-null results

  return results;
}

// No changes needed
export async function getWebsiteById(id: number): Promise<Website | null> {
  const websitePrisma = await prisma.website.findUnique({ where: { id } });
  return mapPrismaWebsiteToShared(websitePrisma);
}

// No changes needed
export async function getWebsiteByUrl(url: string): Promise<Website | null> {
  const websitePrisma = await prisma.website.findUnique({ where: { url } });
  return mapPrismaWebsiteToShared(websitePrisma);
}

// Changed userId type to string
export async function getUserWebsiteById(userId: string, websiteId: number): Promise<WebsiteUser | null> {
  const userWebsitePrisma = await prisma.websiteUser.findUnique({
      where: { userId_websiteId: { userId: userId, websiteId: websiteId } }, // Use string ID
      include: { website: true }
  });
  return mapPrismaWebsiteUserToSharedBase(userWebsitePrisma);
}

// No changes needed
export async function createWebsite(data: { url: string; interval?: number }): Promise<Website> {
  if (!data.url || !/^https?:\/\/.+/.test(data.url)) {
      throw new Error('Invalid URL format provided for website creation.');
  }
  try {
      const websitePrisma = await prisma.website.create({
          data: {
              url: data.url,
              globalInterval: DEFAULT_GLOBAL_INTERVAL,
              isActive: true // Typically start active when created
          }
      });
      return mapPrismaWebsiteToShared(websitePrisma)!;
  } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          console.error(`Website creation failed: URL '${data.url}' already exists.`);
          throw new Error(`Website with URL '${data.url}' already exists.`);
      }
      console.error("Error creating website:", error);
      throw error; // Re-throw other errors
  }
}

// No changes needed
export async function updateGlobalInterval(websiteId: number): Promise<void> {
  const websiteUsers = await prisma.websiteUser.findMany({
      where: {
          websiteId: websiteId,
          interval: { not: null, gt: 0 } // Only consider positive intervals
      },
      select: { interval: true }
  });

  // Filter out nulls explicitly just in case, though 'not: null' should handle it
  const intervals = websiteUsers.map(wu => wu.interval).filter((i): i is number => i !== null && i > 0);

  let newGlobalInterval: number;
  if (intervals.length > 0) {
      newGlobalInterval = Math.min(...intervals);
  } else {
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
          // Decide if this error should propagate
      }
  } else if (!currentWebsite) {
      console.warn(`[Interval Update] Website with ID ${websiteId} not found during interval update check.`);
  }
}

// No changes needed
export async function checkAndDeactivateWebsiteIfOrphaned(websiteId: number): Promise<void> {
  const logPrefix = `[Orphan Check W:${websiteId}]`;
  try {
      const remainingUsersCount = await prisma.websiteUser.count({
          where: { websiteId: websiteId }
      });

      console.log(`${logPrefix} Found ${remainingUsersCount} remaining users.`);

      if (remainingUsersCount === 0) {
          const currentWebsite = await prisma.website.findUnique({
              where: { id: websiteId },
              select: { isActive: true }
          });

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
      console.error(`${logPrefix} Error during orphan check/deactivation:`, error);
      // Don't propagate error, as this is often a cleanup task
  }
}

// No changes needed
export async function updateWebsiteCore(id: number, data: Partial<{ url: string; isActive?: boolean }>): Promise<Website | null> {
  try {
      // Validate URL only if it's provided and not null
      if (data.url !== undefined && data.url !== null && !/^https?:\/\/.+/.test(data.url)) {
          throw new Error('Invalid URL format provided for website update.');
      }
      const updatePayload: Prisma.WebsiteUpdateInput = {};
      // Allow setting url to null if needed? Schema might not allow it. Assuming not.
      if (data.url !== undefined) updatePayload.url = data.url;
      if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

      if (Object.keys(updatePayload).length === 0) {
          console.warn(`No core website data provided for update on ID ${id}. Fetching current state.`);
          const currentWebsite = await prisma.website.findUnique({ where: { id } });
          return mapPrismaWebsiteToShared(currentWebsite);
      }

      const websitePrisma = await prisma.website.update({ where: { id }, data: updatePayload });
      return mapPrismaWebsiteToShared(websitePrisma);
  } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
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
}

// Changed userId type to string
export async function updateUserWebsite(userId: string, websiteId: number, data: UpdateWebsiteUserDTO): Promise<WebsiteUser | null> {
  const prismaUpdateData: Prisma.WebsiteUserUpdateWithoutUserInput = {}; // Correct type for nested update
  // Check for undefined to allow setting null/empty values if needed by schema
  if (data.name !== undefined) prismaUpdateData.name = data.name;
  if (data.interval !== undefined) prismaUpdateData.interval = data.interval;
  if (data.alertThreshold !== undefined) prismaUpdateData.alertThreshold = data.alertThreshold;
  if (data.notifyEmail !== undefined) prismaUpdateData.notifyEmail = data.notifyEmail;
  if (typeof data.alertEnabled === 'boolean') prismaUpdateData.alertEnabled = data.alertEnabled;
  if (typeof data.isPinned === 'boolean') prismaUpdateData.isPinned = data.isPinned;

  if (Object.keys(prismaUpdateData).length === 0) {
      console.warn(`No update data provided for user ${userId}, website ${websiteId}. Skipping update.`);
      // Fetch and return current data if no changes provided
      return getUserWebsiteById(userId, websiteId);
  }

  try {
      const updatedWebsiteUserPrisma = await prisma.websiteUser.update({
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
  } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          console.warn(`WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for update.`);
          return null; // Return null if the relation doesn't exist
      }
      console.error(`Error updating user website settings for user ${userId}, website ${websiteId}:`, error);
      throw error; // Re-throw other errors
  }
}

// Changed userId type to string
export async function setPinStatusForUser(userId: string, websiteId: number, isPinned: boolean): Promise<WebsiteUser | null> {
  try {
      const updatedWebsiteUserPrisma = await prisma.websiteUser.update({
          where: { userId_websiteId: { userId: userId, websiteId: websiteId } }, // Use string ID
          data: { isPinned: isPinned },
          include: { website: true }, // Include website for mapping response
      });
      return mapPrismaWebsiteUserToSharedBase(updatedWebsiteUserPrisma);
  } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          console.warn(`WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for pin update.`);
          return null; // Return null if the relation doesn't exist
      }
      console.error(`Error setting pin status for user ${userId}, website ${websiteId}:`, error);
      throw error; // Re-throw other errors
  }
}

// No changes needed
export async function deleteWebsite(id: number): Promise<Website | null> {
  try {
      // Cascade delete is defined in the schema, handles related records
      const websitePrisma = await prisma.website.delete({ where: { id } });
      return mapPrismaWebsiteToShared(websitePrisma);
  } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          console.warn(`Website with ID ${id} not found for deletion.`);
          return null; // Return null if already deleted
      }
      console.error(`Error deleting website ${id}:`, error);
      throw error; // Re-throw other errors
  }
}

// No changes needed
export async function toggleWebsiteStatus(id: number): Promise<Website | null> {
  try {
      // Use transaction for read-then-write safety
      const updatedWebsitePrisma = await prisma.$transaction(async (tx) => {
          const website = await tx.website.findUnique({ where: { id }, select: { isActive: true } });
          if (!website) {
              // Use a custom error or specific handling for 'not found'
              throw new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '?.?.?' });
          }
          return tx.website.update({ where: { id }, data: { isActive: !website.isActive } });
      });
      return mapPrismaWebsiteToShared(updatedWebsitePrisma);
  } catch (error: any) {
      // Check specifically for the P2025 code we might throw or that Prisma might throw
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          console.warn(`Website with ID ${id} not found for toggle.`);
          return null;
      }
      console.error(`Error toggling status for website ${id}:`, error);
      throw error; // Re-throw other errors
  }
}

// Changed userId type to string
export async function addWebsiteToUser(userId: string, websiteData: AddWebsiteUserDTO): Promise<WebsiteUser> {
  if (!websiteData.url || !/^https?:\/\/.+/.test(websiteData.url)) {
      throw new Error('Invalid URL format provided.');
  }

  try {
      const websiteUserPrisma = await prisma.$transaction(async (tx) => {
          // 1. Upsert the website: find existing or create new
          const website = await tx.website.upsert({
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
          const websiteUser = await tx.websiteUser.upsert({
              where: { userId_websiteId: { userId: userId, websiteId: website.id } },
              update: { // Fields to update if relation exists
                  name: websiteData.name,
                  interval: websiteData.interval,
                  alertThreshold: websiteData.alertThreshold,
                  alertEnabled: websiteData.alertEnabled ?? false,
                  notifyEmail: websiteData.notifyEmail,
                  isPinned: websiteData.isPinned ?? false
              },
              create: { // Fields to set if relation is new
                  userId: userId, // Use string ID
                  websiteId: website.id,
                  name: websiteData.name,
                  interval: websiteData.interval,
                  alertThreshold: websiteData.alertThreshold,
                  alertEnabled: websiteData.alertEnabled ?? false,
                  notifyEmail: websiteData.notifyEmail,
                  isPinned: websiteData.isPinned ?? false
              },
              include: { website: true } // Include for mapping response
          });

          // 3. Trigger global interval update (async)
          // Use 'await' only if the result of this is critical before returning
          // Otherwise, let it run in the background
          updateGlobalInterval(website.id).catch(err => console.error(`[Interval Update Post-Add] Error updating global interval for website ${website.id}:`, err));

          return websiteUser; // Return the result of the upsert
      });

      // Map the final Prisma result (including website) to the shared type
      return mapPrismaWebsiteUserToSharedBase(websiteUserPrisma)!; // Add '!' if confident it won't be null

  } catch (error) {
      // Catch potential errors (like DB connection issues, unexpected problems)
      console.error(`Error in addWebsiteToUser transaction for user ${userId}, URL ${websiteData.url}:`, error);
      // Provide a generic error to the client
      throw new Error(`Failed to add website '${websiteData.url}' to your dashboard.`);
  }
}


/**
* Removes a website from a user's dashboard.
* After removing the user link, it checks if any other users are monitoring the site.
* If not, it deactivates the website.
* It also triggers an update to the global interval regardless.
*/
// Changed userId type to string
export async function removeWebsiteFromUser(userId: string, websiteId: number): Promise<void> {
  try {
      await prisma.$transaction(async (tx) => {
          // 1. Delete the user's association
          await tx.websiteUser.delete({
              where: { userId_websiteId: { userId: userId, websiteId: websiteId } } // Use string ID
          });
          console.log(`[User Website] Removed website ${websiteId} from user ${userId}`);

          // 2. Check if any users remain for this website
          const remainingUsersCount = await tx.websiteUser.count({
              where: { websiteId: websiteId }
          });

          // 3. If no users remain, deactivate the website
          if (remainingUsersCount === 0) {
              // Check current status before update
              const currentWebsite = await tx.website.findUnique({ where: { id: websiteId }, select: { isActive: true } });
              if (currentWebsite?.isActive) {
                  await tx.website.update({
                      where: { id: websiteId },
                      data: { isActive: false }
                  });
                  console.log(`[User Website] Deactivated website ${websiteId} as it has no more users.`);
              }
          }
      });

      // 4. Update the global interval (outside transaction, runs async)
      // Run this regardless of whether the transaction succeeded or hit P2025 initially
      updateGlobalInterval(websiteId).catch(err => console.error(`[Interval Update Post-Remove] Error updating global interval for website ${websiteId}:`, err));

  } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          // P2025: Record to delete not found (user link already gone)
          console.warn(`[User Website Removal] WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found (already removed?). Proceeding with orphan check.`);

          // Still need to check for orphans and update interval even if the delete failed because the record was gone
          try {
              const remainingUsersCount = await prisma.websiteUser.count({
                  where: { websiteId: websiteId }
              });

              if (remainingUsersCount === 0) {
                  const currentWebsite = await prisma.website.findUnique({ where: { id: websiteId }, select: { isActive: true } });
                  if (currentWebsite?.isActive) {
                      await prisma.website.update({
                          where: { id: websiteId },
                          data: { isActive: false }
                      });
                      console.log(`[User Website Removal] Deactivated website ${websiteId} after P2025 on user link removal.`);
                  }
              }
              // Trigger interval update after handling P2025
              updateGlobalInterval(websiteId).catch(err => console.error(`[Interval Update Post-Remove P2025] Error updating global interval for website ${websiteId}:`, err));

          } catch (cleanupError) {
               console.error(`[User Website Removal] Error during cleanup check after P2025 for user ${userId}, website ${websiteId}:`, cleanupError);
               // Decide if this error should be thrown
          }

      } else {
          // Re-throw other unexpected errors
          console.error(`Error removing website ${websiteId} from user ${userId}:`, error);
          throw new Error(`Failed to remove website from dashboard (User: ${userId}, Website: ${websiteId}).`);
      }
  }
}

// Changed userId type to string
export async function hasUserWebsite(userId: string, websiteId: number): Promise<boolean> {
  const count = await prisma.websiteUser.count({
      where: { userId: userId, websiteId: websiteId } // Use string ID
  });
  return count > 0;
}

// No changes needed
export async function searchWebsites(searchTerm: string, limit = 10): Promise<Website[]> {
  if (!searchTerm || searchTerm.trim().length < 2) return [];
  const websitesPrisma = await prisma.website.findMany({
      where: { url: { contains: searchTerm } },
      take: limit,
      orderBy: { url: 'asc' }
  });
  return websitesPrisma.map(w => mapPrismaWebsiteToShared(w)!); // Use non-null assertion if confident
}