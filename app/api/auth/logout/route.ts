import { NextRequest } from 'next/server';

import User from '@/models/User';
import {
  verifyRefreshToken,
  hashToken,
  REFRESH_COOKIE_NAME,
  clearRefreshCookieOptions,
  clearAccessCookieOptions,
  ACCESS_COOKIE_NAME,
} from '@/lib/auth/tokens';
import { ok, requestMeta, writeAuditLog } from '@/lib/auth/response';
import { AuditAction } from '@/models/Auditlog';
import { Types } from 'mongoose';
import connect_to_database from '@/lib/db';

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const audit_meta = requestMeta(req);
  const refresh_token = req.cookies.get(REFRESH_COOKIE_NAME)?.value ?? null;

  // Even if there's no cookie we clear it and respond 200 —
  // the client state should be cleared regardless.
  if (!refresh_token) {
    return clear_refresh_cookie(ok({ message: 'Logged out' }));
  }

  const verification_result = verifyRefreshToken(refresh_token);

  if (!verification_result.ok) {
    return clear_refresh_cookie(ok({ message: 'Logged out' }));
  }

  if (!Types.ObjectId.isValid(verification_result.payload.sub)) {
    return clear_refresh_cookie(ok({ message: 'Logged out' }));
  }

  await connect_to_database();

  const user_id = new Types.ObjectId(verification_result.payload.sub);

  // Invalidate the stored refresh token so it can never be replayed,
  // even if someone captured it from a cookie jar.
  await User.updateOne(
    { _id: user_id, refreshTokenHash: hashToken(refresh_token) }, // the hash is just an extra safety check — the token must match the current valid one before we clear it
    { $set: { refreshTokenHash: null } }
  );

  writeAuditLog({
    userId: user_id,
    action: AuditAction.USER_LOGOUT,
    entityType: 'User',
    entityId: user_id.toString(),
    ...audit_meta,
  });

  return clear_refresh_cookie(ok({ message: 'Logged out' }));
}

// ─── Helper ───────────────────────────────────────────────────────────────────
const clear_refresh_cookie = <T>(response_body: ReturnType<typeof ok<T>>) => {
  // ensure immediate removal by forcing maxAge=0 and an epoch expiry,
  // while preserving other clear options (secure, httpOnly, path, domain, sameSite)
  //const fastClearOptions = { ...clearCookieOptions, maxAge: 0, expires: new Date(0) };

  response_body.cookies.set(REFRESH_COOKIE_NAME, '', clearRefreshCookieOptions);
  response_body.cookies.set(ACCESS_COOKIE_NAME, '', clearAccessCookieOptions);

  return response_body;
};
