import { Types } from 'mongoose';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Cart from '@/models/Cart';
import Product from '@/models/Product';
import { serialize_cart } from '@/lib/serializers/cart';
import { ISizeOption } from '@/types/shared/product';

const addToCartSchema = z.object({
  productId: z.string().min(1),
  sizeId: z.string().min(1),
  quantity: z.number().int().min(1).max(20), // sane per-add cap, adjust if needed
});

const updateCartItemSchema = z
  .object({
    productId: z.string().min(1),
    sizeId: z.string().min(1),
    quantity: z.number().int().min(1).max(1000).optional(),
    nextSizeId: z.string().min(1).optional(),
  })
  .refine((payload) => payload.quantity !== undefined || payload.nextSizeId !== undefined, {
    message: 'Provide at least one update field (quantity or nextSizeId)',
    path: ['quantity'],
  });

const deleteCartItemSchema = z
  .object({
    productId: z.string().min(1).optional(),
    sizeId: z.string().min(1).optional(),
    clear: z.boolean().optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.clear) return;

    if (!payload.productId || !payload.sizeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productId'],
        message: 'productId and sizeId are required unless clear=true',
      });
    }
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

function get_size_id(size_option: ISizeOption) {
  const maybe_size_with_id = size_option as ISizeOption & { _id?: unknown };
  if (!maybe_size_with_id._id) return null;

  const size_id = maybe_size_with_id._id as { toString?: () => string };
  if (typeof size_id.toString !== 'function') return null;

  return size_id.toString();
}

function find_size_entry(sizes: ISizeOption[], size_id: string) {
  return sizes.find((size_option) => get_size_id(size_option) === size_id) ?? null;
}

async function get_or_create_active_cart(user_id: string) {
  const user_object_id = new Types.ObjectId(user_id);
  const now = new Date();

  const found_cart = await Cart.findOneAndUpdate(
    { user: user_object_id },
    {
      $setOnInsert: {
        user: user_object_id,
        items: [],
        status: 'active',
        lastActivityAt: now,
      },
    },
    {
      upsert: true,
      new: true,
    }
  );

  if (!found_cart) {
    throw new Error('Failed to fetch or create cart');
  }

  if (found_cart.status !== 'active') {
    found_cart.status = 'active';
    found_cart.lastActivityAt = now;
    await found_cart.save();
  }

  return found_cart;
}

function serialize_cart_items_snapshot(cart: {
  items: { sizeId: { toString(): string }; quantity: number }[];
}) {
  return cart.items.map((item) => ({
    sizeId: item.sizeId.toString(),
    quantity: item.quantity,
  }));
}

// ─── GET — fetch the logged-in user's active cart ─────────────────────────────

export async function GET(_req: NextRequest) {
  const authorization = await requirePermission(Permission.CARTS_READ_CONTENT);
  if (!authorization.ok) return authorization.response;

  await connect_to_database();

  const user_id = authorization.user.userId;

  const found_cart = await get_or_create_active_cart(user_id);
  await found_cart.populate('user', 'email username');
  await found_cart.populate('items.product', 'name slug media pricing active');

  return ok({ cart: serialize_cart(found_cart) });
}

// ─── POST — add an item to the cart ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const authorization = await requirePermission(Permission.CARTS_ADD);
  if (!authorization.ok) return authorization.response;

  const request_body = await req.json().catch(() => null);
  const validation_result = addToCartSchema.safeParse(request_body);
  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  const { productId, sizeId, quantity } = validation_result.data;

  if (!Types.ObjectId.isValid(productId) || !Types.ObjectId.isValid(sizeId)) {
    return err('Invalid productId or sizeId', 400);
  }

  await connect_to_database();

  const found_product = await Product.findOne({ _id: productId, active: true });
  if (!found_product) {
    return err('Product not found', 404);
  }

  // Lookup by sizeId (the stable subdocument _id), not the mutable `size` label —
  // this is the fix we settled on so admin renames never break existing carts.
  const size_entry = find_size_entry(found_product.sizes, sizeId);
  if (!size_entry || !size_entry.active) {
    return err('Size not available', 404);
  }

  const available = size_entry.stockQuantity - size_entry.reservedQuantity;
  if (available < quantity) {
    return err(`Only ${available} left in stock for this size`, 409);
  }

  const user_id = authorization.user.userId;

  const cart = await get_or_create_active_cart(user_id);

  const old_values = { items: serialize_cart_items_snapshot(cart) };

  const existing_item = cart.items.find(
    (item) => item.product.toString() === productId && item.sizeId.toString() === sizeId
  );

  if (existing_item) {
    const new_quantity = existing_item.quantity + quantity;
    // Re-check combined quantity against current stock — not just the delta —
    // since the item may already be sitting in the cart from an earlier add.
    if (available < new_quantity) {
      return err(`Only ${available} left in stock for this size`, 409);
    }
    existing_item.quantity = new_quantity;
  } else {
    cart.items.push({
      product: new Types.ObjectId(productId),
      sizeId: new Types.ObjectId(sizeId),
      size: size_entry.size,
      sku: size_entry.sku ?? '',
      quantity,
      priceAtAdd: found_product.pricing.basePrice,
    });
  }

  cart.lastActivityAt = new Date();
  await cart.save();
  await cart.populate('user', 'email username');
  await cart.populate('items.product', 'name slug media pricing active');

  writeAuditLog({
    userId: new Types.ObjectId(user_id),
    actorId: new Types.ObjectId(user_id),
    action: AuditAction.CART_ITEM_ADDED,
    entityType: 'Cart',
    entityId: cart._id.toString(),
    oldValues: old_values,
    newValues: { items: serialize_cart_items_snapshot(cart) },
    metadata: { resource: 'cart', operation: 'item.add', productId, sizeId },
    ...requestMeta(req),
  });

  return ok({ cart: serialize_cart(cart) });
}

// PATCH — edit an item quantity and/or switch to another size
export async function PATCH(req: NextRequest) {
  const authorization = await requirePermission(Permission.CARTS_ADD);
  if (!authorization.ok) return authorization.response;

  const request_body = await req.json().catch(() => null);
  const validation_result = updateCartItemSchema.safeParse(request_body);
  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  const { productId, sizeId, nextSizeId, quantity } = validation_result.data;

  if (!Types.ObjectId.isValid(productId) || !Types.ObjectId.isValid(sizeId)) {
    return err('Invalid productId or sizeId', 400);
  }

  if (nextSizeId && !Types.ObjectId.isValid(nextSizeId)) {
    return err('Invalid nextSizeId', 400);
  }

  await connect_to_database();

  const user_id = authorization.user.userId;
  const cart = await get_or_create_active_cart(user_id);

  const existing_item = cart.items.find(
    (item) => item.product.toString() === productId && item.sizeId.toString() === sizeId
  );
  if (!existing_item) {
    return err('Cart item not found', 404);
  }

  const target_size_id = nextSizeId ?? sizeId;
  const target_quantity = quantity ?? existing_item.quantity;

  const found_product = await Product.findOne({ _id: productId, active: true });
  if (!found_product) {
    return err('Product not found', 404);
  }

  const target_size_entry = find_size_entry(found_product.sizes, target_size_id);
  if (!target_size_entry || !target_size_entry.active) {
    return err('Target size not available', 404);
  }

  const old_values = { items: serialize_cart_items_snapshot(cart) };

  const destination_item = cart.items.find(
    (item) =>
      item.product.toString() === productId &&
      item.sizeId.toString() === target_size_id &&
      !(item.product.toString() === productId && item.sizeId.toString() === sizeId)
  );

  const final_quantity = destination_item
    ? destination_item.quantity + target_quantity
    : target_quantity;
  const available = target_size_entry.stockQuantity - target_size_entry.reservedQuantity;
  if (available < final_quantity) {
    return err(`Only ${available} left in stock for this size`, 409);
  }

  if (destination_item) {
    destination_item.quantity = final_quantity;
    cart.items = cart.items.filter(
      (item) => !(item.product.toString() === productId && item.sizeId.toString() === sizeId)
    );
  } else {
    existing_item.sizeId = new Types.ObjectId(target_size_id);
    existing_item.size = target_size_entry.size;
    existing_item.sku = target_size_entry.sku ?? '';
    existing_item.quantity = target_quantity;
  }

  cart.lastActivityAt = new Date();
  await cart.save();
  await cart.populate('user', 'email username');
  await cart.populate('items.product', 'name slug media pricing active');

  writeAuditLog({
    userId: new Types.ObjectId(user_id),
    actorId: new Types.ObjectId(user_id),
    action: AuditAction.CART_ITEM_UPDATED,
    entityType: 'Cart',
    entityId: cart._id.toString(),
    oldValues: old_values,
    newValues: { items: serialize_cart_items_snapshot(cart) },
    metadata: {
      resource: 'cart',
      operation: 'item.update',
      productId,
      sizeId,
      nextSizeId: target_size_id,
      quantity: target_quantity,
    },
    ...requestMeta(req),
  });

  return ok({ cart: serialize_cart(cart) });
}

// DELETE — remove one cart item or clear the entire cart
export async function DELETE(req: NextRequest) {
  const authorization = await requirePermission(Permission.CARTS_ADD);
  if (!authorization.ok) return authorization.response;

  const request_body = await req.json().catch(() => ({}));
  const validation_result = deleteCartItemSchema.safeParse(request_body);
  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  const { productId, sizeId, clear } = validation_result.data;

  if (productId && !Types.ObjectId.isValid(productId)) {
    return err('Invalid productId', 400);
  }

  if (sizeId && !Types.ObjectId.isValid(sizeId)) {
    return err('Invalid sizeId', 400);
  }

  await connect_to_database();

  const user_id = authorization.user.userId;
  const cart = await get_or_create_active_cart(user_id);

  const old_values = { items: serialize_cart_items_snapshot(cart) };

  if (clear) {
    cart.items = [];
  } else {
    const initial_count = cart.items.length;
    cart.items = cart.items.filter(
      (item) => !(item.product.toString() === productId && item.sizeId.toString() === sizeId)
    );

    if (cart.items.length === initial_count) {
      return err('Cart item not found', 404);
    }
  }

  cart.lastActivityAt = new Date();
  await cart.save();
  await cart.populate('user', 'email username');
  await cart.populate('items.product', 'name slug media pricing active');

  writeAuditLog({
    userId: new Types.ObjectId(user_id),
    actorId: new Types.ObjectId(user_id),
    action: clear ? AuditAction.CART_CLEARED : AuditAction.CART_ITEM_REMOVED,
    entityType: 'Cart',
    entityId: cart._id.toString(),
    oldValues: old_values,
    newValues: { items: serialize_cart_items_snapshot(cart) },
    metadata: {
      resource: 'cart',
      operation: clear ? 'cart.clear' : 'item.remove',
      productId: productId ?? null,
      sizeId: sizeId ?? null,
    },
    ...requestMeta(req),
  });

  return ok({ cart: serialize_cart(cart) });
}
