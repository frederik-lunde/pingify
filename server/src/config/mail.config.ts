// server/src/config/mail.config.ts
import dotenv from 'dotenv';

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