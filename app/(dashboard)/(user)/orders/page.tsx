'use client';

import { order_columns } from '@/components/react-table-columns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOrdersQuery } from '@/hooks/order.hook';
import { OrderSummaryData, OrderStatus } from '@/services/order.service';
import Link from 'next/link';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
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

function OrderCard({ order }: { order: OrderSummaryData }) {
  return (
    <article className="rounded border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Order</p>
          <p className="text-sm font-semibold text-neutral-900">{order.orderNumber}</p>
        </div>
        <Badge variant={STATUS_BADGE_VARIANT[order.status]} className="capitalize">
          {format_status(order.status)}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Placed</dt>
          <dd className="mt-1 text-neutral-700">{format_date(order.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Total</dt>
          <dd className="mt-1 font-semibold text-neutral-900">{format_currency(order.total)}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/orders?id=${order.id}`}>View Order</Link>
        </Button>
      </div>
    </article>
  );
}

export default function OrdersPage() {
  const { data: orders, isLoading: is_orders_loading } = useOrdersQuery({});

  const data_orders: OrderSummaryData[] = orders?.orders ?? [];
  const table = useReactTable({
    data: data_orders,
    columns: order_columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const total_orders = orders?.pagination.total ?? data_orders.length;

  return (
    <section className="flex flex-col gap-6">
      <section className="rounded border bg-white/90 p-5 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-2">
          <h3 className="text-[24px] font-medium text-[#1d2128]">My Orders</h3>
          <p className="text-sm text-neutral-500">
            Track recent purchases and check each order status from one place.
          </p>
        </div>

        <div className="mb-5 rounded border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-sm text-neutral-600">
            Total Orders: <span className="font-semibold text-neutral-900">{total_orders}</span>
          </p>
        </div>

        {is_orders_loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`order-skeleton-${index}`}
                className="h-36 animate-pulse rounded border border-neutral-200 bg-neutral-100"
              />
            ))}
          </div>
        ) : null}

        {!is_orders_loading && data_orders.length === 0 ? (
          <div className="rounded border border-dashed border-neutral-300 bg-white p-8 text-center">
            <h4 className="text-lg font-semibold text-neutral-900">No orders yet</h4>
            <p className="mt-2 text-sm text-neutral-500">
              Once you place an order, it will appear here with status and total.
            </p>
          </div>
        ) : null}

        {!is_orders_loading && data_orders.length > 0 ? (
          <>
            <div className="grid gap-3 lg:hidden">
              {data_orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>

            <div className="hidden rounded border border-neutral-200 lg:block">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow
                      key={headerGroup.id}
                      className="bg-neutral-50/80 hover:bg-neutral-50/80"
                    >
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="px-4 py-3">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>

                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-neutral-50/60">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-4 py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : null}
      </section>
    </section>
  );
}
