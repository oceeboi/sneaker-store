'use client';

import { useMemo, useState } from 'react';
import type { ProductDescription } from '@/services/product.service';
import Image from 'next/image';
import { Heart, Check, ShoppingBag } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
// Presentation-layer shape. Deliberately decoupled from `ProductData` (the
// service/API shape) — the mapping between the two lives in whatever page
// consumes this component, not in here. Keeps this component reusable for
// any future data source (admin preview, storybook, tests) without dragging
// service types into it.

export interface IMedia {
  url: string;
  alt: string;
  type: 'image' | 'video';
  order: number;
}

export interface ISizeOption {
  size: string;
  sku: string | null;
  stockQuantity: number;
  active: boolean;
}

export interface IPricing {
  currency: string;
  basePrice: number; // smallest unit (kobo)
  compareAtPrice: number | null;
}

export interface ProductDetailProps {
  name: string;
  brandName: string;
  description: ProductDescription | null;
  features: string[];
  tags: string[];
  media: IMedia[];
  sizes: ISizeOption[];
  pricing: IPricing;
  sizeLabel?: string; // e.g. "Size (EU)" for sneakers, "Size" for apparel
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(amountInKobo: number, currency: string) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amountInKobo / 100);
}

function discountPercent(base: number, compareAt: number | null) {
  if (!compareAt || compareAt <= base) return null;
  return Math.round(((compareAt - base) / compareAt) * 100);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProductDetail({
  name,
  brandName,
  description,
  features,
  tags,
  media,
  sizes,
  pricing,
  sizeLabel = 'Size',
}: ProductDetailProps) {
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(
    sizes.find((s) => s.active && s.stockQuantity > 0)?.size ?? null
  );

  const sortedMedia = useMemo(() => [...media].sort((a, b) => a.order - b.order), [media]);

  const selectedSizeOption = sizes.find((s) => s.size === selectedSize);
  const discount = discountPercent(pricing.basePrice, pricing.compareAtPrice);

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-[280px_1fr]">
      {/* Gallery */}
      <div>
        <div className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          {sortedMedia[activeMediaIdx] ? (
            <Image
              src={sortedMedia[activeMediaIdx].url}
              alt={sortedMedia[activeMediaIdx].alt}
              fill
              sizes="280px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-400">No image</div>
          )}
        </div>

        {sortedMedia.length > 1 && (
          <div className="mt-2 flex gap-2">
            {sortedMedia.map((item, idx) => (
              <button
                key={item.order}
                onClick={() => setActiveMediaIdx(idx)}
                aria-label={`View image ${idx + 1}`}
                className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-md border transition-colors ${
                  idx === activeMediaIdx
                    ? 'border-teal-600'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <Image src={item.url} alt="" fill sizes="48px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{brandName}</p>
        <h1 className="mt-1 text-xl font-medium text-zinc-900 dark:text-zinc-50">{name}</h1>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-medium text-zinc-900 dark:text-zinc-50">
            {formatPrice(pricing.basePrice, pricing.currency)}
          </span>
          {pricing.compareAtPrice && (
            <span className="text-sm text-zinc-400 line-through">
              {formatPrice(pricing.compareAtPrice, pricing.currency)}
            </span>
          )}
          {discount && (
            <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
              {discount}% off
            </span>
          )}
        </div>

        {description && (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{description?.colorway}</p>
        )}

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {sizes.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">{sizeLabel}</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s, index) => {
                const soldOut = !s.active || s.stockQuantity === 0;
                const selected = s.size === selectedSize;
                return (
                  <button
                    key={index}
                    disabled={soldOut}
                    onClick={() => setSelectedSize(s.size)}
                    className={`min-w-11 rounded-md border px-3 py-2 text-sm transition-colors ${
                      soldOut
                        ? 'cursor-not-allowed border-zinc-200 text-zinc-300 line-through dark:border-zinc-800 dark:text-zinc-700'
                        : selected
                          ? 'border-2 border-teal-600 font-medium text-zinc-900 dark:text-zinc-50'
                          : 'border-zinc-200 text-zinc-700 hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    {s.size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedSizeOption && selectedSizeOption.stockQuantity > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-sm text-teal-700 dark:text-teal-400">
            <Check className="h-4 w-4" />
            <span>
              In stock &middot; {selectedSizeOption.stockQuantity} left in size{' '}
              {selectedSizeOption.size}
            </span>
          </div>
        )}

        <div className="mt-6 flex gap-2.5">
          <button
            disabled={!selectedSizeOption || selectedSizeOption.stockQuantity === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900"
          >
            <ShoppingBag className="h-4 w-4" />
            Add to cart
          </button>
          <button
            aria-label="Add to wishlist"
            className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 text-zinc-700 hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-300"
          >
            <Heart className="h-4 w-4" />
          </button>
        </div>

        {features.length > 0 && (
          <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">Features</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
              {features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
