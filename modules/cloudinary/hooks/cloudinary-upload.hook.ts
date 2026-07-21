import { useState } from 'react';

import { DEFAULT_CLOUDINARY_PRESET } from '../constants';
import type {
  CloudinaryAsset,
  CloudinaryDeleteRequest,
  CloudinaryResourceType,
  CloudinarySignaturePayload,
  CloudinaryUploadOptions,
} from '../types';
import { resolveCloudinaryResourceType } from '../utils';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();

    if (typeof data?.error === 'string') {
      return data.error;
    }

    if (typeof data?.message === 'string') {
      return data.message;
    }
  } catch {}

  return fallback;
}

export function useCloudinaryUpload(defaults: CloudinaryUploadOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asset, setAsset] = useState<CloudinaryAsset | null>(null);
  const [deleted, setDeleted] = useState(false);
  const preset = defaults.preset ?? DEFAULT_CLOUDINARY_PRESET;

  async function uploadAsset(file: File, options: CloudinaryUploadOptions = {}) {
    setLoading(true);
    setError(null);
    setDeleted(false);

    const resourceType =
      options.resourceType ?? defaults.resourceType ?? resolveCloudinaryResourceType(file);

    try {
      const query = new URLSearchParams({
        preset: options.preset ?? preset,
        resourceType,
      });
      const res = await fetch(`/api/cloudinary-sign?${query.toString()}`);

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, 'Failed to get Cloudinary signature'));
      }

      const signingData: CloudinarySignaturePayload = await res.json();

      if (file.size > signingData.maxBytes) {
        throw new Error(
          `File is larger than the ${Math.round(signingData.maxBytes / (1024 * 1024))}MB limit`
        );
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signingData.apiKey);
      formData.append('timestamp', signingData.timestamp.toString());
      formData.append('signature', signingData.signature);
      formData.append('folder', signingData.folder);

      if (signingData.tags.length > 0) {
        formData.append('tags', signingData.tags.join(','));
      }

      const cloudinaryRes = await fetch(
        `https://api.cloudinary.com/v1_1/${signingData.cloudName}/${signingData.resourceType}/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!cloudinaryRes.ok) {
        throw new Error(await readErrorMessage(cloudinaryRes, 'Cloudinary upload failed'));
      }

      const data: CloudinaryAsset = await cloudinaryRes.json();
      setAsset(data);
      return data;
    } catch (uploadError: unknown) {
      const message = getErrorMessage(uploadError, 'An error occurred during upload');
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function deleteAsset(
    publicId = asset?.public_id,
    options: CloudinaryUploadOptions = {}
  ): Promise<boolean> {
    setError(null);
    setDeleted(false);

    if (!publicId) {
      setError('No asset selected for deletion');
      return false;
    }

    const payload: CloudinaryDeleteRequest = {
      publicId,
      preset: options.preset ?? preset,
      resourceType: options.resourceType ?? defaults.resourceType ?? asset?.resource_type,
    };

    try {
      const res = await fetch('/api/cloudinary-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, 'Failed to delete asset'));
      }

      setAsset(null);
      setDeleted(true);
      return true;
    } catch (deleteError: unknown) {
      setError(getErrorMessage(deleteError, 'An error occurred during delete'));
      return false;
    }
  }

  return {
    uploadAsset,
    uploadImage: uploadAsset,
    deleteAsset,
    deleteImage: deleteAsset,
    loading,
    error,
    asset,
    url: asset?.secure_url ?? null,
    deleted,
    publicId: asset?.public_id ?? null,
  };
}
