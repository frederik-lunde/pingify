import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit'
import compression from 'compression';

// Routes
import authRoutes from './routes/authRoutes';
import userRoutes  from './routes/userRoutes';
import websiteRoutes from './routes/websiteRoutes';
import monitoringRoutes from './routes/monitoringRoutes';
import alertRoutes from './routes/alertRoutes';
import incidentRoutes from './routes/incidentRoutes';

// Middleware
import errorMiddleware from './middleware/errorMiddleware';
import { authenticate } from './middleware/authMiddleware';

// Utils
import { scheduleMonitoring } from './utils/scheduler';

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
    max: 1000, 
    message: 'Too many requests, please try again later.'
});

//global middleware
app.use(cors());
app.use(helmet()); 
app.use(express.urlencoded({ extended: true }));
app.use(limiter);
app.use(express.json());
app.use(morgan('tiny'));
app.use(compression());

// Public routes
app.use('/api/auth', authRoutes);


// Protected routes
app.use('/api/users', authenticate, userRoutes);
app.use('/api/websites',authenticate, websiteRoutes);
app.use('/api/monitoring',authenticate, monitoringRoutes);
app.use('/api/incidents',authenticate, incidentRoutes);
app.use('/api/alerts',authenticate, alertRoutes);


scheduleMonitoring();

// Global error handler (should be the last middleware)
app.use(errorMiddleware);


export default app;