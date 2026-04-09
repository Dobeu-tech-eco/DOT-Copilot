import { logError } from './logger';
import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT, 10),
        secure: parseInt(SMTP_PORT, 10) === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });
      this.isConfigured = true;
      console.log('Email service configured');
    } else {
      console.warn('Email service not configured - emails will be logged to console');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const from = process.env.EMAIL_FROM || 'noreply@dot-copilot.com';

    if (!this.isConfigured || !this.transporter) {
      // Log email in development
      console.log('=== Email (not sent - no SMTP configured) ===');
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Body: ${options.text || options.html}`);
      console.log('==============================================');
      return true;
    }

    try {
      await this.transporter.sendMail({
        from,
        ...options,
      });
      return true;
    } catch (error) {
      logError('Failed to send email', error);
      return false;
    }
  }

  async sendPasswordReset(email: string, resetToken: string, resetUrl: string): Promise<boolean> {
    const subject = 'Reset Your Password - DOT Copilot';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f5f5f5; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>DOT Copilot</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>You requested a password reset for your DOT Copilot account.</p>
            <p>Click the button below to reset your password:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; font-size: 12px;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} DOT Copilot. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Reset Your Password - DOT Copilot
      
      You requested a password reset for your DOT Copilot account.
      
      Click this link to reset your password: ${resetUrl}
      
      This link will expire in 1 hour.
      
      If you didn't request this, please ignore this email.
    `;

    return this.sendEmail({ to: email, subject, html, text });
  }

  async sendAssignmentNotification(
    email: string, 
    userName: string, 
    programName: string, 
    dueDate?: string
  ): Promise<boolean> {
    const subject = `New Training Assignment - ${programName}`;
    const dueDateText = dueDate ? `Due by: ${new Date(dueDate).toLocaleDateString()}` : '';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f5f5f5; }
          .button { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 4px; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>DOT Copilot</h1>
          </div>
          <div class="content">
            <h2>New Training Assignment</h2>
            <p>Hello ${userName},</p>
            <p>You have been assigned a new training program:</p>
            <h3>${programName}</h3>
            ${dueDateText ? `<p><strong>${dueDateText}</strong></p>` : ''}
            <p style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/driver-dashboard" class="button">View Assignment</a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} DOT Copilot. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({ to: email, subject, html });
  }

  async sendCompletionCertificate(
    email: string,
    userName: string,
    programName: string,
    completionDate: Date
  ): Promise<boolean> {
    const subject = `Training Completed - ${programName}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f5f5f5; }
          .certificate { background: white; border: 2px solid #28a745; padding: 30px; text-align: center; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
          </div>
          <div class="content">
            <div class="certificate">
              <h2>Certificate of Completion</h2>
              <p>This certifies that</p>
              <h3>${userName}</h3>
              <p>has successfully completed</p>
              <h3>${programName}</h3>
              <p>on ${completionDate.toLocaleDateString()}</p>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} DOT Copilot. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({ to: email, subject, html });
  }
}

export const emailService = new EmailService();
export default emailService;

