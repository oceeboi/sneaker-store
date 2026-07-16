import type { Metadata } from 'next';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Reset Password | Sneaker Store',
  description: 'Set a new password for your Sneaker Store account.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
