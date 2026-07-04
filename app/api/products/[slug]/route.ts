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
    pricing: product.pricing,
    seo: product.seo,
    tags: product.tags,
    publishedAt: product.publishedAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/products/[slug]'>) {
  const { slug } = await ctx.params;

  await connect_to_database();

  const found_product = await Product.findOne({ slug, active: true })
    .select(public_product_select_fields)
    .populate('brand', 'name slug')
    .populate('category', 'name slug')
    .populate('collections', 'name slug type');

  if (!found_product) {
    return err('Product not found', 404);
  }

  return ok({ product: serialize_product(found_product) });
}
