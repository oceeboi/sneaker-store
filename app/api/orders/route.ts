import { Types } from 'mongoose';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { err, ok, validationErr } from '@/lib/auth/response';
import { authenticateRequest } from '@/lib/auth.middleware';
import connect_to_database from '@/lib/db';
import Order from '@/models/Order';

const order_status_schema = z.enum([
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

const list_orders_query_schema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  id: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid order id')
    .optional(),
  status: order_status_schema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  orderNumber: z.string().trim().min(1).max(60).optional(),
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

function serialize_order(order: {
  _id: { toString(): string };
  orderNumber: string;
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

export async function GET(req: NextRequest) {
  const auth_result = await authenticateRequest();
  if ('error' in auth_result) {
    return err(auth_result.error ?? 'Unauthorized', 401);
  }

  if (!Types.ObjectId.isValid(auth_result.userId)) {
    return err('Unauthorized: Invalid user id', 401);
  }

  const query_result = list_orders_query_schema.safeParse({
    page: req.nextUrl.searchParams.get('page') ?? undefined,
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    id: req.nextUrl.searchParams.get('id') ?? undefined,
    status: req.nextUrl.searchParams.get('status') ?? undefined,
    from: req.nextUrl.searchParams.get('from') ?? undefined,
    to: req.nextUrl.searchParams.get('to') ?? undefined,
    orderNumber: req.nextUrl.searchParams.get('orderNumber') ?? undefined,
  });

  if (!query_result.success) {
    return format_validation_issues(query_result.error.issues);
  }

  await connect_to_database();

  const user_id = new Types.ObjectId(auth_result.userId);
  const { page, limit, id, status, from, to, orderNumber } = query_result.data;

  if (id) {
    const found_order = await Order.findOne({ _id: id, user: user_id })
      .select(
        'orderNumber subtotal shippingFee discount total currency status transaction cancelledAt cancelReason createdAt updatedAt'
      )
      .lean();

    if (!found_order) {
      return err('Order not found', 404);
    }

    return ok({ order: serialize_order(found_order) });
  }

  const filter: Record<string, unknown> = { user: user_id };
  if (status) filter.status = status;
  if (orderNumber) filter.orderNumber = { $regex: orderNumber, $options: 'i' };
  if (from || to) {
    filter.createdAt = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }

  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        'orderNumber subtotal shippingFee discount total currency status transaction cancelledAt cancelReason createdAt updatedAt'
      )
      .lean(),
    Order.countDocuments(filter),
  ]);

  return ok({
    orders: orders.map(serialize_order),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: skip + orders.length < total,
      hasPreviousPage: page > 1,
    },
  });
}
