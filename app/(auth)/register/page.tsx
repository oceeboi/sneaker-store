import type { Metadata } from 'next';

import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = {
  title: 'Create Account | Sneaker Store',
  description:
    'Create your Sneaker Store account to save addresses, track orders, and unlock member rewards.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RegisterPage() {
  return <RegisterForm />;
}
