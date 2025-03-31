//server\src\services\monitoringService.ts
import axios from 'axios';
import { performance } from 'perf_hooks';
import { PrismaClient, Website, MonitoringResult, WebsiteUser } from '@prisma/client';
import { TIMEOUT_MS } from '../config/config';
import { processAlerts } from './alertService';
import { MonitoringResponse, ResultsQueryOptions, WebsiteStatsData } from '../types';

const prisma = new PrismaClient();

// Website Checking
export class WebsiteMonitor {
  /**
   * Performs the actual HTTP request to check a website's status
   */
  static async performWebsiteCheck(url: string): Promise<MonitoringResponse> {
    const start = performance.now();
    let responseTime: number | null = null;
    let isAvailable = false;
    let statusCode: number | null = null;
    let errorMessage: string | null = null;

    try {
      const response = await axios.get(url, {
        timeout: TIMEOUT_MS,
        headers: { 'User-Agent': 'Website-Monitor/1.0' },
        validateStatus: () => true, // Don't throw on any status code
      });
      
      responseTime = Math.round(performance.now() - start);
      statusCode = response.status;
      isAvailable = statusCode >= 200 && statusCode < 400;
    } catch (error: any) {
      responseTime = Math.round(performance.now() - start);
      errorMessage = this.parseErrorMessage(error);
    }

    return { responseTime, isAvailable, statusCode, errorMessage };
  }

  private static parseErrorMessage(error: any): string {
    if (error.response) {
      return `HTTP Error: ${error.response.status}`;
    } else if (error.code === 'ECONNABORTED') {
      return 'Request timed out';
    } else if (error.code === 'ENOTFOUND') {
      return 'DNS lookup failed';
    }
    return error.message || 'Unknown error';
  }

  /**
   * Checks a single website and records the result
   */
  static async checkWebsite(website: Website): Promise<void> {
    console.log(`Checking website: ${website.url}`);
    
    try {
      // Perform the actual health check
      const result = await this.performWebsiteCheck(website.url);
      
      // Save the result and update website
      await ResultsManager.saveResult(website.id, result);
      
      // Get all users who have this website and have alerts enabled
      const websiteUsers = await prisma.websiteUser.findMany({
        where: { 
          websiteId: website.id,
          alertEnabled: true 
        }
      });
      
      // Process alerts for each user with their specific settings
      for (const websiteUser of websiteUsers) {
        await processAlerts(
          website,
          websiteUser,
          result.isAvailable, 
          result.responseTime, 
          result.statusCode, 
          result.errorMessage
        );
      }
    } catch (error: any) {
      console.error(`Failed to process monitoring for ${website.url}:`, error.message);
    }
  }
  
  /**
   * Get all active websites that need checking
   */
  static async getWebsitesToCheck(): Promise<Website[]> {
    return prisma.website.findMany({
      where: { 
        isActive: true,
        // Optional: Add time-based filtering here if needed
      }
    });
  }
}

// Results Management
export class ResultsManager {
  /**
   * Saves the monitoring result to the database
   */
  static async saveResult(
    websiteId: number, 
    result: MonitoringResponse
  ): Promise<MonitoringResult> {
    const { responseTime, isAvailable, statusCode, errorMessage } = result;
    
    // Update website's lastChecked timestamp
    await prisma.website.update({
      where: { id: websiteId },
      data: { lastChecked: new Date() }
    });
    
    // Create the monitoring result
    return prisma.monitoringResult.create({
      data: { websiteId, responseTime, isAvailable, statusCode, errorMessage }
    });
  }

  /**
   * Gets the latest monitoring result ID for a website
   */
  static async getLatestResultId(websiteId: number): Promise<number> {
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
  static async getResultsForWebsite(websiteId: number, limit = 100): Promise<MonitoringResult[]> {
    return prisma.monitoringResult.findMany({
      where: { websiteId },
      orderBy: { checkedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get all monitoring results with optional filtering
   */
  static async getAllResults(options: ResultsQueryOptions = {}): Promise<any[]> {
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
            url: true
          }
        }
      }
    });
  }

  /**
   * Get monitoring results for a specific website with filtering
   */
  static async getFilteredResultsByWebsite(
    websiteId: number, 
    options: ResultsQueryOptions = {}
  ): Promise<MonitoringResult[]> {
    const { limit = 100, from, to } = options;
    
    const whereClause: any = { websiteId };
    
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
   * Get monitoring results for a user's websites
   */
  static async getResultsForUser(
    userId: number,
    options: ResultsQueryOptions = {}
  ): Promise<MonitoringResult[]> {
    const { limit = 100, from, to } = options;
    
    const whereClause: any = {
      website: {
        websiteUsers: {
          some: {
            userId
          }
        }
      }
    };
    
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
          include: {
            websiteUsers: {
              where: { userId },
              select: { name: true }
            }
          }
        }
      }
    });
  }
}

// Statistics and Analysis
export class StatsCalculator {
  /**
   * Calculate uptime percentage for a given period
   */
  static async calculateUptime(websiteId: number, days = 7): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const results = await prisma.monitoringResult.findMany({
      where: {
        websiteId,
        checkedAt: { gte: startDate }
      },
      select: { isAvailable: true }
    });
    
    if (results.length === 0) return 0;
    
    const successfulChecks = results.filter(r => r.isAvailable).length;
    return (successfulChecks / results.length) * 100;
  }

  /**
   * Get average response time for a website
   */
  static async getAverageResponseTime(websiteId: number, days = 7): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const result = await prisma.monitoringResult.aggregate({
      where: {
        websiteId,
        checkedAt: { gte: startDate },
        isAvailable: true,
        responseTime: { not: null }
      },
      _avg: { responseTime: true }
    });
    
    return result._avg.responseTime || 0;
  }

  /**
   * Get consecutive failures for a website
   */
  static async getConsecutiveFailures(websiteId: number): Promise<number> {
    const results = await prisma.monitoringResult.findMany({
      where: { websiteId },
      orderBy: { checkedAt: 'desc' },
      take: 100, // Limit to prevent querying too many records
      select: { isAvailable: true }
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
   * Convert period string to days
   */
  private static periodToDays(period: string): number {
    if (period.endsWith('d')) {
      return parseInt(period.slice(0, -1));
    } else if (period.endsWith('h')) {
      return parseInt(period.slice(0, -1)) / 24;
    }
    return 7; // Default to 7 days
  }

  /**
   * Get detailed stats for a specific website
   */
  static async getWebsiteStats(
    websiteId: number, 
    userId?: number, 
    period = '7d'
  ): Promise<WebsiteStatsData> {
    const days = this.periodToDays(period);
    
    // Get the website basic info
    const website = await prisma.website.findUnique({
      where: { id: websiteId }
    });
    
    if (!website) {
      throw new Error(`Website with ID ${websiteId} not found`);
    }
    
    // Get user's custom name if userId is provided
    let websiteName = website.url;
    if (userId) {
      const userWebsite = await prisma.websiteUser.findUnique({
        where: {
          userId_websiteId: {
            userId,
            websiteId
          }
        }
      });
      
      if (userWebsite && userWebsite.name) {
        websiteName = userWebsite.name;
      }
    }
    
    const [uptime, averageResponseTime, lastResult, consecutiveFailures] = await Promise.all([
      this.calculateUptime(websiteId, days),
      this.getAverageResponseTime(websiteId, days),
      prisma.monitoringResult.findFirst({
        where: { websiteId },
        orderBy: { checkedAt: 'desc' }
      }),
      this.getConsecutiveFailures(websiteId)
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
      websiteName,
      url: website.url,
      uptime,
      averageResponseTime,
      totalChecks,
      lastCheck: lastResult?.checkedAt || null,
      consecutiveFailures
    };
  }

  /**
   * Get overview statistics for all websites or a user's websites
   */
  static async getOverallStats(
    userId?: number,
    period = '7d'
  ): Promise<{
    totalWebsites: number;
    activeWebsites: number;
    websiteStats: WebsiteStatsData[];
    overallUptime: number;
    overallResponseTime: number;
  }> {
    const days = this.periodToDays(period);
    
    // Query options for getting websites
    const whereOptions = { isActive: true };
    
    // If userId is provided, filter to only user's websites
    const websites = userId
      ? await prisma.website.findMany({
          where: {
            ...whereOptions,
            websiteUsers: {
              some: { userId }
            }
          }
        })
      : await prisma.website.findMany({
          where: whereOptions
        });
    
    // Get stats for each website
    const websiteStats = await Promise.all(
      websites.map(website => this.getWebsiteStats(website.id, userId, period))
    );
    
    // Count metrics
    const totalWebsites = userId
      ? await prisma.websiteUser.count({
          where: { userId }
        })
      : await prisma.website.count();
      
    const activeWebsites = userId
      ? await prisma.websiteUser.count({
          where: {
            userId,
            website: { isActive: true }
          }
        })
      : await prisma.website.count({
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
  
  /**
   * Get stats for a specific user's dashboard
   */
  static async getUserDashboardStats(
    userId: number,
    period = '7d'
  ): Promise<{
    totalWebsites: number;
    websiteStats: WebsiteStatsData[];
    overallUptime: number;
    overallResponseTime: number;
  }> {
    // Use the general method but with userId filter
    const stats = await this.getOverallStats(userId, period);
    
    return {
      totalWebsites: stats.totalWebsites,
      websiteStats: stats.websiteStats,
      overallUptime: stats.overallUptime,
      overallResponseTime: stats.overallResponseTime
    };
  }
}