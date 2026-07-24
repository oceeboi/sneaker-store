import http from '@/lib/ky';
import { HTTPError } from 'ky';
import { z } from 'zod';

export type OrderStatus =
  'pending_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export type OrderListUser = {
  id: string;
  email?: string | null;
  username?: string | null;
  role?: string | null;
  status?: string | null;
};

export type AdminOrderItem = {
  productId: string;
  productName: string;
  sizeId: string;
  size: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type UserOrderItem = {
  productId: string;
  productName: string;
  sizeId: string;
  size: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type UserOrderShippingAddress = {
  addressId: string | null;
  label: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string | null;
};

export type OrderSummaryData = {
  id: string;
  orderNumber: string;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  currency: string;
  status: OrderStatus;
  transactionId: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminOrderSummaryData = OrderSummaryData & {
  user: OrderListUser | null;
};

export type AdminOrderDetailData = AdminOrderSummaryData & {
  items: AdminOrderItem[];
  shippingAddress: UserOrderShippingAddress;
};

export type UserOrderDetailData = OrderSummaryData & {
  items: UserOrderItem[];
  shippingAddress: UserOrderShippingAddress;
};

export type OrderPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type GetOrdersParams = {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  from?: Date | string;
  to?: Date | string;
  orderNumber?: string;
};

export type GetAdminOrdersParams = GetOrdersParams & {
  userId?: string;
};

export type UpdateAdminOrderInput = {
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  reason?: string;
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

const update_admin_order_schema = z.object({
  status: z.enum(['processing', 'shipped', 'delivered', 'cancelled']),
  reason: z.string().trim().min(3).max(300).optional(),
});

export class OrderService {
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
      return { success: false, message: OrderService.fromValidationError(parsed.error) };
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

  private normalizeQueryDates<T extends { from?: Date | string; to?: Date | string }>(params?: T) {
    if (!params) return undefined;

    return {
      ...params,
      from: params.from instanceof Date ? params.from.toISOString() : params.from,
      to: params.to instanceof Date ? params.to.toISOString() : params.to,
    };
  }

  private async get<T>(path: string): Promise<T> {
    const response = await http.get(path, { timeout: REQUEST_TIMEOUT_MS });
    return response.json() as Promise<T>;
  }

  private async patch<T>(path: string, body?: unknown): Promise<T> {
    const response = await http.patch(path, {
      timeout: REQUEST_TIMEOUT_MS,
      ...(body !== undefined && { json: body }),
    });
    return response.json() as Promise<T>;
  }

  private async delete<T>(path: string): Promise<T> {
    const response = await http.delete(path, { timeout: REQUEST_TIMEOUT_MS });
    return response.json() as Promise<T>;
  }

  async getOrders(
    params?: GetOrdersParams
  ): Promise<ServiceResult<{ orders: OrderSummaryData[]; pagination: OrderPagination }>> {
    try {
      const query = this.buildQuery(this.normalizeQueryDates(params));
      const response = await this.get<{
        data: {
          orders: OrderSummaryData[];
          pagination: OrderPagination;
        };
      }>(`orders${query}`);

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: OrderService.fromHttpError(error, 'Failed to fetch orders.'),
      };
    }
  }

  async getOrderById(orderId: string): Promise<ServiceResult<OrderSummaryData>> {
    const normalizedOrderId = orderId.trim();
    if (!normalizedOrderId) {
      return { success: false, message: 'Order id is required.' };
    }

    try {
      const query = this.buildQuery({ id: normalizedOrderId });
      const response = await this.get<{ data: { order: OrderSummaryData } }>(`orders${query}`);
      return { success: true, data: response.data.order };
    } catch (error) {
      return {
        success: false,
        message: OrderService.fromHttpError(error, 'Failed to fetch order.', {
          404: 'Order not found.',
        }),
      };
    }
  }

  async getOrderByOrderNumber(orderNumber: string): Promise<ServiceResult<UserOrderDetailData>> {
    const normalized_order_number = orderNumber.trim();
    if (!normalized_order_number) {
      return { success: false, message: 'Order number is required.' };
    }

    try {
      const response = await this.get<{ data: { order: UserOrderDetailData } }>(
        `orders/${encodeURIComponent(normalized_order_number)}`
      );
      return { success: true, data: response.data.order };
    } catch (error) {
      return {
        success: false,
        message: OrderService.fromHttpError(error, 'Failed to fetch order details.', {
          404: 'Order not found.',
        }),
      };
    }
  }

  async getAdminOrders(
    params?: GetAdminOrdersParams
  ): Promise<ServiceResult<{ orders: AdminOrderSummaryData[]; pagination: OrderPagination }>> {
    try {
      const query = this.buildQuery(this.normalizeQueryDates(params));
      const response = await this.get<{
        data: {
          orders: AdminOrderSummaryData[];
          pagination: OrderPagination;
        };
      }>(`admin/orders${query}`);

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: OrderService.fromHttpError(error, 'Failed to fetch admin orders.'),
      };
    }
  }

  async getAdminOrderById(orderId: string): Promise<ServiceResult<AdminOrderDetailData>> {
    const normalizedOrderId = orderId.trim();
    if (!normalizedOrderId) {
      return { success: false, message: 'Order id is required.' };
    }

    try {
      const response = await this.get<{ data: { order: AdminOrderDetailData } }>(
        `admin/orders/${encodeURIComponent(normalizedOrderId)}`
      );

      return { success: true, data: response.data.order };
    } catch (error) {
      return {
        success: false,
        message: OrderService.fromHttpError(error, 'Failed to fetch admin order.', {
          404: 'Order not found.',
        }),
      };
    }
  }

  async updateAdminOrder(
    orderId: string,
    data: UpdateAdminOrderInput
  ): Promise<ServiceResult<AdminOrderDetailData | null>> {
    const normalizedOrderId = orderId.trim();
    if (!normalizedOrderId) {
      return { success: false, message: 'Order id is required.' };
    }

    const validation = OrderService.validate(update_admin_order_schema, data);
    if (!validation.success) return validation;

    try {
      const response = await this.patch<{ data: { order: AdminOrderDetailData | null } }>(
        `admin/orders/${encodeURIComponent(normalizedOrderId)}`,
        validation.data
      );

      return { success: true, data: response.data.order };
    } catch (error) {
      return {
        success: false,
        message: OrderService.fromHttpError(error, 'Failed to update admin order.', {
          404: 'Order not found.',
          409: 'The requested order status transition is not allowed.',
        }),
      };
    }
  }

  async deleteAdminOrder(orderId: string): Promise<ServiceResult<{ deleted: boolean }>> {
    const normalizedOrderId = orderId.trim();
    if (!normalizedOrderId) {
      return { success: false, message: 'Order id is required.' };
    }

    try {
      const response = await this.delete<{ data: { deleted: boolean } }>(
        `admin/orders/${encodeURIComponent(normalizedOrderId)}`
      );

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: OrderService.fromHttpError(error, 'Failed to delete admin order.', {
          404: 'Order not found.',
          409: 'Only cancelled orders without successful payment records can be deleted.',
        }),
      };
    }
  }
}

export const orderService = new OrderService();
