import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth.middleware';
import { err } from '@/lib/auth/response';
import { cloudinarySignRequestSchema } from '@/modules/cloudinary/schemas';
import { createCloudinarySignature } from '@/modules/cloudinary/services';
import { Types } from 'mongoose';

export async function GET(request: Request) {
  try {
    const auth_result = await authenticateRequest();
    if ('error' in auth_result) {
      return err(auth_result.error ?? 'Unauthorized', 401);
    }

    if (!Types.ObjectId.isValid(auth_result.userId)) {
      return err('Unauthorized: Invalid user id', 401);
    }

    const searchParams = new URL(request.url).searchParams;
    const parsed = cloudinarySignRequestSchema.safeParse({
      preset: searchParams.get('preset') ?? undefined,
      resourceType: searchParams.get('resourceType') ?? undefined,
    });

    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Invalid upload signature request', 400);
    }

    return NextResponse.json(createCloudinarySignature(parsed.data));
  } catch (error: unknown) {
    return err(error instanceof Error ? error.message : 'Failed to sign upload request', 500);
  }
}
