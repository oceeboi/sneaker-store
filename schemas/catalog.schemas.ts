import { z } from 'zod';

import { CollectionType, Gender, MediaType, ProductType } from '@/types/shared/product';

const object_id_schema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid object id');

const optional_trimmed_string = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
  z.string().trim().min(1, 'Cannot be empty if provided').optional()
);

// Helper: Transforms "" into null, or validates min(1) if provided
const nullable_trimmed_string = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
  z.string().trim().min(1, 'Value must contain at least 1 character.').nullable().optional()
);

// Helper: Transforms "" into undefined, or validates URL if provided
const optional_url_string = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
  z.string().trim().url('Must be a valid URL').nullable().optional()
);

const collection_rule_schema = z.object({
  field: z.enum(['tags', 'brand', 'category', 'gender', 'productType']),
  operator: z.enum(['equals', 'contains', 'greater_than', 'less_than']),
  value: z.string().trim().min(1, 'Rule value is required'),
});

const product_media_schema = z.object({
  url: z.string().trim().url('Media url must be a valid URL'),
  alt: z.string().trim().min(1, 'Media alt text is required').max(200),
  type: z.enum([MediaType.IMAGE, MediaType.VIDEO]).optional(),
  order: z.coerce.number().int().min(0).optional(),
});

const product_pricing_schema = z.object({
  currency: z.string().trim().length(3, 'Currency must be a 3-letter ISO code').optional(),
  basePrice: z.coerce.number().min(0, 'Base price must be zero or greater'),
  compareAtPrice: z.coerce.number().min(0).nullable().optional(),
  costPrice: z.coerce.number().min(0).nullable().optional(),
});

const product_size_schema = z
  .object({
    size: z.string().trim().min(1, 'Size is required').max(20),
    sku: z.string().trim().max(120).nullable().optional(),
    barcode: z.string().trim().max(120).nullable().optional(),
    stockQuantity: z.coerce.number().int().min(0, 'Stock quantity must be zero or greater'),
    reservedQuantity: z.coerce.number().int().min(0).optional(),
    reorderLevel: z.coerce.number().int().min(0).optional(),
    active: z.boolean().optional(),
  })
  .superRefine((payload, ctx) => {
    const reserved_quantity = payload.reservedQuantity ?? 0;
    if (reserved_quantity > payload.stockQuantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reservedQuantity'],
        message: 'Reserved quantity cannot exceed stock quantity',
      });
    }
  });

const product_seo_schema = z.object({
  title: z.string().trim().max(70).nullable().optional(),
  description: z.string().trim().max(160).nullable().optional(),
  keywords: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
});

const product_additional_section_schema = z.object({
  title: z.string().trim().min(1).max(60),
  content: z.string().trim().min(1).max(2000),
});

const product_description_schema = z.object({
  narrative: z.string().trim().min(1, 'Description narrative is required').max(2000),
  styleCode: z.string().trim().max(50).nullable().optional(),
  colorway: z.string().trim().max(150).nullable().optional(),
  releaseDate: z.coerce.date().nullable().optional(),
  materials: z.string().trim().max(500).nullable().optional(),
  editorialHighlights: z.array(z.string().trim().min(1).max(200)).max(8).optional(),
  additionalSections: z.array(product_additional_section_schema).max(5).optional(),
});

const collection_ids_schema = z.array(object_id_schema).max(50, 'Too many collections assigned');

export const createBrandSchema = z.object({
  name: z.string().trim().min(1, 'Brand name is required').max(100),
  slug: optional_trimmed_string,
  logo: optional_url_string,
  description: nullable_trimmed_string,
  website: optional_url_string,
  active: z.boolean().optional(),
});

export const updateBrandSchema = createBrandSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, 'At least one field must be provided');

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100),
  slug: optional_trimmed_string,
  parent: object_id_schema.nullable().optional(),
  image: optional_url_string,
  description: nullable_trimmed_string,
  sortOrder: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, 'At least one field must be provided');

const collection_base_schema = z.object({
  name: z.string().trim().min(1, 'Collection name is required').max(100),
  slug: optional_trimmed_string,
  description: nullable_trimmed_string,
  bannerImage: optional_url_string,
  active: z.boolean().optional(),
  type: z.enum([CollectionType.MANUAL, CollectionType.SMART]).optional(),
  rules: z.array(collection_rule_schema).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const createCollectionSchema = collection_base_schema.superRefine((payload, ctx) => {
  if (payload.type === CollectionType.SMART && (!payload.rules || payload.rules.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rules'],
      message: 'Smart collections require at least one rule',
    });
  }
});

export const updateCollectionSchema = collection_base_schema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, 'At least one field must be provided')
  .superRefine((payload, ctx) => {
    if (payload.type === CollectionType.SMART && payload.rules && payload.rules.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rules'],
        message: 'Smart collections require at least one rule',
      });
    }
  });

const product_base_schema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(200),
  slug: optional_trimmed_string,
  brand: object_id_schema,
  category: object_id_schema,
  collections: collection_ids_schema.optional(),
  productType: z.enum([
    ProductType.SNEAKER,
    ProductType.APPAREL,
    ProductType.ACCESSORY,
    ProductType.EQUIPMENT,
  ]),
  gender: z.enum([Gender.MEN, Gender.WOMEN, Gender.UNISEX, Gender.KIDS]),
  description: product_description_schema,
  features: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  media: z.array(product_media_schema).max(20).optional(),
  sizes: z.array(product_size_schema).max(100).optional(),
  pricing: product_pricing_schema,
  seo: product_seo_schema.optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(50).optional(),
  active: z.boolean().optional(),
});

export const createProductSchema = product_base_schema.superRefine((payload, ctx) => {
  if (!payload.sizes || payload.sizes.length === 0) return;

  const normalized_sizes = payload.sizes.map((item) => item.size.trim().toLowerCase());
  if (new Set(normalized_sizes).size !== normalized_sizes.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sizes'],
      message: 'Product sizes must be unique',
    });
  }
});

export const updateProductSchema = product_base_schema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, 'At least one field must be provided')
  .superRefine((payload, ctx) => {
    if (!payload.sizes || payload.sizes.length === 0) return;

    const normalized_sizes = payload.sizes.map((item) => item.size.trim().toLowerCase());
    if (new Set(normalized_sizes).size !== normalized_sizes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sizes'],
        message: 'Product sizes must be unique',
      });
    }
  });

export const dataschema = z.toJSONSchema(createBrandSchema);
