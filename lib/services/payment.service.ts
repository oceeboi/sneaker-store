// lib/services/payment.service.ts
import { Types } from 'mongoose';

import { AuditAction } from '@/models/Auditlog';
import { writeAuditLog } from '@/lib/auth/response';
import Account from '@/models/Account';
import Cart from '@/models/Cart';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import { award_points_for_order } from '@/lib/services/loyalty.service';

// ─── Stock movements ────────────────────────────────────────────────────────────

export async function commit_item_stock(
  productId: Types.ObjectId,
  sizeId: Types.ObjectId,
  quantity: number
) {
  await Product.updateOne(
    { _id: productId, 'sizes._id': sizeId },
    { $inc: { 'sizes.$.stockQuantity': -quantity, 'sizes.$.reservedQuantity': -quantity } }
  );
}

export async function release_item_stock(
  productId: Types.ObjectId,
  sizeId: Types.ObjectId,
  quantity: number
) {
  await Product.updateOne(
    { _id: productId, 'sizes._id': sizeId },
    { $inc: { 'sizes.$.reservedQuantity': -quantity } }
  );
}

// ─── Verify a reference directly against Paystack — never trust a body alone ──

export async function verify_transaction_with_paystack(reference: string): Promise<{
  verified: boolean;
  status?: string;
  amount?: number;
  channel?: string;
  paidAt?: string;
  raw?: Record<string, unknown>;
}> {
  try {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      }
    );
    const json = await res.json();
    if (!res.ok || !json?.data) return { verified: false };

    return {
      verified: true,
      status: json.data.status,
      amount: json.data.amount,
      channel: json.data.channel,
      paidAt: json.data.paid_at,
      raw: json.data,
    };
  } catch {
    return { verified: false };
  }
}

// ─── SUCCESS — the one and only place stock gets committed, cart cleared, ─────
// points awarded. Called from the webhook AND from checkout-initialize's
// recover-before-cancel path. Idempotent: checks transaction.status first.

export async function process_successful_payment(
  order: InstanceType<typeof Order>,
  transaction: InstanceType<typeof Transaction>,
  verification: Awaited<ReturnType<typeof verify_transaction_with_paystack>>,
  source: 'webhook' | 'recovery'
) {
  if (transaction.status === 'success') {
    return { alreadyProcessed: true, pointsAwarded: 0 };
  }

  if (verification.amount !== undefined && verification.amount !== transaction.amount) {
    transaction.status = 'failed';
    transaction.failureReason = `Amount mismatch: expected ${transaction.amount}, Paystack reported ${verification.amount}`;
    transaction.gatewayResponse = verification.raw ?? null;
    await transaction.save();

    writeAuditLog({
      userId: order.user,
      actorId: null,
      action: AuditAction.PAYMENT_FAILED,
      entityType: 'Transaction',
      entityId: transaction._id.toString(),
      oldValues: {},
      newValues: { reason: 'amount_mismatch', source },
      metadata: { resource: source, reference: transaction.reference },
    });

    return { alreadyProcessed: false, amountMismatch: true, pointsAwarded: 0 };
  }

  transaction.status = 'success';
  transaction.paystackReference = String(verification.raw?.id ?? '');
  transaction.channel = verification.channel ?? null;
  transaction.paidAt = verification.paidAt ? new Date(verification.paidAt) : new Date();
  transaction.verifiedAt = new Date();
  transaction.gatewayResponse = verification.raw ?? null;
  await transaction.save();

  for (const item of order.items) {
    await commit_item_stock(item.product, item.sizeId, item.quantity);
  }

  order.status = 'paid';
  order.transaction = transaction._id;
  await order.save();

  await Cart.updateOne(
    { user: order.user, status: 'active' },
    { $set: { items: [], status: 'converted' } }
  );

  const loyalty_result = await award_points_for_order(order.user, order.total);

  writeAuditLog({
    userId: order.user,
    actorId: null,
    action: AuditAction.PAYMENT_SUCCESS,
    entityType: 'Order',
    entityId: order._id.toString(),
    oldValues: { status: 'pending_payment' },
    newValues: { status: 'paid', pointsAwarded: loyalty_result.pointsAwarded, source },
    metadata: { resource: source, reference: transaction.reference },
  });

  return { alreadyProcessed: false, pointsAwarded: loyalty_result.pointsAwarded };
}

// ─── FAILURE — release stock, refund credit, cancel order. Idempotent too. ────

export async function process_failed_payment(
  order: InstanceType<typeof Order>,
  transaction: InstanceType<typeof Transaction>,
  reason: string,
  gatewayResponse: Record<string, unknown> | null,
  source: 'webhook' | 'recovery' | 'timeout'
) {
  if (transaction.status === 'failed' || order.status === 'cancelled') {
    return { alreadyProcessed: true };
  }

  transaction.status = 'failed';
  transaction.failureReason = reason;
  transaction.gatewayResponse = gatewayResponse;
  await transaction.save();

  for (const item of order.items) {
    await release_item_stock(item.product, item.sizeId, item.quantity);
  }

  const credit_applied = order.subtotal - order.discount + order.shippingFee - order.total;
  if (credit_applied > 0) {
    await Account.updateOne({ userId: order.user }, { $inc: { storeCredit: credit_applied } });
  }

  order.status = 'cancelled';
  order.cancelledAt = new Date();
  order.cancelReason = reason;
  await order.save();

  writeAuditLog({
    userId: order.user,
    actorId: null,
    action: AuditAction.PAYMENT_FAILED,
    entityType: 'Order',
    entityId: order._id.toString(),
    oldValues: { status: 'pending_payment' },
    newValues: { status: 'cancelled', reason, source },
    metadata: { resource: source, reference: transaction.reference },
  });

  return { alreadyProcessed: false };
}

// ─── Recovery — verify-before-cancel, used by checkout-initialize AND the ─────
// future timeout cron, instead of ever blindly cancelling a stale order.

export async function resolve_stale_pending_order(
  staleOrder: InstanceType<typeof Order>
): Promise<{ resolved: 'recovered_as_paid' | 'cancelled' | 'no_transaction' }> {
  const staleTransaction = await Transaction.findOne({ order: staleOrder._id }).sort({
    createdAt: -1,
  });

  if (!staleTransaction) {
    staleOrder.status = 'cancelled';
    staleOrder.cancelledAt = new Date();
    staleOrder.cancelReason = 'No transaction found for pending order';
    await staleOrder.save();
    return { resolved: 'no_transaction' };
  }

  if (staleTransaction.status === 'success') {
    // Already resolved successfully by something else (e.g. a webhook that
    // arrived just before this check ran) — nothing to do.
    return { resolved: 'recovered_as_paid' };
  }

  const verification = await verify_transaction_with_paystack(staleTransaction.reference);

  if (verification.verified && verification.status === 'success') {
    await process_successful_payment(staleOrder, staleTransaction, verification, 'recovery');
    return { resolved: 'recovered_as_paid' };
  }

  const failure_reason = verification.verified
    ? `Verified as ${verification.status ?? 'unsuccessful'} with Paystack`
    : 'Payment never confirmed and could not be verified with Paystack';

  await process_failed_payment(
    staleOrder,
    staleTransaction,
    failure_reason,
    verification.raw ?? null,
    'recovery'
  );

  return { resolved: 'cancelled' };
}
