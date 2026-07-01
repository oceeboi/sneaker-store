import { NextRequest } from 'next/server';

import User, { UserStatus } from '@/models/User';
import { verifyEmailSchema } from '@/schemas/auth.schemas';
import { hashToken } from '@/lib/auth/password';
import { ok, err, validationErr, requestMeta, writeAuditLog } from '@/lib/auth/response';
import { AuditAction } from '@/models/Auditlog';
import connect_to_database from '@/lib/db';

// ─── POST /api/auth/verify-email ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const request_body = await req.json().catch(() => null);
  const validation_result = verifyEmailSchema.safeParse(request_body);
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

  const { token } = validation_result.data;
  const audit_meta = requestMeta(req);
  const now = new Date();

  // ── Find user by hashed token + check expiry ──────────────────────────────
  const found_user = await User.findOne({
    emailVerifyTokenHash: hashToken(token),
    emailVerifyTokenExp: { $gt: now },
  })
    .select('_id status emailVerified')
    .exec();

  if (!found_user) {
    return err('This verification link is invalid or has expired. Please request a new one.', 400);
  }

  if (found_user.emailVerified) {
    return ok({ message: 'Email already verified.' });
  }

  await User.updateOne(
    { _id: found_user._id },
    {
      $set: {
        emailVerified: true,
        emailVerifyTokenHash: null,
        emailVerifyTokenExp: null,
        // A user who verifies their email while pending becomes active
        ...(found_user.status === UserStatus.PENDING && { status: UserStatus.ACTIVE }),
      },
    }
  );

  writeAuditLog({
    userId: found_user._id,
    action: AuditAction.EMAIL_VERIFIED,
    entityType: 'User',
    entityId: found_user._id.toString(),
    ...audit_meta,
  });

  return ok({ message: 'Email verified. You can now sign in.' });
}
