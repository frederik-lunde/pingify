// src/config/config.ts
import nodemailer from 'nodemailer';


// --- Read and Validate Required Environment Variables First ---
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  // Using console.error and process.exit for fatal errors might be clearer
  console.error("FATAL ERROR: JWT_SECRET environment variable is not defined.");
  process.exit(1); // Exit if essential secret is missing
}
if (!DATABASE_URL) {
  console.error("FATAL ERROR: DATABASE_URL environment variable is not defined.");
  process.exit(1); // Exit if DB connection string is missing
}
// Add checks for other absolutely required variables if necessary (e.g., critical API keys)

// --- Export Primary Config Object ---
// Holds core application settings, often used across various modules.
export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: DATABASE_URL, // Use the validated required variable
  shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || '', // Optional is fine
  jwtSecret: JWT_SECRET, // Use the validated required variable
  // Add other general config if needed, e.g., CORS origins, logging levels
};

// --- Export Monitoring & Scheduler Specific Configuration Variables ---

// Concurrency for website checks
export const CONCURRENCY = parseInt(process.env.MONITOR_CONCURRENCY || '5', 10);

// HTTP request timeout for website checks
export const TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT || '10000', 10); // 10 seconds default

// Default website check interval (in seconds) if not specified per website
export const DEFAULT_INTERVAL = parseInt(process.env.DEFAULT_MONITOR_INTERVAL_SECONDS || '300', 10); // 5 minutes default

// **NEW:** Number of recent monitoring results to keep per website during purge
export const MONITORING_RESULTS_TO_KEEP = parseInt(process.env.MONITORING_RESULTS_TO_KEEP || '2000', 10);

// **NEW:** Number of days after which resolved AlertUser links should be cleaned up
export const RESOLVED_ALERT_LINK_CLEANUP_DAYS = parseInt(process.env.RESOLVED_ALERT_LINK_CLEANUP_DAYS || '30', 10);


// --- Export Email Configuration ---
export const EMAIL_FROM = process.env.EMAIL_FROM || 'uptime-monitor@yourdomain.com'; // Use a more specific default
export const SMTP_HOST = process.env.SMTP_HOST;
export const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10); // 587 is common for TLS
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS = process.env.SMTP_PASS;
export const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465; // Explicit secure flag or infer from port 465

// --- Create and Export Email Transporter ---
// Initialize as null, create only if config is present.
let emailTransporter: nodemailer.Transporter | null = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  try {
    emailTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE, // Use the derived secure flag
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      // Optional: Add connection timeout and other options if needed
      // connectionTimeout: 5000,
      // greetingTimeout: 5000,
      // socketTimeout: 5000,
    });

    // Optional: Verify transporter configuration on startup (can slow down start)
    // emailTransporter.verify((error, success) => {
    //   if (error) {
    //     console.error('Email transporter verification failed:', error);
    //     // Decide if this is fatal or just a warning
    //     // emailTransporter = null; // Reset if verification fails?
    //   } else {
    //     console.log('Email transporter configured and verified successfully.');
    //   }
    // });
     console.log('Email transporter configured. Verification skipped on startup.'); // Log configuration success

  } catch (error) {
      console.error('Error creating email transporter:', error);
      // Ensure transporter remains null if creation fails
      emailTransporter = null;
  }
} else {
    console.warn('Email transporter not fully configured (missing SMTP_HOST, SMTP_USER, or SMTP_PASS). Email notifications disabled.');
}

// Export the potentially created transporter
export { emailTransporter };

// Log the final effective configuration values (optional, good for debugging)
console.log('-------------------- Configuration Loaded --------------------');
console.log(`NODE_ENV: ${config.nodeEnv}`);
console.log(`PORT: ${config.port}`);
console.log(`MONITOR_CONCURRENCY: ${CONCURRENCY}`);
console.log(`REQUEST_TIMEOUT: ${TIMEOUT_MS}ms`);
console.log(`DEFAULT_MONITOR_INTERVAL: ${DEFAULT_INTERVAL}s`);
console.log(`MONITORING_RESULTS_TO_KEEP: ${MONITORING_RESULTS_TO_KEEP}`);
console.log(`RESOLVED_ALERT_LINK_CLEANUP_DAYS: ${RESOLVED_ALERT_LINK_CLEANUP_DAYS}`);
console.log(`Email Transporter Configured: ${emailTransporter !== null}`);
console.log('-------------------------------------------------------------');