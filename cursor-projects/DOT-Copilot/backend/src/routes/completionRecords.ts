import { logError } from '../services/logger';
import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, createCompletionRecordSchema, paginationSchema, validateQuery } from '../schemas';
import { z } from 'zod';
import {
  assertFleetOwnership,
  assertRecordInFleet,
  isPlatformAdmin,
} from '../middleware/fleetScope';

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

    // SECURITY: Non-admin callers are always confined to their own fleet.
    if (!isPlatformAdmin(req.user)) {
      where.fleetId = req.user?.fleetId ?? '__NO_FLEET__';
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

    const references = await validateCompletionReferences(req.body, req.user, res);
    if (!references) {
      return;
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

    // Update the assignment only after all references have been authorized.
    if (req.body.assignmentId) {
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

    // SECURITY: Non-drivers may only view completion records within their own fleet.
    if (req.user?.role !== 'DRIVER' && !assertFleetOwnership(record, req.user, res, 'Completion record not found')) {
      return;
    }

    res.json({ data: record });
  } catch (error: any) {
    logError('Get completion record error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function validateCompletionReferences(
  data: {
    userId: string;
    fleetId: string;
    lessonId?: string;
    moduleId?: string;
    assignmentId?: string;
  },
  user: AuthenticatedRequest['user'],
  res: Response
): Promise<boolean> {
  if (!assertFleetOwnership({ fleetId: data.fleetId }, user, res, 'Fleet not found')) {
    return false;
  }

  const [targetUser, lesson, module, assignment] = await Promise.all([
    prisma.user.findUnique({ where: { id: data.userId }, select: { fleetId: true } }),
    data.lessonId
      ? prisma.lesson.findUnique({ where: { id: data.lessonId }, select: { fleetId: true } })
      : Promise.resolve(null),
    data.moduleId
      ? prisma.module.findUnique({ where: { id: data.moduleId }, select: { fleetId: true } })
      : Promise.resolve(null),
    data.assignmentId
      ? prisma.assignment.findUnique({
          where: { id: data.assignmentId },
          select: { fleetId: true, userId: true },
        })
      : Promise.resolve(null),
  ]);

  if (!assertRecordInFleet(targetUser, data.fleetId, res, 'User not found')) {
    return false;
  }
  if (data.lessonId && !assertRecordInFleet(lesson, data.fleetId, res, 'Lesson not found')) {
    return false;
  }
  if (data.moduleId && !assertRecordInFleet(module, data.fleetId, res, 'Module not found')) {
    return false;
  }
  if (data.assignmentId) {
    if (!assertRecordInFleet(assignment, data.fleetId, res, 'Assignment not found')) {
      return false;
    }
    if (assignment!.userId !== data.userId) {
      res.status(404).json({ error: 'Assignment not found' });
      return false;
    }
  }

  return true;
}

export default router;
