import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Category from '@/models/Category';
import { createCategorySchema } from '@/schemas/catalog.schemas';
import { slugify } from '@/utils/slug';

const category_select_fields =
  'name slug parent image description sortOrder active createdAt updatedAt';

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

function serialize_category(category: {
  _id: { toString(): string };
  name: string;
  slug: string;
  parent: { toString(): string } | null;
  image: string | null;
  description: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    parentId: category.parent?.toString() ?? null,
    image: category.image,
    description: category.description,
    sortOrder: category.sortOrder,
    active: category.active,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  const authorization = await requirePermission(Permission.CATEGORIES_READ);
  if (!authorization.ok) {
    return authorization.response;
  }

  await connect_to_database();

  const search_term = req.nextUrl.searchParams.get('search')?.trim();
  const active_filter = req.nextUrl.searchParams.get('active');
  const parent_filter = req.nextUrl.searchParams.get('parent');

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

  if (parent_filter === 'null') {
    query.parent = null;
  } else if (parent_filter) {
    if (!/^[a-f\d]{24}$/i.test(parent_filter)) {
      return err('Invalid parent id filter', 400);
    }
    query.parent = parent_filter;
  }

  const categories = await Category.find(query)
    .sort({ sortOrder: 1, name: 1 })
    .select(category_select_fields)
    .lean();

  return ok({
    categories: categories.map(serialize_category),
    total: categories.length,
  });
}

export async function POST(req: NextRequest) {
  const authorization = await requirePermission(Permission.CATEGORIES_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const request_body = await req.json().catch(() => null);
  const validation_result = createCategorySchema.safeParse(request_body);

  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  await connect_to_database();

  const payload = validation_result.data;
  const manual_slug = payload.slug ? slugify(payload.slug) : undefined;

  if (manual_slug) {
    const existing_slug_owner = await Category.findOne({ slug: manual_slug }).select('_id').lean();
    if (existing_slug_owner) {
      return err('A category with this slug already exists', 409);
    }
  }

  if (payload.parent) {
    const parent_category = await Category.findById(payload.parent).select('_id').lean();
    if (!parent_category) {
      return err('Parent category not found', 404);
    }
  }

  const created_category = await Category.create({
    name: payload.name,
    slug: manual_slug,
    parent: payload.parent ?? null,
    image: payload.image ?? null,
    description: payload.description ?? null,
    sortOrder: payload.sortOrder ?? 0,
    active: payload.active ?? true,
  });

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_CREATED,
    entityType: 'Category',
    entityId: created_category._id.toString(),
    newValues: serialize_category(created_category),
    metadata: { resource: 'category' },
    ...requestMeta(req),
  });

  return ok({ category: serialize_category(created_category) }, 201);
}
