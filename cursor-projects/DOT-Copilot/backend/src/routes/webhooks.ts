import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';
import crypto from 'crypto';
import eventDispatcher from '../services/eventDispatcher';

const router = Router();

router.use(authenticate);
router.use(requireRole('ADMIN', 'SUPERVISOR'));

// ============================================
// WEBHOOK EVENT TYPES
// ============================================

const WEBHOOK_EVENT_TYPES = [
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DELETED',
  'ASSIGNMENT_CREATED',
  'ASSIGNMENT_UPDATED',
  'ASSIGNMENT_DUE_SOON',
  'ASSIGNMENT_OVERDUE',
  'TRAINING_STARTED',
  'TRAINING_PROGRESS',
  'TRAINING_COMPLETED',
  'QUIZ_SUBMITTED',
  'QUIZ_PASSED',
  'QUIZ_FAILED',
  'LESSON_COMPLETED',
  'ESIGNATURE_CAPTURED',
  'DOCUMENT_EXPIRING',
  'DOCUMENT_EXPIRED',
  'COMPLIANCE_AT_RISK',
  'COMPLIANCE_EXPIRED',
  'BTW_SESSION_COMPLETED',
] as const;

const webhookSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1),
  secret: z.string().optional(),
  headers: z.record(z.string()).optional(),
  maxRetries: z.number().int().min(0).max(10).default(3),
  retryDelayMs: z.number().int().min(100).max(60000).default(1000),
  isActive: z.boolean().default(true),
});

/**
 * @swagger
 * /api/webhooks/events:
 *   get:
 *     summary: List all available webhook event types
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of event types with descriptions
 */
router.get('/events', (req: AuthenticatedRequest, res: Response) => {
  const eventDescriptions = {
    USER_CREATED: 'Triggered when a new user is created',
    USER_UPDATED: 'Triggered when a user profile is updated',
    USER_DELETED: 'Triggered when a user is deleted',
    ASSIGNMENT_CREATED: 'Triggered when a new training is assigned',
    ASSIGNMENT_UPDATED: 'Triggered when an assignment is updated',
    ASSIGNMENT_DUE_SOON: 'Triggered when an assignment is due within 7 days',
    ASSIGNMENT_OVERDUE: 'Triggered when an assignment becomes overdue',
    TRAINING_STARTED: 'Triggered when a user starts a training',
    TRAINING_PROGRESS: 'Triggered when training progress is updated',
    TRAINING_COMPLETED: 'Triggered when a training is completed',
    QUIZ_SUBMITTED: 'Triggered when a quiz is submitted',
    QUIZ_PASSED: 'Triggered when a user passes a quiz',
    QUIZ_FAILED: 'Triggered when a user fails a quiz',
    LESSON_COMPLETED: 'Triggered when a lesson is completed',
    ESIGNATURE_CAPTURED: 'Triggered when an e-signature is captured',
    DOCUMENT_EXPIRING: 'Triggered when a document is expiring soon',
    DOCUMENT_EXPIRED: 'Triggered when a document has expired',
    COMPLIANCE_AT_RISK: 'Triggered when compliance status becomes at-risk',
    COMPLIANCE_EXPIRED: 'Triggered when a compliance requirement expires',
    BTW_SESSION_COMPLETED: 'Triggered when a behind-the-wheel session is completed',
  };

  res.json({
    data: WEBHOOK_EVENT_TYPES.map(event => ({
      event,
      description: eventDescriptions[event],
    })),
  });
});

/**
 * @swagger
 * /api/webhooks:
 *   get:
 *     summary: List all webhooks for the fleet
 *     tags: [Webhooks]
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;

    const webhooks = await prisma.webhook.findMany({
      where: {
        fleetId: user.fleetId ?? undefined,
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { deliveries: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Hide secrets in response
    const sanitizedWebhooks = webhooks.map(w => ({
      ...w,
      secret: w.secret ? '••••••••' : null,
    }));

    res.json({ data: sanitizedWebhooks });
  } catch (error: any) {
    console.error('Get webhooks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/webhooks/{id}:
 *   get:
 *     summary: Get a specific webhook
 *     tags: [Webhooks]
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const webhook = await prisma.webhook.findFirst({
      where: {
        id,
        fleetId: user.fleetId ?? undefined,
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({
      data: {
        ...webhook,
        secret: webhook.secret ? '••••••••' : null,
      },
    });
  } catch (error: any) {
    console.error('Get webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/webhooks:
 *   post:
 *     summary: Create a new webhook
 *     tags: [Webhooks]
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = webhookSchema.parse(req.body);
    const user = req.user!;

    // Generate secret if not provided
    const secret = validated.secret || crypto.randomBytes(32).toString('hex');

    const webhook = await prisma.webhook.create({
      data: {
        ...validated,
        secret,
        fleetId: user.fleetId!,
        createdBy: user.userId,
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.status(201).json({
      data: webhook,
      message: 'Webhook created successfully. Save the secret - it will not be shown again.',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/webhooks/{id}:
 *   put:
 *     summary: Update a webhook
 *     tags: [Webhooks]
 */
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validated = webhookSchema.partial().parse(req.body);
    const user = req.user!;

    // Don't allow updating secret directly - use regenerate endpoint
    delete (validated as any).secret;

    const webhook = await prisma.webhook.updateMany({
      where: {
        id,
        fleetId: user.fleetId ?? undefined,
      },
      data: validated,
    });

    if (webhook.count === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const updated = await prisma.webhook.findUnique({
      where: { id },
    });

    res.json({
      data: {
        ...updated,
        secret: updated?.secret ? '••••••••' : null,
      },
    });
  } catch (error: any) {
    console.error('Update webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/webhooks/{id}:
 *   delete:
 *     summary: Delete a webhook
 *     tags: [Webhooks]
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const result = await prisma.webhook.deleteMany({
      where: {
        id,
        fleetId: user.fleetId ?? undefined,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ message: 'Webhook deleted successfully' });
  } catch (error: any) {
    console.error('Delete webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/webhooks/{id}/regenerate-secret:
 *   post:
 *     summary: Regenerate webhook secret
 *     tags: [Webhooks]
 */
router.post('/:id/regenerate-secret', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const newSecret = crypto.randomBytes(32).toString('hex');

    const result = await prisma.webhook.updateMany({
      where: {
        id,
        fleetId: user.fleetId ?? undefined,
      },
      data: {
        secret: newSecret,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({
      data: { secret: newSecret },
      message: 'Secret regenerated. Save this - it will not be shown again.',
    });
  } catch (error: any) {
    console.error('Regenerate secret error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/webhooks/{id}/test:
 *   post:
 *     summary: Send a test webhook
 *     tags: [Webhooks]
 */
router.post('/:id/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const webhook = await prisma.webhook.findFirst({
      where: {
        id,
        fleetId: user.fleetId ?? undefined,
      },
    });

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Send test event
    const testPayload = {
      event: 'test',
      data: {
        message: 'This is a test webhook from DOT Copilot',
        timestamp: new Date().toISOString(),
        webhookId: webhook.id,
        fleetId: webhook.fleetId,
      },
      timestamp: new Date().toISOString(),
    };

    const startTime = Date.now();
    let success = false;
    let statusCode: number | undefined;
    let responseBody: string | undefined;
    let error: string | undefined;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': 'test',
        'X-Webhook-Delivery-Id': `test-${Date.now()}`,
        ...(webhook.headers as Record<string, string> || {}),
      };

      if (webhook.secret) {
        // Generate signature
        const hmac = crypto.createHmac('sha256', webhook.secret);
        hmac.update(JSON.stringify(testPayload));
        headers['X-Webhook-Signature'] = `sha256=${hmac.digest('hex')}`;
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      });

      statusCode = response.status;
      responseBody = await response.text();
      success = response.ok;
    } catch (err: any) {
      error = err.message;
    }

    const responseTimeMs = Date.now() - startTime;

    res.json({
      data: {
        success,
        statusCode,
        responseTimeMs,
        responseBody: responseBody?.substring(0, 500),
        error,
      },
    });
  } catch (error: any) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/webhooks/{id}/deliveries:
 *   get:
 *     summary: Get webhook delivery history
 *     tags: [Webhooks]
 */
router.get('/:id/deliveries', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Verify webhook belongs to fleet
    const webhook = await prisma.webhook.findFirst({
      where: {
        id,
        fleetId: user.fleetId ?? undefined,
      },
    });

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const [deliveries, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where: { webhookId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.webhookDelivery.count({
        where: { webhookId: id },
      }),
    ]);

    res.json({
      data: deliveries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Get deliveries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/webhooks/{id}/toggle:
 *   post:
 *     summary: Toggle webhook active status
 *     tags: [Webhooks]
 */
router.post('/:id/toggle', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const webhook = await prisma.webhook.findFirst({
      where: {
        id,
        fleetId: user.fleetId ?? undefined,
      },
    });

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const updated = await prisma.webhook.update({
      where: { id },
      data: {
        isActive: !webhook.isActive,
      },
    });

    res.json({
      data: {
        ...updated,
        secret: '••••••••',
      },
      message: `Webhook ${updated.isActive ? 'activated' : 'deactivated'}`,
    });
  } catch (error: any) {
    console.error('Toggle webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
