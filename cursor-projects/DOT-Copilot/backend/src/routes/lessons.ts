import { logError } from '../services/logger';
import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, createLessonSchema, updateLessonSchema, paginationSchema, validateQuery } from '../schemas';
import { z } from 'zod';
import { assertFleetOwnership, assertRecordInFleet, isPlatformAdmin } from '../middleware/fleetScope';

const router = Router();

router.use(authenticate);

const querySchema = paginationSchema.extend({
  moduleId: z.string().optional(),
  fleetId: z.string().optional(),
});

router.get('/', validateQuery(querySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit, moduleId, fleetId } = req.query as any;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (moduleId) where.moduleId = moduleId;

    // SECURITY: Non-admin callers are always confined to their own fleet,
    // regardless of any fleetId query param they pass.
    if (isPlatformAdmin(req.user)) {
      if (fleetId) where.fleetId = fleetId;
    } else {
      where.fleetId = req.user?.fleetId ?? '__NO_FLEET__';
    }

    const [lessons, total] = await Promise.all([
      prisma.lesson.findMany({
        where,
        skip,
        take: limit,
        include: {
          module: { select: { id: true, moduleName: true } },
          _count: { select: { quizQuestions: true } },
        },
        orderBy: { sequenceOrder: 'asc' },
      }),
      prisma.lesson.count({ where }),
    ]);

    res.json({
      data: lessons,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logError('Get lessons error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: {
        module: true,
        fleet: true,
        quizQuestions: {
          orderBy: { sequenceOrder: 'asc' },
        },
      },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    if (!assertFleetOwnership(lesson, req.user, res, 'Lesson not found')) {
      return;
    }

    res.json({ data: lesson });
  } catch (error: any) {
    logError('Get lesson error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole('ADMIN', 'SUPERVISOR'), validateBody(createLessonSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await validateLessonReferences(req.body.fleetId, req.body.moduleId, req.user, res))) {
      return;
    }

    const lesson = await prisma.lesson.create({
      data: req.body,
      include: {
        module: true,
      },
    });

    res.status(201).json({ data: lesson });
  } catch (error: any) {
    logError('Create lesson error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireRole('ADMIN', 'SUPERVISOR'), validateBody(updateLessonSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.lesson.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    if (!assertFleetOwnership(existing, req.user, res, 'Lesson not found')) {
      return;
    }

    const targetFleetId = req.body.fleetId ?? existing.fleetId;
    const targetModuleId = req.body.moduleId ?? existing.moduleId;
    if (!(await validateLessonReferences(targetFleetId, targetModuleId, req.user, res))) {
      return;
    }

    const lesson = await prisma.lesson.update({
      where: { id },
      data: req.body,
      include: {
        module: true,
      },
    });

    res.json({ data: lesson });
  } catch (error: any) {
    logError('Update lesson error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.lesson.findUnique({ where: { id } });
    if (!assertFleetOwnership(existing, req.user, res, 'Lesson not found')) {
      return;
    }

    await prisma.lesson.delete({ where: { id } });

    res.json({ message: 'Lesson deleted successfully' });
  } catch (error: any) {
    logError('Delete lesson error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function validateLessonReferences(
  fleetId: string,
  moduleId: string,
  user: AuthenticatedRequest['user'],
  res: Response
): Promise<boolean> {
  if (!assertFleetOwnership({ fleetId }, user, res, 'Fleet not found')) {
    return false;
  }

  const module = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { fleetId: true },
  });
  return assertRecordInFleet(module, fleetId, res, 'Module not found');
}

export default router;
