// server/src/jobs/monitorWebsites.ts
import cron from 'node-cron';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Run the monitor job every minute
cron.schedule('* * * * *', async () => {
  console.log('Running website monitor job...');

  // Retrieve only active websites
  const websites = await prisma.website.findMany({
    where: { isActive: true },
  });

  for (const website of websites) {
    const start = Date.now();
    let responseTime: number | null = null;
    let isAvailable = false;
    let statusCode: number | null = null;

    try {
      const response = await axios.get(website.url);
      responseTime = Date.now() - start;
      statusCode = response.status;
      isAvailable = true;
    } catch (error: any) {
      responseTime = Date.now() - start;
      statusCode = error.response?.status || 500;
      isAvailable = false;
    }

    // Create a new MonitoringResult record for this website check
    await prisma.monitoringResult.create({
      data: {
        websiteId: website.id,
        responseTime,
        isAvailable,
        statusCode,
      },
    });

    // Optionally, you could add logic here to trigger an alert
    // if (website.alertEnabled && responseTime && responseTime > website.alertThreshold) {
    //   // Trigger alert notification (e.g., email, SMS, etc.)
    // }
  }
});
