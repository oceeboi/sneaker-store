import { CLOUDINARY_UPLOAD_PRESETS, DEFAULT_CLOUDINARY_PRESET } from '../constants';
import type {
  CloudinaryAsset,
  CloudinaryResourceType,
  CloudinaryUploadPreset,
  CloudinaryUploadPresetKey,
} from '../types';

export function resolveCloudinaryResourceType(file: Pick<File, 'type'>): CloudinaryResourceType {
  if (file.type.startsWith('image/')) {
    return 'image';
  }

  if (file.type.startsWith('video/')) {
    return 'video';
  }

  return 'raw';
}

export function getCloudinaryPreset(
  preset: CloudinaryUploadPresetKey = DEFAULT_CLOUDINARY_PRESET
): CloudinaryUploadPreset {
  return CLOUDINARY_UPLOAD_PRESETS[preset];
}

export function isCloudinaryVideoAsset(asset: CloudinaryAsset | null | undefined): boolean {
  return asset?.resource_type === 'video';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function isPresetPublicId(publicId: string, preset: CloudinaryUploadPresetKey): boolean {
  return publicId.startsWith(`${getCloudinaryPreset(preset).folder}/`);
}
