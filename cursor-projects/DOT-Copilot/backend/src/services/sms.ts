/**
 * SMS Notification Service
 * Uses Twilio for SMS delivery
 */

import prisma from '../db';
import { getNotificationMessage, SupportedLanguage } from './i18n';
import { logError } from './logger';

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class SmsService {
  private accountSid: string | null = null;
  private authToken: string | null = null;
  private fromNumber: string | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || null;
    this.authToken = process.env.TWILIO_AUTH_TOKEN || null;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || null;

    if (this.accountSid && this.authToken && this.fromNumber) {
      this.isConfigured = true;
      console.log('SMS service configured (Twilio)');
    } else {
      console.warn('SMS service not configured - messages will be logged');
    }
  }

  /**
   * Check if SMS is configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Send SMS to a phone number
   */
  async send(to: string, message: string): Promise<SmsResult> {
    // Normalize phone number
    const normalizedNumber = this.normalizePhoneNumber(to);
    
    if (!normalizedNumber) {
      return { success: false, error: 'Invalid phone number' };
    }

    if (!this.isConfigured) {
      // Log instead of sending
      console.log('=== SMS (not sent - Twilio not configured) ===');
      console.log(`To: ${normalizedNumber}`);
      console.log(`Message: ${message}`);
      console.log('==============================================');
      return { success: true, messageId: 'mock-' + Date.now() };
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      
      const formData = new URLSearchParams();
      formData.append('To', normalizedNumber);
      formData.append('From', this.fromNumber!);
      formData.append('Body', message);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const result = await response.json();

      if (response.ok) {
        return {
          success: true,
          messageId: result.sid,
        };
      } else {
        return {
          success: false,
          error: result.message || 'Twilio API error',
        };
      }
    } catch (error: any) {
      logError('SMS send error', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send SMS to a user by their ID
   */
  async sendToUser(userId: string, message: string): Promise<SmsResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, preferSms: true },
    });

    if (!user?.phone) {
      return { success: false, error: 'User has no phone number' };
    }

    if (!user.preferSms) {
      return { success: false, error: 'User has opted out of SMS' };
    }

    return this.send(user.phone, message);
  }

  /**
   * Send localized SMS to a user
   */
  async sendLocalizedToUser(
    userId: string,
    templateKey: 'assignment_created' | 'assignment_due_soon' | 'assignment_overdue' | 
                 'training_completed' | 'document_expiring' | 'document_expired',
    vars: Record<string, string | number>
  ): Promise<SmsResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, preferSms: true, preferredLanguage: true },
    });

    if (!user?.phone) {
      return { success: false, error: 'User has no phone number' };
    }

    if (!user.preferSms) {
      return { success: false, error: 'User has opted out of SMS' };
    }

    const language = (user.preferredLanguage || 'en') as SupportedLanguage;
    const { title, body } = getNotificationMessage(templateKey, language, vars);
    
    // SMS format: combine title and body
    const message = `${title}\n\n${body}`;

    return this.send(user.phone, message);
  }

  /**
   * Send assignment notification via SMS
   */
  async sendAssignmentNotification(
    userId: string,
    programName: string,
    dueDate: Date | null
  ): Promise<SmsResult> {
    return this.sendLocalizedToUser(userId, 'assignment_created', {
      programName,
      dueDate: dueDate ? dueDate.toLocaleDateString() : 'No due date',
    });
  }

  /**
   * Send overdue notification via SMS
   */
  async sendOverdueNotification(
    userId: string,
    programName: string,
    daysOverdue: number
  ): Promise<SmsResult> {
    return this.sendLocalizedToUser(userId, 'assignment_overdue', {
      programName,
      days: daysOverdue,
    });
  }

  /**
   * Send document expiring notification via SMS
   */
  async sendDocumentExpiringNotification(
    userId: string,
    documentType: string,
    daysUntilExpiration: number
  ): Promise<SmsResult> {
    return this.sendLocalizedToUser(userId, 'document_expiring', {
      documentType,
      days: daysUntilExpiration,
    });
  }

  /**
   * Send document expired notification via SMS
   */
  async sendDocumentExpiredNotification(
    userId: string,
    documentType: string
  ): Promise<SmsResult> {
    return this.sendLocalizedToUser(userId, 'document_expired', {
      documentType,
    });
  }

  /**
   * Send a custom reminder via SMS
   */
  async sendReminder(userId: string, title: string, description?: string): Promise<SmsResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, preferSms: true, preferredLanguage: true },
    });

    if (!user?.phone) {
      return { success: false, error: 'User has no phone number' };
    }

    if (!user.preferSms) {
      return { success: false, error: 'User has opted out of SMS' };
    }

    const message = description 
      ? `📌 Reminder: ${title}\n\n${description}`
      : `📌 Reminder: ${title}`;

    return this.send(user.phone, message);
  }

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhoneNumber(phone: string): string | null {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');

    // US number handling
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }

    // Already has country code
    if (digits.length > 10) {
      return `+${digits}`;
    }

    return null;
  }

  /**
   * Verify phone number format
   */
  isValidPhoneNumber(phone: string): boolean {
    return this.normalizePhoneNumber(phone) !== null;
  }

  /**
   * Send verification code (for phone verification)
   */
  async sendVerificationCode(phone: string, code: string): Promise<SmsResult> {
    const message = `Your DOT Copilot verification code is: ${code}\n\nThis code expires in 10 minutes.`;
    return this.send(phone, message);
  }
}

export const smsService = new SmsService();
export default smsService;
