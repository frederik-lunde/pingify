import cron from 'node-cron';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

// Environment variables with defaults
const CONCURRENCY = parseInt(process.env.MONITOR_CONCURRENCY || '3', 10);
const TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT || '10000', 10);
const EMAIL_FROM = process.env.EMAIL_FROM || 'monitor@example.com';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.example.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

// Default interval (in seconds) if not specified in the database
const DEFAULT_INTERVAL = 60;

// Create email transporter if SMTP is configured
let emailTransporter: any = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  emailTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

/**
 * Checks a single website and records the result
 */
async function checkWebsite(website: any) {
  console.log(`Checking website: ${website.url}`);
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
      statusCode = error.response.status;
      errorMessage = `HTTP Error: ${statusCode}`;
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timed out';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'DNS lookup failed';
    } else {
      errorMessage = error.message || 'Unknown error';
    }
    
    console.error(`Failed to check website: ${website.url}`, error.message);
  }

  try {
    // Record the monitoring result
    await prisma.monitoringResult.create({
      data: {
        websiteId: website.id,
        responseTime,
        isAvailable,
        statusCode,
        errorMessage,
      },
    });
    
    // Update the lastChecked timestamp
    await prisma.website.update({
      where: { id: website.id },
      data: { lastChecked: new Date() }
    });
    
    // Check if we need to trigger alerts
    if (website.alertEnabled) {
      await processAlerts(website, isAvailable, responseTime, statusCode, errorMessage);
    }
  } catch (dbError: any) {
    console.error(`Failed to save monitoring result for ${website.url}`, dbError.message);
  }
}

/**
 * Processes alerts for a website based on its monitoring result
 */
async function processAlerts(
  website: any, 
  isAvailable: boolean, 
  responseTime: number | null, 
  statusCode: number | null,
  errorMessage: string | null
) {
  // Get the last recorded status to detect state changes
  const lastResult = await prisma.monitoringResult.findFirst({
    where: { 
      websiteId: website.id,
      id: { not: await getLatestResultId(website.id) }
    },
    orderBy: { checkedAt: 'desc' },
  });

  // Handle downtime alerts
  if (!isAvailable) {
    // Only alert if the site was previously up or if this is the first check
    if (!lastResult || lastResult.isAvailable) {
      await createAlert(
        website.id, 
        'down', 
        `Website is down: ${website.name}${statusCode ? ` (${statusCode})` : ''}${errorMessage ? ` - ${errorMessage}` : ''}`
      );
      
      // Send email notification if configured
      if (website.notifyEmail && emailTransporter) {
        await sendEmailAlert(
          website.notifyEmail,
          `🔴 DOWN: ${website.name}`,
          `Your website ${website.name} (${website.url}) appears to be down.\n\n` +
          `Status: ${statusCode || 'Unknown'}\n` +
          `Error: ${errorMessage || 'No specific error'}\n` +
          `Time: ${new Date().toISOString()}`
        );
      }
    }
  } 
  // Handle recovery alerts
  else if (lastResult && !lastResult.isAvailable) {
    await createAlert(
      website.id, 
      'recovered', 
      `Website has recovered: ${website.name}`
    );
    
    // Send email notification if configured
    if (website.notifyEmail && emailTransporter) {
      await sendEmailAlert(
        website.notifyEmail,
        `✅ RECOVERED: ${website.name}`,
        `Your website ${website.name} (${website.url}) is now back online.\n\n` +
        `Response time: ${responseTime}ms\n` +
        `Status: ${statusCode}\n` +
        `Time: ${new Date().toISOString()}`
      );
    }
  }
  
  // Handle slow response alerts
  if (isAvailable && responseTime && responseTime > website.alertThreshold) {
    await createAlert(
      website.id, 
      'slow',
      `Website is responding slowly: ${website.name} (${responseTime}ms)`
    );
    
    // Send email notification if configured
    if (website.notifyEmail && emailTransporter) {
      await sendEmailAlert(
        website.notifyEmail,
        `⚠️ SLOW: ${website.name}`,
        `Your website ${website.name} (${website.url}) is responding slowly.\n\n` +
        `Response time: ${responseTime}ms\n` +
        `Threshold: ${website.alertThreshold}ms\n` +
        `Time: ${new Date().toISOString()}`
      );
    }
  }
}

/**
 * Creates an alert record in the database
 */
async function createAlert(websiteId: number, type: string, message: string) {
  return prisma.alert.create({
    data: {
      websiteId,
      type,
      message,
    },
  });
}

/**
 * Sends an email alert
 */
async function sendEmailAlert(to: string, subject: string, body: string) {
  if (!emailTransporter) return;
  
  try {
    await emailTransporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      text: body,
    });
    console.log(`Email alert sent to ${to}`);
  } catch (error) {
    console.error('Failed to send email alert:', error);
  }
}

/**
 * Gets the latest monitoring result ID for a website
 */
async function getLatestResultId(websiteId: number): Promise<number> {
  const result = await prisma.monitoringResult.findFirst({
    where: { websiteId },
    orderBy: { checkedAt: 'desc' },
    select: { id: true },
  });
  return result?.id || 0;
}

/**
 * Checks which websites are due for monitoring based on their intervals
 */
async function checkDueWebsites() {
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
function scheduleMonitoring() {
  // Run every 10 seconds to check which websites are due
  cron.schedule('*/10 * * * * *', checkDueWebsites);
  console.log('Website monitoring scheduler started - checking every 10 seconds for due websites');
}

// For manual testing
export const runMonitoring = checkDueWebsites;

// Start the scheduler when this module is imported
scheduleMonitoring();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down website monitoring');
  await prisma.$disconnect();
  process.exit(0);
});