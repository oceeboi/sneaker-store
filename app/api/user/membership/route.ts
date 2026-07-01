import { Types } from 'mongoose';

import { authenticateRequest } from '@/lib/auth.middleware';
import { err, ok } from '@/lib/auth/response';
import connect_to_database from '@/lib/db';
import Account from '@/models/Account';

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

  const found_account = await Account.findOne({ userId: user_id })
    .select(
      'tier membershipStatus membershipStartedAt membershipEndsAt storeCredit totalSpent loyaltyPoints perksEnabled isActive createdAt updatedAt'
    )
    .lean();

  if (!found_account) {
    return err('Account record not found', 404);
  }

  return ok({
    account: {
      userId: user_id.toString(),
      tier: found_account.tier,
      membershipStatus: found_account.membershipStatus,
      membershipStartedAt: found_account.membershipStartedAt,
      membershipEndsAt: found_account.membershipEndsAt,
      storeCredit: found_account.storeCredit,
      totalSpent: found_account.totalSpent,
      loyaltyPoints: found_account.loyaltyPoints,
      perksEnabled: found_account.perksEnabled,
      isActive: found_account.isActive,
      createdAt: found_account.createdAt,
      updatedAt: found_account.updatedAt,
    },
  });
}
