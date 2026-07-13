'use client';

import { keepPreviousData, useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { catalogService } from '@/services/catalog.service';
import type {
  BrandData,
  CatalogPagination,
  CategoryData,
  CollectionData,
  GetBrandsParams,
  GetCategoriesParams,
  GetCollectionsParams,
} from '@/services/catalog.service';

type ServiceResult<T> = { success: true; data: T } | { success: false; message: string };

export class CatalogServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogServiceError';
  }
}

function unwrapResult<T>(result: ServiceResult<T>): T {
  if (!result.success) {
    throw new CatalogServiceError(result.message);
  }

  return result.data;
}

export const catalogKeys = {
  all: ['catalog'] as const,
  brandsAll: () => [...catalogKeys.all, 'brands'] as const,
  brandsList: (params?: GetBrandsParams) =>
    [...catalogKeys.brandsAll(), 'list', params ?? {}] as const,
  brandDetail: (slug: string) => [...catalogKeys.brandsAll(), 'detail', slug] as const,
  categoriesAll: () => [...catalogKeys.all, 'categories'] as const,
  categoriesList: (params?: GetCategoriesParams) =>
    [...catalogKeys.categoriesAll(), 'list', params ?? {}] as const,
  categoryDetail: (slug: string) => [...catalogKeys.categoriesAll(), 'detail', slug] as const,
  collectionsAll: () => [...catalogKeys.all, 'collections'] as const,
  collectionsList: (params?: GetCollectionsParams) =>
    [...catalogKeys.collectionsAll(), 'list', params ?? {}] as const,
  collectionDetail: (slug: string) => [...catalogKeys.collectionsAll(), 'detail', slug] as const,
};

type QueryOptionsOf<TData> = Omit<
  UseQueryOptions<TData, CatalogServiceError>,
  'queryKey' | 'queryFn'
>;

export function useBrandsQuery(
  params?: GetBrandsParams,
  options?: QueryOptionsOf<{ brands: BrandData[]; pagination: CatalogPagination }>
) {
  return useQuery({
    queryKey: catalogKeys.brandsList(params),
    queryFn: async () => unwrapResult(await catalogService.getBrands(params)),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useBrandBySlugQuery(slug: string, options?: QueryOptionsOf<BrandData>) {
  return useQuery({
    queryKey: catalogKeys.brandDetail(slug),
    queryFn: async () => unwrapResult(await catalogService.getBrandBySlug(slug)),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    ...options,
  });
}

export function useCategoriesQuery(
  params?: GetCategoriesParams,
  options?: QueryOptionsOf<{ categories: CategoryData[]; pagination: CatalogPagination }>
) {
  return useQuery({
    queryKey: catalogKeys.categoriesList(params),
    queryFn: async () => unwrapResult(await catalogService.getCategories(params)),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useCategoryBySlugQuery(slug: string, options?: QueryOptionsOf<CategoryData>) {
  return useQuery({
    queryKey: catalogKeys.categoryDetail(slug),
    queryFn: async () => unwrapResult(await catalogService.getCategoryBySlug(slug)),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    ...options,
  });
}

export function useCollectionsQuery(
  params?: GetCollectionsParams,
  options?: QueryOptionsOf<{ collections: CollectionData[]; pagination: CatalogPagination }>
) {
  return useQuery({
    queryKey: catalogKeys.collectionsList(params),
    queryFn: async () => unwrapResult(await catalogService.getCollections(params)),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useCollectionBySlugQuery(slug: string, options?: QueryOptionsOf<CollectionData>) {
  return useQuery({
    queryKey: catalogKeys.collectionDetail(slug),
    queryFn: async () => unwrapResult(await catalogService.getCollectionBySlug(slug)),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    ...options,
  });
}
