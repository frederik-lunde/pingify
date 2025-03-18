// scheduler.ts - Scheduling logic
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { CONCURRENCY, DEFAULT_INTERVAL } from '../config/config';
import { checkWebsite } from '../services/monitoring-service';

const prisma = new PrismaClient();

/**
 * Checks which websites are due for monitoring based on their intervals
 */
export async function checkDueWebsites() {
  console.log('Checking for websites due for monitoring...');
  
  try {
    // Retrieve active websites that are due for checking
    const websites = await prisma.website.findMany({
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

    const dueWebsites = websites.filter(website => {
      // If website has never been checked, it's due
      if (!website.lastChecked) return true;
      
      // Calculate if the website's interval has passed
      const intervalInSeconds = website.interval || DEFAULT_INTERVAL;
      const millisecondsSinceLastCheck = Date.now() - new Date(website.lastChecked).getTime();
      return millisecondsSinceLastCheck >= (intervalInSeconds * 1000);
    });
    
    if (dueWebsites.length === 0) {
      console.log('No websites due for checking');
      return;
    }
    
    console.log(`Found ${dueWebsites.length} websites due for monitoring`);
    
    // Check each website with limited concurrency
    for (let i = 0; i < dueWebsites.length; i += CONCURRENCY) {
      const batch = dueWebsites.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(website => checkWebsite(website)));
    }
    
    console.log(`Completed checking ${dueWebsites.length} websites`);
  } catch (error) {
    console.error('Failed to check due websites:', error);
  }
}

// Schedule a frequent check to evaluate which websites need monitoring
export function scheduleMonitoring() {
  // Run every 10 seconds to check which websites are due
  cron.schedule('*/10 * * * * *', checkDueWebsites);
  console.log('Website monitoring scheduler started - checking every 10 seconds for due websites');
}

// For manual testing and exports
export const runMonitoring = checkDueWebsites;