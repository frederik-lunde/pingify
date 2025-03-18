import cron from 'node-cron';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';
import pLimit from 'p-limit';

// Environment variables with defaults
const CONCURRENCY_LIMIT = parseInt(process.env.MONITOR_CONCURRENCY || '5', 10);
const TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT || '10000', 10);
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '*/5 * * * *'; // Every 5 minutes by default

const prisma = new PrismaClient();
const limit = pLimit(CONCURRENCY_LIMIT);

// Error handling and logging utility
const logger = {
  info: (message: string, meta?: object) => {
    console.log(`[INFO] ${message}`, meta || '');
  },
  error: (message: string, error: any, meta?: object) => {
    console.error(`[ERROR] ${message}`, error, meta || '');
  }
};

/**
 * Monitors a single website and records the result
 */
async function monitorWebsite(website: any) {
  logger.info(`Checking website: ${website.url}`);
  const start = performance.now();
  let responseTime: number | null = null;
  let isAvailable = false;
  let statusCode: number | null = null;
  let errorMessage: string | null = null;

  try {
    const response = await axios.get(website.url, {
      timeout: TIMEOUT_MS,
      headers: {
        'User-Agent': 'Website-Monitor/1.0'
      },
      validateStatus: () => true, // Don't throw on any status code
    });
    
    responseTime = Math.round(performance.now() - start);
    statusCode = response.status;
    isAvailable = statusCode >= 200 && statusCode < 400;
  } catch (error: any) {
    responseTime = Math.round(performance.now() - start);
    isAvailable = false;
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      statusCode = error.response.status;
    } else if (error.request) {
      // The request was made but no response was received
      statusCode = null;
      errorMessage = 'No response received';
    } else {
      // Something happened in setting up the request
      statusCode = null;
      errorMessage = error.message;
    }
    
    logger.error(`Failed to monitor website: ${website.url}`, error, { 
      websiteId: website.id, 
      statusCode 
    });
  }

  try {
    // Create a new MonitoringResult record for this website check
    await prisma.monitoringResult.create({
      data: {
        websiteId: website.id,
        responseTime,
        isAvailable,
        statusCode,
        errorMessage,
        checkedAt: new Date()
      },
    });
    
    // Check if we need to send an alert
    if (website.alertEnabled) {
      await checkAndSendAlerts(website, isAvailable, responseTime, statusCode);
    }
  } catch (dbError) {
    logger.error(`Failed to save monitoring result for ${website.url}`, dbError, { 
      websiteId: website.id 
    });
  }
}

/**
 * Checks alert conditions and sends alerts if needed
 */
async function checkAndSendAlerts(
  website: any, 
  isAvailable: boolean, 
  responseTime: number | null,
  statusCode: number | null
) {
  // Alert on downtime
  if (!isAvailable && website.alertOnDown) {
    await sendAlert(website, 'down', { statusCode });
    return;
  }
  
  // Alert on slow response
  if (
    website.alertOnSlow && 
    responseTime !== null && 
    responseTime > website.responseThreshold
  ) {
    await sendAlert(website, 'slow', { responseTime });
  }
}

/**
 * Sends an alert through configured channels
 */
async function sendAlert(website: any, alertType: string, data: any) {
  try {
    logger.info(`Sending ${alertType} alert for ${website.url}`, data);
    
    // Create an alert record in the database
    await prisma.alert.create({
      data: {
        websiteId: website.id,
        type: alertType,
        message: `Website ${alertType}: ${website.url}`,
        data: JSON.stringify(data),
      }
    });
    
    // Here you would add code to actually send the alert through various channels
    // e.g., email, SMS, webhook, etc.
  } catch (error) {
    logger.error(`Failed to send alert for ${website.url}`, error);
  }
}

/**
 * Main job function to monitor all websites
 */
async function monitorAllWebsites() {
  logger.info('Starting website monitoring job');
  let websiteCount = 0;
  
  try {
    // Retrieve only active websites with alert settings
    const websites = await prisma.website.findMany({
      where: { isActive: true },
      include: {
        alertSettings: true
      }
    });
    
    websiteCount = websites.length;
    logger.info(`Found ${websiteCount} active websites to monitor`);
    
    // Run monitoring for all websites concurrently, but with limits
    await Promise.all(
      websites.map(website => limit(() => monitorWebsite(website)))
    );
    
    logger.info(`Completed monitoring ${websiteCount} websites`);
  } catch (error) {
    logger.error('Failed to run website monitoring job', error);
  }
}

// Configure and start the cron job
const job = cron.schedule(CRON_SCHEDULE, monitorAllWebsites, {
  scheduled: false
});

// Export for testing or manual triggering
export const startMonitoring = () => {
  logger.info(`Starting website monitoring with schedule: ${CRON_SCHEDULE}`);
  job.start();
};

export const stopMonitoring = () => {
  logger.info('Stopping website monitoring');
  job.stop();
};

// Start the monitoring when this module is imported
startMonitoring();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  stopMonitoring();
  await prisma.$disconnect();
  process.exit(0);
});