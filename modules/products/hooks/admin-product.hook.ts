'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AdminInventoryListParams,
  AdminInventoryOperationInput,
} from '@/services/product.service';
import type {
  AdminProductCreateInput,
  AdminProductUpdateInput,
} from '../schemas/admin-product.schemas';
import type {
  AdminProductSizeCreateInput,
  AdminProductSizeUpdateInput,
} from '../schemas/admin-product-size.schemas';
import { adminProductService } from '../services/admin-product.service';

export class AdminProductServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminProductServiceError';
  }
}

type ServiceResult<T> = { success: true; data: T } | { success: false; message: string };

function unwrapResult<T>(result: ServiceResult<T>): T {
  if (!result.success) {
    throw new AdminProductServiceError(result.message);
  }

  return result.data;
}

export const adminProductKeys = {
  root: ['admin-products'] as const,
  list: (search?: string) => [...adminProductKeys.root, 'list', search ?? ''] as const,
  detail: (productId: string) => [...adminProductKeys.root, 'detail', productId] as const,
  sizeList: (productId: string) => [...adminProductKeys.root, 'sizes', productId] as const,
  inventory: (productId: string, params?: AdminInventoryListParams) =>
    [...adminProductKeys.root, 'inventory', productId, params ?? {}] as const,
};

export function useAdminProductsListQuery(search?: string) {
  return useQuery({
    queryKey: adminProductKeys.list(search),
    queryFn: async () =>
      unwrapResult(await adminProductService.getAdminProducts({ search: search || undefined })),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useAdminProductDetailQuery(productId: string) {
  return useQuery({
    queryKey: adminProductKeys.detail(productId),
    queryFn: async () => unwrapResult(await adminProductService.getAdminProductById(productId)),
    enabled: Boolean(productId),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateAdminProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AdminProductCreateInput) =>
      unwrapResult(await adminProductService.createAdminProduct(data)),
    onSuccess: (product) => {
      queryClient.setQueryData(adminProductKeys.detail(product.id), product);
      queryClient.invalidateQueries({ queryKey: adminProductKeys.root });
    },
  });
}

export function useUpdateAdminProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, data }: { productId: string; data: AdminProductUpdateInput }) =>
      unwrapResult(await adminProductService.updateAdminProduct(productId, data)),
    onSuccess: (product, variables) => {
      queryClient.setQueryData(adminProductKeys.detail(variables.productId), product);
      queryClient.invalidateQueries({ queryKey: adminProductKeys.root });
    },
  });
}

export function useReplaceAdminProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, data }: { productId: string; data: AdminProductCreateInput }) =>
      unwrapResult(await adminProductService.replaceAdminProduct(productId, data)),
    onSuccess: (product, variables) => {
      queryClient.setQueryData(adminProductKeys.detail(variables.productId), product);
      queryClient.invalidateQueries({ queryKey: adminProductKeys.root });
    },
  });
}

export function useDeleteAdminProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) =>
      unwrapResult(await adminProductService.deleteAdminProduct(productId)),
    onSuccess: (_result, productId) => {
      queryClient.removeQueries({ queryKey: adminProductKeys.detail(productId) });
      queryClient.invalidateQueries({ queryKey: adminProductKeys.root });
    },
  });
}

export function useAdminProductSizesQuery(productId: string) {
  return useQuery({
    queryKey: adminProductKeys.sizeList(productId),
    queryFn: async () => unwrapResult(await adminProductService.getAdminProductSizes(productId)),
    enabled: Boolean(productId),
    staleTime: 5_000,
  });
}

export function useCreateAdminProductSizeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      data,
    }: {
      productId: string;
      data: AdminProductSizeCreateInput;
    }) => unwrapResult(await adminProductService.createAdminProductSize(productId, data)),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: adminProductKeys.sizeList(variables.productId) });
      queryClient.invalidateQueries({ queryKey: adminProductKeys.detail(variables.productId) });
      queryClient.invalidateQueries({ queryKey: adminProductKeys.root });
    },
  });
}

export function useUpdateAdminProductSizeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      data,
    }: {
      productId: string;
      data: AdminProductSizeUpdateInput;
    }) => unwrapResult(await adminProductService.updateAdminProductSize(productId, data)),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: adminProductKeys.sizeList(variables.productId) });
      queryClient.invalidateQueries({ queryKey: adminProductKeys.detail(variables.productId) });
      queryClient.invalidateQueries({ queryKey: adminProductKeys.root });
    },
  });
}

export function useDeleteAdminProductSizeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, sizeId }: { productId: string; sizeId: string }) =>
      unwrapResult(await adminProductService.deleteAdminProductSize(productId, sizeId)),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: adminProductKeys.sizeList(variables.productId) });
      queryClient.invalidateQueries({ queryKey: adminProductKeys.detail(variables.productId) });
      queryClient.invalidateQueries({ queryKey: adminProductKeys.root });
    },
  });
}

export function useAdminProductInventoryQuery(
  productId: string,
  params?: AdminInventoryListParams
) {
  return useQuery({
    queryKey: adminProductKeys.inventory(productId, params),
    queryFn: async () =>
      unwrapResult(await adminProductService.getAdminProductInventory(productId, params)),
    enabled: Boolean(productId),
    staleTime: 5_000,
  });
}

export function useMutateAdminProductInventoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      data,
    }: {
      productId: string;
      data: AdminInventoryOperationInput;
    }) => unwrapResult(await adminProductService.mutateAdminProductInventory(productId, data)),
    retry: false,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: adminProductKeys.inventory(variables.productId) });
      queryClient.invalidateQueries({ queryKey: adminProductKeys.detail(variables.productId) });
      queryClient.invalidateQueries({ queryKey: adminProductKeys.root });
    },
  });
}
