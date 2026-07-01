import { Types } from 'mongoose';

import { authenticateRequest } from '@/lib/auth.middleware';
import { err, ok } from '@/lib/auth/response';
import connect_to_database from '@/lib/db';
import Referral from '@/models/Referral';

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
