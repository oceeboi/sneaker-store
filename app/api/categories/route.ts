import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { err, ok } from '@/lib/auth/response';
import connect_to_database from '@/lib/db';
import Category from '@/models/Category';

const public_category_select_fields =
  'name slug parent image description sortOrder active createdAt updatedAt';

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

function serialize_category(category: {
  _id: { toString(): string };
  name: string;
  slug: string;
  parent: { toString(): string } | null;
  image: string | null;
  description: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    parentId: category.parent?.toString() ?? null,
    image: category.image,
    description: category.description,
    sortOrder: category.sortOrder,
    active: category.active,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  const search_term = req.nextUrl.searchParams.get('search')?.trim();
  const parent_filter = req.nextUrl.searchParams.get('parent');
  const page = parse_positive_int(req.nextUrl.searchParams.get('page'), 1, Number.MAX_SAFE_INTEGER);
  const limit = parse_positive_int(req.nextUrl.searchParams.get('limit'), 32, 100);

  const query: Record<string, unknown> = {
    active: true,
  };

  if (search_term) {
    const safe_search_term = escape_regex(search_term);
    const prefix_regex = new RegExp(`^${safe_search_term}`, 'i');

    query.$or = [{ name: prefix_regex }, { slug: prefix_regex }];
  }

  if (parent_filter === 'null') {
    query.parent = null;
  } else if (parent_filter) {
    if (!Types.ObjectId.isValid(parent_filter)) {
      return err('Invalid parent filter', 400);
    }
    query.parent = new Types.ObjectId(parent_filter);
  }

  await connect_to_database();

  const skip = (page - 1) * limit;

  const [total, categories] = await Promise.all([
    Category.countDocuments(query),
    Category.find(query)
      .sort({ sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .select(public_category_select_fields)
      .lean(),
  ]);

  if (page > 1 && skip >= total) {
    return err('Page out of range', 400);
  }

  return ok({
    categories: categories.map(serialize_category),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}
