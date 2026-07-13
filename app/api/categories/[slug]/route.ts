import { NextRequest } from 'next/server';

import { err, ok } from '@/lib/auth/response';
import connect_to_database from '@/lib/db';
import Category from '@/models/Category';

const public_category_select_fields =
  'name slug parent image description sortOrder active createdAt updatedAt';

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

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/categories/[slug]'>) {
  const { slug } = await ctx.params;

  await connect_to_database();

  const category = await Category.findOne({ slug, active: true })
    .select(public_category_select_fields)
    .lean();
  if (!category) {
    return err('Category not found', 404);
  }

  return ok({ category: serialize_category(category) });
}
