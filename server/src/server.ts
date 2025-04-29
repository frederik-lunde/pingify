import app from './app';
import { appConfig } from './config/config'; 
import prisma from './prisma/prismaClient'; 

const PORT = appConfig.port;

async function startServer() {
  console.log(`Starting server in ${appConfig.nodeEnv} mode...`);
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Database connected successfully!');

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    process.on('SIGINT', gracefulShutdown); 
    process.on('SIGTERM', gracefulShutdown); 

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1); 
  }
}

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