'use client';
import { admin_order_columns } from '@/components/react-table-columns/admin';
import { Input } from '@/components/shared/form';
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useAdminOrdersQuery } from '@/hooks/order.hook';
import { AdminOrderSummaryData, OrderStatus } from '@/services/order.service';
import { format_currency } from '@/utils/format';
import { flexRender, getCoreRowModel, PaginationState, useReactTable } from '@tanstack/react-table';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

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

const ORDER_STATUS_FILTER_OPTIONS: Array<{ label: string; value: OrderStatus | 'all' }> = [
  { label: 'All statuses', value: 'all' },
  { label: 'Pending payment', value: 'pending_payment' },
  { label: 'Paid', value: 'paid' },
  { label: 'Processing', value: 'processing' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Refunded', value: 'refunded' },
];

function get_user_label(order: AdminOrderSummaryData) {
  if (!order.user) return 'Guest checkout';
  return order.user.username?.trim() || order.user.email?.trim() || 'Unnamed user';
}

function get_visible_pages(currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 'ellipsis', totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}

function OrderCard({ order }: { order: AdminOrderSummaryData }) {
  const has_transaction = Boolean(order.transactionId);

  return (
    <article className="rounded border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Order</p>
          <p className="text-sm font-semibold text-neutral-900">{order.orderNumber}</p>
          <p className="text-xs text-neutral-500">{get_user_label(order)}</p>
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
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Payment</dt>
          <dd className="mt-1">
            <Badge variant={has_transaction ? 'secondary' : 'outline'}>
              {has_transaction ? 'Recorded' : 'Pending'}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Total</dt>
          <dd className="mt-1 font-semibold text-neutral-900">{format_currency(order.total)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Updated</dt>
          <dd className="mt-1 text-neutral-700">{format_date(order.updatedAt)}</dd>
        </div>
      </dl>

      {order.cancelReason ? (
        <p className="mt-3 rounded bg-red-50 px-2.5 py-2 text-xs text-red-700">
          Cancel reason: {order.cancelReason}
        </p>
      ) : null}

      <div className="mt-4">
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/admin/orders/${encodeURIComponent(order.id)}`}>View Order</Link>
        </Button>
      </div>
    </article>
  );
}

export default function AdminOrdersPage() {
  const [search_query, set_search_query] = useState('');
  const [status_filter, set_status_filter] = useState<OrderStatus | 'all'>('all');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const debounced_search_query = useDebouncedValue(search_query, 350);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debounced_search_query, status_filter, pagination.pageSize]);

  const query_params = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...(debounced_search_query.trim()
        ? { orderNumber: debounced_search_query.trim() }
        : undefined),
      ...(status_filter !== 'all' ? { status: status_filter } : undefined),
    }),
    [debounced_search_query, pagination.pageIndex, pagination.pageSize, status_filter]
  );

  const {
    data: admin_orders_view,
    isLoading: is_orders_loading,
    isFetching: is_orders_fetching,
  } = useAdminOrdersQuery(query_params);

  const data_orders: AdminOrderSummaryData[] = admin_orders_view?.orders ?? [];
  const server_pagination = admin_orders_view?.pagination;
  const current_page = server_pagination?.page ?? pagination.pageIndex + 1;
  const total_pages = Math.max(server_pagination?.totalPages ?? 1, 1);
  const page_size = server_pagination?.limit ?? pagination.pageSize;
  const has_previous_page = server_pagination?.hasPreviousPage ?? current_page > 1;
  const has_next_page = server_pagination?.hasNextPage ?? current_page < total_pages;

  const page_start = data_orders.length === 0 ? 0 : (current_page - 1) * page_size + 1;
  const total_orders = server_pagination?.total ?? data_orders.length;
  const page_end =
    data_orders.length === 0 ? 0 : Math.min(page_start + data_orders.length - 1, total_orders);
  const visible_pages = get_visible_pages(current_page, total_pages);

  const table = useReactTable({
    data: data_orders,
    columns: admin_order_columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: total_pages,
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
  });

  function go_to_page(nextPage: number) {
    if (nextPage < 1 || nextPage > total_pages || nextPage === current_page) return;
    setPagination((prev) => ({ ...prev, pageIndex: nextPage - 1 }));
  }

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
          <p className="mt-1 text-xs text-neutral-500">
            Showing {page_start}-{page_end} of {total_orders}
          </p>
        </div>

        <div className="mb-5 grid gap-3 rounded border border-neutral-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
              Search Order Number
            </label>
            <Input
              value={search_query}
              onChange={(event) => set_search_query(event.target.value)}
              placeholder="Search by order number"
              className="py-2.5"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
              Status
            </label>
            <select
              value={status_filter}
              onChange={(event) => set_status_filter(event.target.value as OrderStatus | 'all')}
              className="w-full rounded border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all duration-200 hover:border-gray-300 focus:border-black focus:ring-2 focus:ring-black/30"
            >
              {ORDER_STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
              Per Page
            </label>
            <select
              value={pagination.pageSize}
              onChange={(event) => {
                const nextSize = Number(event.target.value);
                setPagination({ pageIndex: 0, pageSize: nextSize });
              }}
              className="w-full rounded border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all duration-200 hover:border-gray-300 focus:border-black focus:ring-2 focus:ring-black/30"
            >
              {[10, 20, 30, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
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

              <Pagination className="border-t border-neutral-200 px-4 py-3">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        if (!has_previous_page) return;
                        go_to_page(current_page - 1);
                      }}
                      className={!has_previous_page ? 'pointer-events-none opacity-50' : undefined}
                    />
                  </PaginationItem>

                  {visible_pages.map((page, index) => {
                    if (page === 'ellipsis') {
                      return (
                        <PaginationItem key={`ellipsis-${index}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                    }

                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          isActive={page === current_page}
                          onClick={(event) => {
                            event.preventDefault();
                            go_to_page(page);
                          }}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        if (!has_next_page) return;
                        go_to_page(current_page + 1);
                      }}
                      className={!has_next_page ? 'pointer-events-none opacity-50' : undefined}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </>
        ) : null}

        {is_orders_fetching && !is_orders_loading ? (
          <p className="mt-3 text-xs text-neutral-500">Refreshing results...</p>
        ) : null}
      </section>
    </section>
  );
}
