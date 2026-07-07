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
import { createProductSchema } from '@/schemas/catalog.schemas';
import {
  CollectionType,
  Gender,
  IDescription,
  MediaType,
  ProductType,
} from '@/types/shared/product';
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

function normalize_description(
  description:
    | {
        narrative: string;
        styleCode?: string | null;
        colorway?: string | null;
        releaseDate?: Date | null;
        materials?: string | null;
        editorialHighlights?: string[];
        additionalSections?: { title: string; content: string }[];
      }
    | undefined
): IDescription {
  return {
    narrative: description?.narrative?.trim() ?? '',
    styleCode: description?.styleCode?.trim()?.toUpperCase() || null,
    colorway: description?.colorway?.trim() || null,
    releaseDate: description?.releaseDate ?? null,
    materials: description?.materials?.trim() || null,
    editorialHighlights: unique_string_array(description?.editorialHighlights),
    additionalSections: (description?.additionalSections ?? [])
      .map((section) => ({
        title: section.title.trim(),
        content: section.content.trim(),
      }))
      .filter((section) => section.title.length > 0 && section.content.length > 0),
  };
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

function normalize_media(
  media:
    | {
        url: string;
        alt: string;
        type?: MediaType;
        order?: number;
      }[]
    | undefined
) {
  if (!media) return [];

  const sortable_media = media.map((media_item, index) => ({
    media_item,
    original_index: index,
    requested_order:
      typeof media_item.order === 'number' && Number.isFinite(media_item.order)
        ? media_item.order
        : Number.MAX_SAFE_INTEGER,
  }));

  sortable_media.sort((left, right) => {
    if (left.requested_order !== right.requested_order) {
      return left.requested_order - right.requested_order;
    }

    return left.original_index - right.original_index;
  });

  return sortable_media.map(({ media_item }, index) => ({
    url: media_item.url,
    alt: media_item.alt,
    type: media_item.type ?? MediaType.IMAGE,
    order: index,
  }));
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
  description: IDescription;
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

function build_product_query(req: NextRequest) {
  const search_term = req.nextUrl.searchParams.get('search')?.trim();
  const active_filter = req.nextUrl.searchParams.get('active');
  const brand_filter = req.nextUrl.searchParams.get('brand');
  const category_filter = req.nextUrl.searchParams.get('category');
  const collection_filter = req.nextUrl.searchParams.get('collection');
  const product_type_filter = req.nextUrl.searchParams.get('productType');
  const gender_filter = req.nextUrl.searchParams.get('gender');

  const query: Record<string, unknown> = {};

  if (search_term) {
    query.$or = [
      { name: { $regex: search_term, $options: 'i' } },
      { slug: { $regex: search_term, $options: 'i' } },
      { 'description.narrative': { $regex: search_term, $options: 'i' } },
      { 'description.styleCode': { $regex: search_term, $options: 'i' } },
      { 'description.colorway': { $regex: search_term, $options: 'i' } },
      { 'description.materials': { $regex: search_term, $options: 'i' } },
      { 'description.editorialHighlights': { $regex: search_term, $options: 'i' } },
      { tags: { $regex: search_term, $options: 'i' } },
    ];
  }

  if (active_filter === 'true') query.active = true;
  if (active_filter === 'false') query.active = false;

  if (brand_filter) {
    if (!Types.ObjectId.isValid(brand_filter)) {
      return { error: 'Invalid brand filter', status: 400 as const };
    }
    query.brand = brand_filter;
  }

  if (category_filter) {
    if (!Types.ObjectId.isValid(category_filter)) {
      return { error: 'Invalid category filter', status: 400 as const };
    }
    query.category = category_filter;
  }

  if (collection_filter) {
    if (!Types.ObjectId.isValid(collection_filter)) {
      return { error: 'Invalid collection filter', status: 400 as const };
    }
    query.collections = collection_filter;
  }

  if (product_type_filter) {
    if (!Object.values(ProductType).includes(product_type_filter as ProductType)) {
      return { error: 'Invalid product type filter', status: 400 as const };
    }
    query.productType = product_type_filter;
  }

  if (gender_filter) {
    if (!Object.values(Gender).includes(gender_filter as Gender)) {
      return { error: 'Invalid gender filter', status: 400 as const };
    }
    query.gender = gender_filter;
  }

  return { query };
}

export async function GET(req: NextRequest) {
  const authorization = await requirePermission(Permission.PRODUCTS_READ);
  if (!authorization.ok) {
    return authorization.response;
  }

  const query_result = build_product_query(req);
  if (!('query' in query_result)) {
    return err(query_result.error, query_result.status);
  }

  await connect_to_database();

  const products = await Product.find(query_result.query)
    .sort({ createdAt: -1 })
    .select(product_select_fields)
    .populate('brand', 'name slug')
    .populate('category', 'name slug')
    .populate('collections', 'name slug type')
    .lean();

  return ok({
    products: products.map(serialize_product),
    total: products.length,
  });
}

export async function POST(req: NextRequest) {
  const authorization = await requirePermission(Permission.PRODUCTS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const request_body = await req.json().catch(() => null);
  const validation_result = createProductSchema.safeParse(request_body);

  if (!validation_result.success) {
    return format_validation_issues(validation_result.error.issues);
  }

  const payload = validation_result.data;
  let manual_slug = payload.slug ? slugify(payload.slug) : slugify(payload.name); // bug fixed: slugify is applied to the name if slug is not provided
  const collection_ids = unique_object_ids(payload.collections);

  await connect_to_database();

  if (manual_slug) {
    const existing_slug_owner = await Product.findOne({ slug: manual_slug }).select('_id').lean();
    if (existing_slug_owner) {
      // return err('A product with this slug already exists', 409);

      // create a unique slug by appending a random string to the end of the slug
      const random_string = Math.random().toString(36).substring(2, 8);
      manual_slug = `${manual_slug}-${random_string}`;
    }
  }

  const relation_error = await validate_product_relations({
    brandId: payload.brand,
    categoryId: payload.category,
    collectionIds: collection_ids,
  });

  if (relation_error) {
    return err(relation_error.error, relation_error.status);
  }

  const created_product = await Product.create({
    name: payload.name,
    slug: manual_slug,
    brand: new Types.ObjectId(payload.brand),
    category: new Types.ObjectId(payload.category),
    collections: collection_ids.map((collection_id) => new Types.ObjectId(collection_id)),
    productType: payload.productType,
    gender: payload.gender,
    description: normalize_description(payload.description),
    features: unique_string_array(payload.features),
    media: normalize_media(payload.media),
    sizes: normalize_sizes(payload.sizes),
    pricing: {
      currency: (payload.pricing.currency ?? 'NGN').toUpperCase(),
      basePrice: payload.pricing.basePrice,
      compareAtPrice: payload.pricing.compareAtPrice ?? null,
      costPrice: payload.pricing.costPrice ?? null,
    },
    seo: {
      title: payload.seo?.title ?? null,
      description: payload.seo?.description ?? null,
      keywords: unique_string_array(payload.seo?.keywords),
    },
    tags: unique_string_array(payload.tags),
    active: payload.active ?? false,
  });

  const populated_product = await Product.findById(created_product._id)
    .select(product_select_fields)
    .populate('brand', 'name slug')
    .populate('category', 'name slug')
    .populate('collections', 'name slug type')
    .lean();

  if (!populated_product) {
    return err('Product not found after creation', 500);
  }

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_CREATED,
    entityType: 'Product',
    entityId: populated_product._id.toString(),
    newValues: serialize_product(populated_product),
    metadata: { resource: 'product' },
    ...requestMeta(req),
  });

  return ok({ product: serialize_product(populated_product) }, 201);
}
