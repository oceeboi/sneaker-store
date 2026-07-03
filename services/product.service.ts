import http from '@/lib/ky';
import { createProductSchema, updateProductSchema } from '@/schemas/catalog.schemas';
import { HTTPError } from 'ky';
import { z } from 'zod';

export type ProductReference = {
  id: string;
  name: string | null;
  slug: string | null;
};

export type ProductMedia = {
  url: string;
  alt: string;
  type: string;
  order: number;
};

export type ProductPricing = {
  currency: string;
  basePrice: number;
  compareAtPrice: number | null;
  costPrice?: number | null;
};

export type ProductSize = {
  size: string;
  sku: string | null;
  barcode: string | null;
  stockQuantity: number;
  active: boolean;
};

export type ProductSeo = {
  title: string | null;
  description: string | null;
  keywords: string[];
};

export type ProductData = {
  id: string;
  name: string;
  slug: string;
  brand: ProductReference | null;
  category: ProductReference | null;
  collections: ProductReference[];
  productType: string;
  gender: string;
  description: string | null;
  features: string[];
  media: ProductMedia[];
  sizes: ProductSize[];
  pricing: ProductPricing;
  seo: ProductSeo;
  tags: string[];
  active?: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PublicProductListParams = {
  search?: string;
  brand?: string;
  category?: string;
  collection?: string;
  productType?: string;
  gender?: string;
  sort?: 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc';
  page?: number;
  limit?: number;
};

export type AdminProductListParams = {
  search?: string;
  active?: boolean;
  brand?: string;
  category?: string;
  collection?: string;
  productType?: string;
  gender?: string;
};

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const ADMIN_PRODUCT_PAYLOAD_EXAMPLE: Record<string, unknown> = {
  name: "Nike Air Force 1 '07",
  brand: '<brandId>',
  category: '<categoryId>',
  collections: ['<collectionId>'],
  productType: 'sneaker',
  gender: 'unisex',
  description: 'Classic everyday sneaker',
  features: ['Leather upper', 'Rubber outsole'],
  media: [
    {
      url: 'https://example.com/images/air-force-1.jpg',
      alt: 'Nike Air Force 1 front view',
      type: 'image',
      order: 0,
    },
  ],
  sizes: [
    { size: '40', sku: 'AF1-40', barcode: null, stockQuantity: 12, active: true },
    { size: '41', sku: 'AF1-41', barcode: null, stockQuantity: 8, active: true },
  ],
  pricing: {
    currency: 'NGN',
    basePrice: 185000,
    compareAtPrice: 210000,
    costPrice: 120000,
  },
  seo: {
    title: "Nike Air Force 1 '07",
    description: "Shop the Nike Air Force 1 '07 sneaker.",
    keywords: ['nike', 'air force 1', 'sneaker'],
  },
  tags: ['lifestyle', 'low-top'],
  active: true,
};

type ServiceResult<T> = { success: true; data: T } | { success: false; message: string };

const REQUEST_TIMEOUT_MS = 30_000;

const DEFAULT_HTTP_ERROR_MESSAGES: Partial<Record<number, string>> = {
  400: 'Bad request. Please check your data.',
  401: 'Unauthorized. Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'This resource already exists or is still in use.',
  422: 'Invalid input. Please check your data and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'A server error occurred. Please try again later.',
  502: 'Service is temporarily unavailable. Please try again later.',
  503: 'Service is temporarily unavailable. Please try again later.',
  504: 'The request timed out. Please try again.',
};

export class ProductService {
  private static fromValidationError(error: z.ZodError): string {
    return error.issues.map((issue) => issue.message).join(', ');
  }

  private static fromHttpError(
    error: unknown,
    fallback = 'An unexpected error occurred. Please try again.',
    statusOverrides: Partial<Record<number, string>> = {}
  ): string {
    if (!(error instanceof HTTPError)) {
      return fallback;
    }

    const status = error.response?.status;
    return statusOverrides[status] ?? DEFAULT_HTTP_ERROR_MESSAGES[status] ?? fallback;
  }

  private static validate<T>(
    schema: z.ZodSchema<T>,
    data: unknown
  ): { success: true; data: T } | { success: false; message: string } {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      return { success: false, message: ProductService.fromValidationError(parsed.error) };
    }

    return { success: true, data: parsed.data };
  }

  private buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
    if (!params) return '';

    const search_params = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      search_params.set(key, String(value));
    }

    const serialized = search_params.toString();
    return serialized ? `?${serialized}` : '';
  }

  private async get<T>(path: string): Promise<T> {
    const response = await http.get(path, { timeout: REQUEST_TIMEOUT_MS });
    return response.json() as Promise<T>;
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await http.post(path, {
      timeout: REQUEST_TIMEOUT_MS,
      ...(body !== undefined && { json: body }),
    });
    return response.json() as Promise<T>;
  }

  private async patch<T>(path: string, body?: unknown): Promise<T> {
    const response = await http.patch(path, {
      timeout: REQUEST_TIMEOUT_MS,
      ...(body !== undefined && { json: body }),
    });
    return response.json() as Promise<T>;
  }

  private async put<T>(path: string, body?: unknown): Promise<T> {
    const response = await http.put(path, {
      timeout: REQUEST_TIMEOUT_MS,
      ...(body !== undefined && { json: body }),
    });
    return response.json() as Promise<T>;
  }

  private async delete<T>(path: string): Promise<T> {
    const response = await http.delete(path, { timeout: REQUEST_TIMEOUT_MS });
    return response.json() as Promise<T>;
  }

  async getProducts(params?: PublicProductListParams): Promise<
    ServiceResult<{
      products: ProductData[];
      pagination: ProductPagination;
    }>
  > {
    try {
      const query = this.buildQuery(params);
      const response = await this.get<{
        data: {
          products: ProductData[];
          pagination: ProductPagination;
        };
      }>(`products${query}`);

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to fetch products.'),
      };
    }
  }

  async getProductBySlug(slug: string): Promise<ServiceResult<ProductData>> {
    const normalized_slug = slug.trim();
    if (!normalized_slug) {
      return { success: false, message: 'Product slug is required.' };
    }

    try {
      const response = await this.get<{ data: { product: ProductData } }>(
        `products/${encodeURIComponent(normalized_slug)}`
      );

      return { success: true, data: response.data.product };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to fetch product details.', {
          404: 'Product not found.',
        }),
      };
    }
  }

  async getAdminProducts(params?: AdminProductListParams): Promise<
    ServiceResult<{
      products: ProductData[];
      total: number;
    }>
  > {
    try {
      const query = this.buildQuery(params);
      const response = await this.get<{
        data: {
          products: ProductData[];
          total: number;
        };
      }>(`admin/product${query}`);

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to fetch admin product list.'),
      };
    }
  }

  async getAdminProductById(productId: string): Promise<ServiceResult<ProductData>> {
    const normalized_product_id = productId.trim();
    if (!normalized_product_id) {
      return { success: false, message: 'Product id is required.' };
    }

    try {
      const response = await this.get<{ data: { product: ProductData } }>(
        `admin/product/${encodeURIComponent(normalized_product_id)}`
      );

      return { success: true, data: response.data.product };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to fetch admin product.', {
          404: 'Product not found.',
        }),
      };
    }
  }

  async createAdminProduct(data: CreateProductInput): Promise<ServiceResult<ProductData>> {
    const validation = ProductService.validate(createProductSchema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.post<{ data: { product: ProductData } }>(
        'admin/product',
        validation.data
      );

      return { success: true, data: response.data.product };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to create product.', {
          404: 'One or more related catalog records were not found.',
          409: 'A product with this slug already exists.',
        }),
      };
    }
  }

  async updateAdminProduct(
    productId: string,
    data: UpdateProductInput
  ): Promise<ServiceResult<ProductData>> {
    const normalized_product_id = productId.trim();
    if (!normalized_product_id) {
      return { success: false, message: 'Product id is required.' };
    }

    const validation = ProductService.validate(updateProductSchema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.patch<{ data: { product: ProductData } }>(
        `admin/product/${encodeURIComponent(normalized_product_id)}`,
        validation.data
      );

      return { success: true, data: response.data.product };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to update product.', {
          404: 'Product or related catalog record not found.',
          409: 'A product with this slug already exists.',
        }),
      };
    }
  }

  async replaceAdminProduct(
    productId: string,
    data: CreateProductInput
  ): Promise<ServiceResult<ProductData>> {
    const normalized_product_id = productId.trim();
    if (!normalized_product_id) {
      return { success: false, message: 'Product id is required.' };
    }

    const validation = ProductService.validate(createProductSchema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.put<{ data: { product: ProductData } }>(
        `admin/product/${encodeURIComponent(normalized_product_id)}`,
        validation.data
      );

      return { success: true, data: response.data.product };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to replace product.', {
          404: 'Product or related catalog record not found.',
          409: 'A product with this slug already exists.',
        }),
      };
    }
  }

  async deleteAdminProduct(productId: string): Promise<ServiceResult<{ deleted: boolean }>> {
    const normalized_product_id = productId.trim();
    if (!normalized_product_id) {
      return { success: false, message: 'Product id is required.' };
    }

    try {
      const response = await this.delete<{ data: { deleted: boolean } }>(
        `admin/product/${encodeURIComponent(normalized_product_id)}`
      );

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to delete product.', {
          404: 'Product not found.',
        }),
      };
    }
  }
}

export const productService = new ProductService();
