'use client';
import { useAddressesQuery } from '@/hooks/user.hook';
import type { AddressData } from '@/services/user.service';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useRouter } from 'next/navigation';

function render_address_content(address: AddressData | null) {
  if (!address) {
    return 'You have not set up this type of address yet.';
  }

  const address_lines = [
    `${address.firstName} ${address.lastName}`.trim(),
    address.street,
    `${address.city}, ${address.state}`,
    [address.country, address.postalCode].filter(Boolean).join(' '),
    address.phone,
  ].filter(Boolean);

  return address_lines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>);
}

export default function AddressPage() {
  const router: AppRouterInstance = useRouter();
  const { data: addresses } = useAddressesQuery();
  const billing_address = addresses?.defaults.billing ?? null;
  const shipping_address = addresses?.defaults.shipping ?? null;

  function route_to_page(href: string) {
    router.push(href);
  }

  return (
    <div>
      <div>
        <h4 className="text-sm text-black mt-3.5 mb-5.25">
          The following addresses will be used on the checkout page by default.
        </h4>
      </div>
      <div>
        <div>
          <h3 className="text-[24px] font-medium mb-6">Billing address</h3>
        </div>
        <div>
          <address
            style={{
              fontStyle: 'normal',
              fontSize: 14,
              lineHeight: 1.2,
              marginBottom: 27,
            }}
            className=""
          >
            {render_address_content(billing_address)}
          </address>
          <button
            onClick={() => route_to_page('/address/billing-address')}
            className="p-4 mt-3.5 mb-5.25  bg-[#1d2128] rounded text-white"
          >
            {billing_address ? 'Edit Billing address' : 'Add Billing address'}
          </button>
        </div>
      </div>
      <div>
        <div>
          <h3 className="text-[24px] font-medium mb-6">Shipping address</h3>
        </div>
        <div>
          <address
            style={{
              fontStyle: 'normal',
              fontSize: 14,
              lineHeight: 1.2,
              marginBottom: 27,
            }}
            className=""
          >
            {render_address_content(shipping_address)}
          </address>
          <button
            onClick={() => route_to_page('/address/shipping-address')}
            className="p-4 rounded mt-3.5 mb-5.25  bg-[#1d2128] text-white"
          >
            {shipping_address ? 'Edit Shipping address' : 'Add Shipping address'}
          </button>
        </div>
      </div>
    </div>
  );
}
