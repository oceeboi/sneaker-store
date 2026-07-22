'use client';

import { Field, Input, Textarea } from '@/components/shared/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useAdminBrandQuery,
  useAdminBrandsQuery,
  useCreateAdminBrandMutation,
  useDeleteAdminBrandMutation,
  useReplaceAdminBrandMutation,
  useUpdateAdminBrandMutation,
} from '@/hooks/product.hook';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { UploadCard } from '@/modules/cloudinary/components';
import type { CloudinaryAsset } from '@/modules/cloudinary/types';
import { createBrandSchema, updateBrandSchema } from '@/schemas/catalog.schemas';
import { BrandData, CreateBrandInput, UpdateBrandInput } from '@/services/product.service';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

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

function format_date(value: Date | string) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function to_create_payload(values: CreateBrandInput): CreateBrandInput {
  return {
    name: values.name.trim(),
    slug: values.slug?.trim() ? values.slug.trim() : undefined,
    logo: values.logo?.trim() ? values.logo.trim() : null,
    description: values.description?.trim() ? values.description.trim() : null,
    website: values.website?.trim() ? values.website.trim() : null,
    active: values.active ?? true,
  };
}

function to_update_payload(
  values: UpdateBrandInput,
  dirty_fields: Partial<Record<keyof UpdateBrandInput, boolean>>
): UpdateBrandInput {
  const payload: UpdateBrandInput = {};

  if (dirty_fields.name && values.name?.trim()) payload.name = values.name.trim();
  if (dirty_fields.slug) payload.slug = values.slug?.trim() ? values.slug.trim() : undefined;
  if (dirty_fields.logo) payload.logo = values.logo?.trim() ? values.logo.trim() : null;
  if (dirty_fields.description) {
    payload.description = values.description?.trim() ? values.description.trim() : null;
  }
  if (dirty_fields.website) payload.website = values.website?.trim() ? values.website.trim() : null;
  if (dirty_fields.active) payload.active = values.active;

  return payload;
}

const column_helper = createColumnHelper<BrandData>();

export default function AdminProductsBrandsPage() {
  const [search, set_search] = useState('');
  const [selected_brand_id, set_selected_brand_id] = useState('');
  const debounced_search = useDebouncedValue(search, 300);

  const {
    data: brands,
    isLoading: is_brands_loading,
    error: brands_error,
  } = useAdminBrandsQuery({ search: debounced_search || undefined });

  const {
    data: selected_brand,
    isLoading: is_selected_brand_loading,
    error: selected_brand_error,
  } = useAdminBrandQuery(selected_brand_id);

  const { mutate: create_brand, isPending: is_creating } = useCreateAdminBrandMutation();
  const { mutate: update_brand, isPending: is_updating } = useUpdateAdminBrandMutation();
  const { mutate: replace_brand, isPending: is_replacing } = useReplaceAdminBrandMutation();
  const { mutate: delete_brand, isPending: is_deleting } = useDeleteAdminBrandMutation();

  const brand_create_form = useForm<CreateBrandInput>({
    resolver: zodResolver(createBrandSchema),
    defaultValues: {
      name: '',
      slug: undefined,
      logo: undefined,
      description: undefined,
      website: undefined,
      active: true,
    },
  });

  const brand_update_form = useForm<UpdateBrandInput>({
    resolver: zodResolver(updateBrandSchema),
    defaultValues: {
      name: undefined,
      slug: undefined,
      logo: undefined,
      description: undefined,
      website: undefined,
      active: undefined,
    },
  });

  const brand_replace_form = useForm<CreateBrandInput>({
    resolver: zodResolver(createBrandSchema),
    defaultValues: {
      name: '',
      slug: undefined,
      logo: undefined,
      description: undefined,
      website: undefined,
      active: true,
    },
  });

  useEffect(() => {
    if (!selected_brand) return;

    const hydrated_values = {
      name: selected_brand.name,
      slug: selected_brand.slug,
      logo: selected_brand.logo ?? undefined,
      description: selected_brand.description ?? undefined,
      website: selected_brand.website ?? undefined,
      active: selected_brand.active,
    };

    brand_update_form.reset(hydrated_values);
    brand_replace_form.reset(hydrated_values);
  }, [selected_brand, brand_update_form, brand_replace_form]);

  function brand_create_on_submit(values: CreateBrandInput) {
    create_brand(to_create_payload(values), {
      onSuccess: (brand) => {
        toast.success('Brand created successfully.');
        brand_create_form.reset();
        set_selected_brand_id(brand.id);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  }

  function brand_update_on_submit(values: UpdateBrandInput) {
    if (!selected_brand_id) {
      toast.error('Select a brand first.');
      return;
    }

    const payload = to_update_payload(
      values,
      brand_update_form.formState.dirtyFields as Partial<Record<keyof UpdateBrandInput, boolean>>
    );

    if (Object.keys(payload).length === 0) {
      toast.info('No changes to update yet.');
      return;
    }

    update_brand(
      { brandId: selected_brand_id, data: payload },
      {
        onSuccess: (brand) => {
          toast.success('Brand updated successfully.');
          brand_update_form.reset({
            name: brand.name,
            slug: brand.slug,
            logo: brand.logo ?? undefined,
            description: brand.description ?? undefined,
            website: brand.website ?? undefined,
            active: brand.active,
          });
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  }

  function brand_replace_on_submit(values: CreateBrandInput) {
    if (!selected_brand_id) {
      toast.error('Select a brand first.');
      return;
    }

    replace_brand(
      { brandId: selected_brand_id, data: to_create_payload(values) },
      {
        onSuccess: (brand) => {
          toast.success('Brand replaced successfully.');
          brand_replace_form.reset({
            name: brand.name,
            slug: brand.slug,
            logo: brand.logo ?? undefined,
            description: brand.description ?? undefined,
            website: brand.website ?? undefined,
            active: brand.active,
          });
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  }

  function handle_delete_brand() {
    if (!selected_brand_id) {
      toast.error('Select a brand first.');
      return;
    }

    const is_confirmed = window.confirm(
      'Delete this brand? This action cannot be undone and will fail if products still reference it.'
    );
    if (!is_confirmed) return;

    delete_brand(selected_brand_id, {
      onSuccess: () => {
        toast.success('Brand deleted successfully.');
        set_selected_brand_id('');
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  }

  const brand_rows = brands?.brands ?? [];

  const columns = useMemo(
    () => [
      column_helper.accessor('name', {
        header: () => (
          <span className="text-xs uppercase tracking-wide text-neutral-500">Brand</span>
        ),
        cell: (props) => <span className="font-semibold text-neutral-900">{props.getValue()}</span>,
      }),
      column_helper.accessor('slug', {
        header: () => (
          <span className="text-xs uppercase tracking-wide text-neutral-500">Slug</span>
        ),
        cell: (props) => <span className="text-sm text-neutral-600">{props.getValue()}</span>,
      }),
      column_helper.accessor('active', {
        header: () => (
          <span className="text-xs uppercase tracking-wide text-neutral-500">Status</span>
        ),
        cell: (props) => (
          <span className={props.getValue() ? 'text-sm text-green-700' : 'text-sm text-red-600'}>
            {props.getValue() ? 'Active' : 'Inactive'}
          </span>
        ),
      }),
      column_helper.accessor('updatedAt', {
        header: () => (
          <span className="text-xs uppercase tracking-wide text-neutral-500">Updated</span>
        ),
        cell: (props) => (
          <span className="text-sm text-neutral-500">{format_date(props.getValue())}</span>
        ),
      }),
      column_helper.display({
        id: 'actions',
        header: () => (
          <span className="text-xs uppercase tracking-wide text-neutral-500">Actions</span>
        ),
        cell: (props) => {
          const brand = props.row.original;
          const is_selected = selected_brand_id === brand.id;

          return (
            <button
              type="button"
              onClick={() => set_selected_brand_id(brand.id)}
              className="rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
            >
              {is_selected ? 'Selected' : 'View'}
            </button>
          );
        },
      }),
    ],
    [selected_brand_id]
  );

  const table = useReactTable({
    data: brand_rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const create_errors = brand_create_form.formState.errors;
  const update_errors = brand_update_form.formState.errors;
  const replace_errors = brand_replace_form.formState.errors;

  const is_create_loading = brand_create_form.formState.isSubmitting || is_creating;
  const selected_brand_title = selected_brand?.name ?? 'Select a brand';

  return (
    <section className="flex flex-col gap-6">
      <section className="rounded border bg-white/90 p-5 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-2">
          <h3 className="text-[24px] font-medium text-[#1d2128]">Brands Manager</h3>
          <p className="text-sm text-neutral-500">
            Create, view, edit, replace, and delete brands from one workspace.
          </p>
        </div>

        <div className="grid gap-6 ">
          <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h4 className="text-base font-semibold text-neutral-900">Brand List</h4>
              <p className="text-sm text-neutral-500">Total: {brands?.total ?? 0}</p>
            </div>

            <div className="mb-4">
              <Input
                value={search}
                onChange={(event) => set_search(event.target.value)}
                type="text"
                placeholder="Search by name or slug"
                autoComplete="off"
                disabled={is_brands_loading}
              />
            </div>

            {brands_error ? (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {brands_error.message}
              </div>
            ) : null}

            <div className="rounded border border-neutral-200">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((header_group) => (
                    <TableRow
                      key={header_group.id}
                      className="bg-neutral-50/80 hover:bg-neutral-50/80"
                    >
                      {header_group.headers.map((header) => (
                        <TableHead key={header.id} className="px-4 py-3">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {is_brands_loading ? (
                    <TableRow>
                      <TableCell className="px-4 py-6 text-sm text-neutral-500" colSpan={5}>
                        Loading brands...
                      </TableCell>
                    </TableRow>
                  ) : table.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell className="px-4 py-6 text-sm text-neutral-500" colSpan={5}>
                        No brands found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-neutral-50/60">
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="px-4 py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="space-y-6">
            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <div className="mb-4">
                <h4 className="text-base font-semibold text-neutral-900">Create Brand</h4>
                <p className="text-sm text-neutral-500">Add a new brand entry to your catalog.</p>
              </div>

              <form
                onSubmit={brand_create_form.handleSubmit(brand_create_on_submit)}
                className="space-y-5"
              >
                <div className="grid gap-5">
                  <Field
                    label="Brand Name"
                    error={create_errors.name?.message}
                    delay={100}
                    xx={true}
                  >
                    <Input
                      {...brand_create_form.register('name')}
                      type="text"
                      placeholder="Enter brand name"
                      autoComplete="off"
                      hasError={Boolean(create_errors.name)}
                      disabled={is_create_loading}
                    />
                  </Field>

                  <Field label="Slug" error={create_errors.slug?.message} delay={100} xx={false}>
                    <Input
                      {...brand_create_form.register('slug')}
                      type="text"
                      placeholder="Optional custom slug"
                      autoComplete="off"
                      hasError={Boolean(create_errors.slug)}
                      disabled={is_create_loading}
                    />
                  </Field>

                  <Field
                    label="Brand Description"
                    error={create_errors.description?.message}
                    delay={100}
                    xx={false}
                  >
                    <Textarea
                      {...brand_create_form.register('description')}
                      placeholder="Enter brand description"
                      rows={4}
                      hasError={Boolean(create_errors.description)}
                      disabled={is_create_loading}
                    />
                  </Field>

                  <Controller
                    name="logo"
                    control={brand_create_form.control}
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-semibold text-gray-700">
                          Brand Logo
                        </label>
                        <UploadCard
                          preset="brand-logo"
                          resourceType="image"
                          value={value ? to_cloudinary_asset(value) : null}
                          onChange={(asset) => {
                            const logo_url = asset?.secure_url ?? asset?.url ?? '';
                            onChange(logo_url || undefined);
                          }}
                          title="Upload Logo"
                          description="Upload PNG, SVG, JPG or WebP up to 8MB."
                          disabled={is_create_loading}
                          className="h-full"
                          accept="image/*"
                        />
                        {error?.message ? (
                          <p className="text-xs text-red-500 flex items-center gap-1">
                            <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
                            {error.message}
                          </p>
                        ) : null}
                      </div>
                    )}
                  />

                  <Field
                    label="Brand Website"
                    error={create_errors.website?.message}
                    delay={100}
                    xx={false}
                  >
                    <Input
                      {...brand_create_form.register('website')}
                      type="text"
                      placeholder="https://brand-name.com"
                      autoComplete="off"
                      hasError={Boolean(create_errors.website)}
                      disabled={is_create_loading}
                    />
                  </Field>

                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={brand_create_form.watch('active') ?? true}
                      onChange={(event) =>
                        brand_create_form.setValue('active', event.target.checked)
                      }
                    />
                    Brand is active
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={is_create_loading}
                  className="w-full rounded bg-[#1d2128] py-3 px-4 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {is_create_loading ? 'Creating Brand...' : 'Create Brand'}
                </button>
              </form>
            </section>

            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-neutral-900">Selected Brand</h4>
                  <p className="text-sm text-neutral-500">{selected_brand_title}</p>
                </div>
                <button
                  type="button"
                  onClick={handle_delete_brand}
                  disabled={!selected_brand_id || is_deleting}
                  className="rounded border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {is_deleting ? 'Deleting...' : 'Delete Brand'}
                </button>
              </div>

              {selected_brand_error ? (
                <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {selected_brand_error.message}
                </div>
              ) : null}

              {is_selected_brand_loading ? (
                <p className="text-sm text-neutral-500">Loading selected brand...</p>
              ) : selected_brand ? (
                <div className="space-y-6">
                  <div className="rounded border border-neutral-200 bg-neutral-50 p-4 text-sm">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p>
                        <span className="font-semibold text-neutral-900">Name:</span>{' '}
                        {selected_brand.name}
                      </p>
                      <p>
                        <span className="font-semibold text-neutral-900">Slug:</span>{' '}
                        {selected_brand.slug}
                      </p>
                      <p>
                        <span className="font-semibold text-neutral-900">Status:</span>{' '}
                        {selected_brand.active ? 'Active' : 'Inactive'}
                      </p>
                      <p>
                        <span className="font-semibold text-neutral-900">Updated:</span>{' '}
                        {format_date(selected_brand.updatedAt)}
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={brand_update_form.handleSubmit(brand_update_on_submit)}
                    className="space-y-5"
                  >
                    <h5 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
                      Edit Brand (PATCH)
                    </h5>

                    <div className="grid gap-5">
                      <Field
                        label="Brand Name"
                        error={update_errors.name?.message}
                        delay={100}
                        xx={false}
                      >
                        <Input
                          {...brand_update_form.register('name')}
                          type="text"
                          placeholder="Brand name"
                          autoComplete="off"
                          hasError={Boolean(update_errors.name)}
                          disabled={is_updating}
                        />
                      </Field>

                      <Field
                        label="Slug"
                        error={update_errors.slug?.message}
                        delay={100}
                        xx={false}
                      >
                        <Input
                          {...brand_update_form.register('slug')}
                          type="text"
                          placeholder="Brand slug"
                          autoComplete="off"
                          hasError={Boolean(update_errors.slug)}
                          disabled={is_updating}
                        />
                      </Field>

                      <Field
                        label="Description"
                        error={update_errors.description?.message}
                        delay={100}
                        xx={false}
                      >
                        <Textarea
                          {...brand_update_form.register('description')}
                          placeholder="Brand description"
                          rows={3}
                          hasError={Boolean(update_errors.description)}
                          disabled={is_updating}
                        />
                      </Field>

                      <Field
                        label="Website"
                        error={update_errors.website?.message}
                        delay={100}
                        xx={false}
                      >
                        <Input
                          {...brand_update_form.register('website')}
                          type="text"
                          placeholder="https://brand.com"
                          autoComplete="off"
                          hasError={Boolean(update_errors.website)}
                          disabled={is_updating}
                        />
                      </Field>

                      <Controller
                        name="logo"
                        control={brand_update_form.control}
                        render={({ field: { onChange, value }, fieldState: { error } }) => (
                          <div className="flex flex-col gap-1.5">
                            <label className="block text-sm font-semibold text-gray-700">
                              Brand Logo
                            </label>
                            <UploadCard
                              preset="brand-logo"
                              resourceType="image"
                              value={value ? to_cloudinary_asset(value) : null}
                              onChange={(asset) => {
                                const logo_url = asset?.secure_url ?? asset?.url ?? '';
                                onChange(logo_url || undefined);
                              }}
                              title="Update Logo"
                              description="Replace current logo or remove from card actions."
                              disabled={is_updating}
                              className="h-full"
                              accept="image/*"
                            />
                            {error?.message ? (
                              <p className="text-xs text-red-500 flex items-center gap-1">
                                <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
                                {error.message}
                              </p>
                            ) : null}
                          </div>
                        )}
                      />

                      <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={brand_update_form.watch('active') ?? false}
                          onChange={(event) =>
                            brand_update_form.setValue('active', event.target.checked, {
                              shouldDirty: true,
                            })
                          }
                        />
                        Brand is active
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={is_updating}
                      className="w-full rounded border border-neutral-300 py-3 px-4 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {is_updating ? 'Saving Changes...' : 'Save Changes'}
                    </button>
                  </form>

                  <form
                    onSubmit={brand_replace_form.handleSubmit(brand_replace_on_submit)}
                    className="space-y-5 border-t border-neutral-200 pt-6"
                  >
                    <h5 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
                      Replace Brand (PUT)
                    </h5>

                    <div className="grid gap-5">
                      <Field
                        label="Brand Name"
                        error={replace_errors.name?.message}
                        delay={100}
                        xx={true}
                      >
                        <Input
                          {...brand_replace_form.register('name')}
                          type="text"
                          placeholder="Brand name"
                          autoComplete="off"
                          hasError={Boolean(replace_errors.name)}
                          disabled={is_replacing}
                        />
                      </Field>

                      <Field
                        label="Slug"
                        error={replace_errors.slug?.message}
                        delay={100}
                        xx={false}
                      >
                        <Input
                          {...brand_replace_form.register('slug')}
                          type="text"
                          placeholder="Brand slug"
                          autoComplete="off"
                          hasError={Boolean(replace_errors.slug)}
                          disabled={is_replacing}
                        />
                      </Field>

                      <Field
                        label="Description"
                        error={replace_errors.description?.message}
                        delay={100}
                        xx={false}
                      >
                        <Textarea
                          {...brand_replace_form.register('description')}
                          placeholder="Brand description"
                          rows={3}
                          hasError={Boolean(replace_errors.description)}
                          disabled={is_replacing}
                        />
                      </Field>

                      <Field
                        label="Website"
                        error={replace_errors.website?.message}
                        delay={100}
                        xx={false}
                      >
                        <Input
                          {...brand_replace_form.register('website')}
                          type="text"
                          placeholder="https://brand.com"
                          autoComplete="off"
                          hasError={Boolean(replace_errors.website)}
                          disabled={is_replacing}
                        />
                      </Field>

                      <Controller
                        name="logo"
                        control={brand_replace_form.control}
                        render={({ field: { onChange, value }, fieldState: { error } }) => (
                          <div className="flex flex-col gap-1.5">
                            <label className="block text-sm font-semibold text-gray-700">
                              Brand Logo
                            </label>
                            <UploadCard
                              preset="brand-logo"
                              resourceType="image"
                              value={value ? to_cloudinary_asset(value) : null}
                              onChange={(asset) => {
                                const logo_url = asset?.secure_url ?? asset?.url ?? '';
                                onChange(logo_url || undefined);
                              }}
                              title="Replace Logo"
                              description="This will be used in full brand replacement."
                              disabled={is_replacing}
                              className="h-full"
                              accept="image/*"
                            />
                            {error?.message ? (
                              <p className="text-xs text-red-500 flex items-center gap-1">
                                <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
                                {error.message}
                              </p>
                            ) : null}
                          </div>
                        )}
                      />

                      <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={brand_replace_form.watch('active') ?? true}
                          onChange={(event) =>
                            brand_replace_form.setValue('active', event.target.checked, {
                              shouldDirty: true,
                            })
                          }
                        />
                        Brand is active
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={is_replacing}
                      className="w-full rounded border border-neutral-300 py-3 px-4 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {is_replacing ? 'Replacing Brand...' : 'Replace Brand'}
                    </button>
                  </form>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">
                  Select a brand from the table to view and manage it.
                </p>
              )}
            </section>
          </section>
        </div>
      </section>
    </section>
  );
}
