import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

// Routes
import authRoutes from './routes/authRoutes';
import websiteRoutes from './routes/websiteRoutes';
import monitoringRoutes from './routes/monitoringRoutes';

// Middleware
import errorMiddleware from './middleware/errorMiddleware';
import { authenticate } from './middleware/authMiddleware';

// Utils
import { scheduleMonitoring } from './utils/scheduler';

// Initialize app and database connection
const app = express();
const prisma = new PrismaClient();

// Global middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes for user-specific data
app.use('/api/websites', websiteRoutes);
app.use('/api/monitoring', monitoringRoutes);

// Start monitoring scheduler (runs for all websites regardless of user access)
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