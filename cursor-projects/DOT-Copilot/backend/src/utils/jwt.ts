import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { logWarn, logError } from '../services/logger';

export const JWT_SECRET = env.JWT_SECRET;
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;

const JWT_ALGORITHMS: jwt.Algorithm[] = ['HS256'];

// ---------------------------------------------------------------------------
// Token blacklist: Redis-backed with in-memory fallback.
//
// If a REDIS_URL is configured and the `redis` package is available, the
// blacklist is stored in Redis so it is shared across all backend instances
// and survives process restarts. If Redis is unavailable for any reason
// (package not installed, connection failure, no REDIS_URL configured), we
// degrade gracefully to the previous in-memory implementation and log a
// warning so the condition is observable in production.
// ---------------------------------------------------------------------------

const BLACKLIST_KEY_PREFIX = 'jwt:blacklist:';
const BLACKLIST_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const tokenBlacklist = new Set<string>();
const blacklistExpiry = new Map<string, number>();

setInterval(() => {
  const now = Date.now();
  for (const [hash, expiry] of blacklistExpiry) {
    if (now > expiry) {
      tokenBlacklist.delete(hash);
      blacklistExpiry.delete(hash);
    }
  }
}, BLACKLIST_CLEANUP_INTERVAL_MS).unref?.();

type MinimalRedisClient = {
  isOpen?: boolean;
  connect: () => Promise<unknown>;
  set: (key: string, value: string, opts?: Record<string, unknown>) => Promise<unknown>;
  exists: (key: string) => Promise<number>;
  on: (event: string, listener: (...args: any[]) => void) => unknown;
};

let redisClient: MinimalRedisClient | null = null;
let redisInitAttempted = false;
let redisAvailable = false;

function getRedisClient(): MinimalRedisClient | null {
  if (redisInitAttempted) {
    return redisAvailable ? redisClient : null;
  }
  redisInitAttempted = true;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logWarn('JWT blacklist: REDIS_URL not configured, falling back to in-memory blacklist. This is not safe for multi-instance deployments.');
    return null;
  }

  try {
    // Required dynamically so the app still boots if `redis` isn't installed.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('redis');
    const client: MinimalRedisClient = createClient({ url: redisUrl });

    client.on('error', (err: Error) => {
      logError('JWT blacklist: Redis client error, falling back to in-memory blacklist', err);
      redisAvailable = false;
    });

    client.connect()
      .then(() => {
        redisAvailable = true;
      })
      .catch((err: Error) => {
        logError('JWT blacklist: Redis connection failed, falling back to in-memory blacklist', err);
        redisAvailable = false;
      });

    redisClient = client;
    // Optimistically mark available; individual operations fall back on error.
    redisAvailable = true;
    return client;
  } catch (err) {
    logWarn('JWT blacklist: "redis" package not available, falling back to in-memory blacklist.');
    redisAvailable = false;
    return null;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function blacklistTokenInMemory(hash: string, expiresInMs: number): void {
  tokenBlacklist.add(hash);
  blacklistExpiry.set(hash, Date.now() + expiresInMs);
}

export function blacklistToken(token: string, expiresInMs: number = 15 * 60 * 1000): void {
  const hash = hashToken(token);

  // Always set the in-memory fallback immediately so the token is revoked
  // even if the Redis write below fails or hasn't completed yet.
  blacklistTokenInMemory(hash, expiresInMs);

  const client = getRedisClient();
  if (!client) {
    return;
  }

  const ttlSeconds = Math.max(1, Math.ceil(expiresInMs / 1000));
  Promise.resolve(client.set(`${BLACKLIST_KEY_PREFIX}${hash}`, '1', { EX: ttlSeconds }))
    .catch((err: Error) => {
      logError('JWT blacklist: failed to write to Redis, relying on in-memory fallback', err);
      redisAvailable = false;
    });
}

export function isTokenBlacklisted(token: string): boolean {
  const hash = hashToken(token);
  if (tokenBlacklist.has(hash)) {
    return true;
  }
  // Note: Redis lookup is async, but this function's callers (auth middleware)
  // currently expect a synchronous boolean. We keep the synchronous in-memory
  // check as the authoritative fast path and kick off an async Redis check to
  // repopulate the in-memory cache for subsequent requests.
  const client = getRedisClient();
  if (client) {
    Promise.resolve(client.exists(`${BLACKLIST_KEY_PREFIX}${hash}`))
      .then((exists: number) => {
        if (exists) {
          // Repopulate local cache with a short TTL; exact expiry isn't known here.
          blacklistTokenInMemory(hash, 15 * 60 * 1000);
        }
      })
      .catch((err: Error) => {
        logError('JWT blacklist: failed to read from Redis', err);
        redisAvailable = false;
      });
  }
  return false;
}

export async function isTokenBlacklistedAsync(token: string): Promise<boolean> {
  const hash = hashToken(token);
  if (tokenBlacklist.has(hash)) {
    return true;
  }
  const client = getRedisClient();
  if (!client) {
    return false;
  }
  try {
    const exists = await client.exists(`${BLACKLIST_KEY_PREFIX}${hash}`);
    if (exists) {
      blacklistTokenInMemory(hash, 15 * 60 * 1000);
      return true;
    }
    return false;
  } catch (err) {
    logError('JWT blacklist: failed to read from Redis', err as Error);
    redisAvailable = false;
    return false;
  }
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
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: JWT_ALGORITHMS }) as jwt.JwtPayload;
  return normalizePayload(decoded);
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: JWT_ALGORITHMS }) as jwt.JwtPayload;
  return normalizePayload(decoded);
}

export function generateTokenPair(payload: TokenPayload) {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}
