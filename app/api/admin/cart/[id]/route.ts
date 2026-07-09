import { Types } from 'mongoose';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Cart from '@/models/Cart';
import { serialize_cart } from '@/lib/serializers/cart';

const updateCartStatusSchema = z.object({
  status: z.enum(['active', 'abandoned', 'converted']),
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

async function get_cart_id(ctx: RouteContext<'/api/admin/cart/[id]'>) {
  const { id } = await ctx.params;
  return id;
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/admin/cart/[id]'>) {
  const authorization = await requirePermission(Permission.CARTS_READ);
  if (!authorization.ok) return authorization.response;

  const cart_id = await get_cart_id(ctx);
  if (!Types.ObjectId.isValid(cart_id)) return err('Invalid cart id', 400);

  await connect_to_database();

  const found_cart = await Cart.findById(cart_id)
    .populate('user', 'email username')
    .populate('items.product', 'name slug')
    .lean();

  if (!found_cart) return err('Cart not found', 404);

  return ok({ cart: serialize_cart(found_cart) });
}

// PATCH — status only. No item editing here; that stays customer-owned via
// the storefront /api/cart routes, which already log CART_ITEM_* actions.
export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/admin/cart/[id]'>) {
  const authorization = await requirePermission(Permission.CARTS_WRITE);
  if (!authorization.ok) return authorization.response;

  const cart_id = await get_cart_id(ctx);
  if (!Types.ObjectId.isValid(cart_id)) return err('Invalid cart id', 400);

  const request_body = await req.json().catch(() => null);
  const validation_result = updateCartStatusSchema.safeParse(request_body);
  if (!validation_result.success) return format_validation_issues(validation_result.error.issues);

  await connect_to_database();

  const found_cart = await Cart.findById(cart_id);
  if (!found_cart) return err('Cart not found', 404);

  const old_status = found_cart.status;
  const new_status = validation_result.data.status;

  found_cart.status = new_status;
  await found_cart.save();
  await found_cart.populate('user', 'email username');
  await found_cart.populate('items.product', 'name slug');

  // NOTE: no exact AuditAction fits "admin changed cart status" — CART_CLEARED
  // is the closest existing value and only really matches when clearing items,
  // not a status flip. Logging with CART_CLEARED + explicit metadata for now;
  // recommend adding CART_STATUS_UPDATED to the enum so this isn't misleading
  // in the audit trail long-term.
  if (new_status !== old_status) {
    writeAuditLog({
      userId: null,
      actorId: new Types.ObjectId(authorization.user.userId),
      action: AuditAction.CART_CLEARED,
      entityType: 'Cart',
      entityId: found_cart._id.toString(),
      oldValues: { status: old_status },
      newValues: { status: new_status },
      metadata: {
        resource: 'cart',
        operation: 'admin.status_update',
        note: 'no dedicated AuditAction exists for this yet',
      },
      ...requestMeta(req),
    });
  }

  return ok({ cart: serialize_cart(found_cart) });
}

// DELETE — hard delete, blocked if cart is active with items (possible
// in-flight checkout). Uses CART_CLEARED since it's the closest existing
// action — items are gone either way.
export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/admin/cart/[id]'>) {
  const authorization = await requirePermission(Permission.CARTS_WRITE);
  if (!authorization.ok) return authorization.response;

  const cart_id = await get_cart_id(ctx);
  if (!Types.ObjectId.isValid(cart_id)) return err('Invalid cart id', 400);

  await connect_to_database();

  const found_cart = await Cart.findById(cart_id)
    .populate('user', 'email username')
    .populate('items.product', 'name slug');

  if (!found_cart) return err('Cart not found', 404);

  if (found_cart.status === 'active' && found_cart.items.length > 0) {
    return err(
      'Cannot delete a cart with active items — mark it abandoned first to confirm no checkout is in flight',
      409
    );
  }

  const old_values = serialize_cart(found_cart);

  await Cart.deleteOne({ _id: new Types.ObjectId(cart_id) });

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CART_CLEARED,
    entityType: 'Cart',
    entityId: cart_id,
    oldValues: old_values,
    metadata: { resource: 'cart', operation: 'admin.delete' },
    ...requestMeta(req),
  });

  return ok({ deleted: true });
}
