'use client';

import Link from 'next/link';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

import { transaction_columns } from '@/components/react-table-columns';
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
import { useTransactionsQuery } from '@/hooks/transaction.hook';
import { TransactionData, TransactionStatus } from '@/services/transaction.service';
import { format_currency } from '@/utils/format';

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

function TransactionCard({ transaction }: { transaction: TransactionData }) {
  return (
    <article className="rounded border border-neutral-200 bg-white p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Reference</p>
          <p className="break-all text-sm font-semibold text-neutral-900">
            {transaction.reference}
          </p>
        </div>
        <Badge variant={STATUS_BADGE_VARIANT[transaction.status]} className="capitalize">
          {transaction.status}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Date</dt>
          <dd className="mt-1 text-neutral-700">{format_date(transaction.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Amount</dt>
          <dd className="mt-1 font-semibold text-neutral-900">
            {format_currency(transaction.amount)}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/transactions/${encodeURIComponent(transaction.reference)}`}>
            View Transaction
          </Link>
        </Button>
      </div>
    </article>
  );
}

export default function TransactionPage() {
  const { data: transactions, isLoading: is_transactions_loading } = useTransactionsQuery({});

  const data_transactions: TransactionData[] = transactions?.transactions ?? [];
  const table = useReactTable({
    data: data_transactions,
    columns: transaction_columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const total_transactions = transactions?.pagination.total ?? data_transactions.length;

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
          </>
        ) : null}
      </section>
    </section>
  );
}
