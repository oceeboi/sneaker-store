import type { Metadata } from 'next';

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot Password | Sneaker Store',
  description: 'Request a secure password reset link for your Sneaker Store account.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
