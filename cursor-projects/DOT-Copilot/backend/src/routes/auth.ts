import { Router, Response } from 'express';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { hashPassword } from '../utils/password';
import { 
  validateBody, 
  loginSchema, 
  registerSchema, 
  refreshTokenSchema, 
  resetPasswordSchema 
} from '../schemas';
import { sendSuccess, sendError } from '../utils/response';
import { logError } from '../services/logger';
import { blacklistToken } from '../utils/jwt';

const router = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login to the application
 *     tags: [Auth]
 */
router.post('/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return sendSuccess(res, result);
  } catch (error: any) {
    if (error.statusCode === 401) {
      return sendError(res, error.message, 'UNAUTHORIZED', 401);
    }
    logError('Login error', error);
    return sendError(res, 'Internal server error');
  }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new admin/user (Gated)
 *     tags: [Auth]
 */
router.post('/register', validateBody(registerSchema), async (req, res) => {
  try {
    const { email, password, name, fleetId, role } = req.body;

    const existingUser = await userService.findByEmail(email);
    if (existingUser) {
      return sendError(res, 'Email already registered', 'CONFLICT', 400);
    }

    const passwordHash = await hashPassword(password);
    const user = await userService.createUser({
      email,
      passwordHash,
      name,
      role: role || 'DRIVER',
      fleet: fleetId ? { connect: { id: fleetId } } : undefined,
    });

    const result = await authService.login(email, password);
    return sendSuccess(res, result, 201);
  } catch (error: any) {
    logError('Registration error', error);
    return sendError(res, 'Internal server error');
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 */
router.post('/refresh', validateBody(refreshTokenSchema), async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refresh(refreshToken);
    return sendSuccess(res, tokens);
  } catch (error: any) {
    return sendError(res, 'Invalid refresh token', 'UNAUTHORIZED', 401);
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout and blacklist token
 *     tags: [Auth]
 */
router.post('/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  const refreshToken = req.body.refreshToken;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    blacklistToken(token);
  }

  if (refreshToken) {
    blacklistToken(refreshToken);
  }

  return sendSuccess(res, { message: 'Logged out successfully' });
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 */
router.post('/reset-password', validateBody(resetPasswordSchema), async (req, res) => {
  // Mock reset for security (always return success)
  return sendSuccess(res, { message: 'If the email exists in our system, a reset link has been sent.' });
});

export default router;
