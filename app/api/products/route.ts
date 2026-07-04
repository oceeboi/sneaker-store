import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { err, ok } from '@/lib/auth/response';
import connect_to_database from '@/lib/db';
import Product from '@/models/Product';
import { Gender, MediaType, ProductType } from '@/types/shared/product';

const public_product_select_fields =
  'name slug brand category collections productType gender description features media sizes pricing seo tags active publishedAt createdAt updatedAt';

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
  };
  seo: {
    title: string | null;
    description: string | null;
    keywords: string[];
  };
  tags: string[];
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
    },
    seo: product.seo,
    tags: product.tags,
    publishedAt: product.publishedAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function parse_positive_int(value: string | null, fallback: number, max: number) {
  if (!value) return fallback;

  const parsed_value = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed_value) || parsed_value < 1) {
    return fallback;
  }

  return Math.min(parsed_value, max);
}

export async function GET(req: NextRequest) {
  const search_term = req.nextUrl.searchParams.get('search')?.trim();
  const brand_filter = req.nextUrl.searchParams.get('brand');
  const category_filter = req.nextUrl.searchParams.get('category');
  const collection_filter = req.nextUrl.searchParams.get('collection');
  const product_type_filter = req.nextUrl.searchParams.get('productType');
  const gender_filter = req.nextUrl.searchParams.get('gender');
  const sort_filter = req.nextUrl.searchParams.get('sort');
  const page = parse_positive_int(req.nextUrl.searchParams.get('page'), 1, Number.MAX_SAFE_INTEGER);
  const limit = parse_positive_int(req.nextUrl.searchParams.get('limit'), 12, 48);

  const query: Record<string, unknown> = {
    active: true,
  };

  if (search_term) {
    query.$or = [
      { name: { $regex: search_term, $options: 'i' } },
      { slug: { $regex: search_term, $options: 'i' } },
      { description: { $regex: search_term, $options: 'i' } },
      { tags: { $regex: search_term, $options: 'i' } },
    ];
  }

  if (brand_filter) {
    if (!Types.ObjectId.isValid(brand_filter)) {
      return err('Invalid brand filter', 400);
    }
    query.brand = brand_filter;
  }

  if (category_filter) {
    if (!Types.ObjectId.isValid(category_filter)) {
      return err('Invalid category filter', 400);
    }
    query.category = category_filter;
  }

  if (collection_filter) {
    if (!Types.ObjectId.isValid(collection_filter)) {
      return err('Invalid collection filter', 400);
    }
    query.collections = collection_filter;
  }

  if (product_type_filter) {
    if (!Object.values(ProductType).includes(product_type_filter as ProductType)) {
      return err('Invalid product type filter', 400);
    }
    query.productType = product_type_filter;
  }

  if (gender_filter) {
    if (!Object.values(Gender).includes(gender_filter as Gender)) {
      return err('Invalid gender filter', 400);
    }
    query.gender = gender_filter;
  }

  let sort_query: Record<string, 1 | -1> = { publishedAt: -1, createdAt: -1 };
  if (sort_filter === 'price_asc') sort_query = { 'pricing.basePrice': 1 };
  if (sort_filter === 'price_desc') sort_query = { 'pricing.basePrice': -1 };
  if (sort_filter === 'name_asc') sort_query = { name: 1 };
  if (sort_filter === 'name_desc') sort_query = { name: -1 };

  await connect_to_database();

  const [total, products] = await Promise.all([
    Product.countDocuments(query),
    Product.find(query)
      .sort(sort_query)
      .skip((page - 1) * limit)
      .limit(limit)
      .select(public_product_select_fields)
      .populate('brand', 'name slug')
      .populate('category', 'name slug')
      .populate('collections', 'name slug type')
      .lean(),
  ]);

  return ok({
    products: products.map(serialize_product),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}
