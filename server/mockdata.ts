// seed.ts - Script to generate mock data for chart testing
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed script...');

  // Create test user if not exists
  const testUserEmail = 'test@example.com';
  const testUser = await prisma.user.upsert({
    where: { email: testUserEmail },
    update: {},
    create: {
      email: testUserEmail,
      password: await bcrypt.hash('password123', 10),
      name: 'Test User',
    },
  });

  console.log(`Created/Found test user with ID: ${testUser.id}`);

  // Create various test websites
  const websites = [
    {
      name: "Perfect Uptime Site",
      url: "https://perfect-uptime-test.com",
      pattern: "perfect", // Always up
      interval: 300, // 5 minutes
      alertEnabled: true,
      alertThreshold: 1000, // 1 second
    },
    {
      name: "Occasional Downtime Site",
      url: "https://occasional-downtime-test.com",
      pattern: "occasional", // Down ~5% of the time
      interval: 180, // 3 minutes
      alertEnabled: true,
      alertThreshold: 500, // 500ms
    },
    {
      name: "Daily Pattern Downtime",
      url: "https://daily-pattern-test.com",
      pattern: "daily", // Down at specific times of day
      interval: 240, // 4 minutes
      alertEnabled: true,
      alertThreshold: 800, // 800ms
    },
    {
      name: "Weekly Pattern Downtime",
      url: "https://weekly-pattern-test.com",
      pattern: "weekly", // Down on specific days
      interval: 360, // 6 minutes
      alertEnabled: true,
      alertThreshold: 1200, // 1.2 seconds
    },
    {
      name: "Slow Response Site",
      url: "https://slow-response-test.com",
      pattern: "slow", // Always up but slow response times
      interval: 240, // 4 minutes
      alertEnabled: true,
      alertThreshold: 1500, // 1.5 seconds
    },
    {
      name: "Recent Improvement Site",
      url: "https://recent-improvement-test.com",
      pattern: "improving", // Started bad, got better
      interval: 300, // 5 minutes
      alertEnabled: true,
      alertThreshold: 700, // 700ms
    },
    {
      name: "Recent Degradation Site",
      url: "https://recent-degradation-test.com",
      pattern: "degrading", // Started good, got worse
      interval: 300, // 5 minutes
      alertEnabled: true,
      alertThreshold: 700, // 700ms
    },
  ];

  // Current time
  const now = new Date();
  
  // Generate data for the past 30 days
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 30);

  // Process each website
  for (const site of websites) {
    // Create or update the website
    const website = await prisma.website.upsert({
      where: { url: site.url },
      update: {
        isActive: true,
        globalInterval: site.interval,
        lastChecked: now,
      },
      create: {
        url: site.url,
        isActive: true,
        globalInterval: site.interval,
        lastChecked: now,
      },
    });

    console.log(`Created/Updated website: ${website.url} (ID: ${website.id})`);

    // Create or update user association
    const websiteUser = await prisma.websiteUser.upsert({
      where: {
        userId_websiteId: {
          userId: testUser.id,
          websiteId: website.id,
        },
      },
      update: {
        name: site.name,
        interval: site.interval,
        alertEnabled: site.alertEnabled,
        alertThreshold: site.alertThreshold,
        notifyEmail: testUserEmail,
      },
      create: {
        userId: testUser.id,
        websiteId: website.id,
        name: site.name,
        interval: site.interval,
        alertEnabled: site.alertEnabled,
        alertThreshold: site.alertThreshold,
        notifyEmail: testUserEmail,
      },
    });

    console.log(`Associated website with user: ${site.name}`);

    // Delete existing monitoring results for clean slate
    await prisma.monitoringResult.deleteMany({
      where: { websiteId: website.id },
    });

    // Delete existing alerts for clean slate
    await prisma.alert.deleteMany({
      where: { websiteId: website.id },
    });
    
    // Generate mock monitoring results based on pattern
    const results = generateMonitoringResults(website.id, site.pattern, startDate, now);
    
    // Insert results in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      await prisma.monitoringResult.createMany({
        data: batch,
      });
    }

    console.log(`Created ${results.length} monitoring results for ${site.name}`);

    // Generate some alerts based on monitoring results
    const alerts = generateAlerts(website.id, results, site.alertThreshold);
    if (alerts.length > 0) {
      for (const alert of alerts) {
        // Create the alert
        const newAlert = await prisma.alert.create({
          data: {
            websiteId: website.id,
            message: alert.message,
            type: alert.type,
            isResolved: alert.isResolved,
            resolvedAt: alert.resolvedAt,
            createdAt: alert.createdAt,
          },
        });

        // Create the alert-user association
        await prisma.alertUser.create({
          data: {
            userId: testUser.id,
            alertId: newAlert.id,
            isRead: Math.random() > 0.3, // 70% chance of being read
          },
        });
      }
    }

    console.log(`Created ${alerts.length} alerts for ${site.name}`);
  }

  console.log('Seed script completed successfully!');
}

// Generate monitoring results based on pattern
function generateMonitoringResults(websiteId: number, pattern: string, startDate: Date, endDate: Date) {
  const results: any[] = [];
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;

  // Loop through each hour in the date range
  for (let timestamp = startDate.getTime(); timestamp <= endDate.getTime(); timestamp += hourMs) {
    const checkDate = new Date(timestamp);
    const hour = checkDate.getHours();
    const dayOfWeek = checkDate.getDay(); // 0 = Sunday, 6 = Saturday
    
    let isAvailable = true;
    let responseTime: number | null = null;
    let statusCode: number | null = null;
    let errorMessage: string | null = null;

    switch (pattern) {
      case "perfect":
        // Always available with good response time (50-300ms)
        isAvailable = true;
        responseTime = 50 + Math.floor(Math.random() * 250);
        statusCode = 200;
        break;

      case "occasional":
        // ~5% chance of being down
        isAvailable = Math.random() > 0.05;
        if (isAvailable) {
          responseTime = 100 + Math.floor(Math.random() * 400);
          statusCode = 200;
        } else {
          responseTime = null;
          statusCode = [500, 502, 503, 504][Math.floor(Math.random() * 4)];
          errorMessage = `Server Error: ${statusCode}`;
        }
        break;

      case "daily":
        // Down during maintenance hours (1-3 AM)
        if (hour >= 1 && hour <= 3) {
          isAvailable = false;
          responseTime = null;
          statusCode = 503;
          errorMessage = "Scheduled Maintenance";
        } else {
          isAvailable = true;
          // Slower in peak hours (9-17)
          responseTime = (hour >= 9 && hour <= 17) 
            ? 200 + Math.floor(Math.random() * 600) 
            : 100 + Math.floor(Math.random() * 300);
          statusCode = 200;
        }
        break;

      case "weekly":
        // Down for maintenance on weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          isAvailable = Math.random() > 0.3; // 30% downtime on weekends
          if (!isAvailable) {
            responseTime = null;
            statusCode = 503;
            errorMessage = "Weekend Maintenance";
          } else {
            responseTime = 150 + Math.floor(Math.random() * 400);
            statusCode = 200;
          }
        } else {
          isAvailable = true;
          responseTime = 100 + Math.floor(Math.random() * 250);
          statusCode = 200;
        }
        break;

      case "slow":
        // Always available but with varying response times
        isAvailable = true;
        
        // Slow during business hours
        if (hour >= 9 && hour <= 17) {
          responseTime = 800 + Math.floor(Math.random() * 1000); // 800ms - 1800ms
        } else {
          responseTime = 300 + Math.floor(Math.random() * 500); // 300ms - 800ms
        }
        statusCode = 200;
        break;

      case "improving":
        // Calculate days since start
        const daysSinceStart = Math.floor((timestamp - startDate.getTime()) / dayMs);
        
        // Earlier days have worse performance/more downtime
        if (daysSinceStart < 10) {
          isAvailable = Math.random() > 0.15; // 15% downtime early on
          if (isAvailable) {
            // Start with slower response times that improve
            const improvementFactor = 1 - (daysSinceStart / 10);
            responseTime = 200 + Math.floor(Math.random() * 800 * improvementFactor);
            statusCode = 200;
          } else {
            responseTime = null;
            statusCode = [500, 502, 503, 504][Math.floor(Math.random() * 4)];
            errorMessage = "Server Overload";
          }
        } else {
          // Later days are better
          isAvailable = Math.random() > 0.01; // Only 1% downtime
          responseTime = 80 + Math.floor(Math.random() * 200);
          statusCode = isAvailable ? 200 : 500;
          if (!isAvailable) errorMessage = "Rare Server Error";
        }
        break;

      case "degrading":
        // Calculate days since start
        const daysFromStart = Math.floor((timestamp - startDate.getTime()) / dayMs);
        
        // Earlier days have better performance
        if (daysFromStart < 20) {
          isAvailable = Math.random() > 0.01; // Only 1% downtime initially
          responseTime = 80 + Math.floor(Math.random() * 150);
          statusCode = isAvailable ? 200 : 500;
          if (!isAvailable) errorMessage = "Rare Server Error";
        } else {
          // Performance degrades in last 10 days
          const degradationFactor = (daysFromStart - 20) / 10;
          isAvailable = Math.random() > (0.01 + degradationFactor * 0.2); // Increasing downtime
          if (isAvailable) {
            responseTime = 80 + Math.floor(Math.random() * (150 + 500 * degradationFactor));
            statusCode = 200;
          } else {
            responseTime = null;
            statusCode = [500, 502, 503, 504][Math.floor(Math.random() * 4)];
            errorMessage = "Increasing Server Issues";
          }
        }
        break;
    }

    // Add some random jitter to checkDate (±30 minutes) to make it look more realistic
    const jitter = Math.floor(Math.random() * 60 - 30) * 60 * 1000;
    const checkedAt = new Date(checkDate.getTime() + jitter);

    // Add the result
    results.push({
      websiteId,
      isAvailable,
      responseTime,
      statusCode,
      errorMessage,
      checkedAt,
    });
  }

  return results;
}

// Generate alerts based on monitoring results
function generateAlerts(websiteId: number, results: any[], alertThreshold: number) {
  const alerts: any[] = [];
  let consecutiveDowntime = 0;
  let lastDowntimeStart: Date | null = null;
  
  results.forEach((result, index) => {
    // Check for downtime alerts
    if (!result.isAvailable) {
      if (consecutiveDowntime === 0) {
        lastDowntimeStart = result.checkedAt;
      }
      consecutiveDowntime++;
      
      // Create alert for first downtime and for extended downtime
      if (consecutiveDowntime === 1 || consecutiveDowntime % 5 === 0) {
        const message = consecutiveDowntime === 1 
          ? `Website is down: ${result.errorMessage || 'Unknown error'}`
          : `Website has been down for ${consecutiveDowntime} consecutive checks`;
        
        alerts.push({
          websiteId,
          type: 'down',
          message,
          isResolved: index < results.length - 10, // Resolved if not recent
          resolvedAt: index < results.length - 10 ? findRecoveryTime(results, index) : null,
          createdAt: result.checkedAt,
        });
      }
    } else {
      // Reset consecutive downtime counter if site is back up
      if (consecutiveDowntime > 0) {
        // Create recovery alert if site was down for a while
        if (consecutiveDowntime >= 3) {
          alerts.push({
            websiteId,
            type: 'up',
            message: `Website is back online after ${consecutiveDowntime} consecutive checks`,
            isResolved: true,
            resolvedAt: result.checkedAt,
            createdAt: result.checkedAt,
          });
        }
        consecutiveDowntime = 0;
      }
      
      // Check for slow response time alerts
      if (result.responseTime && result.responseTime > alertThreshold) {
        alerts.push({
          websiteId,
          type: 'slow',
          message: `Slow response time detected: ${result.responseTime}ms (threshold: ${alertThreshold}ms)`,
          isResolved: true,
          resolvedAt: new Date(result.checkedAt.getTime() + 3600000), // Resolve after 1 hour
          createdAt: result.checkedAt,
        });
      }
    }
  });
  
  return alerts;
}

// Find the time when the site recovered after downtime
function findRecoveryTime(results: any[], downtimeIndex: number): Date | null {
  for (let i = downtimeIndex + 1; i < results.length; i++) {
    if (results[i].isAvailable) {
      return results[i].checkedAt;
    }
  }
  return null;
}

// Run the seed script
main()
  .catch((e) => {
    console.error('Error in seed script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });