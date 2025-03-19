import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

// Routes
import userRoutes from './routes/userRoutes';
import websiteRoutes from './routes/websiteRoutes';
import monitoringRoutes from './routes/monitoringRoutes';

// Middleware
import errorMiddleware from './middleware/errorMiddleware';

// Utils
import { scheduleMonitoring } from './utils/scheduler';

// Initialize app and database connection
const app = express();
const prisma = new PrismaClient();

// Global middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// API routes
app.use('/api/users', userRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api/monitoring', monitoringRoutes);

// Start monitoring scheduler
scheduleMonitoring();

// Global error handler (should be the last middleware)
app.use(errorMiddleware);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down website monitoring');
  await prisma.$disconnect();
  process.exit(0);
});

export default app;