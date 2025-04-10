// src/config/config.ts
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';


// --- Read and Validate Required Environment Variables First ---
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET environment variable is not defined.");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("FATAL ERROR: DATABASE_URL environment variable is not defined.");
  process.exit(1);
}

// --- Export Primary Config Object ---
export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: DATABASE_URL,
  shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || '',
  jwtSecret: JWT_SECRET,
};

// --- Export Monitoring & Scheduler Specific Configuration Variables ---
export const CONCURRENCY = parseInt(process.env.MONITOR_CONCURRENCY || '5', 10);
export const TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT || '10000', 10);
export const DEFAULT_INTERVAL = parseInt(process.env.DEFAULT_MONITOR_INTERVAL_SECONDS || '300', 10);
export const MONITORING_RESULTS_TO_KEEP = parseInt(process.env.MONITORING_RESULTS_TO_KEEP || '2000', 10);
export const RESOLVED_ALERT_LINK_CLEANUP_DAYS = parseInt(process.env.RESOLVED_ALERT_LINK_CLEANUP_DAYS || '30', 10);
// **NEW:** Delay in seconds before performing a re-check to confirm failure
export const RECHECK_DELAY_SECONDS = parseInt(process.env.RECHECK_DELAY_SECONDS || '60', 10);


dotenv.config(); // Load environment variables from .env file

// Validate that necessary mail environment variables are set
const requiredEnvVars = [
  'MAIL_HOST',
  'MAIL_PORT',
  'MAIL_SECURE',
  'MAIL_USER',
  'MAIL_PASS',
  'MAIL_FROM',
];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    // Throw an error during startup if a required variable is missing
    throw new Error(`Environment variable ${varName} is required for mail service.`);
  }
}

export const mailConfig = {
  host: process.env.MAIL_HOST!, // Non-null assertion because we checked above
  port: parseInt(process.env.MAIL_PORT!, 10), // Parse port to number
  secure: process.env.MAIL_SECURE === 'true', // Convert 'true'/'false' string to boolean
  auth: {
    user: process.env.MAIL_USER!,
    pass: process.env.MAIL_PASS!,
  },
  from: process.env.MAIL_FROM!, // Default sender address
};

// Basic validation for port number
if (isNaN(mailConfig.port)) {
  throw new Error('MAIL_PORT environment variable must be a valid number.');
}
