// components/shared/ImagePlaceholder.tsx
'use client';

import { memo, useState } from 'react';
import Image from 'next/image';

import { cn } from '@/lib/utils';

const GRID_CELLS = Array.from({ length: 48 }, (_, index) => index);

const ROUNDED_STYLES = {
  none: 'rounded-none',
  md: 'rounded-md',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
} as const;

type RoundedVariant = keyof typeof ROUNDED_STYLES;

interface ImagePlaceholderProps {
  /** Image URL to render. Falls back to decorative art if omitted, or if it fails to load. */
  src?: string | null;
  alt?: string;
  /** Describes what this is a placeholder for — shown in the fallback state and used as a11y fallback for `alt`. */
  label?: string;
  aspect?: string;
  rounded?: RoundedVariant;
  className?: string;
  /** Set true for above-the-fold images (hero, first product row) to skip lazy-loading. */
  priority?: boolean;
  /** Matches next/image's `sizes` prop — tune per layout for correct responsive loading. */
  sizes?: string;
}

function ImagePlaceholder({
  src,
  alt,
  label = 'Platform Screenshot',
  aspect = '4/3',
  rounded = '2xl',
  className = '',
  priority = false,
  sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw',
}: ImagePlaceholderProps) {
  const [hasError, setHasError] = useState(false);
  const showFallback = !src || hasError;

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-black/80',
        ROUNDED_STYLES[rounded],
        className
      )}
      style={{ aspectRatio: aspect }}
    >
      {!showFallback && (
        <Image
          src={src as string}
          alt={alt ?? label}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          onError={() => setHasError(true)}
        />
      )}

      {showFallback && <PlaceholderArt label={label} />}
    </div>
  );
}

/** The decorative "no image yet" art — grid texture, mock chart lines, and an icon + label. */
function PlaceholderArt({ label }: { label: string }) {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 gap-px opacity-[0.06]">
        {GRID_CELLS.map((cell) => (
          <div key={cell} className="rounded-sm bg-white" />
        ))}
      </div>

      <svg
        className="absolute inset-0 h-full w-full opacity-20"
        viewBox="0 0 400 300"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline
          points="0,200 60,170 120,185 180,130 240,145 300,90 360,75 400,60"
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <polyline
          points="0,240 60,235 120,220 180,215 240,200 300,180 360,170 400,155"
          fill="none"
          stroke="white"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeDasharray="4 3"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-white/40"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
        <p className="text-xs uppercase tracking-wider text-white/30">{label}</p>
      </div>
    </div>
  );
}

const MemoizedImagePlaceholder = memo(ImagePlaceholder);

export { MemoizedImagePlaceholder as ImagePlaceholder };
