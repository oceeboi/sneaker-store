import { NextRequest } from 'next/server';

import { err, ok } from '@/lib/auth/response';
import connect_to_database from '@/lib/db';
import Brand from '@/models/Brand';

const public_brand_select_fields = 'name slug logo description website active createdAt updatedAt';

function escape_regex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parse_positive_int(value: string | null, fallback: number, max: number) {
  if (!value) return fallback;

  const parsed_value = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed_value) || parsed_value < 1) {
    return fallback;
  }

  return Math.min(parsed_value, max);
}

function serialize_brand(brand: {
  _id: { toString(): string };
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  website: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: brand._id.toString(),
    name: brand.name,
    slug: brand.slug,
    logo: brand.logo,
    description: brand.description,
    website: brand.website,
    active: brand.active,
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  const search_term = req.nextUrl.searchParams.get('search')?.trim();
  const page = parse_positive_int(req.nextUrl.searchParams.get('page'), 1, Number.MAX_SAFE_INTEGER);
  const limit = parse_positive_int(req.nextUrl.searchParams.get('limit'), 24, 100);

  const query: Record<string, unknown> = {
    active: true,
  };

  if (search_term) {
    const safe_search_term = escape_regex(search_term);
    const prefix_regex = new RegExp(`^${safe_search_term}`, 'i');

    query.$or = [{ name: prefix_regex }, { slug: prefix_regex }];
  }

  await connect_to_database();

  const skip = (page - 1) * limit;

  const [total, brands] = await Promise.all([
    Brand.countDocuments(query),
    Brand.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .select(public_brand_select_fields)
      .lean(),
  ]);

  if (page > 1 && skip >= total) {
    return err('Page out of range', 400);
  }

  return ok({
    brands: brands.map(serialize_brand),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}
