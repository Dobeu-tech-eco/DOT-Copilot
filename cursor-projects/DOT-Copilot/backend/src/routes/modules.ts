import { logError } from '../services/logger';
import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, createModuleSchema, updateModuleSchema, paginationSchema, validateQuery } from '../schemas';
import { z } from 'zod';
import { assertFleetOwnership, assertRecordInFleet, isPlatformAdmin } from '../middleware/fleetScope';

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

    // SECURITY: Non-admin callers are always confined to their own fleet,
    // regardless of any fleetId query param they pass.
    if (isPlatformAdmin(req.user)) {
      if (fleetId) where.fleetId = fleetId;
    } else {
      where.fleetId = req.user?.fleetId ?? '__NO_FLEET__';
    }

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
    if (!assertFleetOwnership(module, req.user, res, 'Module not found')) {
      return;
    }

    res.json({ data: module });
  } catch (error: any) {
    logError('Get module error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole('ADMIN', 'SUPERVISOR'), validateBody(createModuleSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await validateModuleReferences(req.body.fleetId, req.body.trainingProgramId, req.user, res))) {
      return;
    }

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
    if (!assertFleetOwnership(existing, req.user, res, 'Module not found')) {
      return;
    }

    const targetFleetId = req.body.fleetId ?? existing.fleetId;
    const targetProgramId = req.body.trainingProgramId ?? existing.trainingProgramId;
    if (!(await validateModuleReferences(targetFleetId, targetProgramId, req.user, res))) {
      return;
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
    if (!assertFleetOwnership(existing, req.user, res, 'Module not found')) {
      return;
    }

    await prisma.module.delete({ where: { id } });

    res.json({ message: 'Module deleted successfully' });
  } catch (error: any) {
    logError('Delete module error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function validateModuleReferences(
  fleetId: string,
  trainingProgramId: string,
  user: AuthenticatedRequest['user'],
  res: Response
): Promise<boolean> {
  if (!assertFleetOwnership({ fleetId }, user, res, 'Fleet not found')) {
    return false;
  }

  const program = await prisma.trainingProgram.findUnique({
    where: { id: trainingProgramId },
    select: { fleetId: true },
  });
  return assertRecordInFleet(program, fleetId, res, 'Training program not found');
}

export default router;
