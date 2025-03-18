// alert-service.ts - Alert handling logic
import { PrismaClient } from '@prisma/client';
import { emailTransporter, EMAIL_FROM } from '../config/config';
import { getLatestResultId } from './monitoring-service';

const prisma = new PrismaClient();

/**
 * Processes alerts for a website based on its monitoring result
 */
export async function processAlerts(
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
export async function sendEmailAlert(to: string, subject: string, body: string) {
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