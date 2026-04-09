import { logError } from '../services/logger';
import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, createAssignmentSchema, updateAssignmentSchema, paginationSchema, validateQuery } from '../schemas';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

const querySchema = paginationSchema.extend({
  userId: z.string().optional(),
  fleetId: z.string().optional(),
  status: z.string().optional(),
});

router.get('/', validateQuery(querySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit, userId, fleetId, status } = req.query as any;
    const skip = (page - 1) * limit;

    const where: any = {};
    
    // Non-admin users can only see their own assignments
    if (req.user?.role === 'DRIVER') {
      where.userId = req.user.userId;
    } else if (userId) {
      where.userId = userId;
    }
    
    if (fleetId) where.fleetId = fleetId;
    if (status) where.status = status;

    const [assignments, total] = await Promise.all([
      prisma.assignment.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          fleet: { select: { id: true, companyName: true } },
          module: { select: { id: true, moduleName: true } },
          trainingProgram: { select: { id: true, programName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.assignment.count({ where }),
    ]);

    res.json({
      data: assignments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logError('Get assignments error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        fleet: true,
        module: true,
        trainingProgram: true,
        completionRecords: true,
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check access for drivers
    if (req.user?.role === 'DRIVER' && assignment.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ data: assignment });
  } catch (error: any) {
    logError('Get assignment error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole('ADMIN', 'SUPERVISOR'), validateBody(createAssignmentSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const assignment = await prisma.assignment.create({
      data: req.body,
      include: {
        user: { select: { id: true, name: true, email: true } },
        fleet: true,
        module: true,
        trainingProgram: true,
      },
    });

    // Create notification for the assigned user
    await prisma.notification.create({
      data: {
        message: `You have been assigned a new training: ${assignment.trainingProgram?.programName || assignment.module?.moduleName || 'Training'}`,
        notificationType: 'ASSIGNMENT',
        userId: assignment.userId,
        fleetId: assignment.fleetId,
        relatedAssignmentId: assignment.id,
      },
    });

    res.status(201).json({ data: assignment });
  } catch (error: any) {
    logError('Create assignment error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', validateBody(updateAssignmentSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.assignment.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Drivers can only update status of their own assignments
    if (req.user?.role === 'DRIVER') {
      if (existing.userId !== req.user.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      // Drivers can only update status
      const { status } = req.body;
      if (Object.keys(req.body).length > 1 || !status) {
        return res.status(403).json({ error: 'Drivers can only update assignment status' });
      }
    }

    const assignment = await prisma.assignment.update({
      where: { id },
      data: req.body,
      include: {
        user: { select: { id: true, name: true, email: true } },
        fleet: true,
        module: true,
        trainingProgram: true,
      },
    });

    res.json({ data: assignment });
  } catch (error: any) {
    logError('Update assignment error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.assignment.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    await prisma.assignment.delete({ where: { id } });

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error: any) {
    logError('Delete assignment error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
