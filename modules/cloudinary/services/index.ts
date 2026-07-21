import 'server-only';

import { v2 as cloudinary } from 'cloudinary';

import { getCloudinaryPreset, isPresetPublicId } from '../utils';
import type {
  CloudinaryDeleteRequest,
  CloudinaryResourceType,
  CloudinarySignaturePayload,
  CloudinaryUploadPresetKey,
} from '../types';

type CloudinaryEnv = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

let cloudinaryConfigured = false;

function getCloudinaryEnv(): CloudinaryEnv {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary environment variables are not configured');
  }

  return { cloudName, apiKey, apiSecret };
}

function ensureCloudinaryConfig(): CloudinaryEnv {
  const env = getCloudinaryEnv();

  if (!cloudinaryConfigured) {
    cloudinary.config({
      cloud_name: env.cloudName,
      api_key: env.apiKey,
      api_secret: env.apiSecret,
      secure: true,
    });

    cloudinaryConfigured = true;
  }

  return env;
}

function resolvePresetResourceType(
  preset: CloudinaryUploadPresetKey,
  resourceType?: CloudinaryResourceType
): CloudinaryResourceType {
  const config = getCloudinaryPreset(preset);
  const nextResourceType = resourceType ?? config.resourceTypes[0];

  if (!config.resourceTypes.includes(nextResourceType)) {
    throw new Error(`Preset ${preset} does not allow ${nextResourceType} uploads`);
  }

  return nextResourceType;
}

export function createCloudinarySignature(input: {
  preset: CloudinaryUploadPresetKey;
  resourceType?: CloudinaryResourceType;
}): CloudinarySignaturePayload {
  const env = ensureCloudinaryConfig();
  const preset = getCloudinaryPreset(input.preset);
  const resourceType = resolvePresetResourceType(input.preset, input.resourceType);
  const timestamp = Math.floor(Date.now() / 1000);
  const tags = [...preset.tags];
  const paramsToSign = {
    folder: preset.folder,
    tags: tags.join(','),
    timestamp,
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.apiSecret);

  return {
    apiKey: env.apiKey,
    cloudName: env.cloudName,
    signature,
    timestamp,
    folder: preset.folder,
    tags,
    preset: input.preset,
    resourceType,
    maxBytes: preset.maxBytes,
    accept: preset.accept,
  };
}

export async function destroyCloudinaryAsset(input: CloudinaryDeleteRequest) {
  ensureCloudinaryConfig();

  if (!isPresetPublicId(input.publicId, input.preset)) {
    throw new Error('publicId does not belong to the requested upload preset');
  }

  const resourceType = resolvePresetResourceType(input.preset, input.resourceType);

  return cloudinary.uploader.destroy(input.publicId, {
    resource_type: resourceType,
  });
}
