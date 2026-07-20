'use client';
import { Breadcrumb } from '@/components/shared/breadcrumb';
import { Field, Input } from '@/components/shared/form';
import { SearchableSelect } from '@/components/shared/search-input';
import { countries } from '@/constants/countries';
import { useAddressesQuery, useUpdateBillingAddressMutation } from '@/hooks/user.hook';
import { UpsertAddressInput, upsertAddressSchema } from '@/schemas/user.schemas';
import type { AddressData } from '@/services/user.service';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

const EMPTY_ADDRESS_VALUES: UpsertAddressInput = {
  firstName: '',
  lastName: '',
  phone: '',
  street: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  label: '',
};

function to_form_values(address: AddressData | null | undefined): UpsertAddressInput {
  if (!address) {
    return { ...EMPTY_ADDRESS_VALUES };
  }

  return {
    firstName: address.firstName ?? '',
    lastName: address.lastName ?? '',
    phone: address.phone ?? '',
    street: address.street ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    country: address.country ?? '',
    postalCode: address.postalCode ?? '',
    label: address.label ?? '',
  };
}

function pick_dirty_values(
  values: UpsertAddressInput,
  dirty_fields: Partial<Record<keyof UpsertAddressInput, boolean>>
) {
  return (Object.keys(values) as (keyof UpsertAddressInput)[]).reduce(
    (payload, key) => {
      if (dirty_fields[key]) {
        payload[key] = values[key] ?? '';
      }
      return payload;
    },
    {} as Record<string, unknown>
  );
}

export default function BillingAddressPage() {
  const { data: addresses, isLoading: is_addresses_loading } = useAddressesQuery();
  const billing_address = addresses?.defaults.billing ?? null;
  const initial_values = useMemo(() => to_form_values(billing_address), [billing_address]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty, isLoading, dirtyFields },
  } = useForm<UpsertAddressInput>({
    resolver: zodResolver(upsertAddressSchema),
    defaultValues: EMPTY_ADDRESS_VALUES,
  });

  useEffect(() => {
    reset(initial_values);
  }, [initial_values, reset]);

  const { mutate } = useUpdateBillingAddressMutation();
  const on_submit = (values: UpsertAddressInput) => {
    if (!isDirty) {
      toast.info('No changes to save yet.');
      return;
    }

    const dirty_payload = pick_dirty_values(
      values,
      dirtyFields as Partial<Record<keyof UpsertAddressInput, boolean>>
    );

    const payload: Record<string, unknown> = {
      ...initial_values,
      ...dirty_payload,
    };

    mutate(payload, {
      onSuccess() {
        toast.success('Billing address saved successfully.');
        reset(values);
      },
      onError(error) {
        toast.error(error.message);
      },
    });
  };

  return (
    <div className="">
      <Breadcrumb />
      <div>
        <h3 className="text-[24px] text-black font-medium my-5">Billing address</h3>
      </div>

      <div>
        <form onSubmit={handleSubmit(on_submit)}>
          <div className="flex flex-col gap-5  lg:flex-row justify-between">
            <div className="flex-1">
              <Field label="First Name" error={errors.firstName?.message} delay={100} xx={true}>
                <Input
                  {...register('firstName')}
                  type="text"
                  placeholder=""
                  autoComplete="firstName"
                  hasError={!!errors.firstName}
                  disabled={isSubmitting || is_addresses_loading || isLoading}
                />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Last Name" error={errors.lastName?.message} delay={100} xx={true}>
                <Input
                  {...register('lastName')}
                  type="text"
                  placeholder=""
                  autoComplete="lastName"
                  hasError={!!errors.lastName}
                  disabled={isSubmitting || is_addresses_loading || isLoading}
                />
              </Field>
            </div>
          </div>

          <div className="mt-5">
            <Controller
              name="country"
              control={control}
              rules={{ required: 'Please select a destination country' }}
              render={({ field: { onChange, value, onBlur, name }, fieldState: { error } }) => (
                <div>
                  <SearchableSelect
                    xx
                    name={name}
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    items={countries}
                    displayField="name"
                    valueField="name"
                    label="Select Location"
                    hasError={!!error?.message}
                    searchFields={['name', 'value']}
                    placeholder="Search by country name..."
                  />
                  {error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
                </div>
              )}
            />
          </div>
          <div className="mt-5">
            <Field label="Street address" error={errors.street?.message} delay={100} xx={true}>
              <Input
                {...register('street')}
                type="text"
                placeholder="House number and street name"
                autoComplete="street"
                hasError={!!errors.street}
                disabled={isSubmitting || is_addresses_loading || isLoading}
              />
            </Field>
          </div>
          <div className="mt-5">
            <Field label="Postcode / ZIP" error={errors.postalCode?.message} delay={100} xx={false}>
              <Input
                {...register('postalCode')}
                type="text"
                placeholder=""
                autoComplete="postalCode"
                hasError={!!errors.postalCode}
                disabled={isSubmitting || is_addresses_loading || isLoading}
              />
            </Field>
          </div>
          <div className="mt-5">
            <Field label="State" error={errors.state?.message} delay={100} xx={true}>
              <Input
                {...register('state')}
                type="text"
                placeholder=""
                autoComplete="state"
                hasError={!!errors.state}
                disabled={isSubmitting || is_addresses_loading || isLoading}
              />
            </Field>
          </div>
          <div className="mt-5">
            <Field label="Town / City" error={errors.city?.message} delay={100} xx={true}>
              <Input
                {...register('city')}
                type="text"
                placeholder=""
                autoComplete="city"
                hasError={!!errors.city}
                disabled={isSubmitting || is_addresses_loading || isLoading}
              />
            </Field>
          </div>

          <div className="mt-5 mb-2.5">
            <Field label="Phone" error={errors.phone?.message} delay={100} xx={true}>
              <Input
                {...register('phone')}
                type="text"
                placeholder=""
                autoComplete="phone"
                hasError={!!errors.phone}
                disabled={isSubmitting || is_addresses_loading || isLoading}
              />
            </Field>
          </div>
          <div className="my-5">
            <Field label="Label" error={errors.label?.message} delay={100} xx={false}>
              <Input
                {...register('label')}
                type="text"
                placeholder=""
                autoComplete="label"
                hasError={!!errors.label}
                disabled={isSubmitting || is_addresses_loading || isLoading}
              />
            </Field>
          </div>
          <button
            type="submit"
            disabled={isSubmitting || is_addresses_loading || isLoading}
            className="rounded w-full cursor-pointer bg-[#1d2128] px-7 py-3.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <p className="text-white text-sm  font-bold">Save address</p>
          </button>
        </form>
      </div>
    </div>
  );
}
