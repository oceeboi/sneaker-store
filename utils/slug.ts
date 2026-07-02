/**
 * Converts any string to a URL-safe slug.
 * "Nike Air Force 1 '07" → "nike-air-force-1-07"
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD') // decompose accented chars
    .replace(/[\u0300-\u036f]/g, '') // strip accent marks
    .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric
    .replace(/[\s_]+/g, '-') // spaces → hyphens
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-|-$/g, ''); // trim leading/trailing hyphens
}

type SlugModel = {
  exists: (filter: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Generates a unique slug for a collection/model by appending a numeric suffix
 * when needed (e.g. "nike" -> "nike-2").
 */
export async function generateUniqueSlug(
  model: SlugModel,
  value: string,
  currentId?: string
): Promise<string> {
  const base_slug = slugify(value) || 'item';
  let candidate_slug = base_slug;
  let suffix = 2;

  while (
    await model.exists({
      slug: candidate_slug,
      ...(currentId ? { _id: { $ne: currentId } } : {}),
    })
  ) {
    candidate_slug = `${base_slug}-${suffix}`;
    suffix += 1;
  }

  return candidate_slug;
}
