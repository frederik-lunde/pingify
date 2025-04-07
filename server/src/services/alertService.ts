// server/src/services/alertService.ts

import {
    Website as PrismaWebsite,
    Alert as PrismaAlert,
    WebsiteUser as PrismaWebsiteUser,
    MonitoringResult as PrismaMonitoringResult,
    Prisma,
  } from '@prisma/client';
  import { emailTransporter, EMAIL_FROM, RECHECK_DELAY_SECONDS as CONFIG_RECHECK_DELAY } from '../config/config'; // Adjust path, get delay from config
  import prisma from '../prisma/prismaClient'; // Adjust path
  // Import the SHARED MonitoringResponse type and other needed types
  import { AlertQueryOptions, AlertType, AlertStats, VALID_ALERT_TYPES, MonitoringResponse } from '../types'; // Adjust path
  // Import the necessary classes/methods from monitoringService
  import { WebsiteMonitor, ResultsManager } from './monitoringService'; // Import the CLASSES
  
  const RECHECK_DELAY_SECONDS = CONFIG_RECHECK_DELAY ?? 60; // Delay for the confirmation check, fallback to 60
  
  // --- Placeholder for Actual Recheck Scheduling ---
  // IMPORTANT: Replace this with your chosen persistent mechanism (BullMQ, RabbitMQ, DB queue etc.)
  async function scheduleRecheckTask(
      websiteId: number,
      userId: number,
      initialResult: PrismaMonitoringResult, // Pass the full initial result object
      potentialType: AlertType // 'down' or 'slow'
  ): Promise<void> {
      const delayMs = RECHECK_DELAY_SECONDS * 1000;
      const logPrefix = `[Recheck Scheduler U:${userId} W:${websiteId}]`;
      console.log(`${logPrefix} Scheduling ${potentialType} recheck in ${RECHECK_DELAY_SECONDS}s. Initial Result ID: ${initialResult.id}`);
  
      // EXAMPLE using setTimeout (NOT recommended for production)
      setTimeout(async () => {
          console.log(`${logPrefix} Executing delayed ${potentialType} recheck.`);
          try {
              // Fetch fresh data inside the delayed task in case settings changed
              const website = await prisma.website.findUnique({ where: { id: websiteId } });
              const websiteUser = await prisma.websiteUser.findUnique({
                  where: { userId_websiteId: { userId, websiteId } }
              });
              const freshInitialResult = await prisma.monitoringResult.findUnique({ where: { id: initialResult.id }});
  
              if (!website || !websiteUser || !websiteUser.alertEnabled || !freshInitialResult) {
                   console.log(`${logPrefix} Recheck cancelled (website/user not found, alerts disabled, or initial result missing).`);
                   return;
              }
              await handleRecheckConfirmation(website, websiteUser, freshInitialResult, potentialType);
          } catch (error) {
              console.error(`${logPrefix} Error during delayed recheck execution:`, error);
          }
      }, delayMs);
  
      // // EXAMPLE using a BullMQ queue (Conceptual)
      // import { recheckQueue } from './queueService'; // Assuming you set up a queue
      // try {
      //    // Use a unique job ID to prevent duplicates if the scheduler triggers rapidly
      //    const jobId = `recheck-${websiteId}-${userId}-${potentialType}`;
      //    await recheckQueue.add(
      //        'recheck', // Job name
      //        { websiteId, userId, initialResultId: initialResult.id, potentialType }, // Job data
      //        { delay: delayMs, jobId: jobId, removeOnComplete: true, removeOnFail: 100 } // Options
      //    );
      //    console.log(`${logPrefix} Added ${potentialType} recheck job to queue (ID: ${jobId}).`);
      // } catch (queueError) {
      //    console.error(`${logPrefix} Failed to add recheck job to queue:`, queueError);
      // }
  }
  
  // --- Email Notification ---
  interface EmailAlertOptions {
      to: string;
      subject: string;
      body: string;
  }
  
  async function sendEmailAlert({ to, subject, body }: EmailAlertOptions): Promise<void> {
      if (!emailTransporter) {
          console.warn(`[Email] Transporter not configured. Skipping email to: ${to}`);
          return;
      }
      try {
          await emailTransporter.sendMail({ from: EMAIL_FROM, to, subject, html: body });
          console.log(`[Email] Alert sent successfully to ${to}`);
      } catch (error) {
          console.error(`[Email] Failed to send alert email to ${to}:`, error);
      }
  }
  
  // --- Core Alert Logic ---
  
  /**
   * Called immediately after a monitoring check potentially indicates an issue.
   * Determines if a recheck is needed based on user settings and schedules it.
   */
  export async function handlePotentialAlertCondition(
      website: PrismaWebsite,
      result: PrismaMonitoringResult // The result that was just saved
  ): Promise<void> {
      const logPrefix = `[Alert Check W:${website.id} R:${result.id}]`;
  
      const usersToPotentiallyAlert = await prisma.websiteUser.findMany({
          where: { websiteId: website.id, alertEnabled: true },
          select: { userId: true, alertThreshold: true }
      });
  
      if (usersToPotentiallyAlert.length === 0) { return; }
  
      console.log(`${logPrefix} Found ${usersToPotentiallyAlert.length} users with alerts enabled. Evaluating conditions...`);
  
      for (const websiteUser of usersToPotentiallyAlert) {
          const userLogPrefix = `${logPrefix} U:${websiteUser.userId}`;
          let potentialType: AlertType | null = null;
  
          // Check for DOWN condition
          if (!result.isAvailable) {
              potentialType = 'down';
              console.log(`${userLogPrefix} Potential DOWN condition detected.`);
          }
          // Check for SLOW condition
          else if (
              websiteUser.alertThreshold !== null &&
              result.responseTime !== null &&
              result.responseTime > websiteUser.alertThreshold
          ) {
              potentialType = 'slow';
              console.log(`${userLogPrefix} Potential SLOW condition detected (${result.responseTime}ms > ${websiteUser.alertThreshold}ms).`);
          }
  
          if (potentialType) {
              await scheduleRecheckTask(website.id, websiteUser.userId, result, potentialType);
          }
      }
  }
  
  /**
   * Called *after* the recheck delay. Performs the confirmation check and creates
   * the Alert record + sends notification if the condition persists.
   */
  async function handleRecheckConfirmation(
      website: PrismaWebsite, // Fresh data fetched by scheduler/worker
      websiteUser: PrismaWebsiteUser, // Fresh data fetched by scheduler/worker
      initialResult: PrismaMonitoringResult, // The result that triggered the recheck (fetched fresh by scheduler)
      potentialType: AlertType // The type of issue we are rechecking ('down' or 'slow')
  ): Promise<void> {
      const logPrefix = `[Alert Confirm U:${websiteUser.userId} W:${website.id}]`;
      console.log(`${logPrefix} Performing ${potentialType} confirmation check.`);
  
      // Perform the actual recheck NOW using the static method from WebsiteMonitor
      console.log(`${logPrefix} Performing check via WebsiteMonitor.performWebsiteCheck...`);
      const confirmationResultData: MonitoringResponse = await WebsiteMonitor.performWebsiteCheck(website.url);
  
      // Save the result of this recheck using ResultsManager for consistency
      let recheckResultDb: PrismaMonitoringResult;
      try {
          recheckResultDb = await ResultsManager.saveResult(website.id, confirmationResultData);
          console.log(`${logPrefix} Recheck Result saved (ID: ${recheckResultDb.id}). Available: ${recheckResultDb.isAvailable}, ResponseTime: ${recheckResultDb.responseTime}ms`);
      } catch (saveError) {
          console.error(`${logPrefix} CRITICAL: Failed to save recheck result:`, saveError);
          console.error(`${logPrefix} Aborting alert confirmation due to failure saving recheck result.`);
          return;
      }
  
      // --- Confirmation Logic (Uses recheckResultDb) ---
      let issueConfirmed = false;
      let confirmedType: AlertType | null = null;
      let message = '';
  
      // Confirm DOWN
      if (potentialType === 'down' && !recheckResultDb.isAvailable) {
          issueConfirmed = true;
          confirmedType = 'down';
          message = `Website is down: ${websiteUser.name || website.url}${recheckResultDb.statusCode ? ` (Status: ${recheckResultDb.statusCode})` : ''}${recheckResultDb.errorMessage ? ` - Error: ${recheckResultDb.errorMessage}` : ''} (Confirmed)`;
          console.log(`${logPrefix} CONFIRMED DOWN.`);
      }
      // Confirm SLOW
      else if (
          potentialType === 'slow' &&
          recheckResultDb.isAvailable &&
          websiteUser.alertThreshold !== null &&
          recheckResultDb.responseTime !== null &&
          recheckResultDb.responseTime > websiteUser.alertThreshold
      ) {
          const wasInitialSlow = initialResult.isAvailable && initialResult.responseTime !== null && websiteUser.alertThreshold !== null && initialResult.responseTime > websiteUser.alertThreshold;
          if (wasInitialSlow) {
              issueConfirmed = true;
              confirmedType = 'slow';
              message = `Website is responding slowly: ${websiteUser.name || website.url} (${recheckResultDb.responseTime}ms > ${websiteUser.alertThreshold}ms) (Confirmed)`;
              console.log(`${logPrefix} CONFIRMED SLOW (${recheckResultDb.responseTime}ms > ${websiteUser.alertThreshold}ms).`);
          } else {
              console.log(`${logPrefix} Slow condition NOT confirmed (initial check wasn't slow or recheck is now fast). Initial: ${initialResult.responseTime}ms, Recheck: ${recheckResultDb.responseTime}ms, Threshold: ${websiteUser.alertThreshold}ms`);
          }
      } else {
          console.log(`${logPrefix} ${potentialType.toUpperCase()} condition NOT confirmed by recheck. Recheck Result -> Available: ${recheckResultDb.isAvailable}, ResponseTime: ${recheckResultDb.responseTime}ms`);
      }
  
      // --- Create Alert if Confirmed ---
      if (issueConfirmed && confirmedType) {
          // **Prevent Duplicate Active Alerts** for the SAME user, website, and type
          const existingAlert = await prisma.alert.findFirst({
              where: { userId: websiteUser.userId, websiteId: website.id, type: confirmedType },
              select: { id: true }
          });
  
          if (existingAlert) {
              console.log(`${logPrefix} Skipped ${confirmedType.toUpperCase()} alert creation (Alert ID: ${existingAlert.id} already exists for this user/website/type).`);
              return;
          }
  
          // Create the Alert
          try {
              const newAlert = await prisma.alert.create({
                  data: {
                      userId: websiteUser.userId,
                      websiteId: website.id,
                      type: confirmedType,
                      message: message,
                  }, // createdAt handled by default
              });
              console.log(`${logPrefix} Created ${confirmedType.toUpperCase()} Alert ID: ${newAlert.id}.`);
  
              // Send Email Notification ONLY for 'down' alerts
              if (confirmedType === 'down' && websiteUser.notifyEmail) {
                  const emailBody = `
                      <p>Your monitored website <strong>${websiteUser.name || website.url}</strong> is confirmed to be down.</p>
                      <p>
                          Status Code: ${recheckResultDb.statusCode ?? 'N/A'}<br>
                          Error Message: ${recheckResultDb.errorMessage ?? 'No specific error reported'}<br>
                          Time Confirmed: ${new Date().toLocaleString()}
                      </p>
                      <p>Alert ID: ${newAlert.id}</p>
                      <p>Please check the dashboard for status updates. No recovery emails will be sent with this simplified system.</p>`;
                  await sendEmailAlert({
                      to: websiteUser.notifyEmail,
                      subject: `🔴 CONFIRMED DOWN: ${websiteUser.name || website.url}`,
                      body: emailBody
                  });
              }
          } catch (error) {
               if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                   console.warn(`${logPrefix} Alert creation race condition likely occurred for ${confirmedType} alert. An alert might already exist now. Skipping.`);
               } else {
                   console.error(`${logPrefix} Error creating ${confirmedType.toUpperCase()} alert or sending notification:`, error);
               }
          }
      }
  }
  
  
  // --- Data Fetching & Actions for API Endpoints ---
  
  /**
   * Get *active* alerts for a specific user with optional filtering.
   */
  export async function getAlertsForUser(
      userId: number,
      options: AlertQueryOptions = {}
  ): Promise<PrismaAlert[]> { // Returns PrismaAlert[] which controller might map
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
                      websiteUsers: { // Include to get user's custom name
                          where: { userId },
                          select: { name: true }
                      }
                  }
              },
          }
      });
  }
  
  /**
   * Get *active* alerts for a specific website (requires user access check in controller).
   */
  export async function getAlertsByWebsite(
      websiteId: number,
      options: AlertQueryOptions = {}
  ): Promise<PrismaAlert[]> { // Returns PrismaAlert[] which controller might map
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
               user: { select: { id: true, name: true, email: true } } // Include user for context
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
  
      const alert = await prisma.alert.findUnique({
          where: { id: alertId },
          select: { userId: true }
      });
  
      if (!alert) {
          console.log(`${logPrefix} Alert not found.`);
          return null;
      }
  
      if (alert.userId !== userId) {
          console.warn(`${logPrefix} User does not own this alert. Dismissal denied.`);
          throw new Error('Forbidden: User does not own this alert');
      }
  
      try {
          const deletedAlert = await prisma.alert.delete({
              where: { id: alertId }
          });
          console.log(`${logPrefix} Alert successfully dismissed.`);
          return deletedAlert;
      } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
              console.log(`${logPrefix} Alert was already deleted.`);
              return null;
          }
          console.error(`${logPrefix} Error dismissing alert:`, error);
          throw error;
      }
  }
  
  /**
   * Get *active* alert statistics for a specific user.
   */
  export async function getUserAlertStats(userId: number, days = 7): Promise<AlertStats> {
      const startDate = new Date(); startDate.setDate(startDate.getDate() - days); startDate.setHours(0, 0, 0, 0);
  
      const alerts = await prisma.alert.findMany({
          where: {
              userId: userId,
              createdAt: { gte: startDate }
          },
          select: {
              type: true, websiteId: true,
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
  
      const totalAlerts = alerts.length;
      const byType: Partial<Record<AlertType, number>> = {};
      const websiteMap = new Map<number, { websiteId: number, websiteName: string, count: number }>();
  
      alerts.forEach(alert => {
          const alertType = alert.type as AlertType;
          byType[alertType] = (byType[alertType] || 0) + 1;
  
          const customName = alert.website?.websiteUsers?.[0]?.name;
          const websiteName = customName || alert.website?.url || `Website ${alert.websiteId}`;
  
          if (!websiteMap.has(alert.websiteId)) {
              websiteMap.set(alert.websiteId, { websiteId: alert.websiteId, websiteName: websiteName, count: 0 });
          }
          websiteMap.get(alert.websiteId)!.count++;
      });
  
      const byWebsite = Array.from(websiteMap.values()).sort((a, b) => b.count - a.count);
  
      return { totalAlerts, byType, byWebsite };
  }