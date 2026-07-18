'use client';
import { useOrdersQuery } from '@/hooks/order.hook';
import { useTransactionsQuery } from '@/hooks/transaction.hook';
import { useUserQuery } from '@/hooks/user.hook';
import { format_currency } from '@/utils/format';

export function HeaderBox() {
  const { data: user } = useUserQuery({});
  const { data: orders } = useOrdersQuery({});
  const { data: transactions } = useTransactionsQuery({});

  const user_total_successful_transactions: number =
    transactions?.transactions.reduce(
      (sum, t) => (t.status === 'success' ? sum + t.amount : sum),
      0
    ) || 0;
  return (
    <div>
      <div className="py-6.25 px-5 flex flex-col gap-5 text-white lg:rounded bg-black">
        <div className="flex items-start gap-3">
          <div className="h-15 w-15 flex items-center uppercase font-bold text-[20px] justify-center rounded-full bg-linear-to-bl from-[#f44f22] to-[#fafa1a] ">
            <p>{user?.username[0]}</p>
          </div>
          <div className="flex flex-col gap-2  items-start">
            <h4 className="text-[20px] font-bold lowercase">{user?.username}</h4>
            <p className="text-xs text-gray-300">{user?.email}</p>
            <span className="text-[11px] bg-[#d97706] py-1 px-3 rounded capitalize font-bold">
              member
            </span>
          </div>
        </div>
        <div className="flex gap-15">
          <div className="flex flex-col items-start gap-4">
            <h4 className="text-[20px] font-bold">{orders?.pagination.total}</h4>
            <p className="uppercase text-xs text-white/70">Orders</p>
          </div>
          <div className="flex flex-col items-start gap-4">
            <h4 className="text-[20px] font-bold">
              {format_currency(user_total_successful_transactions)}
            </h4>
            <p className="uppercase text-xs text-white/70">Spent</p>
          </div>
        </div>
      </div>
    </div>
  );
}
