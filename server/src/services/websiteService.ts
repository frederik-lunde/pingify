// server/src/services/websiteService.ts
import { PrismaClient, Website, WebsiteUser as PrismaWebsiteUser, Prisma } from '@prisma/client';
import { CreateWebsiteDTO, WebsiteUserDTO, UserWebsite, WebsiteUpdateDTO } from '../types';
import prisma from '../prisma/prismaClient'; // Adjust the path if needed


/**
 * Get all websites (admin function)
 */
export async function getAllWebsites(): Promise<Website[]> {
  return prisma.website.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get websites for a specific user, including nested Website data.
 */
export async function getWebsitesForUser(userId: number): Promise<UserWebsite[]> {
  return prisma.websiteUser.findMany({
    where: { userId },
    include: { website: true }, // Include the nested website data
    orderBy: { website: { url: 'asc' } } // Example sorting
  });
}

/**
 * Get website by ID
 */
export async function getWebsiteById(id: number): Promise<Website | null> {
  return prisma.website.findUnique({
    where: { id }
  });
}

/**
 * Get website by URL (exact match)
 */
export async function getWebsiteByUrl(url: string): Promise<Website | null> {
  return prisma.website.findUnique({
    where: { url },
  });
}

/**
 * Get user's website configuration by website ID, including nested website data.
 * Returns the combined UserWebsite type.
 */
export async function getUserWebsiteById(userId: number, websiteId: number): Promise<UserWebsite | null> {
  // Explicitly typing the return value helps consumers like the controller
  const userWebsite: UserWebsite | null = await prisma.websiteUser.findUnique({
    where: {
      // Use the @@unique field combination name here for unique lookups
      userId_websiteId: {
        userId,
        websiteId
      }
    },
    include: { website: true } // Crucial: ensures the 'website' property is fetched and included
  });
  return userWebsite;
}

/**
 * Create a new website (core entity)
 */
export async function createWebsite(data: CreateWebsiteDTO): Promise<Website> {
  return prisma.website.create({
    data: {
      url: data.url,
      // Use a sensible default global interval if none provided
      globalInterval: data.interval || 300, // Default to 5 minutes
      isActive: true, // Typically start as active when created
    },
  });
}

/**
 * Updates the global interval for a website based on the minimum interval set by any monitoring user.
 */
export async function updateGlobalInterval(websiteId: number): Promise<void> {
  const websiteUsers = await prisma.websiteUser.findMany({
    where: { websiteId },
    select: { interval: true } // Select only the interval field
  });

  // Filter out null intervals and convert to numbers
  const intervals = websiteUsers
    .map(wu => wu.interval)
    .filter((interval): interval is number => interval !== null && interval > 0); // Ensure interval is a positive number

  // If no users have set a specific interval, or the website is no longer monitored, maybe revert to default or do nothing
  if (intervals.length === 0) {
      // Option 1: Revert to a default global interval if desired
      // await prisma.website.update({ where: { id: websiteId }, data: { globalInterval: 300 } });
      // Option 2: Do nothing, leave the globalInterval as is
      console.warn(`No valid user intervals found for website ${websiteId}. Global interval not updated.`);
      return;
  }

  // Use the minimum interval (most frequent checks desired by any user)
  const minInterval = Math.min(...intervals);

  // Update the global interval only if it's different from the current one
  const currentWebsite = await prisma.website.findUnique({ where: { id: websiteId }, select: { globalInterval: true }});
  if (currentWebsite && currentWebsite.globalInterval !== minInterval) {
      await prisma.website.update({
          where: { id: websiteId },
          data: { globalInterval: minInterval }
      });
      console.log(`Updated global interval for website ${websiteId} to ${minInterval} seconds.`);
  }
}

/**
 * Update a website's core properties (e.g., URL - typically an admin action).
 */
export async function updateWebsiteCore(id: number, data: Partial<{ url: string }>): Promise<Website> {
  // Be cautious updating URLs, might need coordination if monitoring relies on it heavily
  return prisma.website.update({
    where: { id },
    data,
  });
}

/**
 * Update a user's specific configuration/settings for a website they monitor.
 */
export async function updateUserWebsite(
  userId: number,
  websiteId: number,
  // Use the specific DTO for updates
  data: WebsiteUpdateDTO
): Promise<PrismaWebsiteUser> { // Returns the updated PrismaWebsiteUser

    // Explicitly construct the data object for Prisma, mapping from the DTO
    const prismaUpdateData: Prisma.WebsiteUserUpdateInput = {};

    // Map only the fields provided in the DTO
    if (data.name !== undefined) {
        prismaUpdateData.name = data.name;
    }
    if (data.interval !== undefined) {
        prismaUpdateData.interval = data.interval;
    }
    if (data.alertThreshold !== undefined) {
        prismaUpdateData.alertThreshold = data.alertThreshold;
    }
    if (data.alertEnabled !== undefined && data.alertEnabled !== null) {
        prismaUpdateData.alertEnabled = data.alertEnabled;
    } else if (data.alertEnabled === null) {
       // Handle potential explicit null setting if schema allows/requires
    }
    if (data.notifyEmail !== undefined) {
        prismaUpdateData.notifyEmail = data.notifyEmail;
    }

    const result = await prisma.websiteUser.update({
        where: {
            // Use the @@unique constraint name for the 'where unique' clause
            userId_websiteId: {
                userId,
                websiteId
            }
        },
        // Pass the correctly typed data object
        data: prismaUpdateData,
    });

    // If the user's interval was part of the update data, recalculate the global interval
    if (data.interval !== undefined) {
        await updateGlobalInterval(websiteId);
    }

    return result;
}

/**
 * Delete a website entirely (admin function - removes core Website and all relations).
 */
export async function deleteWebsite(id: number): Promise<Website> {
  // Note: Prisma cascade deletes might handle related WebsiteUser, MonitoringResult, Alerts. Check your schema.
  return prisma.website.delete({
    where: { id },
  });
}

/**
 * Toggle a website's active status globally (admin function).
 */
export async function toggleWebsiteStatus(id: number): Promise<Website> {
  const website = await prisma.website.findUnique({ where: { id } });

  if (!website) {
    throw new Error(`Website with ID ${id} not found`);
  }

  return prisma.website.update({
    where: { id },
    data: { isActive: !website.isActive }, // Toggle the status
  });
}

/**
 * Adds a website to a user's dashboard.
 * Creates the core Website if it doesn't exist by URL, otherwise links the existing one.
 * Sets up the WebsiteUser relationship with the user's settings.
 */
export async function addWebsiteToUser(userId: number, websiteData: WebsiteUserDTO): Promise<UserWebsite> {
  try {
    // Use a transaction to ensure atomicity
    return await prisma.$transaction(async (tx) => {
        // Step 1: Find or Create the core Website entity based on URL
        let website = await tx.website.upsert({
            where: { url: websiteData.url },
            update: { isActive: true }, // Ensure active if exists
            create: {
                url: websiteData.url,
                globalInterval: websiteData.interval || 300,
                isActive: true,
            },
        });

        // Step 2: Create or Update the WebsiteUser relationship
        const websiteUser = await tx.websiteUser.upsert({
            where: { userId_websiteId: { userId, websiteId: website.id } },
            update: { // Update settings if user re-adds
                name: websiteData.name,
                interval: websiteData.interval,
                alertThreshold: websiteData.alertThreshold,
                alertEnabled: websiteData.alertEnabled ?? false,
                notifyEmail: websiteData.notifyEmail,
             },
            create: { // Create new relationship
                userId,
                websiteId: website.id,
                name: websiteData.name,
                interval: websiteData.interval,
                alertThreshold: websiteData.alertThreshold,
                alertEnabled: websiteData.alertEnabled ?? false,
                notifyEmail: websiteData.notifyEmail,
            },
            include: { website: true } // Include nested website
        });

        // Step 3: Update the global interval
        const websiteUsers = await tx.websiteUser.findMany({
            where: { websiteId: website.id }, select: { interval: true }
        });
        const intervals = websiteUsers.map(wu => wu.interval).filter((i): i is number => i !== null && i > 0);
        if (intervals.length > 0) {
            const minInterval = Math.min(...intervals);
             if (website.globalInterval !== minInterval) {
                await tx.website.update({
                    where: { id: website.id }, data: { globalInterval: minInterval }
                });
             }
        }

        return websiteUser;
    }); // End Transaction
  } catch (error) {
    console.error("Error in addWebsiteToUser:", error);
    throw error;
  }
}


/**
 * Removes a website from a specific user's dashboard (deletes the WebsiteUser relation).
 * If this was the last user monitoring the website, the core Website is marked as inactive.
 */
export async function removeWebsiteFromUser(userId: number, websiteId: number): Promise<void> {
  // Start a transaction to ensure data consistency
  await prisma.$transaction(async (tx) => {
    // Step 1: Delete the WebsiteUser relationship
    try {
        await tx.websiteUser.delete({
          where: {
            userId_websiteId: { userId, websiteId }
          }
        });
    } catch (error: any) {
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            console.warn(`WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for deletion.`);
         } else {
             throw error;
         }
    }

    // Step 2: Check if any other users are still monitoring this website
    const remainingUsersCount = await tx.websiteUser.count({
      where: { websiteId }
    });

    // Step 3: If no users remain, deactivate the core Website
    if (remainingUsersCount === 0) {
      await tx.website.update({
        where: { id: websiteId },
        data: { isActive: false } // Mark as inactive
      });
      console.log(`Deactivated website ${websiteId} as no users are monitoring it.`);
    } else {
      // Step 4: If users remain, recalculate the global interval
       const websiteUsers = await tx.websiteUser.findMany({
            where: { websiteId: websiteId }, select: { interval: true }
       });
       const intervals = websiteUsers.map(wu => wu.interval).filter((i): i is number => i !== null && i > 0);
       const currentWebsite = await tx.website.findUnique({ where: { id: websiteId }, select: { globalInterval: true }});
       let newGlobalInterval = currentWebsite?.globalInterval || 300;

       if (intervals.length > 0) {
           newGlobalInterval = Math.min(...intervals);
       } else {
           newGlobalInterval = 300; // Default if no users have interval set
       }
       if (currentWebsite && currentWebsite.globalInterval !== newGlobalInterval) {
            await tx.website.update({
                where: { id: websiteId }, data: { globalInterval: newGlobalInterval }
            });
       }
    }
  }); // End Transaction
}

/**
 * Check if a specific user has a specific website in their dashboard.
 */
export async function hasUserWebsite(userId: number, websiteId: number): Promise<boolean> {
  const count = await prisma.websiteUser.count({
    where: {
      // Use individual fields for general 'where' clauses
      userId: userId,
      websiteId: websiteId
    }
  });
  return count > 0;
}

/**
 * Search websites based on URL containing the search term.
 * Uses case-insensitive search if the database supports it (requires Prisma 5+ and compatible DB like MySQL 8+ or PostgreSQL).
 */
export async function searchWebsites(searchTerm: string, limit = 10): Promise<Website[]> {
  if (!searchTerm || searchTerm.trim() === '') {
      return [];
  }
  return prisma.website.findMany({
    where: {
      url: {
        contains: searchTerm,
      }
      // Optional: Add isActive filter?
      // isActive: true
    },
    take: limit,
    orderBy: {
        url: 'asc' // Order results alphabetically
    }
  });
}