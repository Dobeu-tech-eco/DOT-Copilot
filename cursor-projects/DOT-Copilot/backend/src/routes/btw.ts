import { logError } from '../services/logger';
import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';
import eventDispatcher from '../services/eventDispatcher';

const router = Router();

router.use(authenticate);

// ============================================
// BTW SESSION SCHEMAS
// ============================================

const btwSessionSchema = z.object({
  traineeId: z.string(),
  sessionDate: z.string().datetime(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  routeType: z.enum(['city', 'highway', 'rural', 'backing', 'dock', 'mountain', 'mixed']),
  vehicleType: z.string().optional(),
  vehicleId: z.string().optional(),
  startLocation: z.string().optional(),
  endLocation: z.string().optional(),
  skillsChecklist: z.record(z.string(), z.boolean()).default({}),
  overallRating: z.number().int().min(1).max(5).optional(),
  trainerNotes: z.string().optional(),
  areasForImprovement: z.string().optional(),
});

const BTW_SKILLS = {
  pre_trip_inspection: 'Pre-Trip Inspection',
  post_trip_inspection: 'Post-Trip Inspection',
  coupling_uncoupling: 'Coupling/Uncoupling',
  backing_straight: 'Straight Line Backing',
  backing_offset: 'Offset Backing',
  backing_parallel: 'Parallel Parking',
  dock_backing: 'Dock Backing',
  shifting_manual: 'Manual Shifting',
  shifting_auto: 'Automatic Operation',
  lane_changes: 'Lane Changes',
  turns_intersections: 'Turns & Intersections',
  highway_merging: 'Highway Merging',
  highway_exiting: 'Highway Exiting',
  speed_management: 'Speed Management',
  following_distance: 'Following Distance',
  mirror_usage: 'Mirror Usage',
  defensive_driving: 'Defensive Driving',
  night_driving: 'Night Driving',
  adverse_weather: 'Adverse Weather',
  mountain_driving: 'Mountain Driving',
  railroad_crossings: 'Railroad Crossings',
  hazard_recognition: 'Hazard Recognition',
  fuel_efficiency: 'Fuel Efficiency',
  hours_of_service: 'Hours of Service Compliance',
};

/**
 * @swagger
 * /api/btw/skills:
 *   get:
 *     summary: Get list of BTW skills that can be tracked
 *     tags: [Behind-the-Wheel]
 */
router.get('/skills', (req: AuthenticatedRequest, res: Response) => {
  res.json({ data: BTW_SKILLS });
});

/**
 * @swagger
 * /api/btw/sessions:
 *   get:
 *     summary: Get BTW sessions
 *     tags: [Behind-the-Wheel]
 *     parameters:
 *       - in: query
 *         name: traineeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: trainerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, cancelled]
 */
router.get('/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { traineeId, trainerId, status } = req.query;
    const user = req.user!;

    const where: any = {};

    // Drivers can only see sessions where they are trainee or trainer
    if (user.role === 'DRIVER') {
      where.OR = [
        { traineeId: user.userId },
        { trainerId: user.userId },
      ];
    } else {
      // Filter by trainee/trainer if specified
      if (traineeId) where.traineeId = traineeId;
      if (trainerId) where.trainerId = trainerId;
    }

    if (status) where.status = status;

    const sessions = await prisma.btwSession.findMany({
      where,
      include: {
        trainee: {
          select: { id: true, name: true, email: true, employeeId: true },
        },
        trainer: {
          select: { id: true, name: true, email: true, employeeId: true },
        },
      },
      orderBy: { sessionDate: 'desc' },
    });

    res.json({ data: sessions });
  } catch (error: any) {
    logError('Get BTW sessions error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/btw/sessions/{id}:
 *   get:
 *     summary: Get a specific BTW session
 *     tags: [Behind-the-Wheel]
 */
router.get('/sessions/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const session = await prisma.btwSession.findUnique({
      where: { id },
      include: {
        trainee: {
          select: { id: true, name: true, email: true, employeeId: true },
        },
        trainer: {
          select: { id: true, name: true, email: true, employeeId: true },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check access
    if (user.role === 'DRIVER' && session.traineeId !== user.userId && session.trainerId !== user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ data: session });
  } catch (error: any) {
    logError('Get BTW session error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/btw/sessions:
 *   post:
 *     summary: Create a new BTW session
 *     tags: [Behind-the-Wheel]
 */
router.post('/sessions', requireRole('ADMIN', 'SUPERVISOR', 'DRIVER_COACH'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = btwSessionSchema.parse(req.body);
    const user = req.user!;

    // Calculate total minutes
    const startTime = new Date(validated.startTime);
    const endTime = new Date(validated.endTime);
    const totalMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

    if (totalMinutes <= 0) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    const session = await prisma.btwSession.create({
      data: {
        traineeId: validated.traineeId,
        trainerId: user.userId,
        sessionDate: new Date(validated.sessionDate),
        startTime,
        endTime,
        totalMinutes,
        routeType: validated.routeType,
        vehicleType: validated.vehicleType,
        vehicleId: validated.vehicleId,
        startLocation: validated.startLocation,
        endLocation: validated.endLocation,
        skillsChecklist: validated.skillsChecklist as Record<string, boolean>,
        overallRating: validated.overallRating,
        trainerNotes: validated.trainerNotes,
        areasForImprovement: validated.areasForImprovement,
        status: 'pending',
      },
      include: {
        trainee: {
          select: { id: true, name: true, email: true, fleetId: true },
        },
        trainer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.status(201).json({ data: session });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    logError('Create BTW session error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/btw/sessions/{id}:
 *   put:
 *     summary: Update a BTW session
 *     tags: [Behind-the-Wheel]
 */
router.put('/sessions/:id', requireRole('ADMIN', 'SUPERVISOR', 'DRIVER_COACH'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validated = btwSessionSchema.partial().parse(req.body);
    const user = req.user!;

    const existing = await prisma.btwSession.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Only trainer can update their sessions (unless admin)
    if (user.role !== 'ADMIN' && existing.trainerId !== user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Recalculate total minutes if times changed
    let totalMinutes = existing.totalMinutes;
    if (validated.startTime || validated.endTime) {
      const startTime = validated.startTime ? new Date(validated.startTime) : existing.startTime;
      const endTime = validated.endTime ? new Date(validated.endTime) : existing.endTime;
      totalMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    }

    const { skillsChecklist: sc, ...restValidated } = validated;
    const session = await prisma.btwSession.update({
      where: { id },
      data: {
        ...restValidated,
        ...(sc !== undefined && { skillsChecklist: sc as Record<string, boolean> }),
        sessionDate: validated.sessionDate ? new Date(validated.sessionDate) : undefined,
        startTime: validated.startTime ? new Date(validated.startTime) : undefined,
        endTime: validated.endTime ? new Date(validated.endTime) : undefined,
        totalMinutes,
      },
      include: {
        trainee: {
          select: { id: true, name: true, email: true },
        },
        trainer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({ data: session });
  } catch (error: any) {
    logError('Update BTW session error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/btw/sessions/{id}/sign/trainer:
 *   post:
 *     summary: Trainer signs off on session
 *     tags: [Behind-the-Wheel]
 */
router.post('/sessions/:id/sign/trainer', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { signature } = req.body;
    const user = req.user!;

    const session = await prisma.btwSession.findUnique({
      where: { id },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.trainerId !== user.userId) {
      return res.status(403).json({ error: 'Only the trainer can sign' });
    }

    const updated = await prisma.btwSession.update({
      where: { id },
      data: {
        trainerSignature: signature,
        trainerSignedAt: new Date(),
      },
    });

    // Check if both signed
    if (updated.traineeSignature) {
      await completeSession(id);
    }

    res.json({ data: updated });
  } catch (error: any) {
    logError('Trainer sign error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/btw/sessions/{id}/sign/trainee:
 *   post:
 *     summary: Trainee signs off on session
 *     tags: [Behind-the-Wheel]
 */
router.post('/sessions/:id/sign/trainee', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { signature } = req.body;
    const user = req.user!;

    const session = await prisma.btwSession.findUnique({
      where: { id },
      include: {
        trainee: {
          select: { fleetId: true },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.traineeId !== user.userId) {
      return res.status(403).json({ error: 'Only the trainee can sign' });
    }

    const updated = await prisma.btwSession.update({
      where: { id },
      data: {
        traineeSignature: signature,
        traineeSignedAt: new Date(),
      },
    });

    // Check if both signed - complete the session
    if (updated.trainerSignature) {
      await completeSession(id);
      
      // Dispatch webhook event
      if (session.trainee?.fleetId) {
        await eventDispatcher.btwSessionCompleted(updated, session.trainee.fleetId);
      }
    }

    res.json({ data: updated });
  } catch (error: any) {
    logError('Trainee sign error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/btw/sessions/{id}/complete:
 *   post:
 *     summary: Mark session as complete (requires both signatures)
 *     tags: [Behind-the-Wheel]
 */
router.post('/sessions/:id/complete', requireRole('ADMIN', 'SUPERVISOR', 'DRIVER_COACH'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const session = await prisma.btwSession.findUnique({
      where: { id },
      include: {
        trainee: {
          select: { fleetId: true },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.trainerSignature || !session.traineeSignature) {
      return res.status(400).json({ error: 'Both trainer and trainee must sign before completing' });
    }

    const updated = await completeSession(id);

    // Dispatch webhook event
    if (session.trainee?.fleetId) {
      await eventDispatcher.btwSessionCompleted(updated, session.trainee.fleetId);
    }

    res.json({ data: updated, message: 'Session completed successfully' });
  } catch (error: any) {
    logError('Complete session error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/btw/trainee/{traineeId}/summary:
 *   get:
 *     summary: Get BTW training summary for a trainee
 *     tags: [Behind-the-Wheel]
 */
router.get('/trainee/:traineeId/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { traineeId } = req.params;
    const user = req.user!;

    // Drivers can only see their own
    if (user.role === 'DRIVER' && user.userId !== traineeId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const sessions = await prisma.btwSession.findMany({
      where: {
        traineeId,
        status: 'completed',
      },
      include: {
        trainer: {
          select: { id: true, name: true },
        },
      },
      orderBy: { sessionDate: 'desc' },
    });

    // Calculate totals
    const totalHours = sessions.reduce((sum, s) => sum + s.totalMinutes, 0) / 60;
    const totalSessions = sessions.length;

    // Aggregate skills practiced
    const skillsCounts: Record<string, number> = {};
    sessions.forEach(s => {
      const skills = s.skillsChecklist as Record<string, boolean>;
      Object.entries(skills).forEach(([skill, practiced]) => {
        if (practiced) {
          skillsCounts[skill] = (skillsCounts[skill] || 0) + 1;
        }
      });
    });

    // Calculate average rating
    const ratings = sessions.filter(s => s.overallRating).map(s => s.overallRating as number);
    const averageRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null;

    // Get hours by route type
    const hoursByRouteType: Record<string, number> = {};
    sessions.forEach(s => {
      hoursByRouteType[s.routeType] = (hoursByRouteType[s.routeType] || 0) + s.totalMinutes / 60;
    });

    res.json({
      data: {
        totalHours: Math.round(totalHours * 10) / 10,
        totalSessions,
        averageRating: averageRating ? Math.round(averageRating * 10) / 10 : null,
        skillsPracticed: Object.entries(skillsCounts)
          .map(([skill, count]) => ({
            skill,
            skillName: BTW_SKILLS[skill as keyof typeof BTW_SKILLS] || skill,
            count,
          }))
          .sort((a, b) => b.count - a.count),
        hoursByRouteType,
        recentSessions: sessions.slice(0, 5),
      },
    });
  } catch (error: any) {
    logError('Get trainee summary error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/btw/sessions/{id}:
 *   delete:
 *     summary: Delete a BTW session (admin only)
 *     tags: [Behind-the-Wheel]
 */
router.delete('/sessions/:id', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.btwSession.delete({
      where: { id },
    });

    res.json({ message: 'Session deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Session not found' });
    }
    logError('Delete session error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function completeSession(sessionId: string) {
  return prisma.btwSession.update({
    where: { id: sessionId },
    data: { status: 'completed' },
  });
}

export default router;
