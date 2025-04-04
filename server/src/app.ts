import express from 'express';
import morgan from 'morgan';
import cors from 'cors';

// Routes
import authRoutes from './routes/authRoutes';
import websiteRoutes from './routes/websiteRoutes';
import monitoringRoutes from './routes/monitoringRoutes';
import alertRoutes from './routes/alertRoutes';

// Middleware
import errorMiddleware from './middleware/errorMiddleware';
import { authenticate } from './middleware/authMiddleware';

// Utils
import { scheduleMonitoring } from './utils/scheduler';

// Initialize app and database connection
const app = express();

// Global middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Public routes
app.use('/api/auth', authRoutes);


// Protected routes for user-specific data
app.use('/api/websites',authenticate, websiteRoutes);
app.use('/api/monitoring',authenticate, monitoringRoutes);
app.use('/api/alerts',authenticate, alertRoutes);

// Start monitoring scheduler (runs for all websites regardless of user access)
scheduleMonitoring();

// Global error handler (should be the last middleware)
app.use(errorMiddleware);


export default app;