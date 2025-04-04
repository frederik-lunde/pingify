import { PrismaClient, Website, Alert, WebsiteUser, AlertUser } from '@prisma/client';
import { emailTransporter, EMAIL_FROM } from '../config/config';
import { ResultsManager } from './monitoringService';
import { AlertQueryOptions, EmailAlertOptions, AlertType } from '../types';
import prisma from '../prisma/prismaClient'; // Adjust the path if needed


/**
 * Creates an alert record in the database and links it to relevant users
 */
async function createAlert(websiteId: number, type: AlertType, message: string): Promise<Alert> {
  // Start a transaction to ensure data consistency
  return prisma.$transaction(async (tx) => {
    // Create the alert
    const alert = await tx.alert.create({
      data: {
        websiteId,
        type,
        message,
      },
    });
    
    // Find all users who are monitoring this website with alerts enabled
    const websiteUsers = await tx.websiteUser.findMany({
      where: { 
        websiteId,
        alertEnabled: true 
      }
    });
    
    // Create AlertUser records for each user
    for (const websiteUser of websiteUsers) {
      await tx.alertUser.create({
        data: {
          userId: websiteUser.userId,
          alertId: alert.id
        }
      });
    }
    
    return alert;
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
  // AND the user has alerts enabled for this website
  if (!wasUpBefore || !websiteUser.alertEnabled) return;
  
  // Create the alert in the database (shared across all users with alertEnabled=true)
  const alert = await createAlert(
    website.id, 
    'down', 
    `Website is down: ${websiteUser.name || website.url}${statusCode ? ` (${statusCode})` : ''}${errorMessage ? ` - ${errorMessage}` : ''}`
  );
  
  // Send email notification if user has configured it
  if (websiteUser.notifyEmail && emailTransporter) {
    await sendEmailAlert({
      to: websiteUser.notifyEmail,
      subject: `🔴 DOWN: ${websiteUser.name || website.url}`,
      body: `Your website ${websiteUser.name || website.url} appears to be down.\n\n` +
        `Status: ${statusCode || 'Unknown'}\n` +
        `Error: ${errorMessage || 'No specific error'}\n` +
        `Time: ${new Date().toISOString()}`
    });
  }
}

/**
 * Resolves existing downtime alerts for a website
 */
async function resolveExistingDowntimeAlerts(
  websiteId: number,
  responseTime: number | null, 
  statusCode: number | null
): Promise<void> {
  // Find all unresolved downtime alerts for this website
  const unresolvedAlerts = await prisma.alert.findMany({
    where: {
      websiteId,
      type: 'down',
      isResolved: false
    },
    include: {
      alertUsers: {
        include: { user: true }
      },
      website: true
    }
  });
  
  const now = new Date();
  
  // Mark all as resolved
  for (const alert of unresolvedAlerts) {
    await prisma.alert.update({
      where: { id: alert.id },
      data: {
        isResolved: true,
        resolvedAt: now
      }
    });
    
    // Notify users who had this alert
    for (const alertUser of alert.alertUsers) {
      // Get user's website configuration
      const websiteUser = await prisma.websiteUser.findUnique({
        where: {
          userId_websiteId: {
            userId: alertUser.userId,
            websiteId
          }
        }
      });
      
      // Only notify if the user has email notifications enabled
      if (websiteUser?.notifyEmail && websiteUser.alertEnabled && emailTransporter) {
        await sendEmailAlert({
          to: websiteUser.notifyEmail,
          subject: `✅ RECOVERED: ${websiteUser.name || alert.website.url}`,
          body: `Your website ${websiteUser.name || alert.website.url} is now back online.\n\n` +
            `Response time: ${responseTime}ms\n` +
            `Status: ${statusCode}\n` +
            `Time: ${now.toISOString()}\n` +
            `Downtime duration: ${getTimeDifferenceString(alert.createdAt, now)}`
        });
      }
    }
  }
}

/**
 * Calculates a human-readable time difference string
 */
function getTimeDifferenceString(startDate: Date, endDate: Date): string {
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  
  if (diffSecs < 60) {
    return `${diffSecs} seconds`;
  }
  
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) {
    return `${diffMins} minutes`;
  }
  
  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  if (diffHours < 24) {
    return `${diffHours} hours ${remainingMins} minutes`;
  }
  
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  return `${diffDays} days ${remainingHours} hours`;
}

/**
 * Handles slow response alerts
 */
async function handleSlowResponseAlert(
  website: Website,
  websiteUser: WebsiteUser, 
  responseTime: number
): Promise<void> {
  // Only process if alerts are enabled and threshold is set
  if (!websiteUser.alertEnabled || !websiteUser.alertThreshold) return;
  
  // Create the alert in the database
  const alert = await createAlert(
    website.id, 
    'slow',
    `Website is responding slowly: ${websiteUser.name || website.url} (${responseTime}ms)`
  );
}

/**
 * Resolves slow response alerts if the website is now responding quickly
 */
async function resolveSlowResponseAlerts(
  website: Website,
  websiteUser: WebsiteUser,
  responseTime: number
): Promise<void> {
  // Only process if alerts are enabled and threshold is set
  if (!websiteUser.alertEnabled || !websiteUser.alertThreshold) return;
  
  // If response time is now below threshold, resolve any existing slow alerts
  if (responseTime <= websiteUser.alertThreshold) {
    // Find unresolved slow alerts for this website
    const unresolvedAlerts = await prisma.alert.findMany({
      where: {
        websiteId: website.id,
        type: 'slow',
        isResolved: false
      }
    });
    
    // Mark all as resolved
    for (const alert of unresolvedAlerts) {
      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          isResolved: true,
          resolvedAt: new Date()
        }
      });
    }
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
    // Skip processing for users who haven't enabled alerts
    if (!websiteUser.alertEnabled) return;
    
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
    // Handle site recovery - resolve existing downtime alerts
    else if (lastResult && !lastResult.isAvailable) {
      await resolveExistingDowntimeAlerts(website.id, responseTime, statusCode);
    }
    
    // Handle slow response alerts
    if (isAvailable && responseTime !== null) {
      if (websiteUser.alertThreshold && responseTime > websiteUser.alertThreshold) {
        // Website is responding slowly
        await handleSlowResponseAlert(website, websiteUser, responseTime);
      } else if (websiteUser.alertThreshold) {
        // Website was slow but is now fast again - resolve slow alerts
        await resolveSlowResponseAlerts(website, websiteUser, responseTime);
      }
    }
  } catch (error) {
    console.error(`Failed to process alerts for ${website.url} (user: ${websiteUser.userId}):`, error);
  }
}

/**
 * Get recent alerts with optional filtering
 */
export async function getRecentAlerts(options: AlertQueryOptions = {}): Promise<Alert[]> {
  const { limit = 50, type, from, to, isResolved } = options;
  
  const whereClause: any = {};
  
  if (type) {
    whereClause.type = type;
  }
  
  if (from || to) {
    whereClause.createdAt = {};
    if (from) whereClause.createdAt.gte = from;
    if (to) whereClause.createdAt.lte = to;
  }
  
  if (isResolved !== undefined) {
    whereClause.isResolved = isResolved;
  }
  
  return prisma.alert.findMany({
    where: whereClause,
    orderBy: isResolved ? { resolvedAt: 'desc' } : { createdAt: 'desc' },
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
  const { limit = 50, type, from, to, isResolved } = options;
  
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
  
  if (isResolved !== undefined) {
    whereClause.isResolved = isResolved;
  }
  
  return prisma.alert.findMany({
    where: whereClause,
    orderBy: isResolved ? { resolvedAt: 'desc' } : { createdAt: 'desc' },
    take: limit
  });
}

/**
 * Get alerts for a specific user
 */
export async function getAlertsForUser(
  userId: number,
  options: AlertQueryOptions = {}
): Promise<Alert[]> {
  const { limit = 50, type, from, to, isResolved } = options;
  
  const whereClause: any = {
    alertUsers: {
      some: {
        userId
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
  
  if (isResolved !== undefined) {
    whereClause.isResolved = isResolved;
  }
  
  return prisma.alert.findMany({
    where: whereClause,
    orderBy: isResolved ? { resolvedAt: 'desc' } : { createdAt: 'desc' },
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
      },
      alertUsers: {
        where: { userId },
        select: { isRead: true }
      }
    }
  });
}

/**
 * Get unread alerts for a user
 */
export async function getUserUnreadAlerts(
  userId: number,
  options: AlertQueryOptions = {}
): Promise<any[]> {
  const { limit = 50, type, from, to, isResolved } = options;
  
  return prisma.alertUser.findMany({
    where: {
      userId,
      isRead: false,
      alert: {
        ...(type && { type }),
        ...(isResolved !== undefined && { isResolved }),
        ...(from || to ? {
          createdAt: {
            ...(from && { gte: from }),
            ...(to && { lte: to })
          }
        } : {})
      }
    },
    orderBy: {
      alert: isResolved ? { resolvedAt: 'desc' } : { createdAt: 'desc' }
    },
    take: limit,
    include: {
      alert: {
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
      }
    }
  });
}

/**
 * Mark an alert as read for a specific user
 */
export async function markAlertAsRead(
  userId: number,
  alertId: number
): Promise<void> {
  await prisma.alertUser.updateMany({
    where: {
      userId,
      alertId
    },
    data: {
      isRead: true
    }
  });
}

/**
 * Mark all alerts as read for a specific user
 */
export async function markAllAlertsAsRead(userId: number): Promise<void> {
  await prisma.alertUser.updateMany({
    where: {
      userId,
      isRead: false
    },
    data: {
      isRead: true
    }
  });
}

/**
 * Get alert statistics
 */
export async function getAlertStats(days = 7): Promise<{
  totalAlerts: number;
  resolvedAlerts: number;
  unresolvedAlerts: number;
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
      isResolved: true,
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
        websiteName: alert.website.url,
        count: 0
      });
    }
    
    const websiteStats = websiteMap.get(alert.websiteId)!;
    websiteStats.count++;
  });
  
  // Count resolved vs unresolved
  const resolvedAlerts = alerts.filter(alert => alert.isResolved).length;
  
  return {
    totalAlerts: alerts.length,
    resolvedAlerts,
    unresolvedAlerts: alerts.length - resolvedAlerts,
    byType,
    byWebsite: Array.from(websiteMap.values())
  };
}

/**
 * Get alert statistics for a specific user
 */
export async function getUserAlertStats(userId: number, days = 7): Promise<{
  totalAlerts: number;
  resolvedAlerts: number;
  unresolvedAlerts: number;
  byType: Record<string, number>;
  byWebsite: Array<{ websiteId: number, websiteName: string, count: number }>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Get all the user's alerts
  const alerts = await prisma.alert.findMany({
    where: {
      alertUsers: {
        some: { userId }
      },
      createdAt: { gte: startDate }
    },
    select: {
      type: true,
      isResolved: true,
      websiteId: true,
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
  
  // Count by type
  const byType: Record<string, number> = {};
  alerts.forEach(alert => {
    byType[alert.type] = (byType[alert.type] || 0) + 1;
  });
  
  // Count by website and get custom names
  const websiteMap = new Map<number, { websiteId: number, websiteName: string, count: number }>();
  alerts.forEach(alert => {
    if (!websiteMap.has(alert.websiteId)) {
      const customName = alert.website.websiteUsers[0]?.name;
      websiteMap.set(alert.websiteId, {
        websiteId: alert.websiteId,
        websiteName: customName || alert.website.url,
        count: 0
      });
    }
    
    const websiteStats = websiteMap.get(alert.websiteId)!;
    websiteStats.count++;
  });
  
  // Count resolved vs unresolved
  const resolvedAlerts = alerts.filter(alert => alert.isResolved).length;
  
  return {
    totalAlerts: alerts.length,
    resolvedAlerts,
    unresolvedAlerts: alerts.length - resolvedAlerts,
    byType,
    byWebsite: Array.from(websiteMap.values())
  };
}