'use client';

import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef as use_ref, useState as use_state } from 'react';
import { JSX } from 'react/jsx-runtime';
import { useOnClickOutside } from '@/hooks/use-on-click-outside';

const Broswer_history_container = dynamic(() =>
  import('@/modules/browser-history/components/container/broswer-history').then(
    (module) => module.Broswer_history_container
  )
);

type NavigationType = {
  name: string;
  href: string;
  icon?: JSX.Element;
};

const navigation_items: NavigationType[] = [
  {
    name: 'Home',
    href: '/',
    icon: (
      <svg width={14} height={14} viewBox="0 0 32 32" fill="currentcolor">
        <path d="M29.44 17.227c0 7.413-6.027 13.44-13.44 13.44s-13.44-6.027-13.44-13.44c0-6.267 4.080-6.853 3.893-10.48 5.093 1.787 3.867 7.813 3.867 7.813 6.693-8.293 3.467-13.227 3.467-13.227s11.36 3.2 7.2 17.413c4.64-4.4 4.427-8.987 4.427-8.987s4.027 2.027 4.027 7.467z"></path>
      </svg>
    ),
  },
  {
    name: `What's new`,
    href: '/whats-new',
    icon: (
      <svg width={14} height={14} viewBox="0 0 32 32" fill="currentcolor">
        <path d="M27.36 3.52l1.307 2.16 2.16 1.307-2.16 1.307-1.307 2.133-1.307-2.133-2.133-1.307 2.133-1.307z"></path>
        <path d="M5.467 2.96l1.253 2.080 2.080 1.28-2.080 1.253-1.253 2.080-1.28-2.080-2.080-1.253 2.080-1.28z"></path>
        <path d="M19.76 0l0.64 1.013 1.013 0.613-1.013 0.64-0.64 1.013-0.613-1.013-1.013-0.64 1.013-0.613z"></path>
        <path d="M15.84 4.64l4.427 7.973 8.907 1.733-6.187 6.64 1.093 9.040-8.24-3.84-8.24 3.84 1.12-9.040-6.213-6.64 8.933-1.733z"></path>
      </svg>
    ),
  },
  {
    name: 'Start Shopping',
    href: '/shop',
    icon: (
      <svg width={14} height={14} viewBox="0 0 32 32" fill="currentcolor">
        <path d="M26.88 2.667h-10.373c-0.64 0-1.28 0.267-1.733 0.72l-11.387 11.387c-0.96 0.96-0.96 2.507 0 3.467l10.373 10.373c0.96 0.96 2.507 0.96 3.467 0l11.387-11.387c0.453-0.453 0.72-1.093 0.72-1.733v-10.373c0-1.36-1.093-2.453-2.453-2.453zM20.88 14.453c-1.84 0-3.333-1.493-3.333-3.333s1.493-3.333 3.333-3.333 3.333 1.493 3.333 3.333-1.467 3.333-3.333 3.333z"></path>
      </svg>
    ),
  },
  {
    name: 'Best Sellers',
    href: '/best-sellers',
    icon: (
      <svg width={14} height={14} viewBox="0 0 32 32" fill="currentcolor">
        <path d="M28.667 9.333c-1.84 0-3.333 1.493-3.333 3.333 0 0.48 0.133 0.96 0.32 1.36l-4.32 1.973-3.547-7.253c0.907-0.587 1.547-1.573 1.547-2.747 0-1.84-1.493-3.333-3.333-3.333s-3.333 1.493-3.333 3.333c0 1.173 0.64 2.133 1.547 2.747l-3.547 7.253-4.32-1.947c0.187-0.427 0.32-0.88 0.32-1.387 0-1.84-1.493-3.333-3.333-3.333s-3.333 1.493-3.333 3.333 1.493 3.333 3.333 3.333c0.24 0 0.427-0.080 0.667-0.133l2.667 13.467h18.667l2.693-13.467c0.213 0.053 0.4 0.133 0.64 0.133 1.84 0 3.333-1.493 3.333-3.333s-1.493-3.333-3.333-3.333z"></path>
      </svg>
    ),
  },
  {
    name: 'Contact Us',
    href: '/contact-us',
    icon: (
      <svg width={14} height={14} viewBox="0 0 32 32" fill="currentcolor">
        <path d="M21.333 2.667h-10.667c-4.427 0-8 3.573-8 8v10.667c0 4.427 3.573 8 8 8h10.667c4.427 0 8-3.573 8-8v-10.667c0-4.427-3.573-8-8-8zM10.667 8c1.467 0 2.667 1.2 2.667 2.667s-1.2 2.667-2.667 2.667-2.667-1.2-2.667-2.667c0-1.467 1.2-2.667 2.667-2.667zM10.453 23.787l-2.24-2.24 13.333-13.333 2.267 2.267-13.36 13.307zM21.333 24c-1.467 0-2.667-1.2-2.667-2.667s1.2-2.667 2.667-2.667 2.667 1.2 2.667 2.667c0 1.467-1.2 2.667-2.667 2.667z"></path>
      </svg>
    ),
  },
  { name: 'Wishlist', href: '/wishlist' },
];

export function Sub_Navigation_Ui() {
  const pathname = usePathname();
  const router = useRouter();
  const [is_browser_history_opened, set_is_browser_history_opened] = use_state<boolean>(false);
  const browser_history_ref = use_ref<HTMLDivElement>(null);

  useOnClickOutside(browser_history_ref, () => set_is_browser_history_opened(false));

  function toggole_browser_history() {
    set_is_browser_history_opened((current_state) => !current_state);
  }

  function is_active_link(href: string) {
    if (href === '/') {
      return pathname === '/';
    }

    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  return (
    <div ref={browser_history_ref} className="relative  bg-[#ffffff]">
      <div className="mx-auto flex w-full max-w-362.5 items-center justify-between gap-4 px-4 lg:px-6">
        <div
          className="min-w-0 flex-1 overflow-x-auto"
          style={{
            scrollbarWidth: 'none',
          }}
        >
          <div className="flex min-w-max items-center gap-1 py-2">
            {navigation_items.map((navigation) => {
              const is_active = is_active_link(navigation.href);

              return (
                <Link
                  key={navigation.href}
                  href={navigation.href}
                  onClick={() => set_is_browser_history_opened(false)}
                  className={cn(
                    'group relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150',
                    is_active
                      ? ' text-black shadow-sm'
                      : 'text-[#252a31] hover:bg-black/5 hover:text-black'
                  )}
                >
                  {navigation.icon ? <span className="text-current">{navigation.icon}</span> : null}
                  <span>{navigation.name}</span>
                  <span
                    className={cn(
                      'absolute inset-x-3 bottom-0.5 h-0.5 rounded-full transition-transform duration-150',
                      is_active ? 'scale-x-100 ' : 'scale-x-0 bg-black group-hover:scale-x-100'
                    )}
                  />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="relative hidden  shrink-0 items-center gap-2 lg:flex">
          <button
            type="button"
            onClick={toggole_browser_history}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-150',
              is_browser_history_opened
                ? 'bg-black text-white'
                : 'text-[#252a31] hover:bg-black/5 hover:text-black'
            )}
            aria-expanded={is_browser_history_opened}
            aria-haspopup="dialog"
          >
            <span>Browsing History</span>
            <ChevronDown
              className={cn(
                'size-4 transition-transform duration-150',
                is_browser_history_opened && 'rotate-180'
              )}
            />
          </button>

          <button
            type="button"
            onClick={() => {
              set_is_browser_history_opened(false);
              router.push('/tracking-order');
            }}
            className={cn(
              'group relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150',
              is_active_link('/tracking-order')
                ? ' text-black shadow-sm'
                : 'text-[#252a31] hover:bg-black/5 hover:text-black'
            )}
          >
            Track Order
            <span
              className={cn(
                'absolute inset-x-3 bottom-0.5 h-0.5 rounded-full transition-transform duration-150',
                is_active_link('/tracking-order')
                  ? 'scale-x-100 bg-black'
                  : 'scale-x-0 bg-black group-hover:scale-x-100'
              )}
            />
          </button>
        </div>
      </div>
      <div
        className={cn(
          'absolute right-0 top-full hidden lg:block w-full justify-center z-50  origin-top-right overflow-hidden  border border-black/8 bg-white  transition duration-150',
          is_browser_history_opened
            ? 'pointer-events-auto translate-y-0 opacity-100 scale-100'
            : 'pointer-events-none -translate-y-2 opacity-0 scale-[0.98]'
        )}
      >
        <div className="container pb-8 m-auto px-4">
          <div className="border-b border-black/6 px-5 py-5 flex w-full justify-between">
            <h1 className="text-[24px] font-medium">Browsing History</h1>
            <span className="mt-1 text-sm text-black font-medium underline">See All History</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <Broswer_history_container />
          </div>
        </div>
      </div>
    </div>
  );
}
