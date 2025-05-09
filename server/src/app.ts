import express from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import compression from "compression";


import { config } from "./config/config";


import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import websiteRoutes from "./routes/websiteRoutes";
import monitoringRoutes from "./routes/monitoringRoutes";
import alertRoutes from "./routes/alertRoutes";
import incidentRoutes from "./routes/incidentRoutes";


import errorMiddleware from "./middleware/errorMiddleware";
import { authenticate } from "./middleware/authMiddleware";


import { scheduleMonitoring } from "./utils/scheduler";

const app = express();


app.use(helmet());


const corsOptions: cors.CorsOptions = {
  origin: config.cors.allowedOrigins,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  credentials: config.cors.credentials,
};
app.use(cors(corsOptions));


if (config.app.isProduction) {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(compression());


const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: config.app.isProduction ? 500 : 2000, 
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);



app.use("/api/auth", authRoutes);


app.use("/api/users", authenticate, userRoutes);
app.use("/api/websites", authenticate, websiteRoutes);
app.use("/api/monitoring", authenticate, monitoringRoutes);
app.use("/api/incidents", authenticate, incidentRoutes);
app.use("/api/alerts", authenticate, alertRoutes);


scheduleMonitoring();


//must be last
app.use(errorMiddleware);

export default app;