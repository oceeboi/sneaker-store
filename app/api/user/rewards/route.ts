import { Types } from 'mongoose';

import { err, ok } from '@/lib/auth/response';
import { Permission } from '@/config/rbac';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import Referral from '@/models/Referral';

export async function GET() {
  const authorization = await requirePermission(Permission.REWARDS_READ);
  if (!authorization.ok) {
    return authorization.response;
  }

  if (!Types.ObjectId.isValid(authorization.user.userId)) {
    return err('Unauthorized: Invalid user id', 401);
  }

  await connect_to_database();

  const user_id = new Types.ObjectId(authorization.user.userId);

  const found_referral = await Referral.findOne({ userId: user_id })
    .select(
      'referralCode successfulReferrals pendingReferrals pointsEarned pointsAvailable pointsRedeemed totalRewards isActive lastRewardAt createdAt updatedAt'
    )
    .lean();

  if (!found_referral) {
    return err('Referral record not found', 404);
  }

  return ok({
    referral: {
      userId: user_id.toString(),
      referralCode: found_referral.referralCode,
      successfulReferrals: found_referral.successfulReferrals,
      pendingReferrals: found_referral.pendingReferrals,
      pointsEarned: found_referral.pointsEarned,
      pointsAvailable: found_referral.pointsAvailable,
      pointsRedeemed: found_referral.pointsRedeemed,
      totalRewards: found_referral.totalRewards,
      isActive: found_referral.isActive,
      lastRewardAt: found_referral.lastRewardAt,
      createdAt: found_referral.createdAt,
      updatedAt: found_referral.updatedAt,
    },
  });
}
