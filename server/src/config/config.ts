// src/config/config.ts
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Ensure dotenv is loaded BEFORE this file is processed if not done here.
// Usually, dotenv.config() in server.ts is sufficient.

// --- Read and Validate Required Variables First ---
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("FATAL ERROR: JWT_SECRET environment variable is not defined.");
}
if (!DATABASE_URL) {
  // Allow empty string for shadow db, but main DB is usually required
  throw new Error("FATAL ERROR: DATABASE_URL environment variable is not defined.");
}
// Add checks for other absolutely required variables if necessary

// --- Export Processed and Validated Config Object ---
export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10), // Use parseInt for port
  databaseUrl: DATABASE_URL, // Use the validated required variable
  shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || '', // Optional is fine
  jwtSecret: JWT_SECRET, // Use the validated required variable
};

// --- Export Other Configuration Variables Directly ---
export const CONCURRENCY = parseInt(process.env.MONITOR_CONCURRENCY || '3', 10);
export const TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT || '10000', 10);
export const EMAIL_FROM = process.env.EMAIL_FROM || 'monitor@example.com';
export const SMTP_HOST = process.env.SMTP_HOST; // Read directly
export const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
export const SMTP_USER = process.env.SMTP_USER; // Read directly
export const SMTP_PASS = process.env.SMTP_PASS; // Read directly

// Default interval (in seconds) if not specified in the database
export const DEFAULT_INTERVAL = 60;

// Create email transporter if SMTP is configured
let emailTransporter: nodemailer.Transporter | null = null; // Use specific type
// Use the exported constants for the check
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  emailTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // Usually true for 465, false for 587
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  console.log('Email transporter configured.');
} else {
    console.log('Email transporter not configured (missing SMTP host, user, or pass).');
}

export { emailTransporter };