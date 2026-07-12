import { Types } from 'mongoose';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { Permission } from '@/config/rbac';
import { ok, validationErr } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import Order from '@/models/Order';

const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

const list_orders_query_schema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(ORDER_STATUSES).optional(),
  userId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid userId')
    .optional(),
  orderNumber: z.string().trim().min(1).max(60).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
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

function serialize_user_ref(user: unknown) {
  if (!user) return null;

  if (typeof user === 'object' && '_id' in user) {
    const populated_user = user as {
      _id: { toString(): string };
      email?: string;
      username?: string;
      role?: string;
      status?: string;
    };

    return {
      id: populated_user._id.toString(),
      email: populated_user.email ?? null,
      username: populated_user.username ?? null,
      role: populated_user.role ?? null,
      status: populated_user.status ?? null,
    };
  }

  return { id: String(user) };
}

function serialize_order(order: {
  _id: { toString(): string };
  orderNumber: string;
  user: unknown;
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
    user: serialize_user_ref(order.user),
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
  const authorization = await requirePermission(Permission.ORDERS_READ_ANY);
  if (!authorization.ok) {
    return authorization.response;
  }

  const query_object = {
    page: req.nextUrl.searchParams.get('page') ?? undefined,
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    status: req.nextUrl.searchParams.get('status') ?? undefined,
    userId: req.nextUrl.searchParams.get('userId') ?? undefined,
    orderNumber: req.nextUrl.searchParams.get('orderNumber') ?? undefined,
    from: req.nextUrl.searchParams.get('from') ?? undefined,
    to: req.nextUrl.searchParams.get('to') ?? undefined,
  };

  const query_validation = list_orders_query_schema.safeParse(query_object);
  if (!query_validation.success) {
    return format_validation_issues(query_validation.error.issues);
  }

  await connect_to_database();

  const { page, limit, status, userId, orderNumber, from, to } = query_validation.data;

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (userId) filter.user = new Types.ObjectId(userId);
  if (orderNumber) {
    filter.orderNumber = { $regex: orderNumber, $options: 'i' };
  }

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
        'orderNumber user subtotal shippingFee discount total currency status transaction cancelledAt cancelReason createdAt updatedAt'
      )
      .populate('user', 'email username role status')
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
