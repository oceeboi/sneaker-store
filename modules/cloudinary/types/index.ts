export type CloudinaryResourceType = 'image' | 'video' | 'raw';

export type CloudinaryUploadPresetKey =
  'product-media' | 'profile-avatar' | 'brand-logo' | 'backgroud-image';

export type CloudinaryUploadPreset = {
  key: CloudinaryUploadPresetKey;
  label: string;
  folder: string;
  accept: string;
  maxBytes: number;
  resourceTypes: readonly CloudinaryResourceType[];
  tags: readonly string[];
};

export type CloudinaryAsset = {
  api_key: string;
  asset_folder: string;
  asset_id: string;
  bytes: number;
  created_at: string;
  display_name: string;
  etag: string;
  format: string;
  height: number;
  original_filename: string;
  placeholder: boolean;
  public_id: string;
  resource_type: CloudinaryResourceType;
  secure_url: string;
  signature: string;
  tags: string[];
  type: string;
  url: string;
  version: number;
  version_id: string;
  width: number;
};

export type CloudinarySignaturePayload = {
  apiKey: string;
  cloudName: string;
  signature: string;
  timestamp: number;
  folder: string;
  tags: string[];
  preset: CloudinaryUploadPresetKey;
  resourceType: CloudinaryResourceType;
  maxBytes: number;
  accept: string;
};

export type CloudinaryDeleteRequest = {
  publicId: string;
  preset: CloudinaryUploadPresetKey;
  resourceType?: CloudinaryResourceType;
};

export type CloudinaryUploadOptions = {
  preset?: CloudinaryUploadPresetKey;
  resourceType?: CloudinaryResourceType;
};
