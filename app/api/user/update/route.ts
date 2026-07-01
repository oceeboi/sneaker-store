import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { authenticateRequest } from '@/lib/auth.middleware';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Notification, {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '@/models/Notification';
import User from '@/models/User';
import UserProfile from '@/models/UserProfile';
import { updateUserSchema } from '@/schemas/user.schemas';

export async function PATCH(req: NextRequest) {
  const auth_result = await authenticateRequest();
  if ('error' in auth_result) {
    return err(auth_result.error ?? 'Unauthorized', 401);
  }

  if (!Types.ObjectId.isValid(auth_result.userId)) {
    return err('Unauthorized: Invalid user id', 401);
  }

  const request_body = await req.json().catch(() => null);

  if (
    request_body &&
    typeof request_body === 'object' &&
    ('password' in request_body ||
      'newPassword' in request_body ||
      'confirmPassword' in request_body)
  ) {
    return err('Password changes are not allowed on this endpoint', 400);
  }

  const validation_result = updateUserSchema.safeParse(request_body);
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
  const payload = validation_result.data;

  const normalized_email = payload.email?.toLowerCase().trim();
  const normalized_username = payload.username?.toLowerCase().trim();

  if (normalized_email) {
    const existing_email_owner = await User.findOne({
      email: normalized_email,
      _id: { $ne: user_id },
    })
      .select('_id')
      .lean();

    if (existing_email_owner) {
      return err('An account with this email already exists', 409);
    }
  }

  if (normalized_username) {
    const existing_username_owner = await User.findOne({
      username: normalized_username,
      _id: { $ne: user_id },
    })
      .select('_id')
      .lean();

    if (existing_username_owner) {
      return err('This username is already taken', 409);
    }
  }

  const user_updates: Record<string, unknown> = {};
  const profile_updates: Record<string, unknown> = {};

  if (normalized_email) {
    user_updates.email = normalized_email;
    // If email changes, require verification again.
    user_updates.emailVerified = false;
  }

  if (normalized_username) {
    user_updates.username = normalized_username;
  }

  const first_name = payload.firstName ?? payload.firstname;
  if (first_name !== undefined) {
    profile_updates.firstName = first_name;
  }

  const last_name = payload.lastName ?? payload.lastname;
  if (last_name !== undefined) {
    profile_updates.lastName = last_name;
  }

  if (payload.phone !== undefined) {
    profile_updates.phone = payload.phone;
    user_updates.phoneVerified = false;
  }

  const avatar_url = payload.avatar ?? payload.image;
  if (avatar_url !== undefined) {
    profile_updates.avatar = avatar_url;
  }

  if (payload.dateOfBirth !== undefined) {
    profile_updates.dateOfBirth = payload.dateOfBirth;
  }

  if (payload.gender !== undefined) {
    profile_updates.gender = payload.gender;
  }

  if (Object.keys(user_updates).length > 0) {
    await User.updateOne({ _id: user_id }, { $set: user_updates });
  }

  if (Object.keys(profile_updates).length > 0) {
    const profile_update_result = await UserProfile.updateOne(
      { userId: user_id },
      { $set: profile_updates }
    );

    if (profile_update_result.matchedCount === 0) {
      return err('User profile not found', 404);
    }
  }

  writeAuditLog({
    userId: user_id,
    action: AuditAction.PROFILE_UPDATED,
    entityType: 'User',
    entityId: user_id.toString(),
    newValues: {
      ...user_updates,
      ...profile_updates,
    },
    ...audit_meta,
  });

  Notification.create({
    userId: user_id,
    type: NotificationType.PROFILE_UPDATED,
    channel: NotificationChannel.IN_APP,
    priority: NotificationPriority.NORMAL,
    title: 'Profile Updated',
    message: 'Your account profile details were updated successfully.',
    metadata: {
      updatedFields: [...Object.keys(user_updates), ...Object.keys(profile_updates)],
      updatedAt: new Date().toISOString(),
      ipAddress: audit_meta.ipAddress,
    },
  }).catch((notification_error: unknown) => {
    console.error('[Notification] profile updated alert failed:', notification_error);
  });

  const [updated_user, updated_profile] = await Promise.all([
    User.findById(user_id)
      .select(
        'email username role status emailVerified phoneVerified lastLoginAt createdAt updatedAt'
      )
      .lean(),
    UserProfile.findOne({ userId: user_id })
      .select(
        'firstName lastName phone avatar dateOfBirth gender referralId accountId createdAt updatedAt'
      )
      .lean(),
  ]);

  if (!updated_user) {
    return err('User not found', 404);
  }

  return ok({
    user: {
      id: updated_user._id.toString(),
      email: updated_user.email,
      username: updated_user.username,
      role: updated_user.role,
      status: updated_user.status,
      emailVerified: updated_user.emailVerified,
      phoneVerified: updated_user.phoneVerified,
      lastLoginAt: updated_user.lastLoginAt,
      createdAt: updated_user.createdAt,
      updatedAt: updated_user.updatedAt,
      profile: updated_profile
        ? {
            firstName: updated_profile.firstName,
            lastName: updated_profile.lastName,
            phone: updated_profile.phone,
            avatar: updated_profile.avatar,
            dateOfBirth: updated_profile.dateOfBirth,
            gender: updated_profile.gender,
            referralId: updated_profile.referralId?.toString() ?? null,
            accountId: updated_profile.accountId?.toString() ?? null,
            createdAt: updated_profile.createdAt,
            updatedAt: updated_profile.updatedAt,
          }
        : null,
    },
  });
}
