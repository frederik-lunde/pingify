// server/src/services/websiteService.ts
import {
    PrismaClient,
    Website as PrismaWebsite,
    WebsiteUser as PrismaWebsiteUser,
    MonitoringResult as PrismaMonitoringResult, // <-- Import MonitoringResult
    Prisma
  } from '@prisma/client';
  import prisma from '../prisma/prismaClient'; // Adjust the path if needed
  // Import StatsCalculator to get downtime info
  import { StatsCalculator } from './monitoringService';
  
  // --- Import SHARED Types ---
  import {
    AddWebsiteUserDTO,
    Website,
    WebsiteUser,
    UpdateWebsiteUserDTO,
    SetPinStatusDTO,
    DowntimeInfo // <-- Import DowntimeInfo
  } from '../types'; // Adjust path if necessary
  
  
  // --- Mapping Helper Functions ---
  
  /**
  * Maps a Prisma Website object to the shared Website type.
  */
  const mapPrismaWebsiteToShared = (website: PrismaWebsite | null): Website | null => {
    if (!website) return null;
    return {
        id: website.id,
        url: website.url,
        isActive: website.isActive,
        lastChecked: website.lastChecked?.toISOString() ?? null,
        globalInterval: website.globalInterval,
        createdAt: website.createdAt?.toISOString() ?? undefined,
        updatedAt: website.updatedAt?.toISOString() ?? undefined,
    };
  };
  
  /**
  * Maps a Prisma WebsiteUser object (optionally including nested Website)
  * to the shared WebsiteUser type.
  * Does NOT include downtime info - that's added later.
  * FIX: Uses 'any' for the input parameter to bypass strict relation checking.
  */
  const mapPrismaWebsiteUserToShared = (
    websiteUser: any // Use 'any' here to allow access to included relations
  ): WebsiteUser | null => {
    if (!websiteUser) return null;
  
    // Map nested website if included (accessing properties on 'any' bypasses TS checks)
    const sharedWebsiteNested = websiteUser.website
        ? mapPrismaWebsiteToShared(websiteUser.website)
        : undefined;
  
    // Base mapping without downtime fields initially
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
        // Map isPinned
        isPinned: websiteUser.isPinned,
        website: sharedWebsiteNested ?? undefined,
        // Downtime fields are added in the calling function (getWebsitesForUser)
    };
  };
  
  
  // --- Service Functions ---
  
  /**
  * Get all websites (admin function).
  * Returns array of SHARED Website type.
  */
  export async function getAllWebsites(): Promise<Website[]> {
    const websitesPrisma = await prisma.website.findMany({
        orderBy: { createdAt: 'desc' },
    });
    // Use non-null assertion as mapPrismaWebsiteToShared handles null
    return websitesPrisma.map(w => mapPrismaWebsiteToShared(w)!);
  }
  
  /**
   * Get websites for a specific user, including nested Website data
   * AND latest status + downtime info if applicable.
   * Pinned websites are returned first, then sorted by URL.
   * Returns array of SHARED WebsiteUser type (augmented with status).
   */
  export async function getWebsitesForUser(userId: number): Promise<WebsiteUser[]> {
      // 1. Fetch base WebsiteUser data with Website included, sorted
      const websiteUsersPrisma = await prisma.websiteUser.findMany({
          where: { userId },
          include: { website: true }, // Include the nested website data
          // Sort by pinned status (descending, so true comes first), then by URL
          orderBy: [
              { isPinned: 'desc' },
              { website: { url: 'asc' } }
          ]
      });
  
      // If no websites, return empty array
      if (websiteUsersPrisma.length === 0) {
          return [];
      }
  
      // 2. Get IDs of the websites the user monitors
      const websiteIds = websiteUsersPrisma.map(wu => wu.websiteId);
  
      // 3. Fetch the *latest* MonitoringResult for each of these websites efficiently
      // Using groupBy and max(checkedAt) is complex with Prisma relations.
      // A common pattern is to fetch latest N for each and pick the top one in code,
      // or use a raw query if performance becomes critical.
      // Let's fetch the latest 1 for each ID for simplicity here.
      const latestResultsPromises = websiteIds.map(id =>
          prisma.monitoringResult.findFirst({
              where: { websiteId: id },
              orderBy: { checkedAt: 'desc' },
              select: { websiteId: true, isAvailable: true } // Select only needed fields
          })
      );
      const latestResultsRaw = (await Promise.all(latestResultsPromises)).filter(r => r !== null);
      // Create a map for quick lookup: websiteId -> isAvailable
      const latestStatusMap = new Map<number, boolean>();
      latestResultsRaw.forEach(result => {
          if (result) { // Ensure result is not null
               latestStatusMap.set(result.websiteId, result.isAvailable);
          }
      });
  
  
      // 4. Fetch Downtime Info *only* for websites currently marked as down
      const downWebsiteIds = websiteIds.filter(id => latestStatusMap.get(id) === false);
      let downtimeInfoMap = new Map<number, DowntimeInfo>();
  
      if (downWebsiteIds.length > 0) {
          const downtimeInfoPromises = downWebsiteIds.map(id =>
              StatsCalculator.getCurrentDowntimeInfo(id).then(info => ({ websiteId: id, ...info }))
          );
          const downtimeInfos = await Promise.all(downtimeInfoPromises);
          downtimeInfos.forEach(info => {
              downtimeInfoMap.set(info.websiteId, {
                  consecutiveFailures: info.consecutiveFailures,
                  downtimeStartedAt: info.downtimeStartedAt
              });
          });
      }
  
      // 5. Map Prisma results to Shared type and augment with status/downtime
      const results: WebsiteUser[] = websiteUsersPrisma.map(wuPrisma => {
          // Map the base WebsiteUser data
          const sharedWu = mapPrismaWebsiteUserToShared(wuPrisma);
          if (!sharedWu) return null; // Should not happen if wuPrisma is valid
  
          // Check if the latest result indicates downtime
          const isDown = latestStatusMap.get(sharedWu.websiteId) === false;
  
          if (isDown) {
              // If down, retrieve the pre-calculated downtime info
              const downtimeInfo = downtimeInfoMap.get(sharedWu.websiteId);
              if (downtimeInfo) {
                  sharedWu.consecutiveFailures = downtimeInfo.consecutiveFailures;
                  sharedWu.downtimeStartedAt = downtimeInfo.downtimeStartedAt?.toISOString() ?? null;
              } else {
                   // Fallback if info wasn't fetched (shouldn't happen with current logic)
                   sharedWu.consecutiveFailures = 1; // At least 1 failure if marked down
                   sharedWu.downtimeStartedAt = null; // Cannot determine start time
              }
          } else {
              // Explicitly set to undefined or null if not down (optional fields)
               sharedWu.consecutiveFailures = undefined; // Or 0 if preferred
               sharedWu.downtimeStartedAt = null;
          }
  
          return sharedWu;
      }).filter(wu => wu !== null) as WebsiteUser[]; // Filter out any potential nulls
  
      return results;
  }
  
  
  /**
  * Get website by ID.
  * Returns SHARED Website type or null.
  */
  export async function getWebsiteById(id: number): Promise<Website | null> {
    const websitePrisma = await prisma.website.findUnique({
        where: { id }
    });
    return mapPrismaWebsiteToShared(websitePrisma);
  }
  
  /**
  * Get website by URL (exact match).
  * Returns SHARED Website type or null.
  */
  export async function getWebsiteByUrl(url: string): Promise<Website | null> {
    const websitePrisma = await prisma.website.findUnique({
        where: { url },
    });
    return mapPrismaWebsiteToShared(websitePrisma);
  }
  
  /**
  * Get user's website configuration by website ID, including nested website data.
  * Returns SHARED WebsiteUser type or null.
  */
  export async function getUserWebsiteById(userId: number, websiteId: number): Promise<WebsiteUser | null> {
    const userWebsitePrisma = await prisma.websiteUser.findUnique({
        where: { userId_websiteId: { userId, websiteId } },
        include: { website: true }
    });
     // Mapper now accepts 'any'
    return mapPrismaWebsiteUserToShared(userWebsitePrisma);
  }
  
  
  /**
  * Create a new website (core entity). Internal/Admin function.
  * Returns SHARED Website type.
  */
  export async function createWebsite(data: { url: string; interval?: number }): Promise<Website> {
    if (!data.url || !/^https?:\/\/.+/.test(data.url)) {
        throw new Error('Invalid URL format provided for website creation.');
    }
    try {
        const websitePrisma = await prisma.website.create({
            data: {
                url: data.url,
                globalInterval: data.interval ?? 300,
                isActive: true,
            },
        });
        // Use non-null assertion
        return mapPrismaWebsiteToShared(websitePrisma)!;
    } catch (error) {
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            // Log specific error for duplicate URL
            console.error(`Website creation failed: URL '${data.url}' already exists.`);
            throw new Error(`Website with URL '${data.url}' already exists.`);
         }
         // Log generic error
         console.error("Error creating website:", error);
         throw error;
    }
  }
  
  /**
  * Updates the global interval for a website based on minimum user interval. Internal helper.
  */
  export async function updateGlobalInterval(websiteId: number): Promise<void> {
    const websiteUsers = await prisma.websiteUser.findMany({
        where: { websiteId }, select: { interval: true }
    });
  
    const intervals = websiteUsers
        .map(wu => wu.interval)
        // Ensure interval is a positive number
        .filter((i): i is number => i !== null && i > 0);
  
    const newGlobalInterval = intervals.length > 0 ? Math.min(...intervals) : 300;
  
    const currentWebsite = await prisma.website.findUnique({
        where: { id: websiteId },
        select: { globalInterval: true }
    });
  
    if (currentWebsite && currentWebsite.globalInterval !== newGlobalInterval) {
        try {
            await prisma.website.update({
                where: { id: websiteId }, data: { globalInterval: newGlobalInterval }
            });
            // Log successful interval update
            console.log(`[Interval Update] Updated global interval for website ${websiteId} to ${newGlobalInterval} seconds.`);
        } catch (error) {
            // Log failed interval update
             console.error(`[Interval Update] Failed to update global interval for website ${websiteId}:`, error);
        }
    }
  }
  
  /**
  * Update a website's core properties (e.g., URL, isActive - typically an admin action).
  * Returns SHARED Website type or null if not found.
  */
  export async function updateWebsiteCore(id: number, data: Partial<{ url: string; isActive?: boolean }>): Promise<Website | null> {
    try {
        if (data.url !== undefined && (data.url === null || !/^https?:\/\/.+/.test(data.url))) {
            throw new Error('Invalid URL format provided for website update.');
        }
        const websitePrisma = await prisma.website.update({
            where: { id },
            data
        });
        return mapPrismaWebsiteToShared(websitePrisma);
    } catch (error) {
         if (error instanceof Prisma.PrismaClientKnownRequestError) {
             if (error.code === 'P2025') {
                 // Warn if website not found for update
                 console.warn(`Website with ID ${id} not found for update.`);
                 return null;
             }
             if (error.code === 'P2002') {
                 // Log specific error for duplicate URL on update
                 console.error(`Website update failed: URL '${data.url}' already exists.`);
                throw new Error(`Another website with URL '${data.url}' already exists.`);
             }
         }
         // Log generic error during core update
        console.error(`Error updating core website ${id}:`, error);
        throw error;
    }
  }
  
  /**
  * Update a user's specific configuration/settings for a website they monitor.
  * Expects the shared UpdateWebsiteUserDTO. Returns the updated SHARED WebsiteUser type.
  */
  export async function updateUserWebsite(
    userId: number,
    websiteId: number,
    data: UpdateWebsiteUserDTO
  ): Promise<WebsiteUser | null> {
  
    const prismaUpdateData: Prisma.WebsiteUserUpdateWithoutUserInput = {};
    if (data.name !== undefined) prismaUpdateData.name = data.name;
    if (data.interval !== undefined) prismaUpdateData.interval = data.interval;
    if (data.alertThreshold !== undefined) prismaUpdateData.alertThreshold = data.alertThreshold;
    if (data.notifyEmail !== undefined) prismaUpdateData.notifyEmail = data.notifyEmail;
    if (typeof data.alertEnabled === 'boolean') {
        prismaUpdateData.alertEnabled = data.alertEnabled;
    }
    // Handle the isPinned field
    if (typeof data.isPinned === 'boolean') {
        prismaUpdateData.isPinned = data.isPinned;
    }
  
    if (Object.keys(prismaUpdateData).length === 0) {
        // Warn if no update data provided
        console.warn(`No update data provided for user ${userId}, website ${websiteId}. Skipping update.`);
        return getUserWebsiteById(userId, websiteId);
    }
  
    try {
        const updatedWebsiteUserPrisma = await prisma.websiteUser.update({
            where: { userId_websiteId: { userId, websiteId } },
            data: prismaUpdateData,
            include: { website: true }
        });
  
        // Update global interval only if user interval was changed
        if (data.interval !== undefined) {
            // Run async, don't wait, catch errors separately
            updateGlobalInterval(websiteId).catch(err => console.error("Error updating global interval post-update:", err));
        }
  
         // Mapper accepts 'any'
        return mapPrismaWebsiteUserToShared(updatedWebsiteUserPrisma);
  
    } catch (error) {
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
             // Warn if relation not found for update
            console.warn(`WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for update.`);
            return null;
         }
         // Log generic error during user website update
        console.error(`Error updating user website settings for user ${userId}, website ${websiteId}:`, error);
        throw error;
    }
  }
  
  /**
  * Sets the pinned status for a user's website.
  * Returns the updated SHARED WebsiteUser type or null if not found.
  */
  export async function setPinStatusForUser(
    userId: number,
    websiteId: number,
    isPinned: boolean
  ): Promise<WebsiteUser | null> {
    try {
      const updatedWebsiteUserPrisma = await prisma.websiteUser.update({
        where: { userId_websiteId: { userId, websiteId } },
        data: { isPinned: isPinned },
        include: { website: true },
      });
      return mapPrismaWebsiteUserToShared(updatedWebsiteUserPrisma);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          // Warn if relation not found for pin update
        console.warn(`WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for pin update.`);
        return null;
      }
      // Log error setting pin status
      console.error(`Error setting pin status for user ${userId}, website ${websiteId}:`, error);
      throw error;
    }
  }
  
  /**
  * Delete a website entirely (admin function - removes core Website and relations via cascade).
  * Returns the deleted SHARED Website type or null if not found.
  */
  export async function deleteWebsite(id: number): Promise<Website | null> {
    try {
        const websitePrisma = await prisma.website.delete({ where: { id } });
        return mapPrismaWebsiteToShared(websitePrisma);
    } catch (error) {
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
             // Warn if website not found for deletion
            console.warn(`Website with ID ${id} not found for deletion.`);
            return null;
         }
         // Log error deleting website
        console.error(`Error deleting website ${id}:`, error);
        throw error;
    }
  }
  
  /**
  * Toggle a website's active status globally (admin function).
  * Returns the updated SHARED Website type or null if not found.
  */
  export async function toggleWebsiteStatus(id: number): Promise<Website | null> {
    try {
        const updatedWebsitePrisma = await prisma.$transaction(async (tx) => {
            const website = await tx.website.findUnique({
                where: { id },
                select: { isActive: true }
            });
            if (!website) {
                 throw new Error(`Website with ID ${id} not found`);
            }
            return tx.website.update({
                where: { id },
                data: { isActive: !website.isActive },
            });
        });
        return mapPrismaWebsiteToShared(updatedWebsitePrisma);
    } catch (error: any) {
         if (error.message?.includes('not found')) {
             // Warn if website not found for toggle
             console.warn(`Website with ID ${id} not found for toggle.`);
             return null;
         }
         // Log error toggling status
         console.error(`Error toggling status for website ${id}:`, error);
         throw error;
    }
  }
  
  /**
  * Adds a website to a user's dashboard.
  * Returns the added/updated SHARED WebsiteUser type.
  */
  export async function addWebsiteToUser(userId: number, websiteData: AddWebsiteUserDTO): Promise<WebsiteUser> {
    if (!websiteData.url || !/^https?:\/\/.+/.test(websiteData.url)) {
        throw new Error('Invalid URL format provided.');
    }
  
    try {
        const websiteUserPrisma = await prisma.$transaction(async (tx) => {
            // Use upsert to create or ensure website exists and is active
            let website = await tx.website.upsert({
                where: { url: websiteData.url },
                update: { isActive: true },
                create: {
                    url: websiteData.url,
                    globalInterval: websiteData.interval ?? 300,
                    isActive: true,
                },
            });
  
            // Use upsert for the WebsiteUser relation
            const websiteUser = await tx.websiteUser.upsert({
                where: { userId_websiteId: { userId, websiteId: website.id } },
                update: {
                    name: websiteData.name,
                    interval: websiteData.interval,
                    alertThreshold: websiteData.alertThreshold,
                    alertEnabled: websiteData.alertEnabled ?? false,
                    notifyEmail: websiteData.notifyEmail,
                     // Handle isPinned on update
                    isPinned: websiteData.isPinned ?? false,
                 },
                create: {
                     userId,
                     websiteId: website.id,
                     name: websiteData.name,
                     interval: websiteData.interval,
                     alertThreshold: websiteData.alertThreshold,
                     alertEnabled: websiteData.alertEnabled ?? false,
                     notifyEmail: websiteData.notifyEmail,
                      // Handle isPinned on create
                     isPinned: websiteData.isPinned ?? false,
                },
                 // Include for mapping return value
                include: { website: true }
            });
  
            // Update global interval if user interval was set/changed
            if (websiteData.interval !== undefined) {
                // Run async, don't wait, catch errors separately
                updateGlobalInterval(website.id).catch(err => console.error("Error updating global interval post-add:", err));
            }
  
            return websiteUser;
        });
  
         // Mapper accepts 'any'
        return mapPrismaWebsiteUserToShared(websiteUserPrisma)!;
  
    } catch (error) {
        // Log error during addWebsiteToUser
        console.error(`Error in addWebsiteToUser for user ${userId}, URL ${websiteData.url}:`, error);
        throw new Error(`Failed to add website '${websiteData.url}' to your dashboard. Please try again.`);
    }
  }
  
  
  /**
  * Removes a website from a specific user's dashboard (deletes the WebsiteUser relation).
  * Returns void.
  */
  export async function removeWebsiteFromUser(userId: number, websiteId: number): Promise<void> {
    try {
        await prisma.$transaction(async (tx) => {
            await tx.websiteUser.delete({
                 where: { userId_websiteId: { userId, websiteId } }
            });
            // Log successful removal
            console.log(`[User Website] Removed website ${websiteId} from user ${userId}`);
            // Trigger interval update after removal
             // Run async, don't wait, catch errors separately
            updateGlobalInterval(websiteId).catch(err => console.error("Error updating global interval post-remove:", err));
        });
    } catch (error: any) {
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
             // Warn if relation not found (already removed?)
            console.warn(`WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for deletion (already removed?).`);
         } else {
             // Log generic error during removal
             console.error(`Error removing website ${websiteId} from user ${userId}:`, error);
             throw error;
         }
    }
  }
  
  /**
  * Check if a specific user has a specific website in their dashboard. Returns boolean.
  */
  export async function hasUserWebsite(userId: number, websiteId: number): Promise<boolean> {
    const count = await prisma.websiteUser.count({
        where: { userId: userId, websiteId: websiteId }
    });
    return count > 0;
  }
  
  /**
  * Search websites based on URL containing the search term.
  * Returns array of SHARED Website type.
  */
  export async function searchWebsites(searchTerm: string, limit = 10): Promise<Website[]> {
    if (!searchTerm || searchTerm.trim().length < 2) {
        return [];
    }
  
    const websitesPrisma = await prisma.website.findMany({
        where: {
            url: {
                 contains: searchTerm,
                 // Uncomment if DB supports it and you need case-insensitivity
                 // mode: 'insensitive'
            }
        },
        take: limit,
        orderBy: { url: 'asc' }
    });
  
    // Use non-null assertion
    return websitesPrisma.map(w => mapPrismaWebsiteToShared(w)!);
  }