import { PrismaClient, Website, WebsiteUser } from '@prisma/client';
import { ResultsManager } from './monitoringService';
import { CreateWebsiteDTO, WebsiteUserDTO } from '../types';

const prisma = new PrismaClient();

/**
 * Get all websites
 */
export async function getAllWebsites(): Promise<Website[]> {
  return prisma.website.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get websites for a specific user
 */
export async function getWebsitesForUser(userId: number): Promise<WebsiteUser[]> {
  return prisma.websiteUser.findMany({
    where: { userId },
    include: { website: true }
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
 * Get user's website configuration by website ID
 */
export async function getUserWebsiteById(userId: number, websiteId: number): Promise<WebsiteUser | null> {
  return prisma.websiteUser.findUnique({
    where: {
      userId_websiteId: {
        userId,
        websiteId
      }
    },
    include: { website: true }
  });
}

/**
 * Create a new website
 */
export async function createWebsite(data: CreateWebsiteDTO): Promise<Website> {
  return prisma.website.create({
    data: {
      url: data.url,
      globalInterval: data.interval || 300, // Default to 5 minutes if not specified
      isActive: true,
    },
  });
}

/**
 * Updates the global interval for a website based on all users' preferences
 */
export async function updateGlobalInterval(websiteId: number): Promise<void> {
  const websiteUsers = await prisma.websiteUser.findMany({
    where: { websiteId },
    select: { interval: true }
  });
  
  if (websiteUsers.length === 0) {
    return;
  }
  
  // Filter out any null intervals and provide a default if needed
  const intervals = websiteUsers
    .map(wu => wu.interval)
    .filter((interval): interval is number => interval !== null);
  
  // If no valid intervals, use a default
  if (intervals.length === 0) {
    return;
  }
  
  // Use the minimum interval (most frequent checks)
  const minInterval = Math.min(...intervals);
  
  // Update the global interval
  await prisma.website.update({
    where: { id: websiteId },
    data: { globalInterval: minInterval }
  });
}

/**
 * Update a website's core properties
 */
export async function updateWebsiteCore(id: number, data: Partial<{ url: string }>): Promise<Website> {
  return prisma.website.update({
    where: { id },
    data,
  });
}

/**
 * Update a user's website configuration
 */
export async function updateUserWebsite(
  userId: number, 
  websiteId: number, 
  data: Partial<WebsiteUserDTO>
): Promise<WebsiteUser> {
  const result = await prisma.websiteUser.update({
    where: {
      userId_websiteId: {
        userId,
        websiteId
      }
    },
    data,
  });
  
  // Update the global interval if the user's interval changed
  if (data.interval) {
    await updateGlobalInterval(websiteId);
  }
  
  return result;
}

/**
 * Delete a website
 */
export async function deleteWebsite(id: number): Promise<Website> {
  return prisma.website.delete({
    where: { id },
  });
}

/**
 * Toggle a website's active status
 */
export async function toggleWebsiteStatus(id: number): Promise<Website> {
  const website = await prisma.website.findUnique({ where: { id } });
  
  if (!website) {
    throw new Error(`Website with ID ${id} not found`);
  }
  
  return prisma.website.update({
    where: { id },
    data: { isActive: !website.isActive },
  });
}

/**
 * Get website monitoring results
 */
export async function getWebsiteResults(id: number, limit = 100) {
  return ResultsManager.getResultsForWebsite(id, limit);
}

/**
 * Add a website to a user's dashboard 
 * Creates the website if it doesn't exist
 */
export async function addWebsiteToUser(userId: number, websiteData: WebsiteUserDTO): Promise<WebsiteUser> {
  try {
    // Step 1: Check if website exists by URL
    let website = await prisma.website.findUnique({
      where: { url: websiteData.url },
    });
    
    // Step 2: If website doesn't exist, create it
    if (!website) {
      website = await prisma.website.create({
        data: {
          url: websiteData.url,
          globalInterval: websiteData.interval,
          isActive: true, // Activate when first user adds it
        },
      });
    } else if (!website.isActive) {
      // Step 3: If website exists but is inactive, activate it
      website = await prisma.website.update({
        where: { id: website.id },
        data: { isActive: true }
      });
    }
    
    // Step 4: Check if relationship already exists
    const existing = await prisma.websiteUser.findUnique({
      where: {
        userId_websiteId: {
          userId,
          websiteId: website.id
        }
      }
    });
    
    // Step 5: If already exists, return it
    if (existing) {
      return existing;
    }
    
    // Step 6: Create the new relationship with user-specific settings
    const websiteUser = await prisma.websiteUser.create({
      data: {
        userId,
        websiteId: website.id,
        name: websiteData.name,
        interval: websiteData.interval,
        alertThreshold: websiteData.alertThreshold,
        alertEnabled: websiteData.alertEnabled || false,
        notifyEmail: websiteData.notifyEmail,
      }
    });
    
    // Step 7: Update global interval based on this new user
    await updateGlobalInterval(website.id);
    
    return websiteUser;
  } catch (error) {
    console.error("Error in addWebsiteToUser:", error);
    throw error;
  }
}

/**
 * Remove a website from a user's dashboard
 * Not working
 */
export async function removeWebsiteFromUser(userId: number, websiteId: number): Promise<void> {
  // Start a transaction to ensure data consistency
  await prisma.$transaction(async (tx) => {
    // Remove the relationship
    await tx.websiteUser.delete({
      where: {
        userId_websiteId: {
          userId,
          websiteId
        }
      }
    });
    
    // Check if any users are still monitoring this website
    const remainingUsers = await tx.websiteUser.count({
      where: { websiteId }
    });
    
    // If no users are monitoring, deactivate the website
    if (remainingUsers === 0) {
      await tx.website.update({
        where: { id: websiteId },
        data: { isActive: false }
      });
    } else {
      // Otherwise, update the global interval
      await updateGlobalInterval(websiteId);
    }
  });
}

/**
 * Check if a user has a website in their dashboard
 */
export async function hasUserWebsite(userId: number, websiteId: number): Promise<boolean> {
  const access = await prisma.websiteUser.findUnique({
    where: {
      userId_websiteId: {
        userId,
        websiteId
      }
    }
  });
  
  return !!access;
}

/**
 * Get alerts for a specific user (filtered by their websites)
 */
export async function getAlertsForUser(userId: number, limit = 50) {
  return prisma.alert.findMany({
    where: {
      website: {
        websiteUsers: {
          some: {
            userId
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      website: true
    }
  });
}

export async function searchWebsites(searchTerm: string, limit = 5): Promise<Website[]> {
  return prisma.website.findMany({
    where: {
      url: {
        contains: searchTerm
      }
    },
    take: limit
  });
}