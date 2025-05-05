"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMail = void 0;
// server/src/services/mail.service.ts
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = require("../config/config");
const transporter = nodemailer_1.default.createTransport({
    host: config_1.mailConfig.host,
    port: config_1.mailConfig.port,
    secure: config_1.mailConfig.secure,
    auth: {
        user: config_1.mailConfig.auth.user,
        pass: config_1.mailConfig.auth.pass,
    },
});
// Verify connection configuration on startup (optional but recommended)
transporter.verify((error, success) => {
    if (error) {
        console.error('Mail transporter verification failed:', error);
    }
    else {
        console.log('Mail transporter is ready to send emails');
    }
});
/**
 * Sends an email using the pre-configured transporter.
 * @param options - MailOptions object (to, subject, text, html)
 */
const sendMail = (options) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const info = yield transporter.sendMail({
            from: config_1.mailConfig.from, // Sender address from config
            to: options.to, // List of receivers
            subject: options.subject, // Subject line
            text: options.text, // Plain text body
            html: options.html, // HTML body
        });
        console.log('Message sent: %s', info.messageId);
    }
    catch (error) {
        console.error('Error sending email:', error);
        throw new Error(`Failed to send email to ${options.to}. Subject: ${options.subject}`);
    }
});
exports.sendMail = sendMail;
