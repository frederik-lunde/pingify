import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create a user with two websites
  const john = await prisma.user.create({
    data: {
      email: 'john@example.com',
      password: 'password123', // In production, ensure passwords are hashed
      name: 'John Doe',
      websites: {
        create: [
          {
            name: 'Google',
            url: 'https://www.google.com',
            // Using default values: interval (300), isActive (true),
            // alertThreshold (2000), alertEnabled (true)
          },
          {
            name: 'Example',
            url: 'https://www.asdklk.com',
            interval: 600, // Custom interval (10 minutes)
            isActive: true,
            alertThreshold: 1500, // Custom threshold
            alertEnabled: false,  // Alert disabled for this website
          },
        ],
      },
    },
  });

  // Create another user with one website
  const jane = await prisma.user.create({
    data: {
      email: 'jane@example.com',
      password: 'password456',
      name: 'Jane Smith',
      websites: {
        create: [
          {
            name: 'GitHub',
            url: 'https://www.github.com',
            // All other fields will use the default values
          },
        ],
      },
    },
  });

  console.log({ john, jane });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
