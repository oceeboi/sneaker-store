'use client';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import { productService } from '@/services/product.service';
import type {
  AdminBrandListParams,
  AdminCategoryListParams,
  AdminCollectionListParams,
  AdminInventoryListParams,
  AdminInventoryOperationInput,
  AdminInventoryOperationResult,
  AdminProductListParams,
  BrandData,
  CategoryData,
  CollectionData,
  CreateBrandInput,
  CreateCategoryInput,
  CreateCollectionInput,
  CreateProductInput,
  InventoryMovementData,
  ProductData,
  ProductInventoryData,
  ProductPagination,
  PublicProductListParams,
  UpdateBrandInput,
  UpdateCategoryInput,
  UpdateCollectionInput,
  UpdateProductInput,
} from '@/services/product.service';

// ---------------------------------------------------------------------------
// Error boundary between ServiceResult<T> and TanStack Query
// ---------------------------------------------------------------------------

type ServiceResult<T> = { success: true; data: T } | { success: false; message: string };

/**
 * Thrown by every query/mutation in this file when the underlying
 * `ProductService` call resolves with `{ success: false }`. Components read
 * `error.message` (from `useQuery`/`useMutation`'s `error` field) exactly like
 * any other thrown error — no special handling needed on the consuming side.
 */
export class ProductServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductServiceError';
  }
}

function unwrapResult<T>(result: ServiceResult<T>): T {
  if (!result.success) {
    throw new ProductServiceError(result.message);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Query key factories — one per resource, hierarchical, typed
// ---------------------------------------------------------------------------

export const productKeys = {
  all: ['products'] as const,
  publicAll: () => [...productKeys.all, 'public'] as const,
  publicList: (params?: PublicProductListParams) =>
    [...productKeys.publicAll(), 'list', params ?? {}] as const,
  publicDetail: (slug: string) => [...productKeys.publicAll(), 'detail', slug] as const,
  adminAll: () => [...productKeys.all, 'admin'] as const,
  adminList: (params?: AdminProductListParams) =>
    [...productKeys.adminAll(), 'list', params ?? {}] as const,
  adminDetail: (productId: string) => [...productKeys.adminAll(), 'detail', productId] as const,
  adminInventory: (productId: string, params?: AdminInventoryListParams) =>
    [...productKeys.adminAll(), 'inventory', productId, params ?? {}] as const,
};

export const brandKeys = {
  all: ['brands'] as const,
  adminList: (params?: AdminBrandListParams) =>
    [...brandKeys.all, 'admin', 'list', params ?? {}] as const,
  adminDetail: (brandId: string) => [...brandKeys.all, 'admin', 'detail', brandId] as const,
};

export const categoryKeys = {
  all: ['categories'] as const,
  adminList: (params?: AdminCategoryListParams) =>
    [...categoryKeys.all, 'admin', 'list', params ?? {}] as const,
  adminDetail: (categoryId: string) =>
    [...categoryKeys.all, 'admin', 'detail', categoryId] as const,
};

export const collectionKeys = {
  all: ['collections'] as const,
  adminList: (params?: AdminCollectionListParams) =>
    [...collectionKeys.all, 'admin', 'list', params ?? {}] as const,
  adminDetail: (collectionId: string) =>
    [...collectionKeys.all, 'admin', 'detail', collectionId] as const,
};

// Shared option-forwarding types so every query hook accepts the same
// pass-through surface (enabled, select, etc.) without repeating boilerplate.
type QueryOptionsOf<TData> = Omit<
  UseQueryOptions<TData, ProductServiceError>,
  'queryKey' | 'queryFn'
>;
type MutationOptionsOf<TData, TVariables> = Omit<
  UseMutationOptions<TData, ProductServiceError, TVariables>,
  'mutationFn'
>;

// ===========================================================================
// PUBLIC STOREFRONT QUERIES
// ===========================================================================

/**
 * `ProductService.getProducts` — public, paginated catalog listing.
 *
 * Caching: storefront browsing tolerates a minute of staleness (prices/stock
 * shown here aren't the source of truth for checkout — that's re-verified at
 * `initialize checkout` time, per your Paystack flow). `placeholderData:
 * keepPreviousData` keeps the previous page's products on screen while the
 * next page loads, instead of flashing a skeleton — important on slower
 * mobile connections where every page change would otherwise cause a visible
 * blank state.
 */
export function usePublicProductsQuery(
  params?: PublicProductListParams,
  options?: QueryOptionsOf<{ products: ProductData[]; pagination: ProductPagination }>
) {
  console.log('params', params);
  return useQuery({
    queryKey: productKeys.publicList(params),
    queryFn: async () => unwrapResult(await productService.getProducts(params)),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    ...options,
  });
}

/**
 * `ProductService.getProductBySlug` — public product detail page.
 *
 * Caching: product detail content (name, description, media, SEO) changes
 * infrequently relative to browsing sessions, so this gets the longest
 * `staleTime` in the file. Stock/price correctness at the moment of purchase
 * is still enforced server-side during checkout initialization, so a slightly
 * stale detail view here is not a correctness risk, only a UX one.
 */
export function usePublicProductQuery(slug: string, options?: QueryOptionsOf<ProductData>) {
  return useQuery({
    queryKey: productKeys.publicDetail(slug),
    queryFn: async () => unwrapResult(await productService.getProductBySlug(slug)),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    ...options,
  });
}

// ===========================================================================
// ADMIN PRODUCT QUERIES + MUTATIONS
// ===========================================================================

/**
 * `ProductService.getAdminProducts` — admin product table/list.
 *
 * Caching: an admin dashboard needs to reflect the admin's own recent writes
 * quickly, so this is intentionally much shorter-lived than the public list.
 */
export function useAdminProductsQuery(
  params?: AdminProductListParams,
  options?: QueryOptionsOf<{ products: ProductData[]; total: number }>
) {
  return useQuery({
    queryKey: productKeys.adminList(params),
    queryFn: async () => unwrapResult(await productService.getAdminProducts(params)),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

/** `ProductService.getAdminProductById` — admin product edit screen. */
export function useAdminProductQuery(productId: string, options?: QueryOptionsOf<ProductData>) {
  return useQuery({
    queryKey: productKeys.adminDetail(productId),
    queryFn: async () => unwrapResult(await productService.getAdminProductById(productId)),
    enabled: Boolean(productId),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    ...options,
  });
}

/**
 * `ProductService.createAdminProduct`.
 *
 * On success: writes the created product directly into the admin-detail
 * cache (no need to refetch something we just received in full), and
 * invalidates every admin/public product list so the new product appears
 * next time those lists are read.
 */
export function useCreateAdminProductMutation(
  options?: MutationOptionsOf<ProductData, CreateProductInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateProductInput) =>
      unwrapResult(await productService.createAdminProduct(data)),
    onSuccess: (product, variables, onMutateResult, context) => {
      queryClient.setQueryData(productKeys.adminDetail(product.id), product);
      queryClient.invalidateQueries({ queryKey: productKeys.adminAll() });
      queryClient.invalidateQueries({ queryKey: productKeys.publicAll() });
      options?.onSuccess?.(product, variables, onMutateResult, context);
    },
    ...options,
  });
}

type UpdateAdminProductVariables = { productId: string; data: UpdateProductInput };

/**
 * `ProductService.updateAdminProduct` (PATCH — partial update).
 *
 * On success: writes the returned product into the detail cache and
 * invalidates lists (name/slug/pricing/active shown in list rows may have
 * changed) plus the public-facing detail/list for the same reason.
 */
export function useUpdateAdminProductMutation(
  options?: MutationOptionsOf<ProductData, UpdateAdminProductVariables>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, data }: UpdateAdminProductVariables) =>
      unwrapResult(await productService.updateAdminProduct(productId, data)),
    onSuccess: (product, variables, onMutateResult, context) => {
      queryClient.setQueryData(productKeys.adminDetail(variables.productId), product);
      queryClient.invalidateQueries({ queryKey: productKeys.adminAll() });
      queryClient.invalidateQueries({ queryKey: productKeys.publicAll() });
      options?.onSuccess?.(product, variables, onMutateResult, context);
    },
    ...options,
  });
}

type ReplaceAdminProductVariables = { productId: string; data: CreateProductInput };

/** `ProductService.replaceAdminProduct` (PUT — full replace). Same invalidation shape as update. */
export function useReplaceAdminProductMutation(
  options?: MutationOptionsOf<ProductData, ReplaceAdminProductVariables>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, data }: ReplaceAdminProductVariables) =>
      unwrapResult(await productService.replaceAdminProduct(productId, data)),
    onSuccess: (product, variables, onMutateResult, context) => {
      queryClient.setQueryData(productKeys.adminDetail(variables.productId), product);
      queryClient.invalidateQueries({ queryKey: productKeys.adminAll() });
      queryClient.invalidateQueries({ queryKey: productKeys.publicAll() });
      options?.onSuccess?.(product, variables, onMutateResult, context);
    },
    ...options,
  });
}

/**
 * `ProductService.deleteAdminProduct`.
 *
 * On success: removes the now-nonexistent detail query outright (rather than
 * invalidating it, which would just trigger a 404 refetch) and invalidates
 * every list.
 */
export function useDeleteAdminProductMutation(
  options?: MutationOptionsOf<{ deleted: boolean }, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) =>
      unwrapResult(await productService.deleteAdminProduct(productId)),
    onSuccess: (result, productId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: productKeys.adminDetail(productId) });
      queryClient.invalidateQueries({ queryKey: productKeys.adminAll() });
      queryClient.invalidateQueries({ queryKey: productKeys.publicAll() });
      options?.onSuccess?.(result, productId, onMutateResult, context);
    },
    ...options,
  });
}

// ===========================================================================
// ADMIN BRAND QUERIES + MUTATIONS
// ===========================================================================

/** `ProductService.getAdminBrands`. */
export function useAdminBrandsQuery(
  params?: AdminBrandListParams,
  options?: QueryOptionsOf<{ brands: BrandData[]; total: number }>
) {
  return useQuery({
    queryKey: brandKeys.adminList(params),
    queryFn: async () => unwrapResult(await productService.getAdminBrands(params)),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

/** `ProductService.getAdminBrandById`. */
export function useAdminBrandQuery(brandId: string, options?: QueryOptionsOf<BrandData>) {
  return useQuery({
    queryKey: brandKeys.adminDetail(brandId),
    queryFn: async () => unwrapResult(await productService.getAdminBrandById(brandId)),
    enabled: Boolean(brandId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    ...options,
  });
}

/**
 * `ProductService.createAdminBrand`.
 *
 * On success: only the brand list needs invalidating — a brand that didn't
 * exist yet can't be referenced by any product, so product caches are left
 * untouched.
 */
export function useCreateAdminBrandMutation(
  options?: MutationOptionsOf<BrandData, CreateBrandInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBrandInput) =>
      unwrapResult(await productService.createAdminBrand(data)),
    onSuccess: (brand, variables, onMutateResult, context) => {
      queryClient.setQueryData(brandKeys.adminDetail(brand.id), brand);
      queryClient.invalidateQueries({ queryKey: brandKeys.all });
      options?.onSuccess?.(brand, variables, onMutateResult, context);
    },
    ...options,
  });
}

type UpdateAdminBrandVariables = { brandId: string; data: UpdateBrandInput };

/**
 * `ProductService.updateAdminBrand`.
 *
 * On success: invalidates brand caches *and* `productKeys.all` — every
 * product embeds a denormalized `ProductReference { id, name, slug }` for its
 * brand, so a brand rename/slug change can make cached product data stale
 * even though the product itself wasn't touched.
 */
export function useUpdateAdminBrandMutation(
  options?: MutationOptionsOf<BrandData, UpdateAdminBrandVariables>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ brandId, data }: UpdateAdminBrandVariables) =>
      unwrapResult(await productService.updateAdminBrand(brandId, data)),
    onSuccess: (brand, variables, onMutateResult, context) => {
      queryClient.setQueryData(brandKeys.adminDetail(variables.brandId), brand);
      queryClient.invalidateQueries({ queryKey: brandKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      options?.onSuccess?.(brand, variables, onMutateResult, context);
    },
    ...options,
  });
}

type ReplaceAdminBrandVariables = { brandId: string; data: CreateBrandInput };

/** `ProductService.replaceAdminBrand`. Same invalidation shape as update. */
export function useReplaceAdminBrandMutation(
  options?: MutationOptionsOf<BrandData, ReplaceAdminBrandVariables>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ brandId, data }: ReplaceAdminBrandVariables) =>
      unwrapResult(await productService.replaceAdminBrand(brandId, data)),
    onSuccess: (brand, variables, onMutateResult, context) => {
      queryClient.setQueryData(brandKeys.adminDetail(variables.brandId), brand);
      queryClient.invalidateQueries({ queryKey: brandKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      options?.onSuccess?.(brand, variables, onMutateResult, context);
    },
    ...options,
  });
}

/**
 * `ProductService.deleteAdminBrand`.
 *
 * Note: the service itself returns a 409 ("still referenced by products")
 * if deletion isn't safe, so a successful response here means no product
 * referenced this brand — `productKeys.all` invalidation is included anyway
 * for defense-in-depth, at negligible cost since deletes are rare.
 */
export function useDeleteAdminBrandMutation(
  options?: MutationOptionsOf<{ deleted: boolean }, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (brandId: string) =>
      unwrapResult(await productService.deleteAdminBrand(brandId)),
    onSuccess: (result, brandId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: brandKeys.adminDetail(brandId) });
      queryClient.invalidateQueries({ queryKey: brandKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      options?.onSuccess?.(result, brandId, onMutateResult, context);
    },
    ...options,
  });
}

// ===========================================================================
// ADMIN CATEGORY QUERIES + MUTATIONS
// ===========================================================================

/** `ProductService.getAdminCategories`. */
export function useAdminCategoriesQuery(
  params?: AdminCategoryListParams,
  options?: QueryOptionsOf<{ categories: CategoryData[]; total: number }>
) {
  return useQuery({
    queryKey: categoryKeys.adminList(params),
    queryFn: async () => unwrapResult(await productService.getAdminCategories(params)),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

/** `ProductService.getAdminCategoryById`. */
export function useAdminCategoryQuery(categoryId: string, options?: QueryOptionsOf<CategoryData>) {
  return useQuery({
    queryKey: categoryKeys.adminDetail(categoryId),
    queryFn: async () => unwrapResult(await productService.getAdminCategoryById(categoryId)),
    enabled: Boolean(categoryId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    ...options,
  });
}

/** `ProductService.createAdminCategory`. New category — nothing else to invalidate but the list. */
export function useCreateAdminCategoryMutation(
  options?: MutationOptionsOf<CategoryData, CreateCategoryInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCategoryInput) =>
      unwrapResult(await productService.createAdminCategory(data)),
    onSuccess: (category, variables, onMutateResult, context) => {
      queryClient.setQueryData(categoryKeys.adminDetail(category.id), category);
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      options?.onSuccess?.(category, variables, onMutateResult, context);
    },
    ...options,
  });
}

type UpdateAdminCategoryVariables = { categoryId: string; data: UpdateCategoryInput };

/**
 * `ProductService.updateAdminCategory`.
 *
 * Same denormalization concern as brand updates: `ProductReference` embeds
 * category name/slug, and categories can also be parents of other categories
 * (`parentId`), so `categoryKeys.all` is invalidated broadly rather than just
 * the single detail key.
 */
export function useUpdateAdminCategoryMutation(
  options?: MutationOptionsOf<CategoryData, UpdateAdminCategoryVariables>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ categoryId, data }: UpdateAdminCategoryVariables) =>
      unwrapResult(await productService.updateAdminCategory(categoryId, data)),
    onSuccess: (category, variables, onMutateResult, context) => {
      queryClient.setQueryData(categoryKeys.adminDetail(variables.categoryId), category);
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      options?.onSuccess?.(category, variables, onMutateResult, context);
    },
    ...options,
  });
}

type ReplaceAdminCategoryVariables = { categoryId: string; data: CreateCategoryInput };

/** `ProductService.replaceAdminCategory`. Same invalidation shape as update. */
export function useReplaceAdminCategoryMutation(
  options?: MutationOptionsOf<CategoryData, ReplaceAdminCategoryVariables>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ categoryId, data }: ReplaceAdminCategoryVariables) =>
      unwrapResult(await productService.replaceAdminCategory(categoryId, data)),
    onSuccess: (category, variables, onMutateResult, context) => {
      queryClient.setQueryData(categoryKeys.adminDetail(variables.categoryId), category);
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      options?.onSuccess?.(category, variables, onMutateResult, context);
    },
    ...options,
  });
}

/**
 * `ProductService.deleteAdminCategory`.
 * Service enforces the 409 (still referenced by child categories/products)
 * before this can succeed; broad invalidation here is defense-in-depth.
 */
export function useDeleteAdminCategoryMutation(
  options?: MutationOptionsOf<{ deleted: boolean }, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) =>
      unwrapResult(await productService.deleteAdminCategory(categoryId)),
    onSuccess: (result, categoryId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: categoryKeys.adminDetail(categoryId) });
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      options?.onSuccess?.(result, categoryId, onMutateResult, context);
    },
    ...options,
  });
}

// ===========================================================================
// ADMIN COLLECTION QUERIES + MUTATIONS
// ===========================================================================

/** `ProductService.getAdminCollections`. */
export function useAdminCollectionsQuery(
  params?: AdminCollectionListParams,
  options?: QueryOptionsOf<{ collections: CollectionData[]; total: number }>
) {
  return useQuery({
    queryKey: collectionKeys.adminList(params),
    queryFn: async () => unwrapResult(await productService.getAdminCollections(params)),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

/** `ProductService.getAdminCollectionById`. */
export function useAdminCollectionQuery(
  collectionId: string,
  options?: QueryOptionsOf<CollectionData>
) {
  return useQuery({
    queryKey: collectionKeys.adminDetail(collectionId),
    queryFn: async () => unwrapResult(await productService.getAdminCollectionById(collectionId)),
    enabled: Boolean(collectionId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    ...options,
  });
}

/** `ProductService.createAdminCollection`. New collection — nothing else to invalidate but the list. */
export function useCreateAdminCollectionMutation(
  options?: MutationOptionsOf<CollectionData, CreateCollectionInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCollectionInput) =>
      unwrapResult(await productService.createAdminCollection(data)),
    onSuccess: (collection, variables, onMutateResult, context) => {
      queryClient.setQueryData(collectionKeys.adminDetail(collection.id), collection);
      queryClient.invalidateQueries({ queryKey: collectionKeys.all });
      options?.onSuccess?.(collection, variables, onMutateResult, context);
    },
    ...options,
  });
}

type UpdateAdminCollectionVariables = { collectionId: string; data: UpdateCollectionInput };

/**
 * `ProductService.updateAdminCollection`.
 *
 * Smart collections (`rules`) determine membership dynamically, and every
 * product carries a denormalized `ProductReference[]` for its collections —
 * a rule or name/slug change can silently change which products a smart
 * collection matches, so `productKeys.all` is invalidated as well.
 */
export function useUpdateAdminCollectionMutation(
  options?: MutationOptionsOf<CollectionData, UpdateAdminCollectionVariables>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ collectionId, data }: UpdateAdminCollectionVariables) =>
      unwrapResult(await productService.updateAdminCollection(collectionId, data)),
    onSuccess: (collection, variables, onMutateResult, context) => {
      queryClient.setQueryData(collectionKeys.adminDetail(variables.collectionId), collection);
      queryClient.invalidateQueries({ queryKey: collectionKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      options?.onSuccess?.(collection, variables, onMutateResult, context);
    },
    ...options,
  });
}

type ReplaceAdminCollectionVariables = { collectionId: string; data: CreateCollectionInput };

/** `ProductService.replaceAdminCollection`. Same invalidation shape as update. */
export function useReplaceAdminCollectionMutation(
  options?: MutationOptionsOf<CollectionData, ReplaceAdminCollectionVariables>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ collectionId, data }: ReplaceAdminCollectionVariables) =>
      unwrapResult(await productService.replaceAdminCollection(collectionId, data)),
    onSuccess: (collection, variables, onMutateResult, context) => {
      queryClient.setQueryData(collectionKeys.adminDetail(variables.collectionId), collection);
      queryClient.invalidateQueries({ queryKey: collectionKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      options?.onSuccess?.(collection, variables, onMutateResult, context);
    },
    ...options,
  });
}

/**
 * `ProductService.deleteAdminCollection`.
 * Service enforces the 409 (still referenced by products) before this can
 * succeed; broad invalidation here is defense-in-depth.
 */
export function useDeleteAdminCollectionMutation(
  options?: MutationOptionsOf<{ deleted: boolean }, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (collectionId: string) =>
      unwrapResult(await productService.deleteAdminCollection(collectionId)),
    onSuccess: (result, collectionId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: collectionKeys.adminDetail(collectionId) });
      queryClient.invalidateQueries({ queryKey: collectionKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      options?.onSuccess?.(result, collectionId, onMutateResult, context);
    },
    ...options,
  });
}

// ===========================================================================
// ADMIN INVENTORY QUERY + MUTATION
// ===========================================================================

/**
 * `ProductService.getAdminProductInventory` — per-product stock + movement
 * ledger view.
 *
 * Caching: the shortest `staleTime` in this file. Stock counts are the one
 * value where "stale" directly means "wrong" — a stale `availableQuantity`
 * risks an admin believing there's stock to fulfill when there isn't, or vice
 * versa. `refetchOnWindowFocus: true` (the default) is intentionally left
 * on here, unlike everywhere else, so switching back to this tab re-checks
 * stock.
 */
export function useAdminProductInventoryQuery(
  productId: string,
  params?: AdminInventoryListParams,
  options?: QueryOptionsOf<{ product: ProductInventoryData; movements: InventoryMovementData[] }>
) {
  return useQuery({
    queryKey: productKeys.adminInventory(productId, params),
    queryFn: async () =>
      unwrapResult(await productService.getAdminProductInventory(productId, params)),
    enabled: Boolean(productId),
    staleTime: 5_000,
    gcTime: 2 * 60_000,
    ...options,
  });
}

type MutateAdminProductInventoryVariables = {
  productId: string;
  data: AdminInventoryOperationInput;
};

/**
 * `ProductService.mutateAdminProductInventory` — adjust/reserve/release/fulfill
 * stock for one size.
 *
 * Deliberately **not** optimistic (`retry: false`, no `onMutate`): this is the
 * inventory equivalent of your checkout-initialize rule — never guess at a
 * stock mutation client-side, since a wrong optimistic update here could show
 * an admin a stock level that doesn't match what the server actually
 * committed, and a retried request could double-apply a delta.
 *
 * On success: invalidates the inventory ledger for this product, the admin
 * product detail (its embedded `sizes[]` reflects the new stock), the admin
 * product list (stock/low-stock badges), and the public product detail/list
 * (storefront availability and "out of stock" state depend on this).
 */
export function useMutateAdminProductInventoryMutation(
  options?: MutationOptionsOf<AdminInventoryOperationResult, MutateAdminProductInventoryVariables>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, data }: MutateAdminProductInventoryVariables) =>
      unwrapResult(await productService.mutateAdminProductInventory(productId, data)),
    retry: false,
    onSuccess: (result, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: [...productKeys.adminAll(), 'inventory', variables.productId],
      });
      queryClient.invalidateQueries({ queryKey: productKeys.adminDetail(variables.productId) });
      queryClient.invalidateQueries({ queryKey: productKeys.adminAll() });
      queryClient.invalidateQueries({ queryKey: productKeys.publicAll() });
      options?.onSuccess?.(result, variables, onMutateResult, context);
    },
    ...options,
  });
}

// ===========================================================================
// STATIC REFERENCE DATA
// ===========================================================================
// `getInventoryMovementReasons` and `getCollectionTypes` are synchronous enum
// readers on the service, not network calls — there's nothing to fetch, cache,
// invalidate, or go stale. They're wrapped as plain hooks (not `useQuery`) so
// consuming components stay consistent in how they import/call things, and
// `useMemo` keeps the returned array referentially stable across re-renders
// (useful if a component passes it into another hook's dependency array).

/** `ProductService.getInventoryMovementReasons`. */
export function useInventoryMovementReasons(): string[] {
  return useMemo(() => productService.getInventoryMovementReasons(), []);
}

/** `ProductService.getCollectionTypes`. */
export function useCollectionTypes(): string[] {
  return useMemo(() => productService.getCollectionTypes(), []);
}
