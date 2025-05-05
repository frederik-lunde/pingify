// src/config/config.ts
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables from .env file (primarily for local development)
// In production (like Render), variables should be set directly in the environment.
dotenv.config();

// --- Environment Variable Validation ---

// Define all required environment variables.
// Their *values* will differ between environments (local .env vs. Render settings).
const requiredEnvVars = [
  'NODE_ENV',       // Should be 'development' or 'production'
  'PORT',
  'JWT_SECRET',
  'DATABASE_URL',   // Single DB URL variable
  'CORS_ORIGIN',    // Single CORS Origin variable
  'MAIL_HOST',
  'MAIL_PORT',
  'MAIL_SECURE',    // Expects 'true' or 'false' as string
  'MAIL_USER',
  'MAIL_PASS',
  'MAIL_FROM',
  // Add any other *always* required variables here
  // Optional vars with defaults don't need to be listed (e.g., LOG_LEVEL)
];

const nodeEnv = process.env.NODE_ENV || 'development'; // Default to development if unset

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`FATAL ERROR: Missing required environment variables: ${missingVars.join(', ')} (NODE_ENV=${nodeEnv})`);
  process.exit(1); // Exit if required variables are missing
}

// --- Parse and Structure Configuration ---

export const appConfig = {
  nodeEnv: nodeEnv,
  port: parseInt(process.env.PORT!, 10), // Use ! because existence is checked above
  logLevel: process.env.LOG_LEVEL || 'info',
  isProduction: nodeEnv === 'production',
  isDevelopment: nodeEnv === 'development',
};

export const dbConfig = {
  // Use the single DATABASE_URL variable provided by the environment
  databaseUrl: process.env.DATABASE_URL!, // Use ! because existence is checked above
  // Keep shadow DB URL if you use it for Prisma migrations (often optional)
  shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || '',
};

export const securityConfig = {
  jwtSecret: process.env.JWT_SECRET!, // Use ! because existence is checked above
};

export const corsConfig = {
    // Use the single CORS_ORIGIN variable provided by the environment
    allowedOrigins: process.env.CORS_ORIGIN!, // Use ! because existence is checked above
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // Often needed for cookies/auth headers
};

// Mailer Config
const mailPort = parseInt(process.env.MAIL_PORT!, 10); // Use ! because existence is checked above

export const mailConfig = {
  host: process.env.MAIL_HOST!, // Use ! because existence is checked above
  port: mailPort, // Already parsed and validated below
  secure: process.env.MAIL_SECURE === 'true', // Explicit boolean conversion
  tls: process.env.MAIL_TLS === 'true' ? { ciphers: 'SSLv3' } : undefined, // Conditional TLS config
  auth: {
    user: process.env.MAIL_USER!, // Use ! because existence is checked above
    pass: process.env.MAIL_PASS!, // Use ! because existence is checked above
  },
  from: process.env.MAIL_FROM!, // Use ! because existence is checked above
};

// Monitoring & Alerting Config (Using defaults if specific env vars aren't set)
export const monitoringConfig = {
  concurrency: parseInt(process.env.MONITOR_CONCURRENCY || '5', 10),
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT || '10000', 10),
  defaultIntervalSeconds: parseInt(process.env.DEFAULT_MONITOR_INTERVAL_SECONDS || '300', 10),
  minimumIntervalSeconds: parseInt(process.env.MINIMUM_MONITOR_INTERVAL_SECONDS || '30', 10),
  resultsToKeep: parseInt(process.env.MONITORING_RESULTS_TO_KEEP || '2000', 10),
  resolvedAlertLinkCleanupDays: parseInt(process.env.RESOLVED_ALERT_LINK_CLEANUP_DAYS || '30', 10),
  recheckDelaySeconds: parseInt(process.env.RECHECK_DELAY_SECONDS || '60', 10),
  monitorUserAgent: process.env.MONITOR_USER_AGENT || 'PingifyMonitor/1.0 (+https://pingify.com/monitor)',
};

// Scheduler Config (Using defaults if specific env vars aren't set)
export const schedulerConfig = {
  monitorCronPattern: process.env.MONITOR_CRON_PATTERN || '*/30 * * * * *',
  cleanupCronPattern: process.env.CLEANUP_CRON_PATTERN || '0 * * * *',
  purgeCronPattern: process.env.PURGE_CRON_PATTERN || '0 2 * * *',
};

// --- Combined Export (Optional but convenient) ---
export const config = {
  app: appConfig,
  db: dbConfig,
  security: securityConfig,
  cors: corsConfig,
  mail: mailConfig,
  monitoring: monitoringConfig,
  scheduler: schedulerConfig,
};

// --- Runtime Validation for Parsed Numbers ---
// Check if any parseInt resulted in NaN (Not a Number)
const numberValidation = [
    { name: 'PORT', value: appConfig.port },
    { name: 'MAIL_PORT', value: mailConfig.port },
    { name: 'MONITOR_CONCURRENCY', value: monitoringConfig.concurrency },
    { name: 'REQUEST_TIMEOUT', value: monitoringConfig.requestTimeoutMs },
    { name: 'DEFAULT_MONITOR_INTERVAL_SECONDS', value: monitoringConfig.defaultIntervalSeconds },
    { name: 'MINIMUM_MONITOR_INTERVAL_SECONDS', value: monitoringConfig.minimumIntervalSeconds },
    { name: 'MONITORING_RESULTS_TO_KEEP', value: monitoringConfig.resultsToKeep },
    { name: 'RESOLVED_ALERT_LINK_CLEANUP_DAYS', value: monitoringConfig.resolvedAlertLinkCleanupDays },
    { name: 'RECHECK_DELAY_SECONDS', value: monitoringConfig.recheckDelaySeconds },
];

const invalidNumbers = numberValidation.filter(v => isNaN(v.value));

if (invalidNumbers.length > 0) {
    const invalidNames = invalidNumbers.map(v => v.name).join(', ');
    console.error(`FATAL ERROR: The following environment variables must be valid numbers: ${invalidNames}`);
    process.exit(1);
}

// --- Log Confirmation ---
console.log(`[Config] Configuration loaded successfully for NODE_ENV=${appConfig.nodeEnv}.`);
// Avoid logging sensitive parts of the DB URL, especially credentials
if (dbConfig.databaseUrl) {
    try {
        const url = new URL(dbConfig.databaseUrl);
        console.log(`[Config] Database Host: ${url.hostname}`);
    } catch (e) {
        console.log("[Config] Database URL: Set (format unrecognized or invalid)");
    }
} else {
    console.log("[Config] Database URL: Not Set"); // Should not happen due to checks above
}
console.log(`[Config] CORS Origin configured: ${corsConfig.allowedOrigins}`);