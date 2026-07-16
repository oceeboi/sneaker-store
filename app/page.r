'use client';

import { useParams } from 'next/navigation';

import ProductDetail, {
  type IMedia,
  type ISizeOption,
  type ProductDetailProps,
} from '@/components/test-ui/product-details';
import { usePublicProductQuery } from '@/hooks/product.hook';
import type { ProductData, ProductMedia } from '@/services/product.service';
import { Authorized } from '@/components/layout/authorized-layout';

// ─── Mapping: service shape -> presentation shape ──────────────────────────
// Lives here, not inside ProductDetail, so the component stays reusable and
// this page stays the single place that knows about the API's data model.

function toMediaItems(media: ProductMedia[]): IMedia[] {
  return media
    .filter(
      (item): item is ProductMedia & { type: 'image' | 'video' } =>
        item.type === 'image' || item.type === 'video'
    )
    .map((item) => ({ url: item.url, alt: item.alt, type: item.type, order: item.order }));
}

function toSizeOptions(sizes: ProductData['sizes']): ISizeOption[] {
  return sizes.map((s) => ({
    size: s.size,
    sku: s.sku,
    // `availableQuantity` (stock minus quantity already reserved by other
    // in-progress checkouts) is what's actually purchasable right now.
    // Using raw `stockQuantity` here would let two customers both see
    // "in stock" on the last unit while it's held in someone else's cart.
    stockQuantity: s.availableQuantity,
    active: s.active,
  }));
}

function toProductDetailProps(product: ProductData): ProductDetailProps {
  return {
    name: product.name,
    brandName: product.brand?.name ?? 'Unbranded',
    description: product?.description,
    features: product.features,
    tags: product.tags,
    media: toMediaItems(product.media),
    sizes: toSizeOptions(product.sizes),
    pricing: {
      currency: product.pricing.currency,
      basePrice: product.pricing.basePrice,
      compareAtPrice: product.pricing.compareAtPrice,
    },
    sizeLabel: product.productType === 'sneaker' ? 'Size (EU)' : 'Size',
  };
}

// ─── Loading skeleton ───────────────────────────────────────────────────────
// Mirrors ProductDetail's grid exactly so there's zero layout shift when real
// data swaps in — important on the slower mobile connections this storefront
// is being built for.

function ProductDetailSkeleton() {
  return (
    <div className="mx-auto grid max-w-3xl animate-pulse grid-cols-1 gap-8 sm:grid-cols-[280px_1fr]">
      <div className="aspect-square rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="space-y-3">
        <div className="h-3 w-20 rounded bg-zinc-100 dark:bg-zinc-900" />
        <div className="h-6 w-48 rounded bg-zinc-100 dark:bg-zinc-900" />
        <div className="h-7 w-28 rounded bg-zinc-100 dark:bg-zinc-900" />
        <div className="h-16 w-full rounded bg-zinc-100 dark:bg-zinc-900" />
        <div className="h-10 w-full rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>
    </div>
  );
}

// ─── Error state ────────────────────────────────────────────────────────────

function ProductDetailError({ message }: { message: string }) {
  // ProductService.getProductBySlug overrides its 404 message to exactly
  // "Product not found." — matching on that string lets this page show a
  // dedicated empty state instead of a generic error banner, without the
  // hook needing to carry a separate error-code field.
  const isNotFound = message === 'Product not found.';

  return (
    <div className="mx-auto max-w-3xl py-16 text-center">
      <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        {isNotFound ? 'Product not found' : 'Something went wrong'}
      </p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {isNotFound
          ? "The product you're looking for doesn't exist or is no longer available."
          : message}
      </p>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
// Route: app/products/[slug]/page.tsx
//
// Uses `useParams` (client-only, resolves synchronously) instead of reading
// `params` off props, so this page is unaffected by the Next.js 15 change
// that made server-passed `params`/`searchParams` a Promise — that change
// only applies to how the framework hands params to the component; a client
// hook like `useParams` sidesteps it entirely.

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();

  const productQuery = usePublicProductQuery('nike-air-force-1-07');

  if (productQuery.isPending) {
    return <ProductDetailSkeleton />;
  }

  if (productQuery.isError) {
    return <ProductDetailError message={productQuery.error.message} />;
  }

  return <ProductDetail {...toProductDetailProps(productQuery.data)} />;
}
