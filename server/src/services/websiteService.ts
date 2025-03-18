// server/src/services/websiteService.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CreateWebsiteBody {
  name: string;
  url: string;
  interval?: number;
  isActive?: boolean;
  userId: number;
}

export const getWebsitesForUser = async (userId: number) => {
  return await prisma.website.findMany({
    where: { userId },
    include: { monitoringResults: true } // optionally include monitoring data
  });
};

export const createWebsite = async (data: CreateWebsiteBody) => {
  return await prisma.website.create({
    data: {
      name: data.name,
      url: data.url,
      interval: data.interval || 300,
      isActive: data.isActive !== undefined ? data.isActive : true,
      userId: data.userId,
    },
  });
};

// New: Get monitoring results for a specific website
export const getMonitoringResultsForWebsite = async (websiteId: number) => {
  return await prisma.monitoringResult.findMany({
    where: { websiteId },
    orderBy: { timestamp: 'desc' } // most recent first
  });
};
