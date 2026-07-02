import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Brand from '@/models/Brand';
import { createBrandSchema } from '@/schemas/catalog.schemas';
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

export async function GET(req: NextRequest) {
  const authorization = await requirePermission(Permission.BRANDS_READ);
  if (!authorization.ok) {
    return authorization.response;
  }

  await connect_to_database();

  const search_term = req.nextUrl.searchParams.get('search')?.trim();
  const active_filter = req.nextUrl.searchParams.get('active');

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

  const brands = await Brand.find(query).sort({ name: 1 }).select(brand_select_fields).lean();

  return ok({
    brands: brands.map(serialize_brand),
    total: brands.length,
  });
}

export async function POST(req: NextRequest) {
  const authorization = await requirePermission(Permission.BRANDS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const request_body = await req.json().catch(() => null);
  const validation_result = createBrandSchema.safeParse(request_body);

  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  await connect_to_database();

  const payload = validation_result.data;
  const manual_slug = payload.slug ? slugify(payload.slug) : undefined;

  if (manual_slug) {
    const existing_slug_owner = await Brand.findOne({ slug: manual_slug }).select('_id').lean();
    if (existing_slug_owner) {
      return err('A brand with this slug already exists', 409);
    }
  }

  const created_brand = await Brand.create({
    name: payload.name,
    slug: manual_slug,
    logo: payload.logo ?? null,
    description: payload.description ?? null,
    website: payload.website ?? null,
    active: payload.active ?? true,
  });

  const audit_meta = requestMeta(req);

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_CREATED,
    entityType: 'Brand',
    entityId: created_brand._id.toString(),
    newValues: {
      name: created_brand.name,
      slug: created_brand.slug,
      active: created_brand.active,
    },
    metadata: {
      adminUserId: authorization.user.userId,
      resource: 'brand',
    },
    ...audit_meta,
  });

  return ok({ brand: serialize_brand(created_brand) }, 201);
}
