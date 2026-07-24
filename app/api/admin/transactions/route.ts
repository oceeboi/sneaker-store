import { Types } from 'mongoose';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { Permission } from '@/config/rbac';
import { ok, validationErr } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import Transaction from '@/models/Transaction';

const TRANSACTION_STATUSES = ['pending', 'success', 'failed', 'abandoned'] as const;

const list_transactions_query_schema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(TRANSACTION_STATUSES).optional(),
  userId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid userId')
    .optional(),
  orderId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid orderId')
    .optional(),
  reference: z.string().trim().min(1).max(120).optional(),
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
    user: serialize_user_ref(transaction.user),
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

export async function GET(req: NextRequest) {
  const authorization = await requirePermission(Permission.TRANSACTIONS_READ_ANY);
  if (!authorization.ok) {
    return authorization.response;
  }

  const query_validation = list_transactions_query_schema.safeParse({
    page: req.nextUrl.searchParams.get('page') ?? undefined,
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    status: req.nextUrl.searchParams.get('status') ?? undefined,
    userId: req.nextUrl.searchParams.get('userId') ?? undefined,
    orderId: req.nextUrl.searchParams.get('orderId') ?? undefined,
    reference: req.nextUrl.searchParams.get('reference') ?? undefined,
    from: req.nextUrl.searchParams.get('from') ?? undefined,
    to: req.nextUrl.searchParams.get('to') ?? undefined,
  });

  if (!query_validation.success) {
    return format_validation_issues(query_validation.error.issues);
  }

  await connect_to_database();

  const { page, limit, status, userId, orderId, reference, from, to } = query_validation.data;
  const filter: Record<string, unknown> = {};

  if (status) filter.status = status;
  if (userId) filter.user = new Types.ObjectId(userId);
  if (orderId) filter.order = new Types.ObjectId(orderId);
  if (reference) filter.reference = { $regex: reference, $options: 'i' };
  if (from || to) {
    filter.createdAt = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }

  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        'order user reference paystackReference amount currency status channel authorizationUrl paidAt verifiedAt failureReason createdAt updatedAt'
      )
      .populate('order', 'orderNumber status total currency user')
      .populate('user', 'email username role status')
      .lean(),
    Transaction.countDocuments(filter),
  ]);

  return ok({
    transactions: transactions.map(serialize_transaction),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: skip + transactions.length < total,
      hasPreviousPage: page > 1,
    },
  });
}
