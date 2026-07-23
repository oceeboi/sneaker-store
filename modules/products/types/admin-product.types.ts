import type {
  CreateProductInput,
  ProductData,
  UpdateProductInput,
} from '@/services/product.service';
import type { CloudinaryAsset } from '@/modules/cloudinary/types';
import { adminProductFormSchema } from '../schemas/admin-product-form.schemas';
import { z } from 'zod';

export type ProductFormValues = z.input<typeof adminProductFormSchema>;

export type ProductOption = {
  value: string;
  label: string;
  description?: string;
};

export type ProductCrudPayload = {
  create: CreateProductInput;
  update: UpdateProductInput;
};

export type ProductFormProduct = ProductData;

export type ProductMediaAsset = CloudinaryAsset;
