import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';

import User, { UserStatus } from '@/models/User';
import {
  verifyRefreshToken,
  issueAccessToken,
  issueRefreshToken,
  hashToken,
  REFRESH_COOKIE_NAME,
  ACCESS_COOKIE_NAME,
  refreshCookieOptions,
  accessCookieOptions,
  clearRefreshCookieOptions,
  clearAccessCookieOptions,
} from '@/lib/auth/tokens';
import { ok, err, requestMeta, writeAuditLog } from '@/lib/auth/response';
import { AuditAction } from '@/models/Auditlog';
import connect_to_database from '@/lib/db';

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const audit_meta = requestMeta(req);
  const refresh_token = req.cookies.get(REFRESH_COOKIE_NAME)?.value ?? null;

  // ── 1. Cookie present? ────────────────────────────────────────────────────
  if (!refresh_token) {
    return err('No session found. Please sign in.', 401);
  }

  // ── 2. JWT signature + expiry check ──────────────────────────────────────
  const verification_result = verifyRefreshToken(refresh_token);

  if (!verification_result.ok) {
    return clear_and_err(
      verification_result.reason === 'expired'
        ? 'Your session has expired. Please sign in again.'
        : 'Invalid session. Please sign in again.',
      401
    );
  }

  if (!Types.ObjectId.isValid(verification_result.payload.sub)) {
    return clear_and_err('Invalid session. Please sign in again.', 401);
  }

  await connect_to_database();

  const user_id = new Types.ObjectId(verification_result.payload.sub);

  // ── 3. DB lookup ──────────────────────────────────────────────────────────
  const found_user = await User.findById(user_id).select('+refreshTokenHash').exec();

  if (!found_user) {
    // JWT was valid but no user record — deleted account or tampered sub claim.
    return clear_and_err('Session invalid. Please sign in again.', 401);
  }

  // ── 4. Token hash check (replay / theft detection) ────────────────────────
  // If we have a stored hash it MUST match the incoming token.
  // A mismatch means either:
  //   a) The token was already rotated (legitimate re-use after network failure), or
  //   b) A stolen token is being replayed after the real user already rotated it.
  // Either way, kill the session — legitimate clients will be asked to re-login.
  if (!found_user.refreshTokenHash) {
    return clear_and_err('Session invalid. Please sign in again.', 401);
  }

  const incoming_hash = hashToken(refresh_token);
  if (found_user.refreshTokenHash !== incoming_hash) {
    // Aggressively invalidate — wipe stored hash so the real token is also dead.
    await User.updateOne({ _id: user_id }, { $set: { refreshTokenHash: null } });
    return clear_and_err('Session conflict detected. Please sign in again.', 401);
  }

  // ── 5. Account status check ───────────────────────────────────────────────
  const blocked_statuses: UserStatus[] = [
    UserStatus.SUSPENDED,
    UserStatus.LOCKED,
    UserStatus.CLOSED,
  ];
  if (blocked_statuses.includes(found_user.status)) {
    await User.updateOne({ _id: user_id }, { $set: { refreshTokenHash: null } });
    return clear_and_err('Account access has been revoked. Please contact support.', 403);
  }

  // ── 6. Rotate — issue a new token pair ───────────────────────────────────
  // The old refresh token is dead the moment we write the new hash.
  const new_access_token = issueAccessToken(found_user._id, found_user.username, found_user.role);
  const new_refresh_token = issueRefreshToken(found_user._id);

  await User.updateOne(
    { _id: user_id },
    { $set: { refreshTokenHash: hashToken(new_refresh_token) } }
  );

  // Fire-and-forget — audit log must never block the token response.
  writeAuditLog({
    userId: user_id,
    action: AuditAction.TOKEN_REFRESHED,
    entityType: 'User',
    entityId: user_id.toString(),
    ...audit_meta,
  });

  // ── 7. Respond with new tokens ────────────────────────────────────────────
  const response_body = ok({ role: found_user.role });
  response_body.cookies.set(REFRESH_COOKIE_NAME, new_refresh_token, refreshCookieOptions);
  response_body.cookies.set(ACCESS_COOKIE_NAME, new_access_token, accessCookieOptions);
  return response_body;
}

// ─── Helper ───────────────────────────────────────────────────────────────────
// Clears BOTH cookies (each with its own matching path) before returning an error.
// This is the correct fix for the clearCookieOptions path-mismatch bug.
function clear_and_err(message: string, status: 401 | 403): NextResponse {
  const response_body = err(message, status);
  response_body.cookies.set(REFRESH_COOKIE_NAME, '', clearRefreshCookieOptions);
  response_body.cookies.set(ACCESS_COOKIE_NAME, '', clearAccessCookieOptions);
  return response_body;
}
