// monitoring-service.ts - Website monitoring logic
import axios from 'axios';
import { performance } from 'perf_hooks';
import { PrismaClient } from '@prisma/client';
import { TIMEOUT_MS } from '../config/config';
import { processAlerts } from './alert-service';

const prisma = new PrismaClient();

/**
 * Checks a single website and records the result
 */
export async function checkWebsite(website: any) {
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
 * Gets the latest monitoring result ID for a website
 */
export async function getLatestResultId(websiteId: number): Promise<number> {
  const result = await prisma.monitoringResult.findFirst({
    where: { websiteId },
    orderBy: { checkedAt: 'desc' },
    select: { id: true },
  });
  return result?.id || 0;
}