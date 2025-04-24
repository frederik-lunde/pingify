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

// Initialize app and database connection
const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 500 requests per windowMs
    message: 'Too many requests, please try again later.'
});
// Global middlewares
app.use(cors());
app.use(helmet()); // Security headers
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(limiter); // Rate limiting
app.use(express.json());
app.use(morgan('tiny'));
app.use(compression());

// Public routes
app.use('/api/auth', authRoutes);


// Protected routes for user-specific data
app.use('/api/users', authenticate, userRoutes);
app.use('/api/websites',authenticate, websiteRoutes);
app.use('/api/monitoring',authenticate, monitoringRoutes);
app.use('/api/incidents',authenticate, incidentRoutes);
app.use('/api/alerts',authenticate, alertRoutes);


// Start monitoring scheduler (runs for all websites regardless of user access)
scheduleMonitoring();

// Global error handler (should be the last middleware)
app.use(errorMiddleware);


export default app;