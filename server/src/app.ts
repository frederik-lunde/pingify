import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import compression from 'compression';

// Routes
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
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

// --- Configuration ---

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// CORS Configuration
const corsOptions = {
  // Allow requests specifically from your frontend domain
  origin: 'https://pingify-frontend.onrender.com',
  // Specify allowed HTTP methods
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  // Specify allowed headers, especially for auth and content type
  allowedHeaders: ['Content-Type', 'Authorization'],
  // Allow cookies or authorization headers to be sent
  credentials: true,
  // Set HTTP status code for successful OPTIONS requests (some legacy browsers choke on 204)
  optionsSuccessStatus: 200 // or 204
};



app.use(helmet());

app.use(cors(corsOptions));

// 3. Request Logging
app.use(morgan('tiny')); // Or 'dev' for more details during development

// 4. Body Parsers
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// 5. Response Compression
app.use(compression());

// 6. Rate Limiting (Apply after parsing and logging, before routes)
app.use(limiter);

// Public API routes
app.use('/api/auth', authRoutes);


// Protected API routes (Apply authentication middleware here)
app.use('/api/users', authenticate, userRoutes);
app.use('/api/websites', authenticate, websiteRoutes);
app.use('/api/monitoring', authenticate, monitoringRoutes);
app.use('/api/incidents', authenticate, incidentRoutes);
app.use('/api/alerts', authenticate, alertRoutes);


// --- Background Tasks ---
scheduleMonitoring(); // Start scheduled tasks


// This MUST be the last middleware added to the stack
app.use(errorMiddleware);


export default app;