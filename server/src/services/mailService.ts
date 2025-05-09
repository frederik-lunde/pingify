
import nodemailer from "nodemailer";
import { mailConfig } from "../config/config";


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


transporter.verify((error, success) => {
  if (error) {
    console.error("Mail transporter verification failed:", error);
  } else {
    console.log("Mail transporter is ready to send emails");
  }
});

export const sendMail = async (options: MailOptions): Promise<void> => {
  try {
    const info = await transporter.sendMail({
      from: mailConfig.from, 
      to: options.to, 
      subject: options.subject, 
      text: options.text, 
      html: options.html, 
    });
    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error(
      `Failed to send email to ${options.to}. Subject: ${options.subject}`,
    );
  }
};
