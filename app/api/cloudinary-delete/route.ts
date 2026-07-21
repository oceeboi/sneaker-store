import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth.middleware';
import { err } from '@/lib/auth/response';
import { cloudinaryDeleteRequestSchema } from '@/modules/cloudinary/schemas';
import { destroyCloudinaryAsset } from '@/modules/cloudinary/services';
import { Types } from 'mongoose';

export async function POST(request: Request) {
  try {
    const auth_result = await authenticateRequest();
    if ('error' in auth_result) {
      return err(auth_result.error ?? 'Unauthorized', 401);
    }

    if (!Types.ObjectId.isValid(auth_result.userId)) {
      return err('Unauthorized: Invalid user id', 401);
    }

    const parsed = cloudinaryDeleteRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Invalid delete request', 400);
    }

    const result = await destroyCloudinaryAsset(parsed.data);
    return NextResponse.json({ ok: true, data: result });
  } catch (error: unknown) {
    return err(error instanceof Error ? error.message : 'Failed to delete asset', 500);
  }
}
