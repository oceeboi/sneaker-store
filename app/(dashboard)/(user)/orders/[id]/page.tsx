'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrderByOrderNumberQuery } from '@/hooks/order.hook';
import { OrderStatus, UserOrderDetailData } from '@/services/order.service';
import { format_currency } from '@/utils/format';

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

function format_date(value: Date | string) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function format_status(status: OrderStatus) {
  return status.replaceAll('_', ' ');
}

function OrderItemRow({ order }: { order: UserOrderDetailData }) {
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

function OrderItemCards({ order }: { order: UserOrderDetailData }) {
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

export default function OrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const order_number = decodeURIComponent(params?.id ?? '').trim();

  const {
    data: order,
    isLoading: is_order_loading,
    error,
  } = useOrderByOrderNumberQuery(order_number);

  return (
    <section className="flex flex-col gap-6">
      <section className="rounded border bg-white/90 p-5 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Order details</p>
            <h3 className="text-[24px] font-medium text-[#1d2128]">
              {order?.orderNumber ?? order_number ?? 'Order'}
            </h3>
            <p className="text-sm text-neutral-500">
              Review your order items, totals, and delivery info.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {order ? (
              <Badge variant={STATUS_BADGE_VARIANT[order.status]} className="capitalize">
                {format_status(order.status)}
              </Badge>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/orders">Back to orders</Link>
            </Button>
          </div>
        </div>

        {is_order_loading ? (
          <div className="grid gap-4">
            <div className="h-20 animate-pulse rounded border border-neutral-200 bg-neutral-100" />
            <div className="h-52 animate-pulse rounded border border-neutral-200 bg-neutral-100" />
            <div className="h-36 animate-pulse rounded border border-neutral-200 bg-neutral-100" />
          </div>
        ) : null}

        {!is_order_loading && error ? (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        ) : null}

        {!is_order_loading && !order && !error ? (
          <div className="rounded border border-dashed border-neutral-300 bg-white p-8 text-center">
            <h4 className="text-lg font-semibold text-neutral-900">Order not found</h4>
            <p className="mt-2 text-sm text-neutral-500">
              We could not find this order number in your account.
            </p>
          </div>
        ) : null}

        {order ? (
          <div className="space-y-6">
            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Summary
              </h4>

              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Placed</dt>
                  <dd className="mt-1 text-sm text-neutral-800">{format_date(order.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Subtotal</dt>
                  <dd className="mt-1 text-sm text-neutral-800">
                    {format_currency(order.subtotal)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Shipping Fee</dt>
                  <dd className="mt-1 text-sm text-neutral-800">
                    {format_currency(order.shippingFee)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Discount</dt>
                  <dd className="mt-1 text-sm text-neutral-800">
                    {format_currency(order.discount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Total</dt>
                  <dd className="mt-1 text-base font-semibold text-neutral-900">
                    {format_currency(order.total)}
                  </dd>
                </div>
                {order.transactionId ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">
                      Transaction
                    </dt>
                    <dd className="mt-1 break-all text-sm text-neutral-800">
                      {order.transactionId}
                    </dd>
                  </div>
                ) : null}
                {order.cancelReason ? (
                  <div className="sm:col-span-2 lg:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">
                      Cancellation note
                    </dt>
                    <dd className="mt-1 text-sm text-neutral-800">{order.cancelReason}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Items
              </h4>
              <OrderItemCards order={order} />
              <OrderItemRow order={order} />
            </section>

            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Shipping address
              </h4>
              <div className="text-sm leading-6 text-neutral-800">
                <p className="font-medium text-neutral-900">
                  {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                </p>
                <p>{order.shippingAddress.phone}</p>
                <p>{order.shippingAddress.street}</p>
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state}
                </p>
                <p>{order.shippingAddress.country}</p>
                {order.shippingAddress.postalCode ? (
                  <p>{order.shippingAddress.postalCode}</p>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </section>
  );
}
