import http from '@/lib/ky';
import type {
  AdminInventoryListParams,
  AdminInventoryOperationInput,
  AdminInventoryOperationResult,
  AdminProductListParams,
  InventoryMovementData,
  ProductData,
  ProductInventoryData,
} from '@/services/product.service';
import { HTTPError } from 'ky';

import {
  adminProductCreateSchema,
  adminProductUpdateSchema,
  type AdminProductCreateInput,
  type AdminProductUpdateInput,
} from '../schemas/admin-product.schemas';
import {
  adminProductInventoryMutationSchema,
  adminProductInventoryQuerySchema,
} from '../schemas/admin-product-inventory.schemas';
import {
  adminProductSizeCreateSchema,
  adminProductSizeUpdateSchema,
  type AdminProductSizeCreateInput,
  type AdminProductSizeUpdateInput,
} from '../schemas/admin-product-size.schemas';
import {
  adminProductMediaCreateSchema,
  adminProductMediaUpdateSchema,
  type AdminProductMediaCreateInput,
  type AdminProductMediaUpdateInput,
} from '../schemas/admin-product-media.schemas';

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
};

export type AdminProductSizeData = {
  id: string;
  size: string;
  sku: string | null;
  barcode: string | null;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
  active: boolean;
};

export type AdminProductMediaData = {
  id: string;
  url: string;
  alt: string;
  type: 'image' | 'video';
  order: number;
};

export class AdminProductService {
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

  private buildQuery(
    params?: Record<string, string | number | boolean | null | undefined>
  ): string {
    if (!params) return '';

    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      searchParams.set(key, String(value));
    }

    const serialized = searchParams.toString();
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

  async getAdminProducts(
    params?: AdminProductListParams
  ): Promise<ServiceResult<{ products: ProductData[]; total: number }>> {
    try {
      const query = this.buildQuery(params);
      const response = await this.get<{ data: { products: ProductData[]; total: number } }>(
        `admin/product${query}`
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: AdminProductService.fromHttpError(error, 'Failed to fetch admin product list.'),
      };
    }
  }

  async getAdminProductById(productId: string): Promise<ServiceResult<ProductData>> {
    const normalizedProductId = productId.trim();
    if (!normalizedProductId) return { success: false, message: 'Product id is required.' };

    try {
      const response = await this.get<{ data: { product: ProductData } }>(
        `admin/product/${encodeURIComponent(normalizedProductId)}`
      );
      return { success: true, data: response.data.product };
    } catch (error) {
      return {
        success: false,
        message: AdminProductService.fromHttpError(error, 'Failed to fetch admin product.', {
          404: 'Product not found.',
        }),
      };
    }
  }

  async createAdminProduct(data: AdminProductCreateInput): Promise<ServiceResult<ProductData>> {
    const validation = adminProductCreateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, message: validation.error.issues.map((i) => i.message).join(', ') };
    }

    try {
      const response = await this.post<{ data: { product: ProductData } }>(
        'admin/product',
        validation.data
      );
      return { success: true, data: response.data.product };
    } catch (error) {
      return {
        success: false,
        message: AdminProductService.fromHttpError(error, 'Failed to create product.'),
      };
    }
  }

  async updateAdminProduct(
    productId: string,
    data: AdminProductUpdateInput
  ): Promise<ServiceResult<ProductData>> {
    const normalizedProductId = productId.trim();
    if (!normalizedProductId) return { success: false, message: 'Product id is required.' };

    const validation = adminProductUpdateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, message: validation.error.issues.map((i) => i.message).join(', ') };
    }

    try {
      const response = await this.patch<{ data: { product: ProductData } }>(
        `admin/product/${encodeURIComponent(normalizedProductId)}`,
        validation.data
      );
      return { success: true, data: response.data.product };
    } catch (error) {
      return {
        success: false,
        message: AdminProductService.fromHttpError(error, 'Failed to update product.'),
      };
    }
  }

  async replaceAdminProduct(
    productId: string,
    data: AdminProductCreateInput
  ): Promise<ServiceResult<ProductData>> {
    const normalizedProductId = productId.trim();
    if (!normalizedProductId) return { success: false, message: 'Product id is required.' };

    const validation = adminProductCreateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, message: validation.error.issues.map((i) => i.message).join(', ') };
    }

    try {
      const response = await this.put<{ data: { product: ProductData } }>(
        `admin/product/${encodeURIComponent(normalizedProductId)}`,
        validation.data
      );
      return { success: true, data: response.data.product };
    } catch (error) {
      return {
        success: false,
        message: AdminProductService.fromHttpError(error, 'Failed to replace product.'),
      };
    }
  }

  async deleteAdminProduct(productId: string): Promise<ServiceResult<{ deleted: boolean }>> {
    const normalizedProductId = productId.trim();
    if (!normalizedProductId) return { success: false, message: 'Product id is required.' };

    try {
      const response = await this.delete<{ data: { deleted: boolean } }>(
        `admin/product/${encodeURIComponent(normalizedProductId)}`
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: AdminProductService.fromHttpError(error, 'Failed to delete product.'),
      };
    }
  }

  async getAdminProductSizes(
    productId: string
  ): Promise<ServiceResult<{ sizes: AdminProductSizeData[] }>> {
    const normalizedProductId = productId.trim();
    if (!normalizedProductId) return { success: false, message: 'Product id is required.' };

    try {
      const response = await this.get<{ data: { sizes: AdminProductSizeData[] } }>(
        `admin/product/${encodeURIComponent(normalizedProductId)}/size`
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: AdminProductService.fromHttpError(error, 'Failed to fetch product sizes.'),
      };
    }
  }

  async getAdminProductMedia(
    productId: string
  ): Promise<ServiceResult<{ media: AdminProductMediaData[] }>> {
    const normalizedProductId = productId.trim();
    if (!normalizedProductId) return { success: false, message: 'Product id is required.' };

    try {
      const response = await this.get<{ data: { media: AdminProductMediaData[] } }>(
        `admin/product/${encodeURIComponent(normalizedProductId)}/media`
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: AdminProductService.fromHttpError(error, 'Failed to fetch product media.'),
      };
    }
  }

  async createAdminProductMedia(
    productId: string,
    data: AdminProductMediaCreateInput
  ): Promise<ServiceResult<{ media: AdminProductMediaData }>> {
    const normalizedProductId = productId.trim();
    if (!normalizedProductId) return { success: false, message: 'Product id is required.' };

    const validation = adminProductMediaCreateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, message: validation.error.issues.map((i) => i.message).join(', ') };
    }

    try {
      const response = await this.post<{ data: { media: AdminProductMediaData } }>(
        `admin/product/${encodeURIComponent(normalizedProductId)}/media`,
        validation.data
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: AdminProductService.fromHttpError(error, 'Failed to create product media.'),
      };
    }
  }

  async updateAdminProductMedia(
    productId: string,
    data: AdminProductMediaUpdateInput
  ): Promise<ServiceResult<{ media: AdminProductMediaData }>> {
    const normalizedProductId = productId.trim();
    if (!normalizedProductId) return { success: false, message: 'Product id is required.' };

    const validation = adminProductMediaUpdateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, message: validation.error.issues.map((i) => i.message).join(', ') };
    }

    try {
      const response = await this.patch<{ data: { media: AdminProductMediaData } }>(
        `admin/product/${encodeURIComponent(normalizedProductId)}/media`,
        validation.data
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: AdminProductService.fromHttpError(error, 'Failed to update product media.'),
      };
    }
  }

  async deleteAdminProductMedia(
    productId: string,
    mediaId: string
  ): Promise<ServiceResult<{ deleted: boolean; mediaId: string }>> {
    const normalizedProductId = productId.trim();
    if (!normalizedProductId) return { success: false, message: 'Product id is required.' };

    if (!mediaId.trim()) return { success: false, message: 'Media id is required.' };

    try {
      const query = this.buildQuery({ mediaId });
      const response = await this.delete<{ data: { deleted: boolean; mediaId: string } }>(
        `admin/product/${encodeURIComponent(normalizedProductId)}/media${query}`
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: AdminProductService.fromHttpError(error, 'Failed to delete product media.'),
      };
    }
  }

  async createAdminProductSize(
    productId: string,
    data: AdminProductSizeCreateInput
  ): Promise<ServiceResult<{ size: AdminProductSizeData }>> {
    const normalizedProductId = productId.trim();
    if (!normalizedProductId) return { success: false, message: 'Product id is required.' };

    const validation = adminProductSizeCreateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, message: validation.error.issues.map((i) => i.message).join(', ') };
    }

    try {
      const response = await this.post<{ data: { size: AdminProductSizeData } }>(
        `admin/product/${encodeURIComponent(normalizedProductId)}/size`,
        validation.data
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: AdminProductService.fromHttpError(error, 'Failed to create product size.'),
      };
    }
  }

  async updateAdminProductSize(
    productId: string,
    data: AdminProductSizeUpdateInput
  ): Promise<ServiceResult<{ size: AdminProductSizeData }>> {
    const normalizedProductId = productId.trim();
    if (!normalizedProductId) return { success: false, message: 'Product id is required.' };

    const validation = adminProductSizeUpdateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, message: validation.error.issues.map((i) => i.message).join(', ') };
    }

    try {
      const response = await this.patch<{ data: { size: AdminProductSizeData } }>(
        `admin/product/${encodeURIComponent(normalizedProductId)}/size`,
        validation.data
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: AdminProductService.fromHttpError(error, 'Failed to update product size.'),
      };
    }
  }

  async deleteAdminProductSize(
    productId: string,
    sizeId: string
  ): Promise<ServiceResult<{ deleted: boolean; sizeId: string }>> {
    const normalizedProductId = productId.trim();
    if (!normalizedProductId) return { success: false, message: 'Product id is required.' };

    if (!sizeId.trim()) return { success: false, message: 'Size id is required.' };

    try {
      const query = this.buildQuery({ sizeId });
      const response = await this.delete<{ data: { deleted: boolean; sizeId: string } }>(
        `admin/product/${encodeURIComponent(normalizedProductId)}/size${query}`
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: AdminProductService.fromHttpError(error, 'Failed to delete product size.'),
      };
    }
  }

  async getAdminProductInventory(
    productId: string,
    params?: AdminInventoryListParams
  ): Promise<ServiceResult<{ product: ProductInventoryData; movements: InventoryMovementData[] }>> {
    const normalizedProductId = productId.trim();
    if (!normalizedProductId) return { success: false, message: 'Product id is required.' };

    const queryValidation = adminProductInventoryQuerySchema.safeParse(params ?? {});
    if (!queryValidation.success) {
      return {
        success: false,
        message: queryValidation.error.issues.map((issue) => issue.message).join(', '),
      };
    }

    try {
      const query = this.buildQuery(queryValidation.data);
      const response = await this.get<{
        data: { product: ProductInventoryData; movements: InventoryMovementData[] };
      }>(`admin/product/${encodeURIComponent(normalizedProductId)}/inventory${query}`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: AdminProductService.fromHttpError(error, 'Failed to fetch product inventory.'),
      };
    }
  }

  async mutateAdminProductInventory(
    productId: string,
    data: AdminInventoryOperationInput
  ): Promise<ServiceResult<AdminInventoryOperationResult>> {
    const normalizedProductId = productId.trim();
    if (!normalizedProductId) return { success: false, message: 'Product id is required.' };

    const validation = adminProductInventoryMutationSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, message: validation.error.issues.map((i) => i.message).join(', ') };
    }

    try {
      const response = await this.post<{ data: AdminInventoryOperationResult }>(
        `admin/product/${encodeURIComponent(normalizedProductId)}/inventory`,
        validation.data
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: AdminProductService.fromHttpError(error, 'Failed to update product inventory.'),
      };
    }
  }
}

export const adminProductService = new AdminProductService();
