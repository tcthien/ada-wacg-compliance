'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * App Providers Component
 *
 * Wraps the entire app with necessary context providers:
 * - QueryClientProvider for React Query (useQuery, useMutation, etc.)
 *
 * This is required for hooks like useCampaignStatus that use React Query.
 *
 * @param children - Child components to wrap
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  // Create QueryClient instance once per component lifecycle
  // Using useState ensures the client is created only once and persists across re-renders
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Refetch on window focus for fresh data
            refetchOnWindowFocus: true,
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
