'use client';

import { Field, Input, Textarea } from '@/components/shared/form';
import {
  useAdminBrandQuery,
  useAdminBrandsQuery,
  useCreateAdminBrandMutation,
  useDeleteAdminBrandMutation,
  useReplaceAdminBrandMutation,
  useUpdateAdminBrandMutation,
} from '@/hooks/product.hook';
import { UploadCard } from '@/modules/cloudinary/components/upload-card';
import { createBrandSchema, updateBrandSchema } from '@/schemas/catalog.schemas';
import { CreateBrandInput, UpdateBrandInput } from '@/services/product.service';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import type { CloudinaryAsset } from '@/modules/cloudinary/types';
function to_cloudinary_asset(value: string): CloudinaryAsset {
  return {
    api_key: '',
    asset_folder: '',
    asset_id: value,
    bytes: 0,
    created_at: new Date(0).toISOString(),
    display_name: 'Brand Logo',
    etag: '',
    format: '',
    height: 0,
    original_filename: 'brand-logo',
    placeholder: false,
    public_id: value,
    resource_type: 'image',
    secure_url: value,
    signature: '',
    tags: ['brand-logo'],
    type: 'upload',
    url: value,
    version: 1,
    version_id: '',
    width: 0,
  };
}

export default function AdminProductsBrandsPage() {
  const { data: brands, isLoading: isBrandsLoading } = useAdminBrandsQuery({});
  const { data: brand_by_id } = useAdminBrandQuery('');

  const { mutate: create_brand, isPending: isCreating } = useCreateAdminBrandMutation();
  const { mutate: update_brand } = useUpdateAdminBrandMutation();
  const { mutate: replace_brand } = useReplaceAdminBrandMutation();
  const { mutate: delete_brand } = useDeleteAdminBrandMutation();

  // 1. Properly initialized default values to match CreateBrandInput / Zod schema
  const brand_create_form = useForm<CreateBrandInput>({
    resolver: zodResolver(createBrandSchema),
    defaultValues: {
      name: '',
      description: '',
      logo: '',
    },
  });

  const brand_update_form = useForm<UpdateBrandInput>({
    resolver: zodResolver(updateBrandSchema),
    defaultValues: {
      name: '',
      description: '',
      logo: '',
    },
  });

  const brand_replace_form = useForm<CreateBrandInput>({
    resolver: zodResolver(createBrandSchema),
    defaultValues: {
      name: '',
      description: '',
      logo: '',
    },
  });

  // 2. Submit Handlers connected to mutations
  function brand_create_on_submit(data: CreateBrandInput) {
    create_brand(data, {
      onSuccess: () => {
        brand_create_form.reset();
      },
    });
  }

  function brand_update_on_submit(data: UpdateBrandInput) {
    // update_brand(data);
  }

  function brand_replace_on_submit(data: CreateBrandInput) {
    // replace_brand(data);
  }

  const { errors, isSubmitting } = brand_create_form.formState;
  const isLoadingState = isSubmitting || isCreating;

  return (
    <section className="">
      <section className="border border-border bg-card p-6 rounded ">
        <div className="mb-6">
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">Add Brand</h3>
          <p className="text-sm text-muted-foreground">
            Create a new product brand for your store catalog.
          </p>
        </div>

        <form
          onSubmit={brand_create_form.handleSubmit(brand_create_on_submit)}
          className="space-y-6"
        >
          <div className="grid gap-5">
            {/* Brand Name Input */}
            <Field label="Brand Name" error={errors.name?.message} delay={100} xx={true}>
              <Input
                {...brand_create_form.register('name')}
                type="text"
                placeholder="Enter Brand Name"
                autoComplete="off"
                hasError={Boolean(errors.name)}
                disabled={isLoadingState}
              />
            </Field>

            {/* Brand Description Textarea */}
            <Field
              label="Brand Description"
              error={errors.description?.message}
              delay={100}
              xx={false}
            >
              <Textarea
                {...brand_create_form.register('description')}
                placeholder="Enter Brand description"
                rows={4}
                hasError={Boolean(errors.description)}
                disabled={isLoadingState}
              />
            </Field>

            {/* Brand Logo Upload Field */}
            <Controller
              name="logo"
              control={brand_create_form.control}
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Brand Logo</label>
                  <UploadCard
                    preset="brand-logo"
                    resourceType="image"
                    value={value ? to_cloudinary_asset(value) : null}
                    onChange={(asset) => {
                      const logo_url = asset?.secure_url ?? asset?.url ?? '';
                      onChange(logo_url);
                    }}
                    title="Upload Logo"
                    description="Upload brand emblem. PNG, SVG, JPG or WebP up to 5MB."
                    disabled={isLoadingState}
                    className="h-full"
                    accept="image/*"
                  />
                  {error?.message && (
                    <p className="text-red-500 text-xs mt-1 font-medium">{error.message}</p>
                  )}
                </div>
              )}
            />

            {/* Brand Name Input */}
            <Field label="Brand Website" error={errors.website?.message} delay={100} xx={true}>
              <Input
                {...brand_create_form.register('website')}
                type="text"
                placeholder="https://brand-name.com"
                autoComplete="off"
                hasError={Boolean(errors.website)}
                disabled={isLoadingState}
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={isLoadingState}
            className="w-full rounded-md bg-primary py-3 px-4 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoadingState ? 'Adding Brand...' : 'Add Brand'}
          </button>
        </form>
      </section>
    </section>
  );
}
