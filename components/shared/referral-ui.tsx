import React, { JSX } from 'react';

type TierName = 'basic' | 'silver' | 'gold' | 'platinum';

type Tier_content = {
  name: string;
  tier: TierName;
  benefits: string[];
  description: string;
  icon: JSX.Element;
};

// 1. Expanded style mapping to handle both standard hovers AND permanently active states
const tierStyles: Record<
  TierName,
  {
    border: string;
    bg: string;
    shadow: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  basic: {
    border: 'border-amber-700/30 md:hover:border-amber-700/40',
    bg: 'bg-[linear-gradient(180deg,rgba(180,83,9,0.04)_0%,#fff_100%)]',
    shadow: 'shadow-[0_12px_40px_rgba(180,83,9,0.1)]',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
  },
  silver: {
    border: 'border-slate-300 md:hover:border-slate-400',
    bg: 'bg-[linear-gradient(180deg,rgba(148,163,184,0.06)_0%,#fff_100%)]',
    shadow: 'shadow-[0_12px_40px_rgba(148,163,184,0.12)]',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
  },
  gold: {
    border: 'border-[#d4af37]/60 md:hover:border-[#d4af37]',
    bg: 'bg-[linear-gradient(180deg,rgba(212,175,55,0.05)_0%,#fff_100%)]',
    shadow: 'shadow-[0_12px_40px_rgba(212,175,55,0.18)]',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
  },
  platinum: {
    border: 'border-cyan-400 md:hover:border-cyan-500',
    bg: 'bg-[linear-gradient(180deg,rgba(6,182,212,0.05)_0%,#fff_100%)]',
    shadow: 'shadow-[0_12px_40px_rgba(6,182,212,0.15)]',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-800',
  },
};

interface TierGridProps {
  activeTier: TierName; // Pass the client's current active tier here (e.g., 'gold')
  tiers: Tier_content[];
}

export function TierGrid({ activeTier, tiers }: TierGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
      {tiers.map((tc, index) => {
        const isActive = tc.tier === activeTier;
        const style = tierStyles[tc.tier];

        return (
          <div
            key={index}
            className={`group relative flex flex-col items-center rounded-xl px-5 py-6 transition-all duration-300 ease-in-out 
              ${
                isActive
                  ? `${style.border} ${style.bg} ${style.shadow} scale-[1.02] z-10 ring-2 ring-offset-2 ${tc.tier === 'gold' ? 'ring-[#d4af37]/30' : 'ring-current/10'}`
                  : 'border border-gray-100 bg-white md:hover:-translate-y-1'
              }
              /* Apply styles on hover only if it's NOT the active card */
              ${!isActive && tc.tier === 'basic' ? 'md:hover:border-amber-700/40 md:hover:bg-[linear-gradient(180deg,rgba(180,83,9,0.04)_0%,#fff_100%)] md:hover:shadow-[0_12px_40px_rgba(180,83,9,0.12)]' : ''}
              ${!isActive && tc.tier === 'silver' ? 'md:hover:border-slate-400 md:hover:bg-[linear-gradient(180deg,rgba(148,163,184,0.06)_0%,#fff_100%)] md:hover:shadow-[0_12px_40px_rgba(148,163,184,0.15)]' : ''}
              ${!isActive && tc.tier === 'gold' ? 'md:hover:border-[#d4af37] md:hover:bg-[linear-gradient(180deg,rgba(212,175,55,0.05)_0%,#fff_100%)] md:hover:shadow-[0_12px_40px_rgba(212,175,55,0.2)]' : ''}
              ${!isActive && tc.tier === 'platinum' ? 'md:hover:border-cyan-500 md:hover:bg-[linear-gradient(180deg,rgba(6,182,212,0.05)_0%,#fff_100%)] md:hover:shadow-[0_12px_40px_rgba(6,182,212,0.18)]' : ''}
            `}
          >
            {/* Active Tier Pill Badge */}
            {isActive && (
              <span
                className={`absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm animate-fade-in ${style.badgeBg} ${style.badgeText}`}
              >
                Current Tier
              </span>
            )}

            {/* Icon Container */}
            <div
              className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg transition-colors duration-300 
              ${isActive ? 'bg-white shadow-sm border border-gray-50' : 'bg-gray-50 group-hover:bg-white'}`}
            >
              {tc.icon}
            </div>

            {/* Title & Description */}
            <h3 className="mb-1 text-center font-bold text-gray-900 text-lg tracking-tight flex items-center gap-1.5">
              {tc.name}
            </h3>
            <p
              className={`mb-5 text-center text-sm font-semibold ${isActive ? 'text-gray-500' : 'text-gray-400'}`}
            >
              {tc.description}
            </p>

            {/* Divider Line */}
            <div
              className={`mb-5 h-px w-full transition-colors ${isActive ? 'bg-gray-200/80' : 'bg-gray-100 group-hover:bg-gray-200/60'}`}
            />

            {/* Benefits List */}
            <ul className="flex w-full flex-1 flex-col gap-3 text-center text-xs font-medium text-gray-600">
              {tc.benefits.map((benefit, bIndex) => (
                <li key={bIndex} className="leading-relaxed">
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
