import { z } from 'zod';

import { Gender, MediaType, ProductType } from '@/types/shared/product';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid object id');

const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1, 'Cannot be empty if provided').optional()
);

const nullableTrimmedString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().min(1, 'Value must contain at least 1 character.').nullable().optional()
);

const productMediaSchema = z.object({
  url: z.string().trim().url('Media url must be a valid URL'),
  alt: z.string().trim().min(1, 'Media alt text is required').max(200),
  type: z.enum([MediaType.IMAGE, MediaType.VIDEO]).optional(),
  order: z.coerce.number().int().min(0).optional(),
});

const productPricingSchema = z.object({
  currency: z.string().trim().length(3, 'Currency must be a 3-letter ISO code').optional(),
  basePrice: z.coerce.number().min(0, 'Base price must be zero or greater'),
  compareAtPrice: z.coerce.number().min(0).nullable().optional(),
  costPrice: z.coerce.number().min(0).nullable().optional(),
});

const productSeoSchema = z.object({
  title: z.string().trim().max(70).nullable().optional(),
  description: z.string().trim().max(160).nullable().optional(),
  keywords: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
});

const productAdditionalSectionSchema = z.object({
  title: z.string().trim().min(1).max(60),
  content: z.string().trim().min(1).max(2000),
});

const productDescriptionSchema = z.object({
  narrative: z.string().trim().min(1, 'Description narrative is required').max(2000),
  styleCode: z.string().trim().max(50).nullable().optional(),
  colorway: z.string().trim().max(150).nullable().optional(),
  releaseDate: z.coerce.date().nullable().optional(),
  materials: nullableTrimmedString,
  editorialHighlights: z.array(z.string().trim().min(1).max(200)).max(8).optional(),
  additionalSections: z.array(productAdditionalSectionSchema).max(5).optional(),
});

const collectionIdsSchema = z.array(objectIdSchema).max(50, 'Too many collections assigned');

export const adminProductCreateSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(200),
  slug: optionalTrimmedString,
  brand: objectIdSchema,
  category: objectIdSchema,
  collections: collectionIdsSchema.optional(),
  productType: z.enum([
    ProductType.SNEAKER,
    ProductType.APPAREL,
    ProductType.ACCESSORY,
    ProductType.EQUIPMENT,
  ]),
  gender: z.enum([Gender.MEN, Gender.WOMEN, Gender.UNISEX, Gender.KIDS]),
  description: productDescriptionSchema,
  features: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  media: z.array(productMediaSchema).max(20).optional(),
  pricing: productPricingSchema,
  seo: productSeoSchema.optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(50).optional(),
  active: z.boolean().optional(),
});

export const adminProductUpdateSchema = adminProductCreateSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, 'At least one field must be provided');

export type AdminProductCreateInput = z.infer<typeof adminProductCreateSchema>;
export type AdminProductUpdateInput = z.infer<typeof adminProductUpdateSchema>;
