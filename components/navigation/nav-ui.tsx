import { usePathname, useRouter } from 'next/navigation';
import { useState as use_state, useEffect as use_effect, useRef as use_ref, JSX } from 'react';
import { ImagePlaceholder } from '../shared';
import { useBrandsQuery, useCategoriesQuery } from '@/hooks/catalog.hook';
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
  const isLogin = pathname?.includes('/login');
  const dont_show_nav = pathname === '/login' || pathname === '/register';
  const [is_brand_opened, set_is_brand_opened] = use_state<boolean>(false);
  const [is_menu_opened, set_is_menu_opened] = use_state<boolean>(false);
  const router: AppRouterInstance = useRouter();

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

  return (
    <nav
      className={` min-h-25 w-full
      ${dont_show_nav ? 'hidden' : 'flex'}
      ${mounted ? 'animate-in' : 'opacity-0'}
    `}
    >
      {/* Navigation UI goes here */}
      <div className="w-full flex h-full justify-between items-start  bg-black lg:bg-linear-to-br from-[#08091b] to-[#000000] py-4  px-4">
        <div className="flex gap-4  flex-col lg:flex-row lg:items-center   items-start">
          {/* left content 70% */}
          <div className="h-full  items-center flex">
            {/* logo */}
            <Sheet open={is_menu_opened} onOpenChange={set_is_menu_opened}>
              <Sheet.Trigger asChild>
                <div className="p-3.75 pl-0 lg:hidden">
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
                </div>
              </Sheet.Trigger>
              <Sheet.Content side="left" size="md" className="h-full bg-white">
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
            <div className="w-37.5 h-14  overflow-hidden">
              <ImagePlaceholder
                label="logo"
                aspect="4/1"
                rounded="none"
                className="h-full w-full"
              />
            </div>
          </div>
          <div onClick={toggole_brand} className="lg:flex hidden gap-2 relative">
            {/* brand */}
            <div>
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
            </div>
            <div className="flex items-center gap-2">
              <p className="text-white">Brands</p>
              <button className="no-underline">
                <ChevronDown className="text-white" />
              </button>
            </div>
            {is_brand_opened && (
              <div
                className={cn(
                  'text-white absolute z-9999999 top-15 left-10',
                  is_brand_opened ? ' animate-in' : 'animate-out'
                )}
              >
                <Brand_dropdown_content />
              </div>
            )}
          </div>
          <div className="  max-w-163.75">
            {/* search container */}
            <Product_search_input />
          </div>
        </div>
        <div className="text-white flex  items-center gap-3">
          {/* right uses 30% */}

          <Sheet open={is_auth_sheet_opended} onOpenChange={set_is_auth_sheet_opended}>
            <Sheet.Trigger asChild>
              <div className="flex items-center">
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

                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-[#7e7f88]">Welcome</span>
                  <span className="text-xs leading-1.2">Sign in / Register</span>
                </div>
              </div>
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

            <Cart_Container open={is_cart_sheet_opended} onOpenChange={set_is_cart_sheet_opended} />
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

function Brand_dropdown_content() {
  const { data } = useBrandsQuery();
  return (
    <div className="bg-white pt-2.5 pb-3 w-66.75 relative rounded shadow-2xl">
      <div className="absolute -top-3 left-10">
        <Triangle className="text-white size-5 fill-white" />
      </div>
      <div className="text-black w-full">
        {data?.brands.map((brand, index) => {
          return (
            <button
              key={index}
              className={cn(
                'py-1.5 px-5.5 text-gray-500 hover:text-black hover:bg-[#ebf0f5] w-full flex'
              )}
            >
              <p className="text-gray">{brand.name}</p>
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

  // Close dropdown on outside click
  use_effect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        <div className="flex w-full justify-between bg-white rounded">
          <div className="flex flex-1 items-center justify-between gap-5.5 px-5.5">
            <label htmlFor="product-search" className="sr-only">
              Search for anything
            </label>
            <div className="flex flex-1 items-center gap-2">
              <input
                id="product-search"
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setIsFocused(true)}
                onKeyDown={handleKeyDown}
                placeholder="Search for anything"
                className="bg-none w-full px-4 text-sm  focus:bg-none text-black outline-none placeholder:text-gray-400"
              />
              {/* {query.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear search"
                  className="shrink-0 text-gray-400 hover:text-black transition-colors"
                >
                  <XIcon className="size-4" />
                </button>
              )} */}
            </div>

            <div className="lg:flex hidden items-center gap-2">
              {SEARCH_SUGGESTIONS.map((suggestion) => {
                const isActive = query.trim().toLowerCase() === suggestion.name.toLowerCase();
                return (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={cn(
                      'px-2.75 py-1 rounded flex items-center whitespace-nowrap transition-colors',
                      isActive ? 'bg-black text-white' : 'bg-white hover:bg-[#dde5ee]'
                    )}
                  >
                    <p className="font-medium text-sm text-black">{suggestion.name}</p>
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="submit"
            aria-label="Search"
            className="flex w-12 h-12 shrink-0 items-center justify-center bg-black transition-colors hover:bg-black/85"
          >
            <SearchIcon className="size-4 text-white" />
          </button>
        </div>
      </form>
      {showDropdown && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 animate-in fade-in slide-in-from-top-1 duration-150">
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
    <div className="max-h-96 overflow-y-auto bg-white py-2 shadow-xl ring-1 ring-black/5">
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
