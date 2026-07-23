import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { Permission } from '@/config/rbac';
import { err, ok, requestMeta, writeAuditLog } from '@/lib/auth/response';
import { requirePermission } from '@/lib/authorize.middleware';
import connect_to_database from '@/lib/db';
import { AuditAction } from '@/models/Auditlog';
import Product from '@/models/Product';
import {
  adminProductCreateSchema,
  type AdminProductCreateInput,
} from '@/modules/products/schemas/admin-product.schemas';
import {
  PRODUCT_SELECT_FIELDS,
  formatValidationIssues,
  normalizeDescription,
  normalizeMedia,
  serializeProduct,
  uniqueObjectIds,
  uniqueStringArray,
  validateProductRelations,
} from '@/modules/products/services/admin-product-route-helpers';
import { Gender, ProductType } from '@/types/shared/product';
import { slugify } from '@/utils/slug';

function buildProductQuery(req: NextRequest) {
  const searchTerm = req.nextUrl.searchParams.get('search')?.trim();
  const activeFilter = req.nextUrl.searchParams.get('active');
  const brandFilter = req.nextUrl.searchParams.get('brand');
  const categoryFilter = req.nextUrl.searchParams.get('category');
  const collectionFilter = req.nextUrl.searchParams.get('collection');
  const productTypeFilter = req.nextUrl.searchParams.get('productType');
  const genderFilter = req.nextUrl.searchParams.get('gender');

  const query: Record<string, unknown> = {};

  if (searchTerm) {
    query.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { slug: { $regex: searchTerm, $options: 'i' } },
      { 'description.narrative': { $regex: searchTerm, $options: 'i' } },
      { 'description.styleCode': { $regex: searchTerm, $options: 'i' } },
      { 'description.colorway': { $regex: searchTerm, $options: 'i' } },
      { 'description.materials': { $regex: searchTerm, $options: 'i' } },
      { 'description.editorialHighlights': { $regex: searchTerm, $options: 'i' } },
      { tags: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  if (activeFilter === 'true') query.active = true;
  if (activeFilter === 'false') query.active = false;

  if (brandFilter) {
    if (!Types.ObjectId.isValid(brandFilter)) {
      return { error: 'Invalid brand filter', status: 400 as const };
    }
    query.brand = brandFilter;
  }

  if (categoryFilter) {
    if (!Types.ObjectId.isValid(categoryFilter)) {
      return { error: 'Invalid category filter', status: 400 as const };
    }
    query.category = categoryFilter;
  }

  if (collectionFilter) {
    if (!Types.ObjectId.isValid(collectionFilter)) {
      return { error: 'Invalid collection filter', status: 400 as const };
    }
    query.collections = collectionFilter;
  }

  if (productTypeFilter) {
    if (!Object.values(ProductType).includes(productTypeFilter as ProductType)) {
      return { error: 'Invalid product type filter', status: 400 as const };
    }
    query.productType = productTypeFilter;
  }

  if (genderFilter) {
    if (!Object.values(Gender).includes(genderFilter as Gender)) {
      return { error: 'Invalid gender filter', status: 400 as const };
    }
    query.gender = genderFilter;
  }

  return { query };
}

function applyProductPayload(product: any, payload: AdminProductCreateInput) {
  product.name = payload.name;
  product.slug = payload.slug ? slugify(payload.slug) : slugify(payload.name);
  product.brand = new Types.ObjectId(payload.brand);
  product.category = new Types.ObjectId(payload.category);
  product.collections = uniqueObjectIds(payload.collections).map(
    (collectionId) => new Types.ObjectId(collectionId)
  );
  product.productType = payload.productType;
  product.gender = payload.gender;
  product.description = normalizeDescription(payload.description);
  product.features = uniqueStringArray(payload.features);
  product.media = normalizeMedia(payload.media);
  product.pricing = {
    currency: (payload.pricing.currency ?? 'NGN').toUpperCase(),
    basePrice: payload.pricing.basePrice,
    compareAtPrice: payload.pricing.compareAtPrice ?? null,
    costPrice: payload.pricing.costPrice ?? null,
  };
  product.seo = {
    title: payload.seo?.title ?? null,
    description: payload.seo?.description ?? null,
    keywords: uniqueStringArray(payload.seo?.keywords),
  };
  product.tags = uniqueStringArray(payload.tags);
  product.active = payload.active ?? false;
}

export async function GET(req: NextRequest) {
  const authorization = await requirePermission(Permission.PRODUCTS_READ);
  if (!authorization.ok) {
    return authorization.response;
  }

  const queryResult = buildProductQuery(req);
  if (!('query' in queryResult)) {
    return err(queryResult.error, queryResult.status);
  }

  await connect_to_database();

  const products = await Product.find(queryResult.query)
    .sort({ createdAt: -1 })
    .select(PRODUCT_SELECT_FIELDS)
    .populate('brand', 'name slug')
    .populate('category', 'name slug')
    .populate('collections', 'name slug type')
    .lean();

  return ok({
    products: products.map(serializeProduct),
    total: products.length,
  });
}

export async function POST(req: NextRequest) {
  const authorization = await requirePermission(Permission.PRODUCTS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const requestBody = await req.json().catch(() => null);
  const validationResult = adminProductCreateSchema.safeParse(requestBody);

  if (!validationResult.success) {
    return formatValidationIssues(validationResult.error.issues);
  }

  const payload = validationResult.data;
  const manualSlug = payload.slug ? slugify(payload.slug) : slugify(payload.name);
  const collectionIds = uniqueObjectIds(payload.collections);

  await connect_to_database();

  const existingSlugOwner = await Product.findOne({ slug: manualSlug }).select('_id').lean();
  if (existingSlugOwner) {
    return err('A product with this slug already exists', 409);
  }

  const relationError = await validateProductRelations({
    brandId: payload.brand,
    categoryId: payload.category,
    collectionIds,
  });

  if (relationError) {
    return err(relationError.error, relationError.status);
  }

  const createdProduct = new Product();
  applyProductPayload(createdProduct, payload);
  createdProduct.slug = manualSlug;
  await createdProduct.save();

  const populatedProduct = await Product.findById(createdProduct._id)
    .select(PRODUCT_SELECT_FIELDS)
    .populate('brand', 'name slug')
    .populate('category', 'name slug')
    .populate('collections', 'name slug type')
    .lean();

  if (!populatedProduct) {
    return err('Product not found after creation', 500);
  }

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_CREATED,
    entityType: 'Product',
    entityId: populatedProduct._id.toString(),
    newValues: serializeProduct(populatedProduct),
    metadata: { resource: 'product' },
    ...requestMeta(req),
  });

  return ok({ product: serializeProduct(populatedProduct) }, 201);
}
