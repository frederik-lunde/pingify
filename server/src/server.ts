// server.ts (or index.ts, main.ts, etc.)
import dotenv from 'dotenv';
dotenv.config();

import app from './app';
// Import config AFTER dotenv.config() so process.env is populated
import { config } from './config/config';
import prisma from './prisma/prismaClient'; // Adjust path if needed

// Use config.port which is already parsed and has a default
const PORT = config.port;

async function startServer() {
  // The config file will have already thrown an error if JWT_SECRET etc. were missing
  console.log(`Starting server in ${config.nodeEnv} mode...`); // Use config value

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
    // This catch block now primarily handles database connection errors
    console.error('Failed to start server:', error);
    process.exit(1); // Exit if database connection fails
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