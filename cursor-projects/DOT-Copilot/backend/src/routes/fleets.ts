import { logError } from '../services/logger';
import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, createFleetSchema, updateFleetSchema, paginationSchema, validateQuery } from '../schemas';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(paginationSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit } = req.query as any;
    const skip = (page - 1) * limit;

    const [fleets, total] = await Promise.all([
      prisma.fleet.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.fleet.count(),
    ]);

    res.json({
      data: fleets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logError('Get fleets error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fleet = await prisma.fleet.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: { users: true, trainingPrograms: true },
        },
      },
    });

    if (!fleet) {
      return res.status(404).json({ error: 'Fleet not found' });
    }

    res.json({ data: fleet });
  } catch (error: any) {
    logError('Get fleet error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole('ADMIN'), validateBody(createFleetSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fleet = await prisma.fleet.create({
      data: req.body,
    });

    res.status(201).json({ data: fleet });
  } catch (error: any) {
    logError('Create fleet error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireRole('ADMIN', 'SUPERVISOR'), validateBody(updateFleetSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingFleet = await prisma.fleet.findUnique({ where: { id } });
    if (!existingFleet) {
      return res.status(404).json({ error: 'Fleet not found' });
    }

    const fleet = await prisma.fleet.update({
      where: { id },
      data: req.body,
    });

    res.json({ data: fleet });
  } catch (error: any) {
    logError('Update fleet error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingFleet = await prisma.fleet.findUnique({ where: { id } });
    if (!existingFleet) {
      return res.status(404).json({ error: 'Fleet not found' });
    }

    await prisma.fleet.delete({ where: { id } });

    res.json({ message: 'Fleet deleted successfully' });
  } catch (error: any) {
    logError('Delete fleet error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
