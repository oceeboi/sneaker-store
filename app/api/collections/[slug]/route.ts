import { NextRequest } from 'next/server';

import { err, ok } from '@/lib/auth/response';
import connect_to_database from '@/lib/db';
import Collection from '@/models/Collection';
import { CollectionType } from '@/types/shared/product';

const public_collection_select_fields =
  'name slug description bannerImage active type rules sortOrder createdAt updatedAt';

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

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/collections/[slug]'>) {
  const { slug } = await ctx.params;

  await connect_to_database();

  const collection = await Collection.findOne({ slug, active: true })
    .select(public_collection_select_fields)
    .lean();
  if (!collection) {
    return err('Collection not found', 404);
  }

  return ok({ collection: serialize_collection(collection) });
}
