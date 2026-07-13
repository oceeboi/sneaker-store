import http from '@/lib/ky';
import { CollectionType } from '@/types/shared/product';
import { HTTPError } from 'ky';

export type BrandData = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  website: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryData = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  image: string | null;
  description: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CollectionRuleData = {
  field: string;
  operator: string;
  value: string;
};

export type CollectionData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bannerImage: string | null;
  active: boolean;
  type: CollectionType;
  rules: CollectionRuleData[];
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CatalogPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type GetBrandsParams = {
  search?: string;
  page?: number;
  limit?: number;
};

export type GetCategoriesParams = {
  search?: string;
  parent?: string | null;
  page?: number;
  limit?: number;
};

export type GetCollectionsParams = {
  search?: string;
  type?: CollectionType;
  page?: number;
  limit?: number;
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

export class CatalogService {
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

    const search_params = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === '') continue;
      if (value === null) {
        search_params.set(key, 'null');
        continue;
      }
      search_params.set(key, String(value));
    }

    const serialized = search_params.toString();
    return serialized ? `?${serialized}` : '';
  }

  private async get<T>(path: string): Promise<T> {
    const response = await http.get(path, { timeout: REQUEST_TIMEOUT_MS });
    return response.json() as Promise<T>;
  }

  async getBrands(
    params?: GetBrandsParams
  ): Promise<ServiceResult<{ brands: BrandData[]; pagination: CatalogPagination }>> {
    try {
      const query = this.buildQuery(params);
      const response = await this.get<{
        data: {
          brands: BrandData[];
          pagination: CatalogPagination;
        };
      }>(`brands${query}`);

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: CatalogService.fromHttpError(error, 'Failed to fetch brands.'),
      };
    }
  }

  async getBrandBySlug(slug: string): Promise<ServiceResult<BrandData>> {
    const normalized_slug = slug.trim();
    if (!normalized_slug) {
      return { success: false, message: 'Brand slug is required.' };
    }

    try {
      const response = await this.get<{ data: { brand: BrandData } }>(
        `brands/${encodeURIComponent(normalized_slug)}`
      );

      return { success: true, data: response.data.brand };
    } catch (error) {
      return {
        success: false,
        message: CatalogService.fromHttpError(error, 'Failed to fetch brand.', {
          404: 'Brand not found.',
        }),
      };
    }
  }

  async getCategories(
    params?: GetCategoriesParams
  ): Promise<ServiceResult<{ categories: CategoryData[]; pagination: CatalogPagination }>> {
    try {
      const query = this.buildQuery(params);
      const response = await this.get<{
        data: {
          categories: CategoryData[];
          pagination: CatalogPagination;
        };
      }>(`categories${query}`);

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: CatalogService.fromHttpError(error, 'Failed to fetch categories.'),
      };
    }
  }

  async getCategoryBySlug(slug: string): Promise<ServiceResult<CategoryData>> {
    const normalized_slug = slug.trim();
    if (!normalized_slug) {
      return { success: false, message: 'Category slug is required.' };
    }

    try {
      const response = await this.get<{ data: { category: CategoryData } }>(
        `categories/${encodeURIComponent(normalized_slug)}`
      );

      return { success: true, data: response.data.category };
    } catch (error) {
      return {
        success: false,
        message: CatalogService.fromHttpError(error, 'Failed to fetch category.', {
          404: 'Category not found.',
        }),
      };
    }
  }

  async getCollections(
    params?: GetCollectionsParams
  ): Promise<ServiceResult<{ collections: CollectionData[]; pagination: CatalogPagination }>> {
    try {
      const query = this.buildQuery(params);
      const response = await this.get<{
        data: {
          collections: CollectionData[];
          pagination: CatalogPagination;
        };
      }>(`collections${query}`);

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: CatalogService.fromHttpError(error, 'Failed to fetch collections.'),
      };
    }
  }

  async getCollectionBySlug(slug: string): Promise<ServiceResult<CollectionData>> {
    const normalized_slug = slug.trim();
    if (!normalized_slug) {
      return { success: false, message: 'Collection slug is required.' };
    }

    try {
      const response = await this.get<{ data: { collection: CollectionData } }>(
        `collections/${encodeURIComponent(normalized_slug)}`
      );

      return { success: true, data: response.data.collection };
    } catch (error) {
      return {
        success: false,
        message: CatalogService.fromHttpError(error, 'Failed to fetch collection.', {
          404: 'Collection not found.',
        }),
      };
    }
  }
}

export const catalogService = new CatalogService();
