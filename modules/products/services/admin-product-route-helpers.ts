import 'server-only';

import Brand from '@/models/Brand';
import Category from '@/models/Category';
import Collection from '@/models/Collection';
import type { IDescription, MediaType } from '@/types/shared/product';
import type { ProductType, Gender } from '@/types/shared/product';
import { validationErr } from '@/lib/auth/response';

export const PRODUCT_SELECT_FIELDS =
  'name slug brand category collections productType gender description features media sizes pricing.currency pricing.basePrice pricing.compareAtPrice +pricing.costPrice seo tags active publishedAt createdAt updatedAt';

export function formatValidationIssues(issues: { path: PropertyKey[]; message: string }[]) {
  return validationErr(
    issues.map((issue) => ({
      path: issue.path.map((segment) =>
        typeof segment === 'symbol' ? segment.toString() : segment
      ) as (string | number)[],
      message: issue.message,
    }))
  );
}

export function uniqueStringArray(values: string[] | undefined) {
  if (!values) return [];

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function uniqueObjectIds(values: string[] | undefined) {
  if (!values) return [];
  return [...new Set(values)];
}

export function normalizeDescription(
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
    editorialHighlights: uniqueStringArray(description?.editorialHighlights),
    additionalSections: (description?.additionalSections ?? [])
      .map((section) => ({
        title: section.title.trim(),
        content: section.content.trim(),
      }))
      .filter((section) => section.title.length > 0 && section.content.length > 0),
  };
}

export function normalizeMedia(
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

  const sortableMedia = media.map((mediaItem, index) => ({
    mediaItem,
    originalIndex: index,
    requestedOrder:
      typeof mediaItem.order === 'number' && Number.isFinite(mediaItem.order)
        ? mediaItem.order
        : Number.MAX_SAFE_INTEGER,
  }));

  sortableMedia.sort((left, right) => {
    if (left.requestedOrder !== right.requestedOrder) {
      return left.requestedOrder - right.requestedOrder;
    }

    return left.originalIndex - right.originalIndex;
  });

  return sortableMedia.map(({ mediaItem }, index) => ({
    url: mediaItem.url,
    alt: mediaItem.alt,
    type: mediaItem.type ?? 'image',
    order: index,
  }));
}

export function normalizeSizes(
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

  for (const sizeOption of sizes) {
    const normalizedSizeKey = sizeOption.size.trim().toLowerCase();
    deduped.set(normalizedSizeKey, {
      size: sizeOption.size.trim(),
      sku: sizeOption.sku?.trim() || null,
      barcode: sizeOption.barcode?.trim() || null,
      stockQuantity: sizeOption.stockQuantity,
      reservedQuantity: sizeOption.reservedQuantity ?? 0,
      reorderLevel: sizeOption.reorderLevel ?? 0,
      active: sizeOption.active ?? true,
    });
  }

  return [...deduped.values()];
}

export function serializeReference(reference: unknown) {
  if (!reference) return null;
  if (typeof reference === 'object' && '_id' in reference) {
    const populatedReference = reference as {
      _id: { toString(): string };
      name?: string;
      slug?: string;
    };

    return {
      id: populatedReference._id.toString(),
      name: populatedReference.name ?? null,
      slug: populatedReference.slug ?? null,
    };
  }

  return { id: String(reference), name: null, slug: null };
}

export function serializeProduct(product: {
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
    brand: serializeReference(product.brand),
    category: serializeReference(product.category),
    collections: product.collections.map(serializeReference),
    productType: product.productType,
    gender: product.gender,
    description: product.description,
    features: product.features,
    media: product.media,
    sizes: product.sizes.map((sizeOption) => ({
      ...sizeOption,
      availableQuantity: Math.max(0, sizeOption.stockQuantity - sizeOption.reservedQuantity),
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

export async function validateProductRelations(input: {
  brandId: string;
  categoryId: string;
  collectionIds: string[];
}) {
  const [brandExists, categoryExists, collections] = await Promise.all([
    Brand.findById(input.brandId).select('_id').lean(),
    Category.findById(input.categoryId).select('_id').lean(),
    input.collectionIds.length > 0
      ? Collection.find({ _id: { $in: input.collectionIds } })
          .select('_id')
          .lean()
      : Promise.resolve([]),
  ]);

  if (!brandExists) {
    return { error: 'Brand not found', status: 404 as const };
  }

  if (!categoryExists) {
    return { error: 'Category not found', status: 404 as const };
  }

  if (collections.length !== input.collectionIds.length) {
    return { error: 'One or more collections were not found', status: 404 as const };
  }

  return null;
}
