import http from '@/lib/ky';
import { HTTPError } from 'ky';
import { z } from 'zod';

export type CartUser = {
  id: string;
  email: string | null;
  username: string | null;
};

export type CartProduct = {
  id: string;
  name: string | null;
  slug: string | null;
};

export type CartItem = {
  product: CartProduct;
  sizeId: string;
  size: string;
  sku: string;
  quantity: number;
  priceAtAdd: number;
  subtotal: number;
};

export type CartStatus = 'active' | 'converted' | 'abandoned';

export type CartData = {
  id: string;
  user: CartUser;
  items: CartItem[];
  itemCount: number;
  total: number;
  status: CartStatus;
  currency: string;
  lastActivityAt: Date;
  idleMinutes: number;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type CartPagination = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

export type AdminAbandonedCartSweepResult = {
  cartId: string;
  userId: string | null;
  emailed: boolean;
  notificationId: string | null;
  error?: string;
};

export type GetAdminCartsParams = {
  status?: CartStatus;
  userId?: string;
  idleMinutesGte?: number;
  page?: number;
  limit?: number;
};

export type PreviewAbandonedCartsParams = {
  idleMinutes?: number;
};

export type AddCartItemInput = {
  productId: string;
  sizeId: string;
  quantity: number;
};

export type UpdateCartItemInput = {
  productId: string;
  sizeId: string;
  quantity?: number;
  nextSizeId?: string;
};

export type DeleteCartItemInput =
  | {
      clear: true;
      productId?: string;
      sizeId?: string;
    }
  | {
      clear?: false;
      productId: string;
      sizeId: string;
    };

export type UpdateAdminCartStatusInput = {
  status: CartStatus;
};

export type SweepAbandonedCartsInput = {
  idleMinutes?: number;
  notify?: boolean;
  dryRun?: boolean;
};

type ServiceResult<T> = { success: true; data: T } | { success: false; message: string };

const REQUEST_TIMEOUT_MS = 30_000;

const DEFAULT_HTTP_ERROR_MESSAGES: Partial<Record<number, string>> = {
  400: 'Bad request. Please check your data.',
  401: 'Unauthorized. Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'The request conflicts with the current resource state.',
  422: 'Invalid input. Please check your data and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'A server error occurred. Please try again later.',
  502: 'Service is temporarily unavailable. Please try again later.',
  503: 'Service is temporarily unavailable. Please try again later.',
  504: 'The request timed out. Please try again.',
};

const add_cart_item_schema = z.object({
  productId: z.string().trim().min(1, 'Product id is required.'),
  sizeId: z.string().trim().min(1, 'Size id is required.'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1.').max(20),
});

const update_cart_item_schema = z
  .object({
    productId: z.string().trim().min(1, 'Product id is required.'),
    sizeId: z.string().trim().min(1, 'Size id is required.'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1.').max(1000).optional(),
    nextSizeId: z.string().trim().min(1, 'Next size id is required.').optional(),
  })
  .refine((payload) => payload.quantity !== undefined || payload.nextSizeId !== undefined, {
    message: 'Provide at least one update field.',
    path: ['quantity'],
  });

const delete_cart_item_schema = z
  .object({
    productId: z.string().trim().min(1).optional(),
    sizeId: z.string().trim().min(1).optional(),
    clear: z.boolean().optional(),
  })
  .superRefine((payload, context) => {
    if (payload.clear) return;

    if (!payload.productId || !payload.sizeId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productId'],
        message: 'productId and sizeId are required unless clear=true',
      });
    }
  });

const admin_cart_status_schema = z.object({
  status: z.enum(['active', 'converted', 'abandoned']),
});

const abandoned_cart_sweep_schema = z.object({
  idleMinutes: z.number().int().min(1).optional(),
  notify: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export class CartService {
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
      return { success: false, message: CartService.fromValidationError(parsed.error) };
    }

    return { success: true, data: parsed.data };
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

  private async delete<T>(path: string, body?: unknown): Promise<T> {
    const response = await http.delete(path, {
      timeout: REQUEST_TIMEOUT_MS,
      ...(body !== undefined && { json: body }),
    });
    return response.json() as Promise<T>;
  }

  async getCart(): Promise<ServiceResult<CartData>> {
    try {
      const response = await this.get<{ data: { cart: CartData } }>('cart');
      return { success: true, data: response.data.cart };
    } catch (error) {
      return {
        success: false,
        message: CartService.fromHttpError(error, 'Failed to fetch cart.'),
      };
    }
  }

  async addItem(data: AddCartItemInput): Promise<ServiceResult<CartData>> {
    const validation = CartService.validate(add_cart_item_schema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.post<{ data: { cart: CartData } }>('cart', validation.data);
      return { success: true, data: response.data.cart };
    } catch (error) {
      return {
        success: false,
        message: CartService.fromHttpError(error, 'Failed to add item to cart.', {
          404: 'Product or size not found.',
          409: 'Requested quantity is no longer available.',
        }),
      };
    }
  }

  async updateItem(data: UpdateCartItemInput): Promise<ServiceResult<CartData>> {
    const validation = CartService.validate(update_cart_item_schema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.patch<{ data: { cart: CartData } }>('cart', validation.data);
      return { success: true, data: response.data.cart };
    } catch (error) {
      return {
        success: false,
        message: CartService.fromHttpError(error, 'Failed to update cart item.', {
          404: 'Cart item, product, or target size was not found.',
          409: 'Requested quantity is no longer available.',
        }),
      };
    }
  }

  async deleteItem(data: DeleteCartItemInput): Promise<ServiceResult<CartData>> {
    const validation = CartService.validate(delete_cart_item_schema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.delete<{ data: { cart: CartData } }>('cart', validation.data);
      return { success: true, data: response.data.cart };
    } catch (error) {
      return {
        success: false,
        message: CartService.fromHttpError(error, 'Failed to remove cart item.', {
          404: 'Cart item not found.',
        }),
      };
    }
  }

  async clearCart(): Promise<ServiceResult<CartData>> {
    return this.deleteItem({ clear: true });
  }

  async getAdminCarts(
    params?: GetAdminCartsParams
  ): Promise<ServiceResult<{ carts: CartData[]; pagination: CartPagination }>> {
    try {
      const query = this.buildQuery(params);
      const response = await this.get<{
        data: {
          carts: CartData[];
          pagination: CartPagination;
        };
      }>(`admin/cart${query}`);

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: CartService.fromHttpError(error, 'Failed to fetch admin carts.'),
      };
    }
  }

  async getAdminCartById(cartId: string): Promise<ServiceResult<CartData>> {
    const normalizedCartId = cartId.trim();
    if (!normalizedCartId) {
      return { success: false, message: 'Cart id is required.' };
    }

    try {
      const response = await this.get<{ data: { cart: CartData } }>(
        `admin/cart/${encodeURIComponent(normalizedCartId)}`
      );

      return { success: true, data: response.data.cart };
    } catch (error) {
      return {
        success: false,
        message: CartService.fromHttpError(error, 'Failed to fetch admin cart.', {
          404: 'Cart not found.',
        }),
      };
    }
  }

  async updateAdminCartStatus(
    cartId: string,
    data: UpdateAdminCartStatusInput
  ): Promise<ServiceResult<CartData>> {
    const normalizedCartId = cartId.trim();
    if (!normalizedCartId) {
      return { success: false, message: 'Cart id is required.' };
    }

    const validation = CartService.validate(admin_cart_status_schema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.patch<{ data: { cart: CartData } }>(
        `admin/cart/${encodeURIComponent(normalizedCartId)}`,
        validation.data
      );

      return { success: true, data: response.data.cart };
    } catch (error) {
      return {
        success: false,
        message: CartService.fromHttpError(error, 'Failed to update admin cart status.', {
          404: 'Cart not found.',
        }),
      };
    }
  }

  async deleteAdminCart(cartId: string): Promise<ServiceResult<{ deleted: boolean }>> {
    const normalizedCartId = cartId.trim();
    if (!normalizedCartId) {
      return { success: false, message: 'Cart id is required.' };
    }

    try {
      const response = await this.delete<{ data: { deleted: boolean } }>(
        `admin/cart/${encodeURIComponent(normalizedCartId)}`
      );

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: CartService.fromHttpError(error, 'Failed to delete admin cart.', {
          404: 'Cart not found.',
          409: 'Active carts with items cannot be deleted yet.',
        }),
      };
    }
  }

  async previewAbandonedCarts(params?: PreviewAbandonedCartsParams): Promise<
    ServiceResult<{
      candidateCount: number;
      idleMinutesThreshold: number;
      carts: CartData[];
    }>
  > {
    try {
      const query = this.buildQuery(params);
      const response = await this.get<{
        data: {
          candidateCount: number;
          idleMinutesThreshold: number;
          carts: CartData[];
        };
      }>(`admin/cart/abandoned${query}`);

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: CartService.fromHttpError(error, 'Failed to preview abandoned carts.'),
      };
    }
  }

  async sweepAbandonedCarts(data: SweepAbandonedCartsInput = {}): Promise<
    ServiceResult<{
      dryRun?: boolean;
      candidateCount?: number;
      carts?: CartData[];
      processedCount?: number;
      notified?: number;
      failed?: number;
      results?: AdminAbandonedCartSweepResult[];
    }>
  > {
    const validation = CartService.validate(abandoned_cart_sweep_schema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.post<{
        data: {
          dryRun?: boolean;
          candidateCount?: number;
          carts?: CartData[];
          processedCount?: number;
          notified?: number;
          failed?: number;
          results?: AdminAbandonedCartSweepResult[];
        };
      }>('admin/cart/abandoned', validation.data);

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: CartService.fromHttpError(error, 'Failed to run abandoned cart sweep.'),
      };
    }
  }
}

export const cartService = new CartService();
