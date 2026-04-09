import { logError } from '../services/logger';
import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

const reminderSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  reminderDate: z.string().datetime(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), // "HH:MM"
  isRecurring: z.boolean().default(false),
  recurrence: z.enum(['daily', 'weekly', 'monthly']).optional(),
  recurrenceEnd: z.string().datetime().optional(),
  userId: z.string().optional(), // If setting for another user
  notifyEmail: z.boolean().default(false),
  notifySms: z.boolean().default(false),
  notifyPush: z.boolean().default(true),
});

/**
 * @swagger
 * /api/reminders:
 *   get:
 *     summary: Get all reminders for current user
 *     tags: [Reminders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeCompleted
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user (supervisors only)
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { includeCompleted, userId } = req.query;

    const where: any = {};

    // Drivers see their own, supervisors can see by userId
    if (user.role === 'DRIVER') {
      where.userId = user.userId;
    } else if (userId) {
      where.userId = userId;
    } else {
      // Supervisor sees reminders they created or are for users in their fleet
      where.OR = [
        { createdBy: user.userId },
        { userId: user.userId },
      ];
    }

    if (!includeCompleted || includeCompleted === 'false') {
      where.isCompleted = false;
    }

    const reminders = await prisma.reminder.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { reminderDate: 'asc' },
    });

    res.json({ data: reminders });
  } catch (error: any) {
    logError('Get reminders error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/reminders/upcoming:
 *   get:
 *     summary: Get upcoming reminders for the next 7 days
 *     tags: [Reminders]
 */
router.get('/upcoming', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const days = parseInt(req.query.days as string) || 7;
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const reminders = await prisma.reminder.findMany({
      where: {
        userId: user.userId,
        isCompleted: false,
        reminderDate: {
          gte: now,
          lte: futureDate,
        },
      },
      orderBy: { reminderDate: 'asc' },
    });

    // Group by date
    const grouped = reminders.reduce((acc, reminder) => {
      const dateKey = new Date(reminder.reminderDate).toDateString();
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(reminder);
      return acc;
    }, {} as Record<string, typeof reminders>);

    res.json({
      data: reminders,
      grouped,
      count: reminders.length,
    });
  } catch (error: any) {
    logError('Get upcoming reminders error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/reminders/{id}:
 *   get:
 *     summary: Get a specific reminder
 *     tags: [Reminders]
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const reminder = await prisma.reminder.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    // Check access
    if (user.role === 'DRIVER' && reminder.userId !== user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ data: reminder });
  } catch (error: any) {
    logError('Get reminder error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/reminders:
 *   post:
 *     summary: Create a new reminder
 *     tags: [Reminders]
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = reminderSchema.parse(req.body);
    const user = req.user!;

    // Determine target user
    let targetUserId = user.userId;
    if (validated.userId && validated.userId !== user.userId) {
      // Only supervisors and above can set reminders for others
      if (user.role === 'DRIVER') {
        return res.status(403).json({ error: 'Cannot set reminders for other users' });
      }
      targetUserId = validated.userId;
    }

    const reminder = await prisma.reminder.create({
      data: {
        title: validated.title,
        description: validated.description,
        reminderDate: new Date(validated.reminderDate),
        reminderTime: validated.reminderTime,
        isRecurring: validated.isRecurring,
        recurrence: validated.recurrence,
        recurrenceEnd: validated.recurrenceEnd ? new Date(validated.recurrenceEnd) : null,
        userId: targetUserId,
        createdBy: user.userId,
        notifyEmail: validated.notifyEmail,
        notifySms: validated.notifySms,
        notifyPush: validated.notifyPush,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.status(201).json({ data: reminder });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logError('Create reminder error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/reminders/{id}:
 *   put:
 *     summary: Update a reminder
 *     tags: [Reminders]
 */
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validated = reminderSchema.partial().parse(req.body);
    const user = req.user!;

    const existing = await prisma.reminder.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    // Check permissions
    if (user.role === 'DRIVER' && existing.userId !== user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const reminder = await prisma.reminder.update({
      where: { id },
      data: {
        title: validated.title,
        description: validated.description,
        reminderDate: validated.reminderDate ? new Date(validated.reminderDate) : undefined,
        reminderTime: validated.reminderTime,
        isRecurring: validated.isRecurring,
        recurrence: validated.recurrence,
        recurrenceEnd: validated.recurrenceEnd ? new Date(validated.recurrenceEnd) : undefined,
        notifyEmail: validated.notifyEmail,
        notifySms: validated.notifySms,
        notifyPush: validated.notifyPush,
      },
    });

    res.json({ data: reminder });
  } catch (error: any) {
    logError('Update reminder error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/reminders/{id}:
 *   delete:
 *     summary: Delete a reminder
 *     tags: [Reminders]
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const existing = await prisma.reminder.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    // Check permissions - can delete if owner or creator
    if (user.role === 'DRIVER' && existing.userId !== user.userId && existing.createdBy !== user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.reminder.delete({
      where: { id },
    });

    res.json({ message: 'Reminder deleted successfully' });
  } catch (error: any) {
    logError('Delete reminder error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/reminders/{id}/complete:
 *   post:
 *     summary: Mark a reminder as complete
 *     tags: [Reminders]
 */
router.post('/:id/complete', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const existing = await prisma.reminder.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    // Only the user the reminder is for can complete it
    if (existing.userId !== user.userId) {
      return res.status(403).json({ error: 'Only the reminder recipient can complete it' });
    }

    const reminder = await prisma.reminder.update({
      where: { id },
      data: {
        isCompleted: true,
        completedAt: new Date(),
      },
    });

    // If recurring, create the next occurrence
    if (existing.isRecurring && existing.recurrence) {
      const nextDate = calculateNextOccurrence(existing.reminderDate, existing.recurrence);
      
      // Only create if before recurrence end date
      if (!existing.recurrenceEnd || nextDate <= existing.recurrenceEnd) {
        await prisma.reminder.create({
          data: {
            title: existing.title,
            description: existing.description,
            reminderDate: nextDate,
            reminderTime: existing.reminderTime,
            isRecurring: existing.isRecurring,
            recurrence: existing.recurrence,
            recurrenceEnd: existing.recurrenceEnd,
            userId: existing.userId,
            createdBy: existing.createdBy,
            notifyEmail: existing.notifyEmail,
            notifySms: existing.notifySms,
            notifyPush: existing.notifyPush,
          },
        });
      }
    }

    res.json({ data: reminder, message: 'Reminder completed' });
  } catch (error: any) {
    logError('Complete reminder error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/reminders/{id}/snooze:
 *   post:
 *     summary: Snooze a reminder
 *     tags: [Reminders]
 */
router.post('/:id/snooze', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { minutes = 30 } = req.body;
    const user = req.user!;

    const existing = await prisma.reminder.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    if (existing.userId !== user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000);

    const reminder = await prisma.reminder.update({
      where: { id },
      data: {
        isSnoozed: true,
        snoozedUntil,
      },
    });

    res.json({ data: reminder, message: `Snoozed for ${minutes} minutes` });
  } catch (error: any) {
    logError('Snooze reminder error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateNextOccurrence(currentDate: Date, recurrence: string): Date {
  const next = new Date(currentDate);
  
  switch (recurrence) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
  }
  
  return next;
}

export default router;
