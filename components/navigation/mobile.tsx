'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { JSX } from 'react';

type NavigationType = {
  name: string;
  href: string;
  icon: JSX.Element;
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
  {
    name: 'Cart',
    href: '/shopping-cart',
    icon: (
      <svg width="20" height="20" fill="currentColor" viewBox="0 0 32 32">
        <path d="M25.248 22.4l3.552-14.4h-18.528l-0.96-4.8h-6.112v3.2h3.488l3.2 16h15.36zM24.704 11.2l-1.968 8h-10.24l-1.6-8h13.808z"></path>
        <path d="M25.6 26.4c0 1.325-1.075 2.4-2.4 2.4s-2.4-1.075-2.4-2.4c0-1.325 1.075-2.4 2.4-2.4s2.4 1.075 2.4 2.4z"></path>
        <path d="M14.4 26.4c0 1.325-1.075 2.4-2.4 2.4s-2.4-1.075-2.4-2.4c0-1.325 1.075-2.4 2.4-2.4s2.4 1.075 2.4 2.4z"></path>
      </svg>
    ),
  },
  {
    name: 'Account',
    href: '/dashboard',
    icon: (
      <svg width="20" height="20" fill="currentColor" viewBox="0 0 32 32">
        <path d="M16 16c-4.064 0-6.4-2.336-6.4-6.4 0-3.536 2.864-6.4 6.4-6.4s6.4 2.864 6.4 6.4c0 4-2.4 6.4-6.4 6.4zM16 6.4c-1.76 0-3.2 1.44-3.2 3.2 0 2.272 0.928 3.2 3.2 3.2 2.24 0 3.2-0.96 3.2-3.2 0-1.76-1.44-3.2-3.2-3.2z"></path>
        <path d="M27.2 28.8h-22.4v-3.2c0-4.416 3.584-8 8-8h6.4c4.416 0 8 3.584 8 8v3.2zM8 25.6h16c0-2.64-2.16-4.8-4.8-4.8h-6.4c-2.64 0-4.8 2.16-4.8 4.8z"></path>
      </svg>
    ),
  },
];

export function Mobile_Navigation_UI() {
  const cartItems = 4;

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 lg:hidden',
        'bg-white/80 backdrop-blur-md border-t border-gray-100',
        'pt-3 px-6 pb-5',
        /* The Cave / Tunnel Shadow projecting explicitly upwards */
        'shadow-[0_-15px_40px_-20px_rgba(0,0,0,0.3)]'
      )}
    >
      <div className="flex items-center justify-between max-w-md mx-auto">
        {bottom_mobile_navigation_items.map((item, index) => {
          const isCart = item.name.toLowerCase() === 'cart';

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

              {/* Cart Badge implementation */}
              {isCart && cartItems > 0 && (
                <div className="absolute -top-1.5 -right-2.5">
                  <div className="bg-black min-w-4.5 h-[4.5 px-1 rounded-full text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                    {cartItems < 10 ? cartItems : '10+'}
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
