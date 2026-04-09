import prisma from '../db';
import { hashPassword, verifyPassword } from '../utils/password';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';

export class AuthService {
  /**
   * Login user and return token pair
   */
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { fleet: true },
    });

    if (!user || !user.passwordHash) {
      throw new AppError(401, 'Invalid credentials', 'UNAUTHORIZED');
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new AppError(401, 'Invalid credentials', 'UNAUTHORIZED');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      fleetId: user.fleetId,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        fleetId: user.fleetId,
      },
    };
  }

  /**
   * Refresh access token
   */
  async refresh(refreshToken: string) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        throw new AppError(401, 'User not found', 'UNAUTHORIZED');
      }

      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
        fleetId: user.fleetId,
      });

      return tokens;
    } catch (error) {
      throw new AppError(401, 'Invalid refresh token', 'UNAUTHORIZED');
    }
  }
}

export const authService = new AuthService();
