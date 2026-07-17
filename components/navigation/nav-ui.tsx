import { usePathname, useRouter } from 'next/navigation';
import { useState as use_state, useEffect as use_effect, useRef as use_ref, JSX } from 'react';
import { ImagePlaceholder } from '../shared';
import { useBrandsQuery } from '@/hooks/catalog.hook';
import { ChevronDown, SearchIcon, Triangle, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/use-debounced-value'; // small utility hook, added below
import { useOnClickOutside } from '@/hooks/use-on-click-outside';
import { usePublicProductsQuery } from '@/hooks/product.hook';
import Link from 'next/link';
import { ProductData } from '@/services/product.service';
import { format_currency } from '@/utils/format';
import { Sheet } from '../shared/sheet';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { Cart_Container } from '@/modules/cart';
const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;

type NavigationType = {
  name: string;
  icon?: JSX.Element;
  href: string;
};

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
type MenuType = NavigationType & {};
const menu_navigationitems: MenuType[] = [
  {
    name: 'Home',
    href: '/',
  },
  {
    name: 'Whats New',
    href: '/whats-new',
  },
  {
    name: 'Start Shopping',
    href: '/shop',
  },
  {
    name: 'Best Sellers',
    href: '/best-sellers',
  },
  {
    name: 'Contact Us',
    href: '/contact-us',
  },
];
export function NavUI() {
  const pathname = usePathname();
  const [mounted, set_mounted] = use_state(false);
  const [is_auth_sheet_opended, set_is_auth_sheet_opended] = use_state<boolean>(false);
  const [is_cart_sheet_opended, set_is_cart_sheet_opended] = use_state<boolean>(false);
  const dont_show_nav = pathname === '/login' || pathname === '/register';
  const [is_brand_opened, set_is_brand_opened] = use_state<boolean>(false);
  const [is_menu_opened, set_is_menu_opened] = use_state<boolean>(false);
  const brand_menu_ref = use_ref<HTMLDivElement>(null);
  const router: AppRouterInstance = useRouter();
  const brands_query = useBrandsQuery({ limit: 8 });

  useOnClickOutside(brand_menu_ref, () => set_is_brand_opened(false));

  function route_to_page(href: string) {
    router.push(href);
    set_is_auth_sheet_opended(false);
    set_is_menu_opened(false);
  }

  use_effect(() => {
    const t = setTimeout(() => set_mounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  function toggole_brand() {
    set_is_brand_opened(!is_brand_opened);
  }

  function route_to_brand(brand_slug: string) {
    router.push(`/shop?brand=${encodeURIComponent(brand_slug)}`);
    set_is_brand_opened(false);
  }

  return (
    <nav
      className={`w-full 
      ${dont_show_nav ? 'hidden' : 'flex'}
      ${mounted ? 'animate-in' : 'opacity-0'}
    `}
    >
      <div className="w-full bg-black lg:bg-linear-to-br from-[#08091b] to-[#000000] px-4 py-4 lg:px-6">
        <div className="mx-auto flex w-full max-w-362.5 flex-wrap items-center gap-x-4 gap-y-3 lg:flex-nowrap">
          <div className="flex shrink-0 items-center gap-3 lg:gap-4">
            {/* logo */}
            <Sheet open={is_menu_opened} onOpenChange={set_is_menu_opened}>
              <Sheet.Trigger asChild>
                <button type="button" className="p-2 pl-0 lg:hidden" aria-label="Open menu">
                  <svg
                    width="24"
                    height="24"
                    aria-hidden="true"
                    role="img"
                    focusable="false"
                    viewBox="0 0 27 32"
                    fill="white"
                  >
                    <path d="M0 6.667h26.667v2.667h-26.667v-2.667z"></path>
                    <path d="M0 14.667h26.667v2.667h-26.667v-2.667z"></path>
                    <path d="M0 22.667h26.667v2.667h-26.667v-2.667z"></path>
                  </svg>
                </button>
              </Sheet.Trigger>
              <Sheet.Content side="left" size="sm" className="h-full bg-white">
                <Sheet.Header>
                  <Sheet.Title className="text-black">
                    <div onClick={() => route_to_page('/login')} className="  flex  gap-4">
                      {/* your content — full control */}
                      <div className="text-black ">
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
                      </div>
                      <div className="text-black text-sm">Hello, Sign in</div>
                    </div>
                  </Sheet.Title>
                </Sheet.Header>

                <div className="px-3.75 py-2 overflow-y-auto text-black">
                  {/* your content — full control */}
                  {[
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
                  ].map((navigation, index) => {
                    return (
                      <div
                        key={index}
                        onClick={() => route_to_page(navigation.href)}
                        className="px-8.5 py-3.75 flex flex-col hover:bg-[#f4f1ea] "
                      >
                        {/* your content — full control */}
                        <div className="flex gap-4">
                          <div className="text-black ">{navigation.icon}</div>
                          <div className="text-black text-sm">{navigation.name}</div>
                        </div>
                        <hr className="bg-[#ecf0f4] h-px w-full my-3.75" />
                      </div>
                    );
                  })}

                  {menu_navigationitems.map((navigation, index) => {
                    return (
                      <div
                        key={index}
                        onClick={() => route_to_page(navigation.href)}
                        className="px-8.5 py-3.75 flex hover:bg-[#f4f1ea] gap-4"
                      >
                        {/* your content — full control */}

                        <div className="text-black text-sm">{navigation.name}</div>
                      </div>
                    );
                  })}
                </div>
              </Sheet.Content>
            </Sheet>
            <div className="h-12 w-32 overflow-hidden sm:h-14 sm:w-37.5">
              <ImagePlaceholder
                label="logo"
                aspect="4/1"
                rounded="none"
                className="h-full w-full"
              />
            </div>
          </div>

          <div ref={brand_menu_ref} className="relative hidden shrink-0 lg:flex">
            {/* brand */}
            <button
              type="button"
              onClick={toggole_brand}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-white transition hover:bg-white/10"
              aria-expanded={is_brand_opened}
              aria-haspopup="menu"
              aria-label="Toggle brands"
            >
              <svg
                width="24"
                height="24"
                aria-hidden="true"
                role="img"
                focusable="false"
                viewBox="0 0 32 32"
                fill="white"
              >
                <path d="M8.8 6.4c1.328 0 2.4 1.072 2.4 2.4s-1.072 2.4-2.4 2.4-2.4-1.072-2.4-2.4 1.072-2.4 2.4-2.4zM8.8 3.2c-3.088 0-5.6 2.512-5.6 5.6s2.512 5.6 5.6 5.6 5.6-2.512 5.6-5.6-2.512-5.6-5.6-5.6v0z"></path>
                <path d="M23.2 6.4c1.328 0 2.4 1.072 2.4 2.4s-1.072 2.4-2.4 2.4-2.4-1.072-2.4-2.4 1.072-2.4 2.4-2.4zM23.2 3.2c-3.088 0-5.6 2.512-5.6 5.6s2.512 5.6 5.6 5.6 5.6-2.512 5.6-5.6-2.512-5.6-5.6-5.6v0z"></path>
                <path d="M8.8 20.8c1.328 0 2.4 1.072 2.4 2.4s-1.072 2.4-2.4 2.4-2.4-1.072-2.4-2.4 1.072-2.4 2.4-2.4zM8.8 17.6c-3.088 0-5.6 2.512-5.6 5.6s2.512 5.6 5.6 5.6 5.6-2.512 5.6-5.6-2.512-5.6-5.6-5.6v0z"></path>
                <path d="M23.2 20.8c1.328 0 2.4 1.072 2.4 2.4s-1.072 2.4-2.4 2.4-2.4-1.072-2.4-2.4 1.072-2.4 2.4-2.4zM23.2 17.6c-3.088 0-5.6 2.512-5.6 5.6s2.512 5.6 5.6 5.6 5.6-2.512 5.6-5.6-2.512-5.6-5.6-5.6v0z"></path>
              </svg>
              <span className="text-sm font-medium">Brands</span>
              <ChevronDown
                className={cn('size-4 transition-transform', is_brand_opened && 'rotate-180')}
              />
            </button>

            <div className="pointer-events-none absolute inset-x-0 -bottom-3 h-3" />

            {is_brand_opened && (
              <div
                className={cn(
                  'absolute left-0 top-14 z-50 text-white',
                  is_brand_opened ? ' animate-in' : 'animate-out'
                )}
              >
                <Brand_dropdown_content
                  brands={brands_query.data?.brands ?? []}
                  is_loading={brands_query.isLoading}
                  error_message={brands_query.isError ? brands_query.error.message : null}
                  on_select={route_to_brand}
                />
              </div>
            )}
          </div>

          <div className="order-3 w-full lg:order-0 lg:flex-1 lg:px-2">
            {/* search container */}
            <div className="mx-auto w-full lg:max-w-190">
              <Product_search_input />
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 text-white sm:gap-2 lg:gap-3">
            {/* right uses 30% */}

            <Sheet open={is_auth_sheet_opended} onOpenChange={set_is_auth_sheet_opended}>
              <Sheet.Trigger asChild>
                <button
                  type="button"
                  className="lg:flex hidden items-center rounded px-1 py-1 hover:bg-white/10"
                >
                  {/* account holding */}
                  <div className="h-11 flex items-center justify-center  w-8 ">
                    <svg
                      width="20"
                      height="20"
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

                  <div className="hidden flex-col gap-0.5 text-left sm:flex">
                    <span className="text-xs text-[#7e7f88]">Welcome</span>
                    <span className="text-xs leading-1.2">Sign in / Register</span>
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
                      <div className="text-[18px] font-medium">Account</div>
                    </div>
                  </Sheet.Title>
                </Sheet.Header>

                <div className="flex flex-col gap-4 mt-10 overflow-y-auto">
                  {auth_navigationitems.map((navigation, index) => {
                    return (
                      <div
                        key={index}
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

            <div className="">
              {/* cart */}

              <Cart_Container
                open={is_cart_sheet_opended}
                onOpenChange={set_is_cart_sheet_opended}
              />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
const SEARCH_SUGGESTIONS = [
  { id: '1', name: 'Nike Air Force', slug: 'nike-air-force' },
  { id: '2', name: 'Brooks', slug: 'brooks' },
  { id: '3', name: 'Adidas', slug: 'adidas' },
] as const;

function Brand_dropdown_content({
  brands,
  is_loading,
  error_message,
  on_select,
}: {
  brands: { id: string; name: string; slug: string }[];
  is_loading: boolean;
  error_message: string | null;
  on_select: (brand_slug: string) => void;
}) {
  return (
    <div className="relative w-72 overflow-hidden rounded-2xl border border-black/5 bg-white pt-2.5 pb-3 shadow-2xl">
      <div className="absolute -top-3 left-8">
        <Triangle className="text-white size-5 fill-white" />
      </div>
      <div className="border-b border-black/6 px-5 py-3">
        <p className="text-sm font-semibold text-black">Shop by brand</p>
        <p className="mt-1 text-xs text-gray-500">
          Jump straight into the labels customers browse most.
        </p>
      </div>
      <div className="max-h-80 overflow-y-auto py-2 text-black">
        {is_loading && (
          <div className="space-y-2 px-4 py-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[#f3f5f7]" />
            ))}
          </div>
        )}

        {!is_loading && error_message && (
          <div className="px-5 py-4 text-sm text-gray-500">{error_message}</div>
        )}

        {!is_loading && !error_message && brands.length === 0 && (
          <div className="px-5 py-4 text-sm text-gray-500">No brands are available right now.</div>
        )}

        {!is_loading &&
          !error_message &&
          brands.map((brand) => {
            return (
              <button
                key={brand.id}
                type="button"
                onClick={() => on_select(brand.slug)}
                className={cn(
                  'flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-[#ebf0f5]'
                )}
              >
                <span className="text-sm font-medium text-[#111827]">{brand.name}</span>
                <span className="text-xs uppercase tracking-[0.12em] text-gray-400">View</span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

function Product_search_input() {
  const [query, setQuery] = use_state('');
  const [isFocused, setIsFocused] = use_state(false);
  const containerRef = use_ref<HTMLDivElement>(null);
  const inputRef = use_ref<HTMLInputElement>(null);

  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const shouldSearch = debouncedQuery.trim().length >= MIN_SEARCH_LENGTH;
  const showDropdown = isFocused && shouldSearch;

  useOnClickOutside(containerRef, () => setIsFocused(false));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length >= MIN_SEARCH_LENGTH) {
      setIsFocused(true);
    }
  }

  function handleSuggestionClick(suggestion: (typeof SEARCH_SUGGESTIONS)[number]) {
    setQuery(suggestion.name);
    setIsFocused(true);
    inputRef.current?.focus();
  }

  function handleClear() {
    setQuery('');
    inputRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="w-full">
        <div className="flex w-full items-center justify-between overflow-hidden rounded-lg border border-white/20 bg-white shadow-sm ring-1 ring-black/5 transition focus-within:ring-2 focus-within:ring-black/20">
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-1 sm:gap-4 sm:px-5">
            <label htmlFor="product-search" className="sr-only">
              Search for anything
            </label>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <input
                id="product-search"
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setIsFocused(true)}
                onKeyDown={handleKeyDown}
                placeholder="Search for anything"
                className="w-full min-w-0 bg-transparent px-1 text-sm text-black outline-none placeholder:text-gray-400"
              />
              {query.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear search"
                  className="shrink-0  text-gray-400 hover:text-black transition-colors"
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              {SEARCH_SUGGESTIONS.map((suggestion) => {
                const isActive = query.trim().toLowerCase() === suggestion.name.toLowerCase();
                return (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={cn(
                      'flex items-center whitespace-nowrap rounded px-2.75 py-1 transition-colors',
                      isActive ? 'bg-black text-white' : 'bg-white hover:bg-[#dde5ee]'
                    )}
                  >
                    <p
                      className={cn('text-sm font-medium', isActive ? 'text-white' : 'text-black')}
                    >
                      {suggestion.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="submit"
            aria-label="Search"
            className="flex h-11 w-11 shrink-0 items-center justify-center bg-black transition-colors hover:bg-black/85"
          >
            <SearchIcon className="size-4 text-white" />
          </button>
        </div>
      </form>
      {showDropdown && (
        <div className="absolute inset-x-0 top-full z-100 mt-2 animate-in slide-in-from-top-1 fade-in duration-150">
          <Search_results query={debouncedQuery} />
        </div>
      )}
    </div>
  );
}

function Search_results({ query }: { query: string }) {
  const { data, isLoading } = usePublicProductsQuery({ search: query });
  const products = data?.products ?? [];

  return (
    <div className="max-h-96 overflow-y-auto rounded-lg bg-white py-2 shadow-xl ring-1 ring-black/5">
      {isLoading && <p className="px-5 py-4 text-sm text-gray-400">Searching…</p>}

      {!isLoading && products.length === 0 && (
        <p className="px-5 py-4 text-sm text-black">
          No products were found matching your selection. &ldquo;{query}&rdquo;
        </p>
      )}

      {products.map((product) => (
        <Link
          key={product.id}
          href={`/products/${product.slug}`}
          className="flex items-center gap-3 px-5 py-2.5 transition-colors mb-4 hover:bg-[#f4f1ea]"
        >
          <Product_card product={product} />
        </Link>
      ))}
    </div>
  );
}

function Product_card({ product }: { product: ProductData }) {
  return (
    <div className="flex gap-7.5">
      <div className="w-20 h-14.75">
        <ImagePlaceholder
          src={product.media[0]?.url}
          alt={product.name}
          label={product.name}
          rounded="none"
        />
      </div>
      <div className="flex flex-col gap-2.5 pt-1.5">
        <span className="truncate text-sm text-gray-700">{product.name}</span>
        <p className="relative text-black font-medium tracking-wide whitespace-nowrap">
          {format_currency(product.pricing.basePrice)}
          <span className="text-xs absolute font-semibold">inc. VAT</span>
        </p>
      </div>
    </div>
  );
}
