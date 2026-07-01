import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { UserRole } from '@/models/User';
import crypto from 'crypto';

// ─── Environment guard ────────────────────────────────────────────────────────
// Fail loudly at startup if secrets are missing — never silently fall back to
// a weak default.
const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

// ─── Token config ─────────────────────────────────────────────────────────────
const ACCESS_TOKEN_SECRET = requireEnv('JWT_ACCESS_SECRET');
const REFRESH_TOKEN_SECRET = requireEnv('JWT_REFRESH_SECRET');

export const ACCESS_TOKEN_TTL = '15m'; // short-lived — lives in memory
export const REFRESH_TOKEN_TTL = '7d'; // long-lived  — lives in httpOnly cookie

// ─── Payload types ────────────────────────────────────────────────────────────
export type AccessTokenPayload = {
  sub: string; // userId as string
  username: string;
  role: UserRole;
  type: 'access';
};

export type RefreshTokenPayload = {
  sub: string; // userId as string
  type: 'refresh';
};

// ─── Issue tokens ─────────────────────────────────────────────────────────────

export const issueAccessToken = (
  userId: Types.ObjectId,
  username: string,
  role: UserRole
): string =>
  jwt.sign(
    { sub: userId.toString(), username, role, type: 'access' } satisfies AccessTokenPayload,
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL, algorithm: 'HS256' }
  );

export const issueRefreshToken = (userId: Types.ObjectId): string =>
  jwt.sign(
    { sub: userId.toString(), type: 'refresh' } satisfies RefreshTokenPayload,
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL, algorithm: 'HS256' }
  );

// ─── Verify tokens ────────────────────────────────────────────────────────────
// Returns a discriminated union — callers must handle both cases.

type VerifyResult<T> = { ok: true; payload: T } | { ok: false; reason: 'expired' | 'invalid' };

export const verifyAccessToken = (token: string): VerifyResult<AccessTokenPayload> => {
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET) as AccessTokenPayload;
    return payload.type === 'access' ? { ok: true, payload } : { ok: false, reason: 'invalid' };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof jwt.TokenExpiredError ? 'expired' : 'invalid',
    };
  }
};

export const verifyRefreshToken = (token: string): VerifyResult<RefreshTokenPayload> => {
  try {
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
    return payload.type === 'refresh' ? { ok: true, payload } : { ok: false, reason: 'invalid' };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof jwt.TokenExpiredError ? 'expired' : 'invalid',
    };
  }
};

// ─── Cookie config ────────────────────────────────────────────────────────────
// Centralised so every route uses identical cookie settings.

export const REFRESH_COOKIE_NAME = requireEnv('REFRESH_COOKIE_NAME') || 'refresh_token';

export const refreshCookieOptions = {
  httpOnly: true, // JS cannot read this
  secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
  sameSite: 'lax' as const,
  path: '/api/auth/refresh', // scoped — not sent on every request
  maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
};

export const ACCESS_COOKIE_NAME = requireEnv('ACCESS_COOKIE_NAME') || 'access_token';

export const accessCookieOptions = {
  httpOnly: false, // accessible to JS (optional, can also be stored in memory on client)
  secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
  sameSite: 'lax' as const,
  path: '/', // scoped — not sent on every request
  maxAge: 60 * 15, // 15 minutes in seconds
};

// Each cookie must be cleared with the exact path it was set with.
export const clearRefreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth/refresh', // ← matches refreshCookieOptions exactly
  maxAge: 0,
  expires: new Date(0),
} as const;

export const clearAccessCookieOptions = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/', // ← matches accessCookieOptions exactly
  maxAge: 0,
  expires: new Date(0),
} as const;

const HMAC_ALGO = 'sha256';
const SECRET = requireEnv('TOKEN_HASH_SECRET');

export const hashToken = (raw: string): string => {
  if (raw === undefined || raw === null) throw new Error('raw token required');
  return crypto.createHmac(HMAC_ALGO, SECRET).update(String(raw)).digest('hex');
};

export const verifyHashedToken = (raw: string, hash: string): boolean => {
  const computedHash = hashToken(raw);
  return computedHash === hash;
};
