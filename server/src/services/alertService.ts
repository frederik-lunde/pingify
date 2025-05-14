// server/src/services/alertService.ts
import {
  Website as PrismaWebsite,
  Alert as PrismaAlert,
  WebsiteUser as PrismaWebsiteUser,
  MonitoringResult as PrismaMonitoringResult,
  Prisma,
  Incident as PrismaIncident,
} from "@prisma/client";
import { monitoringConfig } from "../config/config";
import prisma from "../prisma/prismaClient";
import { subHours } from "date-fns";
import {
  AlertQueryOptions,
  AlertType,
  AlertStats,
  VALID_ALERT_TYPES,
  MonitoringResponse,
  IncidentType,
} from "../types";
import { WebsiteMonitor, ResultsManager } from "./monitoringService";
import * as IncidentService from "./incidentService";
import { sendMail } from "./mailService";

const RECHECK_DELAY_SECONDS = monitoringConfig.recheckDelaySeconds;

/**
 * Processes a monitoring result to detect recoveries or potential new incidents.
 * Handles incident resolution, alert dismissal, and scheduling of confirmation checks for alerts.
 * Incidents are created immediately if initial checks indicate a problem.
 * Alerts are only sent after a recheck confirms the problem.
 */
export async function handleResultProcessing(
  website: PrismaWebsite,
  initialResult: PrismaMonitoringResult,
): Promise<void> {
  const logPrefix = `[ResultProc W:${website.id} R:${initialResult.id}]`;
  console.log(
    `${logPrefix} Processing initial result. Available: ${initialResult.isAvailable}, RT: ${initialResult.responseTime}ms`,
  );
  let recoveryProcessed = false;

  const openDownIncident = await IncidentService.getOpenIncident(
    website.id,
    "down",
  );
  if (openDownIncident && initialResult.isAvailable) {
    console.log(
      `${logPrefix} Recovery detected for DOWN incident (ID: ${openDownIncident.id}) based on initial check.`,
    );
    await IncidentService.resolveIncident(
      openDownIncident.id,
      initialResult.checkedAt,
      initialResult.id,
    );
    await dismissAlertsByType(website.id, "down");
    recoveryProcessed = true;
  }

  const openSlowIncident = await IncidentService.getOpenIncident(
    website.id,
    "slow",
  );
  if (openSlowIncident && !recoveryProcessed) {
    const usersPotentiallyAlerted = await prisma.websiteUser.findMany({
      where: {
        websiteId: website.id,
        alertThreshold: { not: null, gt: 0 },
      },
      select: { alertThreshold: true },
    });
    const relevantThresholds = usersPotentiallyAlerted
      .map((u) => u.alertThreshold)
      .filter((t): t is number => t !== null);

    const lowestUserAlertThreshold =
      relevantThresholds.length > 0 ? Math.min(...relevantThresholds) : null;

    const isRecoveredSlow =
      initialResult.isAvailable &&
      (lowestUserAlertThreshold === null ||
        (initialResult.responseTime !== null &&
          initialResult.responseTime <= lowestUserAlertThreshold));

    if (isRecoveredSlow) {
      console.log(
        `${logPrefix} Recovery detected for SLOW incident (ID: ${openSlowIncident.id}) based on initial check. RT: ${initialResult.responseTime}ms <= Lowest User Threshold: ${lowestUserAlertThreshold ?? "N/A"}`,
      );
      await IncidentService.resolveIncident(
        openSlowIncident.id,
        initialResult.checkedAt,
        initialResult.id,
      );
      await dismissAlertsByType(website.id, "slow");
      recoveryProcessed = true;
    }
  }

  if (recoveryProcessed) {
    console.log(
      `${logPrefix} Skipping new incident/alert logic as recovery was processed.`,
    );
    return;
  }

  let potentialTypeForAlertConfirmation: IncidentType | null = null;
  let thresholdInitiallyExceededForSlow: number | null = null;
  let incidentForAlertConfirmation: PrismaIncident | null = null;

  if (!initialResult.isAvailable) {
    const existingDownIncident = await IncidentService.getOpenIncident(website.id, "down");
    if (!existingDownIncident) {
      console.log(
        `${logPrefix} Initial check indicates DOWN. Creating/getting 'down' incident.`,
      );
      incidentForAlertConfirmation = await IncidentService.createIncident(
        website.id,
        "down",
        initialResult.checkedAt,
        initialResult.id, // initialResultId
        null, // confirmingResultId is null for now
      );
      if (incidentForAlertConfirmation) {
        potentialTypeForAlertConfirmation = "down";
        console.log(
          `${logPrefix} 'Down' Incident ID: ${incidentForAlertConfirmation.id} established. Scheduling alert confirmation.`,
        );
      } else {
        console.error(`${logPrefix} Failed to create/get 'down' incident.`);
      }
    } else {
      console.log(
        `${logPrefix} Initial check indicates DOWN, but 'down' incident (ID: ${existingDownIncident.id}) already open. Alert confirmation process for that incident should handle alerts if not already done/pending.`,
      );
    }
  } else if (initialResult.responseTime !== null) {
    const existingSlowIncident = await IncidentService.getOpenIncident(website.id, "slow");
    if (!existingSlowIncident) {
      const allUserThresholds = await prisma.websiteUser.findMany({
        where: {
          websiteId: website.id,
          alertThreshold: { not: null, gt: 0 },
        },
        select: { alertThreshold: true },
      });
      const relevantUserThresholds = allUserThresholds
        .map((u) => u.alertThreshold)
        .filter((t): t is number => t !== null && t > 0);

      let lowestExceededThreshold: number | null = null;
      if (relevantUserThresholds.length > 0) {
        for (const threshold of relevantUserThresholds) {
          if (initialResult.responseTime > threshold) {
            if (lowestExceededThreshold === null || threshold < lowestExceededThreshold) {
              lowestExceededThreshold = threshold;
            }
          }
        }
      }

      if (lowestExceededThreshold !== null) {
        console.log(
          `${logPrefix} Initial check indicates SLOW (RT: ${initialResult.responseTime}ms > Lowest Exceeded Threshold: ${lowestExceededThreshold}ms). Creating/getting 'slow' incident.`,
        );
        incidentForAlertConfirmation = await IncidentService.createIncident(
          website.id,
          "slow",
          initialResult.checkedAt,
          initialResult.id, // initialResultId
          null, // confirmingResultId is null for now
        );
        if (incidentForAlertConfirmation) {
          potentialTypeForAlertConfirmation = "slow";
          thresholdInitiallyExceededForSlow = lowestExceededThreshold;
          console.log(
            `${logPrefix} 'Slow' Incident ID: ${incidentForAlertConfirmation.id} established. Scheduling alert confirmation.`,
          );
        } else {
          console.error(`${logPrefix} Failed to create/get 'slow' incident.`);
        }
      } else {
         console.log(
            `${logPrefix} Initial check available (RT: ${initialResult.responseTime}ms), but not slow enough to trigger any user's alert threshold.`,
        );
      }
    } else {
      console.log(
        `${logPrefix} Initial check indicates SLOW (RT: ${initialResult.responseTime}ms), but 'slow' incident (ID: ${existingSlowIncident.id}) already open. Alert confirmation process for that incident should handle alerts if not already done/pending.`,
      );
    }
  }

  if (potentialTypeForAlertConfirmation && incidentForAlertConfirmation) {
    console.log(
      `${logPrefix} Scheduling alert confirmation for Incident ID: ${incidentForAlertConfirmation.id}, Type: ${potentialTypeForAlertConfirmation}.`,
    );
    await scheduleAlertConfirmationCheck(
      website.id,
      incidentForAlertConfirmation,
      initialResult.id, // Pass initialResultId for logging context
      potentialTypeForAlertConfirmation,
      thresholdInitiallyExceededForSlow,
    );
  } else {
    console.log(
      `${logPrefix} No new incident created from this initial check, or incident of this type already open. No new alert confirmation scheduled.`,
    );
  }
}

/**
 * Schedules a delayed recheck to confirm a potential incident before sending alerts.
 */
async function scheduleAlertConfirmationCheck(
  websiteId: number,
  incidentToConfirm: PrismaIncident,
  initialResultIdForContext: number,
  potentialType: IncidentType,
  thresholdInitiallyExceeded: number | null,
): Promise<void> {
  const delayMs = RECHECK_DELAY_SECONDS * 1000;
  const logPrefix = `[AlertConfirmSched W:${websiteId} I:${incidentToConfirm.id} T:${potentialType}]`;
  console.log(
    `${logPrefix} Scheduling alert confirmation recheck in ${RECHECK_DELAY_SECONDS}s. Initial Result ID for context: ${initialResultIdForContext}.`,
  );

  setTimeout(async () => {
    console.log(
      `${logPrefix} Executing delayed ${potentialType} alert confirmation recheck for Incident ${incidentToConfirm.id}.`,
    );
    try {
      const website = await prisma.website.findUnique({
        where: { id: websiteId },
      });
      if (!website || !website.isActive) {
        console.log(
          `${logPrefix} Alert confirmation recheck cancelled (website not found or inactive).`,
        );
        return;
      }

      const currentIncidentState = await prisma.incident.findUnique({
        where: { id: incidentToConfirm.id },
      });

      if (!currentIncidentState) {
        console.log(
          `${logPrefix} Alert confirmation recheck cancelled (Incident ${incidentToConfirm.id} not found).`,
        );
        return;
      }
      if (currentIncidentState.endTime !== null) {
         console.log(
          `${logPrefix} Alert confirmation recheck cancelled (Incident ${incidentToConfirm.id} was resolved before recheck).`,
        );
        return;
      }
      if (currentIncidentState.confirmingResultId !== null) {
          console.log(
              `${logPrefix} Alert confirmation recheck for Incident ${currentIncidentState.id} already has a confirmingResultId (${currentIncidentState.confirmingResultId}). Assuming alerts handled or in progress by another confirmation process. Aborting.`,
          );
          return;
      }

      await handleAlertConfirmation(
        website,
        currentIncidentState,
        potentialType, // This is incident.type, but passed for clarity
        thresholdInitiallyExceeded,
      );
    } catch (error) {
      console.error(
        `${logPrefix} Error during delayed alert confirmation recheck execution:`,
        error,
      );
    }
  }, delayMs);
}

/**
 * Performs a confirmation recheck for an incident. If confirmed,
 * updates the incident and triggers alert notifications for relevant users.
 */
async function handleAlertConfirmation(
  website: PrismaWebsite,
  incidentForConfirmation: PrismaIncident,
  incidentType: IncidentType, // Type of incidentForConfirmation
  thresholdInitiallyExceeded: number | null, // The threshold that the *initial* check exceeded for SLOW
): Promise<void> {
  const logPrefix = `[AlertConfirm W:${website.id} I:${incidentForConfirmation.id} T:${incidentType}]`;
  console.log(`${logPrefix} Performing alert confirmation recheck for Incident ${incidentForConfirmation.id}.`);

  const confirmationCheckData: MonitoringResponse =
    await WebsiteMonitor.performWebsiteCheck(website.url); // This is the recheck
  
  let confirmingResultDb: PrismaMonitoringResult;
  try {
    confirmingResultDb = await ResultsManager.saveResult(
      website.id,
      confirmationCheckData,
    );
    console.log(
      `${logPrefix} Confirmation recheck result saved (ID: ${confirmingResultDb.id}). Avail=${confirmingResultDb.isAvailable}, RT=${confirmingResultDb.responseTime}ms`,
    );
  } catch (saveError) {
    console.error(
      `${logPrefix} CRITICAL: Failed to save confirmation recheck result for Incident ${incidentForConfirmation.id}:`,
      saveError,
    );
    return;
  }

  // Update the incident with the confirmingResultId
  await IncidentService.updateIncidentConfirmation(incidentForConfirmation.id, confirmingResultDb.id);

  let issueConfirmedForAlerting = false;

  if (incidentType === "down" && !confirmingResultDb.isAvailable) {
    issueConfirmedForAlerting = true;
    console.log(`${logPrefix} CONFIRMED DOWN for alerts for Incident ${incidentForConfirmation.id}.`);
  } else if (
    incidentType === "slow" &&
    confirmingResultDb.isAvailable &&
    thresholdInitiallyExceeded !== null &&
    confirmingResultDb.responseTime !== null &&
    confirmingResultDb.responseTime > thresholdInitiallyExceeded
  ) {
    issueConfirmedForAlerting = true;
    console.log(
      `${logPrefix} CONFIRMED SLOW for alerts for Incident ${incidentForConfirmation.id} (Recheck RT: ${confirmingResultDb.responseTime}ms > Original Trigger Threshold: ${thresholdInitiallyExceeded}ms).`,
    );
  } else {
    console.log(
      `${logPrefix} ${incidentType.toUpperCase()} condition NOT confirmed by recheck for alerts for Incident ${incidentForConfirmation.id}. Recheck Result -> Avail: ${confirmingResultDb.isAvailable}, RT: ${confirmingResultDb.responseTime}ms. Original Trigger Threshold (if slow): ${thresholdInitiallyExceeded ?? "N/A"}`,
    );
  }

  if (issueConfirmedForAlerting) {
    console.log(
      `${logPrefix} Issue confirmed for Incident ${incidentForConfirmation.id}. Checking users for alerts.`,
    );

    const baseWhereClause: Prisma.WebsiteUserWhereInput = {
      websiteId: website.id,
      alertEnabled: true,
    };

    if (incidentType === "slow") {
      if (confirmingResultDb.responseTime !== null) {
        baseWhereClause.alertThreshold = {
          not: null,
          gt: 0,
          // User's threshold must be LESS THAN the measured response time for an alert
          lt: confirmingResultDb.responseTime,
        };
      } else {
        console.log(
          `${logPrefix} Confirmed SLOW incident ${incidentForConfirmation.id} but confirmation recheck had null responseTime. No threshold-based alerts will be sent.`,
        );
        baseWhereClause.id = -1; // Effectively no users
      }
    }

    const usersToAlert = await prisma.websiteUser.findMany({
      where: baseWhereClause,
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
        isPinned: true,
      },
    });

    if (usersToAlert.length === 0) {
      console.log(
        `${logPrefix} No users found requiring an alert for this confirmed ${incidentType} incident ${incidentForConfirmation.id}.`,
      );
      return;
    }
    console.log(
      `${logPrefix} Found ${usersToAlert.length} users to notify for incident ${incidentForConfirmation.id}.`,
    );

    for (const user of usersToAlert) {
      await createAlertAndNotify(
        website,
        user,
        incidentForConfirmation, // Pass the existing incident
        confirmingResultDb,   // Pass the result of the recheck
      );
    }
  }
}

/**
 * Creates an alert record in the database and sends an email notification
 * to the user if they have an email configured.
 */
async function createAlertAndNotify(
  website: PrismaWebsite,
  websiteUser: PrismaWebsiteUser,
  incident: PrismaIncident,
  confirmingResult: PrismaMonitoringResult, // This is the result from the recheck
): Promise<void> {
  const logPrefix = `[AlertNotify U:${websiteUser.userId} W:${website.id} I:${incident.id}]`;
  const alertType = incident.type as AlertType;

  const existingAlert = await prisma.alert.findFirst({
    where: {
      userId: websiteUser.userId,
      websiteId: website.id,
      type: alertType,
      incidentId: incident.id,
    },
    select: { id: true },
  });

  if (existingAlert) {
    console.log(
      `${logPrefix} Skipped ${alertType.toUpperCase()} alert creation (Alert ID: ${existingAlert.id} already exists for Incident ${incident.id}).`,
    );
    return;
  }

  let message = "";
  const websiteDisplayName = websiteUser.name || website.url;

  if (alertType === "down") {
    message = `Website is down: ${websiteDisplayName}`;
    if (confirmingResult.statusCode)
      message += ` (Status: ${confirmingResult.statusCode})`;
    if (confirmingResult.errorMessage)
      message += ` - Error: ${confirmingResult.errorMessage}`;
    message += ` (Incident ID: ${incident.id})`;
  } else if (alertType === "slow") {
    const responseTimeMsg =
      confirmingResult.responseTime !== null
        ? `${confirmingResult.responseTime}ms`
        : "N/A";
    const userThresholdMsg = 
      websiteUser.alertThreshold !== null 
        ? `${websiteUser.alertThreshold}ms` 
        : "N/A";
    message = `Website is responding slowly: ${websiteDisplayName} (${responseTimeMsg} > ${userThresholdMsg}) (Incident ID: ${incident.id})`;
  }

  let newAlert: PrismaAlert | null = null;
  try {
    newAlert = await prisma.alert.create({
      data: {
        userId: websiteUser.userId,
        websiteId: website.id,
        type: alertType,
        message: message,
        incidentId: incident.id,
      },
    });
    console.log(
      `${logPrefix} Created ${alertType.toUpperCase()} Alert ID: ${newAlert.id} linked to Incident ID: ${incident.id}.`,
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      console.warn(
        `${logPrefix} Alert creation race condition likely occurred for ${alertType} alert for Incident ${incident.id}. Skipping notification.`,
      );
      return;
    } else {
      console.error(
        `${logPrefix} Error creating ${alertType.toUpperCase()} alert for Incident ${incident.id}:`,
        error,
      );
      return;
    }
  }

  if (newAlert && websiteUser.notifyEmail) {
    let emailSubject = "";
    let emailBody = "";
    if (alertType === "down") {
      emailSubject = `🔴 CONFIRMED DOWN: ${websiteDisplayName}`;
      emailBody = `<p>Your monitored website <strong>${websiteDisplayName}</strong> is confirmed to be down.</p><p>Status Code: ${confirmingResult.statusCode ?? "N/A"}<br>Error Message: ${confirmingResult.errorMessage ?? "No specific error reported"}<br>Time Confirmed: ${incident.startTime.toLocaleString()}</p><p>Incident ID: ${incident.id}</p><p>Alert ID: ${newAlert.id}</p><p>Please check the dashboard for details and recovery status.</p>`;
    } else {
      const responseTimeBody =
        confirmingResult.responseTime !== null
          ? `${confirmingResult.responseTime}ms`
          : "N/A";
      const userThresholdEmail = websiteUser.alertThreshold ?? "N/A";
      emailSubject = `🟠 CONFIRMED SLOW: ${websiteDisplayName}`;
      emailBody = `<p>Your monitored website <strong>${websiteDisplayName}</strong> is confirmed to be responding slowly.</p><p>Response Time: ${responseTimeBody} (Your Threshold: ${userThresholdEmail}ms)<br>Time Confirmed: ${incident.startTime.toLocaleString()}</p><p>Incident ID: ${incident.id}</p><p>Alert ID: ${newAlert.id}</p><p>Please check the dashboard for details and recovery status.</p>`;
    }
    try {
      console.log(
        `${logPrefix} Attempting to send ${alertType} email alert to ${websiteUser.notifyEmail}`,
      );
      await sendMail({
        to: websiteUser.notifyEmail,
        subject: emailSubject,
        html: emailBody,
      });
      console.log(`${logPrefix} Successfully sent ${alertType} email alert.`);
    } catch (emailError) {
      console.error(
        `${logPrefix} Failed to send ${alertType} email notification for Alert ID ${newAlert.id}:`,
        emailError,
      );
    }
  } else if (newAlert && !websiteUser.notifyEmail) {
    console.log(
      `${logPrefix} Skipped email notification for Alert ID ${newAlert.id} (User has no notification email).`,
    );
  }
}

/**
 * Dismisses (deletes) all active alerts of a specific type for a given website.
 * Typically used upon incident recovery.
 */
async function dismissAlertsByType(
  websiteId: number,
  type: AlertType,
): Promise<void> {
  const logPrefix = `[AlertDismiss W:${websiteId} T:${type}]`;
  try {
    const deleteResult = await prisma.alert.deleteMany({
      where: {
        websiteId: websiteId,
        type: type,
        // Optionally, only dismiss alerts linked to incidents that are now closed.
        // For simplicity, current logic dismisses all of type for the website.
      },
    });
    if (deleteResult.count > 0) {
      console.log(
        `${logPrefix} Dismissed ${deleteResult.count} active '${type}' alerts upon recovery.`,
      );
    }
  } catch (error) {
    console.error(`${logPrefix} Error dismissing alerts upon recovery:`, error);
  }
}


/**
 * Retrieves alerts for a specific user, with optional filtering.
 */
export async function getAlertsForUser(
  userId: string,
  options: AlertQueryOptions = {},
): Promise<PrismaAlert[]> {
  const { limit = 50, type, from, to, websiteId } = options;


  const whereClause: Prisma.AlertWhereInput = { userId: userId };
  if (type && VALID_ALERT_TYPES.includes(type)) whereClause.type = type;
  if (from || to) {
    whereClause.createdAt = {};
    if (from) whereClause.createdAt.gte = from;
    if (to) whereClause.createdAt.lte = to;
  }
  if (websiteId !== undefined) whereClause.websiteId = websiteId;

  return prisma.alert.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      website: {
        select: {
          id: true,
          url: true,
          websiteUsers: {
            where: { userId: userId },
            select: { name: true },
          },
        },
      },
      incident: {
        select: { id: true, startTime: true, endTime: true },
      },
    },
  });
}

/**
 * Retrieves alerts for a specific website, with optional filtering.
 * Includes website URL, user details, and related incident info.
 */
export async function getAlertsByWebsite(
  websiteId: number,
  options: AlertQueryOptions = {},
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
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      website: { select: { id: true, url: true } },
      user: { select: { id: true, name: true, email: true } },
      incident: { select: { id: true, startTime: true, endTime: true } },
    },
  });
}

/**
 * Dismisses (deletes) a specific alert if the user owns it.
 */
export async function dismissAlert(
  userId: string,
  alertId: number,
): Promise<PrismaAlert | null> {
  const logPrefix = `[Alert Dismiss U:${userId} A:${alertId}]`;
  console.log(`${logPrefix} Attempting to dismiss alert.`);

  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    select: { userId: true },
  });

  if (!alert) {
    console.log(`${logPrefix} Alert not found.`);
    return null;
  }

  if (alert.userId !== userId) {
    console.warn(
      `${logPrefix} User does not own this alert. Dismissal denied.`,
    );
    throw new Error("Forbidden: User does not own this alert");
  }

  try {
    const deletedAlert = await prisma.alert.delete({ where: { id: alertId } });
    console.log(`${logPrefix} Alert successfully dismissed.`);
    return deletedAlert;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      console.log(`${logPrefix} Alert was already deleted.`);
      return null;
    }
    console.error(`${logPrefix} Error dismissing alert:`, error);
    throw error;
  }
}

/**
 * Calculates statistics about alerts for a specific user over a given period.
 */
export async function getUserAlertStats(
  userId: string,
  days = 7,
): Promise<AlertStats> {
  const startDate = subHours(new Date(), days * 24);

  const alerts = await prisma.alert.findMany({
    where: {
      userId: userId,
      createdAt: { gte: startDate },
    },
    select: {
      type: true,
      websiteId: true,
      incidentId: true,
      website: {
        select: {
          url: true,
          websiteUsers: {
            where: { userId: userId },
            select: { name: true },
          },
        },
      },
    },
  });

  const totalAlerts = alerts.length;
  const byType: Partial<Record<AlertType, number>> = {};
  const websiteMap = new Map<
    number,
    { websiteId: number; websiteName: string; count: number }
  >();

  alerts.forEach((alert) => {
    const alertType = alert.type as AlertType;
    byType[alertType] = (byType[alertType] || 0) + 1;

    const customName = alert.website?.websiteUsers?.[0]?.name;
    const websiteName =
      customName || alert.website?.url || `Website ${alert.websiteId}`;

    if (!websiteMap.has(alert.websiteId)) {
      websiteMap.set(alert.websiteId, {
        websiteId: alert.websiteId,
        websiteName: websiteName,
        count: 0,
      });
    }
    websiteMap.get(alert.websiteId)!.count++;
  });

  const byWebsite = Array.from(websiteMap.values()).sort(
    (a, b) => b.count - a.count,
  );

  return { totalAlerts, byType, byWebsite };
}