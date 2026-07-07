import { logError } from '../services/logger';
import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { assertFleetOwnership } from '../middleware/fleetScope';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/driver-stats/me:
 *   get:
 *     summary: Get current driver's stats
 *     tags: [Driver Stats]
 *     security:
 *       - bearerAuth: []
 */
router.get('/me', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;

    let stats = await prisma.driverStats.findUnique({
      where: { userId: user.userId },
    });

    // If no stats exist, create initial stats
    if (!stats) {
      stats = await calculateAndUpdateDriverStats(user.userId);
    }

    // Get recent completions
    const recentCompletions = await prisma.completionRecord.findMany({
      where: { userId: user.userId },
      include: {
        lesson: { select: { id: true, lessonName: true } },
        module: {
          select: { id: true, moduleName: true },
          include: { trainingProgram: { select: { id: true, programName: true } } },
        },
      },
      orderBy: { completedDate: 'desc' },
      take: 5,
    });

    // Get pending assignments
    const pendingAssignments = await prisma.assignment.count({
      where: {
        userId: user.userId,
        status: { not: 'completed' },
      },
    });

    res.json({
      data: {
        stats,
        recentCompletions,
        pendingAssignments,
      },
    });
  } catch (error: any) {
    logError('Get my stats error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/driver-stats/rankings:
 *   get:
 *     summary: Get fleet driver rankings
 *     tags: [Driver Stats]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: locationId
 *         schema:
 *           type: string
 */
router.get('/rankings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const limit = parseInt(req.query.limit as string) || 20;
    const locationId = req.query.locationId as string;

    const userWhere: any = {
      fleetId: user.fleetId ?? undefined,
      role: 'DRIVER',
      isActive: true,
    };

    if (locationId) {
      userWhere.locationId = locationId;
    }

    // Get all driver stats for the fleet
    const driversWithStats = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        locationId: true,
        driverStats: true,
      },
    });

    // Calculate rankings
    const rankedDrivers = driversWithStats
      .map(driver => ({
        userId: driver.id,
        name: driver.name || driver.email,
        employeeId: driver.employeeId,
        locationId: driver.locationId,
        totalTrainingsCompleted: driver.driverStats?.totalTrainingsCompleted || 0,
        averageQuizScore: driver.driverStats?.averageQuizScore || 0,
        currentStreak: driver.driverStats?.currentStreak || 0,
        totalTimeSpent: driver.driverStats?.totalTimeSpent || 0,
        complianceScore: driver.driverStats?.complianceScore || 100,
      }))
      .sort((a, b) => {
        // Sort by trainings completed, then quiz score, then streak
        if (b.totalTrainingsCompleted !== a.totalTrainingsCompleted) {
          return b.totalTrainingsCompleted - a.totalTrainingsCompleted;
        }
        if ((b.averageQuizScore || 0) !== (a.averageQuizScore || 0)) {
          return (b.averageQuizScore || 0) - (a.averageQuizScore || 0);
        }
        return b.currentStreak - a.currentStreak;
      })
      .slice(0, limit)
      .map((driver, index) => ({
        ...driver,
        rank: index + 1,
      }));

    // Find current user's rank
    const currentUserRank = rankedDrivers.findIndex(d => d.userId === user.userId) + 1;

    res.json({
      data: rankedDrivers,
      myRank: currentUserRank > 0 ? currentUserRank : null,
      totalDrivers: driversWithStats.length,
    });
  } catch (error: any) {
    logError('Get rankings error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/driver-stats/{userId}:
 *   get:
 *     summary: Get stats for a specific driver
 *     tags: [Driver Stats]
 */
router.get('/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const user = req.user!;

    // Drivers can only see their own stats
    if (user.role === 'DRIVER' && user.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // SECURITY: Non-drivers may only view stats for users in their own fleet.
    if (user.role !== 'DRIVER') {
      const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { fleetId: true } });
      if (!targetUser || !assertFleetOwnership(targetUser, user, res, 'Driver not found')) {
        return;
      }
    }

    const stats = await prisma.driverStats.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            hireDate: true,
          },
        },
      },
    });

    if (!stats) {
      // Calculate stats on-demand
      const calculatedStats = await calculateAndUpdateDriverStats(userId);
      return res.json({ data: calculatedStats });
    }

    res.json({ data: stats });
  } catch (error: any) {
    logError('Get driver stats error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/driver-stats/{userId}/refresh:
 *   post:
 *     summary: Recalculate stats for a driver
 *     tags: [Driver Stats]
 */
router.post('/:userId/refresh', requireRole('ADMIN', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const user = req.user!;

    // SECURITY: Only allow recalculating stats for users within the caller's fleet.
    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { fleetId: true } });
    if (!targetUser || !assertFleetOwnership(targetUser, user, res, 'Driver not found')) {
      return;
    }

    const stats = await calculateAndUpdateDriverStats(userId);

    res.json({
      data: stats,
      message: 'Stats recalculated successfully',
    });
  } catch (error: any) {
    logError('Refresh stats error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/driver-stats/fleet/summary:
 *   get:
 *     summary: Get fleet-wide stats summary
 *     tags: [Driver Stats]
 */
router.get('/fleet/summary', requireRole('ADMIN', 'SUPERVISOR', 'BRANCH_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;

    const [
      totalDrivers,
      totalCompletions,
      avgQuizScore,
      totalTimeSpent,
      topPerformers,
    ] = await Promise.all([
      prisma.user.count({
        where: {
          fleetId: user.fleetId ?? undefined,
          role: 'DRIVER',
          isActive: true,
        },
      }),
      prisma.completionRecord.count({
        where: { fleetId: user.fleetId ?? undefined },
      }),
      prisma.completionRecord.aggregate({
        where: {
          fleetId: user.fleetId ?? undefined,
          quizScore: { not: null },
        },
        _avg: { quizScore: true },
      }),
      prisma.driverStats.aggregate({
        where: {
          user: { fleetId: user.fleetId },
        },
        _sum: { totalTimeSpent: true },
      }),
      prisma.driverStats.findMany({
        where: {
          user: { fleetId: user.fleetId },
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { totalTrainingsCompleted: 'desc' },
        take: 5,
      }),
    ]);

    // Get completion rate
    const [assignedCount, completedCount] = await Promise.all([
      prisma.assignment.count({
        where: { fleetId: user.fleetId ?? undefined },
      }),
      prisma.assignment.count({
        where: {
          fleetId: user.fleetId ?? undefined,
          status: 'completed',
        },
      }),
    ]);

    const completionRate = assignedCount > 0 
      ? Math.round((completedCount / assignedCount) * 100)
      : 0;

    res.json({
      data: {
        totalDrivers,
        totalCompletions,
        averageQuizScore: avgQuizScore._avg.quizScore 
          ? Math.round(avgQuizScore._avg.quizScore)
          : 0,
        totalTimeSpentMinutes: totalTimeSpent._sum.totalTimeSpent || 0,
        completionRate,
        assignedCount,
        completedCount,
        topPerformers: topPerformers.map((s, i) => ({
          rank: i + 1,
          userId: s.userId,
          name: s.user.name || s.user.email,
          trainingsCompleted: s.totalTrainingsCompleted,
          averageScore: s.averageQuizScore,
        })),
      },
    });
  } catch (error: any) {
    logError('Get fleet summary error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function calculateAndUpdateDriverStats(userId: string) {
  // Get all completion records
  const completions = await prisma.completionRecord.findMany({
    where: { userId },
  });

  // Get BTW sessions
  const btwSessions = await prisma.btwSession.findMany({
    where: {
      traineeId: userId,
      status: 'completed',
    },
  });

  // Calculate stats
  const totalTrainingsCompleted = completions.filter(c => c.moduleId).length;
  const totalLessonsCompleted = completions.filter(c => c.lessonId).length;
  
  const quizScores = completions
    .filter(c => c.quizScore !== null)
    .map(c => c.quizScore as number);
  
  const averageQuizScore = quizScores.length > 0
    ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length
    : null;
  
  const highestQuizScore = quizScores.length > 0
    ? Math.max(...quizScores)
    : null;

  const totalTimeSpent = completions.reduce((sum, c) => sum + (c.timeSpent || 0), 0);

  // Calculate streaks (simplified)
  const completionDates = completions
    .map(c => new Date(c.completedDate).toDateString())
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort();

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;
  
  for (let i = 1; i < completionDates.length; i++) {
    const prev = new Date(completionDates[i - 1]);
    const curr = new Date(completionDates[i]);
    const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  // Check if streak is current
  if (completionDates.length > 0) {
    const lastCompletion = new Date(completionDates[completionDates.length - 1]);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - lastCompletion.getTime()) / (1000 * 60 * 60 * 24));
    currentStreak = diffDays <= 1 ? tempStreak : 0;
  }

  // BTW stats
  const btwHoursCompleted = btwSessions.reduce((sum, s) => sum + s.totalMinutes, 0) / 60;
  const btwSessionsCompleted = btwSessions.length;

  // Last activity
  const lastActivity = completions.length > 0
    ? completions.sort((a, b) => 
        new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime()
      )[0].completedDate
    : null;

  // Upsert stats
  const stats = await prisma.driverStats.upsert({
    where: { userId },
    update: {
      totalTrainingsCompleted,
      totalLessonsCompleted,
      totalQuizzesTaken: quizScores.length,
      averageQuizScore,
      highestQuizScore,
      totalTimeSpent: Math.floor(totalTimeSpent / 60), // Convert to minutes
      currentStreak,
      longestStreak,
      lastActivityDate: lastActivity,
      btwHoursCompleted,
      btwSessionsCompleted,
    },
    create: {
      userId,
      totalTrainingsCompleted,
      totalLessonsCompleted,
      totalQuizzesTaken: quizScores.length,
      averageQuizScore,
      highestQuizScore,
      totalTimeSpent: Math.floor(totalTimeSpent / 60),
      currentStreak,
      longestStreak,
      lastActivityDate: lastActivity,
      btwHoursCompleted,
      btwSessionsCompleted,
    },
  });

  return stats;
}

export default router;
