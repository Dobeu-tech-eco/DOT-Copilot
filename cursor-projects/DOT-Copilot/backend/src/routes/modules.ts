import { logError } from '../services/logger';
import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, createModuleSchema, updateModuleSchema, paginationSchema, validateQuery } from '../schemas';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

const querySchema = paginationSchema.extend({
  fleetId: z.string().optional(),
  trainingProgramId: z.string().optional(),
});

router.get('/', validateQuery(querySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit, fleetId, trainingProgramId } = req.query as any;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (fleetId) where.fleetId = fleetId;
    if (trainingProgramId) where.trainingProgramId = trainingProgramId;

    const [modules, total] = await Promise.all([
      prisma.module.findMany({
        where,
        skip,
        take: limit,
        include: {
          fleet: { select: { id: true, companyName: true } },
          trainingProgram: { select: { id: true, programName: true } },
          _count: { select: { lessons: true } },
        },
        orderBy: { sequenceOrder: 'asc' },
      }),
      prisma.module.count({ where }),
    ]);

    res.json({
      data: modules,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logError('Get modules error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const module = await prisma.module.findUnique({
      where: { id: req.params.id },
      include: {
        fleet: true,
        trainingProgram: true,
        lessons: {
          orderBy: { sequenceOrder: 'asc' },
        },
      },
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    res.json({ data: module });
  } catch (error: any) {
    logError('Get module error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole('ADMIN', 'SUPERVISOR'), validateBody(createModuleSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const module = await prisma.module.create({
      data: req.body,
      include: {
        fleet: true,
        trainingProgram: true,
      },
    });

    res.status(201).json({ data: module });
  } catch (error: any) {
    logError('Create module error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireRole('ADMIN', 'SUPERVISOR'), validateBody(updateModuleSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.module.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const module = await prisma.module.update({
      where: { id },
      data: req.body,
      include: {
        fleet: true,
        trainingProgram: true,
      },
    });

    res.json({ data: module });
  } catch (error: any) {
    logError('Update module error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.module.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Module not found' });
    }

    await prisma.module.delete({ where: { id } });

    res.json({ message: 'Module deleted successfully' });
  } catch (error: any) {
    logError('Delete module error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
