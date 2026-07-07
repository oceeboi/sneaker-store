'use client';

/**
 * user.hook.ts
 *
 * TanStack Query bindings for `UserService`. Same conventions as
 * `product.hook.ts`:
 *
 * 1. One hook per service method, named after the HTTP intent
 *    (`use...Query` for reads, `use...Mutation` for writes).
 * 2. `ServiceResult<T>` is unwrapped once, at the hook boundary, via
 *    `unwrapResult`, throwing `UserServiceError` — components never see the
 *    `{ success, data | message }` union directly.
 * 3. Query keys come from a single factory (`userKeys`) — every resource here
 *    is a singleton scoped to "the current user", so the key tree is flatter
 *    than the product hooks (no per-id variants needed).
 * 4. `staleTime`/`gcTime` per resource, chosen by how often that data
 *    actually changes:
 *      - Profile (`getUser`): moderate — changes only when the user edits it.
 *      - Referral / account (loyalty, membership, store credit): shorter —
 *        these can change from server-side events (a referral converting, a
 *        reward posting) that don't originate from this client's own writes,
 *        so a shorter `staleTime` catches that without polling.
 *      - Addresses: longest — these change only on explicit edit.
 * 5. No optimistic (`onMutate`) writes. `updateUser` can 409 on email/username
 *    collision and `changePassword` can 401 on a wrong current password —
 *    both are exactly the kind of "might not actually succeed" mutation where
 *    showing a fake-success state first would need an ugly rollback. Every
 *    mutation here is pessimistic: wait for the server, then write/invalidate
 *    the confirmed result.
 *
 * Adjust the import path below if your project's alias differs:
 *   - `@/services/user.service` → wherever `UserService`/`userService` lives
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';

import { userService } from '@/services/user.service';
import type { AccountData, AddressData, ReferralData, UserData } from '@/services/user.service';
// `UpdateUserInput`/`PasswordChangeInput` are defined via `z.infer` inside
// `@/schemas/user.schemas`, not re-exported from `user.service.ts` — unlike
// `product.service.ts`, which does re-export its `CreateProductInput`-style
// types. Import them from the schema module directly.
import type { PasswordChangeInput, UpdateUserInput } from '@/schemas/user.schemas';

// ---------------------------------------------------------------------------
// Error boundary between ServiceResult<T> and TanStack Query
// ---------------------------------------------------------------------------

type ServiceResult<T> = { success: true; data: T } | { success: false; message: string };

/**
 * Thrown by every query/mutation in this file when the underlying
 * `UserService` call resolves with `{ success: false }`. Components read
 * `error.message` off `useQuery`/`useMutation`'s `error` field like any other
 * thrown error.
 */
export class UserServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserServiceError';
  }
}

function unwrapResult<T>(result: ServiceResult<T>): T {
  if (!result.success) {
    throw new UserServiceError(result.message);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
// Every resource here is scoped to "the current authenticated user" — there's
// no id parameter to key on, so this stays a flat, named tree rather than the
// list/detail shape used for `productKeys`.

export const userKeys = {
  all: ['user'] as const,
  profile: () => [...userKeys.all, 'profile'] as const,
  referral: () => [...userKeys.all, 'referral'] as const,
  account: () => [...userKeys.all, 'account'] as const,
  addressAll: () => [...userKeys.all, 'address'] as const,
  addressList: () => [...userKeys.addressAll(), 'list'] as const,
  addressBilling: () => [...userKeys.addressAll(), 'billing'] as const,
  addressShipping: () => [...userKeys.addressAll(), 'shipping'] as const,
};

// Shared option-forwarding types, matching product.hook.ts.
type QueryOptionsOf<TData> = Omit<UseQueryOptions<TData, UserServiceError>, 'queryKey' | 'queryFn'>;
type MutationOptionsOf<TData, TVariables> = Omit<
  UseMutationOptions<TData, UserServiceError, TVariables>,
  'mutationFn'
>;

// ===========================================================================
// PROFILE
// ===========================================================================

/**
 * `UserService.getUser` — the current user's account + profile.
 *
 * Caching: this is read on most authenticated pages (nav avatar, account
 * settings, checkout prefill), so a moderate `staleTime` avoids refetching on
 * every navigation while still picking up the user's own recent edits
 * reasonably quickly.
 */
export function useUserQuery(options?: QueryOptionsOf<UserData>) {
  return useQuery({
    queryKey: userKeys.profile(),
    queryFn: async () => unwrapResult(await userService.getUser()),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * `UserService.updateUser`.
 *
 * On success: writes the returned user directly into the profile cache
 * (the response already contains the full updated record — no need to
 * refetch something we just received).
 */
export function useUpdateUserMutation(options?: MutationOptionsOf<UserData, UpdateUserInput>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateUserInput) => unwrapResult(await userService.updateUser(data)),
    onSuccess: (user, variables, onMutateResult, context) => {
      queryClient.setQueryData(userKeys.profile(), user);
      options?.onSuccess?.(user, variables, onMutateResult, context);
    },
    ...options,
  });
}

/**
 * `UserService.changePassword`.
 *
 * No cache to invalidate here — the response is just a confirmation message,
 * not a resource this file caches. `retry: false` because a 401 ("current
 * password incorrect") is a user-input error, not a transient failure, and
 * retrying it automatically would just resubmit the same wrong password.
 *
 * Note: if your auth layer invalidates existing sessions on password change
 * (worth checking against your `AuthService`/`SessionProvider` refresh logic),
 * this is the natural place to also trigger a session refresh or sign-out —
 * left out here since that lives in a different service than `UserService`.
 */
export function useChangePasswordMutation(
  options?: MutationOptionsOf<{ message: string }, PasswordChangeInput>
) {
  return useMutation({
    mutationFn: async (data: PasswordChangeInput) =>
      unwrapResult(await userService.changePassword(data)),
    retry: false,
    ...options,
  });
}

// ===========================================================================
// REWARDS / REFERRALS
// ===========================================================================

/**
 * `UserService.getReferral`.
 *
 * Caching: shorter `staleTime` than profile — referral counts and points can
 * change from events on the server (someone using this user's referral code)
 * that don't originate from this client's own mutations, so relying on a long
 * cache would show stale numbers with no local write to trigger a refresh.
 */
export function useReferralQuery(options?: QueryOptionsOf<ReferralData>) {
  return useQuery({
    queryKey: userKeys.referral(),
    queryFn: async () => unwrapResult(await userService.getReferral()),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    ...options,
  });
}

// ===========================================================================
// MEMBERSHIP / ACCOUNT
// ===========================================================================

/**
 * `UserService.getAccount` — membership tier, store credit, loyalty points.
 *
 * Caching: same rationale as referral data — store credit and loyalty points
 * can change from server-side events (an order completing, a refund posting)
 * that this client didn't initiate, so this is kept short-lived rather than
 * treated like slow-changing profile data.
 */
export function useAccountQuery(options?: QueryOptionsOf<AccountData>) {
  return useQuery({
    queryKey: userKeys.account(),
    queryFn: async () => unwrapResult(await userService.getAccount()),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    ...options,
  });
}

// ===========================================================================
// ADDRESSES
// ===========================================================================

/**
 * `UserService.getAddresses` — full address list plus default billing/shipping.
 *
 * Caching: addresses only change on explicit edit, so this gets a long
 * `staleTime` — there's no server-side process that silently changes a user's
 * saved addresses the way loyalty points or referral counts can change.
 */
export function useAddressesQuery(
  options?: QueryOptionsOf<{
    addresses: AddressData[];
    defaults: { billing: AddressData | null; shipping: AddressData | null };
  }>
) {
  return useQuery({
    queryKey: userKeys.addressList(),
    queryFn: async () => unwrapResult(await userService.getAddresses()),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    ...options,
  });
}

/** `UserService.getBillingAddress`. */
export function useBillingAddressQuery(options?: QueryOptionsOf<AddressData>) {
  return useQuery({
    queryKey: userKeys.addressBilling(),
    queryFn: async () => unwrapResult(await userService.getBillingAddress()),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * `UserService.updateBillingAddress`.
 *
 * On success: writes the returned address into the billing-specific cache
 * and invalidates the combined address list (it embeds this same address
 * under `defaults.billing`, and possibly in `addresses[]`).
 */
export function useUpdateBillingAddressMutation(
  options?: MutationOptionsOf<AddressData, Record<string, unknown>>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) =>
      unwrapResult(await userService.updateBillingAddress(data)),
    onSuccess: (address, variables, onMutateResult, context) => {
      queryClient.setQueryData(userKeys.addressBilling(), address);
      queryClient.invalidateQueries({ queryKey: userKeys.addressList() });
      options?.onSuccess?.(address, variables, onMutateResult, context);
    },
    ...options,
  });
}

/** `UserService.getShippingAddress`. */
export function useShippingAddressQuery(options?: QueryOptionsOf<AddressData>) {
  return useQuery({
    queryKey: userKeys.addressShipping(),
    queryFn: async () => unwrapResult(await userService.getShippingAddress()),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * `UserService.updateShippingAddress`.
 * Same invalidation shape as `useUpdateBillingAddressMutation`.
 */
export function useUpdateShippingAddressMutation(
  options?: MutationOptionsOf<AddressData, Record<string, unknown>>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) =>
      unwrapResult(await userService.updateShippingAddress(data)),
    onSuccess: (address, variables, onMutateResult, context) => {
      queryClient.setQueryData(userKeys.addressShipping(), address);
      queryClient.invalidateQueries({ queryKey: userKeys.addressList() });
      options?.onSuccess?.(address, variables, onMutateResult, context);
    },
    ...options,
  });
}
