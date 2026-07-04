import http from '@/lib/ky';
import {
  createBrandSchema,
  createCategorySchema,
  createCollectionSchema,
  createProductSchema,
  updateBrandSchema,
  updateCategorySchema,
  updateCollectionSchema,
  updateProductSchema,
} from '@/schemas/catalog.schemas';
import { CollectionType, InventoryMovementReason } from '@/types/shared/product';
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
  reservedQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
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
  field: 'tags' | 'brand' | 'category' | 'gender' | 'productType';
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: string;
};

export type CollectionData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bannerImage: string | null;
  active: boolean;
  type: string;
  rules: CollectionRuleData[];
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type InventoryMovementData = {
  id: string;
  size: string;
  reason: string;
  quantityDelta: number;
  stockBefore: number;
  stockAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  actorId: string | null;
  createdAt: Date;
};

export type ProductInventorySnapshot = {
  size: string;
  sku: string | null;
  barcode: string | null;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
  active: boolean;
  isLowStock: boolean;
};

export type ProductInventoryData = {
  id: string;
  name: string;
  slug: string;
  sizes: ProductInventorySnapshot[];
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

export type AdminBrandListParams = {
  search?: string;
  active?: boolean;
};

export type AdminCategoryListParams = {
  search?: string;
  active?: boolean;
  parent?: string | null;
};

export type AdminCollectionListParams = {
  search?: string;
  active?: boolean;
  type?: string;
};

export type AdminInventoryListParams = {
  limit?: number;
};

export type AdminInventoryOperationInput = {
  operation: 'adjust_add' | 'adjust_remove' | 'reserve' | 'release' | 'fulfill';
  size: string;
  quantity: number;
  note?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
};

export type AdminInventoryOperationResult = {
  operation: string;
  productId: string;
  productName: string;
  size: string;
};

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;

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

  private buildQuery(
    params?: Record<string, string | number | boolean | null | undefined>
  ): string {
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

  async getAdminBrands(params?: AdminBrandListParams): Promise<
    ServiceResult<{
      brands: BrandData[];
      total: number;
    }>
  > {
    try {
      const query = this.buildQuery(params);
      const response = await this.get<{
        data: {
          brands: BrandData[];
          total: number;
        };
      }>(`admin/brand${query}`);

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to fetch admin brand list.'),
      };
    }
  }

  async getAdminBrandById(brandId: string): Promise<ServiceResult<BrandData>> {
    const normalized_brand_id = brandId.trim();
    if (!normalized_brand_id) {
      return { success: false, message: 'Brand id is required.' };
    }

    try {
      const response = await this.get<{ data: { brand: BrandData } }>(
        `admin/brand/${encodeURIComponent(normalized_brand_id)}`
      );

      return { success: true, data: response.data.brand };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to fetch admin brand.', {
          404: 'Brand not found.',
        }),
      };
    }
  }

  async createAdminBrand(data: CreateBrandInput): Promise<ServiceResult<BrandData>> {
    const validation = ProductService.validate(createBrandSchema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.post<{ data: { brand: BrandData } }>(
        'admin/brand',
        validation.data
      );

      return { success: true, data: response.data.brand };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to create brand.', {
          409: 'A brand with this slug already exists.',
        }),
      };
    }
  }

  async updateAdminBrand(
    brandId: string,
    data: UpdateBrandInput
  ): Promise<ServiceResult<BrandData>> {
    const normalized_brand_id = brandId.trim();
    if (!normalized_brand_id) {
      return { success: false, message: 'Brand id is required.' };
    }

    const validation = ProductService.validate(updateBrandSchema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.patch<{ data: { brand: BrandData } }>(
        `admin/brand/${encodeURIComponent(normalized_brand_id)}`,
        validation.data
      );

      return { success: true, data: response.data.brand };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to update brand.', {
          404: 'Brand not found.',
          409: 'A brand with this slug already exists.',
        }),
      };
    }
  }

  async replaceAdminBrand(
    brandId: string,
    data: CreateBrandInput
  ): Promise<ServiceResult<BrandData>> {
    const normalized_brand_id = brandId.trim();
    if (!normalized_brand_id) {
      return { success: false, message: 'Brand id is required.' };
    }

    const validation = ProductService.validate(createBrandSchema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.put<{ data: { brand: BrandData } }>(
        `admin/brand/${encodeURIComponent(normalized_brand_id)}`,
        validation.data
      );

      return { success: true, data: response.data.brand };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to replace brand.', {
          404: 'Brand not found.',
          409: 'A brand with this slug already exists.',
        }),
      };
    }
  }

  async deleteAdminBrand(brandId: string): Promise<ServiceResult<{ deleted: boolean }>> {
    const normalized_brand_id = brandId.trim();
    if (!normalized_brand_id) {
      return { success: false, message: 'Brand id is required.' };
    }

    try {
      const response = await this.delete<{ data: { deleted: boolean } }>(
        `admin/brand/${encodeURIComponent(normalized_brand_id)}`
      );

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to delete brand.', {
          404: 'Brand not found.',
          409: 'This brand is still referenced by products.',
        }),
      };
    }
  }

  async getAdminCategories(params?: AdminCategoryListParams): Promise<
    ServiceResult<{
      categories: CategoryData[];
      total: number;
    }>
  > {
    try {
      const query = this.buildQuery(params);
      const response = await this.get<{
        data: {
          categories: CategoryData[];
          total: number;
        };
      }>(`admin/category${query}`);

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to fetch admin category list.'),
      };
    }
  }

  async getAdminCategoryById(categoryId: string): Promise<ServiceResult<CategoryData>> {
    const normalized_category_id = categoryId.trim();
    if (!normalized_category_id) {
      return { success: false, message: 'Category id is required.' };
    }

    try {
      const response = await this.get<{ data: { category: CategoryData } }>(
        `admin/category/${encodeURIComponent(normalized_category_id)}`
      );

      return { success: true, data: response.data.category };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to fetch admin category.', {
          404: 'Category not found.',
        }),
      };
    }
  }

  async createAdminCategory(data: CreateCategoryInput): Promise<ServiceResult<CategoryData>> {
    const validation = ProductService.validate(createCategorySchema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.post<{ data: { category: CategoryData } }>(
        'admin/category',
        validation.data
      );

      return { success: true, data: response.data.category };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to create category.', {
          404: 'Parent category not found.',
          409: 'A category with this slug already exists.',
        }),
      };
    }
  }

  async updateAdminCategory(
    categoryId: string,
    data: UpdateCategoryInput
  ): Promise<ServiceResult<CategoryData>> {
    const normalized_category_id = categoryId.trim();
    if (!normalized_category_id) {
      return { success: false, message: 'Category id is required.' };
    }

    const validation = ProductService.validate(updateCategorySchema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.patch<{ data: { category: CategoryData } }>(
        `admin/category/${encodeURIComponent(normalized_category_id)}`,
        validation.data
      );

      return { success: true, data: response.data.category };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to update category.', {
          404: 'Category or parent category not found.',
          409: 'A category with this slug already exists.',
        }),
      };
    }
  }

  async replaceAdminCategory(
    categoryId: string,
    data: CreateCategoryInput
  ): Promise<ServiceResult<CategoryData>> {
    const normalized_category_id = categoryId.trim();
    if (!normalized_category_id) {
      return { success: false, message: 'Category id is required.' };
    }

    const validation = ProductService.validate(createCategorySchema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.put<{ data: { category: CategoryData } }>(
        `admin/category/${encodeURIComponent(normalized_category_id)}`,
        validation.data
      );

      return { success: true, data: response.data.category };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to replace category.', {
          404: 'Category or parent category not found.',
          409: 'A category with this slug already exists.',
        }),
      };
    }
  }

  async deleteAdminCategory(categoryId: string): Promise<ServiceResult<{ deleted: boolean }>> {
    const normalized_category_id = categoryId.trim();
    if (!normalized_category_id) {
      return { success: false, message: 'Category id is required.' };
    }

    try {
      const response = await this.delete<{ data: { deleted: boolean } }>(
        `admin/category/${encodeURIComponent(normalized_category_id)}`
      );

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to delete category.', {
          404: 'Category not found.',
          409: 'This category is still referenced by child categories or products.',
        }),
      };
    }
  }

  async getAdminCollections(params?: AdminCollectionListParams): Promise<
    ServiceResult<{
      collections: CollectionData[];
      total: number;
    }>
  > {
    try {
      const query = this.buildQuery(params);
      const response = await this.get<{
        data: {
          collections: CollectionData[];
          total: number;
        };
      }>(`admin/collection${query}`);

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to fetch admin collection list.'),
      };
    }
  }

  async getAdminCollectionById(collectionId: string): Promise<ServiceResult<CollectionData>> {
    const normalized_collection_id = collectionId.trim();
    if (!normalized_collection_id) {
      return { success: false, message: 'Collection id is required.' };
    }

    try {
      const response = await this.get<{ data: { collection: CollectionData } }>(
        `admin/collection/${encodeURIComponent(normalized_collection_id)}`
      );

      return { success: true, data: response.data.collection };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to fetch admin collection.', {
          404: 'Collection not found.',
        }),
      };
    }
  }

  async createAdminCollection(data: CreateCollectionInput): Promise<ServiceResult<CollectionData>> {
    const validation = ProductService.validate(createCollectionSchema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.post<{ data: { collection: CollectionData } }>(
        'admin/collection',
        validation.data
      );

      return { success: true, data: response.data.collection };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to create collection.', {
          409: 'A collection with this slug already exists.',
          422: 'Smart collections require at least one rule.',
        }),
      };
    }
  }

  async updateAdminCollection(
    collectionId: string,
    data: UpdateCollectionInput
  ): Promise<ServiceResult<CollectionData>> {
    const normalized_collection_id = collectionId.trim();
    if (!normalized_collection_id) {
      return { success: false, message: 'Collection id is required.' };
    }

    const validation = ProductService.validate(updateCollectionSchema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.patch<{ data: { collection: CollectionData } }>(
        `admin/collection/${encodeURIComponent(normalized_collection_id)}`,
        validation.data
      );

      return { success: true, data: response.data.collection };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to update collection.', {
          404: 'Collection not found.',
          409: 'A collection with this slug already exists.',
          422: 'Smart collections require at least one rule.',
        }),
      };
    }
  }

  async replaceAdminCollection(
    collectionId: string,
    data: CreateCollectionInput
  ): Promise<ServiceResult<CollectionData>> {
    const normalized_collection_id = collectionId.trim();
    if (!normalized_collection_id) {
      return { success: false, message: 'Collection id is required.' };
    }

    const validation = ProductService.validate(createCollectionSchema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.put<{ data: { collection: CollectionData } }>(
        `admin/collection/${encodeURIComponent(normalized_collection_id)}`,
        validation.data
      );

      return { success: true, data: response.data.collection };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to replace collection.', {
          404: 'Collection not found.',
          409: 'A collection with this slug already exists.',
          422: 'Smart collections require at least one rule.',
        }),
      };
    }
  }

  async deleteAdminCollection(collectionId: string): Promise<ServiceResult<{ deleted: boolean }>> {
    const normalized_collection_id = collectionId.trim();
    if (!normalized_collection_id) {
      return { success: false, message: 'Collection id is required.' };
    }

    try {
      const response = await this.delete<{ data: { deleted: boolean } }>(
        `admin/collection/${encodeURIComponent(normalized_collection_id)}`
      );

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to delete collection.', {
          404: 'Collection not found.',
          409: 'This collection is still referenced by products.',
        }),
      };
    }
  }

  async getAdminProductInventory(
    productId: string,
    params?: AdminInventoryListParams
  ): Promise<ServiceResult<{ product: ProductInventoryData; movements: InventoryMovementData[] }>> {
    const normalized_product_id = productId.trim();
    if (!normalized_product_id) {
      return { success: false, message: 'Product id is required.' };
    }

    try {
      const query = this.buildQuery(params);
      const response = await this.get<{
        data: {
          product: ProductInventoryData;
          movements: InventoryMovementData[];
        };
      }>(`admin/product/${encodeURIComponent(normalized_product_id)}/inventory${query}`);

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to fetch product inventory.', {
          404: 'Product not found.',
        }),
      };
    }
  }

  async mutateAdminProductInventory(
    productId: string,
    data: AdminInventoryOperationInput
  ): Promise<ServiceResult<AdminInventoryOperationResult>> {
    const normalized_product_id = productId.trim();
    if (!normalized_product_id) {
      return { success: false, message: 'Product id is required.' };
    }

    const inventory_operation_schema = z.object({
      operation: z.enum(['adjust_add', 'adjust_remove', 'reserve', 'release', 'fulfill']),
      size: z.string().trim().min(1, 'Size is required.'),
      quantity: z.number().int().positive('Quantity must be a positive integer.'),
      note: z.string().trim().nullable().optional(),
      referenceId: z.string().trim().nullable().optional(),
      referenceType: z.string().trim().nullable().optional(),
    });

    const validation = ProductService.validate(inventory_operation_schema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.post<{ data: AdminInventoryOperationResult }>(
        `admin/product/${encodeURIComponent(normalized_product_id)}/inventory`,
        validation.data
      );

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: ProductService.fromHttpError(error, 'Failed to update product inventory.', {
          404: 'Product not found.',
          422: 'Invalid inventory operation payload.',
        }),
      };
    }
  }

  getInventoryMovementReasons(): string[] {
    return Object.values(InventoryMovementReason);
  }

  getCollectionTypes(): string[] {
    return Object.values(CollectionType);
  }
}

export const productService = new ProductService();
