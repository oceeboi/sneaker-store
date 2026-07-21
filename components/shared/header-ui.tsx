'use client';
import { useOrdersQuery } from '@/hooks/order.hook';
import { useTransactionsQuery } from '@/hooks/transaction.hook';
import { useAccountQuery, useUserQuery } from '@/hooks/user.hook';
import { format_currency } from '@/utils/format';
import { Typewriter } from './typewritter-effect';
import { AnimatedCounter } from './animated-counter';
import { SneakerGraffitiHeroArt } from './graffit-ui';
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@/components/ui/avatar';

export function HeaderBox() {
  const { data: account } = useAccountQuery();
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
      <div className="py-6.25 px-5 flex justify-between  lg:flex-row gap-5 text-white lg:rounded bg-black">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <div className="h-15 w-15 flex items-center uppercase  justify-center rounded-full  ">
              <Avatar className="h-15 w-15">
                <AvatarImage
                  src={user?.profile?.avatar ?? ''}
                  alt="profile-picture"
                  className="grayscale"
                />
                <AvatarFallback className="bg-linear-to-bl from-[#f44f22] font-bold text-[20px] to-[#fafa1a] text-white">
                  {user?.username[0]}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex flex-col gap-2  items-start">
              <h4 className="text-[20px] font-bold lowercase">{user?.username}</h4>
              <p className="text-xs text-gray-300">{user?.email}</p>
              <span className="text-[11px] bg-[#d97706] py-1 px-3 rounded capitalize font-bold">
                {account?.tier ? account.tier : 'member'}
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
                <AnimatedCounter
                  from={0}
                  to={user_total_successful_transactions} // 75,000,000 kobo = ₦750,000
                  duration={2.5} // Takes 2.5 seconds to finish
                  formatter={format_currency}
                />
              </h4>
              <p className="uppercase text-xs text-white/70">Spent</p>
            </div>
          </div>
        </div>
        <div className="max-w-[40%] hidden max-h-54.5">
          <SneakerGraffitiHeroArt />
        </div>
      </div>
    </div>
  );
}
