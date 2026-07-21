'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { JSX, useState as use_state } from 'react';
import { Cart_Container } from '@/modules/cart';
import { Sheet } from '../shared/sheet';
import { useSession } from '@/lib/context/SessionContext';
import { useUserQuery } from '@/hooks/user.hook';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useRouter } from 'next/navigation';

type NavigationType = {
  name: string;
  href: string;
  icon?: JSX.Element;
  external?: boolean;
};

const bottom_mobile_navigation_items: NavigationType[] = [
  {
    name: 'Home',
    href: '/',
    icon: (
      <svg width="20" height="20" fill="currentColor" viewBox="0 0 32 32">
        <path d="M27.52 11.84l-9.6-7.2c-0.64-0.48-1.28-0.64-1.92-0.64s-1.28 0.16-1.92 0.64l-9.6 7.2c-0.8 0.64-1.28 1.6-1.28 2.56v11.2c0 1.76 1.44 3.2 3.2 3.2h19.2c1.76 0 3.2-1.44 3.2-3.2v-11.2c0-0.96-0.48-1.92-1.28-2.56zM25.6 25.6h-7.2v-4c0-1.28-1.12-2.4-2.4-2.4s-2.4 1.12-2.4 2.4v4h-7.2v-11.2l9.6-7.2 9.6 7.2v11.2z"></path>
      </svg>
    ),
  },
  {
    name: 'Shop',
    href: '/shop',
    icon: (
      <svg width="20" height="20" fill="currentColor" viewBox="0 0 32 32">
        <path d="M8.8 6.4c1.328 0 2.4 1.072 2.4 2.4s-1.072 2.4-2.4 2.4-2.4-1.072-2.4-2.4 1.072-2.4 2.4-2.4zM8.8 3.2c-3.088 0-5.6 2.512-5.6 5.6s2.512 5.6 5.6 5.6 5.6-2.512 5.6-5.6-2.512-5.6-5.6-5.6v0z"></path>
        <path d="M23.2 6.4c1.328 0 2.4 1.072 2.4 2.4s-1.072 2.4-2.4 2.4-2.4-1.072-2.4-2.4 1.072-2.4 2.4-2.4zM23.2 3.2c-3.088 0-5.6 2.512-5.6 5.6s2.512 5.6 5.6 5.6 5.6-2.512 5.6-5.6-2.512-5.6-5.6-5.6v0z"></path>
        <path d="M8.8 20.8c1.328 0 2.4 1.072 2.4 2.4s-1.072 2.4-2.4 2.4-2.4-1.072-2.4-2.4 1.072-2.4 2.4-2.4zM8.8 17.6c-3.088 0-5.6 2.512-5.6 5.6s2.512 5.6 5.6 5.6 5.6-2.512 5.6-5.6-2.512-5.6-5.6-5.6v0z"></path>
        <path d="M23.2 20.8c1.328 0 2.4 1.072 2.4 2.4s-1.072 2.4-2.4 2.4-2.4-1.072-2.4-2.4 1.072-2.4 2.4-2.4zM23.2 17.6c-3.088 0-5.6 2.512-5.6 5.6s2.512 5.6 5.6 5.6 5.6-2.512 5.6-5.6-2.512-5.6-5.6-5.6v0z"></path>
      </svg>
    ),
  },
];

const auth_navigationitems: NavigationType[] = [
  {
    name: 'Sign In',
    href: '/login',
    icon: (
      <>
        <svg
          width="20"
          height="20"
          aria-hidden="true"
          role="img"
          focusable="false"
          viewBox="0 0 32 32"
          fill="black"
        >
          <path d="M16 16c-4.064 0-6.4-2.336-6.4-6.4 0-3.536 2.864-6.4 6.4-6.4s6.4 2.864 6.4 6.4c0 4-2.4 6.4-6.4 6.4zM16 6.4c-1.76 0-3.2 1.44-3.2 3.2 0 2.272 0.928 3.2 3.2 3.2 2.24 0 3.2-0.96 3.2-3.2 0-1.76-1.44-3.2-3.2-3.2z"></path>
          <path d="M27.2 28.8h-22.4v-3.2c0-4.416 3.584-8 8-8h6.4c4.416 0 8 3.584 8 8v3.2zM8 25.6h16c0-2.64-2.16-4.8-4.8-4.8h-6.4c-2.64 0-4.8 2.16-4.8 4.8z"></path>
        </svg>
      </>
    ),
  },
  {
    name: 'Create Account',
    href: '/register',
    icon: (
      <>
        <svg
          width="20"
          height="20"
          aria-hidden="true"
          role="img"
          focusable="false"
          viewBox="0 0 32 32"
          fill="black"
        >
          <path d="M16 16c-4.064 0-6.4-2.336-6.4-6.4 0-3.536 2.864-6.4 6.4-6.4s6.4 2.864 6.4 6.4c0 4-2.4 6.4-6.4 6.4zM16 6.4c-1.76 0-3.2 1.44-3.2 3.2 0 2.272 0.928 3.2 3.2 3.2 2.24 0 3.2-0.96 3.2-3.2 0-1.76-1.44-3.2-3.2-3.2z"></path>
          <path d="M27.2 28.8h-22.4v-3.2c0-4.416 3.584-8 8-8h6.4c4.416 0 8 3.584 8 8v3.2zM8 25.6h16c0-2.64-2.16-4.8-4.8-4.8h-6.4c-2.64 0-4.8 2.16-4.8 4.8z"></path>
        </svg>
      </>
    ),
  },
  {
    name: 'Wishlist',
    href: '/wishlist',
    icon: (
      <>
        <svg
          width="20"
          height="20"
          aria-hidden="true"
          role="img"
          focusable="false"
          viewBox="0 0 32 32"
        >
          <path d="M22.736 6.4v0c1.792 0 3.44 1.12 4.128 2.768 0.8 1.92 0.112 4.144-1.856 6.112l-9.024 8.992-9.024-8.976c-1.984-1.984-2.64-4.144-1.824-6.080 0.688-1.68 2.352-2.8 4.144-2.8 1.504 0 3.040 0.752 4.448 2.16l2.256 2.256 2.256-2.256c1.44-1.424 2.992-2.176 4.496-2.176zM22.736 3.2c-2.176 0-4.544 0.912-6.752 3.104-2.192-2.176-4.544-3.088-6.704-3.088-6.368 0-11.040 7.904-4.576 14.336l11.28 11.248 11.28-11.248c6.496-6.448 1.856-14.352-4.528-14.352v0z"></path>
        </svg>
      </>
    ),
  },
  {
    name: 'Compare',
    href: '/compare',
    icon: (
      <>
        <svg
          width="20"
          height="20"
          aria-hidden="true"
          role="img"
          focusable="false"
          viewBox="0 0 32 32"
        >
          <path d="M13.136 14.864l-3.68-3.664h16.144v-3.2h-16.144l3.68-3.664-2.272-2.272-7.52 7.536 7.52 7.536z"></path>
          <path d="M21.136 14.864l-2.272 2.272 3.68 3.664h-16.144v3.2h16.144l-3.68 3.664 2.272 2.272 7.52-7.536z"></path>
        </svg>
      </>
    ),
  },
  {
    name: 'Track Order',
    href: '/tracking-order',
    icon: (
      <>
        <svg
          width="20"
          height="20"
          aria-hidden="true"
          role="img"
          focusable="false"
          viewBox="0 0 32 32"
        >
          <path d="M24.528 3.2h-17.056l-4.272 8.96v16.64h25.6v-16.64l-4.272-8.96zM24.8 11.2h-7.2v-4.8h4.912l2.288 4.8zM9.488 6.4h4.912v4.8h-7.2l2.288-4.8zM6.4 25.6v-11.2h8v3.2h3.2v-3.2h8v11.2h-19.2z"></path>
        </svg>
      </>
    ),
  },
];

export function Mobile_Navigation_UI() {
  const [is_cart_sheet_opended, set_is_cart_sheet_opended] = use_state<boolean>(false);
  const [is_auth_sheet_opended, set_is_auth_sheet_opended] = use_state<boolean>(false);
  const { isAuthenticated } = useSession();
  const { data: user } = useUserQuery();
  const router: AppRouterInstance = useRouter();
  const account_sheet_navigationitems: NavigationType[] = isAuthenticated
    ? [
        {
          name: 'My Account',
          href: '/dashboard',
          icon: auth_navigationitems[0]?.icon,
        },
        ...auth_navigationitems.filter(
          (navigation) => navigation.href !== '/login' && navigation.href !== '/register'
        ),
        {
          name: 'Sign out',
          href: '/logout',
          icon: (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
              />
            </svg>
          ),
        },
      ]
    : auth_navigationitems;
  function route_to_page(href: string) {
    router.push(href);
    set_is_auth_sheet_opended(false);
  }

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 lg:hidden',
        'bg-white/80 backdrop-blur-md border-t border-gray-100',
        'pt-3 px-6 pb-5',
        'shadow-[0_-15px_40px_-20px_rgba(0,0,0,0.3)]'
      )}
    >
      <div className="flex items-center justify-between max-w-md mx-auto">
        {bottom_mobile_navigation_items.map((item, index) => {
          return (
            <Link
              href={item.href}
              key={index}
              className="group flex flex-col items-center justify-center relative py-1 text-gray-500 hover:text-black transition-colors"
            >
              {/* Dynamic Icon tint via currentColor */}
              <div className="h-5 w-5 shrink-0 transition-transform active:scale-95">
                {item.icon}
              </div>

              <span className="mt-1.5 text-[11px] font-medium tracking-wide">{item.name}</span>
            </Link>
          );
        })}
        <Cart_Container
          open={is_cart_sheet_opended}
          onOpenChange={set_is_cart_sheet_opended}
          mobile
        />
        <Sheet open={is_auth_sheet_opended} onOpenChange={set_is_auth_sheet_opended}>
          <Sheet.Trigger asChild>
            <button type="button" className="flex items-center rounded px-1 py-1 hover:bg-white/10">
              {/* account holding */}
              <div className="group flex flex-col items-center justify-center relative py-1 text-gray-500 hover:text-black transition-colors">
                {/* Dynamic Icon tint via currentColor */}
                <div className="h-5 w-5 shrink-0 transition-transform active:scale-95">
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 32 32">
                    <path d="M16 16c-4.064 0-6.4-2.336-6.4-6.4 0-3.536 2.864-6.4 6.4-6.4s6.4 2.864 6.4 6.4c0 4-2.4 6.4-6.4 6.4zM16 6.4c-1.76 0-3.2 1.44-3.2 3.2 0 2.272 0.928 3.2 3.2 3.2 2.24 0 3.2-0.96 3.2-3.2 0-1.76-1.44-3.2-3.2-3.2z"></path>
                    <path d="M27.2 28.8h-22.4v-3.2c0-4.416 3.584-8 8-8h6.4c4.416 0 8 3.584 8 8v3.2zM8 25.6h16c0-2.64-2.16-4.8-4.8-4.8h-6.4c-2.64 0-4.8 2.16-4.8 4.8z"></path>
                  </svg>
                </div>

                <span className="mt-1.5 text-[11px] font-medium tracking-wide">Account</span>
              </div>
            </button>
          </Sheet.Trigger>

          <Sheet.Content side="right" size="sm" className="h-full  bg-white ">
            <Sheet.Header>
              <Sheet.Title className="text-black ">
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 rounded-full flex items-center justify-center bg-[#1d2229]">
                    <svg
                      width="18"
                      height="18"
                      aria-hidden="true"
                      role="img"
                      focusable="false"
                      viewBox="0 0 32 32"
                      fill="white"
                    >
                      <path d="M16 16c-4.064 0-6.4-2.336-6.4-6.4 0-3.536 2.864-6.4 6.4-6.4s6.4 2.864 6.4 6.4c0 4-2.4 6.4-6.4 6.4zM16 6.4c-1.76 0-3.2 1.44-3.2 3.2 0 2.272 0.928 3.2 3.2 3.2 2.24 0 3.2-0.96 3.2-3.2 0-1.76-1.44-3.2-3.2-3.2z"></path>
                      <path d="M27.2 28.8h-22.4v-3.2c0-4.416 3.584-8 8-8h6.4c4.416 0 8 3.584 8 8v3.2zM8 25.6h16c0-2.64-2.16-4.8-4.8-4.8h-6.4c-2.64 0-4.8 2.16-4.8 4.8z"></path>
                    </svg>
                  </div>
                  <div className="text-[18px] font-medium">
                    {isAuthenticated ? user?.username : 'Account'}
                  </div>
                </div>
              </Sheet.Title>
            </Sheet.Header>

            <div className="flex flex-col gap-4 mt-10 overflow-y-auto">
              {account_sheet_navigationitems.map((navigation) => {
                return (
                  <div
                    key={navigation.href}
                    onClick={() => route_to_page(navigation.href)}
                    className="px-8.5 py-3.75 flex hover:bg-[#f4f1ea] gap-4"
                  >
                    {/* your content — full control */}
                    <div className="text-black ">{navigation.icon}</div>
                    <div className="text-black text-sm">{navigation.name}</div>
                  </div>
                );
              })}
            </div>
          </Sheet.Content>
        </Sheet>
      </div>
    </nav>
  );
}
