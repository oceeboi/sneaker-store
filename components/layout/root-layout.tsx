'use client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { NavUI } from '../navigation';

export function RootLayoutComp({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <NavUI />
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
