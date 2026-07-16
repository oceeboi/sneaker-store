import type { Metadata } from 'next';

import { VerifyEmailCard } from '@/components/auth/verify-email-card';

export const metadata: Metadata = {
  title: 'Verify Email | Sneaker Store',
  description: 'Verify your email address to activate your Sneaker Store account.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function VerifyEmailPage() {
  return <VerifyEmailCard />;
}
