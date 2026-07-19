import { ProtectedRoute } from '@/components/layout/protected-route';
import { HeaderBox } from '@/components/shared';
import { SessionProvider } from '@/lib/context/SessionContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
