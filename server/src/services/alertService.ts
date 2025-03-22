import { PrismaClient, Website, Alert, WebsiteUser } from '@prisma/client';
import { emailTransporter, EMAIL_FROM } from '../config/config';
import { ResultsManager } from './monitoringService';
import { AlertQueryOptions, EmailAlertOptions, AlertType } from '../types';

const prisma = new PrismaClient();

/**
 * Creates an alert record in the database
 */
async function createAlert(websiteId: number, type: AlertType, message: string): Promise<Alert> {
  return prisma.alert.create({
    data: {
      websiteId,
      type,
      message,
    },
  });
}

/**
 * Sends an email alert
 */
export async function sendEmailAlert({ to, subject, body }: EmailAlertOptions): Promise<void> {
  if (!emailTransporter) return;
  
  try {
    await emailTransporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      text: body,
    });
    console.log(`Email alert sent to ${to}`);
  } catch (error) {
    console.error('Failed to send email alert:', error);
  }
}

/**
 * Handles downtime alerts
 */
async function handleDowntimeAlert(
  website: Website,
  websiteUser: WebsiteUser,
  statusCode: number | null, 
  errorMessage: string | null, 
  wasUpBefore: boolean
): Promise<void> {
  // Only alert if the site was previously up or this is the first check
  if (!wasUpBefore) return;
  
  // Create the alert in the database (shared across all users)
  const alert = await createAlert(
    website.id, 
    'down', 
    `Website is down: ${websiteUser.name}${statusCode ? ` (${statusCode})` : ''}${errorMessage ? ` - ${errorMessage}` : ''}`
  );
  
  // Send email notification if user has configured it
  if (websiteUser.notifyEmail && emailTransporter) {
    await sendEmailAlert({
      to: websiteUser.notifyEmail,
      subject: `🔴 DOWN: ${websiteUser.name}`,
      body: `Your website ${websiteUser.name} (${website.url}) appears to be down.\n\n` +
        `Status: ${statusCode || 'Unknown'}\n` +
        `Error: ${errorMessage || 'No specific error'}\n` +
        `Time: ${new Date().toISOString()}`
    });
  }
}

/**
 * Handles recovery alerts
 */
async function handleRecoveryAlert(
  website: Website,
  websiteUser: WebsiteUser,
  responseTime: number | null, 
  statusCode: number | null
): Promise<void> {
  // Create the alert in the database (shared across all users)
  const alert = await createAlert(
    website.id, 
    'recovered', 
    `Website has recovered: ${websiteUser.name}`
  );
  
  // Send email notification if user has configured it
  if (websiteUser.notifyEmail && emailTransporter) {
    await sendEmailAlert({
      to: websiteUser.notifyEmail,
      subject: `✅ RECOVERED: ${websiteUser.name}`,
      body: `Your website ${websiteUser.name} (${website.url}) is now back online.\n\n` +
        `Response time: ${responseTime}ms\n` +
        `Status: ${statusCode}\n` +
        `Time: ${new Date().toISOString()}`
    });
  }
}

/**
 * Handles slow response alerts
 */
async function handleSlowResponseAlert(
  website: Website,
  websiteUser: WebsiteUser, 
  responseTime: number
): Promise<void> {
  // Create the alert in the database (shared across all users)
  const alert = await createAlert(
    website.id, 
    'slow',
    `Website is responding slowly: ${websiteUser.name} (${responseTime}ms)`
  );
  
  // Send email notification if user has configured it
  if (websiteUser.notifyEmail && emailTransporter) {
    await sendEmailAlert({
      to: websiteUser.notifyEmail,
      subject: `⚠️ SLOW: ${websiteUser.name}`,
      body: `Your website ${websiteUser.name} (${website.url}) is responding slowly.\n\n` +
        `Response time: ${responseTime}ms\n` +
        `Threshold: ${websiteUser.alertThreshold}ms\n` +
        `Time: ${new Date().toISOString()}`
    });
  }
}

/**
 * Processes alerts for a website based on its monitoring result for a specific user
 */
export async function processAlerts(
  website: Website,
  websiteUser: WebsiteUser,
  isAvailable: boolean, 
  responseTime: number | null, 
  statusCode: number | null,
  errorMessage: string | null
): Promise<void> {
  try {
    // Get the last recorded status to detect state changes
    const lastResult = await prisma.monitoringResult.findFirst({
      where: { 
        websiteId: website.id,
        id: { not: await ResultsManager.getLatestResultId(website.id) }
      },
      orderBy: { checkedAt: 'desc' },
    });
    
    const wasUpBefore = !lastResult || lastResult.isAvailable;
    
    // Handle downtime alerts
    if (!isAvailable) {
      await handleDowntimeAlert(website, websiteUser, statusCode, errorMessage, wasUpBefore);
    } 
    // Handle recovery alerts
    else if (lastResult && !lastResult.isAvailable) {
      await handleRecoveryAlert(website, websiteUser, responseTime, statusCode);
    }
    
    // Handle slow response alerts (only if the site is available and user has set a threshold)
    if (isAvailable && 
        responseTime && 
        websiteUser.alertThreshold && 
        responseTime > websiteUser.alertThreshold) {
      await handleSlowResponseAlert(website, websiteUser, responseTime);
    }
  } catch (error) {
    console.error(`Failed to process alerts for ${website.url} (user: ${websiteUser.userId}):`, error);
  }
}

/**
 * Get recent alerts with optional filtering
 */
export async function getRecentAlerts(options: AlertQueryOptions = {}): Promise<Alert[]> {
  const { limit = 50, type, from, to } = options;
  
  const whereClause: any = {};
  
  if (type) {
    whereClause.type = type;
  }
  
  if (from || to) {
    whereClause.createdAt = {};
    if (from) whereClause.createdAt.gte = from;
    if (to) whereClause.createdAt.lte = to;
  }
  
  return prisma.alert.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
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
 * Get alerts for a specific website with optional filtering
 */
export async function getAlertsByWebsite(
  websiteId: number, 
  options: AlertQueryOptions = {}
): Promise<Alert[]> {
  const { limit = 50, type, from, to } = options;
  
  const whereClause: any = {
    websiteId
  };
  
  if (type) {
    whereClause.type = type;
  }
  
  if (from || to) {
    whereClause.createdAt = {};
    if (from) whereClause.createdAt.gte = from;
    if (to) whereClause.createdAt.lte = to;
  }
  
  return prisma.alert.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

/**
 * Get alerts for a specific user (filtered to their websites)
 */
export async function getAlertsForUser(
  userId: number,
  options: AlertQueryOptions = {}
): Promise<Alert[]> {
  const { limit = 50, type, from, to } = options;
  
  const whereClause: any = {
    website: {
      websiteUsers: {
        some: {
          userId
        }
      }
    }
  };
  
  if (type) {
    whereClause.type = type;
  }
  
  if (from || to) {
    whereClause.createdAt = {};
    if (from) whereClause.createdAt.gte = from;
    if (to) whereClause.createdAt.lte = to;
  }
  
  return prisma.alert.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      website: {
        select: {
          url: true,
          websiteUsers: {
            where: { userId },
            select: { name: true }
          }
        }
      }
    }
  });
}

/**
 * Get alert statistics
 */
export async function getAlertStats(days = 7): Promise<{
  totalAlerts: number;
  byType: Record<string, number>;
  byWebsite: Array<{ websiteId: number, websiteName: string, count: number }>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Get all alerts in the period
  const alerts = await prisma.alert.findMany({
    where: {
      createdAt: {
        gte: startDate
      }
    },
    select: {
      type: true,
      websiteId: true,
      website: {
        select: {
          url: true
        }
      }
    }
  });
  
  // Count by type
  const byType: Record<string, number> = {};
  alerts.forEach(alert => {
    byType[alert.type] = (byType[alert.type] || 0) + 1;
  });
  
  // Count by website
  const websiteMap = new Map<number, { websiteId: number, websiteName: string, count: number }>();
  alerts.forEach(alert => {
    if (!websiteMap.has(alert.websiteId)) {
      websiteMap.set(alert.websiteId, {
        websiteId: alert.websiteId,
        websiteName: alert.website.url, // Use URL instead of name (since name is now user-specific)
        count: 0
      });
    }
    
    const websiteStats = websiteMap.get(alert.websiteId)!;
    websiteStats.count++;
  });
  
  return {
    totalAlerts: alerts.length,
    byType,
    byWebsite: Array.from(websiteMap.values())
  };
}

/**
 * Get alert statistics for a specific user
 */
export async function getUserAlertStats(userId: number, days = 7): Promise<{
  totalAlerts: number;
  byType: Record<string, number>;
  byWebsite: Array<{ websiteId: number, websiteName: string, count: number }>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Get all the user's websites
  const userWebsites = await prisma.websiteUser.findMany({
    where: { userId },
    select: { 
      websiteId: true,
      name: true
    }
  });
  
  const websiteIds = userWebsites.map(uw => uw.websiteId);
  const websiteNames = new Map(userWebsites.map(uw => [uw.websiteId, uw.name]));
  
  // Get alerts for user's websites
  const alerts = await prisma.alert.findMany({
    where: {
      websiteId: { in: websiteIds },
      createdAt: { gte: startDate }
    },
    select: {
      type: true,
      websiteId: true
    }
  });
  
  // Count by type
  const byType: Record<string, number> = {};
  alerts.forEach(alert => {
    byType[alert.type] = (byType[alert.type] || 0) + 1;
  });
  
  // Count by website
  const websiteMap = new Map<number, { websiteId: number, websiteName: string, count: number }>();
  alerts.forEach(alert => {
    if (!websiteMap.has(alert.websiteId)) {
      websiteMap.set(alert.websiteId, {
        websiteId: alert.websiteId,
        websiteName: websiteNames.get(alert.websiteId) || `Website ${alert.websiteId}`,
        count: 0
      });
    }
    
    const websiteStats = websiteMap.get(alert.websiteId)!;
    websiteStats.count++;
  });
  
  return {
    totalAlerts: alerts.length,
    byType,
    byWebsite: Array.from(websiteMap.values())
  };
}