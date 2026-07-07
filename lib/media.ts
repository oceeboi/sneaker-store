import { MediaType } from '@/types/shared/product';

/**
 * Normalizes media items by:
 * 1. Sanitizing admin-provided `order` values (clamp to valid range)
 * 2. Sorting by requested order with stable tie-breaking on original index
 * 3. Reassigning guarantee unique sequential order 0..n-1
 *
 * This ensures duplicates, gaps, or invalid orders cannot persist in storage.
 */
export function normalize_media(
  media:
    | {
        url: string;
        alt: string;
        type?: MediaType;
        order?: number;
      }[]
    | undefined
): { url: string; alt: string; type: MediaType; order: number }[] {
  if (!media || media.length === 0) return [];

  // Sanitize: extract valid order hints, use original index as tie-breaker
  const indexed_media = media.map((item, original_index) => {
    let sanitized_order = original_index; // default to insertion order

    if (typeof item.order === 'number' && Number.isFinite(item.order)) {
      // Clamp to [0, array_length) to prevent sorting anomalies
      sanitized_order = Math.max(0, Math.min(Math.floor(item.order), media.length - 1));
    }

    return {
      item,
      original_index,
      sanitized_order,
    };
  });

  // Stable sort: by sanitized order, then by original insertion index
  indexed_media.sort((a, b) => {
    const order_diff = a.sanitized_order - b.sanitized_order;
    return order_diff !== 0 ? order_diff : a.original_index - b.original_index;
  });

  // Reassign clean sequential order 0..n-1
  return indexed_media.map(({ item }, sequential_index) => ({
    url: item.url,
    alt: item.alt,
    type: item.type ?? MediaType.IMAGE,
    order: sequential_index,
  }));
}
