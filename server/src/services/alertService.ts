// server/src/services/alertService.ts

import {
    Website as PrismaWebsite,
    Alert as PrismaAlert,
    WebsiteUser as PrismaWebsiteUser,
    MonitoringResult as PrismaMonitoringResult,
    Prisma,
  } from '@prisma/client';
import { RECHECK_DELAY_SECONDS as CONFIG_RECHECK_DELAY } from '../config/config'; // Assuming this config is still used
import prisma from '../prisma/prismaClient';
import { subHours } from 'date-fns';
import { AlertQueryOptions, AlertType, AlertStats, VALID_ALERT_TYPES, MonitoringResponse } from '../types';
import { WebsiteMonitor, ResultsManager } from './monitoringService';
import { sendMail } from './mailService'; // Import the mail service function

const RECHECK_DELAY_SECONDS = CONFIG_RECHECK_DELAY ?? 60; // Delay for the confirmation check, fallback to 60 seconds

/**
 * Schedules a delayed recheck for a potential alert condition.
 * IMPORTANT: Uses setTimeout, which is NOT recommended for production. Replace with a persistent queue (e.g., BullMQ).
 */
async function scheduleRecheckTask(
    websiteId: number,
    userId: number,
    initialResult: PrismaMonitoringResult,
    potentialType: AlertType // 'down' or 'slow'
): Promise<void> {
    const delayMs = RECHECK_DELAY_SECONDS * 1000;
    const logPrefix = `[Recheck Scheduler U:${userId} W:${websiteId}]`;
    console.log(`${logPrefix} Scheduling ${potentialType} recheck in ${RECHECK_DELAY_SECONDS}s. Initial Result ID: ${initialResult.id}`);

    // Basic setTimeout for demonstration. Replace with a robust queue system.
    setTimeout(async () => {
        console.log(`${logPrefix} Executing delayed ${potentialType} recheck.`);
        try {
            // Fetch fresh data inside the delayed task in case settings changed
            const website = await prisma.website.findUnique({ where: { id: websiteId } });
            // Fetch user settings including notification email
            const websiteUser = await prisma.websiteUser.findUnique({
                where: { userId_websiteId: { userId, websiteId } },
                select: { // Explicitly select all needed fields
                    id: true,
                    createdAt: true,
                    interval: true,
                    isPinned: true,
                    userId: true,
                    websiteId: true,
                    alertEnabled: true,
                    alertThreshold: true,
                    name: true,
                    notifyEmail: true
                }
            });
            // Fetch the result that triggered this recheck again
            const freshInitialResult = await prisma.monitoringResult.findUnique({ where: { id: initialResult.id }});

            // Cancel if website/user deleted, alerts disabled, or original result gone
            if (!website || !websiteUser || !websiteUser.alertEnabled || !freshInitialResult) {
                 console.log(`${logPrefix} Recheck cancelled (website/user not found, alerts disabled, or initial result missing).`);
                 return;
            }
            // Proceed to confirmation check
            await handleRecheckConfirmation(website, websiteUser, freshInitialResult, potentialType); // This call should be correct
        } catch (error) {
            console.error(`${logPrefix} Error during delayed recheck execution:`, error);
        }
    }, delayMs);
}


// --- Core Alert Logic ---

/**
 * Called immediately after a monitoring check potentially indicates an issue ('down' or 'slow').
 * Determines if a recheck is needed based on user settings and schedules it.
 */
export async function handlePotentialAlertCondition(
    website: PrismaWebsite,
    result: PrismaMonitoringResult // The result that was just saved
): Promise<void> {
    const logPrefix = `[Alert Check W:${website.id} R:${result.id}]`;

    // Find all users monitoring this website with alerts enabled
    const usersToPotentiallyAlert = await prisma.websiteUser.findMany({
        where: { websiteId: website.id, alertEnabled: true },
        select: { userId: true, alertThreshold: true, name: true, notifyEmail: true } // Select fields needed for checks and scheduling
    });

    if (usersToPotentiallyAlert.length === 0) { return; } // No users to alert

    console.log(`${logPrefix} Found ${usersToPotentiallyAlert.length} users with alerts enabled. Evaluating conditions...`);

    for (const websiteUser of usersToPotentiallyAlert) {
        const userLogPrefix = `${logPrefix} U:${websiteUser.userId}`;
        let potentialType: AlertType | null = null;

        // Check for DOWN condition
        if (!result.isAvailable) {
            potentialType = 'down';
            console.log(`${userLogPrefix} Potential DOWN condition detected.`);
        }
        // Check for SLOW condition (only if available and threshold is set)
        else if (
            websiteUser.alertThreshold !== null &&
            result.responseTime !== null &&
            result.responseTime > websiteUser.alertThreshold
        ) {
            potentialType = 'slow';
            console.log(`${userLogPrefix} Potential SLOW condition detected (${result.responseTime}ms > ${websiteUser.alertThreshold}ms).`);
        }

        // If a potential issue was found, schedule the recheck
        if (potentialType) {
            await scheduleRecheckTask(website.id, websiteUser.userId, result, potentialType);
        }
    }
}

/**
 * Called *after* the recheck delay via the scheduler (setTimeout in this case).
 * Performs the confirmation check against the live website status.
 * If the condition persists, creates an Alert record and sends an email notification.
 */
async function handleRecheckConfirmation(
    website: PrismaWebsite,
    websiteUser: PrismaWebsiteUser & { notifyEmail?: string | null }, // User settings (including email)
    initialResult: PrismaMonitoringResult, // The result that triggered the recheck
    potentialType: AlertType // The type of issue we are rechecking ('down' or 'slow')
): Promise<void> {
    const logPrefix = `[Alert Confirm U:${websiteUser.userId} W:${website.id}]`;
    console.log(`${logPrefix} Performing ${potentialType} confirmation check.`);

    // Perform the actual recheck NOW
    console.log(`${logPrefix} Performing check via WebsiteMonitor.performWebsiteCheck...`);
    const confirmationResultData: MonitoringResponse = await WebsiteMonitor.performWebsiteCheck(website.url);

    // Save the result of this confirmation check
    let recheckResultDb: PrismaMonitoringResult;
    try {
        recheckResultDb = await ResultsManager.saveResult(website.id, confirmationResultData);
        console.log(`${logPrefix} Recheck Result saved (ID: ${recheckResultDb.id}). Available: ${recheckResultDb.isAvailable}, ResponseTime: ${recheckResultDb.responseTime}ms`);
    } catch (saveError) {
        console.error(`${logPrefix} CRITICAL: Failed to save recheck result:`, saveError);
        // Abort confirmation if we can't even save the result that confirms it
        console.error(`${logPrefix} Aborting alert confirmation due to failure saving recheck result.`);
        return;
    }

    // --- Confirmation Logic: Check if the issue persists ---
    let issueConfirmed = false;
    let confirmedType: AlertType | null = null;
    let message = ''; // Message for the Alert record

    // Confirm DOWN: Was potentially down, and recheck confirms it's still unavailable
    if (potentialType === 'down' && !recheckResultDb.isAvailable) {
        issueConfirmed = true;
        confirmedType = 'down';
        message = `Website is down: ${websiteUser.name || website.url}${recheckResultDb.statusCode ? ` (Status: ${recheckResultDb.statusCode})` : ''}${recheckResultDb.errorMessage ? ` - Error: ${recheckResultDb.errorMessage}` : ''} (Confirmed)`;
        console.log(`${logPrefix} CONFIRMED DOWN.`);
    }
    // Confirm SLOW: Was potentially slow, recheck confirms it's available but still slower than threshold
    else if (
        potentialType === 'slow' &&
        recheckResultDb.isAvailable && // Must be available to be slow
        websiteUser.alertThreshold !== null && // Threshold must be set
        recheckResultDb.responseTime !== null && // Must have a response time
        recheckResultDb.responseTime > websiteUser.alertThreshold // Must exceed threshold
    ) {
        // Also ensure the *initial* check met the slow criteria (prevents alerting if it was briefly slow then recovered before recheck)
        const wasInitialSlow = initialResult.isAvailable && initialResult.responseTime !== null && websiteUser.alertThreshold !== null && initialResult.responseTime > websiteUser.alertThreshold;
        if (wasInitialSlow) {
            issueConfirmed = true;
            confirmedType = 'slow';
            message = `Website is responding slowly: ${websiteUser.name || website.url} (${recheckResultDb.responseTime}ms > ${websiteUser.alertThreshold}ms) (Confirmed)`;
            console.log(`${logPrefix} CONFIRMED SLOW (${recheckResultDb.responseTime}ms > ${websiteUser.alertThreshold}ms).`);
        } else {
            // Log if slow condition wasn't met on initial check or recheck is now fast
            console.log(`${logPrefix} Slow condition NOT confirmed (initial check wasn't slow or recheck is now fast). Initial: ${initialResult.responseTime}ms, Recheck: ${recheckResultDb.responseTime}ms, Threshold: ${websiteUser.alertThreshold}ms`);
        }
    }
    // Condition Not Confirmed
    else {
        console.log(`${logPrefix} ${potentialType.toUpperCase()} condition NOT confirmed by recheck. Recheck Result -> Available: ${recheckResultDb.isAvailable}, ResponseTime: ${recheckResultDb.responseTime}ms`);
    }

    // --- Create Alert and Notify if Confirmed ---
    if (issueConfirmed && confirmedType) {
        // Prevent duplicate active alerts for the same user, website, and type
        const existingAlert = await prisma.alert.findFirst({
            where: { userId: websiteUser.userId, websiteId: website.id, type: confirmedType },
            select: { id: true } // Only need ID to check existence
        });

        if (existingAlert) {
            console.log(`${logPrefix} Skipped ${confirmedType.toUpperCase()} alert creation (Alert ID: ${existingAlert.id} already exists for this user/website/type).`);
            return; // Don't create alert or notify if one already exists
        }

        // Create the Alert record in the database
        let newAlert: PrismaAlert | null = null;
        try {
            newAlert = await prisma.alert.create({
                data: {
                    userId: websiteUser.userId,
                    websiteId: website.id,
                    type: confirmedType,
                    message: message, // Store the confirmation message
                },
            });
            console.log(`${logPrefix} Created ${confirmedType.toUpperCase()} Alert ID: ${newAlert.id}.`);

        } catch (error) {
             // Handle potential race condition where alert was created between findFirst and create
             if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                 console.warn(`${logPrefix} Alert creation race condition likely occurred for ${confirmedType} alert. An alert might already exist now. Skipping notification.`);
                 return; // Don't proceed to notify if alert creation failed due to race condition
             } else {
                 console.error(`${logPrefix} Error creating ${confirmedType.toUpperCase()} alert:`, error);
                 return; // Stop processing if alert creation fails for other reasons
             }
        }

        // --- Send Email Notification ---
        // Check if alert was created, if type is 'down' or 'slow', and if user has an email
        console.log(`${logPrefix} Checking email condition. Alert created: ${!!newAlert}, Type: ${confirmedType}, User Email: '${websiteUser.notifyEmail}'`); // Keep this log for debugging
        if (newAlert && (confirmedType === 'down' || confirmedType === 'slow') && websiteUser.notifyEmail) { // Combined check for 'down' OR 'slow'
            let emailSubject = '';
            let emailBody = '';

            // Customize content based on the alert type
            if (confirmedType === 'down') {
                emailSubject = `🔴 CONFIRMED DOWN: ${websiteUser.name || website.url}`;
                emailBody = `
                    <p>Your monitored website <strong>${websiteUser.name || website.url}</strong> is confirmed to be down.</p>
                    <p>
                        Status Code: ${recheckResultDb.statusCode ?? 'N/A'}<br>
                        Error Message: ${recheckResultDb.errorMessage ?? 'No specific error reported'}<br>
                        Time Confirmed: ${new Date().toLocaleString()}
                    </p>
                    <p>Alert ID: ${newAlert.id}</p>
                    <p>Please check the dashboard for status updates. Note: Recovery emails are not sent by this system.</p>`;
            } else { // confirmedType === 'slow'
                emailSubject = `🟠 CONFIRMED SLOW: ${websiteUser.name || website.url}`;
                emailBody = `
                    <p>Your monitored website <strong>${websiteUser.name || website.url}</strong> is confirmed to be responding slowly.</p>
                    <p>
                        Response Time: ${recheckResultDb.responseTime}ms (Threshold: ${websiteUser.alertThreshold}ms)<br>
                        Time Confirmed: ${new Date().toLocaleString()}
                    </p>
                    <p>Alert ID: ${newAlert.id}</p>
                    <p>Please check the dashboard for status updates.</p>`;
            }

            // Attempt to send the email
            try {
                console.log(`${logPrefix} Attempting to send ${confirmedType} email alert to ${websiteUser.notifyEmail}`);
                await sendMail({
                    to: websiteUser.notifyEmail,
                    subject: emailSubject,
                    html: emailBody
                });
                 console.log(`${logPrefix} Successfully sent ${confirmedType} email alert to ${websiteUser.notifyEmail}`);
            } catch (emailError) {
                // Log failure, but don't stop execution (alert is already created)
                console.error(`${logPrefix} Failed to send ${confirmedType} email notification for Alert ID ${newAlert.id}:`, emailError);
            }
        // Log if email was skipped because user has no notification email set
        } else if (newAlert && !websiteUser.notifyEmail) {
            console.log(`${logPrefix} Skipped email notification for Alert ID ${newAlert.id} (User has no notification email configured).`);
        }
        // --- End Email Notification Block ---

    } // End if(issueConfirmed && confirmedType)
}


// --- Data Fetching & Actions for API Endpoints ---

/**
 * Get *active* alerts for a specific user, with optional filtering.
 */
export async function getAlertsForUser(
    userId: number,
    options: AlertQueryOptions = {}
): Promise<PrismaAlert[]> {
    const { limit = 50, type, from, to, websiteId } = options;
    const whereClause: Prisma.AlertWhereInput = { userId };

    if (type && VALID_ALERT_TYPES.includes(type)) whereClause.type = type;
    if (from || to) {
        whereClause.createdAt = {};
        if (from) whereClause.createdAt.gte = from;
        if (to) whereClause.createdAt.lte = to;
    }
    if (websiteId !== undefined) whereClause.websiteId = websiteId;

    return prisma.alert.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            website: {
                select: {
                    id: true, url: true,
                    // Include user's custom name for this website
                    websiteUsers: {
                        where: { userId },
                        select: { name: true }
                    }
                }
            },
        }
    });
}

/**
 * Get *active* alerts for a specific website.
 * Requires user access check in the controller before calling this.
 */
export async function getAlertsByWebsite(
    websiteId: number,
    options: AlertQueryOptions = {}
): Promise<PrismaAlert[]> {
    const { limit = 50, type, from, to } = options;
    const whereClause: Prisma.AlertWhereInput = { websiteId };

    if (type && VALID_ALERT_TYPES.includes(type)) whereClause.type = type;
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
             website: { select: { id: true, url: true } },
             user: { select: { id: true, name: true, email: true } } // Include user details for context
         }
    });
}

/**
 * Dismisses (deletes) a specific alert if it belongs to the requesting user.
 */
export async function dismissAlert(
    userId: number,
    alertId: number
): Promise<PrismaAlert | null> {
    const logPrefix = `[Alert Dismiss U:${userId} A:${alertId}]`;
    console.log(`${logPrefix} Attempting to dismiss alert.`);

    // Find the alert first to check ownership
    const alert = await prisma.alert.findUnique({
        where: { id: alertId },
        select: { userId: true } // Only need userId for check
    });

    // Alert not found
    if (!alert) {
        console.log(`${logPrefix} Alert not found.`);
        return null;
    }

    // Check if the user requesting dismissal owns the alert
    if (alert.userId !== userId) {
        console.warn(`${logPrefix} User does not own this alert. Dismissal denied.`);
        // Throw an error to be caught by the controller for a 403 response
        throw new Error('Forbidden: User does not own this alert');
    }

    // Proceed with deletion
    try {
        const deletedAlert = await prisma.alert.delete({
            where: { id: alertId }
        });
        console.log(`${logPrefix} Alert successfully dismissed.`);
        return deletedAlert;
    } catch (error) {
        // Handle case where the alert was already deleted (e.g., race condition)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            console.log(`${logPrefix} Alert was already deleted.`);
            return null; // Not an error, just nothing to delete
        }
        // Rethrow other database errors
        console.error(`${logPrefix} Error dismissing alert:`, error);
        throw error;
    }
}

/**
 * Get *active* alert statistics for a specific user over a given period.
 */
export async function getUserAlertStats(userId: number, days = 7): Promise<AlertStats> {
    const startDate = subHours(new Date(), days * 24); // Calculate start date based on days ago

    const alerts = await prisma.alert.findMany({
        where: {
            userId: userId,
            createdAt: { gte: startDate }
        },
        select: {
            type: true,
            websiteId: true,
            website: {
                select: {
                     url: true,
                     // Get user's custom name for this website
                     websiteUsers: {
                         where: { userId },
                         select: { name: true }
                    }
                 }
            }
        }
    });

    const totalAlerts = alerts.length;
    const byType: Partial<Record<AlertType, number>> = {}; // Count alerts by type ('down', 'slow')
    // Map to aggregate counts by website, using custom name if available
    const websiteMap = new Map<number, { websiteId: number, websiteName: string, count: number }>();

    alerts.forEach(alert => {
        const alertType = alert.type as AlertType;
        // Increment count for this alert type
        byType[alertType] = (byType[alertType] || 0) + 1;

        // Determine website name (custom name first, then URL)
        const customName = alert.website?.websiteUsers?.[0]?.name;
        const websiteName = customName || alert.website?.url || `Website ${alert.websiteId}`;

        // Aggregate counts per website
        if (!websiteMap.has(alert.websiteId)) {
            websiteMap.set(alert.websiteId, { websiteId: alert.websiteId, websiteName: websiteName, count: 0 });
        }
        websiteMap.get(alert.websiteId)!.count++;
    });

    // Convert map to array and sort by count descending
    const byWebsite = Array.from(websiteMap.values()).sort((a, b) => b.count - a.count);

    return { totalAlerts, byType, byWebsite };
}


/**
 * Gets the count of 'down' or 'slow' alerts created in the last 24 hours for a specific user.
 */
export async function getUserIncidentCountLast24h(userId: number): Promise<number> {
    const twentyFourHoursAgo = subHours(new Date(), 24);

    const count = await prisma.alert.count({
        where: {
            userId: userId,
            type: {
                in: ['down', 'slow'], // Only count incident types
            },
            createdAt: {
                gte: twentyFourHoursAgo, // Within the last 24 hours
            },
        },
    });

    return count;
}