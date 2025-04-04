import cron from 'node-cron';
import { PrismaClient, Website } from '@prisma/client';
import { CONCURRENCY, DEFAULT_INTERVAL } from '../config/config';
import { WebsiteMonitor } from '../services/monitoringService';
import prisma from '../prisma/prismaClient'; // Adjust the path if needed



/**
 * Determines if a website is due for checking based on its global interval
 */
function isWebsiteDueForCheck(website: Website): boolean {
  // If website has never been checked, it's due
  if (!website.lastChecked) return true;
  
  // Calculate if the website's interval has passed
  const intervalInSeconds = website.globalInterval || DEFAULT_INTERVAL;
  const millisecondsSinceLastCheck = Date.now() - new Date(website.lastChecked).getTime();
  return millisecondsSinceLastCheck >= (intervalInSeconds * 1000);
}

/**
 * Retrieves all active websites from the database
 */
async function getActiveWebsites(): Promise<Website[]> {
  // Simply get all websites marked as active.
  // The isWebsiteDueForCheck function will handle the time logic.
  return prisma.website.findMany({
    where: {
      isActive: true,
    },
  });
}

/**
 * Processes websites in batches to limit concurrency
 */
async function processBatches(websites: Website[]): Promise<void> {
  for (let i = 0; i < websites.length; i += CONCURRENCY) {
    const batch = websites.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(website => WebsiteMonitor.checkWebsite(website)));
  }
}

/**
 * Checks which websites are due for monitoring based on their intervals
 */
export async function checkDueWebsites(): Promise<void> {
  console.log('Checking for websites due for monitoring...');
  
  try {
    // Retrieve active websites
    const activeWebsites = await getActiveWebsites();
    
    // Filter for websites that are due for checking
    const dueWebsites = activeWebsites.filter(isWebsiteDueForCheck);
    
    if (dueWebsites.length === 0) {
      console.log('No websites due for checking');
      return;
    }
    
    console.log(`Found ${dueWebsites.length} websites due for monitoring`);
    
    // Process websites in batches
    await processBatches(dueWebsites);
    
    console.log(`Completed checking ${dueWebsites.length} websites`);
  } catch (error) {
    console.error('Failed to check due websites:', error);
  }
}

/**
 * Checks for websites without any users and deactivates them
 */
export async function cleanupUnusedWebsites(): Promise<void> {
  console.log('Checking for websites without any users...');
  try {
    const whereClause = {
      isActive: true,
      websiteUsers: {
        none: {},
      },
    };

    // First, optionally find them if you need to log URLs (or count first)
    const unusedWebsites = await prisma.website.findMany({
      where: whereClause,
      select: { id: true, url: true } // Select only needed fields
    });

    if (unusedWebsites.length === 0) {
      console.log('No unused websites found');
      return;
    }

    console.log(`Found ${unusedWebsites.length} websites without users. Deactivating...`);
    // Log URLs before deactivation if needed
    unusedWebsites.forEach(w => console.log(`Found unused: ID: ${w.id}, URL: ${w.url}`));


    // Deactivate all found websites in one go
    const updateResult = await prisma.website.updateMany({
      where: whereClause, // Use the same criteria to ensure atomicity
      data: { isActive: false },
    });

    console.log(`Deactivated ${updateResult.count} unused websites.`); // updateMany returns a count
    console.log('Unused website cleanup complete');
  } catch (error) {
    console.error('Failed to cleanup unused websites:', error);
  }
}

/**
 * Purges old monitoring results to prevent database bloat
 * Keeps the most recent X results per website
 */
export async function purgeOldMonitoringResults(resultsToKeep = 1000): Promise<void> {
  console.log('Purging old monitoring results...');
  
  try {
    // Get all websites
    const websites = await prisma.website.findMany({
      select: { id: true }
    });
    
    let totalPurged = 0;
    
    // For each website, identify and delete old results
    for (const website of websites) {
      // Get the IDs of results to keep (most recent ones)
      const recentResults = await prisma.monitoringResult.findMany({
        where: { websiteId: website.id },
        orderBy: { checkedAt: 'desc' },
        take: resultsToKeep,
        select: { id: true }
      });
      
      const recentResultIds = recentResults.map(r => r.id);
      
      // Delete older results
      const deleteResult = await prisma.monitoringResult.deleteMany({
        where: {
          websiteId: website.id,
          id: { notIn: recentResultIds }
        }
      });
      
      totalPurged += deleteResult.count;
    }
    
    if (totalPurged > 0) {
      console.log(`Purged ${totalPurged} old monitoring results`);
    } else {
      console.log('No old monitoring results to purge');
    }
  } catch (error) {
    console.error('Failed to purge old monitoring results:', error);
  }
}

/**
 * Schedule all maintenance tasks
 */
export function scheduleMonitoring(): void {
  // Run monitoring check every 10 seconds
  cron.schedule('*/30 * * * * *', checkDueWebsites);
  console.log('Website monitoring scheduler started - checking every 10 seconds for due websites');
  
  // Run website cleanup hourly
  cron.schedule('0 * * * *', cleanupUnusedWebsites);
  console.log('Unused website cleanup scheduler started - running hourly');
  
  // Run database maintenance daily (at 2 AM)
  cron.schedule('0 2 * * *', () => purgeOldMonitoringResults());
  console.log('Database maintenance scheduler started - running daily at 2 AM');
}

// For manual testing
export const runMonitoring = checkDueWebsites;
export const runCleanup = cleanupUnusedWebsites;
export const runPurge = purgeOldMonitoringResults;