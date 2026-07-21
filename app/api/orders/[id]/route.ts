import { Types } from 'mongoose';
import { z } from 'zod';

import { err, ok, validationErr } from '@/lib/auth/response';
import { authenticateRequest } from '@/lib/auth.middleware';
import connect_to_database from '@/lib/db';
import Order from '@/models/Order';

const order_number_param_schema = z.object({
  id: z.string().trim().min(1, 'Order number is required').max(60, 'Invalid order number'),
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
  shippingAddress: {
    addressId?: { toString(): string } | null;
    label: string | null;
    firstName: string;
    lastName: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string | null;
  };
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
    shippingAddress: {
      addressId: order.shippingAddress.addressId?.toString() ?? null,
      label: order.shippingAddress.label,
      firstName: order.shippingAddress.firstName,
      lastName: order.shippingAddress.lastName,
      phone: order.shippingAddress.phone,
      street: order.shippingAddress.street,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      country: order.shippingAddress.country,
      postalCode: order.shippingAddress.postalCode,
    },
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

type ParamsContext = {
  params: Promise<{ id: string }>;
};

async function get_order_number(ctx: ParamsContext) {
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

  const raw_order_number = await get_order_number(ctx);
  const order_number_result = order_number_param_schema.safeParse({ id: raw_order_number });
  if (!order_number_result.success) {
    return format_validation_issues(order_number_result.error.issues);
  }

  await connect_to_database();

  const order = await Order.findOne({
    orderNumber: order_number_result.data.id,
    user: new Types.ObjectId(auth_result.userId),
  })
    .select(
      'orderNumber items subtotal shippingFee discount total currency shippingAddress status transaction cancelledAt cancelReason createdAt updatedAt'
    )
    .populate('items.product', 'name')
    .lean();

  if (!order) {
    return err('Order not found', 404);
  }

  return ok({ order: serialize_order(order) });
}
