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
  useAdminCategoriesQuery,
  useAdminCategoryQuery,
  useCreateAdminCategoryMutation,
  useDeleteAdminCategoryMutation,
  useReplaceAdminCategoryMutation,
  useUpdateAdminCategoryMutation,
} from '@/hooks/product.hook';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { UploadCard } from '@/modules/cloudinary/components';
import type { CloudinaryAsset } from '@/modules/cloudinary/types';
import { createCategorySchema, updateCategorySchema } from '@/schemas/catalog.schemas';
import { CategoryData, CreateCategoryInput, UpdateCategoryInput } from '@/services/product.service';
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
import { z } from 'zod';

type CreateCategoryFormValues = z.input<typeof createCategorySchema>;
type UpdateCategoryFormValues = z.input<typeof updateCategorySchema>;

function to_cloudinary_asset(value: string): CloudinaryAsset {
  return {
    api_key: '',
    asset_folder: '',
    asset_id: value,
    bytes: 0,
    created_at: new Date(0).toISOString(),
    display_name: 'Category Image',
    etag: '',
    format: '',
    height: 0,
    original_filename: 'category-image',
    placeholder: false,
    public_id: value,
    resource_type: 'image',
    secure_url: value,
    signature: '',
    tags: ['category-image'],
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

function to_create_payload(values: CreateCategoryInput): CreateCategoryInput {
  return {
    name: values.name.trim(),
    slug: values.slug?.trim() ? values.slug.trim() : undefined,
    parent: values.parent?.trim() ? values.parent.trim() : null,
    image: values.image?.trim() ? values.image.trim() : null,
    description: values.description?.trim() ? values.description.trim() : null,
    sortOrder: values.sortOrder ?? 0,
    active: values.active ?? true,
  };
}

function to_update_payload(
  values: UpdateCategoryInput,
  dirty_fields: Partial<Record<keyof UpdateCategoryInput, boolean>>
): UpdateCategoryInput {
  const payload: UpdateCategoryInput = {};

  if (dirty_fields.name && values.name?.trim()) payload.name = values.name.trim();
  if (dirty_fields.slug) payload.slug = values.slug?.trim() ? values.slug.trim() : undefined;
  if (dirty_fields.parent) payload.parent = values.parent?.trim() ? values.parent.trim() : null;
  if (dirty_fields.image) payload.image = values.image?.trim() ? values.image.trim() : null;
  if (dirty_fields.description) {
    payload.description = values.description?.trim() ? values.description.trim() : null;
  }
  if (dirty_fields.sortOrder) payload.sortOrder = values.sortOrder;
  if (dirty_fields.active) payload.active = values.active;

  return payload;
}

function category_to_form_values(category: CategoryData): CreateCategoryInput {
  return {
    name: category.name,
    slug: category.slug,
    parent: category.parentId,
    image: category.image ?? undefined,
    description: category.description ?? undefined,
    sortOrder: category.sortOrder,
    active: category.active,
  };
}

const column_helper = createColumnHelper<CategoryData>();

export default function AdminProductsCatgoriesPage() {
  const [search, set_search] = useState('');
  const [selected_category_id, set_selected_category_id] = useState<string | null>(null);
  const debounced_search = useDebouncedValue(search, 300);

  const {
    data: categories,
    isLoading: is_categories_loading,
    error: categories_error,
  } = useAdminCategoriesQuery({ search: debounced_search || undefined });

  const {
    data: selected_category,
    isLoading: is_selected_category_loading,
    error: selected_category_error,
  } = useAdminCategoryQuery(selected_category_id ?? '');

  const { mutate: create_category, isPending: is_creating } = useCreateAdminCategoryMutation();
  const { mutate: update_category, isPending: is_updating } = useUpdateAdminCategoryMutation();
  const { mutate: replace_category, isPending: is_replacing } = useReplaceAdminCategoryMutation();
  const { mutate: delete_category, isPending: is_deleting } = useDeleteAdminCategoryMutation();

  const category_create_form = useForm<CreateCategoryFormValues, unknown, CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      name: '',
      slug: undefined,
      parent: null,
      image: undefined,
      description: undefined,
      sortOrder: 0,
      active: true,
    },
  });

  const category_update_form = useForm<UpdateCategoryFormValues, unknown, UpdateCategoryInput>({
    resolver: zodResolver(updateCategorySchema),
    defaultValues: {
      name: undefined,
      slug: undefined,
      parent: undefined,
      image: undefined,
      description: undefined,
      sortOrder: undefined,
      active: undefined,
    },
  });

  const category_replace_form = useForm<CreateCategoryFormValues, unknown, CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      name: '',
      slug: undefined,
      parent: null,
      image: undefined,
      description: undefined,
      sortOrder: 0,
      active: true,
    },
  });

  const category_rows = categories?.categories ?? [];

  const category_map = useMemo(
    () => new Map(category_rows.map((category) => [category.id, category])),
    [category_rows]
  );

  const child_map = useMemo(() => {
    const next_map = new Map<string, string[]>();

    for (const category of category_rows) {
      if (!category.parentId) continue;
      const existing_children = next_map.get(category.parentId) ?? [];
      existing_children.push(category.id);
      next_map.set(category.parentId, existing_children);
    }

    return next_map;
  }, [category_rows]);

  const blocked_parent_ids = useMemo(() => {
    if (!selected_category_id) return new Set<string>();

    const blocked_ids = new Set<string>([selected_category_id]);
    const stack = [...(child_map.get(selected_category_id) ?? [])];

    while (stack.length > 0) {
      const current_id = stack.pop();
      if (!current_id || blocked_ids.has(current_id)) continue;

      blocked_ids.add(current_id);
      stack.push(...(child_map.get(current_id) ?? []));
    }

    return blocked_ids;
  }, [child_map, selected_category_id]);

  const parent_options = useMemo(
    () => category_rows.filter((category) => !blocked_parent_ids.has(category.id)),
    [blocked_parent_ids, category_rows]
  );

  function get_parent_name(parent_id: string | null) {
    if (!parent_id) return 'Root category';
    return category_map.get(parent_id)?.name ?? 'Unknown parent';
  }

  function get_category_path(category: CategoryData) {
    const parts = [category.name];
    let cursor = category.parentId;
    const visited = new Set<string>();

    while (cursor && !visited.has(cursor)) {
      visited.add(cursor);
      const parent = category_map.get(cursor);
      if (!parent) break;
      parts.unshift(parent.name);
      cursor = parent.parentId;
    }

    return parts.join(' / ');
  }

  useEffect(() => {
    if (!selected_category) return;

    const hydrated_values = category_to_form_values(selected_category);
    category_update_form.reset(hydrated_values);
    category_replace_form.reset(hydrated_values);
  }, [selected_category, category_update_form, category_replace_form]);

  function category_create_on_submit(values: CreateCategoryInput) {
    create_category(to_create_payload(values), {
      onSuccess: (category) => {
        toast.success('Category created successfully.');
        category_create_form.reset();
        set_selected_category_id(category.id);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  }

  function category_update_on_submit(values: UpdateCategoryInput) {
    if (!selected_category_id) {
      toast.error('Select a category first.');
      return;
    }

    const payload = to_update_payload(
      values,
      category_update_form.formState.dirtyFields as Partial<
        Record<keyof UpdateCategoryInput, boolean>
      >
    );

    if (Object.keys(payload).length === 0) {
      toast.info('No changes to update yet.');
      return;
    }

    update_category(
      { categoryId: selected_category_id, data: payload },
      {
        onSuccess: (category) => {
          toast.success('Category updated successfully.');
          category_update_form.reset(category_to_form_values(category));
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  }

  function category_replace_on_submit(values: CreateCategoryInput) {
    if (!selected_category_id) {
      toast.error('Select a category first.');
      return;
    }

    replace_category(
      { categoryId: selected_category_id, data: to_create_payload(values) },
      {
        onSuccess: (category) => {
          toast.success('Category replaced successfully.');
          category_replace_form.reset(category_to_form_values(category));
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  }

  function handle_delete_category() {
    if (!selected_category_id) {
      toast.error('Select a category first.');
      return;
    }

    const is_confirmed = window.confirm(
      'Delete this category? This action cannot be undone and will fail if child categories or products still reference it.'
    );
    if (!is_confirmed) return;

    delete_category(selected_category_id, {
      onSuccess: () => {
        toast.success('Category deleted successfully.');
        set_selected_category_id(null);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  }

  const columns = useMemo(
    () => [
      column_helper.accessor('name', {
        header: () => (
          <span className="text-xs uppercase tracking-wide text-neutral-500">Category</span>
        ),
        cell: (props) => (
          <div className="min-w-0">
            <p className="font-semibold text-neutral-900">{props.getValue()}</p>
            <p className="truncate text-xs text-neutral-500">
              {get_category_path(props.row.original)}
            </p>
          </div>
        ),
      }),
      column_helper.accessor('parentId', {
        header: () => (
          <span className="text-xs uppercase tracking-wide text-neutral-500">Parent</span>
        ),
        cell: (props) => (
          <span className="text-sm text-neutral-600">{get_parent_name(props.getValue())}</span>
        ),
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
      column_helper.accessor('sortOrder', {
        header: () => (
          <span className="text-xs uppercase tracking-wide text-neutral-500">Sort</span>
        ),
        cell: (props) => <span className="text-sm text-neutral-600">{props.getValue()}</span>,
      }),
      column_helper.display({
        id: 'actions',
        header: () => (
          <span className="text-xs uppercase tracking-wide text-neutral-500">Actions</span>
        ),
        cell: (props) => {
          const category = props.row.original;
          const is_selected = selected_category_id === category.id;

          return (
            <button
              type="button"
              onClick={() =>
                is_selected ? set_selected_category_id(null) : set_selected_category_id(category.id)
              }
              className="rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
            >
              {is_selected ? 'Selected' : 'View'}
            </button>
          );
        },
      }),
    ],
    [category_map, selected_category_id]
  );

  const table = useReactTable({
    data: category_rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const create_errors = category_create_form.formState.errors;
  const update_errors = category_update_form.formState.errors;
  const replace_errors = category_replace_form.formState.errors;
  const selected_category_title = selected_category?.name ?? 'Select a category';
  const is_create_loading = category_create_form.formState.isSubmitting || is_creating;

  function render_mobile_category_card(category: CategoryData) {
    const is_selected = selected_category_id === category.id;

    return (
      <article key={category.id} className="rounded border border-neutral-200 bg-white p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Category</p>
            <p className="text-sm font-semibold text-neutral-900">{category.name}</p>
          </div>
          <span className={category.active ? 'text-xs text-green-700' : 'text-xs text-red-600'}>
            {category.active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">Parent</dt>
            <dd className="mt-1 text-neutral-700">{get_parent_name(category.parentId)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">Path</dt>
            <dd className="mt-1 text-neutral-700">{get_category_path(category)}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() =>
            is_selected ? set_selected_category_id(null) : set_selected_category_id(category.id)
          }
          className="mt-4 w-full rounded border border-neutral-200 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          {is_selected ? 'Selected' : 'View'}
        </button>
      </article>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <section className="rounded border bg-white/90 p-5 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-2">
          <h3 className="text-[24px] font-medium text-[#1d2128]">Categories Manager</h3>
          <p className="text-sm text-neutral-500">
            Create, view, edit, replace, and delete categories while preserving parent and child
            relationships.
          </p>
        </div>

        <div className="grid gap-6 ">
          <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-base font-semibold text-neutral-900">Category List</h4>
              <p className="text-sm text-neutral-500">Total: {categories?.total ?? 0}</p>
            </div>

            <div className="mb-4">
              <Input
                value={search}
                onChange={(event) => set_search(event.target.value)}
                type="text"
                placeholder="Search by name or slug"
                autoComplete="off"
                disabled={is_categories_loading}
              />
            </div>

            {categories_error ? (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {categories_error.message}
              </div>
            ) : null}

            {is_categories_loading ? (
              <div className="grid gap-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`category-list-skeleton-${index}`}
                    className="h-24 animate-pulse rounded border border-neutral-200 bg-neutral-100"
                  />
                ))}
              </div>
            ) : category_rows.length === 0 ? (
              <div className="rounded border border-dashed border-neutral-300 bg-white p-6 text-center">
                <p className="text-sm text-neutral-500">No categories found.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 lg:hidden">
                  {category_rows.map(render_mobile_category_card)}
                </div>

                <div className="hidden rounded border border-neutral-200 lg:block">
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
                      {table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id} className="hover:bg-neutral-50/60">
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="px-4 py-3 align-top">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </section>

          <section className="space-y-6">
            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <div className="mb-4">
                <h4 className="text-base font-semibold text-neutral-900">Create Category</h4>
                <p className="text-sm text-neutral-500">
                  Add a category and optionally assign its parent.
                </p>
              </div>

              <form
                onSubmit={category_create_form.handleSubmit(category_create_on_submit)}
                className="space-y-5"
              >
                <div className="grid gap-5">
                  <Field
                    label="Category Name"
                    error={create_errors.name?.message}
                    delay={100}
                    xx={true}
                  >
                    <Input
                      {...category_create_form.register('name')}
                      type="text"
                      placeholder="Enter category name"
                      autoComplete="off"
                      hasError={Boolean(create_errors.name)}
                      disabled={is_create_loading}
                    />
                  </Field>

                  <Field label="Slug" error={create_errors.slug?.message} delay={100} xx={false}>
                    <Input
                      {...category_create_form.register('slug')}
                      type="text"
                      placeholder="Optional custom slug"
                      autoComplete="off"
                      hasError={Boolean(create_errors.slug)}
                      disabled={is_create_loading}
                    />
                  </Field>

                  <Controller
                    name="parent"
                    control={category_create_form.control}
                    render={({ field: { onChange, value } }) => (
                      <label className="space-y-1.5 text-sm font-semibold text-gray-700">
                        <span>Parent Category</span>
                        <select
                          value={typeof value === 'string' ? value : ''}
                          onChange={(event) => onChange(event.target.value || null)}
                          disabled={is_create_loading}
                          className="w-full rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black/30 focus:border-black"
                        >
                          <option value="">Root category</option>
                          {category_rows.map((category) => (
                            <option key={category.id} value={category.id}>
                              {get_category_path(category)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  />

                  <Field
                    label="Description"
                    error={create_errors.description?.message}
                    delay={100}
                    xx={false}
                  >
                    <Textarea
                      {...category_create_form.register('description')}
                      placeholder="Enter category description"
                      rows={4}
                      hasError={Boolean(create_errors.description)}
                      disabled={is_create_loading}
                    />
                  </Field>

                  <Controller
                    name="image"
                    control={category_create_form.control}
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-semibold text-gray-700">
                          Category Image
                        </label>
                        <UploadCard
                          preset="product-media"
                          resourceType="image"
                          value={
                            typeof value === 'string' && value ? to_cloudinary_asset(value) : null
                          }
                          onChange={(asset) => {
                            const image_url = asset?.secure_url ?? asset?.url ?? '';
                            onChange(image_url || undefined);
                          }}
                          title="Upload Image"
                          description="Upload category image or hero tile artwork."
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
                    label="Sort Order"
                    error={create_errors.sortOrder?.message}
                    delay={100}
                    xx={false}
                  >
                    <Input
                      {...category_create_form.register('sortOrder', { valueAsNumber: true })}
                      type="number"
                      min={0}
                      placeholder="0"
                      hasError={Boolean(create_errors.sortOrder)}
                      disabled={is_create_loading}
                    />
                  </Field>

                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={category_create_form.watch('active') ?? true}
                      onChange={(event) =>
                        category_create_form.setValue('active', event.target.checked)
                      }
                    />
                    Category is active
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={is_create_loading}
                  className="w-full rounded bg-[#1d2128] py-3 px-4 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {is_create_loading ? 'Creating Category...' : 'Create Category'}
                </button>
              </form>
            </section>

            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-neutral-900">Selected Category</h4>
                  <p className="text-sm text-neutral-500">{selected_category_title}</p>
                </div>
                <button
                  type="button"
                  onClick={handle_delete_category}
                  disabled={!selected_category_id || is_deleting}
                  className="w-full rounded border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {is_deleting ? 'Deleting...' : 'Delete Category'}
                </button>
              </div>

              {selected_category_error ? (
                <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {selected_category_error.message}
                </div>
              ) : null}

              {is_selected_category_loading ? (
                <p className="text-sm text-neutral-500">Loading selected category...</p>
              ) : selected_category ? (
                <div className="space-y-6">
                  <div className="rounded border border-neutral-200 bg-neutral-50 p-4 text-sm">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p>
                        <span className="font-semibold text-neutral-900">Name:</span>{' '}
                        {selected_category.name}
                      </p>
                      <p>
                        <span className="font-semibold text-neutral-900">Slug:</span>{' '}
                        {selected_category.slug}
                      </p>
                      <p>
                        <span className="font-semibold text-neutral-900">Parent:</span>{' '}
                        {get_parent_name(selected_category.parentId)}
                      </p>
                      <p>
                        <span className="font-semibold text-neutral-900">Updated:</span>{' '}
                        {format_date(selected_category.updatedAt)}
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={category_update_form.handleSubmit(category_update_on_submit)}
                    className="space-y-5"
                  >
                    <h5 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
                      Edit Category (PATCH)
                    </h5>

                    <div className="grid gap-5">
                      <Field
                        label="Category Name"
                        error={update_errors.name?.message}
                        delay={100}
                        xx={false}
                      >
                        <Input
                          {...category_update_form.register('name')}
                          type="text"
                          placeholder="Category name"
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
                          {...category_update_form.register('slug')}
                          type="text"
                          placeholder="Category slug"
                          autoComplete="off"
                          hasError={Boolean(update_errors.slug)}
                          disabled={is_updating}
                        />
                      </Field>

                      <Controller
                        name="parent"
                        control={category_update_form.control}
                        render={({ field: { onChange, value } }) => (
                          <label className="space-y-1.5 text-sm font-semibold text-gray-700">
                            <span>Parent Category</span>
                            <select
                              value={typeof value === 'string' ? value : ''}
                              onChange={(event) => onChange(event.target.value || null)}
                              disabled={is_updating}
                              className="w-full rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black/30 focus:border-black"
                            >
                              <option value="">Root category</option>
                              {parent_options.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {get_category_path(category)}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      />

                      <Field
                        label="Description"
                        error={update_errors.description?.message}
                        delay={100}
                        xx={false}
                      >
                        <Textarea
                          {...category_update_form.register('description')}
                          placeholder="Category description"
                          rows={3}
                          hasError={Boolean(update_errors.description)}
                          disabled={is_updating}
                        />
                      </Field>

                      <Controller
                        name="image"
                        control={category_update_form.control}
                        render={({ field: { onChange, value }, fieldState: { error } }) => (
                          <div className="flex flex-col gap-1.5">
                            <label className="block text-sm font-semibold text-gray-700">
                              Category Image
                            </label>
                            <UploadCard
                              preset="product-media"
                              resourceType="image"
                              value={
                                typeof value === 'string' && value
                                  ? to_cloudinary_asset(value)
                                  : null
                              }
                              onChange={(asset) => {
                                const image_url = asset?.secure_url ?? asset?.url ?? '';
                                onChange(image_url || undefined);
                              }}
                              title="Update Image"
                              description="Replace current category image."
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

                      <Field
                        label="Sort Order"
                        error={update_errors.sortOrder?.message}
                        delay={100}
                        xx={false}
                      >
                        <Input
                          {...category_update_form.register('sortOrder', { valueAsNumber: true })}
                          type="number"
                          min={0}
                          placeholder="0"
                          hasError={Boolean(update_errors.sortOrder)}
                          disabled={is_updating}
                        />
                      </Field>

                      <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={category_update_form.watch('active') ?? false}
                          onChange={(event) =>
                            category_update_form.setValue('active', event.target.checked, {
                              shouldDirty: true,
                            })
                          }
                        />
                        Category is active
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
                    onSubmit={category_replace_form.handleSubmit(category_replace_on_submit)}
                    className="space-y-5 border-t border-neutral-200 pt-6"
                  >
                    <h5 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
                      Replace Category (PUT)
                    </h5>

                    <div className="grid gap-5">
                      <Field
                        label="Category Name"
                        error={replace_errors.name?.message}
                        delay={100}
                        xx={true}
                      >
                        <Input
                          {...category_replace_form.register('name')}
                          type="text"
                          placeholder="Category name"
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
                          {...category_replace_form.register('slug')}
                          type="text"
                          placeholder="Category slug"
                          autoComplete="off"
                          hasError={Boolean(replace_errors.slug)}
                          disabled={is_replacing}
                        />
                      </Field>

                      <Controller
                        name="parent"
                        control={category_replace_form.control}
                        render={({ field: { onChange, value } }) => (
                          <label className="space-y-1.5 text-sm font-semibold text-gray-700">
                            <span>Parent Category</span>
                            <select
                              value={typeof value === 'string' ? value : ''}
                              onChange={(event) => onChange(event.target.value || null)}
                              disabled={is_replacing}
                              className="w-full rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black/30 focus:border-black"
                            >
                              <option value="">Root category</option>
                              {parent_options.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {get_category_path(category)}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      />

                      <Field
                        label="Description"
                        error={replace_errors.description?.message}
                        delay={100}
                        xx={false}
                      >
                        <Textarea
                          {...category_replace_form.register('description')}
                          placeholder="Category description"
                          rows={3}
                          hasError={Boolean(replace_errors.description)}
                          disabled={is_replacing}
                        />
                      </Field>

                      <Controller
                        name="image"
                        control={category_replace_form.control}
                        render={({ field: { onChange, value }, fieldState: { error } }) => (
                          <div className="flex flex-col gap-1.5">
                            <label className="block text-sm font-semibold text-gray-700">
                              Category Image
                            </label>
                            <UploadCard
                              preset="product-media"
                              resourceType="image"
                              value={
                                typeof value === 'string' && value
                                  ? to_cloudinary_asset(value)
                                  : null
                              }
                              onChange={(asset) => {
                                const image_url = asset?.secure_url ?? asset?.url ?? '';
                                onChange(image_url || undefined);
                              }}
                              title="Replace Image"
                              description="This will be used in full category replacement."
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

                      <Field
                        label="Sort Order"
                        error={replace_errors.sortOrder?.message}
                        delay={100}
                        xx={false}
                      >
                        <Input
                          {...category_replace_form.register('sortOrder', { valueAsNumber: true })}
                          type="number"
                          min={0}
                          placeholder="0"
                          hasError={Boolean(replace_errors.sortOrder)}
                          disabled={is_replacing}
                        />
                      </Field>

                      <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={category_replace_form.watch('active') ?? true}
                          onChange={(event) =>
                            category_replace_form.setValue('active', event.target.checked, {
                              shouldDirty: true,
                            })
                          }
                        />
                        Category is active
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={is_replacing}
                      className="w-full rounded border border-neutral-300 py-3 px-4 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {is_replacing ? 'Replacing Category...' : 'Replace Category'}
                    </button>
                  </form>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">
                  Select a category from the list to view and manage it.
                </p>
              )}
            </section>
          </section>
        </div>
      </section>
    </section>
  );
}
