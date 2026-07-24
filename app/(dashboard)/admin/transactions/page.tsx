'use client';
import { admin_transaction_columns } from '@/components/react-table-columns/admin';
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
import { useAdminTransactionsQuery } from '@/hooks/transaction.hook';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { AdminTransactionData, TransactionStatus } from '@/services/transaction.service';
import { format_currency } from '@/utils/format';
import { flexRender, getCoreRowModel, PaginationState, useReactTable } from '@tanstack/react-table';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

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

const STATUS_BADGE_VARIANT: Record<
  TransactionStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'outline',
  success: 'secondary',
  failed: 'destructive',
  abandoned: 'destructive',
};

function format_date(value: Date | string) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function format_status(status: TransactionStatus) {
  return status.replaceAll('_', ' ');
}

function format_channel(channel: string | null) {
  if (!channel) return 'Unknown';
  return channel.replaceAll('_', ' ');
}

const TRANSACTION_STATUS_FILTER_OPTIONS: Array<{
  label: string;
  value: TransactionStatus | 'all';
}> = [
  { label: 'All statuses', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Success', value: 'success' },
  { label: 'Failed', value: 'failed' },
  { label: 'Abandoned', value: 'abandoned' },
];

function get_user_label(transaction: AdminTransactionData) {
  const user = transaction.user;
  if (!user) return 'Guest checkout';
  return user.username?.trim() || user.email?.trim() || 'Unnamed user';
}

function TransactionCard({ transaction }: { transaction: AdminTransactionData }) {
  return (
    <article className="rounded border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Reference</p>
          <p className="break-all text-sm font-semibold text-neutral-900">
            {transaction.reference}
          </p>
          <p className="text-xs text-neutral-500">{get_user_label(transaction)}</p>
        </div>
        <Badge variant={STATUS_BADGE_VARIANT[transaction.status]} className="capitalize">
          {format_status(transaction.status)}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Created</dt>
          <dd className="mt-1 text-neutral-700">{format_date(transaction.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Amount</dt>
          <dd className="mt-1 font-semibold text-neutral-900">
            {format_currency(transaction.amount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Channel</dt>
          <dd className="mt-1 capitalize text-neutral-700">
            {format_channel(transaction.channel)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Verified</dt>
          <dd className="mt-1 text-neutral-700">
            {transaction.verifiedAt ? format_date(transaction.verifiedAt) : 'Not verified'}
          </dd>
        </div>
      </dl>

      {transaction.failureReason ? (
        <p className="mt-3 rounded bg-red-50 px-2.5 py-2 text-xs text-red-700">
          Failure reason: {transaction.failureReason}
        </p>
      ) : null}

      <div className="mt-4">
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/admin/transactions/${encodeURIComponent(transaction.id)}`}>
            View Details
          </Link>
        </Button>
      </div>
    </article>
  );
}

export default function AdminTransactionPage() {
  const [search_query, set_search_query] = useState('');
  const [status_filter, set_status_filter] = useState<TransactionStatus | 'all'>('all');
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
      ...(debounced_search_query.trim() ? { reference: debounced_search_query.trim() } : undefined),
      ...(status_filter !== 'all' ? { status: status_filter } : undefined),
    }),
    [debounced_search_query, pagination.pageIndex, pagination.pageSize, status_filter]
  );

  const {
    data: admin_transactions,
    isLoading: is_transactions_loading,
    isFetching: is_transactions_fetching,
  } = useAdminTransactionsQuery(query_params);
  const data_transactions: AdminTransactionData[] = admin_transactions?.transactions ?? [];
  const server_pagination = admin_transactions?.pagination;
  const current_page = server_pagination?.page ?? pagination.pageIndex + 1;
  const total_pages = Math.max(server_pagination?.totalPages ?? 1, 1);
  const page_size = server_pagination?.limit ?? pagination.pageSize;
  const has_previous_page = server_pagination?.hasPreviousPage ?? current_page > 1;
  const has_next_page = server_pagination?.hasNextPage ?? current_page < total_pages;

  const page_start = data_transactions.length === 0 ? 0 : (current_page - 1) * page_size + 1;
  const total_transactions = server_pagination?.total ?? data_transactions.length;
  const page_end =
    data_transactions.length === 0
      ? 0
      : Math.min(page_start + data_transactions.length - 1, total_transactions);
  const visible_pages = get_visible_pages(current_page, total_pages);

  const table = useReactTable({
    data: data_transactions,
    columns: admin_transaction_columns,
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
          <h3 className="text-[24px] font-medium text-[#1d2128]">My Transactions</h3>
          <p className="text-sm text-neutral-500">
            Review all payment attempts and see each transaction status in one place.
          </p>
        </div>

        <div className="mb-5 rounded border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-sm text-neutral-600">
            Total Transactions:{' '}
            <span className="font-semibold text-neutral-900">{total_transactions}</span>
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Showing {page_start}-{page_end} of {total_transactions}
          </p>
        </div>

        <div className="mb-5 grid gap-3 rounded border border-neutral-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
              Search Reference
            </label>
            <Input
              value={search_query}
              onChange={(event) => set_search_query(event.target.value)}
              placeholder="Search by transaction reference"
              className="py-2.5"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
              Status
            </label>
            <select
              value={status_filter}
              onChange={(event) =>
                set_status_filter(event.target.value as TransactionStatus | 'all')
              }
              className="w-full rounded border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all duration-200 hover:border-gray-300 focus:border-black focus:ring-2 focus:ring-black/30"
            >
              {TRANSACTION_STATUS_FILTER_OPTIONS.map((option) => (
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

        {is_transactions_loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`transaction-skeleton-${index}`}
                className="h-36 animate-pulse rounded border border-neutral-200 bg-neutral-100"
              />
            ))}
          </div>
        ) : null}

        {!is_transactions_loading && data_transactions.length === 0 ? (
          <div className="rounded border border-dashed border-neutral-300 bg-white p-8 text-center">
            <h4 className="text-lg font-semibold text-neutral-900">No transactions yet</h4>
            <p className="mt-2 text-sm text-neutral-500">
              Your payment history will appear here after your first checkout attempt.
            </p>
          </div>
        ) : null}

        {!is_transactions_loading && data_transactions.length > 0 ? (
          <>
            <div className="grid gap-3 lg:hidden">
              {data_transactions.map((transaction) => (
                <TransactionCard key={transaction.id} transaction={transaction} />
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

            <Pagination className="rounded border border-neutral-200 bg-white px-3 py-3 sm:px-4">
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
          </>
        ) : null}

        {is_transactions_fetching && !is_transactions_loading ? (
          <p className="mt-3 text-xs text-neutral-500">Refreshing results...</p>
        ) : null}
      </section>
    </section>
  );
}
