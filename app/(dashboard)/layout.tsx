import { ProtectedRoute } from '@/components/layout/protected-route';
import { SessionProvider } from '@/lib/context/SessionContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-[#ffffff] flex overflow-hidden">
        <ProtectedRoute>
          <div className="flex-1 bg-[#f7f8f9]  flex flex-col items-center justify-center px-6 py-12 min-h-screen overflow-y-auto">
            {children}
          </div>
        </ProtectedRoute>
      </div>
    </SessionProvider>
  );
}
