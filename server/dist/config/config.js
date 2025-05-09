"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.config =
  exports.schedulerConfig =
  exports.monitoringConfig =
  exports.mailConfig =
  exports.securityConfig =
  exports.dbConfig =
  exports.appConfig =
    void 0;
// src/config/config.ts
const dotenv_1 = __importDefault(require("dotenv"));
//
// Load environment variables from .env file FIRST
//
dotenv_1.default.config();
// --- Environment Variable Validation ---
const requiredEnvVars = [
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "JWT_SECRET",
  "MAIL_HOST",
  "MAIL_PORT",
  "MAIL_SECURE",
  "MAIL_USER",
  "MAIL_PASS",
  "MAIL_FROM",
];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(
    `FATAL ERROR: Missing required environment variables: ${missingVars.join(", ")}`,
  );
  process.exit(1);
}
// --- Parse and Structure Configuration ---
//
// General Application Config
//
exports.appConfig = {
  nodeEnv: process.env.NODE_ENV, // Non-null assertion due to check above
  port: parseInt(process.env.PORT, 10),
  logLevel: process.env.LOG_LEVEL || "info",
};
//
// Database Config
//
exports.dbConfig = {
  databaseUrl: process.env.DATABASE_URL, // Non-null assertion due to check above
  shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || "",
};
//
// Security Config
//
exports.securityConfig = {
  jwtSecret: process.env.JWT_SECRET, // Non-null assertion due to check above
};
//
// Mailer Config
//
const mailPort = parseInt(process.env.MAIL_PORT, 10);
if (isNaN(mailPort)) {
  throw new Error("MAIL_PORT environment variable must be a valid number.");
}
exports.mailConfig = {
  host: process.env.MAIL_HOST, // Non-null assertion due to check above
  port: mailPort,
  //
  // Parse boolean values correctly
  //
  secure: process.env.MAIL_SECURE === "true",
  tls: process.env.MAIL_TLS === "true" ? { ciphers: "SSLv3" } : undefined, // Example of handling TLS options
  auth: {
    user: process.env.MAIL_USER, // Non-null assertion due to check above
    pass: process.env.MAIL_PASS, // Non-null assertion due to check above
  },
  from: process.env.MAIL_FROM, // Non-null assertion due to check above
};
//
// Monitoring & Alerting Config
//
exports.monitoringConfig = {
  concurrency: parseInt(process.env.MONITOR_CONCURRENCY || "5", 10),
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT || "10000", 10),
  defaultIntervalSeconds: parseInt(
    process.env.DEFAULT_MONITOR_INTERVAL_SECONDS || "300",
    10,
  ),
  minimumIntervalSeconds: parseInt(
    process.env.MINIMUM_MONITOR_INTERVAL_SECONDS || "30",
    10,
  ),
  resultsToKeep: parseInt(process.env.MONITORING_RESULTS_TO_KEEP || "2000", 10),
  resolvedAlertLinkCleanupDays: parseInt(
    process.env.RESOLVED_ALERT_LINK_CLEANUP_DAYS || "30",
    10,
  ),
  recheckDelaySeconds: parseInt(process.env.RECHECK_DELAY_SECONDS || "60", 10),
  monitorUserAgent: process.env.MONITOR_USER_AGENT || "PingifyMonitor/1.0",
};
//
// Scheduler Config
//
exports.schedulerConfig = {
  monitorCronPattern: process.env.MONITOR_CRON_PATTERN || "*/30 * * * * *",
  cleanupCronPattern: process.env.CLEANUP_CRON_PATTERN || "0 * * * *",
  purgeCronPattern: process.env.PURGE_CRON_PATTERN || "0 2 * * *",
};
// --- Combined Export (Optional) ---
//
// You can also export a single object if preferred
//
exports.config = {
  app: exports.appConfig,
  db: exports.dbConfig,
  security: exports.securityConfig,
  mail: exports.mailConfig,
  monitoring: exports.monitoringConfig,
  scheduler: exports.schedulerConfig,
};
// --- Validate Ports and Numbers ---
if (isNaN(exports.appConfig.port))
  throw new Error("PORT must be a valid number.");
if (isNaN(exports.monitoringConfig.concurrency))
  throw new Error("MONITOR_CONCURRENCY must be a valid number.");
if (isNaN(exports.monitoringConfig.requestTimeoutMs))
  throw new Error("REQUEST_TIMEOUT must be a valid number.");
if (isNaN(exports.monitoringConfig.defaultIntervalSeconds))
  throw new Error("DEFAULT_MONITOR_INTERVAL_SECONDS must be a valid number.");
if (isNaN(exports.monitoringConfig.minimumIntervalSeconds))
  throw new Error("MINIMUM_MONITOR_INTERVAL_SECONDS must be a valid number.");
if (isNaN(exports.monitoringConfig.resultsToKeep))
  throw new Error("MONITORING_RESULTS_TO_KEEP must be a valid number.");
if (isNaN(exports.monitoringConfig.resolvedAlertLinkCleanupDays))
  throw new Error("RESOLVED_ALERT_LINK_CLEANUP_DAYS must be a valid number.");
if (isNaN(exports.monitoringConfig.recheckDelaySeconds))
  throw new Error("RECHECK_DELAY_SECONDS must be a valid number.");
console.log("[Config] Configuration loaded successfully.");
