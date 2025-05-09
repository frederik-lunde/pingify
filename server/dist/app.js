"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const morgan_1 = __importDefault(require("morgan"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = require("express-rate-limit");
const compression_1 = __importDefault(require("compression"));
// Routes
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const websiteRoutes_1 = __importDefault(require("./routes/websiteRoutes"));
const monitoringRoutes_1 = __importDefault(
  require("./routes/monitoringRoutes"),
);
const alertRoutes_1 = __importDefault(require("./routes/alertRoutes"));
const incidentRoutes_1 = __importDefault(require("./routes/incidentRoutes"));
// Middleware
const errorMiddleware_1 = __importDefault(
  require("./middleware/errorMiddleware"),
);
const authMiddleware_1 = require("./middleware/authMiddleware");
// Utils
const scheduler_1 = require("./utils/scheduler");
const app = (0, express_1.default)();
const limiter = (0, express_rate_limit_1.rateLimit)({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Too many requests, please try again later.",
});
//global middleware
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(limiter);
app.use(express_1.default.json());
app.use((0, morgan_1.default)("tiny"));
app.use((0, compression_1.default)());
// Public routes
app.use("/api/auth", authRoutes_1.default);
// Protected routes
app.use("/api/users", authMiddleware_1.authenticate, userRoutes_1.default);
app.use(
  "/api/websites",
  authMiddleware_1.authenticate,
  websiteRoutes_1.default,
);
app.use(
  "/api/monitoring",
  authMiddleware_1.authenticate,
  monitoringRoutes_1.default,
);
app.use(
  "/api/incidents",
  authMiddleware_1.authenticate,
  incidentRoutes_1.default,
);
app.use("/api/alerts", authMiddleware_1.authenticate, alertRoutes_1.default);
(0, scheduler_1.scheduleMonitoring)();
// Global error handler (should be the last middleware)
app.use(errorMiddleware_1.default);
exports.default = app;
