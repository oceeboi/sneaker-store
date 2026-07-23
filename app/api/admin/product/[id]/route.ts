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
  adminProductUpdateSchema,
  type AdminProductCreateInput,
  type AdminProductUpdateInput,
} from '@/modules/products/schemas/admin-product.schemas';
import {
  PRODUCT_SELECT_FIELDS,
  formatValidationIssues,
  normalizeDescription,
  normalizeMedia,
  serializeProduct,
  serializeReference,
  uniqueObjectIds,
  uniqueStringArray,
  validateProductRelations,
} from '@/modules/products/services/admin-product-route-helpers';
import { slugify } from '@/utils/slug';

async function getProductId(ctx: RouteContext<'/api/admin/product/[id]'>) {
  const { id } = await ctx.params;
  return id;
}

function applyProductPatch(product: any, payload: AdminProductUpdateInput) {
  if (payload.name !== undefined) product.name = payload.name;
  if (payload.brand !== undefined) product.brand = new Types.ObjectId(payload.brand);
  if (payload.category !== undefined) product.category = new Types.ObjectId(payload.category);
  if (payload.collections !== undefined) {
    product.collections = uniqueObjectIds(payload.collections).map(
      (collectionId) => new Types.ObjectId(collectionId)
    );
  }
  if (payload.productType !== undefined) product.productType = payload.productType;
  if (payload.gender !== undefined) product.gender = payload.gender;
  if (payload.description !== undefined)
    product.description = normalizeDescription(payload.description);
  if (payload.features !== undefined) product.features = uniqueStringArray(payload.features);
  if (payload.media !== undefined) product.media = normalizeMedia(payload.media);
  if (payload.pricing !== undefined) {
    product.pricing = {
      currency: (payload.pricing.currency ?? product.pricing.currency ?? 'NGN').toUpperCase(),
      basePrice: payload.pricing.basePrice ?? product.pricing.basePrice,
      compareAtPrice:
        payload.pricing.compareAtPrice !== undefined
          ? payload.pricing.compareAtPrice
          : product.pricing.compareAtPrice,
      costPrice:
        payload.pricing.costPrice !== undefined
          ? payload.pricing.costPrice
          : (product.pricing.costPrice ?? null),
    };
  }
  if (payload.seo !== undefined) {
    product.seo = {
      title: payload.seo.title !== undefined ? payload.seo.title : (product.seo.title ?? null),
      description:
        payload.seo.description !== undefined
          ? payload.seo.description
          : (product.seo.description ?? null),
      keywords:
        payload.seo.keywords !== undefined
          ? uniqueStringArray(payload.seo.keywords)
          : product.seo.keywords,
    };
  }
  if (payload.tags !== undefined) product.tags = uniqueStringArray(payload.tags);
  if (payload.active !== undefined) product.active = payload.active;
}

function applyProductReplace(product: any, payload: AdminProductCreateInput) {
  product.name = payload.name;
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

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/admin/product/[id]'>) {
  const authorization = await requirePermission(Permission.PRODUCTS_READ);
  if (!authorization.ok) {
    return authorization.response;
  }

  const productId = await getProductId(ctx);
  if (!Types.ObjectId.isValid(productId)) {
    return err('Invalid product id', 400);
  }

  await connect_to_database();

  const foundProduct = await Product.findById(productId)
    .select(PRODUCT_SELECT_FIELDS)
    .populate('brand', 'name slug')
    .populate('category', 'name slug')
    .populate('collections', 'name slug type')
    .lean();

  if (!foundProduct) {
    return err('Product not found', 404);
  }

  return ok({ product: serializeProduct(foundProduct) });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/admin/product/[id]'>) {
  const authorization = await requirePermission(Permission.PRODUCTS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const productId = await getProductId(ctx);
  if (!Types.ObjectId.isValid(productId)) {
    return err('Invalid product id', 400);
  }

  const requestBody = await req.json().catch(() => null);
  const validationResult = adminProductUpdateSchema.safeParse(requestBody);

  if (!validationResult.success) {
    return formatValidationIssues(validationResult.error.issues);
  }

  await connect_to_database();

  const foundProduct = await Product.findById(productId)
    .select(PRODUCT_SELECT_FIELDS)
    .populate('brand', 'name slug')
    .populate('category', 'name slug')
    .populate('collections', 'name slug type');

  if (!foundProduct) {
    return err('Product not found', 404);
  }

  const payload = validationResult.data;
  const manualSlug = payload.slug ? slugify(payload.slug) : undefined;

  if (manualSlug) {
    const existingSlugOwner = await Product.findOne({
      slug: manualSlug,
      _id: { $ne: foundProduct._id },
    })
      .select('_id')
      .lean();

    if (existingSlugOwner) {
      return err('A product with this slug already exists', 409);
    }

    foundProduct.slug = manualSlug;
  }

  const relationCheck = await validateProductRelations({
    brandId: payload.brand ?? serializeReference(foundProduct.brand)?.id ?? '',
    categoryId: payload.category ?? serializeReference(foundProduct.category)?.id ?? '',
    collectionIds: payload.collections
      ? uniqueObjectIds(payload.collections)
      : foundProduct.collections
          .map((collection: unknown) => serializeReference(collection)?.id ?? '')
          .filter(Boolean),
  });

  if (relationCheck) {
    return err(relationCheck.error, relationCheck.status);
  }

  const oldValues = serializeProduct(foundProduct as any);
  applyProductPatch(foundProduct, payload);

  await foundProduct.save();
  await foundProduct.populate('brand', 'name slug');
  await foundProduct.populate('category', 'name slug');
  await foundProduct.populate('collections', 'name slug type');

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_UPDATED,
    entityType: 'Product',
    entityId: foundProduct._id.toString(),
    oldValues,
    newValues: serializeProduct(foundProduct as any),
    metadata: { resource: 'product' },
    ...requestMeta(req),
  });

  return ok({ product: serializeProduct(foundProduct as any) });
}

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/admin/product/[id]'>) {
  const authorization = await requirePermission(Permission.PRODUCTS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const productId = await getProductId(ctx);
  if (!Types.ObjectId.isValid(productId)) {
    return err('Invalid product id', 400);
  }

  const requestBody = await req.json().catch(() => null);
  const validationResult = adminProductCreateSchema.safeParse(requestBody);

  if (!validationResult.success) {
    return formatValidationIssues(validationResult.error.issues);
  }

  await connect_to_database();

  const foundProduct = await Product.findById(productId)
    .select(PRODUCT_SELECT_FIELDS)
    .populate('brand', 'name slug')
    .populate('category', 'name slug')
    .populate('collections', 'name slug type');

  if (!foundProduct) {
    return err('Product not found', 404);
  }

  const payload = validationResult.data;
  const manualSlug = payload.slug ? slugify(payload.slug) : slugify(payload.name);

  const existingSlugOwner = await Product.findOne({
    slug: manualSlug,
    _id: { $ne: foundProduct._id },
  })
    .select('_id')
    .lean();

  if (existingSlugOwner) {
    return err('A product with this slug already exists', 409);
  }

  const relationCheck = await validateProductRelations({
    brandId: payload.brand,
    categoryId: payload.category,
    collectionIds: uniqueObjectIds(payload.collections),
  });

  if (relationCheck) {
    return err(relationCheck.error, relationCheck.status);
  }

  const oldValues = serializeProduct(foundProduct as any);
  applyProductReplace(foundProduct, payload);
  foundProduct.slug = manualSlug;

  await foundProduct.save();
  await foundProduct.populate('brand', 'name slug');
  await foundProduct.populate('category', 'name slug');
  await foundProduct.populate('collections', 'name slug type');

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_UPDATED,
    entityType: 'Product',
    entityId: foundProduct._id.toString(),
    oldValues,
    newValues: serializeProduct(foundProduct as any),
    metadata: { resource: 'product', operation: 'PUT' },
    ...requestMeta(req),
  });

  return ok({ product: serializeProduct(foundProduct as any) });
}

export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/admin/product/[id]'>) {
  const authorization = await requirePermission(Permission.PRODUCTS_WRITE);
  if (!authorization.ok) {
    return authorization.response;
  }

  const productId = await getProductId(ctx);
  if (!Types.ObjectId.isValid(productId)) {
    return err('Invalid product id', 400);
  }

  await connect_to_database();

  const foundProduct = await Product.findById(productId)
    .select(PRODUCT_SELECT_FIELDS)
    .populate('brand', 'name slug')
    .populate('category', 'name slug')
    .populate('collections', 'name slug type');

  if (!foundProduct) {
    return err('Product not found', 404);
  }

  const oldValues = serializeProduct(foundProduct as any);

  await Product.deleteOne({ _id: new Types.ObjectId(productId) });

  writeAuditLog({
    userId: null,
    actorId: new Types.ObjectId(authorization.user.userId),
    action: AuditAction.CATALOG_ENTITY_DELETED,
    entityType: 'Product',
    entityId: productId,
    oldValues,
    metadata: { resource: 'product' },
    ...requestMeta(req),
  });

  return ok({ deleted: true });
}
