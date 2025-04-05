// src/config/config.ts
import nodemailer from 'nodemailer';

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


// --- Export Email Configuration ---
export const EMAIL_FROM = process.env.EMAIL_FROM || 'uptime-monitor@yourdomain.com';
export const SMTP_HOST = process.env.SMTP_HOST;
export const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS = process.env.SMTP_PASS;
export const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;

// --- Create and Export Email Transporter ---
let emailTransporter: nodemailer.Transporter | null = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  try {
    emailTransporter = nodemailer.createTransport({ /* ... */ });
    console.log('Email transporter configured.');
  } catch (error) {
      console.error('Error creating email transporter:', error);
      emailTransporter = null;
  }
} else {
    console.warn('Email transporter not fully configured. Email notifications disabled.');
}
export { emailTransporter };

// --- Log effective config ---
console.log('-------------------- Configuration Loaded --------------------');
console.log(`NODE_ENV: ${config.nodeEnv}`);
console.log(`PORT: ${config.port}`);
console.log(`MONITOR_CONCURRENCY: ${CONCURRENCY}`);
console.log(`REQUEST_TIMEOUT: ${TIMEOUT_MS}ms`);
console.log(`DEFAULT_MONITOR_INTERVAL: ${DEFAULT_INTERVAL}s`);
console.log(`MONITORING_RESULTS_TO_KEEP: ${MONITORING_RESULTS_TO_KEEP}`);
console.log(`RESOLVED_ALERT_LINK_CLEANUP_DAYS: ${RESOLVED_ALERT_LINK_CLEANUP_DAYS}`);
console.log(`RECHECK_DELAY_SECONDS: ${RECHECK_DELAY_SECONDS}`); // Log new config
console.log(`Email Transporter Configured: ${emailTransporter !== null}`);
console.log('-------------------------------------------------------------');