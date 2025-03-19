import { PrismaClient, Website } from '@prisma/client';
import { getMonitoringResultsForWebsite } from './monitoring-service';

const prisma = new PrismaClient();

export interface CreateWebsiteDTO {
  name: string;
  url: string;
  interval: number;
  isActive: boolean;
  alertEnabled?: boolean;
  alertThreshold?: number;
  notifyEmail?: string;
}

/**
 * Get all websites
 */
export async function getAllWebsites(): Promise<Website[]> {
  return prisma.website.findMany({
    orderBy: { createdAt: 'desc' },
  });
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
 * Create a new website
 */
export async function createWebsite(data: CreateWebsiteDTO): Promise<Website> {
  // Ensure URL has a protocol
  if (!data.url.startsWith('http://') && !data.url.startsWith('https://')) {
    data.url = `https://${data.url}`;
  }
  
  return prisma.website.create({
    data: {
      name: data.name,
      url: data.url,
      interval: data.interval,
      isActive: data.isActive,
      alertEnabled: data.alertEnabled || false,
      alertThreshold: data.alertThreshold,
      notifyEmail: data.notifyEmail,
    },
  });
}

/**
 * Update a website
 */
export async function updateWebsite(id: number, data: Partial<CreateWebsiteDTO>): Promise<Website> {
  // Handle URL protocol if URL is being updated
  if (data.url && !data.url.startsWith('http://') && !data.url.startsWith('https://')) {
    data.url = `https://${data.url}`;
  }
  
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
  return getMonitoringResultsForWebsite(id, limit);
}