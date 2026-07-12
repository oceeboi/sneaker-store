import mongoose, { Types } from 'mongoose';

import { AuditAction } from '@/models/Auditlog';
import { writeAuditLog } from '@/lib/auth/response';
import Account from '@/models/Account';
import Cart from '@/models/Cart';
import Order, { type IOrder } from '@/models/Order';
import Product from '@/models/Product';
import Transaction, { type ITransaction } from '@/models/Transaction';
import { award_points_for_order } from '@/lib/services/loyalty.service';

// ─── Stock movements ────────────────────────────────────────────────────────────

export async function commit_item_stock(
  productId: Types.ObjectId,
  sizeId: Types.ObjectId,
  quantity: number,
  session?: mongoose.mongo.ClientSession
): Promise<boolean> {
  const result = await Product.updateOne(
    {
      _id: productId,
      sizes: {
        $elemMatch: {
          _id: sizeId,
          stockQuantity: { $gte: quantity },
          reservedQuantity: { $gte: quantity },
        },
      },
    },
    { $inc: { 'sizes.$.stockQuantity': -quantity, 'sizes.$.reservedQuantity': -quantity } },
    session ? { session } : undefined
  );

  return result.modifiedCount > 0;
}

export async function release_item_stock(
  productId: Types.ObjectId,
  sizeId: Types.ObjectId,
  quantity: number,
  session?: mongoose.mongo.ClientSession
): Promise<boolean> {
  const result = await Product.updateOne(
    {
      _id: productId,
      sizes: {
        $elemMatch: {
          _id: sizeId,
          reservedQuantity: { $gte: quantity },
        },
      },
    },
    { $inc: { 'sizes.$.reservedQuantity': -quantity } },
    session ? { session } : undefined
  );

  return result.modifiedCount > 0;
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
  order: IOrder,
  transaction: ITransaction,
  verification: Awaited<ReturnType<typeof verify_transaction_with_paystack>>,
  source: 'webhook' | 'recovery'
) {
  if (verification.amount !== undefined && verification.amount !== transaction.amount) {
    const failure_reason = `Amount mismatch: expected ${transaction.amount}, Paystack reported ${verification.amount}`;
    const failure_result = await process_failed_payment(
      order,
      transaction,
      failure_reason,
      verification.raw ?? null,
      source
    );

    return {
      ...failure_result,
      amountMismatch: true,
      pointsAwarded: 0,
    };
  }

  const session = await mongoose.startSession();
  let already_processed = false;

  try {
    await session.withTransaction(async () => {
      const transaction_update = await Transaction.updateOne(
        { _id: transaction._id, status: 'pending' },
        {
          $set: {
            status: 'success',
            paystackReference: String(verification.raw?.id ?? ''),
            channel: verification.channel ?? null,
            paidAt: verification.paidAt ? new Date(verification.paidAt) : new Date(),
            verifiedAt: new Date(),
            gatewayResponse: verification.raw ?? null,
          },
        },
        { session }
      );

      if (transaction_update.modifiedCount === 0) {
        already_processed = true;
        return;
      }

      for (const item of order.items) {
        const committed = await commit_item_stock(
          item.product,
          item.sizeId,
          item.quantity,
          session
        );

        if (!committed) {
          throw new Error(`Unable to commit reserved stock for order ${order._id.toString()}`);
        }
      }

      const order_update = await Order.updateOne(
        { _id: order._id, status: 'pending_payment' },
        {
          $set: {
            status: 'paid',
            transaction: transaction._id,
            cancelledAt: null,
            cancelReason: null,
          },
        },
        { session }
      );

      if (order_update.modifiedCount === 0) {
        throw new Error(`Unable to mark order ${order._id.toString()} as paid`);
      }

      await Cart.updateOne(
        { user: order.user, status: 'active' },
        { $set: { items: [], status: 'converted' } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  if (already_processed) {
    return { alreadyProcessed: true, pointsAwarded: 0 };
  }

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
  order: IOrder,
  transaction: ITransaction,
  reason: string,
  gatewayResponse: Record<string, unknown> | null,
  source: 'webhook' | 'recovery' | 'timeout' | 'initialize' | 'admin'
) {
  const session = await mongoose.startSession();
  let already_processed = false;

  try {
    await session.withTransaction(async () => {
      const transaction_update = await Transaction.updateOne(
        { _id: transaction._id, status: 'pending' },
        {
          $set: {
            status: 'failed',
            failureReason: reason,
            gatewayResponse: gatewayResponse,
            verifiedAt: new Date(),
          },
        },
        { session }
      );

      if (transaction_update.modifiedCount === 0) {
        already_processed = true;
        return;
      }

      for (const item of order.items) {
        const released = await release_item_stock(
          item.product,
          item.sizeId,
          item.quantity,
          session
        );

        if (!released) {
          const product = await Product.findOne({
            _id: item.product,
            'sizes._id': item.sizeId,
          })
            .select('sizes._id sizes.reservedQuantity')
            .session(session)
            .lean();

          const size_exists = Boolean(
            product?.sizes?.some((size) => size._id?.toString() === item.sizeId.toString())
          );

          if (!size_exists) {
            throw new Error(`Unable to release reserved stock for order ${order._id.toString()}`);
          }
        }
      }

      const credit_applied = order.subtotal - order.discount + order.shippingFee - order.total;
      if (credit_applied > 0) {
        await Account.updateOne(
          { userId: order.user },
          { $inc: { storeCredit: credit_applied } },
          { session }
        );
      }

      const order_update = await Order.updateOne(
        { _id: order._id, status: 'pending_payment' },
        {
          $set: {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelReason: reason,
            transaction: transaction._id,
          },
        },
        { session }
      );

      if (order_update.modifiedCount === 0) {
        throw new Error(`Unable to cancel order ${order._id.toString()}`);
      }
    });
  } finally {
    await session.endSession();
  }

  if (already_processed) {
    return { alreadyProcessed: true };
  }

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
  staleOrder: IOrder
): Promise<{ resolved: 'recovered_as_paid' | 'cancelled' | 'no_transaction' }> {
  const staleTransaction = await Transaction.findOne({ order: staleOrder._id }).sort({
    createdAt: -1,
  });
  console.log('resolve_stale_pending_order', {
    orderId: staleOrder._id.toString(),
    transactionId: staleTransaction?._id.toString() ?? null,
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
