// server/src/services/alertService.ts

import {
  Website as PrismaWebsite,
  Alert as PrismaAlert,
  WebsiteUser as PrismaWebsiteUser,
  AlertUser as PrismaAlertUser,
  MonitoringResult as PrismaMonitoringResult, // Ensure this is imported
  Prisma, // Keep Prisma namespace for types like BatchPayload and WhereInput
} from '@prisma/client';
import { emailTransporter, EMAIL_FROM } from '../config/config'; // Ensure path is correct
import prisma from '../prisma/prismaClient'; // Ensure path is correct
import {
  AlertQueryOptions,
  AlertType,
  AlertStats,
} from '../types'; // Ensure path is correct

// --- Define Backend-Internal Types ---
interface EmailAlertOptions {
    to: string;
    subject: string;
    body: string;
}

// Define valid alert types used in this service
const VALID_ALERT_TYPES: AlertType[] = ["down", "slow", "recovered", "ssl", "dns"];

// --- Utility Functions ---
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
 * Creates an Alert record and links it via AlertUser to all users
 * who have alerts enabled for the given website. Uses upsert for safety.
 */
async function createAlert(websiteId: number, type: AlertType, message: string): Promise<PrismaAlert> {
    if (!VALID_ALERT_TYPES.includes(type)) {
        throw new Error(`Invalid alert type provided to createAlert: ${type}`);
    }
    console.log(`[Alert Create] Creating '${type}' alert for website ${websiteId}: "${message}"`);

    try {
        return await prisma.$transaction(async (tx) => {
            // 1. Create the core Alert record
            const alert = await tx.alert.create({
                data: { websiteId, type, message, isResolved: false, createdAt: new Date() },
            });

            // 2. Find users with alerts enabled for this website
            const websiteUsersToNotify = await tx.websiteUser.findMany({
                where: { websiteId, alertEnabled: true },
                select: { userId: true } // Only need the ID for linking
            });

            // 3. Link the alert to each user via AlertUser (if any users found)
            if (websiteUsersToNotify.length > 0) {
                const userLinkPromises = websiteUsersToNotify.map(websiteUser =>
                    tx.alertUser.upsert({ // Use upsert to prevent duplicates if called rapidly
                        where: { userId_alertId: { userId: websiteUser.userId, alertId: alert.id } },
                        update: {}, // If link exists, do nothing
                        create: { userId: websiteUser.userId, alertId: alert.id, isRead: false, createdAt: new Date() }
                    })
                );
                await Promise.all(userLinkPromises);
                console.log(`[Alert Create] Linked alert ${alert.id} to ${websiteUsersToNotify.length} users.`);
            } else {
                console.log(`[Alert Create] No users with alerts enabled for website ${websiteId}. Alert ${alert.id} created but not linked.`);
            }
            return alert; // Return the created Alert object
        });
    } catch (error) {
        console.error(`[Alert Create] Error during transaction for website ${websiteId}, type ${type}:`, error);
        throw error; // Re-throw error after logging
    }
}

/**
 * Sends an email notification.
 */
export async function sendEmailAlert({ to, subject, body }: EmailAlertOptions): Promise<void> {
    if (!emailTransporter) {
        console.warn(`[Email] Transporter not configured. Skipping email to: ${to}`);
        return;
    }
    try {
        await emailTransporter.sendMail({ from: EMAIL_FROM, to, subject, html: body });
        console.log(`[Email] Alert sent successfully to ${to}`);
    } catch (error) {
        console.error(`[Email] Failed to send alert email to ${to}:`, error);
        // Consider adding to a retry queue or logging more details
    }
}


// --- Alert Handling Logic (Triggered by Monitoring Service after checks) ---

/**
 * Creates a 'down' alert if not already present and unresolved for the user.
 * Called by processAlerts only when downtime is confirmed.
 */
async function handleDowntimeAlert(
    website: PrismaWebsite,
    websiteUser: PrismaWebsiteUser, // User context needed for notification preferences
    statusCode: number | null,      // From the second (confirming) check
    errorMessage: string | null     // From the second (confirming) check
): Promise<void> {
    const logPrefix = `[Alert Handler U:${websiteUser.userId} W:${website.id}]`; // Prefix for user/website context
    // Prevent spamming: Check if user already has an active (unresolved) 'down' alert
    const existingUnresolvedAlertUser = await prisma.alertUser.findFirst({
        where: { userId: websiteUser.userId, alert: { websiteId: website.id, type: 'down', isResolved: false } },
        select: { id: true } // Minimal select
    });

    if (existingUnresolvedAlertUser) {
        console.log(`${logPrefix} Skipped DOWN alert (already active).`);
        return; // Don't create/notify again if already active
    }

    // Construct the alert message
    const alertMessage = `Website is down: ${websiteUser.name || website.url}${statusCode ? ` (Status: ${statusCode})` : ''}${errorMessage ? ` - Error: ${errorMessage}` : ''} (Confirmed)`;

    try {
        // Create the core alert (which links all enabled users)
        const alert = await createAlert(website.id, 'down', alertMessage);
        console.log(`${logPrefix} Created DOWN Alert ID: ${alert.id}.`);

        // Send email notification *only to this specific user* if they have it enabled
        if (websiteUser.notifyEmail && emailTransporter) {
            const emailBody = `
            <p>Your monitored website <strong>${websiteUser.name || website.url}</strong> is confirmed to be down.</p>
            <p>
                Status Code: ${statusCode ?? 'N/A'}<br>
                Error Message: ${errorMessage ?? 'No specific error reported'}<br>
                Time Confirmed: ${new Date().toLocaleString()}
            </p>
            <p>We will notify you when it recovers.</p>
            <p>Alert ID: ${alert.id}</p>
            `;
            await sendEmailAlert({
                to: websiteUser.notifyEmail,
                subject: `🔴 CONFIRMED DOWN: ${websiteUser.name || website.url}`,
                body: emailBody
            });
        }
    } catch (error) {
        console.error(`${logPrefix} Error creating/notifying DOWN alert:`, error);
    }
}

/**
 * Resolves existing 'down' alerts for a website when it recovers.
 * Sends recovery notifications to relevant users. Triggered by processAlerts.
 */
async function resolveExistingDowntimeAlerts(
    websiteId: number,
    responseTime: number | null, // From the recovery check
    statusCode: number | null    // From the recovery check
): Promise<void> {
    const logPrefix = `[Alert Resolver W:${websiteId}]`;
    // Find all 'down' alerts for this website that are not yet resolved
    const unresolvedDownAlerts = await prisma.alert.findMany({
        where: { websiteId: websiteId, type: 'down', isResolved: false },
        include: {
            alertUsers: { select: { userId: true } }, // Get users originally linked
            website: { select: { url: true } }        // Get URL for email context
        }
    });

    if (unresolvedDownAlerts.length === 0) {
        // console.log(`${logPrefix} No unresolved DOWN alerts found.`); // Can uncomment if needed
        return; // Nothing to resolve
    }

    console.log(`${logPrefix} Resolving ${unresolvedDownAlerts.length} DOWN alerts.`);
    const now = new Date();
    const alertIdsToResolve = unresolvedDownAlerts.map(a => a.id);

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Mark the core Alert records as resolved
            await tx.alert.updateMany({
                where: { id: { in: alertIdsToResolve } },
                data: { isResolved: true, resolvedAt: now }
            });

            // 2. Prepare and send recovery notifications
            const userIdsToPotentiallyNotify = new Set<number>();
            unresolvedDownAlerts.forEach(alert => alert.alertUsers.forEach(au => userIdsToPotentiallyNotify.add(au.userId)));

            if (userIdsToPotentiallyNotify.size === 0) {
                console.log(`${logPrefix} No users linked to resolved alerts.`);
                return; // No users were linked
            }

            // Fetch current settings for these users for *this specific website*
            const relevantWebsiteUsers = await tx.websiteUser.findMany({
                where: {
                    websiteId: websiteId,
                    userId: { in: Array.from(userIdsToPotentiallyNotify) },
                    alertEnabled: true, // Ensure they still want alerts
                    notifyEmail: { not: null } // Ensure they have an email set
                },
                select: { userId: true, name: true, notifyEmail: true }
            });

            // Create a map for easy lookup
            const websiteUserMap = new Map(relevantWebsiteUsers.map(wu => [wu.userId, wu]));
            console.log(`${logPrefix} Found ${websiteUserMap.size} users eligible for RECOVERY notification.`);

            // Send emails based on the *original* alert and *current* user settings
            for (const resolvedAlert of unresolvedDownAlerts) {
                const websiteUrl = resolvedAlert.website.url;
                for (const alertUserLink of resolvedAlert.alertUsers) {
                    const userId = alertUserLink.userId;
                    const websiteUser = websiteUserMap.get(userId); // Check if user still wants email alerts

                    if (websiteUser?.notifyEmail && emailTransporter) {
                        const duration = getTimeDifferenceString(resolvedAlert.createdAt, now);
                        const emailBody = `
                            <p>Your monitored website <strong>${websiteUser.name || websiteUrl}</strong> is back online!</p>
                            <p>
                                Status Code: ${statusCode ?? 'N/A'}<br>
                                Response Time: ${responseTime !== null ? `${responseTime}ms` : 'N/A'}<br>
                                Recovered At: ${now.toLocaleString()}<br>
                                Approx. Downtime Duration: ${duration}
                            </p>
                            <p>Original Alert ID: ${resolvedAlert.id}</p>`;
                        // Fire and forget email sending within the loop for performance
                        sendEmailAlert({
                            to: websiteUser.notifyEmail,
                            subject: `✅ RECOVERED: ${websiteUser.name || websiteUrl}`,
                            body: emailBody
                        }).catch(err => console.error(`${logPrefix} Failed recovery email for alert ${resolvedAlert.id}, user ${userId}:`, err));
                    }
                }
            }
        });
         console.log(`${logPrefix} Finished resolving DOWN alerts.`);
    } catch (error) {
        console.error(`${logPrefix} Error resolving DOWN alerts transaction:`, error);
    }
}

/**
 * Creates a 'slow' alert if not already present and unresolved for the user.
 * Called by processAlerts only when slowness is confirmed.
 */
async function handleSlowResponseAlert(
    website: PrismaWebsite,
    websiteUser: PrismaWebsiteUser, // User context needed for threshold and notification preferences
    responseTime: number            // From the second (confirming) check
): Promise<void> {
    const logPrefix = `[Alert Handler U:${websiteUser.userId} W:${website.id}]`;
    const userThreshold = websiteUser.alertThreshold;
    // This check should technically be redundant as processAlerts verifies this before calling, but good for safety
    if (userThreshold === null || responseTime <= userThreshold) {
        console.warn(`${logPrefix} handleSlowResponseAlert called incorrectly for user ${websiteUser.userId}, website ${website.id}. Response time ${responseTime} not > threshold ${userThreshold}`);
        return;
    }

    // Prevent spamming
    const existingUnresolvedAlertUser = await prisma.alertUser.findFirst({
        where: { userId: websiteUser.userId, alert: { websiteId: website.id, type: 'slow', isResolved: false } },
        select: { id: true }
    });
    if (existingUnresolvedAlertUser) {
         console.log(`${logPrefix} Skipped SLOW alert (already active).`);
         return;
    }

    const alertMessage = `Website is responding slowly: ${websiteUser.name || website.url} (${responseTime}ms > ${userThreshold}ms) (Confirmed)`;
    try {
        const alert = await createAlert(website.id, 'slow', alertMessage);
        console.log(`${logPrefix} Created SLOW Alert ID: ${alert.id}.`);
        if (websiteUser.notifyEmail && emailTransporter) {
            const emailBody = `<p>Your monitored website <strong>${websiteUser.name || website.url}</strong> is confirmed to be responding slowly.</p><p>Current Response Time: ${responseTime}ms (Threshold: ${userThreshold}ms)<br>Time Confirmed: ${new Date().toLocaleString()}</p><p>We will notify you if the speed improves.</p><p>Alert ID: ${alert.id}</p>`;
            await sendEmailAlert({ to: websiteUser.notifyEmail, subject: `⚠️ CONFIRMED SLOW: ${websiteUser.name || website.url}`, body: emailBody });
        }
    } catch (error) {
        console.error(`${logPrefix} Error creating/notifying SLOW alert:`, error);
    }
}

/**
 * Resolves 'slow' alerts *for a specific user* when the website speeds up below their threshold.
 * Triggered by processAlerts.
 */
async function resolveSlowResponseAlerts(
    website: PrismaWebsite,
    websiteUser: PrismaWebsiteUser, // User context for threshold
    responseTime: number           // Current (fast) response time
): Promise<void> {
    const logPrefix = `[Alert Resolver U:${websiteUser.userId} W:${website.id}]`;
    const userThreshold = websiteUser.alertThreshold;

    // Check if resolution is needed/possible
    if (!websiteUser.alertEnabled || userThreshold === null || responseTime > userThreshold) {
        return; // No threshold, alerts disabled, or still slow
    }

    // Find *this user's* unresolved 'slow' AlertUser links for this website
    const userSlowAlertLinks = await prisma.alertUser.findMany({
        where: {
            userId: websiteUser.userId,
            alert: { websiteId: website.id, type: 'slow', isResolved: false }
        },
        select: { alertId: true } // Select the ID of the Alert record to update
    });

    if (userSlowAlertLinks.length > 0) {
        const alertIdsToResolve = userSlowAlertLinks.map(link => link.alertId);
        console.log(`${logPrefix} Resolving ${alertIdsToResolve.length} SLOW alerts.`);

        try {
            // Mark the corresponding Alert records as resolved
            const updateResult = await prisma.alert.updateMany({
                where: { id: { in: alertIdsToResolve } },
                data: { isResolved: true, resolvedAt: new Date() }
            });
            console.log(`${logPrefix} Marked ${updateResult.count} SLOW alerts as resolved.`);

            // Optionally send speed recovery email notification
            if (websiteUser.notifyEmail && emailTransporter) {
                const emailBody = `
                <p>Your monitored website <strong>${websiteUser.name || website.url}</strong>'s response time has recovered.</p>
                <p>
                    Current Response Time: ${responseTime}ms (Threshold: ${userThreshold}ms)<br>
                    Time Detected: ${new Date().toLocaleString()}
                </p>`;
                await sendEmailAlert({
                    to: websiteUser.notifyEmail,
                    subject: `✅ SPEED RECOVERED: ${websiteUser.name || website.url}`,
                    body: emailBody
                });
            }
        } catch (error) {
            console.error(`${logPrefix} Error resolving SLOW alerts:`, error);
        }
    } else {
       // console.log(`${logPrefix} No active SLOW alerts found to resolve.`); // Verbose log
    }
}


// --- processAlerts (Main Logic Called by Monitoring Service) ---
/**
 * Processes alerts based on two consecutive check results or a single recovery check.
 * Compares results and triggers appropriate handlers (handle...Alert) or resolvers (resolve...).
 */
export async function processAlerts(
    website: PrismaWebsite,
    websiteUser: PrismaWebsiteUser,              // User context (threshold, settings)
    firstResult: PrismaMonitoringResult | null, // Result of the first check (null if recovery only)
    secondResult: PrismaMonitoringResult         // Result of the second check (or the single OK check)
): Promise<void> {
    // *** LOGGING START ***
    const logPrefix = `[Alert Proc U:${websiteUser.userId} W:${website.id}]`;
    const result1Id = firstResult?.id ?? 'N/A';
    const result2Id = secondResult.id;
    console.log(`${logPrefix} Comparing Result1(ID ${result1Id}) with Result2(ID ${result2Id}).`);
    // *** LOGGING END ***

    try {
        if (!websiteUser.alertEnabled) {
             console.log(`${logPrefix} Skipped (Alerts Disabled).`); // Log skip reason
             return;
        }

        const isCurrentAvailable = secondResult.isAvailable;
        const currentResponseTime = secondResult.responseTime;
        const userThreshold = websiteUser.alertThreshold;

        // --- Scenario 1: Comparing two checks (firstResult is provided) ---
        if (firstResult) {
            const isFirstAvailable = firstResult.isAvailable;
            const firstResponseTime = firstResult.responseTime;

            // A) Confirmed DOWN: First DOWN, Second DOWN
            if (!isFirstAvailable && !isCurrentAvailable) {
                console.log(`${logPrefix} Outcome: Confirmed DOWN.`); // Log decision
                await handleDowntimeAlert(website, websiteUser, secondResult.statusCode, secondResult.errorMessage);
                return; // Primary condition met
            }

            // B) Recovered from DOWN: First DOWN, Second UP
            if (!isFirstAvailable && isCurrentAvailable) {
                console.log(`${logPrefix} Outcome: Recovered from DOWN.`); // Log decision
                await resolveExistingDowntimeAlerts(website.id, currentResponseTime, secondResult.statusCode);
                // Check if it recovered but is now SLOW
                if (userThreshold !== null && currentResponseTime !== null && currentResponseTime > userThreshold) {
                    console.log(`${logPrefix} Outcome: Recovered DOWN but now SLOW.`); // Log decision
                    await handleSlowResponseAlert(website, websiteUser, currentResponseTime);
                }
                return; // Recovery handled
            }

            // --- Conditions below assume First Check was Available ---
            if (isFirstAvailable) {
                // C) Confirmed SLOW: First UP+SLOW, Second UP+SLOW
                // Requires site to be UP on second check too, threshold exists, times exist, and both times > threshold
                if (isCurrentAvailable && userThreshold !== null && firstResponseTime !== null && currentResponseTime !== null) {
                    const wasFirstSlow = firstResponseTime > userThreshold;
                    const isCurrentSlow = currentResponseTime > userThreshold;
                    if (wasFirstSlow && isCurrentSlow) {
                        console.log(`${logPrefix} Outcome: Confirmed SLOW.`); // Log decision
                        await handleSlowResponseAlert(website, websiteUser, currentResponseTime);
                        return; // Confirmed slow handled
                    }
                }

                // D) Recovered from SLOW: First UP+SLOW, Second UP+FAST
                // Requires site to be UP on second check too, threshold exists, times exist, first > threshold, second <= threshold
                if (isCurrentAvailable && userThreshold !== null && firstResponseTime !== null && currentResponseTime !== null) {
                    const wasFirstSlow = firstResponseTime > userThreshold;
                    const isCurrentFast = currentResponseTime <= userThreshold;
                    if (wasFirstSlow && isCurrentFast) {
                        console.log(`${logPrefix} Outcome: Recovered from SLOW.`); // Log decision
                        await resolveSlowResponseAlerts(website, websiteUser, currentResponseTime);
                        return; // Recovered from slow handled
                    }
                }

                // E) Transitioned to SLOW: First UP+FAST, Second UP+SLOW
                // No alert triggered here. The *next* check cycle's comparison will handle confirmation.
                if (isCurrentAvailable && userThreshold !== null && firstResponseTime !== null && currentResponseTime !== null) {
                     const wasFirstFast = firstResponseTime <= userThreshold;
                     const isCurrentSlow = currentResponseTime > userThreshold;
                     if (wasFirstFast && isCurrentSlow) {
                         console.log(`${logPrefix} Outcome: Transitioned FAST -> SLOW. (No immediate alert)`); // Log decision
                         // No immediate alert action needed for this transition
                     }
                 }
            } // End of 'if (isFirstAvailable)'

             // F) Other cases like UP+FAST -> UP+FAST, or transitions involving unavailable second check after UP first check
             // do not trigger new alerts or standard resolutions based on this comparison logic.
             else {
                 // Log if no other condition was explicitly met after comparison
                 console.log(`${logPrefix} Outcome: No specific alert/recovery condition met based on comparison of two checks.`);
             }

        }
        // --- Scenario 2: Processing recovery after a single OK check (firstResult is null) ---
        else {
            // console.log(`${logPrefix} Processing in Recovery Mode (Result2 ID: ${result2Id}).`); // Can uncomment if needed

            // A) Resolve any existing DOWN alerts since the current check is UP
            if (isCurrentAvailable) {
                 // console.log(`${logPrefix} Outcome (Recovery): Resolving potential DOWN alerts.`); // Can uncomment if needed
                 await resolveExistingDowntimeAlerts(website.id, currentResponseTime, secondResult.statusCode);
            }
            // B) Resolve SLOW alerts if current check is FAST ENOUGH for this user
            if (isCurrentAvailable && userThreshold !== null && currentResponseTime !== null && currentResponseTime <= userThreshold) {
                 // console.log(`${logPrefix} Outcome (Recovery): Resolving potential SLOW alerts.`); // Can uncomment if needed
                 await resolveSlowResponseAlerts(website, websiteUser, currentResponseTime);
            }
        }

    } catch (error) {
        console.error(`${logPrefix} CRITICAL Error processing alerts:`, error);
    }
} // --- End processAlerts ---


// --- Data Fetching & Actions for API Endpoints ---

/**
 * Get recent alerts system-wide with optional filtering. (Admin/Internal use likely)
 */
export async function getRecentAlerts(options: AlertQueryOptions = {}): Promise<PrismaAlert[]> {
    const { limit = 50, type, from, to, isResolved } = options;
    const whereClause: Prisma.AlertWhereInput = {};

    if (type && VALID_ALERT_TYPES.includes(type)) whereClause.type = type;
    if (from || to) {
        whereClause.createdAt = {};
        if (from) whereClause.createdAt.gte = from;
        if (to) whereClause.createdAt.lte = to;
    }
    if (isResolved !== undefined) whereClause.isResolved = isResolved;

    return prisma.alert.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { website: { select: { id: true, url: true } } }
    });
}

/**
 * Get alerts for a specific website with optional filtering.
 */
export async function getAlertsByWebsite(
    websiteId: number,
    options: AlertQueryOptions = {}
): Promise<PrismaAlert[]> {
    const { limit = 50, type, from, to, isResolved } = options;
    const whereClause: Prisma.AlertWhereInput = { websiteId };

    if (type && VALID_ALERT_TYPES.includes(type)) whereClause.type = type;
    if (from || to) {
        whereClause.createdAt = {};
        if (from) whereClause.createdAt.gte = from;
        if (to) whereClause.createdAt.lte = to;
    }
    if (isResolved !== undefined) whereClause.isResolved = isResolved;

    return prisma.alert.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { website: { select: { id: true, url: true } } }
    });
}

/**
 * Get alerts relevant to a specific user, including their read status.
 */
export async function getAlertsForUser(
    userId: number,
    options: AlertQueryOptions = {}
): Promise<PrismaAlert[]> {
    const { limit = 50, type, from, to, isResolved, isRead } = options;
    const whereClause: Prisma.AlertWhereInput = {
        alertUsers: { some: { userId } } // Base filter: must be linked to the user
    };

    if (type && VALID_ALERT_TYPES.includes(type)) whereClause.type = type;
    if (from || to) {
        whereClause.createdAt = {};
        if (from) whereClause.createdAt.gte = from;
        if (to) whereClause.createdAt.lte = to;
    }
    if (isResolved !== undefined) whereClause.isResolved = isResolved;
    if (isRead !== undefined) {
        whereClause.alertUsers = { some: { userId, isRead } };
    }

    return prisma.alert.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            website: {
                select: {
                    id: true, url: true,
                    websiteUsers: { where: { userId }, select: { name: true } }
                }
            },
            alertUsers: {
                where: { userId },
                select: { isRead: true, id: true }
            }
        }
    });
}

/**
 * Get *unread* AlertUser records for a user, including nested Alert/Website data.
 */
export async function getUserUnreadAlerts(
    userId: number,
    options: AlertQueryOptions = {}
): Promise<PrismaAlertUser[]> {
    const { limit = 50, type, from, to, isResolved } = options;

    const whereClause: Prisma.AlertUserWhereInput = {
        userId,
        isRead: false,
        alert: {
            ...(type && VALID_ALERT_TYPES.includes(type) && { type }),
            ...(isResolved !== undefined && { isResolved }),
            ...( (from || to) && {
                createdAt: {
                    ...(from && { gte: from }),
                    ...(to && { lte: to })
                }
            })
        }
    };

    return prisma.alertUser.findMany({
        where: whereClause,
        orderBy: { alert: { createdAt: 'desc' } },
        take: limit,
        include: {
            alert: {
                include: {
                    website: {
                        select: {
                            id: true, url: true,
                            websiteUsers: { where: { userId }, select: { name: true } }
                        }
                    }
                }
            }
        }
    });
}

/**
 * Mark a specific alert as read for a specific user.
 */
export async function markAlertAsRead(
    userId: number,
    alertId: number
): Promise<Prisma.BatchPayload> {
    console.log(`[API Action] Marking alert ${alertId} as read for user ${userId}`);
    return prisma.alertUser.updateMany({
        where: { userId, alertId, isRead: false },
        data: { isRead: true }
    });
}

/**
 * Mark all alerts as read for a specific user.
 */
export async function markAllAlertsAsRead(userId: number): Promise<Prisma.BatchPayload> {
    console.log(`[API Action] Marking all alerts as read for user ${userId}`);
    return prisma.alertUser.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true }
    });
}

/**
 * Deletes the link between a user and an alert (dismisses alert for user).
 */
export async function deleteAlertForUser(
    userId: number,
    alertId: number
): Promise<Prisma.BatchPayload> {
    console.log(`[API Action] Dismissing alert ${alertId} for user ${userId}`);
    return prisma.alertUser.deleteMany({
        where: { userId, alertId }
    });
}

/**
 * Get overall alert statistics for a given period. Maps to shared AlertStats.
 */
export async function getAlertStats(days = 7): Promise<AlertStats> {
    const startDate = new Date(); startDate.setDate(startDate.getDate() - days); startDate.setHours(0, 0, 0, 0);
    const alerts = await prisma.alert.findMany({
        where: { createdAt: { gte: startDate } },
        select: { type: true, isResolved: true, websiteId: true, website: { select: { url: true } } }
    });

    const totalAlerts = alerts.length;
    let resolvedAlerts = 0;
    const byType: Partial<Record<AlertType, number>> = {};
    const websiteMap = new Map<number, { websiteId: number, websiteName: string, count: number }>();

    alerts.forEach(alert => {
        if (alert.isResolved) resolvedAlerts++;
        const alertType = alert.type as AlertType;
        if (VALID_ALERT_TYPES.includes(alertType)) { byType[alertType] = (byType[alertType] || 0) + 1; }
        else { console.warn(`Encountered unknown alert type in getAlertStats: ${alert.type}`); }
        const websiteName = alert.website?.url ?? `Website ${alert.websiteId}`;
        if (!websiteMap.has(alert.websiteId)) { websiteMap.set(alert.websiteId, { websiteId: alert.websiteId, websiteName: websiteName, count: 0 }); }
        websiteMap.get(alert.websiteId)!.count++;
    });

    return {
        totalAlerts, resolvedAlerts,
        unresolvedAlerts: totalAlerts - resolvedAlerts,
        byType,
        byWebsite: Array.from(websiteMap.values()).sort((a, b) => b.count - a.count),
    };
}

/**
 * Get alert statistics for a specific user over a given period. Maps to shared AlertStats.
 */
export async function getUserAlertStats(userId: number, days = 7): Promise<AlertStats> {
    const startDate = new Date(); startDate.setDate(startDate.getDate() - days); startDate.setHours(0, 0, 0, 0);
    const alerts = await prisma.alert.findMany({
        where: { alertUsers: { some: { userId } }, createdAt: { gte: startDate } },
        select: {
            type: true, isResolved: true, websiteId: true,
            website: { select: { url: true, websiteUsers: { where: { userId }, select: { name: true } } } }
        }
    });

    const totalAlerts = alerts.length;
    let resolvedAlerts = 0;
    const byType: Partial<Record<AlertType, number>> = {};
    const websiteMap = new Map<number, { websiteId: number, websiteName: string, count: number }>();

    alerts.forEach(alert => {
        if (alert.isResolved) resolvedAlerts++;
        const alertType = alert.type as AlertType;
        if (VALID_ALERT_TYPES.includes(alertType)) { byType[alertType] = (byType[alertType] || 0) + 1; }
        else { console.warn(`Encountered unknown alert type in getUserAlertStats: ${alert.type}`); }
        const customName = alert.website?.websiteUsers?.[0]?.name;
        const websiteName = customName || alert.website?.url || `Website ${alert.websiteId}`;
        if (!websiteMap.has(alert.websiteId)) { websiteMap.set(alert.websiteId, { websiteId: alert.websiteId, websiteName: websiteName, count: 0 }); }
        websiteMap.get(alert.websiteId)!.count++;
    });

    return {
        totalAlerts, resolvedAlerts,
        unresolvedAlerts: totalAlerts - resolvedAlerts,
        byType,
        byWebsite: Array.from(websiteMap.values()).sort((a, b) => b.count - a.count),
    };
}