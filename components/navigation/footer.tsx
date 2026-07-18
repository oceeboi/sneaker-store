'use client';

import { STORE_DETAILS, STORE_SOCIALS } from '@/constants/store-details';
import { Accordion } from '../shared';
import { JSX } from 'react/jsx-runtime';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

type NavigationType = {
  name: string;
  href: string;
  icon?: JSX.Element;
  external?: boolean;
};

const quick_navigation: NavigationType[] = [
  {
    name: 'Home',
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

const social_navigations: NavigationType[] = STORE_SOCIALS.map((social) => ({
  name: social.name,
  href: social.url,
  external: true,
  icon: <span dangerouslySetInnerHTML={{ __html: social.icon }} />,
}));

const footer_link_sections: { key: string; title: string; links: NavigationType[] }[] = [
  {
    key: 'quick-links',
    title: 'Quick Links',
    links: quick_navigation,
  },
  {
    key: 'legal',
    title: 'Legal',
    links: legal_navigations,
  },
  {
    key: 'company',
    title: 'Company',
    links: company_navigations,
  },
  {
    key: 'connect',
    title: 'Connect',
    links: social_navigations,
  },
];

function is_active_link(current_path: string, href: string, is_external = false) {
  if (is_external || !href.startsWith('/')) {
    return false;
  }

  if (href === '/') {
    return current_path === '/';
  }

  return current_path === href || current_path.startsWith(`${href}/`);
}

function Footer_links({
  pathname,
  navigations,
  with_indent = false,
}: {
  pathname: string;
  navigations: NavigationType[];
  with_indent?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-start gap-0.5', with_indent && 'pl-8.25')}>
      {navigations.map((navigation) => {
        const is_active = is_active_link(pathname, navigation.href, navigation.external);
        const is_external = navigation.external || !navigation.href.startsWith('/');

        return (
          <Link
            key={navigation.href}
            href={navigation.href}
            aria-current={is_active ? 'page' : undefined}
            target={is_external ? '_blank' : undefined}
            rel={is_external ? 'noopener noreferrer' : undefined}
            className={cn(
              'group relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20',
              is_active ? 'text-black' : 'text-black/60 hover:text-black'
            )}
          >
            {navigation.icon ? <span>{navigation.icon}</span> : null}
            <span className="capitalize">{navigation.name}</span>
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
  );
}

export function Footer() {
  const details = STORE_DETAILS;
  const pathname = usePathname() ?? '/';

  return (
    <section id="footer" className="border-t-4 border-[#ECF0F4] bg-white">
      <section className="mx-auto w-full max-w-285 px-4 pt-3.25 contaer  lg:px-6">
        <div className="grid gap-2  lg:grid-cols-[1.8fr_repeat(4,minmax(0,1fr))] lg:gap-4">
          <div className="pt-4">
            <div className="py-5">
              <h4 className="text-[18px] font-medium whitespace-nowrap">{details.name}</h4>
            </div>
            <div className="mb-5.25 mt-3.5">
              <p className="text-sm text-black/85">
                At {details.name}, we believe sneakers are an expression of culture, style, and
                identity. As a premier destination for authentic luxury footwear, our collection
                features only the finest Jordans, Dunks, Air Forces, and rare, limited-edition Nike
                releases. Sourced strictly from a trusted network of global partners, we guarantee
                100% authenticity so you can step out with absolute confidence.
              </p>
            </div>
            <div className="h-5 w-full border-b-2 border-[#ECF0F4] pt-4.25 lg:hidden" />
          </div>

          {footer_link_sections.map((section) => {
            return (
              <div key={section.key} className="hidden pt-4 lg:block">
                <div className="py-5">
                  <h4 className="text-[18px] font-medium whitespace-nowrap">{section.title}</h4>
                </div>
                <Footer_links pathname={pathname} navigations={section.links} />
              </div>
            );
          })}
        </div>
      </section>
      <section className="pt-3.25 lg:hidden">
        <div className="mx-auto w-full max-w-362.5 px-4 pt-4 lg:px-6">
          <Accordion type="single" collapsible defaultValue="quick-links">
            {footer_link_sections.map((section) => {
              return (
                <Accordion.Item key={section.key} value={section.key}>
                  <Accordion.Trigger>
                    <p className="text-black">{section.title}</p>
                  </Accordion.Trigger>
                  <Accordion.Content className="text-black">
                    <Footer_links pathname={pathname} navigations={section.links} with_indent />
                  </Accordion.Content>
                </Accordion.Item>
              );
            })}
          </Accordion>
        </div>
      </section>

      <section className="flex w-full justify-center border-t h-40 lg:h-20 border-[#ECF0F4]">
        <div className="px-4 py-3 lg:px-6">
          <p className="top-1.25 mb-5.25 text-sm text-[#1D2128]">
            Copyright © 2026 {details.name} All rights reserved
          </p>
        </div>
      </section>
    </section>
  );
}
