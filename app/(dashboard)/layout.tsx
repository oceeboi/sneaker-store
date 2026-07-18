import { ProtectedRoute } from '@/components/layout/protected-route';
import { SessionProvider } from '@/lib/context/SessionContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ProtectedRoute>{children}</ProtectedRoute>
    </SessionProvider>
  );
}
