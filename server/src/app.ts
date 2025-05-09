// src/app.ts
import express from "express";
import morgan from "morgan";
import cors from "cors"; // Keep this import
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import compression from "compression";

// Import the specific config needed or the whole config object
import { config } from "./config/config"; // Adjust path if needed

// Routes
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import websiteRoutes from "./routes/websiteRoutes";
import monitoringRoutes from "./routes/monitoringRoutes";
import alertRoutes from "./routes/alertRoutes";
import incidentRoutes from "./routes/incidentRoutes";

// Middleware
import errorMiddleware from "./middleware/errorMiddleware";
import { authenticate } from "./middleware/authMiddleware";

// Utils
import { scheduleMonitoring } from "./utils/scheduler";

const app = express();

// --- Configuration & Middleware ---

// 1. Security Headers
app.use(helmet());

// 2. CORS Configuration - Use config from config.ts
const corsOptions: cors.CorsOptions = {
  origin: config.cors.allowedOrigins, // Use the dynamically set origin(s)
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  credentials: config.cors.credentials,
};
app.use(cors(corsOptions));

// 3. Request Logging - Conditional based on environment
if (config.app.isProduction) {
  app.use(morgan("combined")); // More standard format for production logs
} else {
  app.use(morgan("dev")); // More detailed for development
}

// 4. Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Response Compression
app.use(compression());

// 6. Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.app.isProduction ? 500 : 2000, // Example: Stricter limit in prod
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// --- Routes ---

// Public API routes
app.use("/api/auth", authRoutes);

// Protected API routes (Apply authentication middleware here)
app.use("/api/users", authenticate, userRoutes);
app.use("/api/websites", authenticate, websiteRoutes);
app.use("/api/monitoring", authenticate, monitoringRoutes);
app.use("/api/incidents", authenticate, incidentRoutes);
app.use("/api/alerts", authenticate, alertRoutes);

// --- Background Tasks ---
scheduleMonitoring(); // Start scheduled tasks

// --- Error Handling ---
// This MUST be the last middleware added
app.use(errorMiddleware);

export default app;
