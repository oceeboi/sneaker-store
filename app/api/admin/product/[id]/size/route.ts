// app/api/admin/product/[id]/size/route.ts
import { Types } from 'mongoose';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Product from '@/models/Product';
import { ISizeOption } from '@/types/shared/product';

// ─── Validation ───────────────────────────────────────────────────────────────
// Deliberately excludes reservedQuantity — that field is system-managed
// (touched only by checkout-initialize / webhook / release-cron), never by
// direct admin edit. Keeping it out of the schema means it's not just
// "ignored", it's structurally impossible to set through this route.

const addSizeSchema = z.object({
  size: z.string().trim().min(1).max(20),
  sku: z.string().trim().max(120).nullable().optional(),
  barcode: z.string().trim().max(120).nullable().optional(),
  stockQuantity: z.number().int().min(0),
  reorderLevel: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

const updateSizeSchema = z.object({
  sizeId: z.string().min(1),
  size: z.string().trim().min(1).max(20).optional(),
  sku: z.string().trim().max(120).nullable().optional(),
  barcode: z.string().trim().max(120).nullable().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
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

function get_size_id(size_option: ISizeOption) {
  const maybe_size_with_id = size_option as ISizeOption & { _id?: unknown };
  if (!maybe_size_with_id._id) return null;

  const size_id = maybe_size_with_id._id as { toString?: () => string };
  if (typeof size_id.toString !== 'function') return null;

  return size_id.toString();
}

function serialize_size(size_option: ISizeOption, fallback_id = '') {
  return {
    id: get_size_id(size_option) ?? fallback_id,
    size: size_option.size,
    sku: size_option.sku,
    barcode: size_option.barcode,
    stockQuantity: size_option.stockQuantity,
    reservedQuantity: size_option.reservedQuantity,
    availableQuantity: Math.max(0, size_option.stockQuantity - size_option.reservedQuantity),
    reorderLevel: size_option.reorderLevel,
    active: size_option.active,
  };
}

async function get_product_id(ctx: RouteContext<'/api/admin/product/[id]/size'>) {
  const { id } = await ctx.params;
  return id;
}

function find_size_entry(sizes: ISizeOption[], size_id: string) {
  return sizes.find((size_option) => get_size_id(size_option) === size_id) ?? null;
}

// ─── GET — list sizes for a product ───────────────────────────────────────────

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/admin/product/[id]/size'>) {
  const authorization = await requirePermission(Permission.PRODUCTS_READ);
  if (!authorization.ok) return authorization.response;

  const product_id = await get_product_id(ctx);
  if (!Types.ObjectId.isValid(product_id)) {
    return err('Invalid product id', 400);
  }

  await connect_to_database();

  const found_product = await Product.findById(product_id).select('sizes');
  if (!found_product) {
    return err('Product not found', 404);
  }

  return ok({
    sizes: found_product.sizes.map((size_option, index) =>
      serialize_size(size_option, String(index))
    ),
  });
}

// ─── POST — add a new size ────────────────────────────────────────────────────

export async function POST(req: NextRequest, ctx: RouteContext<'/api/admin/product/[id]/size'>) {
  const authorization = await requirePermission(Permission.PRODUCTS_WRITE);
  if (!authorization.ok) return authorization.response;

  const product_id = await get_product_id(ctx);
  if (!Types.ObjectId.isValid(product_id)) {
    return err('Invalid product id', 400);
  }

  const request_body = await req.json().catch(() => null);
  const validation_result = addSizeSchema.safeParse(request_body);
  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  const payload = validation_result.data;
  const normalized_size_key = payload.size.trim().toLowerCase();

  await connect_to_database();

  const found_product = await Product.findById(product_id).select('sizes');
  if (!found_product) {
    return err('Product not found', 404);
  }

  const duplicate = found_product.sizes.some(
    (existing) => existing.size.trim().toLowerCase() === normalized_size_key
  );
  if (duplicate) {
    return err('A size with this label already exists on this product', 409);
  }

  const old_values = {
    sizes: found_product.sizes.map((size_option, index) =>
      serialize_size(size_option, String(index))
    ),
  };

  found_product.sizes.push({
    size: payload.size.trim(),
    sku: payload.sku?.trim() || null,
    barcode: payload.barcode?.trim() || null,
    stockQuantity: payload.stockQuantity,
    reservedQuantity: 0, // always starts at 0 — never accepted from input
    reorderLevel: payload.reorderLevel ?? 0,
    active: payload.active ?? true,
  });

  await found_product.save();

  const new_size = found_product.sizes[found_product.sizes.length - 1];

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_UPDATED,
    entityType: 'Product',
    entityId: found_product._id.toString(),
    oldValues: old_values,
    newValues: {
      sizes: found_product.sizes.map((size_option, index) =>
        serialize_size(size_option, String(index))
      ),
    },
    metadata: { resource: 'product', operation: 'inventory.add' },
    ...requestMeta(req),
  });

  return ok({ size: serialize_size(new_size, String(found_product.sizes.length - 1)) });
}

// ─── PATCH — edit a single size, matched by its own _id ───────────────────────

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/admin/product/[id]/size'>) {
  const authorization = await requirePermission(Permission.PRODUCTS_WRITE);
  if (!authorization.ok) return authorization.response;

  const product_id = await get_product_id(ctx);
  if (!Types.ObjectId.isValid(product_id)) {
    return err('Invalid product id', 400);
  }

  const request_body = await req.json().catch(() => null);
  const validation_result = updateSizeSchema.safeParse(request_body);
  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  const { sizeId, ...updates } = validation_result.data;
  if (!Types.ObjectId.isValid(sizeId)) {
    return err('Invalid size id', 400);
  }

  await connect_to_database();

  const found_product = await Product.findById(product_id).select('sizes');
  if (!found_product) {
    return err('Product not found', 404);
  }

  const size_entry = find_size_entry(found_product.sizes, sizeId);
  if (!size_entry) {
    return err('Size not found', 404);
  }

  // If renaming, guard against colliding with another size on the same product
  if (updates.size !== undefined) {
    const normalized_new_key = updates.size.trim().toLowerCase();
    const collides = found_product.sizes.some(
      (existing) =>
        get_size_id(existing) !== sizeId &&
        existing.size.trim().toLowerCase() === normalized_new_key
    );
    if (collides) {
      return err('Another size with this label already exists on this product', 409);
    }
  }

  const old_values = {
    sizes: found_product.sizes.map((size_option, index) =>
      serialize_size(size_option, String(index))
    ),
  };

  if (updates.size !== undefined) size_entry.size = updates.size.trim();
  if (updates.sku !== undefined) size_entry.sku = updates.sku?.trim() || null;
  if (updates.barcode !== undefined) size_entry.barcode = updates.barcode?.trim() || null;
  if (updates.stockQuantity !== undefined) size_entry.stockQuantity = updates.stockQuantity;
  if (updates.reorderLevel !== undefined) size_entry.reorderLevel = updates.reorderLevel;
  if (updates.active !== undefined) size_entry.active = updates.active;
  // reservedQuantity intentionally never touched here

  await found_product.save(); // triggers the schema validator: reservedQuantity <= stockQuantity

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_UPDATED,
    entityType: 'Product',
    entityId: found_product._id.toString(),
    oldValues: old_values,
    newValues: {
      sizes: found_product.sizes.map((size_option, index) =>
        serialize_size(size_option, String(index))
      ),
    },
    metadata: { resource: 'product', operation: 'inventory.update', sizeId },
    ...requestMeta(req),
  });

  return ok({ size: serialize_size(size_entry) });
}

// ─── DELETE — remove a single size, blocked if it has active reservations ────

export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/admin/product/[id]/size'>) {
  const authorization = await requirePermission(Permission.PRODUCTS_WRITE);
  if (!authorization.ok) return authorization.response;

  const product_id = await get_product_id(ctx);
  if (!Types.ObjectId.isValid(product_id)) {
    return err('Invalid product id', 400);
  }

  const sizeId = req.nextUrl.searchParams.get('sizeId');
  if (!sizeId || !Types.ObjectId.isValid(sizeId)) {
    return err('Valid sizeId is required', 400);
  }

  await connect_to_database();

  const found_product = await Product.findById(product_id).select('sizes');
  if (!found_product) {
    return err('Product not found', 404);
  }

  const size_entry = find_size_entry(found_product.sizes, sizeId);
  if (!size_entry) {
    return err('Size not found', 404);
  }

  if (size_entry.reservedQuantity > 0) {
    return err('Cannot delete a size with active reservations — deactivate it instead', 409);
  }

  const old_values = {
    sizes: found_product.sizes.map((size_option, index) =>
      serialize_size(size_option, String(index))
    ),
  };

  found_product.sizes = found_product.sizes.filter(
    (size_option) => get_size_id(size_option) !== sizeId
  );
  await found_product.save();

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_DELETED,
    entityType: 'Product',
    entityId: found_product._id.toString(),
    oldValues: old_values,
    newValues: {
      sizes: found_product.sizes.map((size_option, index) =>
        serialize_size(size_option, String(index))
      ),
    },
    metadata: { resource: 'product', operation: 'inventory.delete', sizeId },
    ...requestMeta(req),
  });

  return ok({ deleted: true, sizeId });
}
