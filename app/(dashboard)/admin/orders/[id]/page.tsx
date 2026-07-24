'use client';

import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useAdminOrderQuery,
  useDeleteAdminOrderMutation,
  useUpdateAdminOrderMutation,
} from '@/hooks/order.hook';
import { AdminOrderDetailData, OrderStatus, UpdateAdminOrderInput } from '@/services/order.service';
import { format_currency } from '@/utils/format';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

const STATUS_BADGE_VARIANT: Record<
  OrderStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending_payment: 'outline',
  paid: 'secondary',
  processing: 'secondary',
  shipped: 'default',
  delivered: 'default',
  cancelled: 'destructive',
  refunded: 'destructive',
};

const NEXT_STATUS_OPTIONS: Record<OrderStatus, UpdateAdminOrderInput['status'][]> = {
  pending_payment: ['cancelled'],
  paid: ['processing'],
  processing: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
};

function format_date(value: Date | string) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function format_status(status: OrderStatus) {
  return status.replaceAll('_', ' ');
}

function format_user_status(status: string | null | undefined) {
  if (!status) return 'Unknown';
  return status.replaceAll('_', ' ');
}

function OrderUserInfo({ order }: { order: AdminOrderDetailData }) {
  const user = order.user;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Name</p>
        <p className="mt-1 text-sm font-medium text-neutral-900">
          {user?.username?.trim() || 'Guest checkout'}
        </p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Email</p>
        <p className="mt-1 wrap-break-word text-sm text-neutral-800">{user?.email || 'No email'}</p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Role</p>
        <p className="mt-1 text-sm text-neutral-800 capitalize">{user?.role || 'user'}</p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Account status</p>
        <p className="mt-1 text-sm text-neutral-800 capitalize">
          {format_user_status(user?.status)}
        </p>
      </div>
    </div>
  );
}

function OrderItemRow({ order }: { order: AdminOrderDetailData }) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-180">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-neutral-500">
              Product
            </th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-neutral-500">
              SKU
            </th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-neutral-500">
              Size
            </th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-neutral-500">
              Qty
            </th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wide text-neutral-500">
              Unit Price
            </th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wide text-neutral-500">
              Subtotal
            </th>
          </tr>
        </thead>

        <tbody>
          {order.items.map((item) => (
            <tr
              key={`${item.productId}-${item.sizeId}-${item.sku}`}
              className="border-b border-neutral-100"
            >
              <td className="px-4 py-3 text-sm font-medium text-neutral-900">{item.productName}</td>
              <td className="px-4 py-3 text-sm text-neutral-600">{item.sku}</td>
              <td className="px-4 py-3 text-sm text-neutral-700">{item.size}</td>
              <td className="px-4 py-3 text-sm text-neutral-700">{item.quantity}</td>
              <td className="px-4 py-3 text-right text-sm text-neutral-700">
                {format_currency(item.unitPrice)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-neutral-900">
                {format_currency(item.subtotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderItemCards({ order }: { order: AdminOrderDetailData }) {
  return (
    <div className="grid gap-3 lg:hidden">
      {order.items.map((item) => (
        <article
          key={`${item.productId}-${item.sizeId}-${item.sku}`}
          className="rounded border border-neutral-200 bg-white p-4"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <h4 className="text-sm font-semibold text-neutral-900">{item.productName}</h4>
            <p className="text-xs text-neutral-500">x{item.quantity}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">SKU</dt>
              <dd className="mt-1 text-neutral-700">{item.sku}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Size</dt>
              <dd className="mt-1 text-neutral-700">{item.size}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Unit Price</dt>
              <dd className="mt-1 text-neutral-700">{format_currency(item.unitPrice)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Subtotal</dt>
              <dd className="mt-1 font-semibold text-neutral-900">
                {format_currency(item.subtotal)}
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

export default function AdminOrderDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const order_id = decodeURIComponent(params?.id ?? '').trim();

  const {
    data: admin_order_view_by_id,
    isLoading: is_admin_order_loading,
    isFetching: is_admin_order_fetching,
    error: admin_error,
  } = useAdminOrderQuery(order_id);

  const [next_status, set_next_status] = useState<UpdateAdminOrderInput['status'] | ''>('');
  const [update_reason, set_update_reason] = useState('');

  const { mutate: admin_order_status_and_reason, isPending: is_admin_order_update_pending } =
    useUpdateAdminOrderMutation();

  const { mutate: delete_order, isPending: is_admin_order_delete_pending } =
    useDeleteAdminOrderMutation();

  const allowed_next_statuses = useMemo(() => {
    if (!admin_order_view_by_id) return [];
    return NEXT_STATUS_OPTIONS[admin_order_view_by_id.status];
  }, [admin_order_view_by_id]);

  useEffect(() => {
    set_next_status(allowed_next_statuses[0] ?? '');
    set_update_reason('');
  }, [allowed_next_statuses]);

  useEffect(() => {
    if (admin_error?.message) {
      toast.error(admin_error.message);
    }
  }, [admin_error?.message]);

  const can_delete_order = admin_order_view_by_id?.status === 'cancelled';

  function admin_onDelete() {
    if (!admin_order_view_by_id) {
      toast.error('Order is unavailable. Refresh and try again.');
      return;
    }

    const is_confirmed = window.confirm(
      'Delete this order permanently? This only works for cancelled orders without successful payments.'
    );
    if (!is_confirmed) return;

    delete_order(admin_order_view_by_id.id, {
      onSuccess: () => {
        toast.success('Order deleted successfully.');
        router.push('/admin/orders');
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to delete order.');
      },
    });
  }

  function admin_onUpdate() {
    if (!admin_order_view_by_id) {
      toast.error('Order is unavailable. Refresh and try again.');
      return;
    }

    if (!next_status) {
      toast.error('Choose a new status to continue.');
      return;
    }

    const reason = update_reason.trim();
    if (next_status === 'cancelled' && reason.length < 3) {
      toast.error('Provide a cancellation reason with at least 3 characters.');
      return;
    }

    const payload: { orderId: string; data: UpdateAdminOrderInput } = {
      orderId: admin_order_view_by_id.id,
      data: {
        status: next_status,
        ...(reason ? { reason } : undefined),
      },
    };

    admin_order_status_and_reason(payload, {
      onSuccess: () => {
        toast.success(`Order status updated to ${format_status(next_status)}.`);
        set_update_reason('');
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to update order status.');
      },
    });
  }

  return (
    <section className="flex flex-col gap-6">
      <section className="rounded border bg-white/90 p-5 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Order details</p>
            <h3 className="text-[24px] font-medium text-[#1d2128]">
              {admin_order_view_by_id?.orderNumber ?? order_id ?? 'Order'}
            </h3>
            <p className="text-sm text-neutral-500">
              Review order items, totals, and delivery info.
            </p>
          </div>

          {admin_order_view_by_id ? (
            <div className="grid gap-1 text-left sm:text-right">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Order ID</p>
              <p className="break-all text-xs text-neutral-700">{admin_order_view_by_id.id}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center mb-5 gap-2">
          {admin_order_view_by_id ? (
            <Badge
              variant={STATUS_BADGE_VARIANT[admin_order_view_by_id.status]}
              className="capitalize"
            >
              {format_status(admin_order_view_by_id.status)}
            </Badge>
          ) : null}

          {admin_order_view_by_id?.transactionId ? (
            <Badge variant="secondary">Payment recorded</Badge>
          ) : (
            <Badge variant="outline">Payment pending</Badge>
          )}

          <Button asChild variant="outline" size="sm">
            <Link href="/admin/orders">Back to orders</Link>
          </Button>
        </div>

        {is_admin_order_fetching && !is_admin_order_loading ? (
          <p className="mt-3 text-xs text-neutral-500">Refreshing order data...</p>
        ) : null}

        {is_admin_order_loading ? (
          <div className="grid gap-4">
            <div className="h-20 animate-pulse rounded border border-neutral-200 bg-neutral-100" />
            <div className="h-52 animate-pulse rounded border border-neutral-200 bg-neutral-100" />
            <div className="h-36 animate-pulse rounded border border-neutral-200 bg-neutral-100" />
          </div>
        ) : null}

        {!is_admin_order_loading && admin_error ? (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {admin_error?.message}
          </div>
        ) : null}

        {!is_admin_order_loading && !admin_order_view_by_id && !admin_error ? (
          <div className="rounded border border-dashed border-neutral-300 bg-white p-8 text-center">
            <h4 className="text-lg font-semibold text-neutral-900">Order not found</h4>
            <p className="mt-2 text-sm text-neutral-500">
              We could not find this order in the system.
            </p>
          </div>
        ) : null}

        {admin_order_view_by_id ? (
          <div className="space-y-6">
            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Admin actions
              </h4>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
                    Next status
                  </label>
                  <select
                    value={next_status}
                    onChange={(event) =>
                      set_next_status(event.target.value as UpdateAdminOrderInput['status'] | '')
                    }
                    disabled={allowed_next_statuses.length === 0 || is_admin_order_update_pending}
                    className="w-full rounded border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all duration-200 hover:border-gray-300 focus:border-black focus:ring-2 focus:ring-black/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {allowed_next_statuses.length === 0 ? (
                      <option value="">No further transitions</option>
                    ) : null}
                    {allowed_next_statuses.map((status) => (
                      <option key={status} value={status}>
                        {format_status(status)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
                    Reason (required for cancellation)
                  </label>
                  <textarea
                    value={update_reason}
                    onChange={(event) => set_update_reason(event.target.value)}
                    placeholder="Add note for this status change"
                    rows={3}
                    className="w-full rounded border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all duration-200 hover:border-gray-300 focus:border-black focus:ring-2 focus:ring-black/30"
                  />
                </div>

                <div className="flex  items-end gap-2 flex-col lg:items-stretch lg:justify-end">
                  <Button
                    onClick={admin_onUpdate}
                    disabled={!next_status || is_admin_order_update_pending}
                    className="w-full"
                  >
                    {is_admin_order_update_pending ? 'Updating...' : 'Update status'}
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={admin_onDelete}
                    disabled={!can_delete_order || is_admin_order_delete_pending}
                    className="w-full"
                  >
                    {is_admin_order_delete_pending ? 'Deleting...' : 'Delete order'}
                  </Button>
                </div>
              </div>

              <p className="mt-3 text-xs text-neutral-500">
                Deleting is only allowed for cancelled orders that have no successful payment
                record.
              </p>
            </section>

            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
                User info
              </h4>
              <OrderUserInfo order={admin_order_view_by_id} />
            </section>

            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Summary
              </h4>

              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Placed</dt>
                  <dd className="mt-1 text-sm text-neutral-800">
                    {format_date(admin_order_view_by_id.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Subtotal</dt>
                  <dd className="mt-1 text-sm text-neutral-800">
                    {format_currency(admin_order_view_by_id.subtotal)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Shipping Fee</dt>
                  <dd className="mt-1 text-sm text-neutral-800">
                    {format_currency(admin_order_view_by_id.shippingFee)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Discount</dt>
                  <dd className="mt-1 text-sm text-neutral-800">
                    {format_currency(admin_order_view_by_id.discount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Total</dt>
                  <dd className="mt-1 text-base font-semibold text-neutral-900">
                    {format_currency(admin_order_view_by_id.total)}
                  </dd>
                </div>
                {admin_order_view_by_id.transactionId ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">
                      Transaction
                    </dt>
                    <dd className="mt-1 break-all text-sm text-neutral-800">
                      {admin_order_view_by_id.transactionId}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Last updated</dt>
                  <dd className="mt-1 text-sm text-neutral-800">
                    {format_date(admin_order_view_by_id.updatedAt)}
                  </dd>
                </div>
                {admin_order_view_by_id.cancelReason ? (
                  <div className="sm:col-span-2 lg:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">
                      Cancellation note
                    </dt>
                    <dd className="mt-1 text-sm text-neutral-800">
                      {admin_order_view_by_id.cancelReason}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Items
              </h4>
              <OrderItemCards order={admin_order_view_by_id} />
              <OrderItemRow order={admin_order_view_by_id} />
            </section>

            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Shipping address
              </h4>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="text-sm leading-6 text-neutral-800">
                  <p className="font-medium text-neutral-900">
                    {admin_order_view_by_id.shippingAddress.firstName}{' '}
                    {admin_order_view_by_id.shippingAddress.lastName}
                  </p>
                  <p>{admin_order_view_by_id.shippingAddress.phone}</p>
                  <p>{admin_order_view_by_id.shippingAddress.street}</p>
                  <p>
                    {admin_order_view_by_id.shippingAddress.city},{' '}
                    {admin_order_view_by_id.shippingAddress.state}
                  </p>
                  <p>{admin_order_view_by_id.shippingAddress.country}</p>
                  {admin_order_view_by_id.shippingAddress.postalCode ? (
                    <p>{admin_order_view_by_id.shippingAddress.postalCode}</p>
                  ) : null}
                </div>

                <div className="space-y-2 text-sm text-neutral-800">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">
                      Address label
                    </p>
                    <p className="mt-1">{admin_order_view_by_id.shippingAddress.label || 'None'}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">Address ID</p>
                    <p className="mt-1 break-all text-xs text-neutral-700">
                      {admin_order_view_by_id.shippingAddress.addressId || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </section>
  );
}
