import { logError } from '../services/logger';
import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, createTrainingProgramSchema, updateTrainingProgramSchema, paginationSchema, validateQuery } from '../schemas';
import { z } from 'zod';
import { assertFleetOwnership, isPlatformAdmin } from '../middleware/fleetScope';

const router = Router();

router.use(authenticate);

const querySchema = paginationSchema.extend({
  fleetId: z.string().optional(),
});

router.get('/', validateQuery(querySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit, fleetId } = req.query as any;
    const skip = (page - 1) * limit;

    // SECURITY: Non-admin callers are always confined to their own fleet,
    // regardless of any fleetId query param they pass.
    const where = isPlatformAdmin(req.user)
      ? (fleetId ? { fleetId } : {})
      : { fleetId: req.user?.fleetId ?? '__NO_FLEET__' };

    const [programs, total] = await Promise.all([
      prisma.trainingProgram.findMany({
        where,
        skip,
        take: limit,
        include: {
          fleet: { select: { id: true, companyName: true } },
          _count: { select: { modules: true, assignments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.trainingProgram.count({ where }),
    ]);

    res.json({
      data: programs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logError('Get training programs error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const program = await prisma.trainingProgram.findUnique({
      where: { id: req.params.id },
      include: {
        fleet: true,
        modules: {
          orderBy: { sequenceOrder: 'asc' },
          include: {
            lessons: { orderBy: { sequenceOrder: 'asc' } },
          },
        },
      },
    });

    if (!program) {
      return res.status(404).json({ error: 'Training program not found' });
    }
    if (!assertFleetOwnership(program, req.user, res, 'Training program not found')) {
      return;
    }

    res.json({ data: program });
  } catch (error: any) {
    logError('Get training program error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole('ADMIN', 'SUPERVISOR'), validateBody(createTrainingProgramSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!assertFleetOwnership({ fleetId: req.body.fleetId }, req.user, res, 'Fleet not found')) {
      return;
    }

    const program = await prisma.trainingProgram.create({
      data: req.body,
      include: { fleet: true },
    });

    res.status(201).json({ data: program });
  } catch (error: any) {
    logError('Create training program error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireRole('ADMIN', 'SUPERVISOR'), validateBody(updateTrainingProgramSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.trainingProgram.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Training program not found' });
    }
    if (!assertFleetOwnership(existing, req.user, res, 'Training program not found')) {
      return;
    }
    if (
      req.body.fleetId &&
      !assertFleetOwnership({ fleetId: req.body.fleetId }, req.user, res, 'Fleet not found')
    ) {
      return;
    }

    const program = await prisma.trainingProgram.update({
      where: { id },
      data: req.body,
      include: { fleet: true },
    });

    res.json({ data: program });
  } catch (error: any) {
    logError('Update training program error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.trainingProgram.findUnique({ where: { id } });
    if (!assertFleetOwnership(existing, req.user, res, 'Training program not found')) {
      return;
    }

    await prisma.trainingProgram.delete({ where: { id } });

    res.json({ message: 'Training program deleted successfully' });
  } catch (error: any) {
    logError('Delete training program error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
