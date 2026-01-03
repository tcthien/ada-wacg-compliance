'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * Admin Providers Component
 *
 * Wraps admin pages with necessary context providers:
 * - QueryClientProvider for React Query (useQuery, useMutation, etc.)
 *
 * @param children - Child components to wrap
 */
export function AdminProviders({ children }: { children: React.ReactNode }) {
  // Create QueryClient instance once per component lifecycle
  // Using useState ensures the client is created only once and persists across re-renders
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Don't refetch on window focus in admin panel
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
            // Consider data stale after 30 seconds
            staleTime: 30 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
