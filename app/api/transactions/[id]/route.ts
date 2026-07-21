import { Types } from 'mongoose';
import { z } from 'zod';

import { err, ok, validationErr } from '@/lib/auth/response';
import { authenticateRequest } from '@/lib/auth.middleware';
import connect_to_database from '@/lib/db';
import Transaction from '@/models/Transaction';

const transaction_reference_param_schema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Transaction reference is required')
    .max(120, 'Invalid transaction reference'),
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
  const order = transaction.order;

  return {
    id: transaction._id.toString(),
    orderId:
      typeof order === 'object' && order && '_id' in order
        ? (order as { _id: { toString(): string } })._id.toString()
        : String(order),
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
    order:
      typeof order === 'object' && order && '_id' in order
        ? {
            id: (order as { _id: { toString(): string } })._id.toString(),
            orderNumber: (order as { orderNumber?: string }).orderNumber ?? '',
            status: (order as { status?: string }).status ?? 'pending_payment',
            total: (order as { total?: number }).total ?? 0,
            currency: (order as { currency?: string }).currency ?? 'NGN',
            createdAt: (order as { createdAt?: Date }).createdAt ?? transaction.createdAt,
            items: ((order as { items?: unknown[] }).items ?? []).map((item) => ({
              productId:
                typeof item === 'object' && item && 'product' in item
                  ? typeof (item as { product: unknown }).product === 'object' &&
                    (item as { product: unknown }).product &&
                    '_id' in ((item as { product: unknown }).product as object)
                    ? (item as { product: { _id: { toString(): string } } }).product._id.toString()
                    : String((item as { product: unknown }).product)
                  : '',
              productName:
                typeof item === 'object' && item && 'product' in item
                  ? typeof (item as { product: unknown }).product === 'object' &&
                    (item as { product: unknown }).product &&
                    'name' in ((item as { product: unknown }).product as object)
                    ? ((item as { product: { name?: string } }).product.name ??
                      (item as { name?: string }).name ??
                      'Item')
                    : ((item as { name?: string }).name ?? 'Item')
                  : 'Item',
              sizeId:
                typeof item === 'object' && item && 'sizeId' in item
                  ? (item as { sizeId: { toString(): string } }).sizeId.toString()
                  : '',
              size:
                typeof item === 'object' && item && 'size' in item
                  ? (item as { size: string }).size
                  : '',
              sku:
                typeof item === 'object' && item && 'sku' in item
                  ? (item as { sku: string }).sku
                  : '',
              quantity:
                typeof item === 'object' && item && 'quantity' in item
                  ? (item as { quantity: number }).quantity
                  : 0,
              unitPrice:
                typeof item === 'object' && item && 'unitPrice' in item
                  ? (item as { unitPrice: number }).unitPrice
                  : 0,
              subtotal:
                typeof item === 'object' && item && 'subtotal' in item
                  ? (item as { subtotal: number }).subtotal
                  : 0,
            })),
            shippingAddress: {
              addressId:
                (
                  order as { shippingAddress?: { addressId?: { toString(): string } | null } }
                ).shippingAddress?.addressId?.toString() ?? null,
              label:
                (order as { shippingAddress?: { label?: string | null } }).shippingAddress?.label ??
                null,
              firstName:
                (order as { shippingAddress?: { firstName?: string } }).shippingAddress
                  ?.firstName ?? '',
              lastName:
                (order as { shippingAddress?: { lastName?: string } }).shippingAddress?.lastName ??
                '',
              phone:
                (order as { shippingAddress?: { phone?: string } }).shippingAddress?.phone ?? '',
              street:
                (order as { shippingAddress?: { street?: string } }).shippingAddress?.street ?? '',
              city: (order as { shippingAddress?: { city?: string } }).shippingAddress?.city ?? '',
              state:
                (order as { shippingAddress?: { state?: string } }).shippingAddress?.state ?? '',
              country:
                (order as { shippingAddress?: { country?: string } }).shippingAddress?.country ??
                '',
              postalCode:
                (order as { shippingAddress?: { postalCode?: string | null } }).shippingAddress
                  ?.postalCode ?? null,
            },
          }
        : null,
  };
}

type ParamsContext = {
  params: Promise<{ id: string }>;
};

async function get_transaction_reference(ctx: ParamsContext) {
  const params = await ctx.params;
  return params.id;
}

export async function GET(_req: Request, ctx: ParamsContext) {
  const auth_result = await authenticateRequest();
  if ('error' in auth_result) {
    return err(auth_result.error ?? 'Unauthorized', 401);
  }

  if (!Types.ObjectId.isValid(auth_result.userId)) {
    return err('Unauthorized: Invalid user id', 401);
  }

  const raw_transaction_reference = await get_transaction_reference(ctx);
  const transaction_reference_result = transaction_reference_param_schema.safeParse({
    id: raw_transaction_reference,
  });

  if (!transaction_reference_result.success) {
    return format_validation_issues(transaction_reference_result.error.issues);
  }

  await connect_to_database();

  const transaction = await Transaction.findOne({
    reference: transaction_reference_result.data.id,
    user: new Types.ObjectId(auth_result.userId),
  })
    .select(
      'order reference paystackReference amount currency status channel authorizationUrl paidAt verifiedAt failureReason createdAt updatedAt'
    )
    .populate('order', 'orderNumber status total currency createdAt items shippingAddress')
    .populate('order.items.product', 'name')
    .lean();

  if (!transaction) {
    return err('Transaction not found', 404);
  }

  return ok({ transaction: serialize_transaction(transaction) });
}
