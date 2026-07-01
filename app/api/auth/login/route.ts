import { NextRequest } from 'next/server';
import { Types } from 'mongoose';

import User, { UserRole, UserStatus } from '@/models/User';
import { loginSchema } from '@/schemas/auth.schemas';
import {
  verifyPassword,
  shouldLockAccount,
  lockExpiryDate,
  isAccountLocked,
} from '@/lib/auth/password';
import {
  issueAccessToken,
  issueRefreshToken,
  hashToken,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  ACCESS_COOKIE_NAME,
  accessCookieOptions,
} from '@/lib/auth/tokens';
import { ok, err, validationErr, requestMeta, writeAuditLog } from '@/lib/auth/response';
import { AuditAction } from '@/models/Auditlog';
import connect_to_database from '@/lib/db';
import { apply_rate_limit, login_limiter, with_login_identifier } from '@/packages/rate-limiter';
import Notification, {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '@/models/Notification';

// rate limiting and account lockout are crucial for preventing brute-force attacks. We implement a simple counter-based lockout mechanism here, which is more secure than just relying on JWT expiry for refresh tokens. The account gets locked after a certain number of failed attempts, and the lock expires after a set duration, allowing the user to try again without needing admin intervention.

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // ── 1. Parse & validate ───────────────────────────────────────────────────
  const request_body = await req.json().catch(() => null);
  const validation_result = loginSchema.safeParse(request_body);

  if (!validation_result.success) {
    const validation_issues = validation_result.error.issues.map((issue) => ({
      path: issue.path.map((segment) =>
        typeof segment === 'symbol' ? segment.toString() : segment
      ) as (string | number)[],
      message: issue.message,
    }));
    return validationErr(validation_issues);
  }
  const { identifier, password } = validation_result.data;
  const keyed_request = with_login_identifier(req, identifier);

  const rate_limited_response = await apply_rate_limit(
    keyed_request,
    login_limiter,
    'Too many login attempts. Please try again shortly.'
  );
  if (rate_limited_response) return rate_limited_response;

  await connect_to_database();

  const audit_meta = requestMeta(req);

  // ── 2. Lookup by email or username ────────────────────────────────────────
  // We fetch passwordHash explicitly (select: false on schema).
  const is_email = identifier.includes('@');

  const found_user = await User.findOne(is_email ? { email: identifier } : { username: identifier })
    .select('+passwordHash +refreshTokenHash')
    .exec();

  // ── 3. User not found — generic error to prevent user enumeration ─────────
  if (!found_user) {
    writeAuditLog({
      action: AuditAction.USER_LOGIN_FAILED,
      metadata: {
        identifier,
        reason: 'user_not_found',
      },
      ...audit_meta,
    });
    return err('Invalid credentials', 401);
  }

  // ── 4. Account lock check ─────────────────────────────────────────────────
  if (isAccountLocked(found_user.lockedUntil)) {
    writeAuditLog({
      userId: found_user._id,
      action: AuditAction.USER_LOGIN_FAILED,
      metadata: { reason: 'account_locked', lockedUntil: found_user.lockedUntil },
      ...audit_meta,
    });
    return err(
      `Account is temporarily locked. Try again after ${found_user.lockedUntil?.toISOString()}.`,
      423
    );
  }

  // ── 5. Status checks ──────────────────────────────────────────────────────
  if (found_user.status === UserStatus.SUSPENDED)
    return err('Account suspended. Contact support.', 403);
  if (found_user.status === UserStatus.CLOSED) return err('Account closed.', 403);

  // ── 6. Password verification ──────────────────────────────────────────────
  const password_matches = await verifyPassword(password, found_user.passwordHash);

  if (!password_matches) {
    const new_attempts = found_user.failedLoginAttempts + 1;
    const should_lock = shouldLockAccount(new_attempts);
    const locked_until = should_lock ? lockExpiryDate() : null;

    await User.updateOne(
      { _id: found_user._id },
      {
        $set: {
          failedLoginAttempts: new_attempts,
          ...(should_lock && {
            status: UserStatus.LOCKED,
            lockedUntil: locked_until,
          }),
        },
      }
    );

    writeAuditLog({
      userId: found_user._id,
      action: should_lock ? AuditAction.ACCOUNT_LOCKED : AuditAction.USER_LOGIN_FAILED,
      metadata: {
        reason: 'wrong_password',
        attempts: new_attempts,
      },
      ...audit_meta,
    });

    if (should_lock && locked_until) {
      notify_admins_account_locked({
        locked_user_id: found_user._id,
        locked_user_email: found_user.email,
        locked_user_username: found_user.username,
        locked_until,
        attempts: new_attempts,
        ip_address: audit_meta.ipAddress,
      }).catch((notification_error: unknown) => {
        console.error('[Notification] account locked alert failed:', notification_error);
      });
    }

    return err('Invalid credentials', 401);
  }

  // ── 7. Issue tokens ───────────────────────────────────────────────────────
  const access_token = issueAccessToken(found_user._id, found_user.username, found_user.role);
  const refresh_token = issueRefreshToken(found_user._id);

  // ── 8. Persist hashed refresh token + reset failure counters ─────────────
  await User.updateOne(
    { _id: found_user._id },
    {
      $set: {
        refreshTokenHash: hashToken(refresh_token),
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        // Promote pending → active on first successful login
        ...(found_user.status === UserStatus.PENDING && { status: UserStatus.ACTIVE }),
      },
    }
  );

  // ── 9. Audit log ──────────────────────────────────────────────────────────
  writeAuditLog({
    userId: found_user._id,
    action: AuditAction.USER_LOGIN,
    entityType: 'User',
    entityId: found_user._id.toString(),
    ...audit_meta,
  });

  // ── 10. Build response — access token in body, refresh in httpOnly cookie ─
  const response_body = ok({
    user: {
      id: found_user._id.toString(),
      email: found_user.email,
      username: found_user.username,
      role: found_user.role,
      status: found_user.status,
      emailVerified: found_user.emailVerified,
    },
    message: 'Login Success',
  });

  response_body.cookies.set(REFRESH_COOKIE_NAME, refresh_token, refreshCookieOptions);
  // add accesstoken to cookie for easier access in client (optional, can also be stored in memory on client)
  response_body.cookies.set(ACCESS_COOKIE_NAME, access_token, accessCookieOptions);

  return response_body;
}

type NotifyAdminsAccountLockedInput = {
  locked_user_id: Types.ObjectId;
  locked_user_email: string;
  locked_user_username: string;
  locked_until: Date;
  attempts: number;
  ip_address: string | null;
};

async function notify_admins_account_locked(input: NotifyAdminsAccountLockedInput): Promise<void> {
  const admin_users = await User.find({
    role: UserRole.ADMIN,
    status: { $ne: UserStatus.CLOSED },
  })
    .select('_id')
    .lean();

  if (!admin_users.length) return;

  await Notification.create(
    admin_users.map((admin_user) => ({
      userId: admin_user._id,
      type: NotificationType.ACCOUNT_LOCKED,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.URGENT,
      title: 'User Account Locked',
      message: `User ${input.locked_user_username} (${input.locked_user_email}) was locked after repeated failed login attempts.`,
      metadata: {
        lockedUserId: input.locked_user_id.toString(),
        lockedUserEmail: input.locked_user_email,
        lockedUserUsername: input.locked_user_username,
        attempts: input.attempts,
        lockedUntil: input.locked_until.toISOString(),
        ipAddress: input.ip_address,
      },
    }))
  );
}
