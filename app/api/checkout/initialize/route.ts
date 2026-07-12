import { Types } from 'mongoose';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Account from '@/models/Account';
import Address, { AddressType } from '@/models/Address';
import Cart from '@/models/Cart';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import User from '@/models/User';
import { calculate_new_customer_discount } from '@/lib/services/loyalty.service';
import { generateOrderNumber, generateTxRef } from '@/lib/utils/checkout-refs';

const PENDING_TIMEOUT_MINUTES = 30;

const initializeCheckoutSchema = z.object({
  shippingAddressId: z.string().min(1),
  useStoreCredit: z.boolean().default(false),
});

function format_validation_issues(issues: { path: PropertyKey[]; message: string }[]) {
  return validationErr(
    issues.map((issue) => ({
      path: issue.path.map((s) => (typeof s === 'symbol' ? s.toString() : s)) as (
        string | number
      )[],
      message: issue.message,
    }))
  );
}

async function reserve_item_stock(
  productId: Types.ObjectId,
  sizeId: Types.ObjectId,
  quantity: number
): Promise<boolean> {
  const result = await Product.updateOne(
    { _id: productId, 'sizes._id': sizeId },
    [
      {
        $set: {
          sizes: {
            $map: {
              input: '$sizes',
              as: 's',
              in: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$$s._id', sizeId] },
                      { $eq: ['$$s.active', true] },
                      {
                        $gte: [
                          { $subtract: ['$$s.stockQuantity', '$$s.reservedQuantity'] },
                          quantity,
                        ],
                      },
                    ],
                  },
                  {
                    $mergeObjects: [
                      '$$s',
                      { reservedQuantity: { $add: ['$$s.reservedQuantity', quantity] } },
                    ],
                  },
                  '$$s',
                ],
              },
            },
          },
        },
      },
    ],
    { updatePipeline: true }
  );

  return result.modifiedCount > 0;
}

async function release_item_stock(
  productId: Types.ObjectId,
  sizeId: Types.ObjectId,
  quantity: number
): Promise<void> {
  await Product.updateOne(
    { _id: productId, 'sizes._id': sizeId },
    { $inc: { 'sizes.$.reservedQuantity': -quantity } }
  );
}

async function cancel_stale_pending_order(
  staleOrder: InstanceType<typeof Order>,
  staleTransaction: InstanceType<typeof Transaction> | null,
  reason: string
) {
  for (const item of staleOrder.items) {
    await release_item_stock(item.product, item.sizeId, item.quantity);
  }

  const credit_applied =
    staleOrder.subtotal - staleOrder.discount + staleOrder.shippingFee - staleOrder.total;

  if (credit_applied > 0) {
    await Account.updateOne({ userId: staleOrder.user }, { $inc: { storeCredit: credit_applied } });
  }

  staleOrder.status = 'cancelled';
  staleOrder.cancelledAt = new Date();
  staleOrder.cancelReason = reason;
  await staleOrder.save();

  if (staleTransaction) {
    staleTransaction.status = 'abandoned';
    await staleTransaction.save();
  }
}

export async function POST(req: NextRequest) {
  const authorization = await requirePermission(Permission.ORDER_READ_PAY);
  if (!authorization.ok) return authorization.response;

  const request_body = await req.json().catch(() => null);
  const validation_result = initializeCheckoutSchema.safeParse(request_body);
  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  const { shippingAddressId, useStoreCredit } = validation_result.data;
  if (!Types.ObjectId.isValid(shippingAddressId)) {
    return err('Invalid shippingAddressId', 400);
  }

  await connect_to_database();

  const user_id = new Types.ObjectId(authorization.user.userId);

  // Fetch email fresh — not carried on the auth payload
  const user = await User.findById(user_id).select('email');
  if (!user) {
    return err('User not found', 404);
  }

  // ─── 0. Idempotency check ───────────────────────────────────────────────────

  const existing_pending_order = await Order.findOne({ user: user_id, status: 'pending_payment' });

  if (existing_pending_order) {
    const existing_transaction = await Transaction.findOne({
      order: existing_pending_order._id,
    }).sort({
      createdAt: -1,
    });

    const is_still_fresh =
      existing_transaction &&
      existing_transaction.status === 'pending' &&
      Date.now() - existing_transaction.createdAt.getTime() < PENDING_TIMEOUT_MINUTES * 60_000;

    if (is_still_fresh && existing_transaction.authorizationUrl) {
      return ok({
        order: {
          id: existing_pending_order._id.toString(),
          orderNumber: existing_pending_order.orderNumber,
          total: existing_pending_order.total,
          status: existing_pending_order.status,
        },
        reference: existing_transaction.reference,
        authorizationUrl: existing_transaction.authorizationUrl,
        resumed: true,
      });
    }

    await cancel_stale_pending_order(
      existing_pending_order,
      existing_transaction,
      'Superseded by new checkout attempt'
    );
  }

  // ─── 1. Load cart ───────────────────────────────────────────────────────────

  const cart = await Cart.findOne({ user: user_id, status: 'active' }).populate(
    'items.product',
    'name pricing active'
  );

  if (!cart || cart.items.length === 0) {
    return err('Cart is empty', 400);
  }

  // ─── 2. Load and validate shipping address ─────────────────────────────────

  const address = await Address.findOne({ _id: shippingAddressId, userId: user_id });
  if (!address) {
    return err('Shipping address not found', 404);
  }
  if (address.type !== AddressType.SHIPPING && address.type !== AddressType.BOTH) {
    return err('Selected address is not usable as a shipping address', 400);
  }

  // ─── 3. Reserve stock per item, atomically, rolling back on any failure ─────

  const reserved_so_far: { productId: Types.ObjectId; sizeId: Types.ObjectId; quantity: number }[] =
    [];
  const order_items: {
    product: Types.ObjectId;
    sizeId: Types.ObjectId;
    name: string;
    size: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[] = [];

  try {
    for (const item of cart.items) {
      const product = item.product as unknown as {
        _id: Types.ObjectId;
        name: string;
        pricing: { basePrice: number };
        active: boolean;
      };

      if (!product || !product.active) {
        throw new Error('A product in your cart is no longer available');
      }

      const reserved = await reserve_item_stock(product._id, item.sizeId, item.quantity);
      if (!reserved) {
        throw new Error(`Insufficient stock for ${product.name} (size ${item.size})`);
      }

      reserved_so_far.push({
        productId: product._id,
        sizeId: item.sizeId,
        quantity: item.quantity,
      });

      order_items.push({
        product: product._id,
        sizeId: item.sizeId,
        name: product.name,
        size: item.size,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.priceAtAdd,
        subtotal: item.priceAtAdd * item.quantity,
      });
    }
  } catch (stock_error) {
    for (const reserved_item of reserved_so_far) {
      await release_item_stock(
        reserved_item.productId,
        reserved_item.sizeId,
        reserved_item.quantity
      );
    }
    console.log('Stock reservation failed:', (stock_error as Error).message);
    return err((stock_error as Error).message, 409);
  }

  // ─── 4. Calculate totals ────────────────────────────────────────────────────

  const subtotal = order_items.reduce((sum, item) => sum + item.subtotal, 0);

  const new_customer_discount = await calculate_new_customer_discount(user_id, subtotal);
  const discount = new_customer_discount.discountKobo;
  const discount_reason = new_customer_discount.applies ? 'first_order_5_percent' : null;

  const shippingFee = 0; // placeholder — real shipping-fee logic comes later

  let creditApplied = 0;

  if (useStoreCredit) {
    const account = await Account.findOne({ userId: user_id });
    if (account && account.storeCredit > 0) {
      const amount_owed_before_credit = Math.max(0, subtotal - discount + shippingFee);
      creditApplied = Math.min(account.storeCredit, amount_owed_before_credit);
    }
  }

  const total = Math.max(0, subtotal - discount + shippingFee - creditApplied); // total calculation after discount and store credit

  if (total > 0 && !process.env.PAYSTACK_SECRET_KEY) {
    for (const reserved_item of reserved_so_far) {
      await release_item_stock(
        reserved_item.productId,
        reserved_item.sizeId,
        reserved_item.quantity
      );
    }
    return err('Payment is temporarily unavailable. Please try again later.', 503);
  }

  if (total > 0 && !process.env.APP_URL) {
    for (const reserved_item of reserved_so_far) {
      await release_item_stock(
        reserved_item.productId,
        reserved_item.sizeId,
        reserved_item.quantity
      );
    }
    return err('Checkout callback configuration is missing. Please try again later.', 503);
  }

  // ─── 5. Create Order — race-safe via the partial unique index ──────────────

  let order;
  try {
    order = await Order.create({
      orderNumber: generateOrderNumber(),
      user: user_id,
      items: order_items,
      subtotal,
      shippingFee,
      discount,
      total,
      currency: cart.currency,
      shippingAddress: {
        addressId: address._id,
        label: address.label,
        firstName: address.firstName,
        lastName: address.lastName,
        phone: address.phone,
        street: address.street,
        city: address.city,
        state: address.state,
        country: address.country,
        postalCode: address.postalCode,
      },
      status: 'pending_payment',
    });
  } catch (create_error: unknown) {
    if ((create_error as { code?: number }).code === 11000) {
      for (const reserved_item of reserved_so_far) {
        await release_item_stock(
          reserved_item.productId,
          reserved_item.sizeId,
          reserved_item.quantity
        );
      }
      return err('A checkout is already in progress for this account. Please retry.', 409);
    }
    for (const reserved_item of reserved_so_far) {
      await release_item_stock(
        reserved_item.productId,
        reserved_item.sizeId,
        reserved_item.quantity
      );
    }
    throw create_error;
  }

  // ─── 6. Deduct applied store credit now, tied to this order ────────────────

  if (creditApplied > 0) {
    await Account.updateOne({ userId: user_id }, { $inc: { storeCredit: -creditApplied } });
  }

  // ─── 7. Zero-total path — fully covered by credit ──────────────────────────

  const reference = generateTxRef();

  if (total === 0) {
    const transaction = await Transaction.create({
      order: order._id,
      user: user_id,
      reference,
      amount: 0,
      currency: cart.currency,
      status: 'success',
      paidAt: new Date(),
      verifiedAt: new Date(),
    });

    order.status = 'paid';
    order.transaction = transaction._id;
    await order.save();

    cart.items = [];
    cart.status = 'converted';
    await cart.save();

    writeAuditLog({
      userId: user_id,
      actorId: user_id,
      action: AuditAction.CART_CLEARED, // TODO: swap for your new checkout AuditAction once you share the exact name
      entityType: 'Order',
      entityId: order._id.toString(),
      oldValues: {},
      newValues: { orderNumber: order.orderNumber, total, paidWithCredit: true },
      metadata: {
        resource: 'checkout',
        operation: 'initialize.zero_total',
        discountReason: discount_reason,
      },
      ...requestMeta(req),
    });

    return ok({
      order: { id: order._id.toString(), orderNumber: order.orderNumber, status: 'paid' },
      paidWithCredit: true,
    });
  }

  // ─── 8. Create Transaction, call Paystack ──────────────────────────────────

  const transaction = await Transaction.create({
    order: order._id,
    user: user_id,
    reference,
    amount: total,
    currency: cart.currency,
    status: 'pending',
  });

  order.transaction = transaction._id;
  await order.save();

  let paystack_data: { data?: { authorization_url?: string } } = {};

  try {
    const paystack_res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount: total,
        reference,
        currency: cart.currency,
        callback_url: `${process.env.APP_URL}/api/checkout/callback`,
      }),
    });

    paystack_data = await paystack_res.json();

    if (!paystack_res.ok || !paystack_data?.data?.authorization_url) {
      throw new Error('Paystack did not return an authorization URL');
    }
  } catch (paystack_error) {
    for (const reserved_item of reserved_so_far) {
      await release_item_stock(
        reserved_item.productId,
        reserved_item.sizeId,
        reserved_item.quantity
      );
    }
    if (creditApplied > 0) {
      await Account.updateOne({ userId: user_id }, { $inc: { storeCredit: creditApplied } });
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = 'Payment gateway initialization failed';
    await order.save();

    transaction.status = 'failed';
    transaction.failureReason = (paystack_error as Error).message;
    await transaction.save();

    return err('Unable to initialize payment. Please try again.', 502);
  }

  transaction.authorizationUrl = paystack_data.data!.authorization_url!;
  await transaction.save();

  writeAuditLog({
    userId: user_id,
    actorId: user_id,
    action: AuditAction.CART_CLEARED, // TODO: swap for your new checkout AuditAction once you share the exact name
    entityType: 'Order',
    entityId: order._id.toString(),
    oldValues: {},
    newValues: { orderNumber: order.orderNumber, total, reference },
    metadata: {
      resource: 'checkout',
      operation: 'initialize',
      discountReason: discount_reason,
    },
    ...requestMeta(req),
  });

  return ok({
    order: {
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      total,
      status: order.status,
    },
    reference,
    authorizationUrl: transaction.authorizationUrl,
  });
}
