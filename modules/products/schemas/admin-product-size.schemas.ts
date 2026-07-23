import { z } from 'zod';

const trimmedNullable = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().max(120).nullable().optional()
);

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid object id');

export const adminProductSizeCreateSchema = z.object({
  size: z.string().trim().min(1).max(20),
  sku: trimmedNullable,
  barcode: trimmedNullable,
  stockQuantity: z.coerce.number().int().min(0),
  reorderLevel: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const adminProductSizeUpdateSchema = z
  .object({
    sizeId: objectIdSchema,
    size: z.string().trim().min(1).max(20).optional(),
    sku: trimmedNullable,
    barcode: trimmedNullable,
    stockQuantity: z.coerce.number().int().min(0).optional(),
    reorderLevel: z.coerce.number().int().min(0).optional(),
    active: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).some((key) => key !== 'sizeId'), {
    message: 'At least one field must be provided',
  });

export const adminProductSizeDeleteQuerySchema = z.object({
  sizeId: objectIdSchema,
});

export type AdminProductSizeCreateInput = z.infer<typeof adminProductSizeCreateSchema>;
export type AdminProductSizeUpdateInput = z.infer<typeof adminProductSizeUpdateSchema>;
