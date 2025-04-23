// server/src/services/alertService.ts
import {
    Website as PrismaWebsite,
    Alert as PrismaAlert,
    WebsiteUser as PrismaWebsiteUser,
    MonitoringResult as PrismaMonitoringResult,
    Prisma,
    Incident as PrismaIncident,
  } from '@prisma/client';
  //
  // Import config
  //
  import { monitoringConfig } from '../config/config';
  import prisma from '../prisma/prismaClient';
  import { subHours, differenceInSeconds } from 'date-fns';
  import { AlertQueryOptions, AlertType, AlertStats, VALID_ALERT_TYPES, MonitoringResponse, IncidentType } from '../types';
  import { WebsiteMonitor, ResultsManager } from './monitoringService';
  import * as IncidentService from './incidentService';
  import { sendMail } from './mailService';
  
  //
  // Use constant from config
  //
  const RECHECK_DELAY_SECONDS = monitoringConfig.recheckDelaySeconds;
  
  // --- Central Result Processing Logic ---
  
  /**
   * Handles processing of a new monitoring result: checks for recoveries,
   * potential new incidents, and schedules confirmation checks.
   */
  export async function handleResultProcessing( website: PrismaWebsite, result: PrismaMonitoringResult ): Promise<void> {
    const logPrefix = `[ResultProc W:${website.id} R:${result.id}]`;
    console.log(`${logPrefix} Processing result. Available: ${result.isAvailable}, RT: ${result.responseTime}ms`);
    let recoveryProcessed = false;
  
    // --- Check for Recovery FIRST ---
  
    //
    // Check DOWN recovery
    //
    const openDownIncident = await IncidentService.getOpenIncident(website.id, 'down');
    if (openDownIncident && result.isAvailable) {
        console.log(`${logPrefix} Recovery detected for DOWN incident (ID: ${openDownIncident.id}).`);
        await IncidentService.resolveIncident(openDownIncident.id, result.checkedAt, result.id);
        //
        // Dismiss alerts for ALL users monitoring this site for this type upon recovery
        //
        await dismissAlertsByType(website.id, 'down');
        recoveryProcessed = true; // Mark recovery as processed
    }
  
    //
    // Check SLOW recovery
    //
    const openSlowIncident = await IncidentService.getOpenIncident(website.id, 'slow');
    if (openSlowIncident) {
        //
        // Determine the *lowest* alertThreshold among users who *could* be alerted for slowness on this site.
        // This ensures recovery is detected based on the most sensitive threshold defined for the site.
        //
        const usersPotentiallyAlerted = await prisma.websiteUser.findMany({
            where: {
                websiteId: website.id,
                alertThreshold: { not: null, gt: 0 } // Consider users with a valid threshold set
            },
            select: { alertThreshold: true }
        });
        const relevantThresholds = usersPotentiallyAlerted
            .map(u => u.alertThreshold)
            .filter((t): t is number => t !== null); // Filter out nulls safely
  
        //
        // Lowest threshold among relevant users determines the recovery point
        //
        const recoveryThreshold = relevantThresholds.length > 0 ? Math.min(...relevantThresholds) : null;
  
        //
        // Check if the current result meets recovery criteria:
        // 1. Must be available.
        // 2. If a recovery threshold exists, response time must be at or below it.
        //
        const isRecoveredSlow = result.isAvailable && (
            recoveryThreshold === null || // Recovers if no threshold ever set
            (result.responseTime !== null && result.responseTime <= recoveryThreshold)
        );
  
        if (isRecoveredSlow) {
            console.log(`${logPrefix} Recovery detected for SLOW incident (ID: ${openSlowIncident.id}). RT: ${result.responseTime}ms <= Lowest Threshold: ${recoveryThreshold ?? 'N/A'}`);
            await IncidentService.resolveIncident(openSlowIncident.id, result.checkedAt, result.id);
            //
            // Dismiss alerts for ALL users monitoring this site for this type upon recovery
            //
            await dismissAlertsByType(website.id, 'slow');
            recoveryProcessed = true; // Mark recovery as processed
        }
    }
  
    // --- Check for Potential New Incidents (only if no recovery was just processed) ---
    if (recoveryProcessed) {
        console.log(`${logPrefix} Skipping new incident check as recovery was just processed.`);
        return; // Exit early if recovery handled
    }
  
    let potentialType: IncidentType | null = null;
    let thresholdForSlow: number | null = null; // Store the threshold that was exceeded if slow
  
    //
    // Check for DOWN condition
    //
    if (!result.isAvailable) {
        //
        // Check if a 'down' incident is already open for this site
        //
        const isDownIncidentOpen = !!(await IncidentService.getOpenIncident(website.id, 'down'));
        if (!isDownIncidentOpen) {
            potentialType = 'down';
            console.log(`${logPrefix} Potential DOWN incident detected (Result unavailable, no open 'down' incident).`);
        } else {
            console.log(`${logPrefix} Result unavailable, but DOWN incident already open. No action needed.`);
        }
    }
    //
    // Check for SLOW condition (only if available and has response time)
    //
    else if (result.responseTime !== null) {
        //
        // Check if a 'slow' incident is already open for this site
        //
        const isSlowIncidentOpen = !!(await IncidentService.getOpenIncident(website.id, 'slow'));
        if (!isSlowIncidentOpen) {
            //
            // Find the lowest threshold exceeded among *any* user monitoring this site,
            // regardless of whether their individual alerts are enabled. The incident affects the site globally.
            //
            const allUserThresholds = await prisma.websiteUser.findMany({
                where: {
                    websiteId: website.id,
                    alertThreshold: { not: null, gt: 0 } // Consider only valid, positive thresholds
                },
                select: { alertThreshold: true }
            });
            const relevantThresholds = allUserThresholds
                .map(u => u.alertThreshold)
                .filter((t): t is number => t !== null); // Filter nulls safely
  
            let lowestExceededThreshold: number | null = null;
            for (const threshold of relevantThresholds) {
                //
                // Check if the current result's response time exceeds this user's threshold
                //
                if (result.responseTime > threshold) {
                    //
                    // If it's the first exceeded threshold or lower than the current lowest, update
                    //
                    if (lowestExceededThreshold === null || threshold < lowestExceededThreshold) {
                        lowestExceededThreshold = threshold;
                    }
                }
            }
  
            //
            // If at least one threshold was exceeded, mark as potential 'slow' incident
            //
            if (lowestExceededThreshold !== null) {
                potentialType = 'slow';
                thresholdForSlow = lowestExceededThreshold; // Store the specific threshold that triggered this potential incident
                console.log(`${logPrefix} Potential SLOW incident detected (RT: ${result.responseTime}ms > Lowest Exceeded Threshold: ${thresholdForSlow}ms, no open 'slow' incident).`);
            }
        } else {
             console.log(`${logPrefix} Result is slow (RT: ${result.responseTime}ms), but SLOW incident already open. No action needed.`);
        }
    }
  
    //
    // If a potential incident was detected, schedule the confirmation check
    //
    if (potentialType) {
        await scheduleIncidentConfirmationCheck(website.id, result, potentialType, thresholdForSlow);
    } else {
         console.log(`${logPrefix} No new potential incident detected.`);
    }
  }
  
  /**
   * Schedules a delayed check to confirm if a potential incident condition persists.
   */
  async function scheduleIncidentConfirmationCheck(
    websiteId: number,
    initialResult: PrismaMonitoringResult,
    potentialType: IncidentType,
    thresholdForSlow: number | null // Pass the threshold if it's a slow check
  ): Promise<void> {
    //
    // Use delay from config
    //
    const delayMs = RECHECK_DELAY_SECONDS * 1000;
    const logPrefix = `[IncidentConfirmSched W:${websiteId} T:${potentialType}]`;
    console.log(`${logPrefix} Scheduling confirmation check in ${RECHECK_DELAY_SECONDS}s. Initial Result ID: ${initialResult.id}`);
  
    setTimeout(async () => {
      console.log(`${logPrefix} Executing delayed ${potentialType} confirmation check.`);
      try {
        //
        // Fetch the website again in case its status changed (e.g., deactivated)
        //
        const website = await prisma.website.findUnique({ where: { id: websiteId } });
        if (!website || !website.isActive) {
          console.log(`${logPrefix} Confirmation check cancelled (website not found or inactive).`);
          return;
        }
  
        //
        // Fetch the initial result again in case it was deleted (unlikely but possible)
        //
        const freshInitialResult = await prisma.monitoringResult.findUnique({ where: { id: initialResult.id } });
        if (!freshInitialResult) {
          console.log(`${logPrefix} Confirmation check cancelled (initial result ${initialResult.id} missing).`);
          return;
        }
  
        //
        // Proceed with the confirmation check using fresh data
        //
        await handleIncidentConfirmation(website, freshInitialResult, potentialType, thresholdForSlow);
  
      } catch (error) {
        console.error(`${logPrefix} Error during delayed confirmation check execution:`, error);
      }
    }, delayMs);
  }
  
  /**
   * Performs the confirmation check after the delay and handles incident creation and user alerting.
   */
  async function handleIncidentConfirmation(
    website: PrismaWebsite,
    initialResult: PrismaMonitoringResult, // The result that first indicated a potential issue
    potentialType: IncidentType,
    thresholdForSlow: number | null // The specific threshold that triggered the initial 'slow' check
  ): Promise<void> {
    const logPrefix = `[IncidentConfirm W:${website.id} T:${potentialType}]`;
    console.log(`${logPrefix} Performing confirmation check.`);
  
    //
    // Re-check if the incident is already open (could have been created by another process/race condition)
    //
    const existingOpenIncident = await IncidentService.getOpenIncident(website.id, potentialType);
    if (existingOpenIncident) {
      console.log(`${logPrefix} Confirmation check skipped: An incident (ID: ${existingOpenIncident.id}) of type '${potentialType}' was already opened.`);
      return;
    }
  
    //
    // Perform the actual confirmation check
    //
    const confirmationCheckData: MonitoringResponse = await WebsiteMonitor.performWebsiteCheck(website.url);
    let confirmingResultDb: PrismaMonitoringResult;
  
    try {
      //
      // Save the result of the confirmation check
      //
      confirmingResultDb = await ResultsManager.saveResult(website.id, confirmationCheckData);
      console.log(`${logPrefix} Confirmation check result saved (ID: ${confirmingResultDb.id}). Avail=${confirmingResultDb.isAvailable}, RT=${confirmingResultDb.responseTime}ms`);
    } catch (saveError) {
      console.error(`${logPrefix} CRITICAL: Failed to save confirmation check result:`, saveError);
      // Cannot proceed without saving the confirmation result
      return;
    }
  
    let issueConfirmed = false;
    let confirmedType: IncidentType | null = null;
  
    //
    // --- Determine if the issue is confirmed ---
    //
    // Confirm DOWN: Still unavailable in the confirmation check
    //
    if (potentialType === 'down' && !confirmingResultDb.isAvailable) {
      issueConfirmed = true;
      confirmedType = 'down';
      console.log(`${logPrefix} CONFIRMED DOWN.`);
    }
    //
    // Confirm SLOW: Still available AND response time is still above the *original* threshold that triggered the check
    //
    else if (
      potentialType === 'slow' &&
      confirmingResultDb.isAvailable && // Must be available
      thresholdForSlow !== null && // Must have had an initial threshold
      confirmingResultDb.responseTime !== null && // Must have a response time in confirmation
      confirmingResultDb.responseTime > thresholdForSlow // Must exceed the original trigger threshold
    ) {
      issueConfirmed = true;
      confirmedType = 'slow';
      console.log(`${logPrefix} CONFIRMED SLOW (RT: ${confirmingResultDb.responseTime}ms > Original Threshold: ${thresholdForSlow}ms).`);
    }
    //
    // If neither condition is met, the issue is not confirmed
    //
    else {
      console.log(`${logPrefix} ${potentialType.toUpperCase()} condition NOT confirmed by check. Check Result -> Avail: ${confirmingResultDb.isAvailable}, RT: ${confirmingResultDb.responseTime}ms. Original Threshold (if slow): ${thresholdForSlow ?? 'N/A'}`);
    }
  
    // --- Create Incident if Confirmed (Independent of Alerting Users) ---
    if (issueConfirmed && confirmedType) {
      const newIncident = await IncidentService.createIncident(
        website.id,
        confirmedType,
        confirmingResultDb.checkedAt, // Incident starts at the time of confirmation
        initialResult.id, // Link to the initial result that triggered the check
        confirmingResultDb.id // Link to the result that confirmed the incident
      );
  
      if (!newIncident) {
        // Incident creation failed (logged within createIncident), cannot proceed with alerts
        console.error(`${logPrefix} Failed to create incident record. Aborting alert generation.`);
        return;
      }
  
      console.log(`${logPrefix} Incident ${newIncident.id} created/confirmed. Checking users for alerts.`);
  
      // --- Find users who have ALERTS ENABLED for this specific incident type ---
  
      // Base criteria: User monitors this website and has alerts enabled globally for it
      const baseWhereClause: Prisma.WebsiteUserWhereInput = {
          websiteId: website.id,
          alertEnabled: true,
      };
  
      // Specific criteria for SLOW alerts
      if (confirmedType === 'slow') {
          // A slow alert requires the confirming result to have a valid response time
          if (confirmingResultDb.responseTime !== null) {
              // User must have a threshold set, AND that threshold must be less than or equal to the measured response time
              baseWhereClause.alertThreshold = {
                  not: null, // Threshold must be set
                  lte: confirmingResultDb.responseTime // Threshold must be met/exceeded by the measured time
              };
          } else {
              // If the confirming result for a SLOW incident has no response time, no threshold-based alert can be sent.
              console.log(`${logPrefix} Confirmed SLOW incident ${newIncident.id} but confirmation check had null responseTime. No threshold-based alerts will be sent.`);
              // Set an impossible condition to ensure no users are matched for slow alerts in this case
              baseWhereClause.id = -1;
          }
      }
      // For 'down' alerts, no additional threshold check is needed, baseWhereClause is sufficient.
  
      const usersToAlert = await prisma.websiteUser.findMany({
          where: baseWhereClause, // Use the dynamically constructed where clause
          // Select all fields needed by createAlertAndNotify
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
           }
      });
  
      if (usersToAlert.length === 0) {
          console.log(`${logPrefix} No users found requiring an alert for this confirmed ${confirmedType} incident ${newIncident.id}.`);
          return;
      }
  
      console.log(`${logPrefix} Found ${usersToAlert.length} users to notify for incident ${newIncident.id}.`);
  
      //
      // Create alert record and send notification for each relevant user
      //
      for (const user of usersToAlert) {
          // Pass the confirmingResult for alert message details
          await createAlertAndNotify(website, user, newIncident, confirmingResultDb);
      }
    }
  }
  
  /**
   * Creates an Alert record and sends an email notification for a confirmed incident.
   */
  async function createAlertAndNotify(
    website: PrismaWebsite,
    websiteUser: PrismaWebsiteUser,
    incident: PrismaIncident, // The confirmed incident
    confirmingResult: PrismaMonitoringResult // The result that confirmed the incident
  ): Promise<void> {
    const logPrefix = `[AlertNotify U:${websiteUser.userId} W:${website.id} I:${incident.id}]`;
    //
    // Alert type matches the incident type
    //
    const alertType = incident.type as AlertType;
  
    //
    // Check if an alert for this specific incident/user/type already exists (prevent duplicates)
    //
    const existingAlert = await prisma.alert.findFirst({
      where: {
        userId: websiteUser.userId,
        websiteId: website.id,
        type: alertType,
        incidentId: incident.id // Crucial: Check against the specific incident ID
      },
      select: { id: true }
    });
  
    if (existingAlert) {
      console.log(`${logPrefix} Skipped ${alertType.toUpperCase()} alert creation (Alert ID: ${existingAlert.id} already exists for Incident ${incident.id}).`);
      return; // Don't create or notify again for this incident
    }
  
    //
    // Construct the alert message based on the type and confirming result
    //
    let message = '';
    const websiteDisplayName = websiteUser.name || website.url; // Use custom name or URL
  
    if (alertType === 'down') {
      message = `Website is down: ${websiteDisplayName}`;
      if (confirmingResult.statusCode) message += ` (Status: ${confirmingResult.statusCode})`;
      if (confirmingResult.errorMessage) message += ` - Error: ${confirmingResult.errorMessage}`;
      message += ` (Incident ID: ${incident.id})`;
    } else if (alertType === 'slow') {
      const responseTimeMsg = confirmingResult.responseTime !== null ? `${confirmingResult.responseTime}ms` : 'N/A';
      message = `Website is responding slowly: ${websiteDisplayName} (${responseTimeMsg} > ${websiteUser.alertThreshold ?? 'N/A'}ms) (Incident ID: ${incident.id})`;
    }
  
    let newAlert: PrismaAlert | null = null;
    try {
      //
      // Create the actual Alert record in the database
      //
      newAlert = await prisma.alert.create({
        data: {
          userId: websiteUser.userId,
          websiteId: website.id,
          type: alertType,
          message: message,
          incidentId: incident.id // Associate Alert with the specific Incident
        }
      });
      console.log(`${logPrefix} Created ${alertType.toUpperCase()} Alert ID: ${newAlert.id} linked to Incident ID: ${incident.id}.`);
    } catch (error) {
      // Handle potential race conditions if two processes try to create the alert simultaneously
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        console.warn(`${logPrefix} Alert creation race condition likely occurred for ${alertType} alert for Incident ${incident.id}. Skipping notification.`);
        return; // Don't proceed to notify if alert wasn't created by this process
      } else {
        // Log other errors during alert creation
        console.error(`${logPrefix} Error creating ${alertType.toUpperCase()} alert for Incident ${incident.id}:`, error);
        return; // Don't notify if alert creation failed
      }
    }
  
    // --- Send Email Notification ---
    //
    // Proceed only if the alert was successfully created by this process AND the user has an email configured
    //
    if (newAlert && websiteUser.notifyEmail) {
      let emailSubject = '';
      let emailBody = '';
  
      //
      // Use confirmingResult details for the email content
      //
      if (alertType === 'down') {
        emailSubject = `🔴 CONFIRMED DOWN: ${websiteDisplayName}`;
        emailBody = `<p>Your monitored website <strong>${websiteDisplayName}</strong> is confirmed to be down.</p>` +
                    `<p>Status Code: ${confirmingResult.statusCode ?? 'N/A'}<br>` +
                    `Error Message: ${confirmingResult.errorMessage ?? 'No specific error reported'}<br>` +
                    `Time Confirmed: ${incident.startTime.toLocaleString()}</p>` + // Use incident start time (confirmation time)
                    `<p>Incident ID: ${incident.id}</p>` +
                    `<p>Alert ID: ${newAlert.id}</p>` +
                    `<p>Please check the dashboard for details and recovery status.</p>`;
      } else { // 'slow'
        // Handle potential null responseTime in email body
        const responseTimeBody = confirmingResult.responseTime !== null ? `${confirmingResult.responseTime}ms` : 'N/A';
        emailSubject = `🟠 CONFIRMED SLOW: ${websiteDisplayName}`;
        emailBody = `<p>Your monitored website <strong>${websiteDisplayName}</strong> is confirmed to be responding slowly.</p>` +
                    `<p>Response Time: ${responseTimeBody} (Your Threshold: ${websiteUser.alertThreshold ?? 'N/A'}ms)<br>` +
                    `Time Confirmed: ${incident.startTime.toLocaleString()}</p>` + // Use incident start time (confirmation time)
                    `<p>Incident ID: ${incident.id}</p>` +
                    `<p>Alert ID: ${newAlert.id}</p>` +
                    `<p>Please check the dashboard for details and recovery status.</p>`;
      }
  
      try {
        console.log(`${logPrefix} Attempting to send ${alertType} email alert to ${websiteUser.notifyEmail}`);
        await sendMail({ to: websiteUser.notifyEmail, subject: emailSubject, html: emailBody });
        console.log(`${logPrefix} Successfully sent ${alertType} email alert.`);
      } catch (emailError) {
        console.error(`${logPrefix} Failed to send ${alertType} email notification for Alert ID ${newAlert.id}:`, emailError);
        // Consider adding retry logic or marking the alert for later notification attempt
      }
    } else if (newAlert && !websiteUser.notifyEmail) {
      // Log if email wasn't sent due to missing user email config
      console.log(`${logPrefix} Skipped email notification for Alert ID ${newAlert.id} (User has no notification email).`);
    }
  }
  
  
  /**
   * Dismisses (deletes) all active alerts of a specific type for a given website.
   * Typically called upon incident recovery.
   */
  async function dismissAlertsByType(websiteId: number, type: AlertType): Promise<void> {
    const logPrefix = `[AlertDismiss W:${websiteId} T:${type}]`;
    try {
      //
      // Delete alerts based on website and type, regardless of the specific incident ID,
      // as recovery resolves the underlying condition for that type.
      //
      const deleteResult = await prisma.alert.deleteMany({
        where: {
          websiteId: websiteId,
          type: type
          // No incidentId filter here - dismiss all active alerts of this type for the site
        }
      });
  
      if (deleteResult.count > 0) {
        console.log(`${logPrefix} Dismissed ${deleteResult.count} active '${type}' alerts upon recovery.`);
      }
    } catch (error) {
      console.error(`${logPrefix} Error dismissing alerts upon recovery:`, error);
    }
  }
  
  // --- Alert Querying Functions ---
  
  /**
   * Retrieves alerts for a specific user, with optional filtering.
   * Includes website details (URL and user-specific name) and related incident info.
   */
  export async function getAlertsForUser( userId: number, options: AlertQueryOptions = {} ): Promise<PrismaAlert[]> {
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
            id: true,
            url: true,
            //
            // Include WebsiteUsers relation filtered to this user to get the custom name
            //
            websiteUsers: {
              where: { userId },
              select: { name: true }
            }
          }
        },
        //
        // Include associated incident details
        //
        incident: {
          select: { id: true, startTime: true, endTime: true }
        }
      }
    });
  }
  
  /**
   * Retrieves alerts for a specific website, with optional filtering.
   * Includes website URL, user details (ID, name, email), and related incident info.
   */
  export async function getAlertsByWebsite( websiteId: number, options: AlertQueryOptions = {} ): Promise<PrismaAlert[]> {
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
        website: { select: { id: true, url: true } }, // Basic website info
        user: { select: { id: true, name: true, email: true } }, // User who received the alert
        incident: { select: { id: true, startTime: true, endTime: true } } // Associated incident details
      }
    });
  }
  
  /**
   * Dismisses (deletes) a specific alert if the user owns it.
   */
  export async function dismissAlert( userId: number, alertId: number ): Promise<PrismaAlert | null> {
    const logPrefix = `[Alert Dismiss U:${userId} A:${alertId}]`;
    console.log(`${logPrefix} Attempting to dismiss alert.`);
  
    //
    // First, verify the alert exists and belongs to the requesting user
    //
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      select: { userId: true } // Only need userId for verification
    });
  
    if (!alert) {
      console.log(`${logPrefix} Alert not found.`);
      return null; // Or throw a NotFound error
    }
  
    if (alert.userId !== userId) {
      console.warn(`${logPrefix} User does not own this alert. Dismissal denied.`);
      // Throw a Forbidden error - important for security
      throw new Error('Forbidden: User does not own this alert');
    }
  
    //
    // If verification passes, proceed with deletion
    //
    try {
      const deletedAlert = await prisma.alert.delete({
        where: { id: alertId }
      });
      console.log(`${logPrefix} Alert successfully dismissed.`);
      return deletedAlert;
    } catch (error) {
      // Handle case where the alert might have been deleted between the check and the delete operation
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        console.log(`${logPrefix} Alert was already deleted.`);
        return null; // Return null indicating it's gone
      }
      // Log and re-throw other errors
      console.error(`${logPrefix} Error dismissing alert:`, error);
      throw error;
    }
  }
  
  /**
   * Calculates statistics about alerts for a specific user over a given period (default 7 days).
   */
  export async function getUserAlertStats(userId: number, days = 7): Promise<AlertStats> {
    const startDate = subHours(new Date(), days * 24);
  
    const alerts = await prisma.alert.findMany({
      where: {
        userId: userId,
        createdAt: { gte: startDate } // Filter by creation date within the period
      },
      select: {
        type: true,
        websiteId: true,
        incidentId: true, // Include incidentId for potential future analysis
        website: {
          select: {
            url: true,
            //
            // Include WebsiteUsers relation filtered to this user to get the custom name
            //
            websiteUsers: {
              where: { userId },
              select: { name: true }
            }
          }
        }
      }
    });
  
    const totalAlerts = alerts.length;
    const byType: Partial<Record<AlertType, number>> = {};
    //
    // Use a Map to aggregate counts by website, handling custom names
    //
    const websiteMap = new Map<number, { websiteId: number, websiteName: string, count: number }>();
  
    alerts.forEach(alert => {
      //
      // Count alerts by type
      //
      const alertType = alert.type as AlertType;
      byType[alertType] = (byType[alertType] || 0) + 1;
  
      //
      // Count alerts by website, using custom name if available
      //
      const customName = alert.website?.websiteUsers?.[0]?.name; // Get name from the filtered relation
      const websiteName = customName || alert.website?.url || `Website ${alert.websiteId}`; // Fallback logic for name
  
      if (!websiteMap.has(alert.websiteId)) {
        websiteMap.set(alert.websiteId, { websiteId: alert.websiteId, websiteName: websiteName, count: 0 });
      }
      //
      // Increment count for this website
      //
      websiteMap.get(alert.websiteId)!.count++;
    });
  
    //
    // Convert map values to an array and sort by count descending
    //
    const byWebsite = Array.from(websiteMap.values()).sort((a, b) => b.count - a.count);
  
    return { totalAlerts, byType, byWebsite };
  }