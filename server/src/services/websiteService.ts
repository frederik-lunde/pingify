// server/src/services/websiteService.ts
import {
  PrismaClient,
  Website as PrismaWebsite,
  WebsiteUser as PrismaWebsiteUser,
  Prisma
} from '@prisma/client';
import prisma from '../prisma/prismaClient'; // Adjust the path if needed

// --- Import SHARED Types ---
import {
  AddWebsiteUserDTO,
  Website,
  WebsiteUser,
  UpdateWebsiteUserDTO,
  SetPinStatusDTO
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
      isPinned: websiteUser.isPinned, // <-- Map isPinned
      website: sharedWebsiteNested ?? undefined,
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
  return websitesPrisma.map(w => mapPrismaWebsiteToShared(w)!);
}

/**
* Get websites for a specific user, including nested Website data.
* Pinned websites are returned first, then sorted by URL.
* Returns array of SHARED WebsiteUser type.
*/
export async function getWebsitesForUser(userId: number): Promise<WebsiteUser[]> {
  const websiteUsersPrisma = await prisma.websiteUser.findMany({
      where: { userId },
      include: { website: true }, // Include the nested website data
      // Sort by pinned status (descending, so true comes first), then by URL
      orderBy: [
          { isPinned: 'desc' },
          { website: { url: 'asc' } }
      ]
  });
  return websiteUsersPrisma.map(wu => mapPrismaWebsiteUserToShared(wu)!);
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
  return mapPrismaWebsiteUserToShared(userWebsitePrisma); // Mapper now accepts 'any'
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

/**
* Updates the global interval for a website based on minimum user interval. Internal helper.
*/
export async function updateGlobalInterval(websiteId: number): Promise<void> {
  const websiteUsers = await prisma.websiteUser.findMany({
      where: { websiteId }, select: { interval: true }
  });

  const intervals = websiteUsers
      .map(wu => wu.interval)
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
          console.log(`[Interval Update] Updated global interval for website ${websiteId} to ${newGlobalInterval} seconds.`);
      } catch (error) {
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
          updateGlobalInterval(websiteId).catch(err => console.error("Error updating global interval post-update:", err));
      }

      return mapPrismaWebsiteUserToShared(updatedWebsiteUserPrisma); // Mapper accepts 'any'

  } catch (error) {
       if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          console.warn(`WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for update.`);
          return null;
       }
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
      console.warn(`WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for pin update.`);
      return null;
    }
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
          console.warn(`Website with ID ${id} not found for deletion.`);
          return null;
       }
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
           console.warn(`Website with ID ${id} not found for toggle.`);
           return null;
       }
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
          let website = await tx.website.upsert({
              where: { url: websiteData.url },
              update: { isActive: true },
              create: {
                  url: websiteData.url,
                  globalInterval: websiteData.interval ?? 300,
                  isActive: true,
              },
          });

          const websiteUser = await tx.websiteUser.upsert({
              where: { userId_websiteId: { userId, websiteId: website.id } },
              update: {
                  name: websiteData.name,
                  interval: websiteData.interval,
                  alertThreshold: websiteData.alertThreshold,
                  alertEnabled: websiteData.alertEnabled ?? false,
                  notifyEmail: websiteData.notifyEmail,
                  isPinned: websiteData.isPinned ?? false, // <-- Handle isPinned on update
               },
              create: {
                   userId,
                   websiteId: website.id,
                   name: websiteData.name,
                   interval: websiteData.interval,
                   alertThreshold: websiteData.alertThreshold,
                   alertEnabled: websiteData.alertEnabled ?? false,
                   notifyEmail: websiteData.notifyEmail,
                   isPinned: websiteData.isPinned ?? false, // <-- Handle isPinned on create
              },
              include: { website: true } // Include for mapping return value
          });

          // Update global interval if user interval was set/changed
          if (websiteData.interval !== undefined) {
              updateGlobalInterval(website.id).catch(err => console.error("Error updating global interval post-add:", err));
          }

          return websiteUser;
      });

      return mapPrismaWebsiteUserToShared(websiteUserPrisma)!; // Mapper accepts 'any'

  } catch (error) {
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
          console.log(`[User Website] Removed website ${websiteId} from user ${userId}`);
          // Trigger interval update after removal
          updateGlobalInterval(websiteId).catch(err => console.error("Error updating global interval post-remove:", err));
      });
  } catch (error: any) {
       if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          console.warn(`WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for deletion (already removed?).`);
       } else {
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
               // mode: 'insensitive' // Uncomment if DB supports it and you need case-insensitivity
          }
      },
      take: limit,
      orderBy: { url: 'asc' }
  });

  return websitesPrisma.map(w => mapPrismaWebsiteToShared(w)!);
}