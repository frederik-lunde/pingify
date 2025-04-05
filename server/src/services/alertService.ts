// server/src/services/alertService.ts

import {
  Website as PrismaWebsite,     // Use alias for Prisma type
  Alert as PrismaAlert,         // Use alias for Prisma type
  WebsiteUser as PrismaWebsiteUser, // Use alias for Prisma type
  AlertUser as PrismaAlertUser,   // Use alias for Prisma type
  Prisma                      // Keep Prisma namespace
} from '@prisma/client';
import { emailTransporter, EMAIL_FROM } from '../config/config';
import { ResultsManager } from './monitoringService';
import prisma from '../prisma/prismaClient'; // Adjust the path if needed

// --- Import SHARED Types ---
// Replace '@shared/types' with your actual path alias or relative path
import {
  AlertQueryOptions,
  AlertType,
  AlertStats // Import the shared AlertStats type
} from '../types';

// --- Define Backend-Internal Types ---
/**
* Defines the necessary information for constructing and sending an email alert notification.
* Kept internal to the backend service.
*/
interface EmailAlertOptions {
to: string;
subject: string;
body: string; // Often HTML content
}

// *** ADDED THIS CONSTANT ARRAY ***
// Array containing the valid runtime string values for AlertType
const VALID_ALERT_TYPES: AlertType[] = ["down", "slow", "recovered", "ssl", "dns"];


/**
* Creates an alert record in the database and links it to relevant users.
* Returns the created Prisma Alert object.
*/
// Uses Prisma types internally, returns Prisma type
async function createAlert(websiteId: number, type: AlertType, message: string): Promise<PrismaAlert> {
return prisma.$transaction(async (tx) => {
  const alert = await tx.alert.create({
    data: { websiteId, type, message },
  });
  const websiteUsers = await tx.websiteUser.findMany({
    where: { websiteId, alertEnabled: true }
  });
  for (const websiteUser of websiteUsers) {
    // Check if an AlertUser already exists for this alert and user to prevent duplicates if logic allows re-creation
    const existingLink = await tx.alertUser.findUnique({
        where: { userId_alertId: { userId: websiteUser.userId, alertId: alert.id }}
    });
    if (!existingLink) {
        await tx.alertUser.create({
          data: { userId: websiteUser.userId, alertId: alert.id }
        });
    }
  }
  return alert;
});
}

/**
* Sends an email alert. Uses internal EmailAlertOptions.
*/
export async function sendEmailAlert({ to, subject, body }: EmailAlertOptions): Promise<void> {
if (!emailTransporter) {
  console.warn("Email transporter not configured. Skipping email alert.");
  return;
}
try {
  await emailTransporter.sendMail({ from: EMAIL_FROM, to, subject, html: body }); // Use html for body content
  console.log(`Email alert sent to ${to}`);
} catch (error) {
  console.error('Failed to send email alert:', error);
  // Potentially add more robust error handling/logging here
}
}

/**
* Handles downtime alerts. Internal helper.
*/
// Uses Prisma types internally
async function handleDowntimeAlert(
website: PrismaWebsite,
websiteUser: PrismaWebsiteUser,
statusCode: number | null,
errorMessage: string | null,
wasUpBefore: boolean
): Promise<void> {
// Only alert if the site was previously up
// The check for websiteUser.alertEnabled happens in processAlerts
if (!wasUpBefore) return;

// Check for existing unresolved 'down' alert for THIS user link to avoid spamming
// This requires a slightly different approach than createAlert's check
const existingUnresolvedAlertUser = await prisma.alertUser.findFirst({
    where: {
        userId: websiteUser.userId,
        alert: {
            websiteId: website.id,
            type: 'down',
            isResolved: false,
        }
    }
});

// If user already has an unresolved 'down' alert for this site, don't create/send another
if (existingUnresolvedAlertUser) {
    console.log(`User ${websiteUser.userId} already has unresolved 'down' alert for ${website.url}. Skipping new alert.`);
    return;
}

// Create the alert (this might be called multiple times by different users, but createAlert handles linking)
const alert = await createAlert(
  website.id,
  'down',
  `Website is down: ${websiteUser.name || website.url}${statusCode ? ` (${statusCode})` : ''}${errorMessage ? ` - ${errorMessage}` : ''}`
);

// Construct email body (example using simple HTML)
const emailBody = `
  <p>Your website <strong>${websiteUser.name || website.url}</strong> appears to be down.</p>
  <p>
    Status: ${statusCode || 'Unknown'}<br>
    Error: ${errorMessage || 'No specific error'}<br>
    Time: ${new Date().toLocaleString()}
  </p>
  <p>Alert ID: ${alert.id}</p>
`;

if (websiteUser.notifyEmail && emailTransporter) {
  await sendEmailAlert({
    to: websiteUser.notifyEmail,
    subject: `🔴 DOWN: ${websiteUser.name || website.url}`,
    body: emailBody
  });
}
}

/**
* Resolves existing downtime alerts for a website. Internal helper.
*/
// Uses Prisma types internally
async function resolveExistingDowntimeAlerts(
websiteId: number,
responseTime: number | null,
statusCode: number | null
): Promise<void> {
// Find *all* unresolved 'down' alerts for this website, including users who need notification
const unresolvedAlerts = await prisma.alert.findMany({
  where: { websiteId, type: 'down', isResolved: false },
  include: {
      alertUsers: { // Get all linked users for this alert
          where: {
              user: { // Ensure user exists and has email configured via WebsiteUser
                  websiteUsers: {
                      some: {
                          websiteId: websiteId,
                          alertEnabled: true,
                          notifyEmail: { not: null }
                      }
                  }
              }
          },
           select: { userId: true } // Select userId to fetch WebsiteUser later
      },
      website: { select: { url: true } }
  }
});


if (unresolvedAlerts.length === 0) return; // No alerts to resolve

const now = new Date();

// Use transaction for bulk update and fetching user configs
await prisma.$transaction(async (tx) => {
    // Mark alerts as resolved
    await tx.alert.updateMany({
        where: { id: { in: unresolvedAlerts.map(a => a.id) } },
        data: { isResolved: true, resolvedAt: now }
    });

    // Collect unique user IDs needing notification from the fetched alerts
    const userIdsToNotify = new Set<number>();
    unresolvedAlerts.forEach(alert => alert.alertUsers.forEach(au => userIdsToNotify.add(au.userId)));

    if (userIdsToNotify.size === 0) return; // No users to notify

    // Fetch relevant WebsiteUser configs for these users and this website
    const websiteUsersToNotify = await tx.websiteUser.findMany({
        where: {
            websiteId: websiteId,
            userId: { in: Array.from(userIdsToNotify) },
            // Redundant checks as alertUsers include already filtered them, but safe
            alertEnabled: true,
            notifyEmail: { not: null }
        },
        select: { userId: true, name: true, notifyEmail: true } // Select only needed fields
    });

    // Create a map for quick lookup
    const websiteUserMap = new Map(websiteUsersToNotify.map(wu => [wu.userId, wu]));

    // Send recovery notifications based on the original alerts
    for (const alert of unresolvedAlerts) {
         // Check which users originally linked to *this specific alert* need notifying
         const userIdsForThisAlert = new Set(alert.alertUsers.map(au => au.userId));

         for (const userId of userIdsForThisAlert) {
              const websiteUser = websiteUserMap.get(userId);
              // Check if we found config for this user (they might have disabled alerts since)
              if (websiteUser?.notifyEmail && emailTransporter) {
                 const emailBody = `
                    <p>Your website <strong>${websiteUser.name || alert.website.url}</strong> is now back online.</p>
                    <p>
                        Response time: ${responseTime !== null ? `${responseTime}ms` : 'N/A'}<br>
                        Status: ${statusCode || 'N/A'}<br>
                        Recovered at: ${now.toLocaleString()}<br>
                        Downtime duration: ${getTimeDifferenceString(alert.createdAt, now)}
                    </p>
                    <p>Original Alert ID: ${alert.id}</p>
                  `;
                 await sendEmailAlert({
                     to: websiteUser.notifyEmail,
                     subject: `✅ RECOVERED: ${websiteUser.name || alert.website.url}`,
                     body: emailBody
                 });
              }
         }
    }
});
}


/**
* Calculates a human-readable time difference string. Internal helper.
*/
function getTimeDifferenceString(startDate: Date, endDate: Date): string {
const diffMs = endDate.getTime() - startDate.getTime();
if (diffMs < 0) return "Error (invalid dates)";

const diffSecs = Math.floor(diffMs / 1000);
if (diffSecs < 60) return `${diffSecs} second${diffSecs !== 1 ? 's' : ''}`;

const diffMins = Math.floor(diffSecs / 60);
if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;

const diffHours = Math.floor(diffMins / 60);
const remainingMins = diffMins % 60;
if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''}${remainingMins > 0 ? ` ${remainingMins} minute${remainingMins !== 1 ? 's' : ''}` : ''}`;

const diffDays = Math.floor(diffHours / 24);
const remainingHours = diffHours % 24;
return `${diffDays} day${diffDays !== 1 ? 's' : ''}${remainingHours > 0 ? ` ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}` : ''}`;
}

/**
* Handles slow response alerts. Internal helper.
*/
// Uses Prisma types internally
async function handleSlowResponseAlert(
website: PrismaWebsite,
websiteUser: PrismaWebsiteUser,
responseTime: number // Assumed non-null when calling this
): Promise<void> {
// Check threshold exists and alertEnabled (redundant check here, done in processAlerts)
if (!websiteUser.alertEnabled || !websiteUser.alertThreshold) return;

// Only create alert if response time actually exceeds threshold
if (responseTime > websiteUser.alertThreshold) {
      // Check for existing unresolved 'slow' alert for THIS user link
      const existingUnresolvedAlertUser = await prisma.alertUser.findFirst({
          where: {
              userId: websiteUser.userId,
              alert: {
                  websiteId: website.id,
                  type: 'slow',
                  isResolved: false,
              }
          }
      });

       // If user already has an unresolved 'slow' alert for this site, don't create/send another
       if (existingUnresolvedAlertUser) {
           console.log(`User ${websiteUser.userId} already has unresolved 'slow' alert for ${website.url}. Skipping new alert.`);
           return;
       }

     const alert = await createAlert(
         website.id,
         'slow',
         `Website is responding slowly: ${websiteUser.name || website.url} (${responseTime}ms)`
     );
     // Optionally send email for slow response
     // if (websiteUser.notifyEmail && emailTransporter) { ... sendEmailAlert ... }
}
}

/**
* Resolves slow response alerts if the website is now responding quickly. Internal helper.
*/
// Uses Prisma types internally
async function resolveSlowResponseAlerts(
website: PrismaWebsite,
websiteUser: PrismaWebsiteUser,
responseTime: number // Assumed non-null when calling this
): Promise<void> {
// Check threshold exists and alertEnabled (redundant check here, done in processAlerts)
if (!websiteUser.alertEnabled || !websiteUser.alertThreshold) return;

// If response time is now *at or below* threshold, resolve existing slow alerts FOR THIS USER
if (responseTime <= websiteUser.alertThreshold) {
  // Find Alert IDs linked to this user that are 'slow' and unresolved for this website
   const userSlowAlerts = await prisma.alertUser.findMany({
       where: {
           userId: websiteUser.userId,
           alert: {
               websiteId: website.id,
               type: 'slow',
               isResolved: false,
           }
       },
       select: { alertId: true }
   });

   if (userSlowAlerts.length > 0) {
       const alertIdsToResolve = userSlowAlerts.map(ua => ua.alertId);
       await prisma.alert.updateMany({
           where: {
               id: { in: alertIdsToResolve }
           },
           data: { isResolved: true, resolvedAt: new Date() }
       });
       // Optionally send email notification about speed recovery
       // if (websiteUser.notifyEmail && emailTransporter) { ... sendEmailAlert ... }
   }
}
}

/**
* Processes alerts for a website based on its monitoring result for a specific user.
* This is the main entry point called after a check.
*/
// Uses Prisma types internally
export async function processAlerts(
website: PrismaWebsite,
websiteUser: PrismaWebsiteUser, // Process alerts based on THIS user's settings
isAvailable: boolean,
responseTime: number | null,
statusCode: number | null,
errorMessage: string | null
): Promise<void> {
try {
  // Skip processing for users who haven't enabled alerts for this site
  if (!websiteUser.alertEnabled) return;

  // Get the previous result *for this website* to detect state changes
  // Fetch the single previous result relative to the current check triggering this
  const previousResult = await prisma.monitoringResult.findFirst({
      where: { websiteId: website.id },
      orderBy: { checkedAt: 'desc' },
      // Skip 1 to get the one before the latest (which hasn't been saved yet when this is called)
      // Or adjust logic if this is called *after* saving the current result
      // Let's assume called *before* saving current result for now
      // skip: 1 // This might be complex if multiple checks run concurrently
      // Safer: findMany limit 2 and take second element if exists
  });

   // Get the last *saved* result to determine previous state more reliably
   const lastSavedResult = await prisma.monitoringResult.findFirst({
      where: { websiteId: website.id },
      orderBy: { checkedAt: 'desc' },
  });


  // Determine previous state. Default to 'up' if no previous result exists
  const wasUpBefore = lastSavedResult ? lastSavedResult.isAvailable : true;

  // --- Handle Downtime / Recovery ---
  if (!isAvailable) {
      // Current check shows DOWN
      await handleDowntimeAlert(website, websiteUser, statusCode, errorMessage, wasUpBefore);
  } else if (isAvailable && !wasUpBefore) {
      // Current check shows UP, and it WAS down before
      await resolveExistingDowntimeAlerts(website.id, responseTime, statusCode);
  }

  // --- Handle Slow / Fast Response ---
  // Only process if the site is available, response time is known, and user set a threshold
  if (isAvailable && responseTime !== null && websiteUser.alertThreshold !== null) {
      if (responseTime > websiteUser.alertThreshold) {
          // Website is currently responding SLOWLY
          await handleSlowResponseAlert(website, websiteUser, responseTime);
      } else {
          // Website is currently responding FAST ENOUGH
          // Resolve any existing 'slow' alerts FOR THIS USER if it's fast now
          await resolveSlowResponseAlerts(website, websiteUser, responseTime);
      }
  }
} catch (error) {
  console.error(`Failed to process alerts for ${website.url} (user: ${websiteUser.userId}):`, error);
}
}


// --- Functions Returning Data for API Endpoints ---
// These might need mapping in the CONTROLLER if the frontend strictly expects shared types (e.g., string dates)

/**
* Get recent alerts with optional filtering.
* Returns Prisma Alert types (potentially with relations). Controller should map if needed.
*/
export async function getRecentAlerts(options: AlertQueryOptions = {}): Promise<PrismaAlert[]> { // Return Prisma type
const { limit = 50, type, from, to, isResolved } = options;
const whereClause: Prisma.AlertWhereInput = {};
// Use shared AlertType for filtering if 'type' is provided
if (type && VALID_ALERT_TYPES.includes(type)) whereClause.type = type;
if (from || to) { whereClause.createdAt = {}; if (from) whereClause.createdAt.gte = from; if (to) whereClause.createdAt.lte = to; }
if (isResolved !== undefined) whereClause.isResolved = isResolved;

return prisma.alert.findMany({
  where: whereClause,
  orderBy: { createdAt: 'desc' }, // Simpler default sort
  take: limit,
  include: { website: { select: { url: true } } } // Include website URL
});
}

/**
* Get alerts for a specific website with optional filtering.
* Returns Prisma Alert types. Controller should map if needed.
*/
export async function getAlertsByWebsite(
websiteId: number,
options: AlertQueryOptions = {}
): Promise<PrismaAlert[]> { // Return Prisma type
const { limit = 50, type, from, to, isResolved } = options;
const whereClause: Prisma.AlertWhereInput = { websiteId };
if (type && VALID_ALERT_TYPES.includes(type)) whereClause.type = type;
if (from || to) { whereClause.createdAt = {}; if (from) whereClause.createdAt.gte = from; if (to) whereClause.createdAt.lte = to; }
if (isResolved !== undefined) whereClause.isResolved = isResolved;

return prisma.alert.findMany({
  where: whereClause,
  orderBy: { createdAt: 'desc' },
  take: limit,
  include: { website: { select: { url: true } } } // Include website URL
});
}

/**
* Get alerts relevant to a specific user.
* Returns Prisma Alert types (potentially with relations). Controller should map if needed.
*/
export async function getAlertsForUser(
userId: number,
options: AlertQueryOptions = {}
): Promise<PrismaAlert[]> { // Return Prisma type (controller maps)
const { limit = 50, type, from, to, isResolved } = options;
const whereClause: Prisma.AlertWhereInput = { alertUsers: { some: { userId } } };
if (type && VALID_ALERT_TYPES.includes(type)) whereClause.type = type;
if (from || to) { whereClause.createdAt = {}; if (from) whereClause.createdAt.gte = from; if (to) whereClause.createdAt.lte = to; }
if (isResolved !== undefined) whereClause.isResolved = isResolved;

return prisma.alert.findMany({
  where: whereClause,
  orderBy: { createdAt: 'desc' },
  take: limit,
  include: { // Include data potentially needed by frontend when displaying user alerts
    website: {
      select: { url: true, websiteUsers: { where: { userId }, select: { name: true } } }
    },
    alertUsers: { // Include the specific AlertUser link to check 'isRead' status
      where: { userId },
      select: { isRead: true }
    }
  }
});
}

/**
* Get unread alerts for a user.
* Returns Prisma AlertUser types (including nested Alert/Website). Controller should map.
*/
export async function getUserUnreadAlerts(
userId: number,
options: AlertQueryOptions = {}
): Promise<PrismaAlertUser[]> { // Return Prisma type (controller maps)
const { limit = 50, type, from, to, isResolved } = options;

// Filter based on AlertUser and nested Alert properties
const whereClause: Prisma.AlertUserWhereInput = {
    userId,
    isRead: false, // Key filter for unread
    alert: { // Nested filter on the related Alert
      ...(type && VALID_ALERT_TYPES.includes(type) && { type }), // Use validated type
      ...(isResolved !== undefined && { isResolved }),
      ...(from || to ? {
        createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) }
      } : {})
    }
};

return prisma.alertUser.findMany({
  where: whereClause,
  orderBy: { alert: { createdAt: 'desc' } }, // Order by the alert's creation time
  take: limit,
  include: { // Include necessary data for display
    alert: {
      include: {
        website: {
          select: { url: true, websiteUsers: { where: { userId }, select: { name: true } } }
        }
      }
    }
  }
});
}

/**
* Mark an alert as read for a specific user.
*/
export async function markAlertAsRead(
userId: number,
alertId: number
): Promise<void> {
// Use updateMany in case multiple AlertUser records somehow exist
await prisma.alertUser.updateMany({
  where: { userId, alertId, isRead: false }, // Only update if not already read
  data: { isRead: true }
});
}

/**
* Mark all alerts as read for a specific user.
*/
export async function markAllAlertsAsRead(userId: number): Promise<void> {
await prisma.alertUser.updateMany({
  where: { userId, isRead: false },
  data: { isRead: true }
});
}


/**
* Get alert statistics.
* Returns data structure matching the SHARED AlertStats type.
*/
// Update return type to use shared AlertStats
export async function getAlertStats(days = 7): Promise<AlertStats> {
const startDate = new Date();
startDate.setDate(startDate.getDate() - days);

// Fetch necessary fields using Prisma types
const alerts = await prisma.alert.findMany({
  where: { createdAt: { gte: startDate } },
  // Select only needed fields for calculation
  select: { type: true, isResolved: true, websiteId: true, website: { select: { url: true } } }
});

// Calculate stats
const byType: Partial<Record<AlertType, number>> = {}; // Use shared AlertType
alerts.forEach(alert => {
  // *** Use VALID_ALERT_TYPES check ***
  if (VALID_ALERT_TYPES.includes(alert.type as AlertType)) {
      byType[alert.type as AlertType] = (byType[alert.type as AlertType] || 0) + 1;
  } else {
    console.warn(`Encountered unknown alert type in getAlertStats: ${alert.type}`);
  }
});

// Calculate stats by website
const websiteMap = new Map<number, { websiteId: number, websiteName: string, count: number }>();
alerts.forEach(alert => {
  if (!websiteMap.has(alert.websiteId)) {
    // Use URL as fallback name if relation wasn't included or name is null
    websiteMap.set(alert.websiteId, { websiteId: alert.websiteId, websiteName: alert.website?.url ?? `Website ${alert.websiteId}`, count: 0 });
  }
  websiteMap.get(alert.websiteId)!.count++; // Use non-null assertion as we just added it
});

const resolvedAlerts = alerts.filter(alert => alert.isResolved).length;

// Construct object matching shared AlertStats
return {
  totalAlerts: alerts.length,
  resolvedAlerts,
  unresolvedAlerts: alerts.length - resolvedAlerts,
  byType, // Already using shared AlertType keys
  byWebsite: Array.from(websiteMap.values())
};
}

/**
* Get alert statistics for a specific user.
* Returns data structure matching the SHARED AlertStats type.
*/
// Update return type to use shared AlertStats
export async function getUserAlertStats(userId: number, days = 7): Promise<AlertStats> {
const startDate = new Date();
startDate.setDate(startDate.getDate() - days);

// Fetch necessary fields using Prisma types and relations
const alerts = await prisma.alert.findMany({
  where: { alertUsers: { some: { userId } }, createdAt: { gte: startDate } },
  select: {
      type: true, isResolved: true, websiteId: true,
      // Include nested data needed for websiteName
      website: { select: { url: true, websiteUsers: { where: { userId }, select: { name: true } } } }
  }
});

// Calculate stats
const byType: Partial<Record<AlertType, number>> = {}; // Use shared AlertType
alerts.forEach(alert => {
    // *** Use VALID_ALERT_TYPES check ***
    if (VALID_ALERT_TYPES.includes(alert.type as AlertType)) {
      byType[alert.type as AlertType] = (byType[alert.type as AlertType] || 0) + 1;
  } else {
       console.warn(`Encountered unknown alert type in getUserAlertStats: ${alert.type}`);
  }
});

// Calculate stats by website, using user-specific name
const websiteMap = new Map<number, { websiteId: number, websiteName: string, count: number }>();
alerts.forEach(alert => {
  if (!websiteMap.has(alert.websiteId)) {
    // Get user-specific name from included relation, fallback to URL
    const customName = alert.website?.websiteUsers?.[0]?.name;
    websiteMap.set(alert.websiteId, { websiteId: alert.websiteId, websiteName: customName || alert.website?.url || `Website ${alert.websiteId}`, count: 0 });
  }
  websiteMap.get(alert.websiteId)!.count++; // Use non-null assertion
});

const resolvedAlerts = alerts.filter(alert => alert.isResolved).length;

// Construct object matching shared AlertStats
return {
  totalAlerts: alerts.length,
  resolvedAlerts,
  unresolvedAlerts: alerts.length - resolvedAlerts,
  byType,
  byWebsite: Array.from(websiteMap.values())
};
}