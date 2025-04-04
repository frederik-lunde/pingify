// server.ts (or index.ts, main.ts, etc.)

import app from './app';
import { config } from './config/config';
import prisma from './prisma/prismaClient'; // Adjust path if needed

const PORT = config.port || 5000;

async function startServer() {
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Database connected successfully!');

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

   
    process.on('SIGINT', gracefulShutdown); // Handle Ctrl+C
    process.on('SIGTERM', gracefulShutdown); // Handle kill commands

  } catch (error) {
    console.error('Failed to connect to the database:', error);
    // Exit the process if the database connection fails on startup
    process.exit(1);
  }
}

// --- Graceful Shutdown ---
async function gracefulShutdown() {
  console.log('Received shutdown signal. Closing database connection...');
  try {
    await prisma.$disconnect();
    console.log('Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Error during database disconnection:', error);
    process.exit(1);
  }
}

startServer();