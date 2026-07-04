import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Brand from '@/models/Brand';
import Category from '@/models/Category';
import Collection from '@/models/Collection';
import Product from '@/models/Product';
import { createProductSchema, updateProductSchema } from '@/schemas/catalog.schemas';
import { Gender, MediaType, ProductType } from '@/types/shared/product';
import { slugify } from '@/utils/slug';

const product_select_fields =
  'name slug brand category collections productType gender description features media sizes pricing.currency pricing.basePrice pricing.compareAtPrice +pricing.costPrice seo tags active publishedAt createdAt updatedAt';

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

function unique_string_array(values: string[] | undefined) {
  if (!values) return [];
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function unique_object_ids(values: string[] | undefined) {
  if (!values) return [];
  return [...new Set(values)];
}

function normalize_sizes(
  sizes:
    | {
        size: string;
        sku?: string | null;
        barcode?: string | null;
        stockQuantity: number;
        reservedQuantity?: number;
        reorderLevel?: number;
        active?: boolean;
      }[]
    | undefined
) {
  if (!sizes) return [];

  const deduped = new Map<
    string,
    {
      size: string;
      sku: string | null;
      barcode: string | null;
      stockQuantity: number;
      reservedQuantity: number;
      reorderLevel: number;
      active: boolean;
    }
  >();

  for (const size_option of sizes) {
    const normalized_size_key = size_option.size.trim().toLowerCase();
    deduped.set(normalized_size_key, {
      size: size_option.size.trim(),
      sku: size_option.sku?.trim() || null,
      barcode: size_option.barcode?.trim() || null,
      stockQuantity: size_option.stockQuantity,
      reservedQuantity: size_option.reservedQuantity ?? 0,
      reorderLevel: size_option.reorderLevel ?? 0,
      active: size_option.active ?? true,
    });
  }

  return [...deduped.values()];
}

function serialize_reference(reference: unknown) {
  if (!reference) return null;
  if (typeof reference === 'object' && '_id' in reference) {
    const populated_reference = reference as {
      _id: { toString(): string };
      name?: string;
      slug?: string;
    };

    return {
      id: populated_reference._id.toString(),
      name: populated_reference.name ?? null,
      slug: populated_reference.slug ?? null,
    };
  }

  return { id: String(reference), name: null, slug: null };
}

function serialize_product(product: {
  _id: { toString(): string };
  name: string;
  slug: string;
  brand: unknown;
  category: unknown;
  collections: unknown[];
  productType: ProductType;
  gender: Gender;
  description: string | null;
  features: string[];
  media: { url: string; alt: string; type: MediaType; order: number }[];
  sizes: {
    size: string;
    sku: string | null;
    barcode: string | null;
    stockQuantity: number;
    reservedQuantity: number;
    reorderLevel: number;
    active: boolean;
  }[];
  pricing: {
    currency: string;
    basePrice: number;
    compareAtPrice: number | null;
    costPrice?: number | null;
  };
  seo: {
    title: string | null;
    description: string | null;
    keywords: string[];
  };
  tags: string[];
  active: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    brand: serialize_reference(product.brand),
    category: serialize_reference(product.category),
    collections: product.collections.map(serialize_reference),
    productType: product.productType,
    gender: product.gender,
    description: product.description,
    features: product.features,
    media: product.media,
    sizes: product.sizes.map((size_option) => ({
      ...size_option,
      availableQuantity: Math.max(0, size_option.stockQuantity - size_option.reservedQuantity),
    })),
    pricing: {
      currency: product.pricing.currency,
      basePrice: product.pricing.basePrice,
      compareAtPrice: product.pricing.compareAtPrice,
      costPrice: product.pricing.costPrice ?? null,
    },
    seo: {
      title: product.seo.title,
      description: product.seo.description,
      keywords: product.seo.keywords,
    },
    tags: product.tags,
    active: product.active,
    publishedAt: product.publishedAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

async function validate_product_relations(input: {
  brandId: string;
  categoryId: string;
  collectionIds: string[];
}) {
  const [brand_exists, category_exists, collections] = await Promise.all([
    Brand.findById(input.brandId).select('_id').lean(),
    Category.findById(input.categoryId).select('_id').lean(),
    input.collectionIds.length > 0
      ? Collection.find({ _id: { $in: input.collectionIds } })
          .select('_id')
          .lean()
      : Promise.resolve([]),
  ]);

  if (!brand_exists) {
    return { error: 'Brand not found', status: 404 as const };
  }

  if (!category_exists) {
    return { error: 'Category not found', status: 404 as const };
  }

  if (collections.length !== input.collectionIds.length) {
    return { error: 'One or more collections were not found', status: 404 as const };
  }

  return null;
}

async function get_product_id(ctx: RouteContext<'/api/admin/product/[id]'>) {
  const { id } = await ctx.params;
  return id;
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/admin/product/[id]'>) {
  const authorization = await requirePermission(Permission.PRODUCTS_READ);
  if (!authorization.ok) {
    return authorization.response;
  }

  const product_id = await get_product_id(ctx);
  if (!Types.ObjectId.isValid(product_id)) {
    return err('Invalid product id', 400);
  }

  await connect_to_database();

  const found_product = await Product.findById(product_id)
    .select(product_select_fields)
    .populate('brand', 'name slug')
    .populate('category', 'name slug')
    .populate('collections', 'name slug type');

  if (!found_product) {
    return err('Product not found', 404);
  }

  return ok({ product: serialize_product(found_product) });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/admin/product/[id]'>) {
  const authorization = await requirePermission(Permission.PRODUCTS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const product_id = await get_product_id(ctx);
  if (!Types.ObjectId.isValid(product_id)) {
    return err('Invalid product id', 400);
  }

  const request_body = await req.json().catch(() => null);
  const validation_result = updateProductSchema.safeParse(request_body);

  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  await connect_to_database();

  const found_product = await Product.findById(product_id)
    .select(product_select_fields)
    .populate('brand', 'name slug')
    .populate('category', 'name slug')
    .populate('collections', 'name slug type');

  if (!found_product) {
    return err('Product not found', 404);
  }

  const payload = validation_result.data;
  const manual_slug = payload.slug ? slugify(payload.slug) : undefined;

  if (manual_slug) {
    const existing_slug_owner = await Product.findOne({
      slug: manual_slug,
      _id: { $ne: found_product._id },
    })
      .select('_id')
      .lean();

    if (existing_slug_owner) {
      return err('A product with this slug already exists', 409);
    }
  }

  const relation_check = await validate_product_relations({
    brandId: payload.brand ?? serialize_reference(found_product.brand)?.id ?? '',
    categoryId: payload.category ?? serialize_reference(found_product.category)?.id ?? '',
    collectionIds: payload.collections
      ? unique_object_ids(payload.collections)
      : found_product.collections
          .map((collection) => serialize_reference(collection)?.id ?? '')
          .filter(Boolean),
  });

  if (relation_check) {
    return err(relation_check.error, relation_check.status);
  }

  const old_values = serialize_product(found_product);

  if (payload.name !== undefined) found_product.name = payload.name;
  if (manual_slug !== undefined) found_product.slug = manual_slug;
  if (payload.brand !== undefined) found_product.brand = new Types.ObjectId(payload.brand);
  if (payload.category !== undefined) found_product.category = new Types.ObjectId(payload.category);
  if (payload.collections !== undefined) {
    found_product.collections = unique_object_ids(payload.collections).map(
      (collection_id) => new Types.ObjectId(collection_id)
    );
  }
  if (payload.productType !== undefined) found_product.productType = payload.productType;
  if (payload.gender !== undefined) found_product.gender = payload.gender;
  if (payload.description !== undefined) found_product.description = payload.description;
  if (payload.features !== undefined)
    found_product.features = unique_string_array(payload.features);
  if (payload.media !== undefined) {
    found_product.media = payload.media.map((media_item, index) => ({
      url: media_item.url,
      alt: media_item.alt,
      type: media_item.type ?? MediaType.IMAGE,
      order: media_item.order ?? index,
    }));
  }
  if (payload.sizes !== undefined) {
    found_product.sizes = normalize_sizes(payload.sizes);
  }
  if (payload.pricing !== undefined) {
    found_product.pricing = {
      currency: (payload.pricing.currency ?? found_product.pricing.currency ?? 'NGN').toUpperCase(),
      basePrice: payload.pricing.basePrice ?? found_product.pricing.basePrice,
      compareAtPrice:
        payload.pricing.compareAtPrice !== undefined
          ? payload.pricing.compareAtPrice
          : found_product.pricing.compareAtPrice,
      costPrice:
        payload.pricing.costPrice !== undefined
          ? payload.pricing.costPrice
          : (found_product.pricing.costPrice ?? null),
    };
  }
  if (payload.seo !== undefined) {
    found_product.seo = {
      title:
        payload.seo.title !== undefined ? payload.seo.title : (found_product.seo.title ?? null),
      description:
        payload.seo.description !== undefined
          ? payload.seo.description
          : (found_product.seo.description ?? null),
      keywords:
        payload.seo.keywords !== undefined
          ? unique_string_array(payload.seo.keywords)
          : found_product.seo.keywords,
    };
  }
  if (payload.tags !== undefined) found_product.tags = unique_string_array(payload.tags);
  if (payload.active !== undefined) found_product.active = payload.active;

  await found_product.save();
  await found_product.populate('brand', 'name slug');
  await found_product.populate('category', 'name slug');
  await found_product.populate('collections', 'name slug type');

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_UPDATED,
    entityType: 'Product',
    entityId: found_product._id.toString(),
    oldValues: old_values,
    newValues: serialize_product(found_product),
    metadata: { resource: 'product' },
    ...requestMeta(req),
  });

  return ok({ product: serialize_product(found_product) });
}

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/admin/product/[id]'>) {
  const authorization = await requirePermission(Permission.PRODUCTS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const product_id = await get_product_id(ctx);
  if (!Types.ObjectId.isValid(product_id)) {
    return err('Invalid product id', 400);
  }

  const request_body = await req.json().catch(() => null);
  const validation_result = createProductSchema.safeParse(request_body);

  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  await connect_to_database();

  const found_product = await Product.findById(product_id)
    .select(product_select_fields)
    .populate('brand', 'name slug')
    .populate('category', 'name slug')
    .populate('collections', 'name slug type');

  if (!found_product) {
    return err('Product not found', 404);
  }

  const payload = validation_result.data;
  const manual_slug = payload.slug ? slugify(payload.slug) : slugify(payload.name);

  const existing_slug_owner = await Product.findOne({
    slug: manual_slug,
    _id: { $ne: found_product._id },
  })
    .select('_id')
    .lean();

  if (existing_slug_owner) {
    return err('A product with this slug already exists', 409);
  }

  const relation_check = await validate_product_relations({
    brandId: payload.brand,
    categoryId: payload.category,
    collectionIds: unique_object_ids(payload.collections),
  });

  if (relation_check) {
    return err(relation_check.error, relation_check.status);
  }

  const old_values = serialize_product(found_product);

  found_product.name = payload.name;
  found_product.slug = manual_slug;
  found_product.brand = new Types.ObjectId(payload.brand);
  found_product.category = new Types.ObjectId(payload.category);
  found_product.collections = unique_object_ids(payload.collections).map(
    (collection_id) => new Types.ObjectId(collection_id)
  );
  found_product.productType = payload.productType;
  found_product.gender = payload.gender;
  found_product.description = payload.description ?? null;
  found_product.features = unique_string_array(payload.features);
  found_product.media = (payload.media ?? []).map((media_item, index) => ({
    url: media_item.url,
    alt: media_item.alt,
    type: media_item.type ?? MediaType.IMAGE,
    order: media_item.order ?? index,
  }));
  found_product.sizes = normalize_sizes(payload.sizes);
  found_product.pricing = {
    currency: (payload.pricing.currency ?? 'NGN').toUpperCase(),
    basePrice: payload.pricing.basePrice,
    compareAtPrice: payload.pricing.compareAtPrice ?? null,
    costPrice: payload.pricing.costPrice ?? null,
  };
  found_product.seo = {
    title: payload.seo?.title ?? null,
    description: payload.seo?.description ?? null,
    keywords: unique_string_array(payload.seo?.keywords),
  };
  found_product.tags = unique_string_array(payload.tags);
  found_product.active = payload.active ?? false;

  await found_product.save();
  await found_product.populate('brand', 'name slug');
  await found_product.populate('category', 'name slug');
  await found_product.populate('collections', 'name slug type');

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_UPDATED,
    entityType: 'Product',
    entityId: found_product._id.toString(),
    oldValues: old_values,
    newValues: serialize_product(found_product),
    metadata: { resource: 'product', operation: 'PUT' },
    ...requestMeta(req),
  });

  return ok({ product: serialize_product(found_product) });
}

export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/admin/product/[id]'>) {
  const authorization = await requirePermission(Permission.PRODUCTS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const product_id = await get_product_id(ctx);
  if (!Types.ObjectId.isValid(product_id)) {
    return err('Invalid product id', 400);
  }

  await connect_to_database();

  const found_product = await Product.findById(product_id)
    .select(product_select_fields)
    .populate('brand', 'name slug')
    .populate('category', 'name slug')
    .populate('collections', 'name slug type');

  if (!found_product) {
    return err('Product not found', 404);
  }

  const old_values = serialize_product(found_product);

  await Product.deleteOne({ _id: new Types.ObjectId(product_id) });

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_DELETED,
    entityType: 'Product',
    entityId: product_id,
    oldValues: old_values,
    metadata: { resource: 'product' },
    ...requestMeta(req),
  });

  return ok({ deleted: true });
}
