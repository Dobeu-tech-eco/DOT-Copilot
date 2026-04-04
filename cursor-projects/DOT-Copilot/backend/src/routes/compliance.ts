import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

// ============================================
// COMPLIANCE REQUIREMENTS
// ============================================

const complianceRequirementSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  regulatoryBody: z.string().min(1), // FMCSA, DOT, State
  requiredHours: z.number().int().positive().optional(),
  renewalPeriod: z.number().int().positive().optional(), // months
  appliesTo: z.array(z.string()).default([]),
  alertDays: z.array(z.number().int().positive()).default([90, 60, 30, 14, 7]),
  isActive: z.boolean().default(true),
});

/**
 * @swagger
 * /api/compliance/requirements:
 *   get:
 *     summary: List all compliance requirements
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: regulatoryBody
 *         schema:
 *           type: string
 *         description: Filter by regulatory body (FMCSA, DOT, State)
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of compliance requirements
 */
router.get('/requirements', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { regulatoryBody, isActive } = req.query;
    const user = req.user!;

    const where: any = {
      OR: [
        { fleetId: null }, // System-wide templates
        { fleetId: user.fleetId }, // Fleet-specific
      ],
    };

    if (regulatoryBody) {
      where.regulatoryBody = regulatoryBody as string;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const requirements = await prisma.complianceRequirement.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        trainingPrograms: {
          select: { id: true, programName: true },
        },
        _count: {
          select: { driverCompliance: true },
        },
      },
    });

    res.json({ data: requirements });
  } catch (error: any) {
    console.error('Get compliance requirements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/compliance/requirements:
 *   post:
 *     summary: Create a new compliance requirement
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 */
router.post('/requirements', requireRole('ADMIN', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = complianceRequirementSchema.parse(req.body);
    const user = req.user!;

    const requirement = await prisma.complianceRequirement.create({
      data: {
        ...validated,
        fleetId: user.fleetId,
      },
    });

    res.status(201).json({ data: requirement });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    console.error('Create compliance requirement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/compliance/requirements/{id}:
 *   put:
 *     summary: Update a compliance requirement
 *     tags: [Compliance]
 */
router.put('/requirements/:id', requireRole('ADMIN', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validated = complianceRequirementSchema.partial().parse(req.body);

    const requirement = await prisma.complianceRequirement.update({
      where: { id },
      data: validated,
    });

    res.json({ data: requirement });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Requirement not found' });
    }
    console.error('Update compliance requirement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/compliance/requirements/{id}:
 *   delete:
 *     summary: Delete a compliance requirement
 *     tags: [Compliance]
 */
router.delete('/requirements/:id', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.complianceRequirement.delete({
      where: { id },
    });

    res.json({ message: 'Requirement deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Requirement not found' });
    }
    console.error('Delete compliance requirement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// DRIVER COMPLIANCE STATUS
// ============================================

/**
 * @swagger
 * /api/compliance/drivers:
 *   get:
 *     summary: Get compliance status for all drivers in fleet
 *     tags: [Compliance]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [COMPLIANT, EXPIRING_SOON, EXPIRED, NOT_STARTED, IN_PROGRESS]
 *       - in: query
 *         name: locationId
 *         schema:
 *           type: string
 */
router.get('/drivers', requireRole('ADMIN', 'SUPERVISOR', 'BRANCH_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, locationId } = req.query;
    const user = req.user!;

    const userWhere: any = {
      fleetId: user.fleetId,
      role: 'DRIVER',
      isActive: true,
    };

    if (locationId) {
      userWhere.locationId = locationId as string;
    }

    const drivers = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        locationId: true,
        complianceRecords: {
          include: {
            requirement: true,
          },
        },
        documents: {
          select: {
            id: true,
            documentType: true,
            expirationDate: true,
            status: true,
          },
        },
      },
    });

    // Calculate overall compliance status for each driver
    const driversWithStatus = drivers.map(driver => {
      const complianceItems = driver.complianceRecords;
      const documents = driver.documents;

      let overallStatus = 'COMPLIANT';
      let expiringSoonCount = 0;
      let expiredCount = 0;
      let notStartedCount = 0;

      // Check compliance records
      complianceItems.forEach(item => {
        if (item.status === 'EXPIRED') {
          overallStatus = 'EXPIRED';
          expiredCount++;
        } else if (item.status === 'EXPIRING_SOON' && overallStatus !== 'EXPIRED') {
          overallStatus = 'EXPIRING_SOON';
          expiringSoonCount++;
        } else if (item.status === 'NOT_STARTED') {
          notStartedCount++;
        }
      });

      // Check documents
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      documents.forEach(doc => {
        if (new Date(doc.expirationDate) < now) {
          overallStatus = 'EXPIRED';
          expiredCount++;
        } else if (new Date(doc.expirationDate) < thirtyDaysFromNow && overallStatus !== 'EXPIRED') {
          overallStatus = 'EXPIRING_SOON';
          expiringSoonCount++;
        }
      });

      return {
        ...driver,
        overallStatus,
        expiringSoonCount,
        expiredCount,
        notStartedCount,
        complianceScore: complianceItems.length > 0 
          ? Math.round((complianceItems.filter(c => c.status === 'COMPLIANT').length / complianceItems.length) * 100)
          : 100,
      };
    });

    // Filter by status if provided
    const filteredDrivers = status 
      ? driversWithStatus.filter(d => d.overallStatus === status)
      : driversWithStatus;

    res.json({ 
      data: filteredDrivers,
      summary: {
        total: driversWithStatus.length,
        compliant: driversWithStatus.filter(d => d.overallStatus === 'COMPLIANT').length,
        expiringSoon: driversWithStatus.filter(d => d.overallStatus === 'EXPIRING_SOON').length,
        expired: driversWithStatus.filter(d => d.overallStatus === 'EXPIRED').length,
      }
    });
  } catch (error: any) {
    console.error('Get driver compliance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/compliance/drivers/{userId}:
 *   get:
 *     summary: Get detailed compliance status for a specific driver
 *     tags: [Compliance]
 */
router.get('/drivers/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const user = req.user!;

    // Drivers can view their own, supervisors can view their fleet
    if (user.role === 'DRIVER' && user.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const driverCompliance = await prisma.driverCompliance.findMany({
      where: { userId },
      include: {
        requirement: true,
      },
      orderBy: { requirement: { name: 'asc' } },
    });

    const documents = await prisma.driverDocument.findMany({
      where: { userId },
      orderBy: { expirationDate: 'asc' },
    });

    // Get training completion records
    const completionRecords = await prisma.completionRecord.findMany({
      where: { userId },
      include: {
        module: {
          include: {
            trainingProgram: true,
          },
        },
      },
      orderBy: { completedDate: 'desc' },
      take: 20,
    });

    res.json({
      data: {
        compliance: driverCompliance,
        documents,
        recentCompletions: completionRecords,
      },
    });
  } catch (error: any) {
    console.error('Get driver compliance detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/compliance/drivers/{userId}/requirements/{requirementId}:
 *   put:
 *     summary: Update driver's compliance status for a requirement
 *     tags: [Compliance]
 */
router.put('/drivers/:userId/requirements/:requirementId', requireRole('ADMIN', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, requirementId } = req.params;
    const { status, completedDate, expirationDate, hoursCompleted, certificateUrl, notes } = req.body;
    const currentUser = req.user!;

    const compliance = await prisma.driverCompliance.upsert({
      where: {
        userId_requirementId: {
          userId,
          requirementId,
        },
      },
      update: {
        status,
        completedDate: completedDate ? new Date(completedDate) : undefined,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        hoursCompleted,
        certificateUrl,
        notes,
        verifiedBy: currentUser.userId,
        verifiedAt: new Date(),
      },
      create: {
        userId,
        requirementId,
        status: status || 'NOT_STARTED',
        completedDate: completedDate ? new Date(completedDate) : undefined,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        hoursCompleted,
        certificateUrl,
        notes,
        verifiedBy: currentUser.userId,
        verifiedAt: new Date(),
      },
      include: {
        requirement: true,
      },
    });

    res.json({ data: compliance });
  } catch (error: any) {
    console.error('Update driver compliance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// COMPLIANCE DASHBOARD / SUMMARY
// ============================================

/**
 * @swagger
 * /api/compliance/dashboard:
 *   get:
 *     summary: Get compliance dashboard summary
 *     tags: [Compliance]
 */
router.get('/dashboard', requireRole('ADMIN', 'SUPERVISOR', 'BRANCH_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get total drivers
    const totalDrivers = await prisma.user.count({
      where: {
        fleetId: user.fleetId,
        role: 'DRIVER',
        isActive: true,
      },
    });

    // Get expiring documents
    const expiringDocuments = await prisma.driverDocument.findMany({
      where: {
        fleetId: user.fleetId,
        expirationDate: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { expirationDate: 'asc' },
    });

    // Get expired documents
    const expiredDocuments = await prisma.driverDocument.findMany({
      where: {
        fleetId: user.fleetId,
        expirationDate: {
          lt: now,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { expirationDate: 'asc' },
    });

    // Get overdue training assignments
    const overdueAssignments = await prisma.assignment.findMany({
      where: {
        fleetId: user.fleetId,
        status: { not: 'completed' },
        dueDate: {
          lt: now,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        trainingProgram: {
          select: { id: true, programName: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Get upcoming due assignments
    const upcomingDue = await prisma.assignment.findMany({
      where: {
        fleetId: user.fleetId,
        status: { not: 'completed' },
        dueDate: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        trainingProgram: {
          select: { id: true, programName: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Calculate compliance rate
    const driversWithExpiredDocs = new Set(expiredDocuments.map(d => d.userId));
    const driversWithOverdue = new Set(overdueAssignments.map(a => a.userId));
    const nonCompliantDrivers = new Set([...driversWithExpiredDocs, ...driversWithOverdue]);
    const complianceRate = totalDrivers > 0 
      ? Math.round(((totalDrivers - nonCompliantDrivers.size) / totalDrivers) * 100)
      : 100;

    res.json({
      data: {
        summary: {
          totalDrivers,
          complianceRate,
          expiredDocumentsCount: expiredDocuments.length,
          expiringDocumentsCount: expiringDocuments.length,
          overdueAssignmentsCount: overdueAssignments.length,
          upcomingDueCount: upcomingDue.length,
        },
        expiredDocuments: expiredDocuments.slice(0, 10),
        expiringDocuments: expiringDocuments.slice(0, 10),
        overdueAssignments: overdueAssignments.slice(0, 10),
        upcomingDue: upcomingDue.slice(0, 10),
      },
    });
  } catch (error: any) {
    console.error('Get compliance dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/compliance/expiring:
 *   get:
 *     summary: Get all expiring items (documents and compliance)
 *     tags: [Compliance]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 */
router.get('/expiring', requireRole('ADMIN', 'SUPERVISOR', 'BRANCH_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const days = parseInt(req.query.days as string) || 30;
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const expiringDocuments = await prisma.driverDocument.findMany({
      where: {
        fleetId: user.fleetId,
        expirationDate: {
          gte: now,
          lte: futureDate,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
      orderBy: { expirationDate: 'asc' },
    });

    const expiringCompliance = await prisma.driverCompliance.findMany({
      where: {
        user: { fleetId: user.fleetId },
        expirationDate: {
          gte: now,
          lte: futureDate,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
        requirement: true,
      },
      orderBy: { expirationDate: 'asc' },
    });

    res.json({
      data: {
        documents: expiringDocuments,
        compliance: expiringCompliance,
        total: expiringDocuments.length + expiringCompliance.length,
      },
    });
  } catch (error: any) {
    console.error('Get expiring items error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
