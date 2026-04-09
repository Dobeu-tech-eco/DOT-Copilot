import { logError } from '../services/logger';
import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, createTrainingProgramSchema, updateTrainingProgramSchema, paginationSchema, validateQuery } from '../schemas';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

const querySchema = paginationSchema.extend({
  fleetId: z.string().optional(),
});

router.get('/', validateQuery(querySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit, fleetId } = req.query as any;
    const skip = (page - 1) * limit;

    const where = fleetId ? { fleetId } : {};

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

    res.json({ data: program });
  } catch (error: any) {
    logError('Get training program error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole('ADMIN', 'SUPERVISOR'), validateBody(createTrainingProgramSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
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
    if (!existing) {
      return res.status(404).json({ error: 'Training program not found' });
    }

    await prisma.trainingProgram.delete({ where: { id } });

    res.json({ message: 'Training program deleted successfully' });
  } catch (error: any) {
    logError('Delete training program error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
