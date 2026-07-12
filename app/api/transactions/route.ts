import { Types } from 'mongoose';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { err, ok, validationErr } from '@/lib/auth/response';
import { authenticateRequest } from '@/lib/auth.middleware';
import connect_to_database from '@/lib/db';
import Transaction from '@/models/Transaction';

const transaction_status_schema = z.enum(['pending', 'success', 'failed', 'abandoned']);

const list_transactions_query_schema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  id: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid transaction id')
    .optional(),
  status: transaction_status_schema.optional(),
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

function serialize_transaction(transaction: {
  _id: { toString(): string };
  order: unknown;
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
  const auth_result = await authenticateRequest();
  if ('error' in auth_result) {
    return err(auth_result.error ?? 'Unauthorized', 401);
  }

  if (!Types.ObjectId.isValid(auth_result.userId)) {
    return err('Unauthorized: Invalid user id', 401);
  }

  const query_result = list_transactions_query_schema.safeParse({
    page: req.nextUrl.searchParams.get('page') ?? undefined,
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    id: req.nextUrl.searchParams.get('id') ?? undefined,
    status: req.nextUrl.searchParams.get('status') ?? undefined,
    reference: req.nextUrl.searchParams.get('reference') ?? undefined,
    from: req.nextUrl.searchParams.get('from') ?? undefined,
    to: req.nextUrl.searchParams.get('to') ?? undefined,
  });

  if (!query_result.success) {
    return format_validation_issues(query_result.error.issues);
  }

  await connect_to_database();

  const user_id = new Types.ObjectId(auth_result.userId);
  const { page, limit, id, status, reference, from, to } = query_result.data;

  if (id) {
    const found_transaction = await Transaction.findOne({ _id: id, user: user_id })
      .select(
        'order reference paystackReference amount currency status channel authorizationUrl paidAt verifiedAt failureReason createdAt updatedAt'
      )
      .lean();

    if (!found_transaction) {
      return err('Transaction not found', 404);
    }

    return ok({ transaction: serialize_transaction(found_transaction) });
  }

  const filter: Record<string, unknown> = { user: user_id };
  if (status) filter.status = status;
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
        'order reference paystackReference amount currency status channel authorizationUrl paidAt verifiedAt failureReason createdAt updatedAt'
      )
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
