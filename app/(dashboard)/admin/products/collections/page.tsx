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
  useAdminCollectionQuery,
  useAdminCollectionsQuery,
  useCreateAdminCollectionMutation,
  useDeleteAdminCollectionMutation,
  useReplaceAdminCollectionMutation,
  useUpdateAdminCollectionMutation,
} from '@/hooks/product.hook';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { UploadCard } from '@/modules/cloudinary/components';
import type { CloudinaryAsset } from '@/modules/cloudinary/types';
import { createCollectionSchema, updateCollectionSchema } from '@/schemas/catalog.schemas';
import {
  CollectionData,
  CreateCollectionInput,
  UpdateCollectionInput,
} from '@/services/product.service';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
  type FieldArrayPath,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { CollectionType } from '@/types/shared/product';

type CreateCollectionFormValues = z.input<typeof createCollectionSchema>;
type UpdateCollectionFormValues = z.input<typeof updateCollectionSchema>;

type CollectionRuleFormValue = {
  field: 'tags' | 'brand' | 'category' | 'gender' | 'productType';
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: string;
};

type CollectionRulesFormValues = FieldValues & {
  rules?: CollectionRuleFormValue[];
};

const collection_rule_fields: CollectionRuleFormValue['field'][] = [
  'tags',
  'brand',
  'category',
  'gender',
  'productType',
];

const collection_rule_operators: CollectionRuleFormValue['operator'][] = [
  'equals',
  'contains',
  'greater_than',
  'less_than',
];

const collection_type_options = [CollectionType.MANUAL, CollectionType.SMART] as const;

function to_cloudinary_asset(value: string): CloudinaryAsset {
  return {
    api_key: '',
    asset_folder: '',
    asset_id: value,
    bytes: 0,
    created_at: new Date(0).toISOString(),
    display_name: 'Collection Banner',
    etag: '',
    format: '',
    height: 0,
    original_filename: 'collection-banner',
    placeholder: false,
    public_id: value,
    resource_type: 'image',
    secure_url: value,
    signature: '',
    tags: ['collection-banner'],
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

function format_collection_type(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function default_rule(): CollectionRuleFormValue {
  return {
    field: 'tags',
    operator: 'contains',
    value: '',
  };
}

function to_create_payload(values: CreateCollectionInput): CreateCollectionInput {
  const next_type = values.type ?? CollectionType.MANUAL;
  const next_rules =
    next_type === CollectionType.SMART
      ? (values.rules ?? []).filter((rule) => rule.value.trim().length > 0)
      : [];

  return {
    name: values.name.trim(),
    slug: values.slug?.trim() ? values.slug.trim() : undefined,
    description: values.description?.trim() ? values.description.trim() : null,
    bannerImage: values.bannerImage?.trim() ? values.bannerImage.trim() : null,
    active: values.active ?? true,
    type: next_type,
    rules: next_rules,
    sortOrder: values.sortOrder ?? 0,
  };
}

function to_update_payload(
  values: UpdateCollectionInput,
  dirty_fields: Partial<Record<keyof UpdateCollectionInput, boolean>>
): UpdateCollectionInput {
  const payload: UpdateCollectionInput = {};

  if (dirty_fields.name && values.name?.trim()) payload.name = values.name.trim();
  if (dirty_fields.slug) payload.slug = values.slug?.trim() ? values.slug.trim() : undefined;
  if (dirty_fields.description) {
    payload.description = values.description?.trim() ? values.description.trim() : null;
  }
  if (dirty_fields.bannerImage) {
    payload.bannerImage = values.bannerImage?.trim() ? values.bannerImage.trim() : null;
  }
  if (dirty_fields.active) payload.active = values.active;
  if (dirty_fields.type) payload.type = values.type;
  if (dirty_fields.sortOrder) payload.sortOrder = values.sortOrder;
  if (dirty_fields.rules) {
    payload.rules = (values.rules ?? []).filter((rule) => rule.value.trim().length > 0);
  }

  return payload;
}

function collection_to_form_values(collection: CollectionData): CreateCollectionInput {
  return {
    name: collection.name,
    slug: collection.slug,
    description: collection.description ?? undefined,
    bannerImage: collection.bannerImage ?? undefined,
    active: collection.active,
    type: collection.type as CreateCollectionInput['type'],
    rules:
      collection.rules.length > 0
        ? collection.rules.map((rule) => ({
            field: rule.field as CollectionRuleFormValue['field'],
            operator: rule.operator as CollectionRuleFormValue['operator'],
            value: rule.value,
          }))
        : undefined,
    sortOrder: collection.sortOrder,
  };
}

function CollectionRulesEditor<TFieldValues extends CollectionRulesFormValues>({
  control,
  register,
  watch_type,
  disabled,
}: {
  control: Control<TFieldValues>;
  register: UseFormRegister<TFieldValues>;
  watch_type: string | undefined;
  disabled: boolean;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'rules' as FieldArrayPath<TFieldValues>,
  });

  if (watch_type !== CollectionType.SMART) {
    return null;
  }

  return (
    <div className="space-y-4 rounded border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h5 className="text-sm font-semibold text-neutral-900">Smart collection rules</h5>
          <p className="text-sm text-neutral-500">
            Define how products get pulled into this collection.
          </p>
        </div>
        <button
          type="button"
          onClick={() => append(default_rule() as Parameters<typeof append>[0])}
          disabled={disabled}
          className="rounded border border-neutral-200 px-3 py-2 text-sm text-neutral-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add rule
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-neutral-500">Add at least one rule for smart collections.</p>
      ) : null}

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="rounded border border-neutral-200 bg-white p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1.5 text-sm font-semibold text-gray-700">
                <span>Field</span>
                <select
                  {...register(`rules.${index}.field` as Path<TFieldValues>)}
                  disabled={disabled}
                  className="w-full rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black/30 focus:border-black"
                >
                  {collection_rule_fields.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 text-sm font-semibold text-gray-700">
                <span>Operator</span>
                <select
                  {...register(`rules.${index}.operator` as Path<TFieldValues>)}
                  disabled={disabled}
                  className="w-full rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black/30 focus:border-black"
                >
                  {collection_rule_operators.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 text-sm font-semibold text-gray-700">
                <span>Value</span>
                <input
                  {...register(`rules.${index}.value` as Path<TFieldValues>)}
                  disabled={disabled}
                  placeholder="Rule value"
                  className="w-full rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-all duration-200 focus:ring-2 focus:ring-black/30 focus:border-black"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => remove(index)}
              disabled={disabled}
              className="mt-3 rounded border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remove rule
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const column_helper = createColumnHelper<CollectionData>();

export default function AdminProductsCollectionsPage() {
  const [search, set_search] = useState('');
  const [selected_collection_id, set_selected_collection_id] = useState<string | null>(null);
  const debounced_search = useDebouncedValue(search, 300);

  const {
    data: collections,
    isLoading: is_collections_loading,
    error: collections_error,
  } = useAdminCollectionsQuery({ search: debounced_search || undefined });

  const {
    data: selected_collection,
    isLoading: is_selected_collection_loading,
    error: selected_collection_error,
  } = useAdminCollectionQuery(selected_collection_id ?? '');

  const { mutate: create_collection, isPending: is_creating } = useCreateAdminCollectionMutation();
  const { mutate: update_collection, isPending: is_updating } = useUpdateAdminCollectionMutation();
  const { mutate: replace_collection, isPending: is_replacing } =
    useReplaceAdminCollectionMutation();
  const { mutate: delete_collection, isPending: is_deleting } = useDeleteAdminCollectionMutation();

  const collection_create_form = useForm<
    CreateCollectionFormValues,
    unknown,
    CreateCollectionInput
  >({
    resolver: zodResolver(createCollectionSchema),
    defaultValues: {
      name: '',
      slug: undefined,
      description: undefined,
      bannerImage: undefined,
      active: true,
      type: CollectionType.MANUAL,
      rules: [],
      sortOrder: 0,
    },
  });

  const collection_update_form = useForm<
    UpdateCollectionFormValues,
    unknown,
    UpdateCollectionInput
  >({
    resolver: zodResolver(updateCollectionSchema),
    defaultValues: {
      name: undefined,
      slug: undefined,
      description: undefined,
      bannerImage: undefined,
      active: undefined,
      type: undefined,
      rules: undefined,
      sortOrder: undefined,
    },
  });

  const collection_replace_form = useForm<
    CreateCollectionFormValues,
    unknown,
    CreateCollectionInput
  >({
    resolver: zodResolver(createCollectionSchema),
    defaultValues: {
      name: '',
      slug: undefined,
      description: undefined,
      bannerImage: undefined,
      active: true,
      type: CollectionType.MANUAL,
      rules: [],
      sortOrder: 0,
    },
  });

  const create_type = collection_create_form.watch('type');
  const update_type = collection_update_form.watch('type');
  const replace_type = collection_replace_form.watch('type');

  useEffect(() => {
    if (!selected_collection) return;

    const hydrated_values = collection_to_form_values(selected_collection);
    collection_update_form.reset(hydrated_values);
    collection_replace_form.reset(hydrated_values);
  }, [selected_collection, collection_update_form, collection_replace_form]);

  useEffect(() => {
    if (create_type !== CollectionType.SMART) {
      collection_create_form.setValue('rules', [], { shouldDirty: true });
    }
  }, [create_type, collection_create_form]);

  useEffect(() => {
    if (update_type !== CollectionType.SMART) {
      collection_update_form.setValue('rules', [], { shouldDirty: true });
    }
  }, [update_type, collection_update_form]);

  useEffect(() => {
    if (replace_type !== CollectionType.SMART) {
      collection_replace_form.setValue('rules', [], { shouldDirty: true });
    }
  }, [replace_type, collection_replace_form]);

  function collection_create_on_submit(values: CreateCollectionInput) {
    create_collection(to_create_payload(values), {
      onSuccess: (collection) => {
        toast.success('Collection created successfully.');
        collection_create_form.reset();
        set_selected_collection_id(collection.id);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  }

  function collection_update_on_submit(values: UpdateCollectionInput) {
    if (!selected_collection_id) {
      toast.error('Select a collection first.');
      return;
    }

    const payload = to_update_payload(
      values,
      collection_update_form.formState.dirtyFields as Partial<
        Record<keyof UpdateCollectionInput, boolean>
      >
    );

    if (Object.keys(payload).length === 0) {
      toast.info('No changes to update yet.');
      return;
    }

    update_collection(
      { collectionId: selected_collection_id, data: payload },
      {
        onSuccess: (collection) => {
          toast.success('Collection updated successfully.');
          collection_update_form.reset(collection_to_form_values(collection));
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  }

  function collection_replace_on_submit(values: CreateCollectionInput) {
    if (!selected_collection_id) {
      toast.error('Select a collection first.');
      return;
    }

    replace_collection(
      { collectionId: selected_collection_id, data: to_create_payload(values) },
      {
        onSuccess: (collection) => {
          toast.success('Collection replaced successfully.');
          collection_replace_form.reset(collection_to_form_values(collection));
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  }

  function handle_delete_collection() {
    if (!selected_collection_id) {
      toast.error('Select a collection first.');
      return;
    }

    const is_confirmed = window.confirm(
      'Delete this collection? This action cannot be undone and will fail if products still reference it.'
    );
    if (!is_confirmed) return;

    delete_collection(selected_collection_id, {
      onSuccess: () => {
        toast.success('Collection deleted successfully.');
        set_selected_collection_id(null);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  }

  const collection_rows = collections?.collections ?? [];

  const columns = useMemo(
    () => [
      column_helper.accessor('name', {
        header: () => (
          <span className="text-xs uppercase tracking-wide text-neutral-500">Collection</span>
        ),
        cell: (props) => <span className="font-semibold text-neutral-900">{props.getValue()}</span>,
      }),
      column_helper.accessor('type', {
        header: () => (
          <span className="text-xs uppercase tracking-wide text-neutral-500">Type</span>
        ),
        cell: (props) => (
          <span className="text-sm text-neutral-600">
            {format_collection_type(props.getValue())}
          </span>
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
          const collection = props.row.original;
          const is_selected = selected_collection_id === collection.id;

          return (
            <button
              type="button"
              onClick={() =>
                is_selected
                  ? set_selected_collection_id(null)
                  : set_selected_collection_id(collection.id)
              }
              className="rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
            >
              {is_selected ? 'Selected' : 'View'}
            </button>
          );
        },
      }),
    ],
    [selected_collection_id]
  );

  const table = useReactTable({
    data: collection_rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const create_errors = collection_create_form.formState.errors;
  const update_errors = collection_update_form.formState.errors;
  const replace_errors = collection_replace_form.formState.errors;
  const selected_collection_title = selected_collection?.name ?? 'Select a collection';
  const is_create_loading = collection_create_form.formState.isSubmitting || is_creating;

  function render_mobile_collection_card(collection: CollectionData) {
    const is_selected = selected_collection_id === collection.id;

    return (
      <article key={collection.id} className="rounded border border-neutral-200 bg-white p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Collection</p>
            <p className="text-sm font-semibold text-neutral-900">{collection.name}</p>
          </div>
          <span className={collection.active ? 'text-xs text-green-700' : 'text-xs text-red-600'}>
            {collection.active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">Type</dt>
            <dd className="mt-1 text-neutral-700">{format_collection_type(collection.type)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">Slug</dt>
            <dd className="mt-1 break-all text-neutral-700">{collection.slug}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() =>
            is_selected
              ? set_selected_collection_id(null)
              : set_selected_collection_id(collection.id)
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
          <h3 className="text-[24px] font-medium text-[#1d2128]">Collections Manager</h3>
          <p className="text-sm text-neutral-500">
            Create, view, edit, replace, and delete collections from one workspace.
          </p>
        </div>

        <div className="grid gap-6 ">
          <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-base font-semibold text-neutral-900">Collection List</h4>
              <p className="text-sm text-neutral-500">Total: {collections?.total ?? 0}</p>
            </div>

            <div className="mb-4">
              <Input
                value={search}
                onChange={(event) => set_search(event.target.value)}
                type="text"
                placeholder="Search by name or slug"
                autoComplete="off"
                disabled={is_collections_loading}
              />
            </div>

            {collections_error ? (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {collections_error.message}
              </div>
            ) : null}

            {is_collections_loading ? (
              <div className="grid gap-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`collection-list-skeleton-${index}`}
                    className="h-24 animate-pulse rounded border border-neutral-200 bg-neutral-100"
                  />
                ))}
              </div>
            ) : collection_rows.length === 0 ? (
              <div className="rounded border border-dashed border-neutral-300 bg-white p-6 text-center">
                <p className="text-sm text-neutral-500">No collections found.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 lg:hidden">
                  {collection_rows.map(render_mobile_collection_card)}
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
                            <TableCell key={cell.id} className="px-4 py-3">
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
                <h4 className="text-base font-semibold text-neutral-900">Create Collection</h4>
                <p className="text-sm text-neutral-500">Add a new collection to your catalog.</p>
              </div>

              <form
                onSubmit={collection_create_form.handleSubmit(collection_create_on_submit)}
                className="space-y-5"
              >
                <div className="grid gap-5">
                  <Field
                    label="Collection Name"
                    error={create_errors.name?.message}
                    delay={100}
                    xx={true}
                  >
                    <Input
                      {...collection_create_form.register('name')}
                      type="text"
                      placeholder="Enter collection name"
                      autoComplete="off"
                      hasError={Boolean(create_errors.name)}
                      disabled={is_create_loading}
                    />
                  </Field>

                  <Field label="Slug" error={create_errors.slug?.message} delay={100} xx={false}>
                    <Input
                      {...collection_create_form.register('slug')}
                      type="text"
                      placeholder="Optional custom slug"
                      autoComplete="off"
                      hasError={Boolean(create_errors.slug)}
                      disabled={is_create_loading}
                    />
                  </Field>

                  <Field
                    label="Description"
                    error={create_errors.description?.message}
                    delay={100}
                    xx={false}
                  >
                    <Textarea
                      {...collection_create_form.register('description')}
                      placeholder="Enter collection description"
                      rows={4}
                      hasError={Boolean(create_errors.description)}
                      disabled={is_create_loading}
                    />
                  </Field>

                  <Controller
                    name="bannerImage"
                    control={collection_create_form.control}
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-semibold text-gray-700">
                          Banner Image
                        </label>
                        <UploadCard
                          preset="product-media"
                          resourceType="image"
                          value={
                            typeof value === 'string' && value ? to_cloudinary_asset(value) : null
                          }
                          onChange={(asset) => {
                            const banner_url = asset?.secure_url ?? asset?.url ?? '';
                            onChange(banner_url || undefined);
                          }}
                          title="Upload Banner"
                          description="Upload collection banner image."
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

                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="space-y-1.5 text-sm font-semibold text-gray-700">
                      <span>Collection Type</span>
                      <select
                        {...collection_create_form.register('type')}
                        disabled={is_create_loading}
                        className="w-full rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black/30 focus:border-black"
                      >
                        {collection_type_options.map((option) => (
                          <option key={option} value={option}>
                            {format_collection_type(option)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <Field
                      label="Sort Order"
                      error={create_errors.sortOrder?.message}
                      delay={100}
                      xx={false}
                    >
                      <Input
                        {...collection_create_form.register('sortOrder', { valueAsNumber: true })}
                        type="number"
                        min={0}
                        placeholder="0"
                        hasError={Boolean(create_errors.sortOrder)}
                        disabled={is_create_loading}
                      />
                    </Field>
                  </div>

                  <CollectionRulesEditor
                    control={collection_create_form.control}
                    register={collection_create_form.register}
                    watch_type={create_type}
                    disabled={is_create_loading}
                  />

                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={collection_create_form.watch('active') ?? true}
                      onChange={(event) =>
                        collection_create_form.setValue('active', event.target.checked)
                      }
                    />
                    Collection is active
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={is_create_loading}
                  className="w-full rounded bg-[#1d2128] py-3 px-4 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {is_create_loading ? 'Creating Collection...' : 'Create Collection'}
                </button>
              </form>
            </section>

            <section className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-neutral-900">Selected Collection</h4>
                  <p className="text-sm text-neutral-500">{selected_collection_title}</p>
                </div>
                <button
                  type="button"
                  onClick={handle_delete_collection}
                  disabled={!selected_collection_id || is_deleting}
                  className="w-full rounded border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {is_deleting ? 'Deleting...' : 'Delete Collection'}
                </button>
              </div>

              {selected_collection_error ? (
                <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {selected_collection_error.message}
                </div>
              ) : null}

              {is_selected_collection_loading ? (
                <p className="text-sm text-neutral-500">Loading selected collection...</p>
              ) : selected_collection ? (
                <div className="space-y-6">
                  <div className="rounded border border-neutral-200 bg-neutral-50 p-4 text-sm">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p>
                        <span className="font-semibold text-neutral-900">Name:</span>{' '}
                        {selected_collection.name}
                      </p>
                      <p>
                        <span className="font-semibold text-neutral-900">Slug:</span>{' '}
                        {selected_collection.slug}
                      </p>
                      <p>
                        <span className="font-semibold text-neutral-900">Type:</span>{' '}
                        {format_collection_type(selected_collection.type)}
                      </p>
                      <p>
                        <span className="font-semibold text-neutral-900">Updated:</span>{' '}
                        {format_date(selected_collection.updatedAt)}
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={collection_update_form.handleSubmit(collection_update_on_submit)}
                    className="space-y-5"
                  >
                    <h5 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
                      Edit Collection (PATCH)
                    </h5>

                    <div className="grid gap-5">
                      <Field
                        label="Collection Name"
                        error={update_errors.name?.message}
                        delay={100}
                        xx={false}
                      >
                        <Input
                          {...collection_update_form.register('name')}
                          type="text"
                          placeholder="Collection name"
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
                          {...collection_update_form.register('slug')}
                          type="text"
                          placeholder="Collection slug"
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
                          {...collection_update_form.register('description')}
                          placeholder="Collection description"
                          rows={3}
                          hasError={Boolean(update_errors.description)}
                          disabled={is_updating}
                        />
                      </Field>

                      <Controller
                        name="bannerImage"
                        control={collection_update_form.control}
                        render={({ field: { onChange, value }, fieldState: { error } }) => (
                          <div className="flex flex-col gap-1.5">
                            <label className="block text-sm font-semibold text-gray-700">
                              Banner Image
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
                                const banner_url = asset?.secure_url ?? asset?.url ?? '';
                                onChange(banner_url || undefined);
                              }}
                              title="Update Banner"
                              description="Replace current collection banner."
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

                      <div className="grid gap-5 sm:grid-cols-2">
                        <label className="space-y-1.5 text-sm font-semibold text-gray-700">
                          <span>Collection Type</span>
                          <select
                            {...collection_update_form.register('type')}
                            disabled={is_updating}
                            className="w-full rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black/30 focus:border-black"
                          >
                            <option value="">Select type</option>
                            {collection_type_options.map((option) => (
                              <option key={option} value={option}>
                                {format_collection_type(option)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <Field
                          label="Sort Order"
                          error={update_errors.sortOrder?.message}
                          delay={100}
                          xx={false}
                        >
                          <Input
                            {...collection_update_form.register('sortOrder', {
                              valueAsNumber: true,
                            })}
                            type="number"
                            min={0}
                            placeholder="0"
                            hasError={Boolean(update_errors.sortOrder)}
                            disabled={is_updating}
                          />
                        </Field>
                      </div>

                      <CollectionRulesEditor
                        control={collection_update_form.control}
                        register={collection_update_form.register}
                        watch_type={update_type}
                        disabled={is_updating}
                      />

                      <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={collection_update_form.watch('active') ?? false}
                          onChange={(event) =>
                            collection_update_form.setValue('active', event.target.checked, {
                              shouldDirty: true,
                            })
                          }
                        />
                        Collection is active
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
                    onSubmit={collection_replace_form.handleSubmit(collection_replace_on_submit)}
                    className="space-y-5 border-t border-neutral-200 pt-6"
                  >
                    <h5 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
                      Replace Collection (PUT)
                    </h5>

                    <div className="grid gap-5">
                      <Field
                        label="Collection Name"
                        error={replace_errors.name?.message}
                        delay={100}
                        xx={true}
                      >
                        <Input
                          {...collection_replace_form.register('name')}
                          type="text"
                          placeholder="Collection name"
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
                          {...collection_replace_form.register('slug')}
                          type="text"
                          placeholder="Collection slug"
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
                          {...collection_replace_form.register('description')}
                          placeholder="Collection description"
                          rows={3}
                          hasError={Boolean(replace_errors.description)}
                          disabled={is_replacing}
                        />
                      </Field>

                      <Controller
                        name="bannerImage"
                        control={collection_replace_form.control}
                        render={({ field: { onChange, value }, fieldState: { error } }) => (
                          <div className="flex flex-col gap-1.5">
                            <label className="block text-sm font-semibold text-gray-700">
                              Banner Image
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
                                const banner_url = asset?.secure_url ?? asset?.url ?? '';
                                onChange(banner_url || undefined);
                              }}
                              title="Replace Banner"
                              description="This will be used in full collection replacement."
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

                      <div className="grid gap-5 sm:grid-cols-2">
                        <label className="space-y-1.5 text-sm font-semibold text-gray-700">
                          <span>Collection Type</span>
                          <select
                            {...collection_replace_form.register('type')}
                            disabled={is_replacing}
                            className="w-full rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black/30 focus:border-black"
                          >
                            {collection_type_options.map((option) => (
                              <option key={option} value={option}>
                                {format_collection_type(option)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <Field
                          label="Sort Order"
                          error={replace_errors.sortOrder?.message}
                          delay={100}
                          xx={false}
                        >
                          <Input
                            {...collection_replace_form.register('sortOrder', {
                              valueAsNumber: true,
                            })}
                            type="number"
                            min={0}
                            placeholder="0"
                            hasError={Boolean(replace_errors.sortOrder)}
                            disabled={is_replacing}
                          />
                        </Field>
                      </div>

                      <CollectionRulesEditor
                        control={collection_replace_form.control}
                        register={collection_replace_form.register}
                        watch_type={replace_type}
                        disabled={is_replacing}
                      />

                      <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={collection_replace_form.watch('active') ?? true}
                          onChange={(event) =>
                            collection_replace_form.setValue('active', event.target.checked, {
                              shouldDirty: true,
                            })
                          }
                        />
                        Collection is active
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={is_replacing}
                      className="w-full rounded border border-neutral-300 py-3 px-4 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {is_replacing ? 'Replacing Collection...' : 'Replace Collection'}
                    </button>
                  </form>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">
                  Select a collection from the list to view and manage it.
                </p>
              )}
            </section>
          </section>
        </div>
      </section>
    </section>
  );
}
