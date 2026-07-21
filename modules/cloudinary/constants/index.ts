import { STORE_DETAILS } from '@/constants/store-details';
import type { CloudinaryUploadPreset, CloudinaryUploadPresetKey } from '../types';

export const CLOUDINARY_ROOT_FOLDER = STORE_DETAILS.folder;

export const CLOUDINARY_UPLOAD_PRESETS: Record<CloudinaryUploadPresetKey, CloudinaryUploadPreset> =
  {
    'product-media': {
      key: 'product-media',
      label: 'Product media',
      folder: `${CLOUDINARY_ROOT_FOLDER}/products`,
      accept: 'image/*,video/*',
      maxBytes: 25 * 1024 * 1024,
      resourceTypes: ['image', 'video'],
      tags: ['product-media'],
    },
    'profile-avatar': {
      key: 'profile-avatar',
      label: 'Profile avatar',
      folder: `${CLOUDINARY_ROOT_FOLDER}/users/avatars`,
      accept: 'image/*',
      maxBytes: 5 * 1024 * 1024,
      resourceTypes: ['image'],
      tags: ['profile-avatar'],
    },
    'brand-logo': {
      key: 'brand-logo',
      label: 'Brand logo',
      folder: `${CLOUDINARY_ROOT_FOLDER}/brands`,
      accept: 'image/*',
      maxBytes: 8 * 1024 * 1024,
      resourceTypes: ['image'],
      tags: ['brand-logo'],
    },
    'backgroud-image': {
      key: 'backgroud-image',
      label: 'Background avatar',
      folder: `${CLOUDINARY_ROOT_FOLDER}/users/avatars`,
      accept: 'image/*',
      maxBytes: 5 * 1024 * 1024,
      resourceTypes: ['image'],
      tags: ['backgroud-image'],
    },
  };

export const DEFAULT_CLOUDINARY_PRESET: CloudinaryUploadPresetKey = 'product-media';
