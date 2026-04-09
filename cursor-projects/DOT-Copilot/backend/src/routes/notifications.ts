import { logError } from '../services/logger';
import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { paginationSchema, validateQuery } from '../schemas';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

const querySchema = paginationSchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
});

router.get('/', validateQuery(querySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit, unreadOnly } = req.query as any;
    const skip = (page - 1) * limit;

    const where: any = {
      userId: req.user!.userId,
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        include: {
          relatedAssignment: {
            select: { id: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: req.user!.userId, isRead: false },
      }),
    ]);

    res.json({
      data: notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logError('Get notifications error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/read', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ data: updated });
  } catch (error: any) {
    logError('Mark notification read error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/read-all', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    logError('Mark all read error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
