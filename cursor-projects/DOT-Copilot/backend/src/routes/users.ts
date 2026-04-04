import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { hashPassword } from '../utils/password';
import { validateBody, createUserSchema, updateUserSchema, paginationSchema, validateQuery } from '../schemas';

const router = Router();

router.use(authenticate);

router.get('/me', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { fleet: true, location: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        fleet_id: user.fleetId,
        location_id: user.locationId,
        phone: user.phone,
        preferred_language: user.preferredLanguage,
        timezone: user.timezone,
        prefer_email: user.preferEmail,
        prefer_sms: user.preferSms,
        prefer_push: user.preferPush,
        employee_id: user.employeeId,
        hire_date: user.hireDate?.toISOString() || null,
        is_active: user.isActive,
        last_login_at: user.lastLoginAt?.toISOString() || null,
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', validateQuery(paginationSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit } = req.query as any;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          fleetId: true,
          createdAt: true,
          fleet: {
            select: { id: true, companyName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]);

    res.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        fleetId: true,
        createdAt: true,
        fleet: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ data: user });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole('ADMIN', 'SUPERVISOR'), validateBody(createUserSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, name, role, fleetId } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: role || 'DRIVER',
        fleetId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        fleetId: true,
        createdAt: true,
      },
    });

    res.status(201).json({ data: user });
  } catch (error: any) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', validateBody(updateUserSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const isPrivileged = ['ADMIN', 'SUPERVISOR'].includes(req.user?.role || '');
    const isSelfUpdate = req.user?.userId === id;

    // Users can only update themselves unless they're admin/supervisor
    if (!isSelfUpdate && !isPrivileged) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // SECURITY: Filter update data based on user's role
    // Non-privileged users (DRIVER) can only update safe fields, not role or fleetId
    let updateData: Record<string, any> = {};
    
    if (isPrivileged) {
      // Admins/Supervisors can update all allowed fields
      updateData = req.body;
      
      // Additional check: only ADMIN can change roles to ADMIN
      if (req.body.role === 'ADMIN' && req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can assign admin role' });
      }
    } else {
      // Drivers can only update their own name and email
      const { name, email } = req.body;
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      
      // Log attempt to modify restricted fields
      if (req.body.role || req.body.fleetId !== undefined) {
        console.warn(`Security: User ${req.user?.userId} attempted to modify restricted fields`);
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        fleetId: true,
        createdAt: true,
      },
    });

    res.json({ data: user });
  } catch (error: any) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.delete({ where: { id } });

    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
