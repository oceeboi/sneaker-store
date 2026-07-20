'use client';
import { AnimatedCounter, TierGrid } from '@/components/shared';
import { STORE_DETAILS } from '@/constants/store-details';
import { useReferralQuery } from '@/hooks/user.hook';
import { format_currency } from '@/utils/format';
import { JSX, useCallback } from 'react';
import { toast } from 'sonner';

export default function RewardPage({}) {
  const details = STORE_DETAILS;

  const { data: referral } = useReferralQuery({});

  const referralData = getReferralProgress(referral?.pointsAvailable || 0);
  const copyClipboard = useCallback((text: string, type: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast.success(`${type} copied to clipboard`, {
          position: 'top-center',
        });
      },
      (err) => {
        toast.error(`Failed to copy text: ${err}`, {
          description: 'Please try again',
          position: 'top-center',
        });
      }
    );
  }, []);

  return (
    <section className="p-5 border rounded lg:p-8">
      <div className="p-10 mb-7.5 rounded-[8px] bg-[linear-gradient(135deg,#1a1a1a_0%,#2d2d2d_25%,#1a1a1a_50%,#2d2d2d_75%,#1a1a1a_100%)]">
        <div className="flex  mb-7.5 gap-6.25 items-center">
          <div className="w-14 h-14 bg-blue-400 rounded" />
          <div className="flex gap-1 flex-col ">
            <h4 className="bg-[linear-gradient(135deg,#d4af37_0%,#f4e4bc_50%,#d4af37_100%)] bg-clip-text text-transparent tracking-[0.5px] font-bold text-[24px]">
              {details.name}
            </h4>
            <p className="text-sm text-white/70 font-normal">
              Cycle starts with your first qualifying order
            </p>
          </div>
        </div>
        <div className="p-6.25 mb-7.5 rounded-xl text-white bg-[#ffffff0d] border border-[#ffffff1a]">
          <div className="flex mb-3.75 items-center justify-between">
            <h4 className="uppercase text-white/70 text-sm">Total Points:</h4>
            <h4 className="bg-[linear-gradient(135deg,#d4af37_0%,#f4e4bc_50%,#d4af37_100%)] bg-clip-text text-transparent tracking-[0.5px] font-bold text-[32px]">
              <AnimatedCounter from={0} to={referralData.point} />
            </h4>
          </div>

          <div className="flex flex-col gap-3.75">
            <span className="text-sm flex-wrap whitespace-pre-wrap text-[#ffffffcc]">
              {referralData.content}
            </span>
            <div className="relative  h-2.5 w-full bg-[#ffffff1a] rounded-full">
              <div
                className="h-full bg-[linear-gradient(135deg,#d4af37_0%,#f4e4bc_50%,#d4af37_100%)] rounded-[5px] transition-[width] duration-[0.8s] ease-in-out relative"
                style={{ width: `${referralData.widthPercentage}%` }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] animate-[shimmer_2s_infinite]" />
              </div>
            </div>
          </div>
        </div>
        <div className="mb-5">
          <h4 className="text-[#d4af37] text-sm font-bold tracking-wider">Your Benefits</h4>
        </div>
        <div className="flex flex-col lg:flex-row gap-4 w-full">
          {/* Card 1 */}
          <div className="w-full relative transform transition-all duration-300 ease-out hover:translate-x-2 lg:hover:translate-x-0 lg:hover:-translate-y-1">
            <div className="bg-[#ffffff0d] flex items-center border border-[#ffffff1a] rounded-xl px-4 py-3 transition-colors duration-300 hover:bg-[#d4af371a] hover:border-[#d4af3740] group">
              <p className="text-[#ffffffd9] flex items-center gap-2">
                <span className="text-[#d4af37] font-bold transition-transform duration-300 group-hover:scale-110">
                  ✓
                </span>
                Access to loyalty program
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="w-full relative transform transition-all duration-300 ease-out hover:translate-x-2 lg:hover:translate-x-0 lg:hover:-translate-y-1">
            <div className="bg-[#ffffff0d] flex items-center border border-[#ffffff1a] rounded-xl px-4 py-3 transition-colors duration-300 hover:bg-[#d4af371a] hover:border-[#d4af3740] group">
              <p className="text-[#ffffffd9] flex items-center gap-2">
                <span className="text-[#d4af37] font-bold transition-transform duration-300 group-hover:scale-110">
                  ✓
                </span>
                Referral rewards
              </p>
            </div>
          </div>
        </div>
      </div>
      <section className="flex flex-col gap-0 mb-7.5 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-md  rounded-[8px] overflow-hidden  lg:flex-row lg:items-center justify-center">
        <div className="px-7.5  flex flex-col items-center gap-2.5 py-10 bg-[linear-gradient(135deg,#1a1a1a_0%,#2d2d2d_25%,#1a1a1a_50%,#2d2d2d_75%,#1a1a1a_100%)]">
          <h3 className="text-[#fff9] text-2xl font-medium uppercase">Your Points</h3>
          <AnimatedCounter
            from={0}
            to={referralData.point}
            className="text-[64px] font-black bg-[linear-gradient(135deg,#d4af37_0%,#f4e4bc_50%,#d4af37_100%)] bg-clip-text text-transparent"
            duration={0.5}
          />
          <span className="text-base text-[#fff9] capitalize ">
            worth
            <AnimatedCounter
              from={0}
              to={referralData.pointWorth} // 75,000,000 kobo = ₦750,000
              duration={2.5} // Takes 2.5 seconds to finish
              formatter={format_currency}
              className="text-[#fff9] ml-1"
            />
          </span>
        </div>

        <div className="py-7.5 flex-1 bg-white px-10">
          <div className="py-7.5 rounded-[6px] bg-[linear-gradient(135deg,#f8f8f8_0%,#f0f0f0_100%)] flex flex-col gap-3 items-center justify-center">
            <h3 className="uppercase text-xs text-[#888]">Point Value</h3>
            <p className=" text-[24px] font-bold bg-[linear-gradient(135deg,#d4af37_0%,#f4e4bc_50%,#d4af37_100%)] bg-clip-text text-transparent">
              1 Point = {format_currency(3000)}
            </p>
          </div>
        </div>
      </section>
      <section className="bg-white p-8.75 mb-7.5 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-md rounded-[8px] ">
        <div>
          <h3 className="text-[24px] text-[#0d0d0d] mb-2 font-medium">Referral Program</h3>
          <p className="text-sm clear-both whitespace-normal flex-wrap text-[#666666] mt-3.5 mb-6.5">
            Share your code with friends. They get a discount on their first order, and you earn
            points!
          </p>
        </div>
        <div className="mb-5">
          <p className="text-[#888] text-[11px] uppercase mb-2.5 font-semibold tracking-wide">
            Your Referral Code:
          </p>
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="lg:py-5 flex-1 lg:px-6.25 py-4.5 px-5 flex items-center justify-center rounded-[12px]  bg-[linear-gradient(135deg,#1a1a1a_0%,#2d2d2d_25%,#1a1a1a_50%,#2d2d2d_75%,#1a1a1a_100%)] relative before:content-[''] before:absolute before:bottom-0 before:left-0 before:right-0 before:h-0.75 overflow-hidden before:bg-[linear-gradient(135deg,#d4af37_0%,#f4e4bc_50%,#d4af37_100%)]">
              <p className="text-white text-[22px] tracking-widest lg:text-[28px] font-extrabold">
                {referral?.referralCode}
              </p>
            </div>
            <button
              onClick={() => copyClipboard(`${referral?.referralCode}`, 'Referral Code')}
              className="py-5 px-6.25 rounded-[12px] bg-[linear-gradient(135deg,#d4af37_0%,#f4e4bc_50%,#d4af37_100%)]"
            >
              <p className="uppercase font-extrabold text-[#0d0d0d]">copy</p>
            </button>
          </div>
        </div>
        <div className="mb-7.5">
          <p className="text-[#888] text-[11px] uppercase mb-2.5 font-semibold tracking-wide">
            Or share this link:
          </p>
          <div className="h-15">
            <input
              readOnly
              type="url"
              value={`${details.domain}/?ref=${referral?.referralCode}`}
              className="text-[#1d2128] text-sm font-medium py-3 focus:border-2 focus:border-black rounded border-2 h-full px-5.5 w-full hover:border-black border-[#dadfe3]"
            />
          </div>
        </div>
        <div className="border-t-2 pt-6.25 flex flex-col gap-5 lg:flex-row border-t-[#f5f5f5]">
          <div className="p-5 rounded-[12px] flex items-center justify-center flex-col bg-[#fafafa] gap-2 w-full relative transform transition-all duration-300 ease-out hover:translate-y-1 lg:hover:translate-x-0 lg:hover:-translate-y-1">
            <span className="text-[36px] text-[#0d0d0d] font-extrabold ">
              {referral?.successfulReferrals}
            </span>
            <span className="text-xs uppercase text-[#888] font-semibold tracking-wide">
              Successful Referrals
            </span>
          </div>
          <div className="p-5 rounded-[12px] flex items-center justify-center flex-col bg-[#fafafa] gap-2 w-full relative transform transition-all duration-300 ease-out hover:translate-y-1 lg:hover:translate-x-0 lg:hover:-translate-y-1">
            <span className="text-[36px] text-[#0d0d0d] font-extrabold ">
              {referral?.pointsEarned}
            </span>
            <span className="text-xs text-[#888] uppercase font-semibold tracking-wide">
              Points Earned
            </span>
          </div>
          <div className="p-5 rounded-[12px] flex items-center justify-center flex-col bg-[#fafafa] gap-2 w-full relative transform transition-all duration-300 ease-out hover:translate-y-1 lg:hover:translate-x-0 lg:hover:-translate-y-1">
            <span className="text-[36px] text-[#0d0d0d] font-extrabold ">0</span>
            <span className="text-xs text-[#888] uppercase font-semibold tracking-wide">
              Pending
            </span>
          </div>
        </div>
      </section>
      <section className="hidden"></section>
      <section className="bg-white p-8.75 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-md rounded-[8px] ">
        <div className="mb-6.25">
          <h3 className="capitalize text-[24px] font-medium">{details.name} Circle Tiers </h3>
        </div>
        <TierGrid activeTier={referralData.tier} tiers={tier_content} />
      </section>
    </section>
  );
}

type TierName = 'basic' | 'silver' | 'gold' | 'platinum';

interface ReferralProgressData {
  pointWorth: number; // The total Naira value of their points
  content: string;
  widthPercentage: number;
  tier: TierName;
  point: number;
}

/**
 * Calculates referral rewards progress using raw Kobo values.
 * Rule: 1 point = 3000 kobo
 * @param points - Total referral points earned
 */
function getReferralProgress(points: number): ReferralProgressData {
  // 1 point = 3000 kobo
  const POINT_VALUE_KOBO = 3000;
  const totalKoboValue = points * POINT_VALUE_KOBO;

  let content = '';
  let widthPercentage = 0;
  let tier: TierName = 'basic';

  // Tier Thresholds explicitly mapped out in KOBO units
  const SILVER_TARGET_KOBO = 50000000; // ₦500,000
  const GOLD_TARGET_KOBO = 100000000; // ₦1,000,000
  const PLATINUM_TARGET_KOBO = 300000000; // ₦3,000,000

  if (totalKoboValue >= PLATINUM_TARGET_KOBO) {
    // --- PLATINUM TIER ---
    tier = 'platinum';
    widthPercentage = 100;
    content = 'You are at the VIP Platinum tier! Enjoy all exclusive rewards.';
  } else if (totalKoboValue >= GOLD_TARGET_KOBO) {
    // --- GOLD TIER ---
    tier = 'gold';
    const koboAway = PLATINUM_TARGET_KOBO - totalKoboValue;
    content = `Only ${format_currency(koboAway)} away from Platinum — unlock Free Nationwide Delivery`;

    // Progress calculation based completely on kobo thresholds
    widthPercentage = Math.round(
      ((totalKoboValue - GOLD_TARGET_KOBO) / (PLATINUM_TARGET_KOBO - GOLD_TARGET_KOBO)) * 100
    );
  } else if (totalKoboValue >= SILVER_TARGET_KOBO) {
    // --- SILVER TIER ---
    tier = 'silver';
    const koboAway = GOLD_TARGET_KOBO - totalKoboValue;
    content = `Only ${format_currency(koboAway)} away from Gold — unlock Free Delivery (Lagos)`;

    widthPercentage = Math.round(
      ((totalKoboValue - SILVER_TARGET_KOBO) / (GOLD_TARGET_KOBO - SILVER_TARGET_KOBO)) * 100
    );
  } else {
    // --- BRONZE TIER ---
    tier = 'basic';
    const koboAway = SILVER_TARGET_KOBO - totalKoboValue;
    content = `Only ${format_currency(koboAway)} away from Silver — unlock better rewards`;

    widthPercentage = Math.round((totalKoboValue / SILVER_TARGET_KOBO) * 100);
  }

  return {
    pointWorth: totalKoboValue, // Output value in KOBO
    content,
    widthPercentage,
    tier,
    point: points,
  };
}

// --- Example Usage ---
// User has 20,000 referral points (Worth: 20,000 * ₦30 = ₦600,000)

// example circle tiers

type Tier_content = {
  name: string;
  tier: TierName;
  benefits: string[];
  description: string;
  icon: JSX.Element;
};

const tier_content: Tier_content[] = [
  {
    name: 'Member',
    tier: 'basic',
    benefits: ['Access to loyalty program', 'Referral rewards'],
    description: 'Default',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6 text-amber-700"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    name: 'Silver',
    tier: 'silver',
    benefits: ['1 point per ₦1,000 spent', '5% Birthday Discount', 'Early Access to Sales'],
    description: '₦500,000 – ₦999,999',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6 text-slate-400"
      >
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    ),
  },
  {
    name: 'Gold',
    tier: 'gold',
    benefits: ['All Silver Benefits', 'Free Delivery (Lagos)', 'Priority Customer Support'],
    description: '₦1,000,000 – ₦2,999,999',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6 text-amber-500"
      >
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
        <path d="M12 2a4 4 0 0 1 4 4v6H8V6a4 4 0 0 1 4-4Z" />
      </svg>
    ),
  },
  {
    name: 'Platinum',
    tier: 'platinum',
    benefits: ['All Gold Benefits', 'Free Nationwide Delivery', 'VIP Badge on Profile'],
    description: '₦3,000,000+',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6 text-cyan-600"
      >
        <path d="M6 3h12l4 6-10 13L2 9Z" />
        <path d="M11 3 8 9l4 13 4-13-3-6" />
        <path d="M2 9h20" />
      </svg>
    ),
  },
];
