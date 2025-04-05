// server/src/services/alertService.ts

import {
  Website as PrismaWebsite,
  Alert as PrismaAlert,
  WebsiteUser as PrismaWebsiteUser,
  AlertUser as PrismaAlertUser,
  Prisma, // Keep Prisma namespace for types like BatchPayload and WhereInput
} from '@prisma/client';
import { emailTransporter, EMAIL_FROM } from '../config/config';
import prisma from '../prisma/prismaClient'; // Adjust path if needed

// --- Import SHARED Types ---
// Replace '@shared/types' or '../types' with your actual path
import {
  AlertQueryOptions,
  AlertType,
  AlertStats,
} from '../types'; // Assuming shared types are defined correctly

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

// Array containing the valid runtime string values for AlertType
// Consider moving this to a shared types file if used elsewhere extensively
const VALID_ALERT_TYPES: AlertType[] = ["down", "slow", "recovered", "ssl", "dns"];

// --- Utility Functions ---

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

// --- Alert Creation & Notification ---

/**
 * Creates an alert record in the database and links it to relevant users who have alerts enabled.
 * Uses upsert to avoid duplicate AlertUser entries.
 * Returns the created Prisma Alert object.
 */
async function createAlert(websiteId: number, type: AlertType, message: string): Promise<PrismaAlert> {
  // Validate type before creation
  if (!VALID_ALERT_TYPES.includes(type)) {
    // Consider throwing a more specific error type if needed
    throw new Error(`Invalid alert type provided: ${type}`);
  }

  console.log(`Creating alert: Website ID ${websiteId}, Type: ${type}, Message: "${message}"`);

  return prisma.$transaction(async (tx) => {
    // 1. Create the Alert
    const alert = await tx.alert.create({
      data: { websiteId, type, message, isResolved: false }, // Ensure isResolved is false initially
    });

    // 2. Find users associated with this website who have alerts enabled
    const websiteUsersToNotify = await tx.websiteUser.findMany({
      where: { websiteId, alertEnabled: true },
      select: { userId: true } // Only need userId for linking
    });

    if (websiteUsersToNotify.length === 0) {
      console.log(`No users found with alerts enabled for websiteId ${websiteId}. Alert created but not linked.`);
      return alert; // Return the created alert even if no users are linked yet
    }

    // 3. Create AlertUser links for each user (use upsert for safety)
    const userLinkPromises = websiteUsersToNotify.map(websiteUser =>
      tx.alertUser.upsert({
        where: { userId_alertId: { userId: websiteUser.userId, alertId: alert.id } },
        update: {}, // Do nothing if the link already exists
        create: { userId: websiteUser.userId, alertId: alert.id, isRead: false } // Ensure isRead is false on creation
      })
    );

    await Promise.all(userLinkPromises);
    console.log(`Linked alert ${alert.id} to ${websiteUsersToNotify.length} users.`);

    return alert;
  });
}

/**
 * Sends an email alert.
 */
export async function sendEmailAlert({ to, subject, body }: EmailAlertOptions): Promise<void> {
  if (!emailTransporter) {
    console.warn("Email transporter not configured. Skipping email alert to:", to);
    return;
  }
  try {
    await emailTransporter.sendMail({ from: EMAIL_FROM, to, subject, html: body });
    console.log(`Email alert sent successfully to ${to}`);
  } catch (error) {
    console.error(`Failed to send email alert to ${to}:`, error);
    // Potentially add more robust error handling/logging (e.g., retry queue, monitoring)
  }
}


// --- Alert Handling Logic (Called by Monitoring Service) ---

/**
 * Handles downtime alerts: Creates 'down' alert if site was up before and user hasn't been alerted yet.
 */
async function handleDowntimeAlert(
  website: PrismaWebsite,
  websiteUser: PrismaWebsiteUser, // Process for this specific user's view/settings
  statusCode: number | null,
  errorMessage: string | null,
  wasUpBefore: boolean
): Promise<void> {
  // Only alert if the site was previously up and this user has alerts enabled
  if (!wasUpBefore || !websiteUser.alertEnabled) {
    return;
  }

  // Prevent spamming: Check if THIS USER already has an active (unresolved) 'down' alert for this website
  const existingUnresolvedAlertUser = await prisma.alertUser.findFirst({
    where: {
      userId: websiteUser.userId,
      alert: {
        websiteId: website.id,
        type: 'down',
        isResolved: false,
      }
    },
    select: { id: true } // Select minimal field just to check existence
  });

  // If user already has an unresolved 'down' alert link for this site, don't create/send another *for them*
  if (existingUnresolvedAlertUser) {
    console.log(`User ${websiteUser.userId} already has unresolved 'down' alert for ${website.url}. Skipping new alert creation/notification for this user.`);
    return;
  }

  // Create the main alert record (createAlert handles linking to *all* enabled users)
  const alertMessage = `Website is down: ${websiteUser.name || website.url}${statusCode ? ` (Status: ${statusCode})` : ''}${errorMessage ? ` - Error: ${errorMessage}` : ''}`;
  try {
      const alert = await createAlert(website.id, 'down', alertMessage);

      // Send email *only* to the specific user being processed IF they want email notifications
      if (websiteUser.notifyEmail && emailTransporter) {
          const emailBody = `
          <p>Your monitored website <strong>${websiteUser.name || website.url}</strong> appears to be down.</p>
          <p>
              Status Code: ${statusCode ?? 'N/A'}<br>
              Error Message: ${errorMessage ?? 'No specific error reported'}<br>
              Time Detected: ${new Date().toLocaleString()}
          </p>
          <p>We will notify you when it recovers.</p>
          <p>Alert ID: ${alert.id}</p>
          `;
          await sendEmailAlert({
              to: websiteUser.notifyEmail,
              subject: `🔴 DOWN: ${websiteUser.name || website.url}`,
              body: emailBody
          });
      }
  } catch (error) {
       console.error(`Error creating/notifying 'down' alert for ${website.url}, user ${websiteUser.userId}:`, error);
  }
}

/**
 * Resolves existing 'down' alerts for a website when it recovers.
 * Sends recovery notifications to users who were linked to the original down alerts.
 */
async function resolveExistingDowntimeAlerts(
  websiteId: number,
  responseTime: number | null,
  statusCode: number | null
): Promise<void> {
  // Find *all* unresolved 'down' alerts for this website
  const unresolvedDownAlerts = await prisma.alert.findMany({
    where: {
      websiteId: websiteId,
      type: 'down',
      isResolved: false
    },
    include: {
      // Include the users *originally linked* to these specific down alerts
      alertUsers: {
        select: { userId: true } // We need the user IDs to fetch their current settings
      },
      website: { // Include website info for email context
        select: { url: true }
      }
    }
  });

  if (unresolvedDownAlerts.length === 0) {
    // console.log(`No unresolved 'down' alerts found for website ${websiteId} to resolve.`);
    return; // Nothing to do
  }

  console.log(`Found ${unresolvedDownAlerts.length} 'down' alerts to resolve for website ${websiteId}.`);
  const now = new Date();
  const alertIdsToResolve = unresolvedDownAlerts.map(a => a.id);

  try {
      await prisma.$transaction(async (tx) => {
          // 1. Mark the Alerts themselves as resolved
          await tx.alert.updateMany({
              where: { id: { in: alertIdsToResolve } },
              data: { isResolved: true, resolvedAt: now }
          });
          console.log(`Marked ${alertIdsToResolve.length} alerts as resolved.`);

          // 2. Prepare and send recovery notifications

          // Collect unique user IDs from *all* the alerts being resolved
          const userIdsToPotentiallyNotify = new Set<number>();
          unresolvedDownAlerts.forEach(alert => {
              alert.alertUsers.forEach(au => userIdsToPotentiallyNotify.add(au.userId));
          });

          if (userIdsToPotentiallyNotify.size === 0) {
              console.log("No users were linked to the resolved alerts. Skipping recovery notifications.");
              return; // No users to notify
          }

          // Fetch current WebsiteUser settings for these users *and this specific website*
          // This ensures we only notify users who *still* have alerts enabled and an email set
          const relevantWebsiteUsers = await tx.websiteUser.findMany({
              where: {
                  websiteId: websiteId,
                  userId: { in: Array.from(userIdsToPotentiallyNotify) },
                  alertEnabled: true, // Must still have alerts enabled
                  notifyEmail: { not: null } // Must have an email address set
              },
              select: { userId: true, name: true, notifyEmail: true }
          });

          // Create a map for quick lookup of user settings
          const websiteUserMap = new Map(relevantWebsiteUsers.map(wu => [wu.userId, wu]));

          console.log(`Attempting to send recovery notifications to up to ${websiteUserMap.size} users.`);

          // Iterate through the alerts we just resolved
          for (const resolvedAlert of unresolvedDownAlerts) {
              const websiteUrl = resolvedAlert.website.url; // Get URL from included data

              // Iterate through the users *originally linked* to this specific alert
              for (const alertUserLink of resolvedAlert.alertUsers) {
                  const userId = alertUserLink.userId;
                  const websiteUser = websiteUserMap.get(userId); // Check if user still wants notifications

                  if (websiteUser?.notifyEmail && emailTransporter) {
                      // User exists in our map, meaning they still want email alerts
                      const duration = getTimeDifferenceString(resolvedAlert.createdAt, now);
                      const emailBody = `
                          <p>Your monitored website <strong>${websiteUser.name || websiteUrl}</strong> is back online!</p>
                          <p>
                              Status Code: ${statusCode ?? 'N/A'}<br>
                              Response Time: ${responseTime !== null ? `${responseTime}ms` : 'N/A'}<br>
                              Recovered At: ${now.toLocaleString()}<br>
                              Approx. Downtime Duration: ${duration}
                          </p>
                          <p>Original Alert ID: ${resolvedAlert.id}</p>
                      `;
                      // Send email asynchronously (don't wait for one to finish before starting next)
                      sendEmailAlert({ // Note: await inside loop is okay if errors should stop the process, otherwise Promise.all outside
                          to: websiteUser.notifyEmail,
                          subject: `✅ RECOVERED: ${websiteUser.name || websiteUrl}`,
                          body: emailBody
                      }).catch(err => console.error(`Failed recovery email for alert ${resolvedAlert.id}, user ${userId}:`, err)); // Log errors but continue
                  }
              }
          }
      });
       console.log(`Transaction completed for resolving ${alertIdsToResolve.length} alerts.`);
  } catch (error) {
     console.error(`Error resolving downtime alerts or sending notifications for website ${websiteId}:`, error);
  }
}


/**
 * Handles slow response alerts: Creates 'slow' alert if response time exceeds threshold and user hasn't been alerted.
 */
async function handleSlowResponseAlert(
  website: PrismaWebsite,
  websiteUser: PrismaWebsiteUser, // Process for this specific user's threshold
  responseTime: number // Assumed non-null when calling this
): Promise<void> {
  // Check threshold exists, alertEnabled, and response time actually exceeds threshold
  if (!websiteUser.alertEnabled || !websiteUser.alertThreshold || responseTime <= websiteUser.alertThreshold) {
    return;
  }

  // Prevent spamming: Check if THIS USER already has an active (unresolved) 'slow' alert for this website
  const existingUnresolvedAlertUser = await prisma.alertUser.findFirst({
    where: {
      userId: websiteUser.userId,
      alert: {
        websiteId: website.id,
        type: 'slow',
        isResolved: false,
      }
    },
    select: { id: true }
  });

  if (existingUnresolvedAlertUser) {
    console.log(`User ${websiteUser.userId} already has unresolved 'slow' alert for ${website.url}. Skipping new alert creation/notification for this user.`);
    return;
  }

  // Create the main alert record (createAlert links all enabled users)
  const alertMessage = `Website is responding slowly: ${websiteUser.name || website.url} (${responseTime}ms exceeds threshold of ${websiteUser.alertThreshold}ms)`;
  try {
      const alert = await createAlert(website.id, 'slow', alertMessage);

      // Optionally send email *only* to this specific user if they want email notifications
      if (websiteUser.notifyEmail && emailTransporter) {
          const emailBody = `... Slow response email body ... Alert ID: ${alert.id}`; // Construct email body
          await sendEmailAlert({
              to: websiteUser.notifyEmail,
              subject: `⚠️ SLOW: ${websiteUser.name || website.url}`,
              body: emailBody
          });
      }
  } catch (error) {
      console.error(`Error creating/notifying 'slow' alert for ${website.url}, user ${websiteUser.userId}:`, error);
  }
}

/**
 * Resolves 'slow' alerts *for a specific user* if the website is now responding below their threshold.
 */
async function resolveSlowResponseAlerts(
  website: PrismaWebsite,
  websiteUser: PrismaWebsiteUser, // Resolve based on this user's threshold
  responseTime: number // Assumed non-null when calling this
): Promise<void> {
  // Check threshold exists, alertEnabled, and response time is now *at or below* the threshold
  if (!websiteUser.alertEnabled || !websiteUser.alertThreshold || responseTime > websiteUser.alertThreshold) {
    return; // Not fast enough yet, or alerts not enabled/configured
  }

  // Find *this user's* specific AlertUser links that correspond to unresolved 'slow' alerts for this website
  const userSlowAlertLinks = await prisma.alertUser.findMany({
    where: {
      userId: websiteUser.userId,
      alert: { // Nested condition on the related Alert
        websiteId: website.id,
        type: 'slow',
        isResolved: false,
      }
    },
    select: { alertId: true } // Get the IDs of the Alert records to update
  });

  if (userSlowAlertLinks.length > 0) {
    const alertIdsToResolve = userSlowAlertLinks.map(ua => ua.alertId);
    console.log(`Resolving ${alertIdsToResolve.length} 'slow' alerts for user ${websiteUser.userId} on ${website.url}`);
    try {
        const updateResult = await prisma.alert.updateMany({
            where: {
              id: { in: alertIdsToResolve }
              // Redundant check, but ensures we only update 'slow', unresolved alerts
              // type: 'slow',
              // isResolved: false
            },
            data: { isResolved: true, resolvedAt: new Date() }
        });
        console.log(`Successfully marked ${updateResult.count} 'slow' alerts as resolved for user ${websiteUser.userId}.`);

        // Optionally send email notification about speed recovery *to this specific user*
        if (websiteUser.notifyEmail && emailTransporter) {
            const emailBody = `... Speed recovery email body ... Response time now ${responseTime}ms.`;
            await sendEmailAlert({
                to: websiteUser.notifyEmail,
                subject: `✅ SPEED RECOVERED: ${websiteUser.name || website.url}`,
                body: emailBody
            });
        }
    } catch (error) {
        console.error(`Error resolving 'slow' alerts for user ${websiteUser.userId}, website ${website.id}:`, error);
    }
  }
}


/**
 * Processes alerts for a website based on its monitoring result FOR A SPECIFIC USER'S CONTEXT.
 * This is the main entry point called after a check determines the status relative to a user's settings.
 */
export async function processAlerts(
  website: PrismaWebsite,
  websiteUser: PrismaWebsiteUser, // Process alerts based on THIS user's settings/thresholds
  isAvailable: boolean,
  responseTime: number | null,
  statusCode: number | null,
  errorMessage: string | null
): Promise<void> {
  try {
    // Skip processing entirely if this user hasn't enabled alerts for this site
    if (!websiteUser.alertEnabled) {
      // console.log(`Alerts disabled for user ${websiteUser.userId} on website ${website.id}. Skipping processing.`);
      return;
    }

    // Get the previous result *for this website* to detect state changes (up/down)
    // Fetch the single most recent *saved* result.
    const lastSavedResult = await prisma.monitoringResult.findFirst({
      where: { websiteId: website.id },
      orderBy: { checkedAt: 'desc' },
      select: { isAvailable: true } // Only need availability status
    });

    // Determine previous state. Default to 'up' if no history exists (first check).
    const wasUpBefore = lastSavedResult ? lastSavedResult.isAvailable : true;

    // --- Handle Downtime / Recovery (Website-level resolution) ---
    if (!isAvailable) {
      // Current check shows DOWN
      await handleDowntimeAlert(website, websiteUser, statusCode, errorMessage, wasUpBefore);
    } else if (isAvailable && !wasUpBefore) {
      // Current check shows UP, and it WAS down before
      // Resolve *all* existing 'down' alerts for this website. Notifications handled inside.
      await resolveExistingDowntimeAlerts(website.id, responseTime, statusCode);
    }

    // --- Handle Slow / Fast Response (User-specific resolution) ---
    // Only process if the site is available, response time is known, and user set a threshold
    if (isAvailable && responseTime !== null && websiteUser.alertThreshold !== null) {
      if (responseTime > websiteUser.alertThreshold) {
        // Website is currently responding SLOWLY according to this user's threshold
        await handleSlowResponseAlert(website, websiteUser, responseTime);
      } else {
        // Website is currently responding FAST ENOUGH according to this user's threshold
        // Resolve any existing 'slow' alerts FOR THIS USER if it's fast now
        await resolveSlowResponseAlerts(website, websiteUser, responseTime);
      }
    }
    // --- Handle other alert types (SSL, DNS, etc.) here if needed ---

  } catch (error) {
    console.error(`Failed to process alerts for ${website.url} (User: ${websiteUser.userId}, WebsiteID: ${website.id}):`, error);
    // Consider more specific error logging or reporting
  }
}


// --- Data Fetching & Actions for API Endpoints ---

/**
 * Get recent alerts system-wide with optional filtering. (Admin/Internal use likely)
 * Returns Prisma Alert types (controller/caller should map if needed).
 */
export async function getRecentAlerts(options: AlertQueryOptions = {}): Promise<PrismaAlert[]> {
  const { limit = 50, type, from, to, isResolved } = options;
  const whereClause: Prisma.AlertWhereInput = {};

  if (type && VALID_ALERT_TYPES.includes(type)) whereClause.type = type;
  if (from || to) { whereClause.createdAt = {}; if (from) whereClause.createdAt.gte = from; if (to) whereClause.createdAt.lte = to; }
  if (isResolved !== undefined) whereClause.isResolved = isResolved;

  return prisma.alert.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { website: { select: { id: true, url: true } } } // Include basic website info
  });
}

/**
 * Get alerts for a specific website with optional filtering.
 * Returns Prisma Alert types.
 */
export async function getAlertsByWebsite(
  websiteId: number,
  options: AlertQueryOptions = {}
): Promise<PrismaAlert[]> {
  const { limit = 50, type, from, to, isResolved } = options;
  const whereClause: Prisma.AlertWhereInput = { websiteId };

  if (type && VALID_ALERT_TYPES.includes(type)) whereClause.type = type;
  if (from || to) { whereClause.createdAt = {}; if (from) whereClause.createdAt.gte = from; if (to) whereClause.createdAt.lte = to; }
  if (isResolved !== undefined) whereClause.isResolved = isResolved;

  return prisma.alert.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { website: { select: { id: true, url: true } } } // Include basic website info
  });
}

/**
 * Get alerts relevant to a specific user. Includes user-specific read status.
 * Returns Prisma Alert types with specific AlertUser relation included.
 */
export async function getAlertsForUser(
  userId: number,
  options: AlertQueryOptions = {}
): Promise<PrismaAlert[]> {
  const { limit = 50, type, from, to, isResolved, isRead } = options; // Include isRead filter possibility

  // Base filter: alerts linked to the user
  const whereClause: Prisma.AlertWhereInput = {
      alertUsers: { some: { userId } }
  };

  // Add optional filters to the main Alert query
  if (type && VALID_ALERT_TYPES.includes(type)) whereClause.type = type;
  if (from || to) { whereClause.createdAt = {}; if (from) whereClause.createdAt.gte = from; if (to) whereClause.createdAt.lte = to; }
  if (isResolved !== undefined) whereClause.isResolved = isResolved;

  // Add filter based on the linked AlertUser's isRead status if provided
  if (isRead !== undefined) {
      whereClause.alertUsers = { some: { userId, isRead } };
  }

  return prisma.alert.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      // Include website URL and the user's custom name for it
      website: {
        select: {
            id: true,
            url: true,
            websiteUsers: { // Fetch the specific WebsiteUser link for the name
                where: { userId },
                select: { name: true }
            }
        }
      },
      // Include the specific AlertUser link *for this user* to get the isRead status
      alertUsers: {
        where: { userId },
        select: { isRead: true, id: true } // Select AlertUser ID if needed
      }
    }
  });
}

/**
 * Get *unread* alerts specifically for a user (fetches AlertUser records).
 * Returns Prisma AlertUser types (including nested Alert/Website). Controller/frontend maps as needed.
 */
export async function getUserUnreadAlerts(
  userId: number,
  options: AlertQueryOptions = {}
): Promise<PrismaAlertUser[]> { // Return AlertUser[]
  const { limit = 50, type, from, to, isResolved } = options;

  // Filter based on AlertUser properties and nested Alert properties
  const whereClause: Prisma.AlertUserWhereInput = {
    userId,
    isRead: false, // Key filter for unread
    alert: { // Nested filter on the related Alert
      ...(type && VALID_ALERT_TYPES.includes(type) && { type }),
      ...(isResolved !== undefined && { isResolved }), // Allow filtering unread by resolved status if needed
      ...(from || to ? {
        createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) }
      } : {})
    }
  };

  return prisma.alertUser.findMany({
    where: whereClause,
    orderBy: { alert: { createdAt: 'desc' } }, // Order by the alert's creation time
    take: limit,
    include: { // Include necessary data for display in the dropdown/list
      alert: { // Include the full Alert object
        include: {
          website: { // Include Website info within the Alert
            select: {
                id: true,
                url: true,
                websiteUsers: { // Get user's custom name for this website
                    where: { userId },
                    select: { name: true }
                }
            }
          }
        }
      }
      // No need to include User again as we are querying by userId
    }
  });
}

/**
 * Mark a specific alert as read for a specific user by updating the AlertUser record.
 * Returns the Prisma BatchPayload indicating rows affected.
 */
export async function markAlertAsRead(
  userId: number,
  alertId: number
): Promise<Prisma.BatchPayload> {
  console.log(`Marking alert ${alertId} as read for user ${userId}`);
  return prisma.alertUser.updateMany({
    where: { userId, alertId, isRead: false }, // Only update if it exists and is currently unread
    data: { isRead: true }
  });
}

/**
 * Mark all alerts as read for a specific user.
 * Returns the Prisma BatchPayload indicating rows affected.
 */
export async function markAllAlertsAsRead(userId: number): Promise<Prisma.BatchPayload> {
  console.log(`Marking all alerts as read for user ${userId}`);
  return prisma.alertUser.updateMany({
    where: { userId, isRead: false }, // Target only unread links for this user
    data: { isRead: true }
  });
}

/**
 * Deletes the link between a user and an alert (dismisses the alert for that user).
 * Returns the Prisma BatchPayload indicating rows affected (should be 0 or 1).
 */
export async function deleteAlertForUser(
  userId: number,
  alertId: number
): Promise<Prisma.BatchPayload> {
  console.log(`Dismissing (deleting link for) alert ${alertId} for user ${userId}`);
  // Use deleteMany for safety and consistency, targets the specific link
  return prisma.alertUser.deleteMany({
    where: { userId, alertId }
  });
}


// --- Alert Statistics ---

/**
 * Get overall alert statistics for a given period.
 * Returns data structure matching the SHARED AlertStats type.
 */
export async function getAlertStats(days = 7): Promise<AlertStats> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0); // Start from beginning of the day

  // Fetch alerts within the date range
  const alerts = await prisma.alert.findMany({
    where: { createdAt: { gte: startDate } },
    select: { type: true, isResolved: true, websiteId: true, website: { select: { url: true } } }
  });

  // Calculate stats
  const totalAlerts = alerts.length;
  let resolvedAlerts = 0;
  const byType: Partial<Record<AlertType, number>> = {};
  const websiteMap = new Map<number, { websiteId: number, websiteName: string, count: number }>();

  alerts.forEach(alert => {
    // Count resolved
    if (alert.isResolved) {
      resolvedAlerts++;
    }
    // Count by type (ensure type is valid)
    const alertType = alert.type as AlertType;
    if (VALID_ALERT_TYPES.includes(alertType)) {
      byType[alertType] = (byType[alertType] || 0) + 1;
    } else {
       console.warn(`Encountered unknown alert type in getAlertStats: ${alert.type}`);
    }
    // Count by website
    const websiteName = alert.website?.url ?? `Website ${alert.websiteId}`; // Use URL as fallback name
    if (!websiteMap.has(alert.websiteId)) {
        websiteMap.set(alert.websiteId, { websiteId: alert.websiteId, websiteName: websiteName, count: 0 });
    }
    websiteMap.get(alert.websiteId)!.count++; // Non-null assertion okay here
  });

  // Construct object matching shared AlertStats
  return {
    totalAlerts,
    resolvedAlerts,
    unresolvedAlerts: totalAlerts - resolvedAlerts,
    byType,
    byWebsite: Array.from(websiteMap.values()).sort((a, b) => b.count - a.count), // Sort by count desc
  };
}

/**
 * Get alert statistics for a specific user over a given period.
 * Returns data structure matching the SHARED AlertStats type.
 */
export async function getUserAlertStats(userId: number, days = 7): Promise<AlertStats> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Fetch alerts *linked to this user* within the date range
  const alerts = await prisma.alert.findMany({
    where: {
      alertUsers: { some: { userId } }, // Core filter: only alerts linked to this user
      createdAt: { gte: startDate }
    },
    select: {
      type: true, isResolved: true, websiteId: true,
      // Include nested data needed for user-specific websiteName
      website: {
          select: {
              url: true,
              websiteUsers: { // Get the specific link for *this* user's name
                  where: { userId },
                  select: { name: true }
              }
          }
      }
      // No need to select alertUsers here as the top-level where handles the user link
    }
  });

  // Calculate stats (similar logic to getAlertStats, but uses user-specific names)
  const totalAlerts = alerts.length;
  let resolvedAlerts = 0;
  const byType: Partial<Record<AlertType, number>> = {};
  const websiteMap = new Map<number, { websiteId: number, websiteName: string, count: number }>();

  alerts.forEach(alert => {
    if (alert.isResolved) resolvedAlerts++;

    const alertType = alert.type as AlertType;
    if (VALID_ALERT_TYPES.includes(alertType)) {
        byType[alertType] = (byType[alertType] || 0) + 1;
    } else {
         console.warn(`Encountered unknown alert type in getUserAlertStats: ${alert.type}`);
    }

    // Get user-specific name from included relation, fallback to URL
    const customName = alert.website?.websiteUsers?.[0]?.name; // Access the first (and only) element
    const websiteName = customName || alert.website?.url || `Website ${alert.websiteId}`;

    if (!websiteMap.has(alert.websiteId)) {
        websiteMap.set(alert.websiteId, { websiteId: alert.websiteId, websiteName: websiteName, count: 0 });
    }
    websiteMap.get(alert.websiteId)!.count++;
  });

  return {
    totalAlerts,
    resolvedAlerts,
    unresolvedAlerts: totalAlerts - resolvedAlerts,
    byType,
    byWebsite: Array.from(websiteMap.values()).sort((a, b) => b.count - a.count),
  };
}

// Note: The actual cleanup logic for old resolved AlertUser links resides in the scheduler (`scheduler.ts`),
// but it operates on the same Prisma models defined here.