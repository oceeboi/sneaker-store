import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Collection from '@/models/Collection';
import Product from '@/models/Product';
import { createCollectionSchema, updateCollectionSchema } from '@/schemas/catalog.schemas';
import { CollectionType } from '@/types/shared/product';
import { slugify } from '@/utils/slug';

const collection_select_fields =
  'name slug description bannerImage active type rules sortOrder createdAt updatedAt';

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

function serialize_collection(collection: {
  _id: { toString(): string };
  name: string;
  slug: string;
  description: string | null;
  bannerImage: string | null;
  active: boolean;
  type: string;
  rules: { field: string; operator: string; value: string }[];
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: collection._id.toString(),
    name: collection.name,
    slug: collection.slug,
    description: collection.description,
    bannerImage: collection.bannerImage,
    active: collection.active,
    type: collection.type,
    rules: collection.rules,
    sortOrder: collection.sortOrder,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  };
}

async function get_collection_id(ctx: RouteContext<'/api/admin/collection/[id]'>) {
  const { id } = await ctx.params;
  return id;
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/admin/collection/[id]'>) {
  const authorization = await requirePermission(Permission.COLLECTIONS_READ);
  if (!authorization.ok) {
    return authorization.response;
  }

  const collection_id = await get_collection_id(ctx);
  if (!Types.ObjectId.isValid(collection_id)) {
    return err('Invalid collection id', 400);
  }

  await connect_to_database();

  const found_collection = await Collection.findById(collection_id)
    .select(collection_select_fields)
    .lean();

  if (!found_collection) {
    return err('Collection not found', 404);
  }

  return ok({ collection: serialize_collection(found_collection) });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/admin/collection/[id]'>) {
  const authorization = await requirePermission(Permission.COLLECTIONS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const collection_id = await get_collection_id(ctx);
  if (!Types.ObjectId.isValid(collection_id)) {
    return err('Invalid collection id', 400);
  }

  const request_body = await req.json().catch(() => null);
  const validation_result = updateCollectionSchema.safeParse(request_body);
  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  await connect_to_database();

  const found_collection =
    await Collection.findById(collection_id).select(collection_select_fields);
  if (!found_collection) {
    return err('Collection not found', 404);
  }

  const payload = validation_result.data;
  let manual_slug: string | undefined;

  if (payload.slug !== undefined) {
    manual_slug = slugify(payload.slug);
  } else if (payload.name !== undefined) {
    manual_slug = slugify(payload.name);
  }

  if (manual_slug) {
    const existing_slug_owner = await Collection.findOne({
      slug: manual_slug,
      _id: { $ne: found_collection._id },
    })
      .select('_id')
      .lean();

    if (existing_slug_owner) {
      return err('A collection with this slug already exists', 409);
    }
  }

  const next_type = payload.type ?? found_collection.type;
  const next_rules = payload.rules ?? found_collection.rules;
  if (next_type === CollectionType.SMART && next_rules.length === 0) {
    return err('Smart collections require at least one rule', 422);
  }

  const old_values = serialize_collection(found_collection);

  if (payload.name !== undefined) found_collection.name = payload.name;
  if (manual_slug !== undefined) found_collection.slug = manual_slug;
  if (payload.description !== undefined) found_collection.description = payload.description;
  if (payload.bannerImage !== undefined) found_collection.bannerImage = payload.bannerImage;
  if (payload.active !== undefined) found_collection.active = payload.active;
  if (payload.type !== undefined) found_collection.type = payload.type;
  if (payload.rules !== undefined)
    found_collection.rules = next_type === CollectionType.SMART ? payload.rules : [];
  if (payload.sortOrder !== undefined) found_collection.sortOrder = payload.sortOrder;

  if (
    payload.type !== undefined &&
    payload.type === CollectionType.MANUAL &&
    payload.rules === undefined
  ) {
    found_collection.rules = [];
  }

  await found_collection.save();

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_UPDATED,
    entityType: 'Collection',
    entityId: found_collection._id.toString(),
    oldValues: old_values,
    newValues: serialize_collection(found_collection),
    metadata: { resource: 'collection' },
    ...requestMeta(req),
  });

  return ok({ collection: serialize_collection(found_collection) });
}

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/admin/collection/[id]'>) {
  const authorization = await requirePermission(Permission.COLLECTIONS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const collection_id = await get_collection_id(ctx);
  if (!Types.ObjectId.isValid(collection_id)) {
    return err('Invalid collection id', 400);
  }

  const request_body = await req.json().catch(() => null);
  const validation_result = createCollectionSchema.safeParse(request_body);
  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  await connect_to_database();

  const found_collection =
    await Collection.findById(collection_id).select(collection_select_fields);
  if (!found_collection) {
    return err('Collection not found', 404);
  }

  const payload = validation_result.data;
  const manual_slug = payload.slug ? slugify(payload.slug) : slugify(payload.name);

  const existing_slug_owner = await Collection.findOne({
    slug: manual_slug,
    _id: { $ne: found_collection._id },
  })
    .select('_id')
    .lean();

  if (existing_slug_owner) {
    return err('A collection with this slug already exists', 409);
  }

  const next_type = payload.type ?? CollectionType.MANUAL;
  const next_rules = next_type === CollectionType.SMART ? (payload.rules ?? []) : [];
  if (next_type === CollectionType.SMART && next_rules.length === 0) {
    return err('Smart collections require at least one rule', 422);
  }

  const old_values = serialize_collection(found_collection);

  found_collection.name = payload.name;
  found_collection.slug = manual_slug;
  found_collection.description = payload.description ?? null;
  found_collection.bannerImage = payload.bannerImage ?? null;
  found_collection.active = payload.active ?? true;
  found_collection.type = next_type;
  found_collection.rules = next_rules;
  found_collection.sortOrder = payload.sortOrder ?? 0;

  await found_collection.save();

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_UPDATED,
    entityType: 'Collection',
    entityId: found_collection._id.toString(),
    oldValues: old_values,
    newValues: serialize_collection(found_collection),
    metadata: { resource: 'collection', operation: 'PUT' },
    ...requestMeta(req),
  });

  return ok({ collection: serialize_collection(found_collection) });
}

export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/admin/collection/[id]'>) {
  const authorization = await requirePermission(Permission.COLLECTIONS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const collection_id = await get_collection_id(ctx);
  if (!Types.ObjectId.isValid(collection_id)) {
    return err('Invalid collection id', 400);
  }

  await connect_to_database();

  const found_collection = await Collection.findById(collection_id)
    .select(collection_select_fields)
    .lean();

  if (!found_collection) {
    return err('Collection not found', 404);
  }

  const collection_object_id = new Types.ObjectId(collection_id);
  const linked_product = await Product.findOne({ collections: collection_object_id })
    .select('_id')
    .lean();

  if (linked_product) {
    return err('This collection cannot be deleted while products still reference it', 409);
  }

  await Collection.deleteOne({ _id: collection_object_id });

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_DELETED,
    entityType: 'Collection',
    entityId: collection_id,
    oldValues: serialize_collection(found_collection),
    metadata: { resource: 'collection' },
    ...requestMeta(req),
  });

  return ok({ deleted: true });
}
