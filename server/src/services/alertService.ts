// server/src/services/alertService.ts
import {
    Website as PrismaWebsite,
    Alert as PrismaAlert,
    WebsiteUser as PrismaWebsiteUser, // Keep the full Prisma type
    MonitoringResult as PrismaMonitoringResult,
    Prisma,
    Incident as PrismaIncident, // Import Incident
} from '@prisma/client';
import { RECHECK_DELAY_SECONDS as CONFIG_RECHECK_DELAY } from '../config/config';
import prisma from '../prisma/prismaClient';
import { subHours, differenceInSeconds } from 'date-fns';
import { AlertQueryOptions, AlertType, AlertStats, VALID_ALERT_TYPES, MonitoringResponse, IncidentType } from '../types'; // Added IncidentType
import { WebsiteMonitor, ResultsManager } from './monitoringService';
import * as IncidentService from './incidentService';
import { sendMail } from './mailService';

const RECHECK_DELAY_SECONDS = CONFIG_RECHECK_DELAY ?? 60;

// --- NEW: Central Result Processing Logic ---
export async function handleResultProcessing( website: PrismaWebsite, result: PrismaMonitoringResult ): Promise<void> {
    const logPrefix = `[ResultProc W:${website.id} R:${result.id}]`;
    console.log(`${logPrefix} Processing result. Available: ${result.isAvailable}, RT: ${result.responseTime}ms`);

    // --- Check for Recovery ---
    const openDownIncident = await IncidentService.getOpenIncident(website.id, 'down');
    if (openDownIncident && result.isAvailable) {
        console.log(`${logPrefix} Recovery detected for DOWN incident (ID: ${openDownIncident.id}).`);
        await IncidentService.resolveIncident(openDownIncident.id, result.checkedAt, result.id);
        await dismissAlertsByType(website.id, 'down');
    }
    const openSlowIncident = await IncidentService.getOpenIncident(website.id, 'slow');
    if (openSlowIncident) {
        const usersMonitoring = await prisma.websiteUser.findMany({
            where: { websiteId: website.id, alertEnabled: true }, select: { alertThreshold: true }
        });
        const relevantThresholds = usersMonitoring.map(u => u.alertThreshold).filter((t): t is number => t !== null && t > 0);
        const recoveryThreshold = relevantThresholds.length > 0 ? Math.min(...relevantThresholds) : null;
        const isRecoveredSlow = result.isAvailable && (recoveryThreshold === null || (result.responseTime !== null && result.responseTime <= recoveryThreshold));
        if (isRecoveredSlow) {
            console.log(`${logPrefix} Recovery detected for SLOW incident (ID: ${openSlowIncident.id}). RT: ${result.responseTime}ms, Lowest Threshold: ${recoveryThreshold ?? 'N/A'}`);
            await IncidentService.resolveIncident(openSlowIncident.id, result.checkedAt, result.id);
            await dismissAlertsByType(website.id, 'slow');
        }
    }

    // --- Check for Potential New Incidents ---
    const usersToConsider = await prisma.websiteUser.findMany({
        where: { websiteId: website.id, alertEnabled: true },
        select: { userId: true, alertThreshold: true, name: true, notifyEmail: true }
    });
    if (usersToConsider.length === 0) { return; }

    let potentialType: IncidentType | null = null;
    let userThreshold: number | null = null;

    if (!result.isAvailable) {
        const isDownIncidentOpen = !!(await IncidentService.getOpenIncident(website.id, 'down'));
        if (!isDownIncidentOpen) {
            potentialType = 'down';
            console.log(`${logPrefix} Potential DOWN incident detected (No open 'down' incident found).`);
        }
    }
    else if (result.responseTime !== null) {
        const isSlowIncidentOpen = !!(await IncidentService.getOpenIncident(website.id, 'slow'));
        if (!isSlowIncidentOpen) {
            let lowestExceededThreshold: number | null = null;
            for (const user of usersToConsider) {
                if (user.alertThreshold !== null && result.responseTime > user.alertThreshold) {
                    if (lowestExceededThreshold === null || user.alertThreshold < lowestExceededThreshold) {
                        lowestExceededThreshold = user.alertThreshold;
                    }
                }
            }
            if (lowestExceededThreshold !== null) {
                potentialType = 'slow';
                userThreshold = lowestExceededThreshold;
                console.log(`${logPrefix} Potential SLOW incident detected (RT: ${result.responseTime}ms > Lowest Threshold: ${userThreshold}ms).`);
            }
        }
    }

    if (potentialType) {
        await scheduleIncidentConfirmationCheck(website.id, result, potentialType, userThreshold);
    }
}

// scheduleIncidentConfirmationCheck remains unchanged
async function scheduleIncidentConfirmationCheck( websiteId: number, initialResult: PrismaMonitoringResult, potentialType: IncidentType, thresholdForSlow: number | null ): Promise<void> {
    const delayMs = RECHECK_DELAY_SECONDS * 1000;
    const logPrefix = `[IncidentConfirmSched W:${websiteId} T:${potentialType}]`;
    console.log(`${logPrefix} Scheduling confirmation check in ${RECHECK_DELAY_SECONDS}s. Initial Result ID: ${initialResult.id}`);
    setTimeout(async () => {
        console.log(`${logPrefix} Executing delayed ${potentialType} confirmation check.`);
        try {
            const website = await prisma.website.findUnique({ where: { id: websiteId } });
            if (!website || !website.isActive) { console.log(`${logPrefix} Confirmation check cancelled (website not found or inactive).`); return; }
            const freshInitialResult = await prisma.monitoringResult.findUnique({ where: { id: initialResult.id } });
            if (!freshInitialResult) { console.log(`${logPrefix} Confirmation check cancelled (initial result ${initialResult.id} missing).`); return; }
            await handleIncidentConfirmation(website, freshInitialResult, potentialType, thresholdForSlow);
        } catch (error) { console.error(`${logPrefix} Error during delayed confirmation check execution:`, error); }
    }, delayMs);
}


/**
 * Performs the confirmation check after the delay.
 */
async function handleIncidentConfirmation(
    website: PrismaWebsite,
    initialResult: PrismaMonitoringResult,
    potentialType: IncidentType,
    thresholdForSlow: number | null
): Promise<void> {
    const logPrefix = `[IncidentConfirm W:${website.id} T:${potentialType}]`;
    console.log(`${logPrefix} Performing confirmation check.`);

    const confirmationCheckData: MonitoringResponse = await WebsiteMonitor.performWebsiteCheck(website.url);
    let confirmingResultDb: PrismaMonitoringResult;
    try {
        confirmingResultDb = await ResultsManager.saveResult(website.id, confirmationCheckData);
        console.log(`${logPrefix} Confirmation check result saved (ID: ${confirmingResultDb.id}). Avail=${confirmingResultDb.isAvailable}, RT=${confirmingResultDb.responseTime}ms`);
    } catch (saveError) { console.error(`${logPrefix} CRITICAL: Failed to save confirmation check result:`, saveError); return; }

    let issueConfirmed = false;
    let confirmedType: IncidentType | null = null;

    if (potentialType === 'down' && !confirmingResultDb.isAvailable) {
        issueConfirmed = true; confirmedType = 'down'; console.log(`${logPrefix} CONFIRMED DOWN.`);
    }
    else if ( potentialType === 'slow' && confirmingResultDb.isAvailable && thresholdForSlow !== null && confirmingResultDb.responseTime !== null && confirmingResultDb.responseTime > thresholdForSlow ) {
        issueConfirmed = true; confirmedType = 'slow'; console.log(`${logPrefix} CONFIRMED SLOW (RT: ${confirmingResultDb.responseTime}ms > Threshold: ${thresholdForSlow}ms).`);
    }
    else { console.log(`${logPrefix} ${potentialType.toUpperCase()} condition NOT confirmed by check. Check Result -> Avail: ${confirmingResultDb.isAvailable}, RT: ${confirmingResultDb.responseTime}ms`); }

    if (issueConfirmed && confirmedType) {
        const newIncident = await IncidentService.createIncident( website.id, confirmedType, confirmingResultDb.checkedAt, initialResult.id, confirmingResultDb.id );
        if (!newIncident) { console.error(`${logPrefix} Failed to create incident record. Aborting alert generation.`); return; }
        console.log(`${logPrefix} Incident ${newIncident.id} created/confirmed. Checking users for alerts.`);

        // --- FIX: Select all fields needed by createAlertAndNotify ---
        const usersToAlert = await prisma.websiteUser.findMany({
            where: {
                websiteId: website.id,
                alertEnabled: true,
                ...(confirmedType === 'slow' && thresholdForSlow !== null && {
                    alertThreshold: { lte: thresholdForSlow }
                })
            },
            // Select the full WebsiteUser object or all required fields explicitly
            // Using the full object is simpler if no performance concern
             select: {
                 id: true,
                 userId: true,
                 websiteId: true,
                 name: true,
                 interval: true,
                 alertThreshold: true,
                 alertEnabled: true,
                 notifyEmail: true,
                 createdAt: true,
                 isPinned: true
                 // Add any other fields expected by PrismaWebsiteUser type if needed
             }
        });

        if (usersToAlert.length === 0) { console.log(`${logPrefix} No users found requiring an alert for this confirmed ${confirmedType} incident.`); return; }
        console.log(`${logPrefix} Found ${usersToAlert.length} users to notify for incident ${newIncident.id}.`);

        for (const user of usersToAlert) {
            const userLogPrefix = `${logPrefix} U:${user.userId}`;
            // Now 'user' matches the expected PrismaWebsiteUser type
            await createAlertAndNotify(website, user, newIncident, confirmingResultDb);
        }
    }
}


/**
 * Creates an Alert record and sends an email notification for a confirmed incident.
 * Parameter type updated to expect the full PrismaWebsiteUser.
 */
async function createAlertAndNotify(
    website: PrismaWebsite,
    websiteUser: PrismaWebsiteUser, // Expect the full Prisma type now
    incident: PrismaIncident,
    confirmingResult: PrismaMonitoringResult
): Promise<void> {
    const logPrefix = `[AlertNotify U:${websiteUser.userId} W:${website.id} I:${incident.id}]`;
    const alertType = incident.type as AlertType;

    const existingAlert = await prisma.alert.findFirst({
        where: { userId: websiteUser.userId, websiteId: website.id, type: alertType }, select: { id: true }
    });
    if (existingAlert) { console.log(`${logPrefix} Skipped ${alertType.toUpperCase()} alert creation (Alert ID: ${existingAlert.id} already exists).`); return; }

    let message = '';
    if (alertType === 'down') { message = `Website is down: ${websiteUser.name || website.url}${confirmingResult.statusCode ? ` (Status: ${confirmingResult.statusCode})` : ''}${confirmingResult.errorMessage ? ` - Error: ${confirmingResult.errorMessage}` : ''} (Incident ID: ${incident.id})`; }
    else { message = `Website is responding slowly: ${websiteUser.name || website.url} (${confirmingResult.responseTime}ms > ${websiteUser.alertThreshold}ms) (Incident ID: ${incident.id})`; }

    let newAlert: PrismaAlert | null = null;
    try {
        newAlert = await prisma.alert.create({ data: { userId: websiteUser.userId, websiteId: website.id, type: alertType, message: message } });
        console.log(`${logPrefix} Created ${alertType.toUpperCase()} Alert ID: ${newAlert.id}.`);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { console.warn(`${logPrefix} Alert creation race condition likely occurred for ${alertType} alert. Skipping notification.`); return; }
        else { console.error(`${logPrefix} Error creating ${alertType.toUpperCase()} alert:`, error); return; }
    }

    if (newAlert && websiteUser.notifyEmail) {
        let emailSubject = ''; let emailBody = '';
        if (alertType === 'down') {
            emailSubject = `🔴 CONFIRMED DOWN: ${websiteUser.name || website.url}`;
            emailBody = `<p>Your monitored website <strong>${websiteUser.name || website.url}</strong> is confirmed to be down.</p><p>Status Code: ${confirmingResult.statusCode ?? 'N/A'}<br>Error Message: ${confirmingResult.errorMessage ?? 'No specific error reported'}<br>Time Confirmed: ${incident.startTime.toLocaleString()}</p><p>Incident ID: ${incident.id}</p><p>Alert ID: ${newAlert.id}</p><p>Please check the dashboard. Recovery emails are not sent automatically.</p>`;
        } else {
            emailSubject = `🟠 CONFIRMED SLOW: ${websiteUser.name || website.url}`;
            emailBody = `<p>Your monitored website <strong>${websiteUser.name || website.url}</strong> is confirmed to be responding slowly.</p><p>Response Time: ${confirmingResult.responseTime}ms (Your Threshold: ${websiteUser.alertThreshold}ms)<br>Time Confirmed: ${incident.startTime.toLocaleString()}</p><p>Incident ID: ${incident.id}</p><p>Alert ID: ${newAlert.id}</p><p>Please check the dashboard.</p>`;
        }
        try {
            console.log(`${logPrefix} Attempting to send ${alertType} email alert to ${websiteUser.notifyEmail}`);
            await sendMail({ to: websiteUser.notifyEmail, subject: emailSubject, html: emailBody });
            console.log(`${logPrefix} Successfully sent ${alertType} email alert.`);
        } catch (emailError) { console.error(`${logPrefix} Failed to send ${alertType} email notification for Alert ID ${newAlert.id}:`, emailError); }
    } else if (newAlert && !websiteUser.notifyEmail) { console.log(`${logPrefix} Skipped email notification for Alert ID ${newAlert.id} (User has no notification email).`); }
}

// dismissAlertsByType remains unchanged
async function dismissAlertsByType(websiteId: number, type: AlertType): Promise<void> {
    const logPrefix = `[AlertDismiss W:${websiteId} T:${type}]`;
    try {
        const deleteResult = await prisma.alert.deleteMany({ where: { websiteId: websiteId, type: type } });
        if (deleteResult.count > 0) { console.log(`${logPrefix} Dismissed ${deleteResult.count} active '${type}' alerts upon recovery.`); }
    } catch (error) { console.error(`${logPrefix} Error dismissing alerts upon recovery:`, error); }
}


// getAlertsForUser remains unchanged
export async function getAlertsForUser( userId: number, options: AlertQueryOptions = {} ): Promise<PrismaAlert[]> {
    const { limit = 50, type, from, to, websiteId } = options;
    const whereClause: Prisma.AlertWhereInput = { userId };
    if (type && VALID_ALERT_TYPES.includes(type)) whereClause.type = type;
    if (from || to) { whereClause.createdAt = {}; if (from) whereClause.createdAt.gte = from; if (to) whereClause.createdAt.lte = to; }
    if (websiteId !== undefined) whereClause.websiteId = websiteId;
    return prisma.alert.findMany({ where: whereClause, orderBy: { createdAt: 'desc' }, take: limit, include: { website: { select: { id: true, url: true, websiteUsers: { where: { userId }, select: { name: true } } } } } });
}

// getAlertsByWebsite remains unchanged
export async function getAlertsByWebsite( websiteId: number, options: AlertQueryOptions = {} ): Promise<PrismaAlert[]> {
    const { limit = 50, type, from, to } = options;
    const whereClause: Prisma.AlertWhereInput = { websiteId };
    if (type && VALID_ALERT_TYPES.includes(type)) whereClause.type = type;
    if (from || to) { whereClause.createdAt = {}; if (from) whereClause.createdAt.gte = from; if (to) whereClause.createdAt.lte = to; }
    return prisma.alert.findMany({ where: whereClause, orderBy: { createdAt: 'desc' }, take: limit, include: { website: { select: { id: true, url: true } }, user: { select: { id: true, name: true, email: true } } } });
}

// dismissAlert remains unchanged
export async function dismissAlert( userId: number, alertId: number ): Promise<PrismaAlert | null> {
    const logPrefix = `[Alert Dismiss U:${userId} A:${alertId}]`;
    console.log(`${logPrefix} Attempting to dismiss alert.`);
    const alert = await prisma.alert.findUnique({ where: { id: alertId }, select: { userId: true } });
    if (!alert) { console.log(`${logPrefix} Alert not found.`); return null; }
    if (alert.userId !== userId) { console.warn(`${logPrefix} User does not own this alert. Dismissal denied.`); throw new Error('Forbidden: User does not own this alert'); }
    try {
        const deletedAlert = await prisma.alert.delete({ where: { id: alertId } });
        console.log(`${logPrefix} Alert successfully dismissed.`); return deletedAlert;
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { console.log(`${logPrefix} Alert was already deleted.`); return null; }
        console.error(`${logPrefix} Error dismissing alert:`, error); throw error;
    }
}

// getUserAlertStats remains unchanged
export async function getUserAlertStats(userId: number, days = 7): Promise<AlertStats> {
    const startDate = subHours(new Date(), days * 24);
    const alerts = await prisma.alert.findMany({ where: { userId: userId, createdAt: { gte: startDate } }, select: { type: true, websiteId: true, website: { select: { url: true, websiteUsers: { where: { userId }, select: { name: true } } } } } });
    const totalAlerts = alerts.length;
    const byType: Partial<Record<AlertType, number>> = {};
    const websiteMap = new Map<number, { websiteId: number, websiteName: string, count: number }>();
    alerts.forEach(alert => {
        const alertType = alert.type as AlertType; byType[alertType] = (byType[alertType] || 0) + 1;
        const customName = alert.website?.websiteUsers?.[0]?.name; const websiteName = customName || alert.website?.url || `Website ${alert.websiteId}`;
        if (!websiteMap.has(alert.websiteId)) { websiteMap.set(alert.websiteId, { websiteId: alert.websiteId, websiteName: websiteName, count: 0 }); }
        websiteMap.get(alert.websiteId)!.count++;
    });
    const byWebsite = Array.from(websiteMap.values()).sort((a, b) => b.count - a.count);
    return { totalAlerts, byType, byWebsite };
}