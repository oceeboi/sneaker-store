import { NextRequest } from 'next/server';

import { err, ok } from '@/lib/auth/response';
import connect_to_database from '@/lib/db';
import Collection from '@/models/Collection';
import { CollectionType } from '@/types/shared/product';

const public_collection_select_fields =
  'name slug description bannerImage active type rules sortOrder createdAt updatedAt';

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

function serialize_collection(collection: {
  _id: { toString(): string };
  name: string;
  slug: string;
  description: string | null;
  bannerImage: string | null;
  active: boolean;
  type: CollectionType;
  rules: { field: string; operator: string; value: string }[];
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: collection._id.toString(),
    name: collection.name,
    slug: collection.slug,
    description: collection.description,
    bannerImage: collection.bannerImage,
    active: collection.active,
    type: collection.type,
    rules: collection.rules,
    sortOrder: collection.sortOrder,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  const search_term = req.nextUrl.searchParams.get('search')?.trim();
  const type_filter = req.nextUrl.searchParams.get('type');
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

  if (type_filter) {
    if (type_filter !== CollectionType.MANUAL && type_filter !== CollectionType.SMART) {
      return err('Invalid collection type filter', 400);
    }
    query.type = type_filter;
  }

  await connect_to_database();

  const skip = (page - 1) * limit;

  const [total, collections] = await Promise.all([
    Collection.countDocuments(query),
    Collection.find(query)
      .sort({ sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .select(public_collection_select_fields)
      .lean(),
  ]);

  if (page > 1 && skip >= total) {
    return err('Page out of range', 400);
  }

  return ok({
    collections: collections.map(serialize_collection),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}
