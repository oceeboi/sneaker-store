import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import { writeAuditLog } from '@/lib/auth/response';
import Account from '@/models/Account';
import Cart from '@/models/Cart';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import { award_points_for_order } from '@/lib/services/loyalty.service';
import { Types } from 'mongoose';

// ─── Signature verification ────────────────────────────────────────────────────

function verify_paystack_signature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const expected_hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY as string)
    .update(rawBody)
    .digest('hex');

  // timingSafeEqual requires equal-length buffers — guard against length
  // mismatch throwing before we even get to the real comparison
  if (expected_hash.length !== signatureHeader.length) return false;

  return crypto.timingSafeEqual(Buffer.from(expected_hash), Buffer.from(signatureHeader));
}

// ─── Server-side re-verification against Paystack's own records ──────────────

async function verify_transaction_with_paystack(reference: string): Promise<{
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

    if (!res.ok || !json?.data) {
      return { verified: false };
    }

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

// ─── Commit stock: convert a reservation into an actual permanent deduction ───

async function commit_item_stock(
  productId: Types.ObjectId,
  sizeId: Types.ObjectId,
  quantity: number
) {
  await Product.updateOne(
    { _id: productId, 'sizes._id': sizeId },
    {
      $inc: {
        'sizes.$.stockQuantity': -quantity,
        'sizes.$.reservedQuantity': -quantity,
      },
    }
  );
}

// ─── Release stock: payment failed/abandoned — undo the reservation only ─────

async function release_item_stock(
  productId: Types.ObjectId,
  sizeId: Types.ObjectId,
  quantity: number
) {
  await Product.updateOne(
    { _id: productId, 'sizes._id': sizeId },
    { $inc: { 'sizes.$.reservedQuantity': -quantity } }
  );
}

export async function POST(req: NextRequest) {
  const raw_body = await req.text(); // MUST read as raw text — signature is computed over the exact raw bytes, not parsed JSON
  const signature_header = req.headers.get('x-paystack-signature');

  if (!verify_paystack_signature(raw_body, signature_header)) {
    // Do not leak *why* it failed to the caller — just reject
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw_body);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const event_type = event.event;
  const reference = event.data?.reference;

  if (!reference) {
    return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
  }

  await connect_to_database();

  const transaction = await Transaction.findOne({ reference });
  if (!transaction) {
    // Reference doesn't match anything we created — acknowledge with 200 so
    // Paystack doesn't retry forever, but this is worth its own alerting in
    // production (could indicate a reference mismatch bug, or an event for
    // a transaction created outside this flow).
    return NextResponse.json({ received: true, note: 'Unknown reference' }, { status: 200 });
  }

  // ─── Idempotency guard — already resolved, nothing further to do ───────────
  if (transaction.status === 'success' || transaction.status === 'failed') {
    return NextResponse.json({ received: true, note: 'Already processed' }, { status: 200 });
  }

  const order = await Order.findById(transaction.order);
  if (!order) {
    return NextResponse.json({ received: true, note: 'Order not found' }, { status: 200 });
  }

  // ─── Only act on events we actually care about ──────────────────────────────
  if (event_type !== 'charge.success' && event_type !== 'charge.failed') {
    return NextResponse.json({ received: true, note: 'Event type not handled' }, { status: 200 });
  }

  // ─── Re-verify directly with Paystack — never trust the webhook body alone ──
  const verification = await verify_transaction_with_paystack(reference);

  if (!verification.verified) {
    // Could not reach Paystack to confirm — do NOT mark as failed based on
    // this alone. Leave as 'pending'; the release-cron will eventually catch
    // it if it truly never resolves, and Paystack will retry this webhook.
    return NextResponse.json(
      { received: true, note: 'Verification unavailable, will retry' },
      { status: 200 }
    );
  }

  const paystack_confirms_success = verification.status === 'success';

  // ─── Guard against amount tampering — webhook/verify amount must match ─────
  if (paystack_confirms_success && verification.amount !== transaction.amount) {
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
      newValues: { reason: 'amount_mismatch' },
      metadata: { resource: 'webhook', reference },
    });

    return NextResponse.json({ received: true, note: 'Amount mismatch flagged' }, { status: 200 });
  }

  if (paystack_confirms_success) {
    // ─── SUCCESS PATH ──────────────────────────────────────────────────────
    transaction.status = 'success';
    transaction.paystackReference = String(verification.raw?.id ?? '');
    transaction.channel = verification.channel ?? null;
    transaction.paidAt = verification.paidAt ? new Date(verification.paidAt) : new Date();
    transaction.verifiedAt = new Date();
    transaction.gatewayResponse = verification.raw ?? null;
    await transaction.save();

    // Commit stock: reservation becomes a real, permanent deduction
    for (const item of order.items) {
      await commit_item_stock(item.product, item.sizeId, item.quantity);
    }

    order.status = 'paid';
    await order.save();

    // Clear and convert the cart — this is the ONLY place a cart should be
    // marked converted from a real payment, as opposed to checkout-initialize's
    // zero-total/full-credit shortcut path.
    await Cart.updateOne(
      { user: order.user, status: 'active' },
      { $set: { items: [], status: 'converted' } }
    );

    // Award loyalty points — no-ops cleanly if rewardsEnabled is false
    const loyalty_result = await award_points_for_order(order.user, order.total);

    writeAuditLog({
      userId: order.user,
      actorId: null,
      action: AuditAction.PAYMENT_SUCCESS,
      entityType: 'Order',
      entityId: order._id.toString(),
      oldValues: { status: 'pending_payment' },
      newValues: { status: 'paid', pointsAwarded: loyalty_result.pointsAwarded },
      metadata: { resource: 'webhook', reference, event: event_type },
    });

    return NextResponse.json({ received: true }, { status: 200 });
  }

  // ─── FAILURE PATH ──────────────────────────────────────────────────────────
  transaction.status = 'failed';
  transaction.failureReason = String(verification.raw?.gateway_response ?? 'Payment declined');
  transaction.gatewayResponse = verification.raw ?? null;
  await transaction.save();

  // Release the stock reservation — never committed, so just undo the hold
  for (const item of order.items) {
    await release_item_stock(item.product, item.sizeId, item.quantity);
  }

  // Refund any store credit that was applied to this attempt
  const credit_applied = order.subtotal - order.discount + order.shippingFee - order.total;
  if (credit_applied > 0) {
    await Account.updateOne({ userId: order.user }, { $inc: { storeCredit: credit_applied } });
  }

  order.status = 'cancelled';
  order.cancelledAt = new Date();
  order.cancelReason = 'Payment failed';
  await order.save();

  writeAuditLog({
    userId: order.user,
    actorId: null,
    action: AuditAction.PAYMENT_FAILED,
    entityType: 'Order',
    entityId: order._id.toString(),
    oldValues: { status: 'pending_payment' },
    newValues: { status: 'cancelled', reason: transaction.failureReason },
    metadata: { resource: 'webhook', reference, event: event_type },
  });

  return NextResponse.json({ received: true }, { status: 200 });
}
