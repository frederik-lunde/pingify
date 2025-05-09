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
 * Handles incident resolution, alert dismissal, and scheduling of confirmation checks.
 */
export async function handleResultProcessing(
  website: PrismaWebsite,
  result: PrismaMonitoringResult,
): Promise<void> {
  const logPrefix = `[ResultProc W:${website.id} R:${result.id}]`;
  console.log(
    `${logPrefix} Processing result. Available: ${result.isAvailable}, RT: ${result.responseTime}ms`,
  );
  let recoveryProcessed = false;


  const openDownIncident = await IncidentService.getOpenIncident(
    website.id,
    "down",
  );
  if (openDownIncident && result.isAvailable) {
    console.log(
      `${logPrefix} Recovery detected for DOWN incident (ID: ${openDownIncident.id}).`,
    );
    await IncidentService.resolveIncident(
      openDownIncident.id,
      result.checkedAt,
      result.id,
    );
    await dismissAlertsByType(website.id, "down");
    recoveryProcessed = true;
  }

  const openSlowIncident = await IncidentService.getOpenIncident(
    website.id,
    "slow",
  );
  if (openSlowIncident) {
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

    const recoveryThreshold =
      relevantThresholds.length > 0 ? Math.min(...relevantThresholds) : null;

    const isRecoveredSlow =
      result.isAvailable &&
      (recoveryThreshold === null ||
        (result.responseTime !== null &&
          result.responseTime <= recoveryThreshold));

    if (isRecoveredSlow) {
      console.log(
        `${logPrefix} Recovery detected for SLOW incident (ID: ${openSlowIncident.id}). RT: ${result.responseTime}ms <= Lowest Threshold: ${recoveryThreshold ?? "N/A"}`,
      );
      await IncidentService.resolveIncident(
        openSlowIncident.id,
        result.checkedAt,
        result.id,
      );
      await dismissAlertsByType(website.id, "slow");
      recoveryProcessed = true;
    }
  }


  if (recoveryProcessed) {
    console.log(
      `${logPrefix} Skipping new incident check as recovery was just processed.`,
    );
    return;
  }

  let potentialType: IncidentType | null = null;
  let thresholdForSlow: number | null = null;

  if (!result.isAvailable) {
    const isDownIncidentOpen = !!(await IncidentService.getOpenIncident(
      website.id,
      "down",
    ));
    if (!isDownIncidentOpen) {
      potentialType = "down";
      console.log(
        `${logPrefix} Potential DOWN incident detected (Result unavailable, no open 'down' incident).`,
      );
    } else {
      console.log(
        `${logPrefix} Result unavailable, but DOWN incident already open. No action needed.`,
      );
    }
  } else if (result.responseTime !== null) {
    const isSlowIncidentOpen = !!(await IncidentService.getOpenIncident(
      website.id,
      "slow",
    ));
    if (!isSlowIncidentOpen) {
      const allUserThresholds = await prisma.websiteUser.findMany({
        where: {
          websiteId: website.id,
          alertThreshold: { not: null, gt: 0 },
        },
        select: { alertThreshold: true },
      });
      const relevantThresholds = allUserThresholds
        .map((u) => u.alertThreshold)
        .filter((t): t is number => t !== null);

      let lowestExceededThreshold: number | null = null;
      for (const threshold of relevantThresholds) {
        if (result.responseTime > threshold) {
          if (
            lowestExceededThreshold === null ||
            threshold < lowestExceededThreshold
          ) {
            lowestExceededThreshold = threshold;
          }
        }
      }

      if (lowestExceededThreshold !== null) {
        potentialType = "slow";
        thresholdForSlow = lowestExceededThreshold;
        console.log(
          `${logPrefix} Potential SLOW incident detected (RT: ${result.responseTime}ms > Lowest Exceeded Threshold: ${thresholdForSlow}ms, no open 'slow' incident).`,
        );
      }
    } else {
      console.log(
        `${logPrefix} Result is slow (RT: ${result.responseTime}ms), but SLOW incident already open. No action needed.`,
      );
    }
  }

  if (potentialType) {
    await scheduleIncidentConfirmationCheck(
      website.id,
      result,
      potentialType,
      thresholdForSlow,
    );
  } else {
    console.log(`${logPrefix} No new potential incident detected.`);
  }
}

/**
 * Schedules a delayed check to confirm a potential incident.
 */
async function scheduleIncidentConfirmationCheck(
  websiteId: number,
  initialResult: PrismaMonitoringResult,
  potentialType: IncidentType,
  thresholdForSlow: number | null,
): Promise<void> {
  const delayMs = RECHECK_DELAY_SECONDS * 1000;
  const logPrefix = `[IncidentConfirmSched W:${websiteId} T:${potentialType}]`;
  console.log(
    `${logPrefix} Scheduling confirmation check in ${RECHECK_DELAY_SECONDS}s. Initial Result ID: ${initialResult.id}`,
  );

  setTimeout(async () => {
    console.log(
      `${logPrefix} Executing delayed ${potentialType} confirmation check.`,
    );
    try {
      const website = await prisma.website.findUnique({
        where: { id: websiteId },
      });
      if (!website || !website.isActive) {
        console.log(
          `${logPrefix} Confirmation check cancelled (website not found or inactive).`,
        );
        return;
      }
      const freshInitialResult = await prisma.monitoringResult.findUnique({
        where: { id: initialResult.id },
      });
      if (!freshInitialResult) {
        console.log(
          `${logPrefix} Confirmation check cancelled (initial result ${initialResult.id} missing).`,
        );
        return;
      }
      await handleIncidentConfirmation(
        website,
        freshInitialResult,
        potentialType,
        thresholdForSlow,
      );
    } catch (error) {
      console.error(
        `${logPrefix} Error during delayed confirmation check execution:`,
        error,
      );
    }
  }, delayMs);
}

/**
 * Performs a confirmation check for a potential incident. If confirmed,
 * creates an incident record and triggers alert notifications for relevant users.
 */
async function handleIncidentConfirmation(
  website: PrismaWebsite,
  initialResult: PrismaMonitoringResult,
  potentialType: IncidentType,
  thresholdForSlow: number | null,
): Promise<void> {
  const logPrefix = `[IncidentConfirm W:${website.id} T:${potentialType}]`;
  console.log(`${logPrefix} Performing confirmation check.`);

  const existingOpenIncident = await IncidentService.getOpenIncident(
    website.id,
    potentialType,
  );
  if (existingOpenIncident) {
    console.log(
      `${logPrefix} Confirmation check skipped: An incident (ID: ${existingOpenIncident.id}) of type '${potentialType}' was already opened.`,
    );
    return;
  }

  const confirmationCheckData: MonitoringResponse =
    await WebsiteMonitor.performWebsiteCheck(website.url);
  let confirmingResultDb: PrismaMonitoringResult;
  try {
    confirmingResultDb = await ResultsManager.saveResult(
      website.id,
      confirmationCheckData,
    );
    console.log(
      `${logPrefix} Confirmation check result saved (ID: ${confirmingResultDb.id}). Avail=${confirmingResultDb.isAvailable}, RT=${confirmingResultDb.responseTime}ms`,
    );
  } catch (saveError) {
    console.error(
      `${logPrefix} CRITICAL: Failed to save confirmation check result:`,
      saveError,
    );
    return;
  }

  let issueConfirmed = false;
  let confirmedType: IncidentType | null = null;

  if (potentialType === "down" && !confirmingResultDb.isAvailable) {
    issueConfirmed = true;
    confirmedType = "down";
    console.log(`${logPrefix} CONFIRMED DOWN.`);
  } else if (
    potentialType === "slow" &&
    confirmingResultDb.isAvailable &&
    thresholdForSlow !== null &&
    confirmingResultDb.responseTime !== null &&
    confirmingResultDb.responseTime > thresholdForSlow
  ) {
    issueConfirmed = true;
    confirmedType = "slow";
    console.log(
      `${logPrefix} CONFIRMED SLOW (RT: ${confirmingResultDb.responseTime}ms > Original Threshold: ${thresholdForSlow}ms).`,
    );
  } else {
    console.log(
      `${logPrefix} ${potentialType.toUpperCase()} condition NOT confirmed by check. Check Result -> Avail: ${confirmingResultDb.isAvailable}, RT: ${confirmingResultDb.responseTime}ms. Original Threshold (if slow): ${thresholdForSlow ?? "N/A"}`,
    );
  }

  if (issueConfirmed && confirmedType) {
    const newIncident = await IncidentService.createIncident(
      website.id,
      confirmedType,
      confirmingResultDb.checkedAt,
      initialResult.id,
      confirmingResultDb.id,
    );

    if (!newIncident) {
      console.error(
        `${logPrefix} Failed to create incident record. Aborting alert generation.`,
      );
      return;
    }
    console.log(
      `${logPrefix} Incident ${newIncident.id} created/confirmed. Checking users for alerts.`,
    );


    const baseWhereClause: Prisma.WebsiteUserWhereInput = {
      websiteId: website.id,
      alertEnabled: true,
    };


    if (confirmedType === "slow") {
      if (confirmingResultDb.responseTime !== null) {
        baseWhereClause.alertThreshold = {
          not: null,
          lte: confirmingResultDb.responseTime,
        };
      } else {
        console.log(
          `${logPrefix} Confirmed SLOW incident ${newIncident.id} but confirmation check had null responseTime. No threshold-based alerts will be sent.`,
        );
        baseWhereClause.id = -1;
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
        `${logPrefix} No users found requiring an alert for this confirmed ${confirmedType} incident ${newIncident.id}.`,
      );
      return;
    }
    console.log(
      `${logPrefix} Found ${usersToAlert.length} users to notify for incident ${newIncident.id}.`,
    );

    for (const user of usersToAlert) {

      await createAlertAndNotify(
        website,
        user,
        newIncident,
        confirmingResultDb,
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
  confirmingResult: PrismaMonitoringResult,
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
    message = `Website is responding slowly: ${websiteDisplayName} (${responseTimeMsg} > ${websiteUser.alertThreshold ?? "N/A"}ms) (Incident ID: ${incident.id})`;
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
      emailSubject = `🟠 CONFIRMED SLOW: ${websiteDisplayName}`;
      emailBody = `<p>Your monitored website <strong>${websiteDisplayName}</strong> is confirmed to be responding slowly.</p><p>Response Time: ${responseTimeBody} (Your Threshold: ${websiteUser.alertThreshold ?? "N/A"}ms)<br>Time Confirmed: ${incident.startTime.toLocaleString()}</p><p>Incident ID: ${incident.id}</p><p>Alert ID: ${newAlert.id}</p><p>Please check the dashboard for details and recovery status.</p>`;
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