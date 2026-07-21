'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageIcon, LoaderCircle, Trash2, Upload, Video } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useCloudinaryUpload } from '../hooks';
import { CLOUDINARY_UPLOAD_PRESETS } from '../constants';
import type { CloudinaryAsset, CloudinaryResourceType, CloudinaryUploadPresetKey } from '../types';
import { formatFileSize, isCloudinaryVideoAsset, resolveCloudinaryResourceType } from '../utils';

type UploadCardProps = {
  preset: CloudinaryUploadPresetKey;
  resourceType?: CloudinaryResourceType;
  value?: CloudinaryAsset | null;
  onChange?: (asset: CloudinaryAsset | null) => void;
  title?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  accept?: string;
};

export function UploadCard({
  preset,
  resourceType,
  value = null,
  onChange,
  title,
  description,
  disabled = false,
  className,
  accept,
}: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [asset, setAsset] = useState<CloudinaryAsset | null>(value);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<CloudinaryResourceType | null>(null);
  const presetConfig = CLOUDINARY_UPLOAD_PRESETS[preset];
  const { uploadAsset, deleteAsset, loading, error } = useCloudinaryUpload({
    preset,
    resourceType,
  });

  useEffect(() => {
    setAsset(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const currentAsset = asset;
  const currentPreviewUrl = previewUrl ?? currentAsset?.secure_url ?? currentAsset?.url ?? null;
  const currentPreviewType = previewType ?? currentAsset?.resource_type ?? null;
  const previewIsVideo = currentPreviewType === 'video' || isCloudinaryVideoAsset(currentAsset);

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const localPreviewUrl = URL.createObjectURL(file);
    const localPreviewType = resourceType ?? resolveCloudinaryResourceType(file);

    setPreviewUrl(localPreviewUrl);
    setPreviewType(localPreviewType);

    const uploadedAsset = await uploadAsset(file, {
      preset,
      resourceType: localPreviewType,
    });

    if (!uploadedAsset) {
      toast.error(error ?? 'Upload failed');
      return;
    }

    URL.revokeObjectURL(localPreviewUrl);
    setPreviewUrl(null);
    setPreviewType(null);
    setAsset(uploadedAsset);
    onChange?.(uploadedAsset);
    toast.success('Upload completed');
  }

  async function handleDelete() {
    if (!currentAsset) {
      return;
    }

    const deleted = await deleteAsset(currentAsset.public_id, {
      preset,
      resourceType: currentAsset.resource_type,
    });

    if (!deleted) {
      toast.error(error ?? 'Delete failed');
      console.error(error);
      return;
    }

    setAsset(null);
    onChange?.(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    toast.success('Asset removed');
  }

  return (
    <div
      className={cn(
        'w-full min-w-0 max-w-full rounded-2xl border border-neutral-200 bg-white p-3.5 sm:p-5',
        className
      )}
    >
      {(title || description) && (
        <div className="mb-4 space-y-1 min-w-0">
          {title && <h3 className="truncate text-base font-semibold text-neutral-950">{title}</h3>}
          {description && <p className="text-sm leading-6 text-neutral-600">{description}</p>}
        </div>
      )}

      <div
        onClick={() => {
          if (!disabled && !loading && !currentPreviewUrl) {
            inputRef.current?.click();
          }
        }}
        className={cn(
          'group relative flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl sm:rounded-2xl border border-dashed border-neutral-300 bg-[radial-gradient(circle_at_top_left,rgba(248,250,252,0.95),rgba(255,255,255,1)_55%,rgba(245,245,245,1))] transition-colors',
          !currentPreviewUrl && !disabled && !loading && 'cursor-pointer hover:border-neutral-400',
          disabled && 'cursor-not-allowed opacity-70'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept ?? presetConfig.accept}
          className="sr-only"
          disabled={disabled || loading}
          onChange={handleFileSelect}
        />

        {currentPreviewUrl ? (
          <div className="relative h-48 w-full max-w-full min-w-0 bg-neutral-950 sm:h-64">
            {previewIsVideo ? (
              <video
                src={currentPreviewUrl}
                controls
                className="h-full w-full max-w-full object-contain"
              />
            ) : (
              <img
                src={currentPreviewUrl}
                alt={currentAsset?.display_name ?? 'Uploaded asset preview'}
                className="h-full w-full max-w-full object-cover"
              />
            )}
          </div>
        ) : (
          <div className="flex min-h-40 w-full min-w-0 flex-col items-center justify-center gap-3 px-3 py-6 text-center sm:min-h-55 sm:px-6 sm:py-8">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white shadow-md sm:size-14">
              {presetConfig.resourceTypes.includes('video') ? (
                <Video className="size-5 sm:size-6" />
              ) : (
                <ImageIcon className="size-5 sm:size-6" />
              )}
            </div>
            <div className="w-full min-w-0 space-y-1">
              <p className="truncate text-sm font-semibold text-neutral-900 sm:text-base">
                Drop a file here or click to browse
              </p>
              <p className="truncate text-xs text-neutral-500 sm:text-sm">
                {presetConfig.accept} • up to {formatFileSize(presetConfig.maxBytes)}
              </p>
            </div>
          </div>
        )}

        {/* Footer controls container */}
        <div className="flex w-full min-w-0 flex-col gap-3 border-t border-neutral-200/80 bg-white/90 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="w-full hidden min-w-0 sm:w-auto sm:flex-1">
            <p className="truncate text-sm font-medium text-neutral-900">
              {currentAsset?.original_filename ?? 'No file selected'}
            </p>
            <p className="truncate text-xs text-neutral-500">
              {currentAsset
                ? `${currentAsset.resource_type} • ${formatFileSize(currentAsset.bytes)}`
                : `Allowed: ${presetConfig.resourceTypes.join(', ')}`}
            </p>
          </div>

          <div className="grid w-full shrink-0 grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:flex sm:w-auto sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              disabled={disabled || loading}
              className="w-full min-w-0 truncate sm:w-auto"
            >
              {loading ? (
                <LoaderCircle className="size-4 shrink-0 animate-spin" />
              ) : (
                <Upload className="size-4 shrink-0" />
              )}
              <span className="truncate">
                {loading ? 'Uploading...' : currentAsset ? 'Replace file' : 'Choose file'}
              </span>
            </Button>

            {currentAsset && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                disabled={disabled || loading}
                className="w-full min-w-0 hidden truncate sm:w-auto"
              >
                <Trash2 className="size-4 shrink-0" />
                <span className="truncate">Remove</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-3 wrap-break-word rounded-xl bg-red-50 p-2.5 text-xs text-red-700 sm:text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
