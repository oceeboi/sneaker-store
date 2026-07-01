import { Types } from 'mongoose';

import { authenticateRequest } from '@/lib/auth.middleware';
import { err, ok } from '@/lib/auth/response';
import connect_to_database from '@/lib/db';
import User from '@/models/User';
import UserProfile from '@/models/UserProfile';

export async function GET() {
  const auth_result = await authenticateRequest();
  if ('error' in auth_result) {
    return err(auth_result.error ?? 'Unauthorized', 401);
  }

  if (!Types.ObjectId.isValid(auth_result.userId)) {
    return err('Unauthorized: Invalid user id', 401);
  }

  await connect_to_database();

  const user_id = new Types.ObjectId(auth_result.userId);

  const [found_user, found_user_profile] = await Promise.all([
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

  if (!found_user) {
    return err('User not found', 404);
  }

  return ok({
    user: {
      id: found_user._id.toString(),
      email: found_user.email,
      username: found_user.username,
      role: found_user.role,
      status: found_user.status,
      emailVerified: found_user.emailVerified,
      phoneVerified: found_user.phoneVerified,
      lastLoginAt: found_user.lastLoginAt,
      createdAt: found_user.createdAt,
      updatedAt: found_user.updatedAt,
      profile: found_user_profile
        ? {
            firstName: found_user_profile.firstName,
            lastName: found_user_profile.lastName,
            phone: found_user_profile.phone,
            avatar: found_user_profile.avatar,
            dateOfBirth: found_user_profile.dateOfBirth,
            gender: found_user_profile.gender,
            referralId: found_user_profile.referralId?.toString() ?? null,
            accountId: found_user_profile.accountId?.toString() ?? null,
            createdAt: found_user_profile.createdAt,
            updatedAt: found_user_profile.updatedAt,
          }
        : null,
    },
  });
}
