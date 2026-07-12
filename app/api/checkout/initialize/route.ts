import mongoose, { Types } from 'mongoose';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  process_failed_payment,
  process_successful_payment,
  verify_transaction_with_paystack,
} from '@/lib/services/payment.service';
import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Account from '@/models/Account';
import Address, { AddressType } from '@/models/Address';
import Cart from '@/models/Cart';
import Order, { type IOrder } from '@/models/Order';
import Product from '@/models/Product';
import Transaction, { type ITransaction } from '@/models/Transaction';
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
  quantity: number,
  session?: mongoose.mongo.ClientSession
): Promise<boolean> {
  const result = await Product.updateOne(
    { _id: productId, active: true, 'sizes._id': sizeId },
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
    {
      updatePipeline: true,
      ...(session ? { session } : {}),
    }
  );

  return result.modifiedCount > 0;
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

    if (existing_transaction && existing_transaction.status === 'pending') {
      // ALWAYS verify with Paystack before trusting a pending transaction,
      // regardless of freshness — silence from the webhook doesn't mean the
      // payment hasn't actually succeeded, it might just mean the webhook
      // failed to deliver (wrong URL, network issue, etc).
      const verification = await verify_transaction_with_paystack(existing_transaction.reference);

      if (verification.verified && verification.status === 'success') {
        await process_successful_payment(
          existing_pending_order,
          existing_transaction,
          verification,
          'recovery'
        );

        return ok({
          order: {
            id: existing_pending_order._id.toString(),
            orderNumber: existing_pending_order.orderNumber,
            status: 'paid',
          },
          recoveredFromPreviousAttempt: true,
        });
      }

      if (verification.verified && verification.status !== 'success') {
        // Paystack confirms it did NOT succeed (declined, abandoned on their
        // side, etc) — safe to treat as failed regardless of freshness.
        await process_failed_payment(
          existing_pending_order,
          existing_transaction,
          `Verified as ${verification.status} with Paystack`,
          verification.raw ?? null,
          'recovery'
        );
        // fall through to create a fresh order below
      } else {
        // Could not reach Paystack to verify at all — only NOW does freshness
        // matter, as a fallback: if still within the window and we have a
        // usable authorizationUrl, resume it rather than creating a duplicate
        // while we simply can't confirm either way.
        const is_still_fresh =
          Date.now() - existing_transaction.createdAt.getTime() < PENDING_TIMEOUT_MINUTES * 60_000;

        if (is_still_fresh) {
          if (existing_transaction.authorizationUrl) {
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

          return err(
            'A checkout is already being initialized for this account. Please retry shortly.',
            409
          );
        }

        // Not fresh AND couldn't verify — genuinely stuck, cancel it so the
        // customer isn't blocked from ever checking out again.
        await process_failed_payment(
          existing_pending_order,
          existing_transaction,
          'Payment never confirmed and could not be verified with Paystack',
          null,
          'recovery'
        );
      }
    } else if (existing_transaction) {
      // Transaction exists but isn't 'pending' (shouldn't normally happen given
      // our earlier guards, but handle defensively)
      await process_failed_payment(
        existing_pending_order,
        existing_transaction,
        'Transaction in unexpected state',
        null,
        'recovery'
      );
    } else {
      // No transaction at all tied to this pending order
      existing_pending_order.status = 'cancelled';
      existing_pending_order.cancelledAt = new Date();
      existing_pending_order.cancelReason = 'No transaction found for pending order';
      await existing_pending_order.save();
    }
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

  // ─── 3. Prepare immutable order snapshot ───────────────────────────────────

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
  } catch (order_item_error) {
    return err((order_item_error as Error).message, 409);
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
    return err('Payment is temporarily unavailable. Please try again later.', 503);
  }

  if (total > 0 && !process.env.APP_URL) {
    return err('Checkout callback configuration is missing. Please try again later.', 503);
  }

  // ─── 5. Reserve stock + create order/transaction atomically ───────────────

  const reference = generateTxRef();
  let checkout_creation: { order: IOrder; transaction: ITransaction } | null = null;

  try {
    const session = await mongoose.startSession();

    try {
      const creation_result = await session.withTransaction(async () => {
        for (const item of order_items) {
          const reserved = await reserve_item_stock(
            item.product,
            item.sizeId,
            item.quantity,
            session
          );

          if (!reserved) {
            throw new Error(`Insufficient stock for ${item.name} (size ${item.size})`);
          }
        }

        const created_order = (
          await Order.create(
            [
              {
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
              },
            ],
            { session }
          )
        )[0] as IOrder;

        if (creditApplied > 0) {
          const account_update = await Account.updateOne(
            {
              userId: user_id,
              storeCredit: { $gte: creditApplied },
            },
            { $inc: { storeCredit: -creditApplied } },
            { session }
          );

          if (account_update.modifiedCount === 0) {
            throw new Error('Store credit changed during checkout. Please try again.');
          }
        }

        if (total === 0) {
          const created_transaction = (
            await Transaction.create(
              [
                {
                  order: created_order._id,
                  user: user_id,
                  reference,
                  amount: 0,
                  currency: cart.currency,
                  status: 'success',
                  paidAt: new Date(),
                  verifiedAt: new Date(),
                },
              ],
              { session }
            )
          )[0] as ITransaction;

          const order_update = await Order.updateOne(
            { _id: created_order._id, status: 'pending_payment' },
            { $set: { status: 'paid', transaction: created_transaction._id } },
            { session }
          );

          if (order_update.modifiedCount === 0) {
            throw new Error('Unable to finalize zero-total checkout.');
          }

          await Cart.updateOne(
            { _id: cart._id, user: user_id, status: 'active' },
            { $set: { items: [], status: 'converted' } },
            { session }
          );

          return { order: created_order, transaction: created_transaction };
        }

        const created_transaction = (
          await Transaction.create(
            [
              {
                order: created_order._id,
                user: user_id,
                reference,
                amount: total,
                currency: cart.currency,
                status: 'pending',
              },
            ],
            { session }
          )
        )[0] as ITransaction;

        const order_update = await Order.updateOne(
          { _id: created_order._id, status: 'pending_payment' },
          { $set: { transaction: created_transaction._id } },
          { session }
        );

        if (order_update.modifiedCount === 0) {
          throw new Error('Unable to attach checkout transaction to the order.');
        }

        return { order: created_order, transaction: created_transaction };
      });

      if (creation_result) {
        checkout_creation = creation_result;
      }
    } finally {
      await session.endSession();
    }
  } catch (create_error: unknown) {
    if ((create_error as { code?: number }).code === 11000) {
      return err('A checkout is already in progress for this account. Please retry.', 409);
    }

    if (create_error instanceof Error) {
      if (
        create_error.message.startsWith('Insufficient stock for') ||
        create_error.message === 'Store credit changed during checkout. Please try again.'
      ) {
        return err(create_error.message, 409);
      }
    }

    throw create_error;
  }

  if (!checkout_creation) {
    return err('Checkout could not be initialized. Please try again.', 500);
  }

  const { order: created_order, transaction: created_transaction } = checkout_creation;

  // ─── 6. Zero-total path — fully covered by credit ──────────────────────────

  if (total === 0) {
    writeAuditLog({
      userId: user_id,
      actorId: user_id,
      action: AuditAction.CART_CLEARED, // TODO: swap for your new checkout AuditAction once you share the exact name
      entityType: 'Order',
      entityId: created_order._id.toString(),
      oldValues: {},
      newValues: { orderNumber: created_order.orderNumber, total, paidWithCredit: true },
      metadata: {
        resource: 'checkout',
        operation: 'initialize.zero_total',
        discountReason: discount_reason,
      },
      ...requestMeta(req),
    });

    return ok({
      order: {
        id: created_order._id.toString(),
        orderNumber: created_order.orderNumber,
        status: 'paid',
      },
      paidWithCredit: true,
    });
  }

  // ─── 7. Call Paystack for browser authorization URL ───────────────────────

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
    await process_failed_payment(
      created_order,
      created_transaction,
      `Payment gateway initialization failed: ${(paystack_error as Error).message}`,
      null,
      'initialize'
    );

    return err('Unable to initialize payment. Please try again.', 502);
  }

  const authorization_update = await Transaction.updateOne(
    { _id: created_transaction._id, status: 'pending' },
    { $set: { authorizationUrl: paystack_data.data!.authorization_url! } }
  );

  if (authorization_update.modifiedCount === 0) {
    return err('Checkout state changed before payment could start. Please retry.', 409);
  }

  writeAuditLog({
    userId: user_id,
    actorId: user_id,
    action: AuditAction.CART_CLEARED, // TODO: swap for your new checkout AuditAction once you share the exact name
    entityType: 'Order',
    entityId: created_order._id.toString(),
    oldValues: {},
    newValues: { orderNumber: created_order.orderNumber, total, reference },
    metadata: {
      resource: 'checkout',
      operation: 'initialize',
      discountReason: discount_reason,
    },
    ...requestMeta(req),
  });

  return ok({
    order: {
      id: created_order._id.toString(),
      orderNumber: created_order.orderNumber,
      total,
      status: created_order.status,
    },
    reference,
    authorizationUrl: paystack_data.data!.authorization_url!,
  });
}
