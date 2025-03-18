// server/src/services/websiteService.ts
import { PrismaClient } from "@prisma/client";
import {CreateWebsiteBody} from "../types";

const prisma = new PrismaClient();



export const getWebsitesForUser = async (userId: number) => {
  return await prisma.website.findMany({
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
    },
  });
};

// New: Get monitoring results for a specific website
// export const getMonitoringResultsForWebsite = async (websiteId: number) => {
//   return await prisma.monitoringResult.findMany({
//     where: { websiteId },
//     orderBy: { timestamp: 'desc' } // most recent first
//   });
// };
