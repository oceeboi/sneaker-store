import { z } from 'zod';

import { adminProductCreateSchema } from './admin-product.schemas';

const adminProductFormSizeSchema = z
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
    const reservedQuantity = payload.reservedQuantity ?? 0;
    if (reservedQuantity > payload.stockQuantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reservedQuantity'],
        message: 'Reserved quantity cannot exceed stock quantity',
      });
    }
  });

export const adminProductFormSchema = adminProductCreateSchema
  .extend({
    sizes: z.array(adminProductFormSizeSchema).max(100).optional(),
  })
  .superRefine((payload, ctx) => {
    if (!payload.sizes || payload.sizes.length === 0) return;

    const normalizedSizes = payload.sizes.map((item) => item.size.trim().toLowerCase());
    if (new Set(normalizedSizes).size !== normalizedSizes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sizes'],
        message: 'Product sizes must be unique',
      });
    }
  });

export type AdminProductFormInput = z.infer<typeof adminProductFormSchema>;
