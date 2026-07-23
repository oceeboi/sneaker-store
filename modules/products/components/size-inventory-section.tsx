'use client';

import { Field, Input } from '@/components/shared/form';
import type { CreateProductInput } from '@/services/product.service';
import { useFieldArray, useForm } from 'react-hook-form';

import type { ProductFormValues } from '../types/admin-product.types';

type ProductFormInstance = ReturnType<
  typeof useForm<ProductFormValues, unknown, CreateProductInput>
>;
type SizeFieldArray = ReturnType<typeof useFieldArray<ProductFormValues, 'sizes'>>;

function toNonNegativeInt(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 0 ? Math.trunc(value) : 0;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return 0;
}

export function SizeInventorySection({
  form,
  sizeFields,
  appendSize,
  removeSize,
  disabled,
}: {
  form: ProductFormInstance;
  sizeFields: SizeFieldArray['fields'];
  appendSize: SizeFieldArray['append'];
  removeSize: SizeFieldArray['remove'];
  disabled: boolean;
}) {
  const errors = form.formState.errors;

  return (
    <div className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h5 className="text-sm font-semibold text-neutral-900">Sizes & Inventory</h5>
          <p className="text-sm text-neutral-500">
            Track size-level SKU and stock metrics directly from this product form.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            appendSize({
              size: '',
              sku: null,
              barcode: null,
              stockQuantity: 0,
              reservedQuantity: 0,
              reorderLevel: 0,
              active: true,
            })
          }
          disabled={disabled}
          className="rounded border border-neutral-200 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add size
        </button>
      </div>

      {typeof errors.sizes?.message === 'string' ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errors.sizes.message}
        </div>
      ) : null}

      <div className="space-y-3">
        {sizeFields.length === 0 ? (
          <p className="text-sm text-neutral-500">No size options added yet.</p>
        ) : null}

        {sizeFields.map((fieldItem, index) => {
          const rowErrors = errors.sizes?.[index];

          return (
            <div key={fieldItem.id} className="rounded border border-neutral-200 bg-white p-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Size"
                  error={
                    typeof rowErrors?.size?.message === 'string'
                      ? rowErrors.size.message
                      : undefined
                  }
                  delay={0}
                  xx={true}
                >
                  <Input
                    {...form.register(`sizes.${index}.size` as const)}
                    type="text"
                    placeholder="Size"
                    hasError={Boolean(rowErrors?.size)}
                    disabled={disabled}
                  />
                </Field>

                <Field
                  label="SKU"
                  error={
                    typeof rowErrors?.sku?.message === 'string' ? rowErrors.sku.message : undefined
                  }
                  delay={0}
                  xx={false}
                >
                  <Input
                    {...form.register(`sizes.${index}.sku` as const)}
                    type="text"
                    placeholder="SKU"
                    hasError={Boolean(rowErrors?.sku)}
                    disabled={disabled}
                  />
                </Field>

                <Field
                  label="Barcode"
                  error={
                    typeof rowErrors?.barcode?.message === 'string'
                      ? rowErrors.barcode.message
                      : undefined
                  }
                  delay={0}
                  xx={false}
                >
                  <Input
                    {...form.register(`sizes.${index}.barcode` as const)}
                    type="text"
                    placeholder="Barcode"
                    hasError={Boolean(rowErrors?.barcode)}
                    disabled={disabled}
                  />
                </Field>

                <label className="space-y-1.5 text-sm font-semibold text-gray-700">
                  <span>Status</span>
                  <div className="flex h-12.5 items-center gap-2 rounded border border-neutral-200 px-3 py-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      {...form.register(`sizes.${index}.active` as const)}
                      disabled={disabled}
                    />
                    <span>Active</span>
                  </div>
                </label>

                <Field
                  label="Stock Quantity"
                  error={
                    typeof rowErrors?.stockQuantity?.message === 'string'
                      ? rowErrors.stockQuantity.message
                      : undefined
                  }
                  delay={0}
                  xx={true}
                >
                  <Input
                    {...form.register(`sizes.${index}.stockQuantity` as const, {
                      setValueAs: toNonNegativeInt,
                    })}
                    type="number"
                    min={0}
                    placeholder="Stock"
                    hasError={Boolean(rowErrors?.stockQuantity)}
                    disabled={disabled}
                  />
                </Field>

                <Field
                  label="Reserved Quantity"
                  error={
                    typeof rowErrors?.reservedQuantity?.message === 'string'
                      ? rowErrors.reservedQuantity.message
                      : undefined
                  }
                  delay={0}
                  xx={false}
                >
                  <Input
                    {...form.register(`sizes.${index}.reservedQuantity` as const, {
                      setValueAs: toNonNegativeInt,
                    })}
                    type="number"
                    min={0}
                    placeholder="Reserved"
                    hasError={Boolean(rowErrors?.reservedQuantity)}
                    disabled={disabled}
                  />
                </Field>

                <Field
                  label="Reorder Level"
                  error={
                    typeof rowErrors?.reorderLevel?.message === 'string'
                      ? rowErrors.reorderLevel.message
                      : undefined
                  }
                  delay={0}
                  xx={false}
                >
                  <Input
                    {...form.register(`sizes.${index}.reorderLevel` as const, {
                      setValueAs: toNonNegativeInt,
                    })}
                    type="number"
                    min={0}
                    placeholder="Reorder level"
                    hasError={Boolean(rowErrors?.reorderLevel)}
                    disabled={disabled}
                  />
                </Field>
              </div>

              <button
                type="button"
                onClick={() => removeSize(index)}
                disabled={disabled}
                className="mt-3 rounded border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove size
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
