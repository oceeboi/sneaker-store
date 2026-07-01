import { NextRequest } from 'next/server';
import { Types } from 'mongoose';

import { authenticateRequest } from '@/lib/auth.middleware';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Notification, {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '@/models/Notification';
import User from '@/models/User';
import { passwordChangeSchema } from '@/schemas/user.schemas';

// ─── POST /api/user/password-change ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth_result = await authenticateRequest();
  if ('error' in auth_result) {
    return err(auth_result.error ?? 'Unauthorized', 401);
  }

  if (!Types.ObjectId.isValid(auth_result.userId)) {
    return err('Unauthorized: Invalid user id', 401);
  }

  const request_body = await req.json().catch(() => null);
  const validation_result = passwordChangeSchema.safeParse(request_body);

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

  const audit_meta = requestMeta(req);
  const user_id = new Types.ObjectId(auth_result.userId);
  const { currentPassword, newPassword } = validation_result.data;

  const found_user = await User.findById(user_id)
    .select('+passwordHash refreshTokenHash email username status emailVerified')
    .exec();

  if (!found_user) {
    return err('User not found', 404);
  }

  const current_password_matches = await verifyPassword(currentPassword, found_user.passwordHash);
  if (!current_password_matches) {
    return err('Current password is incorrect', 401);
  }

  const new_password_hash = await hashPassword(newPassword);

  await User.updateOne(
    { _id: user_id },
    {
      $set: {
        passwordHash: new_password_hash,
        refreshTokenHash: null,
        passwordResetTokenHash: null,
        passwordResetTokenExp: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    }
  );

  writeAuditLog({
    userId: user_id,
    action: AuditAction.PASSWORD_CHANGED,
    entityType: 'User',
    entityId: user_id.toString(),
    ...audit_meta,
  });

  notify_password_changed({
    user_id,
    email: found_user.email,
    username: found_user.username,
    ip_address: audit_meta.ipAddress,
  }).catch((notification_error: unknown) => {
    console.error('[Notification] password changed alert failed:', notification_error);
  });

  return ok({ message: 'Password updated successfully. You can now sign in again.' });
}

type NotifyPasswordChangedInput = {
  user_id: Types.ObjectId;
  email: string;
  username: string;
  ip_address: string | null;
};

async function notify_password_changed(input: NotifyPasswordChangedInput): Promise<void> {
  await Notification.create({
    userId: input.user_id,
    type: NotificationType.PASSWORD_CHANGED,
    channel: NotificationChannel.IN_APP,
    priority: NotificationPriority.URGENT,
    title: 'Password Changed',
    message: 'Your account password was changed successfully.',
    metadata: {
      userId: input.user_id.toString(),
      email: input.email,
      username: input.username,
      ipAddress: input.ip_address,
      changedAt: new Date().toISOString(),
    },
  });
}
