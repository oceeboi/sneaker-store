import { z } from 'zod';

export const cloudinaryResourceTypeSchema = z.enum(['image', 'video', 'raw']);

export const cloudinaryUploadPresetSchema = z.enum([
  'product-media',
  'profile-avatar',
  'brand-logo',
]);

export const cloudinarySignRequestSchema = z.object({
  preset: cloudinaryUploadPresetSchema.default('product-media'),
  resourceType: cloudinaryResourceTypeSchema.optional(),
});

export const cloudinaryDeleteRequestSchema = z.object({
  publicId: z.string().trim().min(1, 'publicId is required'),
  preset: cloudinaryUploadPresetSchema,
  resourceType: cloudinaryResourceTypeSchema.optional(),
});
