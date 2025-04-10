// server/src/services/mail.service.ts
import nodemailer from 'nodemailer';
import { mailConfig } from '../config/config';

// Define the structure for email options
interface MailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}


const transporter = nodemailer.createTransport({
  host: mailConfig.host,
  port: mailConfig.port,
  secure: mailConfig.secure, 
  auth: {
    user: mailConfig.auth.user,
    pass: mailConfig.auth.pass,
  },
});

// Verify connection configuration on startup (optional but recommended)
transporter.verify((error, success) => {
  if (error) {
    console.error('Mail transporter verification failed:', error);
  } else {
    console.log('Mail transporter is ready to send emails');
  }
});

/**
 * Sends an email using the pre-configured transporter.
 * @param options - MailOptions object (to, subject, text, html)
 */
export const sendMail = async (options: MailOptions): Promise<void> => {
  try {
    const info = await transporter.sendMail({
      from: mailConfig.from, // Sender address from config
      to: options.to, // List of receivers
      subject: options.subject, // Subject line
      text: options.text, // Plain text body
      html: options.html, // HTML body
    });
    console.log('Message sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email to ${options.to}. Subject: ${options.subject}`);
  }
};
