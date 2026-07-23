import { z } from 'zod';

export const adminProductInventoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const adminProductInventoryMutationSchema = z.object({
  operation: z.enum(['adjust_add', 'adjust_remove', 'reserve', 'release', 'fulfill']),
  size: z.string().trim().min(1, 'Size is required'),
  quantity: z.coerce.number().int().positive('Quantity must be a positive integer'),
  note: z.string().trim().nullable().optional(),
  referenceId: z.string().trim().nullable().optional(),
  referenceType: z.string().trim().nullable().optional(),
});

export type AdminProductInventoryMutationInput = z.infer<
  typeof adminProductInventoryMutationSchema
>;
