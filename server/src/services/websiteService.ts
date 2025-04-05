// server/src/services/websiteService.ts
import {
  PrismaClient,
  Website as PrismaWebsite,         // Alias for internal use
  WebsiteUser as PrismaWebsiteUser, // Alias for internal use
  Prisma
} from '@prisma/client';
import prisma from '../prisma/prismaClient'; // Adjust the path if needed

// --- Import SHARED Types ---
// Replace '@shared/types' with your actual path alias or relative path
import {
  CreateWebsiteDTO,    // Keep this if used internally/admin
  AddWebsiteUserDTO as SharedAddWebsiteUserDTO, // Alias the shared DTO for adding
  Website,             // Shared Website type (string dates)
  WebsiteUser,         // Shared WebsiteUser type (string dates, nested Website)
  UpdateWebsiteUserDTO // Shared DTO for updating user settings
} from '../types';


/**
* Get all websites (admin function).
* Returns Prisma types. Controller should map to shared 'Website' if needed.
*/
export async function getAllWebsites(): Promise<PrismaWebsite[]> {
return prisma.website.findMany({
  orderBy: { createdAt: 'desc' },
});
}

/**
* Get websites for a specific user, including nested Website data.
* Returns data conforming to the shared 'WebsiteUser' type array.
*/
export async function getWebsitesForUser(userId: number): Promise<WebsiteUser[]> {
  // Fetch Prisma types with relation
  const websiteUsersPrisma = await prisma.websiteUser.findMany({
      where: { userId },
      include: { website: true }, // Include the nested website data
      orderBy: { website: { url: 'asc' } }
  });

  // Map Prisma results to the shared WebsiteUser type
  return websiteUsersPrisma.map(wu => {
      // Map nested website (handle if somehow null)
      const sharedWebsiteNested = wu.website ? {
          id: wu.website.id,
          url: wu.website.url,
          isActive: wu.website.isActive,
          lastChecked: wu.website.lastChecked?.toISOString() ?? null, // Date -> string or null
          globalInterval: wu.website.globalInterval,
          createdAt: wu.website.createdAt?.toISOString(), // Date -> string (handle optional)
          updatedAt: wu.website.updatedAt?.toISOString(), // Date -> string (handle optional)
      } : undefined; // Or handle error if website is unexpectedly null

      return {
          // Base WebsiteUser fields
          id: wu.id,
          userId: wu.userId,
          websiteId: wu.websiteId,
          name: wu.name,
          interval: wu.interval,
          alertEnabled: wu.alertEnabled,
          alertThreshold: wu.alertThreshold,
          notifyEmail: wu.notifyEmail,
          createdAt: wu.createdAt.toISOString(), // createdAt exists on WebsiteUserPrisma
          website: sharedWebsiteNested!, // Use non-null assertion if include guarantees it exists
      };
  });
}


/**
* Get website by ID.
* Returns Prisma type. Controller should map if needed.
*/
export async function getWebsiteById(id: number): Promise<PrismaWebsite | null> {
return prisma.website.findUnique({
  where: { id }
});
}

/**
* Get website by URL (exact match).
* Returns Prisma type. Controller should map if needed.
*/
export async function getWebsiteByUrl(url: string): Promise<PrismaWebsite | null> {
return prisma.website.findUnique({
  where: { url },
});
}

/**
* Get user's website configuration by website ID, including nested website data.
* Returns data conforming to the shared 'WebsiteUser' type or null.
*/
export async function getUserWebsiteById(userId: number, websiteId: number): Promise<WebsiteUser | null> {
// Fetch Prisma type with relation
// Use Prisma types for the fetch result
const userWebsitePrisma = await prisma.websiteUser.findUnique({
  where: { userId_websiteId: { userId, websiteId } },
  include: { website: true } // Include nested PrismaWebsite
});

if (!userWebsitePrisma) {
    return null;
}

 // Map nested website (handle if somehow null)
 const sharedWebsiteNested = userWebsitePrisma.website ? {
      id: userWebsitePrisma.website.id,
      url: userWebsitePrisma.website.url,
      isActive: userWebsitePrisma.website.isActive,
      lastChecked: userWebsitePrisma.website.lastChecked?.toISOString() ?? null, // Date -> string or null
      globalInterval: userWebsitePrisma.website.globalInterval,
      createdAt: userWebsitePrisma.website.createdAt?.toISOString(), // Date -> string (handle optional)
      updatedAt: userWebsitePrisma.website.updatedAt?.toISOString(), // Date -> string (handle optional)
  } : undefined; // Or handle error if website is unexpectedly null

// Map to shared WebsiteUser type
return {
    // Map fields from PrismaWebsiteUser
    id: userWebsitePrisma.id,
    userId: userWebsitePrisma.userId,
    websiteId: userWebsitePrisma.websiteId,
    name: userWebsitePrisma.name,
    interval: userWebsitePrisma.interval,
    alertEnabled: userWebsitePrisma.alertEnabled,
    alertThreshold: userWebsitePrisma.alertThreshold,
    notifyEmail: userWebsitePrisma.notifyEmail,
    createdAt: userWebsitePrisma.createdAt.toISOString(), // Date -> string
    website: sharedWebsiteNested!, // Use non-null assertion if include guarantees it exists
};
}


/**
* Create a new website (core entity). Internal function.
* Returns Prisma type.
*/
// Use backend-specific CreateWebsiteDTO if different from shared
export async function createWebsite(data: CreateWebsiteDTO): Promise<PrismaWebsite> {
return prisma.website.create({
  data: {
    url: data.url,
    globalInterval: data.interval || 300,
    isActive: true,
  },
});
}

/**
* Updates the global interval for a website. Internal helper.
*/
export async function updateGlobalInterval(websiteId: number): Promise<void> {
const websiteUsers = await prisma.websiteUser.findMany({
  where: { websiteId }, select: { interval: true }
});
const intervals = websiteUsers.map(wu => wu.interval).filter((i): i is number => i !== null && i > 0);
if (intervals.length === 0) {
    console.warn(`No valid user intervals found for website ${websiteId}. Global interval not updated.`);
    // Optionally reset to default here if desired
    // await prisma.website.update({ where: { id: websiteId }, data: { globalInterval: 300 } });
    return;
}
const minInterval = Math.min(...intervals);
const currentWebsite = await prisma.website.findUnique({ where: { id: websiteId }, select: { globalInterval: true }});
// Only update if the interval has actually changed
if (currentWebsite && currentWebsite.globalInterval !== minInterval) {
    await prisma.website.update({
        where: { id: websiteId }, data: { globalInterval: minInterval }
    });
    console.log(`Updated global interval for website ${websiteId} to ${minInterval} seconds.`);
}
}

/**
* Update a website's core properties (e.g., URL, isActive - typically an admin action).
* Returns Prisma type. Controller should map if needed.
*/
export async function updateWebsiteCore(id: number, data: Partial<{ url: string; isActive?: boolean }>): Promise<PrismaWebsite> {
return prisma.website.update({ where: { id }, data });
}

/**
* Update a user's specific configuration/settings for a website they monitor.
* Expects the shared UpdateWebsiteUserDTO. Returns the updated PrismaWebsiteUser type.
*/
export async function updateUserWebsite(
userId: number,
websiteId: number,
data: UpdateWebsiteUserDTO // Use shared DTO for input shape
): Promise<PrismaWebsiteUser> { // Returns Prisma type (controller can map if needed)

  const prismaUpdateData: Prisma.WebsiteUserUpdateInput = {};

  // Use explicit checks for undefined before assigning
  if (data.name !== undefined) prismaUpdateData.name = data.name;
  if (data.interval !== undefined) prismaUpdateData.interval = data.interval;
  if (data.alertThreshold !== undefined) prismaUpdateData.alertThreshold = data.alertThreshold;
  if (data.notifyEmail !== undefined) prismaUpdateData.notifyEmail = data.notifyEmail;

  // *** CORRECTED: Handle boolean update correctly ***
  // Only include alertEnabled in update if it's explicitly true or false
  if (typeof data.alertEnabled === 'boolean') {
      prismaUpdateData.alertEnabled = data.alertEnabled;
  }

  // Prevent updating with an empty object if no fields were provided in DTO
  if (Object.keys(prismaUpdateData).length === 0) {
      console.warn(`No update data provided for user ${userId}, website ${websiteId}. Skipping update.`);
      const existing = await prisma.websiteUser.findUniqueOrThrow({ where: { userId_websiteId: { userId, websiteId }}});
      return existing;
  }

  const result = await prisma.websiteUser.update({
      where: { userId_websiteId: { userId, websiteId } },
      data: prismaUpdateData,
  });

  // Recalculate global interval only if the user's interval was actually part of the update
  if (data.interval !== undefined) {
      await updateGlobalInterval(websiteId);
  }

  return result; // Return the updated Prisma object
}

/**
* Delete a website entirely (admin function - removes core Website and all relations).
* Returns Prisma type.
*/
export async function deleteWebsite(id: number): Promise<PrismaWebsite> {
// Note: Ensure cascade deletes are set up in your Prisma schema if you want
// related WebsiteUser, MonitoringResult, Alert records to be deleted automatically.
return prisma.website.delete({ where: { id } });
}

/**
* Toggle a website's active status globally (admin function).
* Returns Prisma type. Controller should map if needed.
*/
export async function toggleWebsiteStatus(id: number): Promise<PrismaWebsite> {
const website = await prisma.website.findUnique({ where: { id } });
if (!website) throw new Error(`Website with ID ${id} not found`);
return prisma.website.update({
  where: { id }, data: { isActive: !website.isActive },
});
}

/**
* Adds a website to a user's dashboard.
* Creates the core Website if it doesn't exist, otherwise links the existing one.
* Sets up the WebsiteUser relationship with the user's settings.
* Returns data conforming to the shared 'WebsiteUser' type.
*/
// Use aliased shared DTO for input, return shared type
export async function addWebsiteToUser(userId: number, websiteData: SharedAddWebsiteUserDTO): Promise<WebsiteUser> {
try {
  // Transaction uses Prisma types internally
  const websiteUserPrisma = await prisma.$transaction(async (tx) => {
      let website = await tx.website.upsert({
          where: { url: websiteData.url },
          update: { isActive: true }, // Ensure it's active if re-adding
          create: {
              url: websiteData.url,
              globalInterval: websiteData.interval || 300, // Use provided interval or default
              isActive: true,
          },
      });

      // Step 2: Create or Update the WebsiteUser relationship
      const websiteUser = await tx.websiteUser.upsert({
          where: { userId_websiteId: { userId, websiteId: website.id } },
          update: { // Update settings if user re-adds
              name: websiteData.name, // Use ?? null for explicit null setting if needed
              interval: websiteData.interval,
              alertThreshold: websiteData.alertThreshold,
              alertEnabled: websiteData.alertEnabled ?? false, // Default to false if not provided
              notifyEmail: websiteData.notifyEmail,
           },
          create: { // Create new relationship
               userId,
               websiteId: website.id,
               name: websiteData.name,
               interval: websiteData.interval,
               alertThreshold: websiteData.alertThreshold,
               alertEnabled: websiteData.alertEnabled ?? false, // Default to false
               notifyEmail: websiteData.notifyEmail,
          },
          include: { website: true } // Include nested website (PrismaWebsite) initially
      });

      // Step 3: Update the global interval based on all users for this website
      await updateGlobalInterval(website.id); // Use the helper function

      // Re-fetch website in case globalInterval was updated by the helper
      const finalWebsite = await tx.website.findUniqueOrThrow({ where: { id: website.id }});
      websiteUser.website = finalWebsite; // Attach potentially updated website

      return websiteUser; // Return PrismaWebsiteUser & { website: PrismaWebsite }
  }); // End Transaction

  // Map the final Prisma result to the shared WebsiteUser type
   const sharedWebsiteNested = websiteUserPrisma.website ? {
        id: websiteUserPrisma.website.id,
        url: websiteUserPrisma.website.url,
        isActive: websiteUserPrisma.website.isActive,
        lastChecked: websiteUserPrisma.website.lastChecked?.toISOString() ?? null,
        globalInterval: websiteUserPrisma.website.globalInterval,
        createdAt: websiteUserPrisma.website.createdAt?.toISOString(),
        updatedAt: websiteUserPrisma.website.updatedAt?.toISOString(),
    } : undefined; // Should exist

  return {
      id: websiteUserPrisma.id,
      userId: websiteUserPrisma.userId,
      websiteId: websiteUserPrisma.websiteId,
      name: websiteUserPrisma.name,
      interval: websiteUserPrisma.interval,
      alertEnabled: websiteUserPrisma.alertEnabled,
      alertThreshold: websiteUserPrisma.alertThreshold,
      notifyEmail: websiteUserPrisma.notifyEmail,
      createdAt: websiteUserPrisma.createdAt.toISOString(),
      website: sharedWebsiteNested!, // Use non-null assertion
  };

} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      console.warn(`Unique constraint violation for user ${userId} and URL ${websiteData.url}. Attempting to fetch existing.`);
      try {
          const existingWebsite = await getWebsiteByUrl(websiteData.url);
          if (existingWebsite) {
              const existingUserWebsite = await getUserWebsiteById(userId, existingWebsite.id);
              if (existingUserWebsite) return existingUserWebsite; // Return the existing record (already mapped)
          }
      } catch (fetchError) {
          console.error("Error fetching existing record after P2002:", fetchError);
      }
  }
  console.error("Error in addWebsiteToUser:", error);
  throw error; // Re-throw other errors
}
}


/**
* Removes a website from a specific user's dashboard (deletes the WebsiteUser relation).
* Returns void.
*/
export async function removeWebsiteFromUser(userId: number, websiteId: number): Promise<void> {
// Transaction logic remains the same, using Prisma types internally
await prisma.$transaction(async (tx) => {
  try {
      await tx.websiteUser.delete({ where: { userId_websiteId: { userId, websiteId } } });
      console.log(`Removed website ${websiteId} from user ${userId}`);
  } catch (error: any) {
       if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          // Record to delete not found - potentially already deleted, safe to ignore
          console.warn(`WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for deletion.`);
       } else {
           throw error; // Re-throw unexpected errors
       }
  }
  // Recalculate global interval regardless of whether delete succeeded or record was missing
  await updateGlobalInterval(websiteId);
});
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
* Returns array of shared Website type.
*/
export async function searchWebsites(searchTerm: string, limit = 10): Promise<Website[]> { // Return shared type
if (!searchTerm || searchTerm.trim() === '') return [];

// Fetch Prisma types
const websitesPrisma = await prisma.website.findMany({
  where: { url: { contains: searchTerm /* mode: 'insensitive' - Requires DB/Prisma support */ } },
  take: limit, orderBy: { url: 'asc' }
});

// Map to shared Website type
return websitesPrisma.map(w => ({
    id: w.id,
    url: w.url,
    isActive: w.isActive,
    lastChecked: w.lastChecked?.toISOString() ?? null, // Date -> string or null
    globalInterval: w.globalInterval,
    createdAt: w.createdAt?.toISOString(), // Date -> string
    updatedAt: w.updatedAt?.toISOString(), // Date -> string
}));
}