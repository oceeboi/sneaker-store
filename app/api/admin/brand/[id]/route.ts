import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Brand from '@/models/Brand';
import Product from '@/models/Product';
import { createBrandSchema, updateBrandSchema } from '@/schemas/catalog.schemas';
import { slugify } from '@/utils/slug';

const brand_select_fields = 'name slug logo description website active createdAt updatedAt';

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

function serialize_brand(brand: {
  _id: { toString(): string };
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  website: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: brand._id.toString(),
    name: brand.name,
    slug: brand.slug,
    logo: brand.logo,
    description: brand.description,
    website: brand.website,
    active: brand.active,
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt,
  };
}

async function get_brand_id(ctx: RouteContext<'/api/admin/brand/[id]'>) {
  const { id } = await ctx.params;
  return id;
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/admin/brand/[id]'>) {
  const authorization = await requirePermission(Permission.BRANDS_READ);
  if (!authorization.ok) {
    return authorization.response;
  }

  const brand_id = await get_brand_id(ctx);
  if (!Types.ObjectId.isValid(brand_id)) {
    return err('Invalid brand id', 400);
  }

  await connect_to_database();

  const found_brand = await Brand.findById(brand_id).select(brand_select_fields).lean();
  if (!found_brand) {
    return err('Brand not found', 404);
  }

  return ok({ brand: serialize_brand(found_brand) });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/admin/brand/[id]'>) {
  const authorization = await requirePermission(Permission.BRANDS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const brand_id = await get_brand_id(ctx);
  if (!Types.ObjectId.isValid(brand_id)) {
    return err('Invalid brand id', 400);
  }

  const request_body = await req.json().catch(() => null);
  const validation_result = updateBrandSchema.safeParse(request_body);
  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  await connect_to_database();

  const found_brand = await Brand.findById(brand_id).select(brand_select_fields);
  if (!found_brand) {
    return err('Brand not found', 404);
  }

  const payload = validation_result.data;
  let manual_slug: string | undefined;

  if (payload.slug !== undefined) {
    manual_slug = slugify(payload.slug);
  } else if (payload.name !== undefined) {
    manual_slug = slugify(payload.name);
  }

  if (manual_slug) {
    const existing_slug_owner = await Brand.findOne({
      slug: manual_slug,
      _id: { $ne: found_brand._id },
    })
      .select('_id')
      .lean();

    if (existing_slug_owner) {
      return err('A brand with this slug already exists', 409);
    }
  }

  const old_values = serialize_brand(found_brand);

  if (payload.name !== undefined) found_brand.name = payload.name;
  if (manual_slug !== undefined) found_brand.slug = manual_slug;
  if (payload.logo !== undefined) found_brand.logo = payload.logo;
  if (payload.description !== undefined) found_brand.description = payload.description;
  if (payload.website !== undefined) found_brand.website = payload.website;
  if (payload.active !== undefined) found_brand.active = payload.active;

  await found_brand.save();

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_UPDATED,
    entityType: 'Brand',
    entityId: found_brand._id.toString(),
    oldValues: old_values,
    newValues: serialize_brand(found_brand),
    metadata: { resource: 'brand' },
    ...requestMeta(req),
  });

  return ok({ brand: serialize_brand(found_brand) });
}

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/admin/brand/[id]'>) {
  const authorization = await requirePermission(Permission.BRANDS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const brand_id = await get_brand_id(ctx);
  if (!Types.ObjectId.isValid(brand_id)) {
    return err('Invalid brand id', 400);
  }

  const request_body = await req.json().catch(() => null);
  const validation_result = createBrandSchema.safeParse(request_body);
  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  await connect_to_database();

  const found_brand = await Brand.findById(brand_id).select(brand_select_fields);
  if (!found_brand) {
    return err('Brand not found', 404);
  }

  const payload = validation_result.data;
  const manual_slug = payload.slug ? slugify(payload.slug) : slugify(payload.name);

  const existing_slug_owner = await Brand.findOne({
    slug: manual_slug,
    _id: { $ne: found_brand._id },
  })
    .select('_id')
    .lean();

  if (existing_slug_owner) {
    return err('A brand with this slug already exists', 409);
  }

  const old_values = serialize_brand(found_brand);

  found_brand.name = payload.name;
  found_brand.slug = manual_slug;
  found_brand.logo = payload.logo ?? null;
  found_brand.description = payload.description ?? null;
  found_brand.website = payload.website ?? null;
  found_brand.active = payload.active ?? true;

  await found_brand.save();

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_UPDATED,
    entityType: 'Brand',
    entityId: found_brand._id.toString(),
    oldValues: old_values,
    newValues: serialize_brand(found_brand),
    metadata: { resource: 'brand', operation: 'PUT' },
    ...requestMeta(req),
  });

  return ok({ brand: serialize_brand(found_brand) });
}

export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/admin/brand/[id]'>) {
  const authorization = await requirePermission(Permission.BRANDS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const brand_id = await get_brand_id(ctx);
  if (!Types.ObjectId.isValid(brand_id)) {
    return err('Invalid brand id', 400);
  }

  await connect_to_database();

  const found_brand = await Brand.findById(brand_id).select(brand_select_fields).lean();
  if (!found_brand) {
    return err('Brand not found', 404);
  }

  const brand_object_id = new Types.ObjectId(brand_id);
  const linked_product = await Product.findOne({ brand: brand_object_id }).select('_id').lean();
  if (linked_product) {
    return err('This brand cannot be deleted while products still reference it', 409);
  }

  await Brand.deleteOne({ _id: brand_object_id });

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_DELETED,
    entityType: 'Brand',
    entityId: brand_id,
    oldValues: serialize_brand(found_brand),
    metadata: { resource: 'brand' },
    ...requestMeta(req),
  });

  return ok({ deleted: true });
}
