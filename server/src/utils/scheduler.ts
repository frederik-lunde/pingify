// server/src/utils/scheduler.ts

import cron from 'node-cron';
import { Website as PrismaWebsite, Prisma } from '@prisma/client'; // Use alias if Website type clashes
import { CONCURRENCY, DEFAULT_INTERVAL, MONITORING_RESULTS_TO_KEEP, RESOLVED_ALERT_LINK_CLEANUP_DAYS } from '../config/config'; // Import config values
import { WebsiteMonitor } from '../services/monitoringService'; // Assume monitoring logic is here
import prisma from '../prisma/prismaClient'; // Adjust the path if needed

// --- Configuration (Consider moving defaults to config file if not already there) ---
const BATCH_CONCURRENCY = CONCURRENCY ?? 5; // Default concurrency for checking websites
const DEFAULT_WEBSITE_INTERVAL = DEFAULT_INTERVAL ?? 300; // Default check interval in seconds
const RESULTS_TO_KEEP_PER_WEBSITE = MONITORING_RESULTS_TO_KEEP ?? 2000; // How many recent results to keep per site
const ALERT_LINK_CLEANUP_THRESHOLD_DAYS = RESOLVED_ALERT_LINK_CLEANUP_DAYS ?? 30; // Delete AlertUser links older than this

// --- Website Monitoring Logic ---

/**
 * Determines if a website is due for checking based on its interval and last check time.
 */
function isWebsiteDueForCheck(website: PrismaWebsite): boolean {
  // If website has never been checked, it's due
  if (!website.lastChecked) {
    // console.log(`Website ${website.id} (${website.url}) is due (never checked).`);
    return true;
  }

  // Calculate if the website's interval has passed
  // Use the specific website's interval if set, otherwise fallback to global default
  const intervalInSeconds = website.globalInterval ?? DEFAULT_WEBSITE_INTERVAL;
  const millisecondsSinceLastCheck = Date.now() - new Date(website.lastChecked).getTime();
  const isDue = millisecondsSinceLastCheck >= (intervalInSeconds * 1000);

  // if (isDue) {
  //   console.log(`Website ${website.id} (${website.url}) is due (last checked: ${website.lastChecked}, interval: ${intervalInSeconds}s).`);
  // }
  return isDue;
}

/**
 * Retrieves all websites marked as active from the database.
 */
async function getActiveWebsites(): Promise<PrismaWebsite[]> {
  return prisma.website.findMany({
    where: {
      isActive: true,
    },
  });
}

/**
 * Processes websites in batches to limit concurrency during checks.
 */
async function processBatches(websites: PrismaWebsite[]): Promise<void> {
  console.log(`Processing ${websites.length} websites in batches of ${BATCH_CONCURRENCY}...`);
  for (let i = 0; i < websites.length; i += BATCH_CONCURRENCY) {
    const batch = websites.slice(i, i + BATCH_CONCURRENCY);
    console.log(`Starting batch ${Math.floor(i / BATCH_CONCURRENCY) + 1}/${Math.ceil(websites.length / BATCH_CONCURRENCY)} (Size: ${batch.length})`);
    // Use Promise.allSettled to allow some checks to fail without stopping the entire batch
    const results = await Promise.allSettled(batch.map(website => {
        console.log(`  Checking website ID: ${website.id} URL: ${website.url}`);
        // Assuming WebsiteMonitor.checkWebsite handles its own errors internally for logging purposes
        return WebsiteMonitor.checkWebsite(website).catch(err => {
            // Catch errors at the individual check level as well
            console.error(`  Error checking website ${website.id} (${website.url}) directly:`, err);
            // Optionally return an error indicator if needed downstream
            return { websiteId: website.id, error: true };
        });
    }));

    // Log batch results (optional)
    results.forEach((result, index) => {
        const websiteId = batch[index].id;
        if (result.status === 'rejected') {
            console.error(`  Batch Check Failed (Promise Rejected) for Website ID ${websiteId}:`, result.reason);
        } else if (result.value && (result.value as any).error === true) {
             // This handles errors caught within the checkWebsite call itself if structured that way
             console.warn(`  Batch Check Completed with Error for Website ID ${websiteId}.`);
        } else {
            // console.log(`  Batch Check Completed for Website ID ${websiteId}.`);
        }
    });
    console.log(`Finished batch ${Math.floor(i / BATCH_CONCURRENCY) + 1}.`);
  }
}

/**
 * Main function to find and check websites that are due for monitoring.
 */
export async function checkDueWebsites(): Promise<void> {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting check for due websites...`);

  try {
    // 1. Retrieve all active websites
    const activeWebsites = await getActiveWebsites();
    if (activeWebsites.length === 0) {
        console.log("No active websites found.");
        return;
    }

    // 2. Filter for websites that are actually due for checking now
    const dueWebsites = activeWebsites.filter(isWebsiteDueForCheck);

    if (dueWebsites.length === 0) {
      console.log('No websites currently due for checking.');
      return;
    }

    console.log(`Found ${dueWebsites.length} websites due for monitoring.`);

    // 3. Process the due websites in batches
    await processBatches(dueWebsites);

    const duration = Date.now() - startTime;
    console.log(`Completed checking ${dueWebsites.length} websites in ${duration}ms.`);

  } catch (error) {
    console.error('Critical error during checkDueWebsites execution:', error);
  }
}


// --- Cleanup Tasks ---

/**
 * Deactivates websites that are marked active but have no associated users.
 */
export async function cleanupUnusedWebsites(): Promise<void> {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting cleanup of unused websites...`);
  try {
    // Define the criteria for unused websites
    const whereClause: Prisma.WebsiteWhereInput = {
      isActive: true,     // Only consider currently active websites
      websiteUsers: {     // Check the relation
        none: {},         // Condition: there are *no* related WebsiteUser records
      },
    };

    // Optional: Find and log them first for audit purposes
    const unusedWebsites = await prisma.website.findMany({
      where: whereClause,
      select: { id: true, url: true } // Select only needed fields
    });

    if (unusedWebsites.length === 0) {
      console.log('No unused websites found to deactivate.');
      return;
    }

    console.log(`Found ${unusedWebsites.length} active websites without any users. Deactivating...`);
    unusedWebsites.forEach(w => console.log(`  - Deactivating ID: ${w.id}, URL: ${w.url}`));

    // Deactivate all found websites in a single bulk update operation
    const updateResult = await prisma.website.updateMany({
      where: whereClause, // Use the same criteria to ensure atomicity
      data: { isActive: false }, // Set to inactive
    });

    const duration = Date.now() - startTime;
    console.log(`Deactivated ${updateResult.count} unused websites in ${duration}ms.`);

  } catch (error) {
    console.error('Failed to cleanup unused websites:', error);
  }
}

/**
 * Purges old monitoring results for each website, keeping only the most recent N records.
 */
export async function purgeOldMonitoringResults(resultsToKeep: number = RESULTS_TO_KEEP_PER_WEBSITE): Promise<void> {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting purge of old monitoring results (keeping last ${resultsToKeep} per website)...`);

  try {
    // Get IDs of all websites (active or inactive, as inactive sites might still have old data)
    const websites = await prisma.website.findMany({
      select: { id: true }
    });

    if (websites.length === 0) {
        console.log("No websites found. Skipping monitoring results purge.");
        return;
    }

    let totalPurgedCount = 0;
    let websitesProcessed = 0;

    // Process each website individually
    for (const website of websites) {
      try {
        // 1. Find the IDs of the most recent N results to KEEP for this website
        const recentResults = await prisma.monitoringResult.findMany({
          where: { websiteId: website.id },
          orderBy: { checkedAt: 'desc' }, // Order by check time descending
          take: resultsToKeep,             // Limit to the number we want to keep
          select: { id: true }             // Only select the ID
        });

        const recentResultIds = recentResults.map(r => r.id);

        // 2. Delete all results for this website whose IDs are NOT in the keep list
        const deleteResult = await prisma.monitoringResult.deleteMany({
          where: {
            websiteId: website.id,          // Target only this website
            id: { notIn: recentResultIds }  // Delete records NOT in the list of recent IDs
          }
        });

        if (deleteResult.count > 0) {
          // console.log(`  - Purged ${deleteResult.count} old results for website ${website.id}.`);
          totalPurgedCount += deleteResult.count;
        }
        websitesProcessed++;
      } catch (innerError) {
          console.error(`  - Error purging results for website ${website.id}:`, innerError);
          // Continue to the next website even if one fails
      }
    }

    const duration = Date.now() - startTime;
    if (totalPurgedCount > 0) {
      console.log(`Purged a total of ${totalPurgedCount} old monitoring results across ${websitesProcessed} websites in ${duration}ms.`);
    } else {
      console.log(`No old monitoring results found to purge across ${websitesProcessed} websites in ${duration}ms.`);
    }
  } catch (error) {
    console.error('Failed during the overall process of purging old monitoring results:', error);
  }
}


/**
 * Deletes AlertUser links for alerts that were resolved more than N days ago.
 * Keeps user alert lists clean without deleting historical Alert data prematurely.
 */
export async function cleanupOldResolvedAlertLinks(daysOld: number = ALERT_LINK_CLEANUP_THRESHOLD_DAYS): Promise<void> {
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] Starting cleanup of AlertUser links for alerts resolved over ${daysOld} days ago...`);
    if (daysOld <= 0) {
        console.warn("Alert link cleanup threshold (daysOld) must be positive. Skipping cleanup.");
        return;
    }

    try {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - daysOld);
        // Set time to beginning of the day for consistent comparison
        thresholdDate.setHours(0, 0, 0, 0);

        console.log(`  - Cleanup threshold date: ${thresholdDate.toISOString()}`);

        // Define the criteria for AlertUser records to delete
        const whereClause: Prisma.AlertUserWhereInput = {
            alert: { // Target based on the properties of the related Alert
                isResolved: true,          // The alert must be resolved
                resolvedAt: {
                    lt: thresholdDate       // And resolved *before* the threshold date (older than N days)
                }
            }
        };

        // Perform the bulk deletion
        const deleteResult = await prisma.alertUser.deleteMany({
            where: whereClause
        });

        const duration = Date.now() - startTime;
        if (deleteResult.count > 0) {
            console.log(`Cleaned up ${deleteResult.count} old resolved AlertUser links in ${duration}ms.`);
        } else {
            console.log(`No old resolved AlertUser links found meeting the criteria (resolved before ${thresholdDate.toISOString()}) in ${duration}ms.`);
        }
    } catch (error) {
        console.error('Failed to cleanup old resolved alert links:', error);
    }
}


// --- Scheduler Setup ---

/**
 * Initializes and starts all scheduled cron jobs.
 */
export function scheduleMonitoring(): void {
  console.log("Initializing schedulers...");

  // 1. Website Monitoring Check (Runs frequently)
  // Example: Check every 30 seconds if any websites are due
  const monitorCron = '*/30 * * * * *';
  if (cron.validate(monitorCron)) {
      cron.schedule(monitorCron, checkDueWebsites);
      console.log(`Website monitoring scheduler started: checks running every 30 seconds ('${monitorCron}').`);
  } else {
      console.error(`Invalid cron pattern for monitoring: ${monitorCron}`);
  }

  // 2. Unused Website Cleanup (Runs less frequently)
  // Example: Run hourly at the start of the hour
  const cleanupCron = '0 * * * *';
   if (cron.validate(cleanupCron)) {
      cron.schedule(cleanupCron, cleanupUnusedWebsites);
      console.log(`Unused website cleanup scheduler started: runs hourly ('${cleanupCron}').`);
   } else {
       console.error(`Invalid cron pattern for cleanup: ${cleanupCron}`);
   }

  // 3. Old Monitoring Results Purge (Runs typically daily)
  // Example: Run daily at 2:00 AM server time
  const purgeCron = '0 2 * * *';
   if (cron.validate(purgeCron)) {
       // Pass the configured number of results to keep
      cron.schedule(purgeCron, () => purgeOldMonitoringResults(RESULTS_TO_KEEP_PER_WEBSITE));
      console.log(`Database monitoring results purge scheduler started: runs daily at 2 AM ('${purgeCron}'), keeping ${RESULTS_TO_KEEP_PER_WEBSITE} results.`);
   } else {
       console.error(`Invalid cron pattern for purge: ${purgeCron}`);
   }

  // 4. Old Resolved AlertUser Link Cleanup (Runs typically daily)
  // Example: Run daily at 3:00 AM server time
  const alertLinkCleanupCron = '0 3 * * *';
   if (cron.validate(alertLinkCleanupCron)) {
       // Pass the configured age threshold
      cron.schedule(alertLinkCleanupCron, () => cleanupOldResolvedAlertLinks(ALERT_LINK_CLEANUP_THRESHOLD_DAYS));
      console.log(`Resolved AlertUser link cleanup scheduler started: runs daily at 3 AM ('${alertLinkCleanupCron}'), cleaning links older than ${ALERT_LINK_CLEANUP_THRESHOLD_DAYS} days.`);
   } else {
       console.error(`Invalid cron pattern for alert link cleanup: ${alertLinkCleanupCron}`);
   }

   console.log("All schedulers initialized.");
}

// --- Manual Execution Exports (Optional, for testing/debugging) ---
export const runMonitoring = checkDueWebsites;
export const runCleanup = cleanupUnusedWebsites;
export const runPurge = () => purgeOldMonitoringResults(RESULTS_TO_KEEP_PER_WEBSITE); // Use configured value
export const runAlertLinkCleanup = () => cleanupOldResolvedAlertLinks(ALERT_LINK_CLEANUP_THRESHOLD_DAYS); // Use configured value