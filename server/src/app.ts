import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import userRoutes from './routes/userRoutes';
import websiteRoutes from './routes/websiteRoutes';
import testRoutes from './routes/testRoutes';
import errorMiddleware from './middleware/errorMiddleware';
import { scheduleMonitoring } from './utils/scheduler';
import { PrismaClient } from '@prisma/client';

const app = express();

const prisma = new PrismaClient();


// Global middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Your API routes
app.use('/api/users', userRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api', testRoutes);

//Start monitoring (will fill db)
scheduleMonitoring();


// Global error handler (should be the last middleware)
app.use(errorMiddleware);

process.on('SIGTERM', async () => {
    console.log('Shutting down website monitoring');
    await prisma.$disconnect();
    process.exit(0);
  });

export default app;

