import { logError } from '../services/logger';
import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, createCompletionRecordSchema, paginationSchema, validateQuery } from '../schemas';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

const querySchema = paginationSchema.extend({
  userId: z.string().optional(),
  lessonId: z.string().optional(),
  moduleId: z.string().optional(),
});

router.get('/', validateQuery(querySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit, userId, lessonId, moduleId } = req.query as any;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Non-admin users can only see their own records
    if (req.user?.role === 'DRIVER') {
      where.userId = req.user.userId;
    } else if (userId) {
      where.userId = userId;
    }

    if (lessonId) where.lessonId = lessonId;
    if (moduleId) where.moduleId = moduleId;

    const [records, total] = await Promise.all([
      prisma.completionRecord.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          lesson: { select: { id: true, lessonName: true } },
          module: { select: { id: true, moduleName: true } },
        },
        orderBy: { completedDate: 'desc' },
      }),
      prisma.completionRecord.count({ where }),
    ]);

    res.json({
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logError('Get completion records error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', validateBody(createCompletionRecordSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Drivers can only create records for themselves
    if (req.user?.role === 'DRIVER' && req.body.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const record = await prisma.completionRecord.create({
      data: {
        ...req.body,
        esignatureTimestamp: req.body.esignature ? new Date() : undefined,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        lesson: true,
        module: true,
      },
    });

    // Update assignment status if applicable
    // SECURITY: Verify assignment belongs to the authenticated user before updating
    if (req.body.assignmentId) {
      const assignment = await prisma.assignment.findUnique({
        where: { id: req.body.assignmentId },
        select: { userId: true },
      });

      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      // Drivers can only complete their own assignments
      if (req.user?.role === 'DRIVER' && assignment.userId !== req.user.userId) {
        return res.status(403).json({ error: 'Cannot complete assignment belonging to another user' });
      }

      await prisma.assignment.update({
        where: { id: req.body.assignmentId },
        data: { status: 'completed' },
      });
    }

    res.status(201).json({ data: record });
  } catch (error: any) {
    logError('Create completion record error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const record = await prisma.completionRecord.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        lesson: true,
        module: true,
        quizResponses: {
          include: { quizQuestion: true },
        },
      },
    });

    if (!record) {
      return res.status(404).json({ error: 'Completion record not found' });
    }

    // Check access for drivers
    if (req.user?.role === 'DRIVER' && record.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ data: record });
  } catch (error: any) {
    logError('Get completion record error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
