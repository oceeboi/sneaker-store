'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BreadcrumbProps {
  /** Optional custom mappings for specific path segments (e.g., {'user-id-123': 'John Doe'}) */
  aliases?: Record<string, string>;
  /** Custom home icon or string */
  homeLabel?: React.ReactNode;
}

export function Breadcrumb({ aliases = {}, homeLabel = 'Home' }: BreadcrumbProps) {
  const pathname = usePathname();

  // Split pathname into segments and remove empty items
  const pathSegments = pathname.split('/').filter((segment) => segment !== '');

  // Generate the breadcrumb items array
  const breadcrumbs = pathSegments.map((segment, index) => {
    // Build out the full URL step-by-step for each link
    const href = '/' + pathSegments.slice(0, index + 1).join('/');

    // Determine the user-facing title (Check custom aliases -> fall back to clean title formatting)
    const title = aliases[segment] ? aliases[segment] : segment.replace(/-|_/g, ' '); // Converts slug 'my-profile' to 'my profile'

    return { href, title };
  });

  // If we are on the absolute home root, don't display anything or adjust as needed
  if (breadcrumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex py-3 text-sm font-medium text-gray-500">
      <ol className="inline-flex items-center space-x-1 md:space-x-2.5 list-none m-0 p-0">
        {/* Absolute Home Link */}
        <li className="inline-flex items-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors duration-200"
          >
            {homeLabel}
          </Link>
        </li>

        {/* Dynamic Inner Links */}
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <li key={crumb.href} className="flex items-center">
              {/* Modern Chevron Separator */}
              <svg
                className="w-3 h-3 text-gray-400 mx-1 md:mx-2"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 6 10"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="m1 9 4-4-4-4"
                />
              </svg>

              {isLast ? (
                // Last item represents the current page: unclickable and bolded
                <span
                  className="text-gray-900 font-semibold capitalize truncate max-w-40 sm:max-w-xs"
                  aria-current="page"
                >
                  {crumb.title}
                </span>
              ) : (
                // Regular inner link paths
                <Link
                  href={crumb.href}
                  className="text-gray-500 hover:text-gray-900 transition-colors duration-200 capitalize truncate max-w-30"
                >
                  {crumb.title}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
