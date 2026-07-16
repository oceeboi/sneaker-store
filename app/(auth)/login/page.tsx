import type { Metadata } from 'next';

import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Login | Sneaker Store',
  description:
    'Sign in to your Sneaker Store account to manage orders, track rewards, and complete checkout faster.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return <LoginForm />;
}
