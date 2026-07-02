import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Collection from '@/models/Collection';
import { createCollectionSchema } from '@/schemas/catalog.schemas';
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

export async function GET(req: NextRequest) {
  const authorization = await requirePermission(Permission.COLLECTIONS_READ);
  if (!authorization.ok) {
    return authorization.response;
  }

  await connect_to_database();

  const search_term = req.nextUrl.searchParams.get('search')?.trim();
  const active_filter = req.nextUrl.searchParams.get('active');
  const type_filter = req.nextUrl.searchParams.get('type');

  const query: Record<string, unknown> = {};

  if (search_term) {
    query.$or = [
      { name: { $regex: search_term, $options: 'i' } },
      { slug: { $regex: search_term, $options: 'i' } },
    ];
  }

  if (active_filter === 'true') {
    query.active = true;
  } else if (active_filter === 'false') {
    query.active = false;
  }

  if (type_filter) {
    if (
      ![CollectionType.MANUAL, CollectionType.SMART].includes(
        type_filter as (typeof CollectionType)[keyof typeof CollectionType]
      )
    ) {
      return err('Invalid collection type filter', 400);
    }
    query.type = type_filter;
  }

  const collections = await Collection.find(query)
    .sort({ sortOrder: 1, name: 1 })
    .select(collection_select_fields)
    .lean();

  return ok({
    collections: collections.map(serialize_collection),
    total: collections.length,
  });
}

export async function POST(req: NextRequest) {
  const authorization = await requirePermission(Permission.COLLECTIONS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const request_body = await req.json().catch(() => null);
  const validation_result = createCollectionSchema.safeParse(request_body);
  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  await connect_to_database();

  const payload = validation_result.data;
  const manual_slug = payload.slug ? slugify(payload.slug) : undefined;

  if (manual_slug) {
    const existing_slug_owner = await Collection.findOne({ slug: manual_slug })
      .select('_id')
      .lean();

    if (existing_slug_owner) {
      return err('A collection with this slug already exists', 409);
    }
  }

  const created_collection = await Collection.create({
    name: payload.name,
    slug: manual_slug,
    description: payload.description ?? null,
    bannerImage: payload.bannerImage ?? null,
    active: payload.active ?? true,
    type: payload.type ?? CollectionType.MANUAL,
    rules: payload.type === CollectionType.SMART ? (payload.rules ?? []) : [],
    sortOrder: payload.sortOrder ?? 0,
  });

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_CREATED,
    entityType: 'Collection',
    entityId: created_collection._id.toString(),
    newValues: serialize_collection(created_collection),
    metadata: { resource: 'collection' },
    ...requestMeta(req),
  });

  return ok({ collection: serialize_collection(created_collection) }, 201);
}
