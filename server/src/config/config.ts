// src/config/config.ts
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

// --- Environment Variable Validation ---

// Base required variables for all environments
const baseRequiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'JWT_SECRET',
  'MAIL_HOST',
  'MAIL_PORT',
  'MAIL_SECURE',
  'MAIL_USER',
  'MAIL_PASS',
  'MAIL_FROM',
];

// Environment-specific required variables
const devRequiredEnvVars = ['DATABASE_URL_DEV', 'CORS_ORIGIN_DEV'];
const prodRequiredEnvVars = ['DATABASE_URL_PROD', 'CORS_ORIGIN_PROD'];

let requiredEnvVars = [...baseRequiredEnvVars];
const nodeEnv = process.env.NODE_ENV;

if (nodeEnv === 'production') {
  requiredEnvVars = [...requiredEnvVars, ...prodRequiredEnvVars];
} else {
  // Assume development or other non-production environments require dev vars
  requiredEnvVars = [...requiredEnvVars, ...devRequiredEnvVars];
}

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`FATAL ERROR: Missing required environment variables for NODE_ENV=${nodeEnv}: ${missingVars.join(', ')}`);
  process.exit(1);
}

// --- Parse and Structure Configuration ---

export const appConfig = {
  nodeEnv: nodeEnv!, // Non-null assertion safe due to check above
  port: parseInt(process.env.PORT!, 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  isProduction: nodeEnv === 'production',
  isDevelopment: nodeEnv === 'development',
};

// Database Config - Select based on NODE_ENV
let resolvedDbUrl: string;
if (appConfig.isProduction) {
  resolvedDbUrl = process.env.DATABASE_URL_PROD!;
} else {
  resolvedDbUrl = process.env.DATABASE_URL_DEV!;
}

export const dbConfig = {
  databaseUrl: resolvedDbUrl,
  // Keep shadow DB URL if you use it for Prisma migrations
  shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || '',
};

// Security Config
export const securityConfig = {
  jwtSecret: process.env.JWT_SECRET!,
};

// CORS Config - Select based on NODE_ENV
let allowedOrigins: string | string[];
if (appConfig.isProduction) {
    allowedOrigins = process.env.CORS_ORIGIN_PROD!;
    console.log(`[Config] CORS Production Origin configured: ${allowedOrigins}`);
} else {
    // Allow dev origin. You could potentially add more here if needed.
    allowedOrigins = process.env.CORS_ORIGIN_DEV!;
    console.log(`[Config] CORS Development Origin configured: ${allowedOrigins}`);
    // Example if you needed multiple origins in dev:
    // allowedOrigins = [process.env.CORS_ORIGIN_DEV!, 'http://localhost:anotherport'];
}

export const corsConfig = {
    allowedOrigins: allowedOrigins,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
};

// Mailer Config
const mailPort = parseInt(process.env.MAIL_PORT!, 10);
if (isNaN(mailPort)) {
  throw new Error('MAIL_PORT environment variable must be a valid number.');
}

export const mailConfig = {
  host: process.env.MAIL_HOST!,
  port: mailPort,
  secure: process.env.MAIL_SECURE === 'true',
  tls: process.env.MAIL_TLS === 'true' ? { ciphers: 'SSLv3' } : undefined,
  auth: {
    user: process.env.MAIL_USER!,
    pass: process.env.MAIL_PASS!,
  },
  from: process.env.MAIL_FROM!,
};

// Monitoring & Alerting Config
export const monitoringConfig = {
  concurrency: parseInt(process.env.MONITOR_CONCURRENCY || '5', 10),
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT || '10000', 10),
  defaultIntervalSeconds: parseInt(process.env.DEFAULT_MONITOR_INTERVAL_SECONDS || '300', 10),
  minimumIntervalSeconds: parseInt(process.env.MINIMUM_MONITOR_INTERVAL_SECONDS || '30', 10),
  resultsToKeep: parseInt(process.env.MONITORING_RESULTS_TO_KEEP || '2000', 10),
  resolvedAlertLinkCleanupDays: parseInt(process.env.RESOLVED_ALERT_LINK_CLEANUP_DAYS || '30', 10),
  recheckDelaySeconds: parseInt(process.env.RECHECK_DELAY_SECONDS || '60', 10),
  monitorUserAgent: process.env.MONITOR_USER_AGENT || 'PingifyMonitor/1.0',
};

// Scheduler Config
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
  cors: corsConfig, // Add CORS config here
  mail: mailConfig,
  monitoring: monitoringConfig,
  scheduler: schedulerConfig,
};

// --- Validate Ports and Numbers ---
if (isNaN(appConfig.port)) throw new Error('PORT must be a valid number.');
if (isNaN(monitoringConfig.concurrency)) throw new Error('MONITOR_CONCURRENCY must be a valid number.');
if (isNaN(monitoringConfig.requestTimeoutMs)) throw new Error('REQUEST_TIMEOUT must be a valid number.');
if (isNaN(monitoringConfig.defaultIntervalSeconds)) throw new Error('DEFAULT_MONITOR_INTERVAL_SECONDS must be a valid number.');
if (isNaN(monitoringConfig.minimumIntervalSeconds)) throw new Error('MINIMUM_MONITOR_INTERVAL_SECONDS must be a valid number.');
if (isNaN(monitoringConfig.resultsToKeep)) throw new Error('MONITORING_RESULTS_TO_KEEP must be a valid number.');
if (isNaN(monitoringConfig.resolvedAlertLinkCleanupDays)) throw new Error('RESOLVED_ALERT_LINK_CLEANUP_DAYS must be a valid number.');
if (isNaN(monitoringConfig.recheckDelaySeconds)) throw new Error('RECHECK_DELAY_SECONDS must be a valid number.');

console.log(`[Config] Configuration loaded successfully for NODE_ENV=${appConfig.nodeEnv}.`);
console.log(`[Config] Database URL: ${dbConfig.databaseUrl.substring(0, dbConfig.databaseUrl.indexOf('@') + 1)}... (credentials hidden)`);