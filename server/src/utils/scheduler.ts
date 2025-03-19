import cron from 'node-cron';
import { PrismaClient, Website } from '@prisma/client';
import { CONCURRENCY, DEFAULT_INTERVAL } from '../config/config';
import { checkWebsite } from '../services/monitoring-service';

const prisma = new PrismaClient();

/**
 * Determines if a website is due for checking based on its interval
 */
function isWebsiteDueForCheck(website: Website): boolean {
  // If website has never been checked, it's due
  if (!website.lastChecked) return true;
  
  // Calculate if the website's interval has passed
  const intervalInSeconds = website.interval || DEFAULT_INTERVAL;
  const millisecondsSinceLastCheck = Date.now() - new Date(website.lastChecked).getTime();
  return millisecondsSinceLastCheck >= (intervalInSeconds * 1000);
}

/**
 * Retrieves all active websites from the database
 */
async function getActiveWebsites(): Promise<Website[]> {
  return prisma.website.findMany({
    where: { 
      isActive: true,
      OR: [
        // Include websites that have never been checked
        { lastChecked: null },
        // Include websites whose interval has passed since last check
        {
          lastChecked: {
            lt: new Date(Date.now() - 1000) // Ensure at least 1 second has passed
          }
        }
      ]
    },
  });
}

/**
 * Processes websites in batches to limit concurrency
 */
async function processBatches(websites: Website[]): Promise<void> {
  for (let i = 0; i < websites.length; i += CONCURRENCY) {
    const batch = websites.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(website => checkWebsite(website)));
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
 * Schedule a frequent check to evaluate which websites need monitoring
 */
export function scheduleMonitoring(): void {
  // Run every 10 seconds to check which websites are due
  cron.schedule('*/10 * * * * *', checkDueWebsites);
  console.log('Website monitoring scheduler started - checking every 10 seconds for due websites');
}

// For manual testing
export const runMonitoring = checkDueWebsites;