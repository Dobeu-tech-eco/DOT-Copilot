import { Router, Request, Response } from 'express';
import prisma from '../db';
import { hashPassword, verifyPassword } from '../utils/password';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt';
import { validateBody, loginSchema, registerSchema, resetPasswordSchema, refreshTokenSchema } from '../schemas';
import { emailService } from '../services/email';
import crypto from 'crypto';

const router = Router();

router.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { fleet: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          fleet: user.fleet,
        },
        ...tokens,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/register', validateBody(registerSchema), async (req: Request, res: Response) => {
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
      include: { fleet: true },
    });

    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          fleet: user.fleet,
        },
        ...tokens,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', validateBody(refreshTokenSchema), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    const payload = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({ data: tokens });
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expired', code: 'REFRESH_EXPIRED' });
    }
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  // In a production app, you might want to blacklist the token
  res.json({ message: 'Logged out successfully' });
});

/**
 * Generate a secure password reset token
 * Uses a time-limited signed token approach
 */
function generateResetToken(userId: string, email: string): string {
  const payload = {
    userId,
    email,
    purpose: 'password-reset',
    iat: Date.now(),
    exp: Date.now() + 3600000, // 1 hour expiration
  };
  
  const secret = process.env.JWT_SECRET || 'fallback-secret-change-me';
  const data = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
  
  const token = Buffer.from(data).toString('base64') + '.' + signature;
  return token;
}

/**
 * Verify a password reset token
 * Returns the payload if valid, throws if invalid
 */
function verifyResetToken(token: string): { userId: string; email: string } {
  const secret = process.env.JWT_SECRET || 'fallback-secret-change-me';
  const [dataB64, signature] = token.split('.');
  
  if (!dataB64 || !signature) {
    throw new Error('Invalid token format');
  }
  
  const data = Buffer.from(dataB64, 'base64').toString('utf-8');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    throw new Error('Invalid token signature');
  }
  
  const payload = JSON.parse(data);
  
  if (payload.purpose !== 'password-reset') {
    throw new Error('Invalid token purpose');
  }
  
  if (Date.now() > payload.exp) {
    throw new Error('Token has expired');
  }
  
  return { userId: payload.userId, email: payload.email };
}

router.post('/reset-password', validateBody(resetPasswordSchema), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If the email exists, a password reset link has been sent' });
    }

    // Generate a secure reset token
    const resetToken = generateResetToken(user.id, user.email);
    
    // Build the reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
    
    // Send the password reset email
    const emailSent = await emailService.sendPasswordReset(email, resetToken, resetUrl);
    
    if (!emailSent) {
      console.error(`Failed to send password reset email to: ${email}`);
      // Still return success to prevent enumeration, but log the error
    }

    res.json({ message: 'If the email exists, a password reset link has been sent' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reset-password/confirm', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Verify the reset token
    let tokenPayload;
    try {
      tokenPayload = verifyResetToken(token);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Invalid or expired reset token' });
    }

    // Find the user
    const user = await prisma.user.findUnique({ 
      where: { id: tokenPayload.userId } 
    });

    if (!user || user.email !== tokenPayload.email) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    // Hash the new password and update
    const passwordHash = await hashPassword(newPassword);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    res.json({ message: 'Password has been reset successfully' });
  } catch (error: any) {
    console.error('Reset password confirm error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
