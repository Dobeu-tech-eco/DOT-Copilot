import { logError } from '../services/logger';
import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';
import { assertFleetOwnership, fleetFilterValue } from '../middleware/fleetScope';

const router = Router();

router.use(authenticate);

// ============================================
// DRIVER DOCUMENTS
// ============================================

const documentSchema = z.object({
  documentType: z.enum([
    'CDL',
    'MEDICAL_CARD',
    'HAZMAT_ENDORSEMENT',
    'TWIC_CARD',
    'PASSPORT',
    'MVR',
    'DRUG_TEST',
    'BACKGROUND_CHECK',
    'STATE_PERMIT',
    'OTHER',
  ]),
  documentNumber: z.string().optional(),
  issuedDate: z.string().datetime().optional(),
  expirationDate: z.string().datetime(),
  issuingState: z.string().max(50).optional(),
  issuingCountry: z.string().max(50).optional(),
  cdlClass: z.enum(['A', 'B', 'C']).optional(),
  endorsements: z.array(z.string()).default([]),
  restrictions: z.array(z.string()).default([]),
  frontImageUrl: z.string().url().optional(),
  backImageUrl: z.string().url().optional(),
});

/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: List all driver documents
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID (admin/supervisor only)
 *       - in: query
 *         name: documentType
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [valid, expiring_soon, expired]
 *     responses:
 *       200:
 *         description: List of documents
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, documentType, status } = req.query;
    const user = req.user!;

    const where: any = {};

    // Drivers can only see their own documents
    if (user.role === 'DRIVER') {
      where.userId = user.userId;
    } else {
      // Supervisors and above can see fleet documents
      where.fleetId = fleetFilterValue(user);
      if (userId) {
        where.userId = userId as string;
      }
    }

    if (documentType) {
      where.documentType = documentType as string;
    }

    if (status) {
      where.status = status as string;
    }

    const documents = await prisma.driverDocument.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, employeeId: true },
        },
      },
      orderBy: { expirationDate: 'asc' },
    });

    res.json({ data: documents });
  } catch (error: any) {
    logError('Get documents error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/documents/{id}:
 *   get:
 *     summary: Get a specific document
 *     tags: [Documents]
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const document = await prisma.driverDocument.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, employeeId: true },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access
    if (user.role === 'DRIVER' && document.userId !== user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (user.role !== 'DRIVER' && !assertFleetOwnership(document, user, res, 'Document not found')) {
      return;
    }

    res.json({ data: document });
  } catch (error: any) {
    logError('Get document error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/documents:
 *   post:
 *     summary: Create a new driver document
 *     tags: [Documents]
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = documentSchema.parse(req.body);
    const user = req.user!;
    const targetUserId = req.body.userId || user.userId;

    // Only admins/supervisors can add documents for other users
    if (targetUserId !== user.userId && !['ADMIN', 'SUPERVISOR', 'BRANCH_MANAGER'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { fleetId: true },
    });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!assertFleetOwnership(targetUser, user, res, 'User not found')) {
      return;
    }
    if (!targetUser.fleetId) {
      return res.status(400).json({ error: 'Target user must belong to a fleet' });
    }

    // Calculate status based on expiration date
    const now = new Date();
    const expirationDate = new Date(validated.expirationDate);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    let status = 'valid';
    if (expirationDate < now) {
      status = 'expired';
    } else if (expirationDate < thirtyDaysFromNow) {
      status = 'expiring_soon';
    }

    const document = await prisma.driverDocument.create({
      data: {
        ...validated,
        issuedDate: validated.issuedDate ? new Date(validated.issuedDate) : null,
        expirationDate: new Date(validated.expirationDate),
        userId: targetUserId,
        fleetId: targetUser.fleetId,
        status,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.status(201).json({ data: document });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    logError('Create document error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/documents/{id}:
 *   put:
 *     summary: Update a driver document
 *     tags: [Documents]
 */
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validated = documentSchema.partial().parse(req.body);
    const user = req.user!;

    const existingDoc = await prisma.driverDocument.findUnique({
      where: { id },
    });

    if (!existingDoc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check permissions
    if (user.role === 'DRIVER' && existingDoc.userId !== user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (user.role !== 'DRIVER' && !assertFleetOwnership(existingDoc, user, res, 'Document not found')) {
      return;
    }

    // Recalculate status if expiration date changed
    let status = existingDoc.status;
    if (validated.expirationDate) {
      const now = new Date();
      const expirationDate = new Date(validated.expirationDate);
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      if (expirationDate < now) {
        status = 'expired';
      } else if (expirationDate < thirtyDaysFromNow) {
        status = 'expiring_soon';
      } else {
        status = 'valid';
      }
    }

    const document = await prisma.driverDocument.update({
      where: { id },
      data: {
        ...validated,
        issuedDate: validated.issuedDate ? new Date(validated.issuedDate) : undefined,
        expirationDate: validated.expirationDate ? new Date(validated.expirationDate) : undefined,
        status,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({ data: document });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Document not found' });
    }
    logError('Update document error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/documents/{id}:
 *   delete:
 *     summary: Delete a driver document
 *     tags: [Documents]
 */
router.delete('/:id', requireRole('ADMIN', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const existingDoc = await prisma.driverDocument.findUnique({ where: { id } });
    if (!assertFleetOwnership(existingDoc, user, res, 'Document not found')) {
      return;
    }

    await prisma.driverDocument.delete({
      where: { id },
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Document not found' });
    }
    logError('Delete document error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/documents/{id}/verify:
 *   post:
 *     summary: Verify a driver document
 *     tags: [Documents]
 */
router.post('/:id/verify', requireRole('ADMIN', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const existingDoc = await prisma.driverDocument.findUnique({ where: { id } });
    if (!assertFleetOwnership(existingDoc, user, res, 'Document not found')) {
      return;
    }

    const document = await prisma.driverDocument.update({
      where: { id },
      data: {
        verifiedBy: user.userId,
        verifiedAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({ data: document });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Document not found' });
    }
    logError('Verify document error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/documents/expiring:
 *   get:
 *     summary: Get documents expiring within specified days
 *     tags: [Documents]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 */
router.get('/expiring/list', requireRole('ADMIN', 'SUPERVISOR', 'BRANCH_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const user = req.user!;
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const documents = await prisma.driverDocument.findMany({
      where: {
        fleetId: fleetFilterValue(user),
        expirationDate: {
          gte: now,
          lte: futureDate,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, employeeId: true },
        },
      },
      orderBy: { expirationDate: 'asc' },
    });

    // Group by days until expiration
    const grouped = {
      critical: documents.filter(d => {
        const daysUntil = Math.ceil((new Date(d.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil <= 7;
      }),
      warning: documents.filter(d => {
        const daysUntil = Math.ceil((new Date(d.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil > 7 && daysUntil <= 14;
      }),
      upcoming: documents.filter(d => {
        const daysUntil = Math.ceil((new Date(d.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil > 14;
      }),
    };

    res.json({
      data: documents,
      grouped,
      summary: {
        total: documents.length,
        critical: grouped.critical.length,
        warning: grouped.warning.length,
        upcoming: grouped.upcoming.length,
      },
    });
  } catch (error: any) {
    logError('Get expiring documents error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/documents/expired:
 *   get:
 *     summary: Get all expired documents
 *     tags: [Documents]
 */
router.get('/expired/list', requireRole('ADMIN', 'SUPERVISOR', 'BRANCH_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const now = new Date();

    const documents = await prisma.driverDocument.findMany({
      where: {
        fleetId: fleetFilterValue(user),
        expirationDate: {
          lt: now,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, employeeId: true },
        },
      },
      orderBy: { expirationDate: 'desc' },
    });

    // Group by document type
    const byType = documents.reduce((acc, doc) => {
      const type = doc.documentType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(doc);
      return acc;
    }, {} as Record<string, typeof documents>);

    res.json({
      data: documents,
      byType,
      summary: {
        total: documents.length,
        uniqueDrivers: new Set(documents.map(d => d.userId)).size,
      },
    });
  } catch (error: any) {
    logError('Get expired documents error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/documents/user/{userId}:
 *   get:
 *     summary: Get all documents for a specific user
 *     tags: [Documents]
 */
router.get('/user/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const user = req.user!;

    // Drivers can only see their own
    if (user.role === 'DRIVER' && user.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Non-drivers may only pull documents for users within their own fleet.
    if (user.role !== 'DRIVER') {
      const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { fleetId: true } });
      if (!assertFleetOwnership(targetUser, user, res, 'User not found')) {
        return;
      }
    }

    const documents = await prisma.driverDocument.findMany({
      where: { userId },
      orderBy: [
        { status: 'asc' }, // expired first
        { expirationDate: 'asc' },
      ],
    });

    const now = new Date();
    const summary = {
      total: documents.length,
      valid: documents.filter(d => d.status === 'valid').length,
      expiringSoon: documents.filter(d => d.status === 'expiring_soon').length,
      expired: documents.filter(d => d.status === 'expired').length,
      hasCDL: documents.some(d => d.documentType === 'CDL'),
      hasMedicalCard: documents.some(d => d.documentType === 'MEDICAL_CARD'),
      nextExpiration: documents.filter(d => new Date(d.expirationDate) > now)[0] || null,
    };

    res.json({ data: documents, summary });
  } catch (error: any) {
    logError('Get user documents error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
