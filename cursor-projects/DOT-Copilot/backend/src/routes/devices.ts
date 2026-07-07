import { logError } from '../services/logger';
import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import pushNotificationService from '../services/pushNotification';
import prisma from '../db';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

const registerDeviceSchema = z.object({
  deviceToken: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
  deviceName: z.string().optional(),
  appVersion: z.string().optional(),
});

/**
 * @swagger
 * /api/devices:
 *   post:
 *     summary: Register a device for push notifications
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceToken
 *               - platform
 *             properties:
 *               deviceToken:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [ios, android, web]
 *               deviceName:
 *                 type: string
 *               appVersion:
 *                 type: string
 *     responses:
 *       200:
 *         description: Device registered successfully
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = registerDeviceSchema.parse(req.body);
    const user = req.user!;

    await pushNotificationService.registerDevice(
      user.userId,
      validated.deviceToken,
      validated.platform,
      validated.deviceName,
      validated.appVersion
    );

    res.json({ message: 'Device registered successfully' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    logError('Register device error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/devices/{token}:
 *   delete:
 *     summary: Unregister a device
 *     tags: [Devices]
 */
router.delete('/:token', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { token } = req.params;
    const user = req.user!;

    // SECURITY: A device token belongs to a single user; only that user
    // (or an admin) may unregister it. Without this check, any
    // authenticated caller could unregister an arbitrary device by guessing
    // or observing its token.
    const device = await prisma.pushDevice.findUnique({ where: { deviceToken: token } });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (device.userId !== user.userId && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await pushNotificationService.unregisterDevice(token);

    res.json({ message: 'Device unregistered successfully' });
  } catch (error: any) {
    logError('Unregister device error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/devices/test:
 *   post:
 *     summary: Send a test push notification to the current user
 *     tags: [Devices]
 */
router.post('/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;

    const results = await pushNotificationService.sendToUser(user.userId, {
      title: 'Test Notification',
      body: 'This is a test push notification from DOT Copilot!',
      data: { type: 'test' },
    });

    res.json({
      message: 'Test notification sent',
      results: results.map(r => ({
        success: r.success,
        error: r.error,
      })),
    });
  } catch (error: any) {
    logError('Test notification error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
