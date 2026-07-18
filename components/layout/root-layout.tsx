'use client';
import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Footer, Mobile_Navigation_UI, NavUI, Sub_Navigation_Ui } from '../navigation';
import { SessionProvider } from '@/lib/context/SessionContext';

export function RootLayoutComp({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // or a skeleton/loading state
  }

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <NavUI />
        <Sub_Navigation_Ui />
        {children}
        <Footer />
        <ReactQueryDevtools initialIsOpen={false} />
        <Mobile_Navigation_UI />
      </QueryClientProvider>
    </SessionProvider>
  );
}
