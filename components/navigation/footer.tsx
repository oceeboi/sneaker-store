import { STORE_DETAILS, STORE_SOCIALS } from '@/constants/store-details';
import { Accordion } from '../shared';
import { JSX } from 'react/jsx-runtime';
import { cn } from '@/lib/utils';
import { usePathname, useRouter } from 'next/navigation';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import Link from 'next/link';

type NavigationType = {
  name: string;
  href: string;
  icon?: JSX.Element;
};

const navigation_type: NavigationType[] = [
  {
    name: 'home',
    href: '/',
  },
  {
    name: 'Shop now',
    href: '/shop',
  },
  {
    name: 'Best sellers',
    href: '/best-sellers',
  },
  {
    name: 'Contact us',
    href: '/contact-us',
  },
];

const legal_navigations: NavigationType[] = [
  {
    name: `${STORE_DETAILS.name} Verified`,
    href: '/verification',
  },
  {
    name: 'Privacy Policy',
    href: '/privacy-policy',
  },
  {
    name: 'Refund & Returns',
    href: '/refund-return-policy',
  },
  {
    name: 'Terms of use',
    href: '/terms-of-use',
  },
];

const company_navigations: NavigationType[] = [
  {
    name: 'About Us',
    href: '/about-us',
  },
  {
    name: 'Locate Store',
    href: '/our-locations',
  },
];

/**
 * socail not know yet: should
 */

const social_navigations: NavigationType[] = STORE_SOCIALS.map((social, index) => ({
  name: social.name,
  href: social.url,
  icon: <span dangerouslySetInnerHTML={{ __html: social.icon }} />,
}));

export function Footer() {
  const details = STORE_DETAILS;

  const router: AppRouterInstance = useRouter();

  const pathname = usePathname();

  function is_active_link(href: string) {
    if (href === '/') {
      return pathname === '/';
    }

    return pathname === href || pathname?.startsWith(`${href}/`);
  }
  function route_to_page(href: string) {
    router.push;
  }

  return (
    <section id="footer">
      <section className="pt-3.25 flex border-t-4 border-[#ECF0F4]">
        <div className="px-4 pt-4 ">
          <div>
            <div className="py-5">
              <h4 className="text-[18px] font-medium whitespace-nowrap">{details.name}</h4>
            </div>
          </div>
          <div className="">
            <div className="mb-5.25 mt-3.5">
              <p className="text-sm">
                At {details.name} sneakers are more than footwear—they’re culture, style, and
                identity. We bring you the finest Jordans, Dunks, Air Force, and limited-edition
                Nike releases, all 100% authentic and sourced from trusted global partners.
              </p>
            </div>
          </div>
          <div className="w-full h-5 border-b-2 border-[#ECF0F4]  pt-4.25" />
        </div>
        <div className="px-4 pt-4 hidden lg:block ">
          <div>
            <div className="py-5">
              <h4 className="text-[18px] font-medium whitespace-nowrap">Quick Links</h4>
            </div>
          </div>
          <div className="">
            <div className="flex flex-col items-start">
              {navigation_type.map((navigation) => {
                const is_active = is_active_link(navigation.href);
                return (
                  <Link
                    key={navigation.href}
                    href={navigation.href}
                    aria-current={is_active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2 rounded-full  py-2 text-sm font-medium whitespace-nowrap capitalize',
                      'transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20',
                      is_active ? 'text-black' : 'text-black/60 hover:text-black'
                    )}
                  >
                    {navigation.name}
                    <span
                      className={cn(
                        'absolute inset-x-3 bottom-0.5 h-0.5 origin-center rounded-full bg-black transition-transform duration-150',
                        is_active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                      )}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
        <div className="px-4 pt-4 hidden lg:block">
          <div>
            <div className="py-5">
              <h4 className="text-[18px] font-medium whitespace-nowrap">Legal</h4>
            </div>
          </div>
          <div className="">
            <div className=" flex flex-col items-start">
              {legal_navigations.map((navigation) => {
                const is_active = is_active_link(navigation.href);
                return (
                  <Link
                    key={navigation.href}
                    href={navigation.href}
                    aria-current={is_active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap capitalize',
                      'transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20',
                      is_active ? 'text-black' : 'text-black/60 hover:text-black'
                    )}
                  >
                    {navigation.name}
                    <span
                      className={cn(
                        'absolute inset-x-3 bottom-0.5 h-0.5 origin-center rounded-full bg-black transition-transform duration-150',
                        is_active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                      )}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
        <div className="px-4 pt-4 hidden lg:block">
          <div>
            <div className="py-5">
              <h4 className="text-[18px] font-medium">Connect</h4>
            </div>
          </div>
          <div className="">
            <div className="flex flex-col items-start">
              {social_navigations.map((navigation, index) => {
                const is_active = is_active_link(navigation.href);
                return (
                  <Link
                    key={index}
                    href={navigation.href}
                    aria-current={is_active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap capitalize',
                      'transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20',
                      is_active ? 'text-black' : 'text-black/60 hover:text-black'
                    )}
                  >
                    <div className="">{navigation.icon}</div>
                    {navigation.name}
                    <span
                      className={cn(
                        'absolute inset-x-3 bottom-0.5 h-0.5 origin-center rounded-full bg-black transition-transform duration-150',
                        is_active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                      )}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
        <div className="px-4 pt-4 hidden lg:block">
          <div>
            <div className="py-5">
              <h4 className="text-[18px] font-medium">Company</h4>
            </div>
          </div>
          <div className="">
            <div className=" flex flex-col items-start">
              {company_navigations.map((navigation) => {
                const is_active = is_active_link(navigation.href);
                return (
                  <Link
                    key={navigation.href}
                    href={navigation.href}
                    aria-current={is_active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap capitalize',
                      'transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20',
                      is_active ? 'text-black' : 'text-black/60 hover:text-black'
                    )}
                  >
                    {navigation.name}
                    <span
                      className={cn(
                        'absolute inset-x-3 bottom-0.5 h-0.5 origin-center rounded-full bg-black transition-transform duration-150',
                        is_active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                      )}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      <section className="pt-3.25  lg:hidden ">
        <div className="px-4 pt-4 ">
          <div>
            <div>
              <Accordion type="single" collapsible defaultValue="quick-links">
                <Accordion.Item value="quick-links">
                  <Accordion.Trigger className="text-black">
                    <div className="flex justify-between w-full items-center">
                      <h4 className="text-black">Quick Links</h4>
                    </div>
                  </Accordion.Trigger>
                  <Accordion.Content className="text-black">
                    <div className="pl-8.25 flex flex-col items-start">
                      {navigation_type.map((navigation) => {
                        const is_active = is_active_link(navigation.href);
                        return (
                          <Link
                            key={navigation.href}
                            href={navigation.href}
                            aria-current={is_active ? 'page' : undefined}
                            className={cn(
                              'group relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap capitalize',
                              'transition-colors duration-150',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20',
                              is_active ? 'text-black' : 'text-black/60 hover:text-black'
                            )}
                          >
                            {navigation.name}
                            <span
                              className={cn(
                                'absolute inset-x-3 bottom-0.5 h-0.5 origin-center rounded-full bg-black transition-transform duration-150',
                                is_active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                              )}
                            />
                          </Link>
                        );
                      })}
                    </div>
                  </Accordion.Content>
                </Accordion.Item>

                <Accordion.Item value="legal" className=" ">
                  <Accordion.Trigger>
                    <p className="text-black capitalize">legal</p>
                  </Accordion.Trigger>
                  <Accordion.Content className="text-black">
                    <div className="pl-8.25 flex flex-col items-start">
                      {legal_navigations.map((navigation) => {
                        const is_active = is_active_link(navigation.href);
                        return (
                          <Link
                            key={navigation.href}
                            href={navigation.href}
                            aria-current={is_active ? 'page' : undefined}
                            className={cn(
                              'group relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap capitalize',
                              'transition-colors duration-150',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20',
                              is_active ? 'text-black' : 'text-black/60 hover:text-black'
                            )}
                          >
                            {navigation.name}
                            <span
                              className={cn(
                                'absolute inset-x-3 bottom-0.5 h-0.5 origin-center rounded-full bg-black transition-transform duration-150',
                                is_active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                              )}
                            />
                          </Link>
                        );
                      })}
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
                <Accordion.Item value="company" className=" ">
                  <Accordion.Trigger>
                    <p className="text-black">Company</p>
                  </Accordion.Trigger>
                  <Accordion.Content className="text-black">
                    <div className="pl-8.25 flex flex-col items-start">
                      {company_navigations.map((navigation) => {
                        const is_active = is_active_link(navigation.href);
                        return (
                          <Link
                            key={navigation.href}
                            href={navigation.href}
                            aria-current={is_active ? 'page' : undefined}
                            className={cn(
                              'group relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap capitalize',
                              'transition-colors duration-150',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20',
                              is_active ? 'text-black' : 'text-black/60 hover:text-black'
                            )}
                          >
                            {navigation.name}
                            <span
                              className={cn(
                                'absolute inset-x-3 bottom-0.5 h-0.5 origin-center rounded-full bg-black transition-transform duration-150',
                                is_active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                              )}
                            />
                          </Link>
                        );
                      })}
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
                <Accordion.Item value="connect" className=" ">
                  <Accordion.Trigger>
                    <p className="text-black">Connect</p>
                  </Accordion.Trigger>
                  <Accordion.Content className="text-black">
                    <div className="pl-8.25 flex flex-col items-start">
                      {social_navigations.map((navigation, index) => {
                        const is_active = is_active_link(navigation.href);
                        return (
                          <Link
                            key={index}
                            href={navigation.href}
                            aria-current={is_active ? 'page' : undefined}
                            className={cn(
                              'group relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap capitalize',
                              'transition-colors duration-150',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20',
                              is_active ? 'text-black' : 'text-black/60 hover:text-black'
                            )}
                          >
                            <div className="">{navigation.icon}</div>
                            {navigation.name}
                            <span
                              className={cn(
                                'absolute inset-x-3 bottom-0.5 h-0.5 origin-center rounded-full bg-black transition-transform duration-150',
                                is_active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                              )}
                            />
                          </Link>
                        );
                      })}
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
              </Accordion>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full  flex justify-center">
        <div className="py-3 px-4">
          <p className="mb-5.25 top-1.25 text-[#1D2128] text-sm ">
            Copyright © 2026 {details.name} All rights reserved
          </p>
        </div>
      </section>
    </section>
  );
}
