import { Types } from 'mongoose';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { process_failed_payment } from '@/lib/services/payment.service';
import { AuditAction } from '@/models/Auditlog';
import Order from '@/models/Order';
import Transaction from '@/models/Transaction';

const update_order_schema = z.object({
  status: z.enum(['processing', 'shipped', 'delivered', 'cancelled']),
  reason: z.string().trim().min(3).max(300).optional(),
});

const allowed_transitions: Record<string, string[]> = {
  pending_payment: ['cancelled'],
  paid: ['processing'],
  processing: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
};

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

function serialize_order(order: {
  _id: { toString(): string };
  orderNumber: string;
  user: unknown;
  items: {
    product: unknown;
    sizeId: { toString(): string };
    name: string;
    size: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  currency: string;
  status: string;
  transaction: unknown;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    user:
      typeof order.user === 'object' && order.user && '_id' in order.user
        ? {
            id: (order.user as { _id: { toString(): string } })._id.toString(),
            email: (order.user as { email?: string }).email ?? null,
            username: (order.user as { username?: string }).username ?? null,
          }
        : { id: String(order.user) },
    items: order.items.map((item) => ({
      productId:
        typeof item.product === 'object' && item.product && '_id' in item.product
          ? (item.product as { _id: { toString(): string } })._id.toString()
          : String(item.product),
      productName:
        typeof item.product === 'object' && item.product && 'name' in item.product
          ? ((item.product as { name?: string }).name ?? item.name)
          : item.name,
      sizeId: item.sizeId.toString(),
      size: item.size,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    })),
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    discount: order.discount,
    total: order.total,
    currency: order.currency,
    status: order.status,
    transactionId: order.transaction
      ? typeof order.transaction === 'object' && '_id' in order.transaction
        ? (order.transaction as { _id: { toString(): string } })._id.toString()
        : String(order.transaction)
      : null,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

async function get_order_id(ctx: RouteContext<'/api/admin/orders/[id]'>) {
  const { id } = await ctx.params;
  return id;
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/admin/orders/[id]'>) {
  const authorization = await requirePermission(Permission.ORDERS_READ_ANY);
  if (!authorization.ok) {
    return authorization.response;
  }

  const order_id = await get_order_id(ctx);
  if (!Types.ObjectId.isValid(order_id)) {
    return err('Invalid order id', 400);
  }

  await connect_to_database();

  const order = await Order.findById(order_id)
    .populate('user', 'email username role status')
    .populate('items.product', 'name')
    .populate('transaction', 'reference status amount currency')
    .lean();

  if (!order) {
    return err('Order not found', 404);
  }

  return ok({ order: serialize_order(order) });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/admin/orders/[id]'>) {
  const authorization = await requirePermission(Permission.ORDERS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const order_id = await get_order_id(ctx);
  if (!Types.ObjectId.isValid(order_id)) {
    return err('Invalid order id', 400);
  }

  const request_body = await req.json().catch(() => null);
  const validation_result = update_order_schema.safeParse(request_body);
  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  await connect_to_database();

  const order = await Order.findById(order_id);
  if (!order) {
    return err('Order not found', 404);
  }

  const { status, reason } = validation_result.data;

  if (order.status === status) {
    return ok({ order: serialize_order(order.toObject()) });
  }

  const next_allowed_statuses = allowed_transitions[order.status] ?? [];
  if (!next_allowed_statuses.includes(status)) {
    return err(`Cannot move order from ${order.status} to ${status}`, 409);
  }

  const old_status = order.status;

  if (status === 'cancelled') {
    const cancellation_reason = reason ?? 'Cancelled by admin';
    const latest_transaction = await Transaction.findOne({ order: order._id }).sort({
      createdAt: -1,
    });

    if (latest_transaction && latest_transaction.status === 'pending') {
      await process_failed_payment(order, latest_transaction, cancellation_reason, null, 'admin');
    } else {
      order.status = 'cancelled';
      order.cancelledAt = new Date();
      order.cancelReason = cancellation_reason;
      await order.save();
    }

    writeAuditLog({
      userId: order.user,
      actorId: new Types.ObjectId(authorization.user.userId),
      action: AuditAction.ORDER_CANCELLED,
      entityType: 'Order',
      entityId: order._id.toString(),
      oldValues: { status: old_status },
      newValues: { status: 'cancelled', reason: cancellation_reason },
      metadata: { resource: 'admin.orders', operation: 'cancel' },
      ...requestMeta(req),
    });

    const updated_order = await Order.findById(order_id)
      .populate('user', 'email username role status')
      .populate('items.product', 'name')
      .populate('transaction', 'reference status amount currency')
      .lean();

    return ok({ order: updated_order ? serialize_order(updated_order) : null });
  }

  order.status = status;
  await order.save();

  writeAuditLog({
    userId: order.user,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.ORDER_STATUS_UPDATED,
    entityType: 'Order',
    entityId: order._id.toString(),
    oldValues: { status: old_status },
    newValues: { status: order.status },
    metadata: { resource: 'admin.orders', operation: 'status_update' },
    ...requestMeta(req),
  });

  return ok({ order: serialize_order(order.toObject()) });
}

export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/admin/orders/[id]'>) {
  const authorization = await requirePermission(Permission.ORDERS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const order_id = await get_order_id(ctx);
  if (!Types.ObjectId.isValid(order_id)) {
    return err('Invalid order id', 400);
  }

  await connect_to_database();

  const order = await Order.findById(order_id).lean();
  if (!order) {
    return err('Order not found', 404);
  }

  if (order.status !== 'cancelled') {
    return err('Only cancelled orders can be deleted', 409);
  }

  const linked_transaction = await Transaction.findOne({ order: order._id }).lean();
  if (linked_transaction && linked_transaction.status === 'success') {
    return err('Cannot delete order that has a successful transaction record', 409);
  }

  await Order.deleteOne({ _id: order._id });
  if (
    linked_transaction &&
    (linked_transaction.status === 'failed' || linked_transaction.status === 'abandoned')
  ) {
    await Transaction.deleteOne({ _id: linked_transaction._id });
  }

  writeAuditLog({
    userId: order.user,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.ORDER_DELETED,
    entityType: 'Order',
    entityId: order._id.toString(),
    oldValues: {
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
    },
    metadata: { resource: 'admin.orders', operation: 'delete' },
    ...requestMeta(req),
  });

  return ok({ deleted: true });
}
