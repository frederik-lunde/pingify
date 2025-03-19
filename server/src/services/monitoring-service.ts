import axios from 'axios';
import { performance } from 'perf_hooks';
import { PrismaClient, Website, MonitoringResult } from '@prisma/client';
import { TIMEOUT_MS } from '../config/config';
import { processAlerts } from './alert-service';

const prisma = new PrismaClient();

interface MonitoringResponse {
  responseTime: number | null;
  isAvailable: boolean;
  statusCode: number | null;
  errorMessage: string | null;
}

interface ResultsQueryOptions {
  limit?: number;
  from?: Date;
  to?: Date;
}

interface WebsiteStats {
  websiteId: number;
  websiteName: string;
  url: string;
  uptime: number;
  averageResponseTime: number;
  totalChecks: number;
  lastCheck: Date | null;
  consecutiveFailures: number;
}

/**
 * Performs the actual HTTP request to check a website's status
 */
async function performWebsiteCheck(url: string): Promise<MonitoringResponse> {
  const start = performance.now();
  let responseTime: number | null = null;
  let isAvailable = false;
  let statusCode: number | null = null;
  let errorMessage: string | null = null;

  try {
    const response = await axios.get(url, {
      timeout: TIMEOUT_MS,
      headers: {
        'User-Agent': 'Website-Monitor/1.0'
      },
      validateStatus: () => true, // Don't throw on any status code
    });
    
    responseTime = Math.round(performance.now() - start);
    statusCode = response.status;
    isAvailable = statusCode >= 200 && statusCode < 400;
  } catch (error: any) {
    responseTime = Math.round(performance.now() - start);
    isAvailable = false;
    
    if (error.response) {
      statusCode = error.response.status;
      errorMessage = `HTTP Error: ${statusCode}`;
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timed out';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'DNS lookup failed';
    } else {
      errorMessage = error.message || 'Unknown error';
    }
  }

  return {
    responseTime,
    isAvailable,
    statusCode,
    errorMessage
  };
}

/**
 * Saves the monitoring result to the database
 */
async function saveMonitoringResult(
  websiteId: number, 
  result: MonitoringResponse
): Promise<MonitoringResult> {
  const { responseTime, isAvailable, statusCode, errorMessage } = result;
  
  return prisma.monitoringResult.create({
    data: {
      websiteId,
      responseTime,
      isAvailable,
      statusCode,
      errorMessage,
    },
  });
}

/**
 * Updates the website's lastChecked timestamp
 */
async function updateLastChecked(websiteId: number): Promise<void> {
  await prisma.website.update({
    where: { id: websiteId },
    data: { lastChecked: new Date() }
  });
}

/**
 * Checks a single website and records the result
 */
export async function checkWebsite(website: Website): Promise<void> {
  console.log(`Checking website: ${website.url}`);
  
  try {
    // Perform the actual health check
    const result = await performWebsiteCheck(website.url);
    
    // Save the result to the database
    await saveMonitoringResult(website.id, result);
    
    // Update the lastChecked timestamp
    await updateLastChecked(website.id);
    
    // Process alerts if needed
    if (website.alertEnabled) {
      await processAlerts(
        website, 
        result.isAvailable, 
        result.responseTime, 
        result.statusCode, 
        result.errorMessage
      );
    }
  } catch (error: any) {
    console.error(`Failed to process monitoring for ${website.url}`, error.message);
  }
}

/**
 * Gets the latest monitoring result ID for a website
 */
export async function getLatestResultId(websiteId: number): Promise<number> {
  const result = await prisma.monitoringResult.findFirst({
    where: { websiteId },
    orderBy: { checkedAt: 'desc' },
    select: { id: true },
  });
  return result?.id || 0;
}

/**
 * Gets monitoring results for a specific website
 */
export async function getMonitoringResultsForWebsite(websiteId: number, limit = 100) {
  return prisma.monitoringResult.findMany({
    where: { websiteId },
    orderBy: { checkedAt: 'desc' },
    take: limit,
  });
}

/**
 * Get all monitoring results with optional filtering
 */
export async function getAllResults(options: ResultsQueryOptions = {}) {
  const { limit = 100, from, to } = options;
  
  const whereClause: any = {};
  
  if (from || to) {
    whereClause.checkedAt = {};
    if (from) whereClause.checkedAt.gte = from;
    if (to) whereClause.checkedAt.lte = to;
  }
  
  return prisma.monitoringResult.findMany({
    where: whereClause,
    orderBy: { checkedAt: 'desc' },
    take: limit,
    include: {
      website: {
        select: {
          name: true,
          url: true
        }
      }
    }
  });
}

/**
 * Get monitoring results for a specific website with filtering
 */
export async function getResultsByWebsite(websiteId: number, options: ResultsQueryOptions = {}) {
  const { limit = 100, from, to } = options;
  
  const whereClause: any = {
    websiteId
  };
  
  if (from || to) {
    whereClause.checkedAt = {};
    if (from) whereClause.checkedAt.gte = from;
    if (to) whereClause.checkedAt.lte = to;
  }
  
  return prisma.monitoringResult.findMany({
    where: whereClause,
    orderBy: { checkedAt: 'desc' },
    take: limit
  });
}

/**
 * Calculate uptime percentage for a given period
 */
export async function calculateUptime(websiteId: number, days = 7): Promise<number> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const results = await prisma.monitoringResult.findMany({
    where: {
      websiteId,
      checkedAt: {
        gte: startDate
      }
    },
    select: {
      isAvailable: true
    }
  });
  
  if (results.length === 0) return 0;
  
  const successfulChecks = results.filter(r => r.isAvailable).length;
  return (successfulChecks / results.length) * 100;
}

/**
 * Get average response time for a website
 */
export async function getAverageResponseTime(websiteId: number, days = 7): Promise<number> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const result = await prisma.monitoringResult.aggregate({
    where: {
      websiteId,
      checkedAt: {
        gte: startDate
      },
      isAvailable: true,
      responseTime: {
        not: null
      }
    },
    _avg: {
      responseTime: true
    }
  });
  
  return result._avg.responseTime || 0;
}

/**
 * Get consecutive failures for a website
 */
export async function getConsecutiveFailures(websiteId: number): Promise<number> {
  const results = await prisma.monitoringResult.findMany({
    where: {
      websiteId
    },
    orderBy: {
      checkedAt: 'desc'
    },
    take: 100, // Limit to prevent querying too many records
    select: {
      isAvailable: true
    }
  });
  
  let count = 0;
  for (const result of results) {
    if (!result.isAvailable) {
      count++;
    } else {
      break;
    }
  }
  
  return count;
}

/**
 * Get detailed stats for a specific website
 */
export async function getWebsiteStats(websiteId: number, period = '7d'): Promise<WebsiteStats> {
  // Convert period string to days
  const days = period.endsWith('d') 
    ? parseInt(period.slice(0, -1)) 
    : period.endsWith('h') 
      ? parseInt(period.slice(0, -1)) / 24 
      : 7;
  
  const website = await prisma.website.findUnique({
    where: { id: websiteId }
  });
  
  if (!website) {
    throw new Error(`Website with ID ${websiteId} not found`);
  }
  
  const [uptime, averageResponseTime, lastResult, consecutiveFailures] = await Promise.all([
    calculateUptime(websiteId, days),
    getAverageResponseTime(websiteId, days),
    prisma.monitoringResult.findFirst({
      where: { websiteId },
      orderBy: { checkedAt: 'desc' }
    }),
    getConsecutiveFailures(websiteId)
  ]);
  
  const totalChecks = await prisma.monitoringResult.count({
    where: {
      websiteId,
      checkedAt: {
        gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      }
    }
  });
  
  return {
    websiteId,
    websiteName: website.name,
    url: website.url,
    uptime,
    averageResponseTime,
    totalChecks,
    lastCheck: lastResult?.checkedAt || null,
    consecutiveFailures
  };
}

/**
 * Get overview statistics for all websites
 */
export async function getOverallStats(period = '7d'): Promise<{
  totalWebsites: number;
  activeWebsites: number;
  websiteStats: WebsiteStats[];
  overallUptime: number;
  overallResponseTime: number;
}> {
  const days = period.endsWith('d') 
    ? parseInt(period.slice(0, -1)) 
    : period.endsWith('h') 
      ? parseInt(period.slice(0, -1)) / 24 
      : 7;
  
  const websites = await prisma.website.findMany({
    where: {
      isActive: true
    }
  });
  
  const websiteStats = await Promise.all(
    websites.map(website => getWebsiteStats(website.id, period))
  );
  
  const totalWebsites = await prisma.website.count();
  const activeWebsites = await prisma.website.count({
    where: { isActive: true }
  });
  
  // Calculate overall metrics
  const overallUptime = websiteStats.length
    ? websiteStats.reduce((sum, stat) => sum + stat.uptime, 0) / websiteStats.length
    : 0;
    
  const overallResponseTime = websiteStats.length
    ? websiteStats.reduce((sum, stat) => sum + stat.averageResponseTime, 0) / websiteStats.length
    : 0;
  
  return {
    totalWebsites,
    activeWebsites,
    websiteStats,
    overallUptime,
    overallResponseTime
  };
}