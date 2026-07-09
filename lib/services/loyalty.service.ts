import PlatformSettings from '@/models/PlatformSettings';
import Account from '@/models/Account';
import Order from '@/models/Order';
import { Types } from 'mongoose';

async function get_settings() {
  // Upsert-on-read: guarantees a settings doc always exists, admin doesn't
  // need a separate "seed the database" step before this works.
  let settings = await PlatformSettings.findOne();
  if (!settings) {
    settings = await PlatformSettings.create({});
  }
  return settings;
}

// ─── Points earned from a completed order ─────────────────────────────────────

export async function calculate_points_earned(order_total_kobo: number): Promise<number> {
  const settings = await get_settings();
  if (!settings.rewardsEnabled) return 0;

  const naira_spent = order_total_kobo / 100;
  const thousands_spent = Math.floor(naira_spent / 1000);
  return thousands_spent * settings.pointsPerNaira1000;
}

// ─── Award points + update totalSpent after a successful payment ─────────────
// Called once, from the Paystack webhook, on charge.success — never from
// checkout-initialize (points are earned on confirmed payment, not intent).

export async function award_points_for_order(userId: Types.ObjectId, orderTotalKobo: number) {
  const settings = await get_settings();
  if (!settings.rewardsEnabled) return { pointsAwarded: 0, totalSpentUpdated: false };

  const points_earned = await calculate_points_earned(orderTotalKobo);

  await Account.updateOne(
    { userId },
    {
      $inc: {
        totalSpent: orderTotalKobo,
        loyaltyPoints: points_earned,
      },
    },
    { upsert: true } // in case the Account doc doesn't exist yet for this user
  );

  return { pointsAwarded: points_earned, totalSpentUpdated: true };
}

// ─── Convert a points balance into naira credit value, in whole blocks only ──
// e.g. 300 points = ₦25,000. 450 points redeems as one block (300 pts →
// ₦25,000), leaving 150 points unredeemed — no fractional-point payouts,
// keeps the math clean and disputes simple.

export function points_to_credit_value(
  points: number,
  redemptionBlock: number,
  redemptionValue: number
): { blocksRedeemable: number; pointsUsed: number; creditValueNaira: number } {
  const blocks_redeemable = Math.floor(points / redemptionBlock);
  return {
    blocksRedeemable: blocks_redeemable,
    pointsUsed: blocks_redeemable * redemptionBlock,
    creditValueNaira: blocks_redeemable * redemptionValue,
  };
}

// ─── Redeem points into Account.storeCredit ───────────────────────────────────
// A deliberate user action (not automatic) — customer chooses to convert
// points into spendable credit. Kept separate from earning, since a customer
// might want to bank points toward a bigger reward rather than cash out early.

export async function redeem_points_to_credit(userId: Types.ObjectId) {
  const settings = await get_settings();
  if (!settings.rewardsEnabled) {
    return { redeemed: false, reason: 'Rewards program is currently disabled' };
  }

  const account = await Account.findOne({ userId });
  if (!account) return { redeemed: false, reason: 'Account not found' };

  const { blocksRedeemable, pointsUsed, creditValueNaira } = points_to_credit_value(
    account.loyaltyPoints,
    settings.pointsRedemptionBlock,
    settings.pointsRedemptionValue
  );

  if (blocksRedeemable === 0) {
    return {
      redeemed: false,
      reason: `Need at least ${settings.pointsRedemptionBlock} points to redeem (have ${account.loyaltyPoints})`,
    };
  }

  const credit_value_kobo = creditValueNaira * 100;

  account.loyaltyPoints -= pointsUsed;
  account.storeCredit += credit_value_kobo;
  await account.save();

  return {
    redeemed: true,
    pointsUsed,
    creditAddedKobo: credit_value_kobo,
    remainingPoints: account.loyaltyPoints,
    newStoreCreditKobo: account.storeCredit,
  };
}

// ─── New-customer 5% discount — independent of points, its own toggle ────────

export async function calculate_new_customer_discount(
  userId: Types.ObjectId,
  subtotalKobo: number
): Promise<{ applies: boolean; discountKobo: number; percent: number }> {
  const settings = await get_settings();
  if (!settings.newCustomerDiscountEnabled) {
    return { applies: false, discountKobo: 0, percent: 0 };
  }

  // "New customer" = zero prior orders that ever reached 'paid' or beyond —
  // a cancelled/pending_payment order doesn't count as having purchased before.
  const has_previous_paid_order = await Order.exists({
    user: userId,
    status: { $in: ['paid', 'processing', 'shipped', 'delivered'] },
  });

  if (has_previous_paid_order) {
    return { applies: false, discountKobo: 0, percent: 0 };
  }

  const discount_kobo = Math.round(subtotalKobo * (settings.newCustomerDiscountPercent / 100));
  return {
    applies: true,
    discountKobo: discount_kobo,
    percent: settings.newCustomerDiscountPercent,
  };
}
