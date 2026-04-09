/**
 * Unified Notification Dispatcher
 * Orchestrates notifications across all channels:
 * - In-App (database)
 * - Email
 * - SMS (Twilio)
 * - Push (FCM)
 * - Webhooks
 */

import { logError } from './logger';
import prisma from '../db';
import emailService from './email';
import smsService from './sms';
import pushNotificationService from './pushNotification';
import eventDispatcher from './eventDispatcher';
import { getNotificationMessage, SupportedLanguage } from './i18n';

type NotificationType = 
  | 'assignment_created'
  | 'assignment_due_soon'
  | 'assignment_overdue'
  | 'training_completed'
  | 'quiz_passed'
  | 'quiz_failed'
  | 'document_expiring'
  | 'document_expired'
  | 'reminder'
  | 'compliance_at_risk'
  | 'btw_session_completed'
  | 'general';

interface NotificationPayload {
  type: NotificationType;
  userId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  
  // Optional overrides
  forceEmail?: boolean;
  forceSms?: boolean;
  forcePush?: boolean;
  
  // Related entities
  assignmentId?: string;
  documentId?: string;
  fleetId?: string;
}

interface NotificationResult {
  inApp: { success: boolean; id?: string; error?: string };
  email: { success: boolean; sent: boolean; error?: string };
  sms: { success: boolean; sent: boolean; error?: string };
  push: { success: boolean; sent: boolean; devices?: number; error?: string };
  webhook: { success: boolean; sent: boolean; error?: string };
}

class NotificationDispatcher {
  /**
   * Send notification across all configured channels based on user preferences
   */
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const result: NotificationResult = {
      inApp: { success: false },
      email: { success: false, sent: false },
      sms: { success: false, sent: false },
      push: { success: false, sent: false },
      webhook: { success: false, sent: false },
    };

    try {
      // Get user preferences
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          preferEmail: true,
          preferSms: true,
          preferPush: true,
          preferredLanguage: true,
          fleetId: true,
        },
      });

      if (!user) {
        return {
          ...result,
          inApp: { success: false, error: 'User not found' },
        };
      }

      const fleetId = payload.fleetId || user.fleetId;

      // 1. Always create in-app notification
      try {
        const notification = await prisma.notification.create({
          data: {
            userId: payload.userId,
            title: payload.title,
            message: payload.message,
            notificationType: payload.type,
            channel: 'IN_APP',
            fleetId,
            relatedAssignmentId: payload.assignmentId,
            actionUrl: payload.data?.actionUrl,
            isSent: true,
            sentAt: new Date(),
          },
        });
        result.inApp = { success: true, id: notification.id };
      } catch (error: any) {
        result.inApp = { success: false, error: error.message };
      }

      // 2. Send email if user prefers it
      if (user.preferEmail || payload.forceEmail) {
        try {
          const emailSent = await emailService.sendEmail({
            to: user.email,
            subject: payload.title,
            html: this.generateEmailHtml(payload.title, payload.message, payload.data?.actionUrl),
            text: `${payload.title}\n\n${payload.message}`,
          });
          result.email = { success: emailSent, sent: true };
        } catch (error: any) {
          result.email = { success: false, sent: true, error: error.message };
        }
      }

      // 3. Send SMS if user prefers it and has phone
      if ((user.preferSms || payload.forceSms) && user.phone) {
        try {
          const smsResult = await smsService.send(
            user.phone,
            `${payload.title}\n\n${payload.message}`
          );
          result.sms = { success: smsResult.success, sent: true, error: smsResult.error };
        } catch (error: any) {
          result.sms = { success: false, sent: true, error: error.message };
        }
      }

      // 4. Send push notification if user prefers it
      if (user.preferPush || payload.forcePush) {
        try {
          const pushResults = await pushNotificationService.sendToUser(payload.userId, {
            title: payload.title,
            body: payload.message,
            data: payload.data ? Object.fromEntries(
              Object.entries(payload.data).map(([k, v]) => [k, String(v)])
            ) : undefined,
            actionUrl: payload.data?.actionUrl,
          });
          result.push = {
            success: pushResults.every(r => r.success),
            sent: true,
            devices: pushResults.length,
          };
        } catch (error: any) {
          result.push = { success: false, sent: true, error: error.message };
        }
      }

      // 5. Dispatch webhook event if applicable
      if (fleetId && this.shouldDispatchWebhook(payload.type)) {
        try {
          const webhookEvent = this.getWebhookEventType(payload.type);
          if (webhookEvent) {
            await eventDispatcher.dispatch({
              event: webhookEvent as any,
              data: {
                userId: payload.userId,
                type: payload.type,
                ...payload.data,
              },
              fleetId,
              userId: payload.userId,
            });
            result.webhook = { success: true, sent: true };
          }
        } catch (error: any) {
          result.webhook = { success: false, sent: true, error: error.message };
        }
      }

      return result;
    } catch (error: any) {
      logError('Notification dispatch error', error);
      return result;
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendToMany(
    userIds: string[],
    payload: Omit<NotificationPayload, 'userId'>
  ): Promise<Map<string, NotificationResult>> {
    const results = new Map<string, NotificationResult>();

    for (const userId of userIds) {
      const result = await this.send({ ...payload, userId });
      results.set(userId, result);
    }

    return results;
  }

  /**
   * Send assignment created notification
   */
  async sendAssignmentCreated(
    userId: string,
    programName: string,
    dueDate: Date | null,
    assignmentId: string
  ): Promise<NotificationResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true, fleetId: true },
    });

    const language = (user?.preferredLanguage || 'en') as SupportedLanguage;
    const { title, body } = getNotificationMessage('assignment_created', language, {
      programName,
      dueDate: dueDate?.toLocaleDateString() || 'No due date',
    });

    return this.send({
      type: 'assignment_created',
      userId,
      title,
      message: body,
      assignmentId,
      fleetId: user?.fleetId || undefined,
      data: {
        programName,
        dueDate: dueDate?.toISOString(),
        actionUrl: `/driver-dashboard`,
      },
    });
  }

  /**
   * Send training due soon notification
   */
  async sendDueSoon(
    userId: string,
    programName: string,
    daysUntilDue: number,
    assignmentId: string
  ): Promise<NotificationResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true, fleetId: true },
    });

    const language = (user?.preferredLanguage || 'en') as SupportedLanguage;
    const { title, body } = getNotificationMessage('assignment_due_soon', language, {
      programName,
      days: daysUntilDue,
    });

    return this.send({
      type: 'assignment_due_soon',
      userId,
      title,
      message: body,
      assignmentId,
      fleetId: user?.fleetId || undefined,
      data: {
        programName,
        daysUntilDue,
        actionUrl: `/driver-dashboard`,
      },
    });
  }

  /**
   * Send overdue notification
   */
  async sendOverdue(
    userId: string,
    programName: string,
    daysOverdue: number,
    assignmentId: string
  ): Promise<NotificationResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true, fleetId: true },
    });

    const language = (user?.preferredLanguage || 'en') as SupportedLanguage;
    const { title, body } = getNotificationMessage('assignment_overdue', language, {
      programName,
      days: daysOverdue,
    });

    return this.send({
      type: 'assignment_overdue',
      userId,
      title,
      message: body,
      assignmentId,
      fleetId: user?.fleetId || undefined,
      forceSms: true, // Always send SMS for overdue
      data: {
        programName,
        daysOverdue,
        actionUrl: `/driver-dashboard`,
      },
    });
  }

  /**
   * Send completion notification
   */
  async sendCompletion(
    userId: string,
    programName: string,
    score: number
  ): Promise<NotificationResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true, fleetId: true },
    });

    const language = (user?.preferredLanguage || 'en') as SupportedLanguage;
    const { title, body } = getNotificationMessage('training_completed', language, {
      programName,
      score,
    });

    return this.send({
      type: 'training_completed',
      userId,
      title,
      message: body,
      fleetId: user?.fleetId || undefined,
      data: {
        programName,
        score,
      },
    });
  }

  /**
   * Send document expiring notification
   */
  async sendDocumentExpiring(
    userId: string,
    documentType: string,
    daysUntilExpiration: number,
    documentId: string
  ): Promise<NotificationResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true, fleetId: true },
    });

    const language = (user?.preferredLanguage || 'en') as SupportedLanguage;
    const { title, body } = getNotificationMessage('document_expiring', language, {
      documentType,
      days: daysUntilExpiration,
    });

    // Force SMS for critical (7 days or less)
    const forceSms = daysUntilExpiration <= 7;

    return this.send({
      type: 'document_expiring',
      userId,
      title,
      message: body,
      documentId,
      fleetId: user?.fleetId || undefined,
      forceSms,
      data: {
        documentType,
        daysUntilExpiration,
        actionUrl: `/documents`,
      },
    });
  }

  /**
   * Send document expired notification
   */
  async sendDocumentExpired(
    userId: string,
    documentType: string,
    documentId: string
  ): Promise<NotificationResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true, fleetId: true },
    });

    const language = (user?.preferredLanguage || 'en') as SupportedLanguage;
    const { title, body } = getNotificationMessage('document_expired', language, {
      documentType,
    });

    return this.send({
      type: 'document_expired',
      userId,
      title,
      message: body,
      documentId,
      fleetId: user?.fleetId || undefined,
      forceSms: true, // Always SMS for expired
      forceEmail: true, // Always email for expired
      data: {
        documentType,
        actionUrl: `/documents`,
      },
    });
  }

  /**
   * Send reminder notification
   */
  async sendReminder(
    userId: string,
    reminderTitle: string,
    reminderDescription: string | null,
    channels: { email?: boolean; sms?: boolean; push?: boolean }
  ): Promise<NotificationResult> {
    return this.send({
      type: 'reminder',
      userId,
      title: `📌 Reminder: ${reminderTitle}`,
      message: reminderDescription || reminderTitle,
      forceEmail: channels.email,
      forceSms: channels.sms,
      forcePush: channels.push,
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private generateEmailHtml(title: string, message: string, actionUrl?: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; }
          .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">DOT Copilot</h1>
          </div>
          <div class="content">
            <h2 style="margin-top: 0;">${title}</h2>
            <p>${message}</p>
            ${actionUrl ? `<a href="${process.env.FRONTEND_URL}${actionUrl}" class="button">View Details</a>` : ''}
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} DOT Copilot. All rights reserved.</p>
            <p>You received this email because you have notifications enabled.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private shouldDispatchWebhook(type: NotificationType): boolean {
    const webhookTypes: NotificationType[] = [
      'assignment_created',
      'assignment_overdue',
      'training_completed',
      'quiz_passed',
      'quiz_failed',
      'document_expiring',
      'document_expired',
      'btw_session_completed',
    ];
    return webhookTypes.includes(type);
  }

  private getWebhookEventType(type: NotificationType): string | null {
    const mapping: Record<NotificationType, string> = {
      assignment_created: 'ASSIGNMENT_CREATED',
      assignment_due_soon: 'ASSIGNMENT_DUE_SOON',
      assignment_overdue: 'ASSIGNMENT_OVERDUE',
      training_completed: 'TRAINING_COMPLETED',
      quiz_passed: 'QUIZ_PASSED',
      quiz_failed: 'QUIZ_FAILED',
      document_expiring: 'DOCUMENT_EXPIRING',
      document_expired: 'DOCUMENT_EXPIRED',
      btw_session_completed: 'BTW_SESSION_COMPLETED',
      reminder: '',
      compliance_at_risk: 'COMPLIANCE_AT_RISK',
      general: '',
    };
    return mapping[type] || null;
  }
}

export const notificationDispatcher = new NotificationDispatcher();
export default notificationDispatcher;
