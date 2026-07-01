import { NextRequest } from 'next/server';

import User from '@/models/User';
import { resetPasswordSchema } from '@/schemas/auth.schemas';
import { hashPassword, hashToken } from '@/lib/auth/password';
import { ok, err, validationErr, requestMeta, writeAuditLog } from '@/lib/auth/response';
import { AuditAction } from '@/models/Auditlog';
import connect_to_database from '@/lib/db';

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  const request_body = await req.json().catch(() => null);
  const validation_result = resetPasswordSchema.safeParse(request_body);

  if (!validation_result.success) {
    const validation_issues = validation_result.error.issues.map((issue) => ({
      path: issue.path.map((segment) =>
        typeof segment === 'symbol' ? segment.toString() : segment
      ) as (string | number)[],
      message: issue.message,
    }));
    return validationErr(validation_issues);
  }

  await connect_to_database();

  const { token, password } = validation_result.data;
  const audit_meta = requestMeta(req);
  const now = new Date();

  // ── 1. Find user by hashed token + check expiry ───────────────────────────
  const found_user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetTokenExp: { $gt: now }, // must not be expired
  })
    .select('_id email status passwordResetTokenExp')
    .exec();

  if (!found_user) {
    return err('This reset link is invalid or has expired. Please request a new one.', 400);
  }

  // ── 2. Hash new password and clear the token ──────────────────────────────
  const new_password_hash = await hashPassword(password);

  await User.updateOne(
    { _id: found_user._id },
    {
      $set: {
        passwordHash: new_password_hash,
        // Invalidate all existing sessions by clearing the refresh token
        refreshTokenHash: null,
        // Clear the used reset token
        passwordResetTokenHash: null,
        passwordResetTokenExp: null,
        // Reset lockout state
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }
  );

  writeAuditLog({
    userId: found_user._id,
    action: AuditAction.PASSWORD_RESET_COMPLETE,
    entityType: 'User',
    entityId: found_user._id.toString(),
    ...audit_meta,
  });

  return ok({ message: 'Password updated successfully. You can now sign in.' });
}
