import { Router, Response } from 'express';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { hashPassword } from '../utils/password';
import { validateBody, createUserSchema, updateUserSchema, paginationSchema, validateQuery } from '../schemas';
import { userService } from '../services/userService';
import { sendSuccess, sendError } from '../utils/response';
import { logError } from '../services/logger';

const router = Router();

router.use(authenticate);

/**
 * Get current user profile
 */
router.get('/me', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await userService.getUserById(req.user!.userId, { fleet: true, location: true });

    if (!user) {
      return sendError(res, 'User not found', 'NOT_FOUND', 404);
    }

    const profile = {
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
    };

    return sendSuccess(res, profile);
  } catch (error: any) {
    logError('Get current user error', error);
    return sendError(res, 'Internal server error');
  }
});

/** Require JWT fleetId for all user-directory operations (multi-tenant isolation). */
function getFleetId(req: AuthenticatedRequest, res: Response): string | null {
  const fleetId = req.user?.fleetId ?? null;
  if (!fleetId) {
    sendError(res, 'Fleet context required for user management', 'FORBIDDEN', 403);
    return null;
  }
  return fleetId;
}

/**
 * List all users in the fleet
 */
router.get('/', validateQuery(paginationSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fleetId = getFleetId(req, res);
    if (!fleetId) return;

    const { page, limit } = req.query as any;
    
    const result = await userService.listUsers(fleetId, page, limit);

    return sendSuccess(res, result.users, 200, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (error: any) {
    logError('Get users error', error);
    return sendError(res, 'Internal server error');
  }
});

/**
 * Get user by ID
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fleetId = getFleetId(req, res);
    if (!fleetId) return;

    const user = await userService.getUserById(req.params.id, { fleet: true });

    if (!user || user.fleetId !== fleetId) {
      return sendError(res, 'User not found', 'NOT_FOUND', 404);
    }

    return sendSuccess(res, user);
  } catch (error: any) {
    logError('Get user error', error);
    return sendError(res, 'Internal server error');
  }
});

/**
 * Create a new user in the fleet
 */
router.post('/', requireRole('ADMIN', 'SUPERVISOR'), validateBody(createUserSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, name, role: requestedRole, fleetId: bodyFleetId } = req.body;
    const caller = req.user!;

    if (requestedRole === 'ADMIN' && caller.role !== 'ADMIN') {
      return sendError(res, 'Only admins can assign admin role', 'FORBIDDEN', 403);
    }

    // Resolve fleet ID
    let fleetId: string;
    if (caller.role === 'ADMIN' && !caller.fleetId) {
      if (!bodyFleetId) return sendError(res, 'fleetId is required', 'BAD_REQUEST', 400);
      fleetId = bodyFleetId;
    } else {
      fleetId = caller.fleetId!;
      if (bodyFleetId && bodyFleetId !== fleetId) {
        return sendError(res, 'Cannot assign users outside your fleet', 'FORBIDDEN', 403);
      }
    }

    const existingUser = await userService.findByEmail(email);
    if (existingUser) {
      return sendError(res, 'Email already registered', 'CONFLICT', 400);
    }

    const passwordHash = await hashPassword(password);

    const user = await userService.createUser({
      email,
      passwordHash,
      name,
      role: requestedRole || 'DRIVER',
      fleet: { connect: { id: fleetId } }
    });

    return sendSuccess(res, user, 201);
  } catch (error: any) {
    logError('Create user error', error);
    return sendError(res, 'Internal server error');
  }
});

/**
 * Update user profile
 */
router.put('/:id', validateBody(updateUserSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const fleetId = getFleetId(req, res);
    if (!fleetId) return;

    const isPrivileged = ['ADMIN', 'SUPERVISOR'].includes(req.user?.role || '');
    const isSelfUpdate = req.user?.userId === id;

    if (!isSelfUpdate && !isPrivileged) {
      return sendError(res, 'Forbidden', 'FORBIDDEN', 403);
    }

    const existingUser = await userService.getUserById(id);
    if (!existingUser || existingUser.fleetId !== fleetId) {
      return sendError(res, 'User not found', 'NOT_FOUND', 404);
    }

    let updateData: any = {};

    if (isPrivileged) {
      updateData = { ...req.body };

      if (req.body.role === 'ADMIN' && req.user?.role !== 'ADMIN') {
        return sendError(res, 'Only admins can assign admin role', 'FORBIDDEN', 403);
      }

      if (req.body.fleetId !== undefined && req.body.fleetId !== fleetId) {
        return sendError(res, 'Cannot move users to another fleet', 'FORBIDDEN', 403);
      }
    } else {
      const { name, email } = req.body;
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
    }

    const user = await userService.updateUser(id, updateData);

    return sendSuccess(res, user);
  } catch (error: any) {
    logError('Update user error', error);
    return sendError(res, 'Internal server error');
  }
});

/**
 * Delete a user
 */
router.delete('/:id', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const fleetId = getFleetId(req, res);
    if (!fleetId) return;

    const existingUser = await userService.getUserById(id);
    if (!existingUser || existingUser.fleetId !== fleetId) {
      return sendError(res, 'User not found', 'NOT_FOUND', 404);
    }

    await userService.deleteUser(id);

    return sendSuccess(res, { message: 'User deleted successfully' });
  } catch (error: any) {
    logError('Delete user error', error);
    return sendError(res, 'Internal server error');
  }
});

export default router;
