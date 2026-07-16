import type { Metadata } from 'next';

import { LogoutCard } from '@/components/auth/logout-card';

export const metadata: Metadata = {
  title: 'Logout | Sneaker Store',
  description: 'Securely signing you out of your Sneaker Store account.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LogoutPage() {
  return <LogoutCard />;
}
