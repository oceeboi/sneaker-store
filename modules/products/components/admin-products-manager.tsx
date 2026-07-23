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
  useAdminBrandsQuery,
  useAdminCategoriesQuery,
  useAdminCollectionsQuery,
} from '@/hooks/product.hook';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  useAdminProductDetailQuery,
  useAdminProductInventoryQuery,
  useAdminProductsListQuery,
  useAdminProductSizesQuery,
  useCreateAdminProductMutation,
  useCreateAdminProductSizeMutation,
  useDeleteAdminProductMutation,
  useDeleteAdminProductSizeMutation,
  useMutateAdminProductInventoryMutation,
  useReplaceAdminProductMutation,
  useUpdateAdminProductMutation,
  useUpdateAdminProductSizeMutation,
} from '@/modules/products/hooks';
import { adminProductFormSchema } from '@/modules/products/schemas';
import type {
  AdminProductSizeCreateInput,
  AdminProductSizeUpdateInput,
} from '@/modules/products/schemas/admin-product-size.schemas';
import type {
  AdminInventoryOperationInput,
  CreateProductInput,
  ProductData,
} from '@/services/product.service';
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

import { GENDER_OPTIONS, PRODUCT_TYPE_OPTIONS } from '../constants/admin-product.constants';
import type { ProductFormValues, ProductOption } from '../types/admin-product.types';
import {
  formatDate,
  formatPrice,
  parseCsvInput,
  productToFormValues,
  toCreatePayload,
  toUpdatePayload,
} from '../utils/admin-product.utils';
import { OptionPicker } from './option-picker';

const columnHelper = createColumnHelper<ProductData>();

const emptyProductValues: ProductFormValues = {
  name: '',
  slug: undefined,
  brand: '',
  category: '',
  collections: [],
  productType: 'sneaker',
  gender: 'unisex',
  description: {
    narrative: '',
    styleCode: null,
    colorway: null,
    releaseDate: null,
    materials: null,
    editorialHighlights: [],
    additionalSections: [],
  },
  features: [],
  media: [],
  sizes: [],
  pricing: {
    currency: 'NGN',
    basePrice: 0,
    compareAtPrice: null,
    costPrice: null,
  },
  seo: {
    title: null,
    description: null,
    keywords: [],
  },
  tags: [],
  active: true,
};

const createSizeSchema = z.object({
  size: z.string().trim().min(1, 'Size is required').max(20),
  sku: z.string().trim().nullable().optional(),
  barcode: z.string().trim().nullable().optional(),
  stockQuantity: z.coerce.number().int().min(0),
  reorderLevel: z.coerce.number().int().min(0),
  active: z.boolean(),
});

type CreateSizeValues = z.infer<typeof createSizeSchema>;
type CreateSizeFormValues = z.input<typeof createSizeSchema>;

type InventoryOperationValues = AdminInventoryOperationInput;

type WorkspaceTab = 'details' | 'sizes' | 'inventory';

function toNullableString(value: string | null | undefined) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function SizeDraftRow({
  draft,
  onChange,
  onSave,
  onDelete,
  saving,
  deleting,
  disabled,
}: {
  draft: AdminProductSizeUpdateInput & {
    id: string;
    availableQuantity: number;
    reservedQuantity: number;
  };
  onChange: (
    next: AdminProductSizeUpdateInput & {
      id: string;
      availableQuantity: number;
      reservedQuantity: number;
    }
  ) => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
  disabled: boolean;
}) {
  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Size" xx={true}>
          <Input
            value={draft.size ?? ''}
            onChange={(event) => onChange({ ...draft, size: event.target.value })}
            disabled={disabled}
          />
        </Field>

        <Field label="SKU" xx={false}>
          <Input
            value={draft.sku ?? ''}
            onChange={(event) => onChange({ ...draft, sku: event.target.value })}
            disabled={disabled}
          />
        </Field>

        <Field label="Barcode" xx={false}>
          <Input
            value={draft.barcode ?? ''}
            onChange={(event) => onChange({ ...draft, barcode: event.target.value })}
            disabled={disabled}
          />
        </Field>

        <label className="space-y-1.5 text-sm font-semibold text-gray-700">
          <span>Status</span>
          <div className="flex h-12 items-center gap-2 rounded-lg border border-neutral-200 px-3">
            <input
              type="checkbox"
              checked={draft.active ?? true}
              onChange={(event) => onChange({ ...draft, active: event.target.checked })}
              disabled={disabled}
            />
            <span className="text-sm font-normal text-neutral-700">Active size</span>
          </div>
        </label>

        <Field label="Stock" xx={false}>
          <Input
            type="number"
            min={0}
            value={draft.stockQuantity ?? 0}
            onChange={(event) =>
              onChange({
                ...draft,
                stockQuantity: Number.isFinite(Number(event.target.value))
                  ? Number(event.target.value)
                  : 0,
              })
            }
            disabled={disabled}
          />
        </Field>

        <Field label="Reorder" xx={false}>
          <Input
            type="number"
            min={0}
            value={draft.reorderLevel ?? 0}
            onChange={(event) =>
              onChange({
                ...draft,
                reorderLevel: Number.isFinite(Number(event.target.value))
                  ? Number(event.target.value)
                  : 0,
              })
            }
            disabled={disabled}
          />
        </Field>

        <div className="rounded-lg border border-neutral-200 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Reserved</p>
          <p className="text-lg font-semibold text-neutral-900">{draft.reservedQuantity}</p>
        </div>

        <div className="rounded-lg border border-neutral-200 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Available</p>
          <p className="text-lg font-semibold text-emerald-700">{draft.availableQuantity}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={disabled || saving || deleting}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save size'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled || saving || deleting}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting ? 'Deleting...' : 'Delete size'}
        </button>
      </div>
    </article>
  );
}

function SelectField({
  label,
  required = false,
  error,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  required?: boolean;
  error?: string;
  value: string;
  options: ProductOption[];
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <Field label={label} error={error} delay={100} xx={required}>
      <OptionPicker
        value={value}
        options={options}
        onChange={(next) => onChange(Array.isArray(next) ? (next[0] ?? '') : next)}
        placeholder={`Select ${label.toLowerCase()}`}
        disabled={disabled}
      />
    </Field>
  );
}

function ProductCoreFields({
  form,
  brands,
  categories,
  collections,
  disabled,
}: {
  form: ReturnType<typeof useForm<ProductFormValues>>;
  brands: ProductOption[];
  categories: ProductOption[];
  collections: ProductOption[];
  disabled: boolean;
}) {
  const errors = form.formState.errors;

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Field label="Product Name" error={errors.name?.message} delay={100} xx={true}>
          <Input
            {...form.register('name')}
            type="text"
            placeholder="Enter product name"
            autoComplete="off"
            hasError={Boolean(errors.name)}
            disabled={disabled}
          />
        </Field>

        <Field label="Slug" error={errors.slug?.message} delay={100} xx={false}>
          <Input
            {...form.register('slug')}
            type="text"
            placeholder="Optional custom slug"
            autoComplete="off"
            hasError={Boolean(errors.slug)}
            disabled={disabled}
          />
        </Field>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Controller
          name="brand"
          control={form.control}
          render={({ field }) => (
            <SelectField
              label="Brand"
              required
              error={errors.brand?.message}
              value={field.value ?? ''}
              options={brands}
              onChange={field.onChange}
              disabled={disabled}
            />
          )}
        />

        <Controller
          name="category"
          control={form.control}
          render={({ field }) => (
            <SelectField
              label="Category"
              required
              error={errors.category?.message}
              value={field.value ?? ''}
              options={categories}
              onChange={field.onChange}
              disabled={disabled}
            />
          )}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Controller
          name="productType"
          control={form.control}
          render={({ field }) => (
            <SelectField
              label="Product Type"
              required
              error={errors.productType?.message}
              value={field.value ?? ''}
              options={PRODUCT_TYPE_OPTIONS.map((value) => ({ value, label: value }))}
              onChange={field.onChange}
              disabled={disabled}
            />
          )}
        />

        <Controller
          name="gender"
          control={form.control}
          render={({ field }) => (
            <SelectField
              label="Gender"
              required
              error={errors.gender?.message}
              value={field.value ?? ''}
              options={GENDER_OPTIONS.map((value) => ({ value, label: value }))}
              onChange={field.onChange}
              disabled={disabled}
            />
          )}
        />
      </div>

      <Controller
        name="collections"
        control={form.control}
        render={({ field }) => (
          <Field label="Collections" error={errors.collections?.message as string | undefined}>
            <OptionPicker
              multiple
              value={field.value ?? []}
              options={collections}
              onChange={(next) => field.onChange(Array.isArray(next) ? next : next ? [next] : [])}
              placeholder="Select collections"
              disabled={disabled}
            />
          </Field>
        )}
      />

      <Field label="Narrative" error={errors.description?.narrative?.message} delay={100} xx={true}>
        <Textarea
          {...form.register('description.narrative')}
          rows={4}
          placeholder="Describe the product story and value proposition"
          hasError={Boolean(errors.description?.narrative)}
          disabled={disabled}
        />
      </Field>

      <div className="grid gap-5 lg:grid-cols-2">
        <Field
          label="Colorway"
          error={errors.description?.colorway?.message}
          delay={100}
          xx={false}
        >
          <Input
            {...form.register('description.colorway')}
            type="text"
            placeholder="Green Spark / Black"
            autoComplete="off"
            hasError={Boolean(errors.description?.colorway)}
            disabled={disabled}
          />
        </Field>

        <Field
          label="Style Code"
          error={errors.description?.styleCode?.message}
          delay={100}
          xx={false}
        >
          <Input
            {...form.register('description.styleCode')}
            type="text"
            placeholder="IM9113-300"
            autoComplete="off"
            hasError={Boolean(errors.description?.styleCode)}
            disabled={disabled}
          />
        </Field>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Field label="Currency" error={errors.pricing?.currency?.message} delay={100} xx={false}>
          <Input
            {...form.register('pricing.currency')}
            type="text"
            placeholder="NGN"
            autoComplete="off"
            hasError={Boolean(errors.pricing?.currency)}
            disabled={disabled}
          />
        </Field>

        <Field label="Base Price" error={errors.pricing?.basePrice?.message} delay={100} xx={true}>
          <Input
            {...form.register('pricing.basePrice', { valueAsNumber: true })}
            type="number"
            min={0}
            placeholder="Base price"
            autoComplete="off"
            hasError={Boolean(errors.pricing?.basePrice)}
            disabled={disabled}
          />
        </Field>
      </div>

      <Controller
        name="tags"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field label="Tags" error={fieldState.error?.message} delay={100} xx={false}>
            <Input
              type="text"
              placeholder="Comma-separated tags"
              value={(field.value ?? []).join(', ')}
              onChange={(event) => field.onChange(parseCsvInput(event.target.value))}
              hasError={Boolean(fieldState.error)}
              disabled={disabled}
            />
          </Field>
        )}
      />

      <label className="space-y-1.5 text-sm font-semibold text-gray-700">
        <span>Status</span>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 px-4 py-3 text-sm text-neutral-700">
          <input type="checkbox" {...form.register('active')} disabled={disabled} />
          <span>Product is active</span>
        </div>
      </label>
    </div>
  );
}

export function AdminProductsManager() {
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('details');

  const debouncedSearch = useDebouncedValue(search, 300);

  const {
    data: listData,
    isLoading: isProductsLoading,
    error: productsError,
  } = useAdminProductsListQuery(debouncedSearch || undefined);

  const {
    data: selectedProduct,
    isLoading: isSelectedProductLoading,
    error: selectedProductError,
  } = useAdminProductDetailQuery(selectedProductId ?? '');

  const {
    data: sizeData,
    isLoading: isSizesLoading,
    error: sizesError,
  } = useAdminProductSizesQuery(selectedProductId ?? '');

  const {
    data: inventoryData,
    isLoading: isInventoryLoading,
    error: inventoryError,
  } = useAdminProductInventoryQuery(selectedProductId ?? '', { limit: 50 });

  const { data: brands } = useAdminBrandsQuery({ active: true });
  const { data: categories } = useAdminCategoriesQuery({ active: true });
  const { data: collections } = useAdminCollectionsQuery({ active: true });

  const { mutate: createProduct, isPending: isCreatingProduct } = useCreateAdminProductMutation();
  const { mutate: updateProduct, isPending: isUpdatingProduct } = useUpdateAdminProductMutation();
  const { mutate: replaceProduct, isPending: isReplacingProduct } =
    useReplaceAdminProductMutation();
  const { mutate: deleteProduct, isPending: isDeletingProduct } = useDeleteAdminProductMutation();

  const { mutate: createSize, isPending: isCreatingSize } = useCreateAdminProductSizeMutation();
  const { mutate: updateSize, isPending: isUpdatingSize } = useUpdateAdminProductSizeMutation();
  const { mutate: deleteSize, isPending: isDeletingSize } = useDeleteAdminProductSizeMutation();

  const { mutate: applyInventoryOperation, isPending: isApplyingInventoryOp } =
    useMutateAdminProductInventoryMutation();

  const createForm = useForm<ProductFormValues>({
    resolver: zodResolver(adminProductFormSchema),
    defaultValues: emptyProductValues,
  });

  const manageForm = useForm<ProductFormValues>({
    resolver: zodResolver(adminProductFormSchema),
    defaultValues: emptyProductValues,
  });

  const createSizeForm = useForm<CreateSizeFormValues, unknown, CreateSizeValues>({
    resolver: zodResolver(createSizeSchema),
    defaultValues: {
      size: '',
      sku: null,
      barcode: null,
      stockQuantity: 0,
      reorderLevel: 0,
      active: true,
    },
  });

  const inventoryForm = useForm<InventoryOperationValues>({
    defaultValues: {
      operation: 'adjust_add',
      size: '',
      quantity: 1,
      note: null,
      referenceId: null,
      referenceType: null,
    },
  });

  const [sizeDrafts, setSizeDrafts] = useState<
    Array<
      AdminProductSizeUpdateInput & {
        id: string;
        availableQuantity: number;
        reservedQuantity: number;
      }
    >
  >([]);

  const products = listData?.products ?? [];
  const categoryRows = categories?.categories ?? [];

  const categoryMap = useMemo(
    () => new Map(categoryRows.map((category) => [category.id, category])),
    [categoryRows]
  );

  const brandOptions = useMemo<ProductOption[]>(
    () => (brands?.brands ?? []).map((brand) => ({ value: brand.id, label: brand.name })),
    [brands?.brands]
  );

  const categoryOptions = useMemo<ProductOption[]>(() => {
    function getCategoryPath(categoryId: string) {
      const selectedCategory = categoryMap.get(categoryId);
      if (!selectedCategory) return 'Unknown';

      const parts = [selectedCategory.name];
      let cursor = selectedCategory.parentId;
      const visited = new Set<string>();

      while (cursor && !visited.has(cursor)) {
        visited.add(cursor);
        const parent = categoryMap.get(cursor);
        if (!parent) break;
        parts.unshift(parent.name);
        cursor = parent.parentId;
      }

      return parts.join(' / ');
    }

    return categoryRows.map((category) => ({
      value: category.id,
      label: category.name,
      description: getCategoryPath(category.id),
    }));
  }, [categoryMap, categoryRows]);

  const collectionOptions = useMemo<ProductOption[]>(
    () =>
      (collections?.collections ?? []).map((collection) => ({
        value: collection.id,
        label: collection.name,
        description: collection.type,
      })),
    [collections?.collections]
  );

  const inventorySizeOptions = useMemo<ProductOption[]>(
    () =>
      (inventoryData?.product.sizes ?? []).map((size) => ({
        value: size.size,
        label: `${size.size} (${size.availableQuantity} available)`,
      })),
    [inventoryData?.product.sizes]
  );

  useEffect(() => {
    if (!selectedProduct) return;
    manageForm.reset(productToFormValues(selectedProduct));
  }, [selectedProduct, manageForm]);

  useEffect(() => {
    const nextDrafts = (sizeData?.sizes ?? []).map((size) => ({
      id: size.id,
      sizeId: size.id,
      size: size.size,
      sku: size.sku,
      barcode: size.barcode,
      stockQuantity: size.stockQuantity,
      reorderLevel: size.reorderLevel,
      active: size.active,
      availableQuantity: size.availableQuantity,
      reservedQuantity: size.reservedQuantity,
    }));

    setSizeDrafts(nextDrafts);
  }, [sizeData?.sizes]);

  function onCreateProduct(values: ProductFormValues) {
    const payload = toCreatePayload(values as CreateProductInput);

    createProduct(payload, {
      onSuccess: (product) => {
        toast.success('Product created successfully.');
        createForm.reset(emptyProductValues);
        setSelectedProductId(product.id);
        setActiveTab('details');
      },
      onError: (error) => toast.error(error.message),
    });
  }

  function onUpdateProduct(values: ProductFormValues) {
    if (!selectedProductId) return;

    if (!manageForm.formState.isDirty) {
      toast.info('No changes to update yet.');
      return;
    }

    const normalized = toCreatePayload(values as CreateProductInput);
    const payload = toUpdatePayload(normalized, manageForm.formState.dirtyFields);

    if (Object.keys(payload).length === 0) {
      toast.info('No changes to update yet.');
      return;
    }

    updateProduct(
      { productId: selectedProductId, data: payload },
      {
        onSuccess: (product) => {
          toast.success('Product updated successfully.');
          manageForm.reset(productToFormValues(product));
        },
        onError: (error) => toast.error(error.message),
      }
    );
  }

  function onReplaceProduct(values: ProductFormValues) {
    if (!selectedProductId) return;

    replaceProduct(
      { productId: selectedProductId, data: toCreatePayload(values as CreateProductInput) },
      {
        onSuccess: (product) => {
          toast.success('Product replaced successfully.');
          manageForm.reset(productToFormValues(product));
        },
        onError: (error) => toast.error(error.message),
      }
    );
  }

  function onDeleteProduct() {
    if (!selectedProductId) return;

    const confirmed = window.confirm(
      'Delete this product? This action cannot be undone and will remove the product from all listings.'
    );

    if (!confirmed) return;

    deleteProduct(selectedProductId, {
      onSuccess: () => {
        toast.success('Product deleted successfully.');
        setSelectedProductId(null);
        manageForm.reset(emptyProductValues);
      },
      onError: (error) => toast.error(error.message),
    });
  }

  function onCreateSize(values: CreateSizeValues) {
    if (!selectedProductId) {
      toast.error('Select a product first.');
      return;
    }

    const payload: AdminProductSizeCreateInput = {
      size: values.size,
      sku: toNullableString(values.sku),
      barcode: toNullableString(values.barcode),
      stockQuantity: values.stockQuantity,
      reorderLevel: values.reorderLevel,
      active: values.active,
    };

    createSize(
      { productId: selectedProductId, data: payload },
      {
        onSuccess: () => {
          toast.success('Size added successfully.');
          createSizeForm.reset({
            size: '',
            sku: null,
            barcode: null,
            stockQuantity: 0,
            reorderLevel: 0,
            active: true,
          });
        },
        onError: (error) => toast.error(error.message),
      }
    );
  }

  function onSaveSizeDraft(
    draft: AdminProductSizeUpdateInput & {
      id: string;
      availableQuantity: number;
      reservedQuantity: number;
    }
  ) {
    if (!selectedProductId || !draft.sizeId) return;

    const payload: AdminProductSizeUpdateInput = {
      sizeId: draft.sizeId,
      size: draft.size?.trim() || undefined,
      sku: toNullableString(draft.sku),
      barcode: toNullableString(draft.barcode),
      stockQuantity: draft.stockQuantity,
      reorderLevel: draft.reorderLevel,
      active: draft.active,
    };

    updateSize(
      { productId: selectedProductId, data: payload },
      {
        onSuccess: () => toast.success('Size updated successfully.'),
        onError: (error) => toast.error(error.message),
      }
    );
  }

  function onDeleteSize(sizeId: string) {
    if (!selectedProductId) return;

    const confirmed = window.confirm(
      'Delete this size? If it has active reservations, deletion will be blocked.'
    );
    if (!confirmed) return;

    deleteSize(
      { productId: selectedProductId, sizeId },
      {
        onSuccess: () => toast.success('Size deleted successfully.'),
        onError: (error) => toast.error(error.message),
      }
    );
  }

  function onRunInventoryOperation(values: InventoryOperationValues) {
    if (!selectedProductId) {
      toast.error('Select a product first.');
      return;
    }

    applyInventoryOperation(
      {
        productId: selectedProductId,
        data: {
          operation: values.operation,
          size: values.size,
          quantity: Number(values.quantity),
          note: toNullableString(values.note),
          referenceId: toNullableString(values.referenceId),
          referenceType: toNullableString(values.referenceType),
        },
      },
      {
        onSuccess: () => {
          toast.success('Inventory operation applied.');
          inventoryForm.reset({
            ...values,
            quantity: 1,
            note: null,
            referenceId: null,
            referenceType: null,
          });
        },
        onError: (error) => toast.error(error.message),
      }
    );
  }

  const isManageLocked = !selectedProductId || isSelectedProductLoading;
  const isManageBusy =
    manageForm.formState.isSubmitting ||
    isUpdatingProduct ||
    isReplacingProduct ||
    isDeletingProduct;

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => (
          <span className="text-xs uppercase tracking-wide text-neutral-500">Product</span>
        ),
        cell: (props) => (
          <div className="min-w-0">
            <p className="font-semibold text-neutral-900">{props.getValue()}</p>
            <p className="truncate text-xs text-neutral-500">{props.row.original.slug}</p>
          </div>
        ),
      }),
      columnHelper.display({
        id: 'taxonomy',
        header: () => (
          <span className="text-xs uppercase tracking-wide text-neutral-500">Taxonomy</span>
        ),
        cell: (props) => (
          <div className="text-sm text-neutral-700">
            <p>{props.row.original.brand?.name ?? 'No brand'}</p>
            <p className="text-xs text-neutral-500">
              {props.row.original.category?.name ?? 'No category'}
            </p>
          </div>
        ),
      }),
      columnHelper.display({
        id: 'price',
        header: () => (
          <span className="text-xs uppercase tracking-wide text-neutral-500">Price</span>
        ),
        cell: (props) => (
          <div className="text-sm text-neutral-700">
            <p>
              {formatPrice(
                props.row.original.pricing.basePrice,
                props.row.original.pricing.currency
              )}
            </p>
            <p className="text-xs text-neutral-500">{props.row.original.pricing.currency}</p>
          </div>
        ),
      }),
      columnHelper.accessor('updatedAt', {
        header: () => (
          <span className="text-xs uppercase tracking-wide text-neutral-500">Updated</span>
        ),
        cell: (props) => (
          <span className="text-sm text-neutral-500">{formatDate(props.getValue())}</span>
        ),
      }),
      columnHelper.display({
        id: 'select',
        header: () => (
          <span className="text-xs uppercase tracking-wide text-neutral-500">Open</span>
        ),
        cell: (props) => {
          const isSelected = selectedProductId === props.row.original.id;

          return (
            <button
              type="button"
              onClick={() => {
                setSelectedProductId(isSelected ? null : props.row.original.id);
                setActiveTab('details');
              }}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {isSelected ? 'Selected' : 'Open'}
            </button>
          );
        },
      }),
    ],
    [selectedProductId]
  );

  const productTable = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const operationOptions: ProductOption[] = [
    { value: 'adjust_add', label: 'Adjust Add (Restock)' },
    { value: 'adjust_remove', label: 'Adjust Remove' },
    { value: 'reserve', label: 'Reserve' },
    { value: 'release', label: 'Release' },
    { value: 'fulfill', label: 'Fulfill' },
  ];

  const selectedInventory = inventoryData?.product;

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-neutral-200 bg-linear-to-r from-[#f2f8ff] via-[#fffdf8] to-[#eefcf6] p-6">
        <h2 className="text-2xl font-semibold text-neutral-900">Product Operations Workspace</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Manage catalog details, operate size-level inventory, and audit stock movements from one
          readable admin flow.
        </p>
      </header>

      <div className="grid gap-6 ">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900">Product Explorer</h3>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
              {listData?.total ?? 0} products
            </span>
          </div>

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            type="text"
            placeholder="Search by name, slug, tags, style code"
            autoComplete="off"
            disabled={isProductsLoading}
          />

          {productsError ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {productsError.message}
            </p>
          ) : null}

          <div className="mt-4 max-h-130 overflow-auto rounded-xl border border-neutral-200">
            <Table>
              <TableHeader>
                {productTable.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-neutral-50">
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="px-3 py-2">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isProductsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-3 py-4 text-sm text-neutral-500">
                      Loading products...
                    </TableCell>
                  </TableRow>
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-3 py-4 text-sm text-neutral-500">
                      No products found.
                    </TableCell>
                  </TableRow>
                ) : (
                  productTable.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-neutral-50/80">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-3 py-2.5">
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

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Operations Console</h3>
              <p className="text-sm text-neutral-500">
                {selectedProduct ? selectedProduct.name : 'Select a product from explorer'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  activeTab === 'details'
                    ? 'bg-black text-white'
                    : 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('sizes')}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  activeTab === 'sizes'
                    ? 'bg-black text-white'
                    : 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                }`}
                disabled={!selectedProductId}
              >
                Sizes
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  activeTab === 'inventory'
                    ? 'bg-black text-white'
                    : 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                }`}
                disabled={!selectedProductId}
              >
                Inventory
              </button>
            </div>
          </div>

          {selectedProductError ? (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {selectedProductError.message}
            </p>
          ) : null}

          {activeTab === 'details' ? (
            <div className="space-y-6">
              <article className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <h4 className="text-base font-semibold text-neutral-900">Create Product</h4>
                <p className="mb-4 text-sm text-neutral-500">
                  Create a new product profile. Size and stock can be managed in the Sizes and
                  Inventory tabs after creation.
                </p>

                <form onSubmit={createForm.handleSubmit(onCreateProduct)} className="space-y-4">
                  <ProductCoreFields
                    form={createForm}
                    brands={brandOptions}
                    categories={categoryOptions}
                    collections={collectionOptions}
                    disabled={isCreatingProduct}
                  />

                  <button
                    type="submit"
                    disabled={isCreatingProduct}
                    className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreatingProduct ? 'Creating...' : 'Create Product'}
                  </button>
                </form>
              </article>

              <article className="rounded-xl border border-neutral-200 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-neutral-900">Manage Product</h4>
                    <p className="text-sm text-neutral-500">
                      {selectedProduct
                        ? `Last updated ${formatDate(selectedProduct.updatedAt)}`
                        : 'Select a product to manage'}
                    </p>
                  </div>
                </div>

                {isSelectedProductLoading && selectedProductId ? (
                  <p className="text-sm text-neutral-500">Loading product...</p>
                ) : (
                  <form className="space-y-4">
                    <ProductCoreFields
                      form={manageForm}
                      brands={brandOptions}
                      categories={categoryOptions}
                      collections={collectionOptions}
                      disabled={isManageLocked || isManageBusy}
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={manageForm.handleSubmit(onUpdateProduct)}
                        disabled={isManageLocked || isManageBusy}
                        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isUpdatingProduct ? 'Saving...' : 'Update Product'}
                      </button>

                      <button
                        type="button"
                        onClick={manageForm.handleSubmit(onReplaceProduct)}
                        disabled={isManageLocked || isManageBusy}
                        className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isReplacingProduct ? 'Replacing...' : 'Replace Product'}
                      </button>

                      <button
                        type="button"
                        onClick={onDeleteProduct}
                        disabled={isManageLocked || isManageBusy}
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isDeletingProduct ? 'Deleting...' : 'Delete Product'}
                      </button>
                    </div>
                  </form>
                )}
              </article>
            </div>
          ) : null}

          {activeTab === 'sizes' ? (
            <div className="space-y-5">
              <article className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <h4 className="text-base font-semibold text-neutral-900">Add Size</h4>
                <p className="mb-4 text-sm text-neutral-500">
                  Add sellable variants for this product. Reserved quantity is system-controlled.
                </p>

                <form
                  onSubmit={createSizeForm.handleSubmit(onCreateSize)}
                  className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
                >
                  <Field label="Size" xx={true}>
                    <Input
                      {...createSizeForm.register('size')}
                      disabled={!selectedProductId || isCreatingSize}
                    />
                  </Field>
                  <Field label="SKU" xx={false}>
                    <Input
                      {...createSizeForm.register('sku')}
                      disabled={!selectedProductId || isCreatingSize}
                    />
                  </Field>
                  <Field label="Barcode" xx={false}>
                    <Input
                      {...createSizeForm.register('barcode')}
                      disabled={!selectedProductId || isCreatingSize}
                    />
                  </Field>
                  <Field label="Stock" xx={true}>
                    <Input
                      type="number"
                      min={0}
                      {...createSizeForm.register('stockQuantity', { valueAsNumber: true })}
                      disabled={!selectedProductId || isCreatingSize}
                    />
                  </Field>
                  <Field label="Reorder" xx={false}>
                    <Input
                      type="number"
                      min={0}
                      {...createSizeForm.register('reorderLevel', { valueAsNumber: true })}
                      disabled={!selectedProductId || isCreatingSize}
                    />
                  </Field>
                  <label className="space-y-1.5 text-sm font-semibold text-gray-700">
                    <span>Status</span>
                    <div className="flex h-12 items-center gap-2 rounded-lg border border-neutral-200 px-3">
                      <input
                        type="checkbox"
                        {...createSizeForm.register('active')}
                        disabled={!selectedProductId || isCreatingSize}
                      />
                      <span className="text-sm font-normal text-neutral-700">Active size</span>
                    </div>
                  </label>

                  <div className="md:col-span-2 xl:col-span-3">
                    <button
                      type="submit"
                      disabled={!selectedProductId || isCreatingSize}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCreatingSize ? 'Adding...' : 'Add Size'}
                    </button>
                  </div>
                </form>
              </article>

              {sizesError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {sizesError.message}
                </p>
              ) : null}

              {isSizesLoading ? (
                <p className="text-sm text-neutral-500">Loading sizes...</p>
              ) : sizeDrafts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-neutral-300 p-5 text-sm text-neutral-500">
                  No sizes found for this product.
                </p>
              ) : (
                <div className="space-y-3">
                  {sizeDrafts.map((draft) => (
                    <SizeDraftRow
                      key={draft.id}
                      draft={draft}
                      onChange={(next) =>
                        setSizeDrafts((prev) =>
                          prev.map((item) => (item.id === next.id ? next : item))
                        )
                      }
                      onSave={() => onSaveSizeDraft(draft)}
                      onDelete={() => onDeleteSize(draft.id)}
                      saving={isUpdatingSize}
                      deleting={isDeletingSize}
                      disabled={!selectedProductId}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {activeTab === 'inventory' ? (
            <div className="space-y-5">
              <article className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <h4 className="text-base font-semibold text-neutral-900">Inventory Operation</h4>
                <p className="mb-4 text-sm text-neutral-500">
                  Perform an explicit stock action and keep the movement ledger accurate.
                </p>

                <form
                  onSubmit={inventoryForm.handleSubmit(onRunInventoryOperation)}
                  className="grid gap-3 md:grid-cols-2"
                >
                  <Controller
                    name="operation"
                    control={inventoryForm.control}
                    render={({ field }) => (
                      <Field label="Operation" xx={true}>
                        <OptionPicker
                          value={field.value}
                          options={operationOptions}
                          onChange={(next) =>
                            field.onChange(Array.isArray(next) ? (next[0] ?? 'adjust_add') : next)
                          }
                          placeholder="Select operation"
                          disabled={!selectedProductId || isApplyingInventoryOp}
                        />
                      </Field>
                    )}
                  />

                  <Controller
                    name="size"
                    control={inventoryForm.control}
                    render={({ field }) => (
                      <Field label="Size" xx={true}>
                        <OptionPicker
                          value={field.value}
                          options={inventorySizeOptions}
                          onChange={(next) =>
                            field.onChange(Array.isArray(next) ? (next[0] ?? '') : next)
                          }
                          placeholder="Select size"
                          disabled={!selectedProductId || isApplyingInventoryOp}
                        />
                      </Field>
                    )}
                  />

                  <Field label="Quantity" xx={true}>
                    <Input
                      type="number"
                      min={1}
                      {...inventoryForm.register('quantity', { valueAsNumber: true })}
                      disabled={!selectedProductId || isApplyingInventoryOp}
                    />
                  </Field>

                  <Field label="Reference Type" xx={false}>
                    <Input
                      {...inventoryForm.register('referenceType')}
                      placeholder="order, return, manual"
                      disabled={!selectedProductId || isApplyingInventoryOp}
                    />
                  </Field>

                  <Field label="Reference Id" xx={false}>
                    <Input
                      {...inventoryForm.register('referenceId')}
                      placeholder="Optional id"
                      disabled={!selectedProductId || isApplyingInventoryOp}
                    />
                  </Field>

                  <Field label="Note" xx={false}>
                    <Input
                      {...inventoryForm.register('note')}
                      placeholder="Optional operation note"
                      disabled={!selectedProductId || isApplyingInventoryOp}
                    />
                  </Field>

                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={!selectedProductId || isApplyingInventoryOp}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isApplyingInventoryOp ? 'Applying...' : 'Apply Operation'}
                    </button>
                  </div>
                </form>
              </article>

              {inventoryError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {inventoryError.message}
                </p>
              ) : null}

              {isInventoryLoading ? (
                <p className="text-sm text-neutral-500">Loading inventory...</p>
              ) : selectedInventory ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {selectedInventory.sizes.map((size) => (
                      <article
                        key={size.size}
                        className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
                      >
                        <p className="text-sm font-semibold text-neutral-900">Size {size.size}</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-neutral-700">
                          <p>Stock: {size.stockQuantity}</p>
                          <p>Reserved: {size.reservedQuantity}</p>
                          <p>Available: {size.availableQuantity}</p>
                          <p className={size.isLowStock ? 'text-amber-700' : 'text-emerald-700'}>
                            {size.isLowStock ? 'Low stock' : 'Healthy'}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="rounded-xl border border-neutral-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-neutral-50">
                          <TableHead>When</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Delta</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Reserved</TableHead>
                          <TableHead>Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(inventoryData?.movements ?? []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-sm text-neutral-500">
                              No movements yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          (inventoryData?.movements ?? []).map((movement) => (
                            <TableRow key={movement.id}>
                              <TableCell className="text-xs text-neutral-600">
                                {formatDate(movement.createdAt)}
                              </TableCell>
                              <TableCell>{movement.size}</TableCell>
                              <TableCell>{movement.reason}</TableCell>
                              <TableCell
                                className={
                                  movement.quantityDelta > 0 ? 'text-emerald-700' : 'text-red-700'
                                }
                              >
                                {movement.quantityDelta > 0
                                  ? `+${movement.quantityDelta}`
                                  : movement.quantityDelta}
                              </TableCell>
                              <TableCell>
                                {movement.stockBefore} {'->'} {movement.stockAfter}
                              </TableCell>
                              <TableCell>
                                {movement.reservedBefore} {'->'} {movement.reservedAfter}
                              </TableCell>
                              <TableCell className="max-w-60 truncate text-xs text-neutral-600">
                                {movement.note ?? '-'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-neutral-500">Select a product to inspect inventory.</p>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
