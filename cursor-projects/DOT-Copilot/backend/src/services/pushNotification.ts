/**
 * Push Notification Service
 * Supports Firebase Cloud Messaging (FCM) for Android and Web
 * Supports Apple Push Notification Service (APNs) for iOS
 */

import prisma from '../db';
import { getNotificationMessage, SupportedLanguage } from './i18n';
import { logError } from './logger';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  actionUrl?: string;
}

interface SendResult {
  success: boolean;
  deviceToken: string;
  error?: string;
}

class PushNotificationService {
  private fcmServerKey: string | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    this.fcmServerKey = process.env.FCM_SERVER_KEY || null;
    
    if (this.fcmServerKey) {
      this.isConfigured = true;
      console.log('Push notification service configured (FCM)');
    } else {
      console.warn('Push notification service not configured - notifications will be logged');
    }
  }

  /**
   * Check if push notifications are configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Register a device for push notifications
   */
  async registerDevice(
    userId: string,
    deviceToken: string,
    platform: 'ios' | 'android' | 'web',
    deviceName?: string,
    appVersion?: string
  ): Promise<void> {
    await prisma.pushDevice.upsert({
      where: { deviceToken },
      update: {
        userId,
        platform,
        deviceName,
        appVersion,
        isActive: true,
        lastUsedAt: new Date(),
      },
      create: {
        userId,
        deviceToken,
        platform,
        deviceName,
        appVersion,
        isActive: true,
      },
    });
  }

  /**
   * Unregister a device
   */
  async unregisterDevice(deviceToken: string): Promise<void> {
    await prisma.pushDevice.updateMany({
      where: { deviceToken },
      data: { isActive: false },
    });
  }

  /**
   * Send push notification to a specific user
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<SendResult[]> {
    const devices = await prisma.pushDevice.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    if (devices.length === 0) {
      return [];
    }

    const results: SendResult[] = [];

    for (const device of devices) {
      const result = await this.sendToDevice(device.deviceToken, device.platform, payload);
      results.push({
        success: result.success,
        deviceToken: device.deviceToken,
        error: result.error,
      });

      // Update last used
      if (result.success) {
        await prisma.pushDevice.update({
          where: { id: device.id },
          data: { lastUsedAt: new Date() },
        });
      } else if (result.error?.includes('NotRegistered') || result.error?.includes('InvalidRegistration')) {
        // Device no longer valid, mark as inactive
        await prisma.pushDevice.update({
          where: { id: device.id },
          data: { isActive: false },
        });
      }
    }

    return results;
  }

  /**
   * Send push notification to a specific device
   */
  async sendToDevice(
    deviceToken: string,
    platform: string,
    payload: PushPayload
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured) {
      // Log instead of sending
      console.log('=== Push Notification (not sent - FCM not configured) ===');
      console.log(`Device: ${deviceToken} (${platform})`);
      console.log(`Title: ${payload.title}`);
      console.log(`Body: ${payload.body}`);
      console.log(`Data: ${JSON.stringify(payload.data)}`);
      console.log('=========================================================');
      return { success: true };
    }

    try {
      const message = {
        to: deviceToken,
        notification: {
          title: payload.title,
          body: payload.body,
          image: payload.imageUrl,
          click_action: payload.actionUrl,
        },
        data: payload.data || {},
        // Android specific
        android: {
          priority: 'high' as const,
          notification: {
            sound: 'default',
            click_action: payload.actionUrl,
          },
        },
        // iOS specific
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${this.fcmServerKey}`,
        },
        body: JSON.stringify(message),
      });

      const result = await response.json() as { success?: number; results?: Array<{ error?: string }> };

      if (result.success === 1) {
        return { success: true };
      } else {
        return {
          success: false,
          error: result.results?.[0]?.error || 'Unknown FCM error',
        };
      }
    } catch (error: any) {
      logError('FCM send error', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notification to multiple users
   */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<Map<string, SendResult[]>> {
    const results = new Map<string, SendResult[]>();

    for (const userId of userIds) {
      const userResults = await this.sendToUser(userId, payload);
      results.set(userId, userResults);
    }

    return results;
  }

  /**
   * Send localized notification to user based on their language preference
   */
  async sendLocalizedToUser(
    userId: string,
    templateKey: 'assignment_created' | 'assignment_due_soon' | 'assignment_overdue' | 
                 'training_completed' | 'document_expiring' | 'document_expired',
    vars: Record<string, string | number>,
    data?: Record<string, string>
  ): Promise<SendResult[]> {
    // Get user's preferred language
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true },
    });

    const language = (user?.preferredLanguage || 'en') as SupportedLanguage;
    const { title, body } = getNotificationMessage(templateKey, language, vars);

    return this.sendToUser(userId, { title, body, data });
  }

  /**
   * Send assignment notification
   */
  async sendAssignmentNotification(
    userId: string,
    programName: string,
    dueDate: Date | null,
    assignmentId: string
  ): Promise<SendResult[]> {
    return this.sendLocalizedToUser(
      userId,
      'assignment_created',
      {
        programName,
        dueDate: dueDate ? dueDate.toLocaleDateString() : 'No due date',
      },
      {
        type: 'assignment',
        assignmentId,
      }
    );
  }

  /**
   * Send training due soon notification
   */
  async sendDueSoonNotification(
    userId: string,
    programName: string,
    daysUntilDue: number,
    assignmentId: string
  ): Promise<SendResult[]> {
    return this.sendLocalizedToUser(
      userId,
      'assignment_due_soon',
      {
        programName,
        days: daysUntilDue,
      },
      {
        type: 'due_soon',
        assignmentId,
      }
    );
  }

  /**
   * Send overdue notification
   */
  async sendOverdueNotification(
    userId: string,
    programName: string,
    daysOverdue: number,
    assignmentId: string
  ): Promise<SendResult[]> {
    return this.sendLocalizedToUser(
      userId,
      'assignment_overdue',
      {
        programName,
        days: daysOverdue,
      },
      {
        type: 'overdue',
        assignmentId,
      }
    );
  }

  /**
   * Send completion notification
   */
  async sendCompletionNotification(
    userId: string,
    programName: string,
    score: number
  ): Promise<SendResult[]> {
    return this.sendLocalizedToUser(
      userId,
      'training_completed',
      {
        programName,
        score,
      },
      {
        type: 'completion',
      }
    );
  }

  /**
   * Send document expiring notification
   */
  async sendDocumentExpiringNotification(
    userId: string,
    documentType: string,
    daysUntilExpiration: number,
    documentId: string
  ): Promise<SendResult[]> {
    return this.sendLocalizedToUser(
      userId,
      'document_expiring',
      {
        documentType,
        days: daysUntilExpiration,
      },
      {
        type: 'document_expiring',
        documentId,
      }
    );
  }

  /**
   * Send document expired notification
   */
  async sendDocumentExpiredNotification(
    userId: string,
    documentType: string,
    documentId: string
  ): Promise<SendResult[]> {
    return this.sendLocalizedToUser(
      userId,
      'document_expired',
      {
        documentType,
      },
      {
        type: 'document_expired',
        documentId,
      }
    );
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
