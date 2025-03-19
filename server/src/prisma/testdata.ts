import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create two websites
  const google = await prisma.website.create({
      data: {
          
            name: 'Google',
            url: 'https://www.google.com',
            interval: 300, // 5 minutes
            isActive: true,
            alertThreshold: 2000,
            alertEnabled: true,
            notifyEmail: 'alerts@example.com'
          },
    },
);
const sj = await prisma.website.create({
    data: {
        
          name: 'sj',
          url: 'https://www.sj.no',
          interval: 300, // 5 minutes
          isActive: true,
          alertThreshold: 2000,
          alertEnabled: true,
          notifyEmail: 'alerts@example.com'
        },
  },
);  

  // Create sample monitoring results
  await createSampleData();

  console.log('Seed data created successfully!');
}

async function createSampleData() {
  // Get all websites
  const websites = await prisma.website.findMany();
  
  for (const website of websites) {
    // Create 24 hours of sample data (one per hour)
    const now = new Date();
    
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000)); // i hours ago
      
      // For the nonexistent site, make it down occasionally
      const isDown = website.url.includes('nonexistent') ? 
        true : // Always down for nonexistent site
        (Math.random() < 0.05); // 5% chance of downtime for real sites
      
      await prisma.monitoringResult.create({
        data: {
          websiteId: website.id,
          checkedAt: timestamp,
          responseTime: isDown ? null : Math.floor(Math.random() * 2000) + 100, // 100-2100ms
          isAvailable: !isDown,
          statusCode: isDown ? (Math.random() < 0.5 ? 404 : 500) : 200,
          errorMessage: isDown ? 'Connection failed' : null
        }
      });
    }
    
    // Create sample alerts
    if (website.url.includes('nonexistent')) {
      await prisma.alert.create({
        data: {
          websiteId: website.id,
          createdAt: new Date(now.getTime() - (2 * 60 * 60 * 1000)), // 2 hours ago
          message: `Website is down: ${website.name}`,
          type: 'down',
          isRead: false
        }
      });
    }
    
    if (website.url.includes('github')) {
      await prisma.alert.create({
        data: {
          websiteId: website.id,
          createdAt: new Date(now.getTime() - (12 * 60 * 60 * 1000)), // 12 hours ago
          message: `Website is responding slowly: ${website.name} (1892ms)`,
          type: 'slow',
          isRead: true
        }
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });