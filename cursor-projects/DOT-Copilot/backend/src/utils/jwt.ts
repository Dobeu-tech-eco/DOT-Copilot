import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';

export const JWT_SECRET = env.JWT_SECRET;
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;

const tokenBlacklist = new Set<string>();
const BLACKLIST_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const blacklistExpiry = new Map<string, number>();

setInterval(() => {
  const now = Date.now();
  for (const [hash, expiry] of blacklistExpiry) {
    if (now > expiry) {
      tokenBlacklist.delete(hash);
      blacklistExpiry.delete(hash);
    }
  }
}, BLACKLIST_CLEANUP_INTERVAL_MS);

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function blacklistToken(token: string, expiresInMs: number = 15 * 60 * 1000): void {
  const hash = hashToken(token);
  tokenBlacklist.add(hash);
  blacklistExpiry.set(hash, Date.now() + expiresInMs);
}

export function isTokenBlacklisted(token: string): boolean {
  return tokenBlacklist.has(hashToken(token));
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  /** Fleet tenancy; null if user not assigned to a fleet */
  fleetId: string | null;
}

export function generateAccessToken(payload: TokenPayload): string {
  const expiresIn = env.JWT_EXPIRES_IN;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

export function generateRefreshToken(payload: TokenPayload): string {
  const expiresIn = env.JWT_REFRESH_EXPIRES_IN;
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

function normalizePayload(decoded: jwt.JwtPayload): TokenPayload {
  return {
    userId: decoded.userId as string,
    email: decoded.email as string,
    role: decoded.role as string,
    fleetId: (decoded as { fleetId?: string | null }).fleetId ?? null,
  };
}

export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  return normalizePayload(decoded);
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as jwt.JwtPayload;
  return normalizePayload(decoded);
}

export function generateTokenPair(payload: TokenPayload) {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}
