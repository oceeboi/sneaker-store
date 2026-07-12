import mongoose, { Types } from 'mongoose';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { process_failed_payment } from '@/lib/services/payment.service';
import { AuditAction } from '@/models/Auditlog';
import Account from '@/models/Account';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';

const update_transaction_schema = z.object({
  status: z.enum(['failed', 'abandoned']),
  failureReason: z.string().trim().min(3).max(300).optional(),
});

function format_validation_issues(issues: { path: PropertyKey[]; message: string }[]) {
  return validationErr(
    issues.map((issue) => ({
      path: issue.path.map((segment) =>
        typeof segment === 'symbol' ? segment.toString() : segment
      ) as (string | number)[],
      message: issue.message,
    }))
  );
}

function serialize_transaction(transaction: {
  _id: { toString(): string };
  order: unknown;
  user: unknown;
  reference: string;
  paystackReference: string | null;
  amount: number;
  currency: string;
  status: string;
  channel: string | null;
  authorizationUrl: string | null;
  paidAt: Date | null;
  verifiedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: transaction._id.toString(),
    orderId:
      typeof transaction.order === 'object' && transaction.order && '_id' in transaction.order
        ? (transaction.order as { _id: { toString(): string } })._id.toString()
        : String(transaction.order),
    userId:
      typeof transaction.user === 'object' && transaction.user && '_id' in transaction.user
        ? (transaction.user as { _id: { toString(): string } })._id.toString()
        : String(transaction.user),
    reference: transaction.reference,
    paystackReference: transaction.paystackReference,
    amount: transaction.amount,
    currency: transaction.currency,
    status: transaction.status,
    channel: transaction.channel,
    authorizationUrl: transaction.authorizationUrl,
    paidAt: transaction.paidAt,
    verifiedAt: transaction.verifiedAt,
    failureReason: transaction.failureReason,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

async function get_transaction_id(ctx: RouteContext<'/api/admin/transactions/[id]'>) {
  const { id } = await ctx.params;
  return id;
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/admin/transactions/[id]'>) {
  const authorization = await requirePermission(Permission.TRANSACTIONS_READ_ANY);
  if (!authorization.ok) {
    return authorization.response;
  }

  const transaction_id = await get_transaction_id(ctx);
  if (!Types.ObjectId.isValid(transaction_id)) {
    return err('Invalid transaction id', 400);
  }

  await connect_to_database();

  const transaction = await Transaction.findById(transaction_id)
    .populate('order', 'orderNumber status total currency user')
    .populate('user', 'email username role status')
    .lean();

  if (!transaction) {
    return err('Transaction not found', 404);
  }

  return ok({ transaction: serialize_transaction(transaction) });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/admin/transactions/[id]'>) {
  const authorization = await requirePermission(Permission.TRANSACTIONS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const transaction_id = await get_transaction_id(ctx);
  if (!Types.ObjectId.isValid(transaction_id)) {
    return err('Invalid transaction id', 400);
  }

  const request_body = await req.json().catch(() => null);
  const validation_result = update_transaction_schema.safeParse(request_body);
  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  await connect_to_database();

  const transaction = await Transaction.findById(transaction_id);
  if (!transaction) {
    return err('Transaction not found', 404);
  }

  if (transaction.status !== 'pending') {
    return err('Only pending transactions can be manually changed', 409);
  }

  const order = await Order.findById(transaction.order);
  if (!order) {
    return err('Linked order not found', 404);
  }

  const { status, failureReason } = validation_result.data;
  const reason = failureReason ?? `Marked ${status} by admin`;

  if (status === 'failed') {
    await process_failed_payment(order, transaction, reason, null, 'admin');

    writeAuditLog({
      userId: order.user,
      actorId: new Types.ObjectId(authorization.user.userId),
      action: AuditAction.TRANSACTION_FAILED,
      entityType: 'Transaction',
      entityId: transaction._id.toString(),
      oldValues: { status: 'pending' },
      newValues: { status: 'failed', reason },
      metadata: { resource: 'admin.transactions', operation: 'mark_failed' },
      ...requestMeta(req),
    });

    const updated_transaction = await Transaction.findById(transaction_id)
      .populate('order', 'orderNumber status total currency user')
      .populate('user', 'email username role status')
      .lean();

    return ok({
      transaction: updated_transaction ? serialize_transaction(updated_transaction) : null,
    });
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const transaction_update = await Transaction.updateOne(
        { _id: transaction._id, status: 'pending' },
        {
          $set: {
            status: 'abandoned',
            failureReason: reason,
            verifiedAt: new Date(),
          },
        },
        { session }
      );

      if (transaction_update.modifiedCount === 0) {
        throw new Error('Transaction was already resolved');
      }

      for (const item of order.items) {
        const released = await Product.updateOne(
          {
            _id: item.product,
            sizes: { $elemMatch: { _id: item.sizeId, reservedQuantity: { $gte: item.quantity } } },
          },
          { $inc: { 'sizes.$.reservedQuantity': -item.quantity } },
          { session }
        );

        if (released.modifiedCount === 0) {
          throw new Error('Unable to release reserved stock');
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
          },
        },
        { session }
      );

      if (order_update.modifiedCount === 0) {
        throw new Error('Unable to cancel linked order');
      }
    });
  } finally {
    await session.endSession();
  }

  writeAuditLog({
    userId: order.user,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.TRANSACTION_ABANDONED,
    entityType: 'Transaction',
    entityId: transaction._id.toString(),
    oldValues: { status: 'pending' },
    newValues: { status: 'abandoned', reason },
    metadata: { resource: 'admin.transactions', operation: 'mark_abandoned' },
    ...requestMeta(req),
  });

  const updated_transaction = await Transaction.findById(transaction_id)
    .populate('order', 'orderNumber status total currency user')
    .populate('user', 'email username role status')
    .lean();

  return ok({
    transaction: updated_transaction ? serialize_transaction(updated_transaction) : null,
  });
}

export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/admin/transactions/[id]'>) {
  const authorization = await requirePermission(Permission.TRANSACTIONS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const transaction_id = await get_transaction_id(ctx);
  if (!Types.ObjectId.isValid(transaction_id)) {
    return err('Invalid transaction id', 400);
  }

  await connect_to_database();

  const transaction = await Transaction.findById(transaction_id).lean();
  if (!transaction) {
    return err('Transaction not found', 404);
  }

  if (transaction.status === 'success' || transaction.status === 'pending') {
    return err('Only failed or abandoned transactions can be deleted', 409);
  }

  await Transaction.deleteOne({ _id: transaction._id });

  writeAuditLog({
    userId: transaction.user,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.TRANSACTION_DELETED,
    entityType: 'Transaction',
    entityId: transaction._id.toString(),
    oldValues: {
      reference: transaction.reference,
      status: transaction.status,
      amount: transaction.amount,
    },
    metadata: { resource: 'admin.transactions', operation: 'delete' },
    ...requestMeta(req),
  });

  return ok({ deleted: true });
}
