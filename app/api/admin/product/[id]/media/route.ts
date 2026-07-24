import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Product from '@/models/Product';
import {
  adminProductMediaCreateSchema,
  adminProductMediaDeleteQuerySchema,
  adminProductMediaUpdateSchema,
} from '@/modules/products/schemas/admin-product-media.schemas';
import { formatValidationIssues } from '@/modules/products/services/admin-product-route-helpers';
import { IMedia } from '@/types/shared/product';

function get_media_id(media: IMedia) {
  const maybeMediaWithId = media as IMedia & { _id?: unknown };
  if (!maybeMediaWithId._id) return null;

  const mediaId = maybeMediaWithId._id as { toString?: () => string };
  if (typeof mediaId.toString !== 'function') return null;

  return mediaId.toString();
}

function serialize_media(media: IMedia, fallbackId = '', fallbackOrder = 0) {
  return {
    id: get_media_id(media) ?? fallbackId,
    url: media.url,
    alt: media.alt,
    type: media.type,
    order: Number.isFinite(media.order) ? media.order : fallbackOrder,
  };
}

function normalize_media_order(mediaList: IMedia[]) {
  mediaList.sort((left, right) => {
    const leftOrder = Number.isFinite(left.order) ? left.order : Number.MAX_SAFE_INTEGER;
    const rightOrder = Number.isFinite(right.order) ? right.order : Number.MAX_SAFE_INTEGER;

    return leftOrder - rightOrder;
  });

  mediaList.forEach((media, index) => {
    media.order = index;
  });
}

async function get_product_id(ctx: RouteContext<'/api/admin/product/[id]/media'>) {
  const { id } = await ctx.params;
  return id;
}

function find_media_entry(mediaList: IMedia[], mediaId: string) {
  return mediaList.find((media) => get_media_id(media) === mediaId) ?? null;
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/admin/product/[id]/media'>) {
  const authorization = await requirePermission(Permission.PRODUCTS_READ);
  if (!authorization.ok) return authorization.response;

  const productId = await get_product_id(ctx);
  if (!Types.ObjectId.isValid(productId)) {
    return err('Invalid product id', 400);
  }

  await connect_to_database();

  const foundProduct = await Product.findById(productId).select('media');
  if (!foundProduct) {
    return err('Product not found', 404);
  }

  return ok({
    media: foundProduct.media.map((media, index) => serialize_media(media, String(index), index)),
  });
}

export async function POST(req: NextRequest, ctx: RouteContext<'/api/admin/product/[id]/media'>) {
  const authorization = await requirePermission(Permission.PRODUCTS_WRITE);
  if (!authorization.ok) return authorization.response;

  const productId = await get_product_id(ctx);
  if (!Types.ObjectId.isValid(productId)) {
    return err('Invalid product id', 400);
  }

  const requestBody = await req.json().catch(() => null);
  const validationResult = adminProductMediaCreateSchema.safeParse(requestBody);
  if (!validationResult.success) {
    return formatValidationIssues(validationResult.error.issues);
  }

  await connect_to_database();

  const foundProduct = await Product.findById(productId).select('media');
  if (!foundProduct) {
    return err('Product not found', 404);
  }

  const payload = validationResult.data;
  const oldValues = {
    media: foundProduct.media.map((media, index) => serialize_media(media, String(index), index)),
  };

  foundProduct.media.push({
    url: payload.url,
    alt: payload.alt,
    type: payload.type ?? 'image',
    order: payload.order ?? foundProduct.media.length,
  });

  normalize_media_order(foundProduct.media);
  await foundProduct.save();

  const newMedia = foundProduct.media[foundProduct.media.length - 1];

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_UPDATED,
    entityType: 'Product',
    entityId: foundProduct._id.toString(),
    oldValues,
    newValues: {
      media: foundProduct.media.map((media, index) => serialize_media(media, String(index), index)),
    },
    metadata: { resource: 'product', operation: 'media.add' },
    ...requestMeta(req),
  });

  return ok({ media: serialize_media(newMedia, String(foundProduct.media.length - 1)) });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/admin/product/[id]/media'>) {
  const authorization = await requirePermission(Permission.PRODUCTS_WRITE);
  if (!authorization.ok) return authorization.response;

  const productId = await get_product_id(ctx);
  if (!Types.ObjectId.isValid(productId)) {
    return err('Invalid product id', 400);
  }

  const requestBody = await req.json().catch(() => null);
  const validationResult = adminProductMediaUpdateSchema.safeParse(requestBody);
  if (!validationResult.success) {
    return formatValidationIssues(validationResult.error.issues);
  }

  const { mediaId, ...updates } = validationResult.data;

  await connect_to_database();

  const foundProduct = await Product.findById(productId).select('media');
  if (!foundProduct) {
    return err('Product not found', 404);
  }

  const mediaEntry = find_media_entry(foundProduct.media, mediaId);
  if (!mediaEntry) {
    return err('Media not found', 404);
  }

  const oldValues = {
    media: foundProduct.media.map((media, index) => serialize_media(media, String(index), index)),
  };

  if (updates.url !== undefined) mediaEntry.url = updates.url;
  if (updates.alt !== undefined) mediaEntry.alt = updates.alt;
  if (updates.type !== undefined) mediaEntry.type = updates.type;
  if (updates.order !== undefined) mediaEntry.order = updates.order;

  normalize_media_order(foundProduct.media);
  await foundProduct.save();

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_UPDATED,
    entityType: 'Product',
    entityId: foundProduct._id.toString(),
    oldValues,
    newValues: {
      media: foundProduct.media.map((media, index) => serialize_media(media, String(index), index)),
    },
    metadata: { resource: 'product', operation: 'media.update', mediaId },
    ...requestMeta(req),
  });

  return ok({ media: serialize_media(mediaEntry) });
}

export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/admin/product/[id]/media'>) {
  const authorization = await requirePermission(Permission.PRODUCTS_WRITE);
  if (!authorization.ok) return authorization.response;

  const productId = await get_product_id(ctx);
  if (!Types.ObjectId.isValid(productId)) {
    return err('Invalid product id', 400);
  }

  const queryValidation = adminProductMediaDeleteQuerySchema.safeParse({
    mediaId: req.nextUrl.searchParams.get('mediaId') ?? '',
  });
  if (!queryValidation.success) {
    return formatValidationIssues(queryValidation.error.issues);
  }

  const mediaId = queryValidation.data.mediaId;

  await connect_to_database();

  const foundProduct = await Product.findById(productId).select('media');
  if (!foundProduct) {
    return err('Product not found', 404);
  }

  const mediaEntry = find_media_entry(foundProduct.media, mediaId);
  if (!mediaEntry) {
    return err('Media not found', 404);
  }

  const oldValues = {
    media: foundProduct.media.map((media, index) => serialize_media(media, String(index), index)),
  };

  foundProduct.media = foundProduct.media.filter((media) => get_media_id(media) !== mediaId);
  normalize_media_order(foundProduct.media);
  await foundProduct.save();

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_UPDATED,
    entityType: 'Product',
    entityId: foundProduct._id.toString(),
    oldValues,
    newValues: {
      media: foundProduct.media.map((media, index) => serialize_media(media, String(index), index)),
    },
    metadata: { resource: 'product', operation: 'media.delete', mediaId },
    ...requestMeta(req),
  });

  return ok({ deleted: true, mediaId });
}
