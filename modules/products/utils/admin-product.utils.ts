import type { CloudinaryAsset } from '@/modules/cloudinary/types';
import type {
  CreateProductInput,
  ProductData,
  UpdateProductInput,
} from '@/services/product.service';
import { MediaType } from '@/types/shared/product';

export function toCloudinaryAsset(value: string): CloudinaryAsset {
  return {
    api_key: '',
    asset_folder: '',
    asset_id: value,
    bytes: 0,
    created_at: new Date(0).toISOString(),
    display_name: 'Product Media',
    etag: '',
    format: '',
    height: 0,
    original_filename: 'product-media',
    placeholder: false,
    public_id: value,
    resource_type: 'image',
    secure_url: value,
    signature: '',
    tags: ['product-media'],
    type: 'upload',
    url: value,
    version: 1,
    version_id: '',
    width: 0,
  };
}

export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatPrice(value: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(value / 100);
}

export function parseCsvInput(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function trimToUndefined(value: string | null | undefined) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function trimToNull(value: string | null | undefined) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(values: string[] | undefined) {
  if (!values) return [];
  const nextValues = values.map((value) => value.trim()).filter(Boolean);
  return [...new Set(nextValues)];
}

export function productToFormValues(product: ProductData): CreateProductInput {
  return {
    name: product.name,
    slug: product.slug,
    brand: product.brand?.id ?? '',
    category: product.category?.id ?? '',
    collections: product.collections.map((collection) => collection.id),
    productType: product.productType as CreateProductInput['productType'],
    gender: product.gender as CreateProductInput['gender'],
    description: {
      narrative: product.description?.narrative ?? '',
      styleCode: product.description?.styleCode ?? null,
      colorway: product.description?.colorway ?? null,
      releaseDate: product.description?.releaseDate
        ? new Date(product.description.releaseDate)
        : null,
      materials: product.description?.materials ?? null,
      editorialHighlights: product.description?.editorialHighlights ?? [],
      additionalSections: product.description?.additionalSections ?? [],
    },
    features: product.features,
    media: product.media.map((item) => ({
      url: item.url,
      alt: item.alt,
      type: item.type === MediaType.VIDEO ? MediaType.VIDEO : MediaType.IMAGE,
      order: item.order,
    })),
    sizes: product.sizes.map((size) => ({
      size: size.size,
      sku: size.sku,
      barcode: size.barcode,
      stockQuantity: size.stockQuantity,
      reservedQuantity: size.reservedQuantity,
      reorderLevel: size.reorderLevel,
      active: size.active,
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
    active: product.active ?? true,
  };
}

export function toCreatePayload(values: CreateProductInput): CreateProductInput {
  return {
    name: values.name.trim(),
    slug: trimToUndefined(values.slug),
    brand: values.brand,
    category: values.category,
    collections: [...new Set(values.collections ?? [])],
    productType: values.productType,
    gender: values.gender,
    description: {
      narrative: values.description.narrative.trim(),
      styleCode: trimToNull(values.description.styleCode),
      colorway: trimToNull(values.description.colorway),
      releaseDate: values.description.releaseDate ?? null,
      materials: trimToNull(values.description.materials),
      editorialHighlights: normalizeStringArray(values.description.editorialHighlights),
      additionalSections: (values.description.additionalSections ?? [])
        .map((section) => ({
          title: section.title.trim(),
          content: section.content.trim(),
        }))
        .filter((section) => section.title.length > 0 && section.content.length > 0),
    },
    features: normalizeStringArray(values.features),
    media: (values.media ?? [])
      .map((item, index) => ({
        url: item.url.trim(),
        alt: item.alt.trim(),
        type: item.type ?? MediaType.IMAGE,
        order: index,
      }))
      .filter((item) => item.url.length > 0 && item.alt.length > 0),
    sizes: (values.sizes ?? [])
      .map((item) => ({
        size: item.size.trim(),
        sku: trimToNull(item.sku),
        barcode: trimToNull(item.barcode),
        stockQuantity: item.stockQuantity,
        reservedQuantity: item.reservedQuantity ?? 0,
        reorderLevel: item.reorderLevel ?? 0,
        active: item.active ?? true,
      }))
      .filter((item) => item.size.length > 0),
    pricing: {
      currency: (values.pricing.currency ?? 'NGN').trim().toUpperCase(),
      basePrice: values.pricing.basePrice,
      compareAtPrice: values.pricing.compareAtPrice ?? null,
      costPrice: values.pricing.costPrice ?? null,
    },
    seo: {
      title: trimToNull(values.seo?.title),
      description: trimToNull(values.seo?.description),
      keywords: normalizeStringArray(values.seo?.keywords),
    },
    tags: normalizeStringArray(values.tags),
    active: values.active ?? true,
  };
}

function hasAnyDirty(value: unknown): boolean {
  if (value === true) return true;
  if (!value || typeof value !== 'object') return false;

  if (Array.isArray(value)) {
    return value.some((item) => hasAnyDirty(item));
  }

  return Object.values(value).some((item) => hasAnyDirty(item));
}

function pickDirtyValues(source: unknown, dirty: unknown): unknown {
  if (!hasAnyDirty(dirty)) return undefined;
  if (dirty === true) return source;

  if (Array.isArray(source)) {
    return source;
  }

  if (!source || typeof source !== 'object' || !dirty || typeof dirty !== 'object') {
    return source;
  }

  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(dirty as Record<string, unknown>)) {
    const picked = pickDirtyValues((source as Record<string, unknown>)[key], value);
    if (picked !== undefined) {
      output[key] = picked;
    }
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

export function toUpdatePayload(
  normalizedValues: CreateProductInput,
  dirtyFields: unknown
): UpdateProductInput {
  const picked = pickDirtyValues(normalizedValues, dirtyFields);
  if (!picked || typeof picked !== 'object') {
    return {};
  }

  return picked as UpdateProductInput;
}
