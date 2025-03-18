import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL || '',
  shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || '',
};


export const CONCURRENCY = parseInt(process.env.MONITOR_CONCURRENCY || '3', 10);
export const TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT || '10000', 10);
export const EMAIL_FROM = process.env.EMAIL_FROM || 'monitor@example.com';
export const SMTP_HOST = process.env.SMTP_HOST || 'smtp.example.com';
export const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
export const SMTP_USER = process.env.SMTP_USER || '';
export const SMTP_PASS = process.env.SMTP_PASS || '';

// Default interval (in seconds) if not specified in the database
export const DEFAULT_INTERVAL = 60;

// Create email transporter if SMTP is configured
let emailTransporter: any = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  emailTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

export { emailTransporter };