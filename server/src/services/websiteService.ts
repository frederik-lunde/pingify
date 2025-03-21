import { PrismaClient, Website } from '@prisma/client';
import { ResultsManager } from './monitoringService';
import { CreateWebsiteDTO } from '../types';

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
export async function getWebsitesForUser(userId: number): Promise<Website[]> {
  const websiteUsers = await prisma.websiteUser.findMany({
    where: { userId },
    include: { website: true }
  });
  
  return websiteUsers.map(wu => wu.website);
}

/**
 * Get website by ID
 */
export async function getWebsiteById(id: number): Promise<Website | null> {
  return prisma.website.findUnique({
    where: { id },
  });
}

/**
 * Get website by URL (exact match)
 */
export async function getWebsiteByUrl(url: string): Promise<Website | null> {
  return prisma.website.findFirst({
    where: { url },
  });
}

/**
 * Create a new website
 */
export async function createWebsite(data: CreateWebsiteDTO): Promise<Website> {
  return prisma.website.create({
    data: {
      name: data.name,
      url: data.url,
      interval: data.interval,
      isActive: data.isActive ?? true,
      alertEnabled: data.alertEnabled ?? false,
      alertThreshold: data.alertThreshold,
      notifyEmail: data.notifyEmail,
    },
  });
}

/**
 * Update a website
 */
export async function updateWebsite(id: number, data: Partial<CreateWebsiteDTO>): Promise<Website> {
  return prisma.website.update({
    where: { id },
    data,
  });
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
export async function addWebsiteToUser(userId: number, websiteData: CreateWebsiteDTO): Promise<Website> {
  let website = await getWebsiteByUrl(websiteData.url);
  
  // If website doesn't exist, create it
  if (!website) {
    website = await createWebsite(websiteData);
  }
  
  // Check if relationship already exists
  const existing = await prisma.websiteUser.findUnique({
    where: {
      userId_websiteId: {
        userId,
        websiteId: website.id
      }
    }
  });
  
  // If not already linked, create the relationship
  if (!existing) {
    await prisma.websiteUser.create({
      data: {
        userId,
        websiteId: website.id
      }
    });
  }
  
  return website;
}

/**
 * Remove a website from a user's dashboard
 */
export async function removeWebsiteFromUser(userId: number, websiteId: number): Promise<void> {
  await prisma.websiteUser.delete({
    where: {
      userId_websiteId: {
        userId,
        websiteId
      }
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