'use client';

import { Field, Input, PasswordInput } from '@/components/shared/form';
import { SearchableSelect } from '@/components/shared/search-input';
import { useChangePasswordMutation, useUpdateUserMutation, useUserQuery } from '@/hooks/user.hook';
import { UploadCard } from '@/modules/cloudinary/components';
import type { CloudinaryAsset } from '@/modules/cloudinary/types';
import {
  PasswordChangeInput,
  passwordChangeSchema,
  UpdateUserInput,
  updateUserSchema,
} from '@/schemas/user.schemas';
import type { UserData } from '@/services/user.service';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

const gender_options: { name: string; value: GenderName }[] = [
  { name: 'Male', value: 'male' },
  { name: 'Female', value: 'female' },
  { name: 'Other', value: 'other' },
  { name: 'Prefer not to say', value: 'prefer_not_to_say' },
];

type GenderName = 'male' | 'female' | 'other' | 'prefer_not_to_say';
const tierStyles: Record<GenderName, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

function format_date_for_input(value: string | Date | null | undefined) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function to_profile_form_values(user_info: UserData | undefined): UpdateUserInput {
  return {
    email: user_info?.email ?? '',
    username: user_info?.username ?? '',
    firstName: user_info?.profile?.firstName ?? '',
    lastName: user_info?.profile?.lastName ?? '',
    phone: user_info?.profile?.phone ?? '',
    avatar: user_info?.profile?.avatar ?? '',
    dateOfBirth: format_date_for_input(user_info?.profile?.dateOfBirth),
    gender: user_info?.profile?.gender ?? undefined,
  };
}

function to_cloudinary_asset(value: string): CloudinaryAsset {
  return {
    api_key: '',
    asset_folder: '',
    asset_id: value,
    bytes: 0,
    created_at: new Date(0).toISOString(),
    display_name: 'Profile avatar',
    etag: '',
    format: '',
    height: 0,
    original_filename: 'profile-avatar',
    placeholder: false,
    public_id: '',
    resource_type: 'image',
    secure_url: value,
    signature: '',
    tags: ['profile-avatar'],
    type: 'upload',
    url: value,
    version: 1,
    version_id: '',
    width: 0,
  };
}

function pick_dirty_values(
  values: UpdateUserInput,
  dirty_fields: Partial<Record<keyof UpdateUserInput, boolean>>
) {
  return (Object.keys(values) as (keyof UpdateUserInput)[]).reduce((payload, key) => {
    if (!dirty_fields[key]) {
      return payload;
    }

    const value = values[key];
    if (value === undefined || value === null || value === '') {
      return payload;
    }

    if (key === 'gender') {
      payload[key] = value as UpdateUserInput['gender'];
      return payload;
    }

    payload[key] = value as Exclude<UpdateUserInput[typeof key], undefined>;
    return payload;
  }, {} as Partial<UpdateUserInput>);
}

export default function ProfilePage() {
  const { data: user_info, isLoading: is_user_loading } = useUserQuery();
  const { mutate: mutate_change_password, isPending: is_change_password_pending } =
    useChangePasswordMutation();
  const { mutate: mutate_update_user, isPending: is_update_user_pending } = useUpdateUserMutation();

  const initial_values = useMemo(() => to_profile_form_values(user_info), [user_info]);

  const user_update_form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: initial_values,
  });

  const password_change_form = useForm<PasswordChangeInput>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    user_update_form.reset(initial_values);
  }, [initial_values, user_update_form]);

  function user_update_on_submit(values: UpdateUserInput) {
    const dirty_payload = pick_dirty_values(
      values,
      user_update_form.formState.dirtyFields as Partial<Record<keyof UpdateUserInput, boolean>>
    );

    if (Object.keys(dirty_payload).length === 0) {
      toast.info('No changes to save yet.');
      return;
    }

    mutate_update_user(dirty_payload, {
      onSuccess(updated_user) {
        toast.success('Profile updated successfully.');
        user_update_form.reset(to_profile_form_values(updated_user));
      },
      onError(error) {
        toast.error(error.message);
      },
    });
  }

  function password_change_on_submit(values: PasswordChangeInput) {
    mutate_change_password(values, {
      onSuccess(result) {
        toast.success('Password updated successfully. You can now sign in again.');
        password_change_form.reset();
        window.location.replace('/login');
      },
      onError(error) {
        toast.error(error.message);
      },
    });
  }

  return (
    <section className="flex flex-col gap-6">
      <section className="rounded border  bg-white/90 p-8  sm:p-8">
        <div className="mb-6 flex flex-col gap-2">
          <h3 className="text-[24px] font-medium text-[#1d2128]">Account Details</h3>
          <p className="text-sm text-neutral-500">
            Update your profile information and public identity.
          </p>
        </div>

        <form
          onSubmit={user_update_form.handleSubmit(user_update_on_submit)}
          className="space-y-5.75"
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <Field
              label="First Name"
              error={user_update_form.formState.errors.firstName?.message}
              delay={100}
              xx={true}
            >
              <Input
                {...user_update_form.register('firstName')}
                type="text"
                placeholder="Your first name"
                autoComplete="given-name"
                hasError={!!user_update_form.formState.errors.firstName}
                disabled={user_update_form.formState.isSubmitting || is_user_loading}
              />
            </Field>

            <Field
              label="Last Name"
              error={user_update_form.formState.errors.lastName?.message}
              delay={100}
              xx={true}
            >
              <Input
                {...user_update_form.register('lastName')}
                type="text"
                placeholder="Your last name"
                autoComplete="family-name"
                hasError={!!user_update_form.formState.errors.lastName}
                disabled={user_update_form.formState.isSubmitting || is_user_loading}
              />
            </Field>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Field
              label="Display Name"
              error={user_update_form.formState.errors.username?.message}
              delay={100}
              xx={true}
            >
              <Input
                {...user_update_form.register('username')}
                type="text"
                placeholder="How your name appears"
                autoComplete="username"
                hasError={!!user_update_form.formState.errors.username}
                disabled={user_update_form.formState.isSubmitting || is_user_loading}
              />
            </Field>

            <Field
              label="Email Address"
              error={user_update_form.formState.errors.email?.message}
              delay={100}
              xx={true}
            >
              <Input
                {...user_update_form.register('email')}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                hasError={!!user_update_form.formState.errors.email}
                disabled={user_update_form.formState.isSubmitting || is_user_loading}
              />
            </Field>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Field
              label="Phone"
              error={user_update_form.formState.errors.phone?.message}
              delay={100}
              xx={false}
            >
              <Input
                {...user_update_form.register('phone')}
                type="tel"
                placeholder="Phone number"
                autoComplete="tel"
                hasError={!!user_update_form.formState.errors.phone}
                disabled={user_update_form.formState.isSubmitting || is_user_loading}
              />
            </Field>

            <Field
              label="Date of Birth"
              error={user_update_form.formState.errors.dateOfBirth?.message}
              delay={100}
              xx={false}
            >
              <Input
                {...user_update_form.register('dateOfBirth')}
                type="date"
                max={format_date_for_input(new Date())}
                autoComplete="bday"
                hasError={!!user_update_form.formState.errors.dateOfBirth}
                disabled={user_update_form.formState.isSubmitting || is_user_loading}
              />
            </Field>
          </div>

          <div className="grid ">
            <Controller
              name="avatar"
              control={user_update_form.control}
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <div className=" ">
                  <UploadCard
                    preset="profile-avatar"
                    resourceType="image"
                    value={value ? to_cloudinary_asset(value) : null}
                    onChange={(asset) => {
                      const avatar_url = asset?.secure_url ?? asset?.url ?? '';
                      onChange(avatar_url);
                    }}
                    title="Profile picture"
                    description="Upload a clear profile photo. JPG, PNG, and WebP are supported up to 5MB."
                    disabled={
                      user_update_form.formState.isSubmitting ||
                      is_user_loading ||
                      is_update_user_pending
                    }
                    className="h-full"
                    accept="image/*"
                  />
                  {error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
                </div>
              )}
            />
          </div>

          <div className="grid gap-5 lg:max-w-md">
            <Controller
              name="gender"
              control={user_update_form.control}
              rules={{ required: 'Please select a destination country' }}
              render={({ field: { onChange, value, onBlur, name }, fieldState: { error } }) => (
                <div>
                  <SearchableSelect
                    xx
                    name={name}
                    value={tierStyles[value as GenderName]}
                    onChange={onChange}
                    onBlur={onBlur}
                    items={gender_options}
                    displayField="name"
                    valueField="name"
                    label="Gender"
                    hasError={!!error?.message}
                    searchFields={['name', 'value']}
                    placeholder="Search by Gender name..."
                  />
                  {error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
                </div>
              )}
            />
          </div>

          <button
            type="submit"
            disabled={
              user_update_form.formState.isSubmitting || is_user_loading || is_update_user_pending
            }
            className="rounded w-full cursor-pointer bg-[#1d2128] px-7 py-3.5 text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            <p className="text-sm font-bold">Update Changes</p>
          </button>
        </form>
      </section>

      <section className="rounded border  bg-white/90 p-8  sm:p-8">
        <div className="mb-6 flex flex-col gap-2">
          <h3 className="text-[24px] font-medium text-[#1d2128]">Security</h3>
          <p className="text-sm text-neutral-500">
            Change your password and sign in again after a successful update.
          </p>
        </div>

        <form
          onSubmit={password_change_form.handleSubmit(password_change_on_submit)}
          className="space-y-5.75"
        >
          <Field
            label="Current Password"
            error={password_change_form.formState.errors.currentPassword?.message}
            delay={100}
            xx={true}
          >
            <PasswordInput
              {...password_change_form.register('currentPassword')}
              placeholder="Current password"
              autoComplete="current-password"
              hasError={!!password_change_form.formState.errors.currentPassword}
              disabled={password_change_form.formState.isSubmitting || is_change_password_pending}
            />
          </Field>

          <Field
            label="New Password"
            error={password_change_form.formState.errors.newPassword?.message}
            delay={100}
            xx={true}
          >
            <PasswordInput
              {...password_change_form.register('newPassword')}
              placeholder="New password"
              autoComplete="new-password"
              hasError={!!password_change_form.formState.errors.newPassword}
              disabled={password_change_form.formState.isSubmitting || is_change_password_pending}
            />
          </Field>

          <Field
            label="Confirm Password"
            error={password_change_form.formState.errors.confirmPassword?.message}
            delay={100}
            xx={true}
          >
            <PasswordInput
              {...password_change_form.register('confirmPassword')}
              placeholder="Confirm new password"
              autoComplete="new-password"
              hasError={!!password_change_form.formState.errors.confirmPassword}
              disabled={password_change_form.formState.isSubmitting || is_change_password_pending}
            />
          </Field>

          <button
            type="submit"
            disabled={password_change_form.formState.isSubmitting || is_change_password_pending}
            className="rounded w-full cursor-pointer bg-[#1d2128] px-7 py-3.5 text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            <p className="text-sm font-bold">Change Password</p>
          </button>
        </form>
      </section>
    </section>
  );
}
