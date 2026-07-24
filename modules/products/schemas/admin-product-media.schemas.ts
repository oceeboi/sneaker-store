import { z } from 'zod';

import { MediaType } from '@/types/shared/product';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid object id');

const trimmedRequiredString = z.string().trim().min(1);

export const adminProductMediaCreateSchema = z.object({
  url: z.string().trim().url('Media url must be a valid URL'),
  alt: trimmedRequiredString.max(200),
  type: z.enum([MediaType.IMAGE, MediaType.VIDEO]).optional(),
  order: z.coerce.number().int().min(0).optional(),
});

export const adminProductMediaUpdateSchema = z
  .object({
    mediaId: objectIdSchema,
    url: z.string().trim().url('Media url must be a valid URL').optional(),
    alt: trimmedRequiredString.max(200).optional(),
    type: z.enum([MediaType.IMAGE, MediaType.VIDEO]).optional(),
    order: z.coerce.number().int().min(0).optional(),
  })
  .refine((payload) => Object.keys(payload).some((key) => key !== 'mediaId'), {
    message: 'At least one field must be provided',
  });

export const adminProductMediaDeleteQuerySchema = z.object({
  mediaId: objectIdSchema,
});

export type AdminProductMediaCreateInput = z.infer<typeof adminProductMediaCreateSchema>;
export type AdminProductMediaUpdateInput = z.infer<typeof adminProductMediaUpdateSchema>;
