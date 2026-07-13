import { NextRequest } from 'next/server';

import { err, ok } from '@/lib/auth/response';
import connect_to_database from '@/lib/db';
import Brand from '@/models/Brand';

const public_brand_select_fields = 'name slug logo description website active createdAt updatedAt';

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

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/brands/[slug]'>) {
  const { slug } = await ctx.params;

  await connect_to_database();

  const brand = await Brand.findOne({ slug, active: true })
    .select(public_brand_select_fields)
    .lean();
  if (!brand) {
    return err('Brand not found', 404);
  }

  return ok({ brand: serialize_brand(brand) });
}
