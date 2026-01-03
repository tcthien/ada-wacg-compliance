import { useQuery } from '@tanstack/react-query';
import { api, type CampaignStatusResponse } from '@/lib/api';

/**
 * Return type for useCampaignStatus hook
 */
export interface UseCampaignStatusReturn {
  /** Campaign status data */
  status: CampaignStatusResponse | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if request failed */
  error: string | null;
  /** Function to manually refetch campaign status */
  refetch: () => void;
}

/**
 * Hook to fetch AI campaign status and statistics
 * Uses React Query with 30s stale time for optimal caching
 *
 * @returns Campaign status, loading state, error state, and refetch function
 *
 * @example
 * ```tsx
 * const { status, isLoading, error, refetch } = useCampaignStatus();
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error} />;
 * if (!status?.active) {
 *   // Campaign is inactive
 * }
 * ```
 */
export function useCampaignStatus(): UseCampaignStatusReturn {
  const {
    data,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<CampaignStatusResponse, Error>({
    queryKey: ['ai-campaign', 'status'],
    queryFn: () => api.aiCampaign.getStatus(),
    staleTime: 30000, // 30 seconds - data is considered fresh for this duration
    refetchInterval: (query) => {
      // Auto-refresh if campaign is active to monitor slot availability
      const campaignData = query.state.data;
      if (campaignData?.active) {
        return 30000; // Poll every 30 seconds while campaign is active
      }
      return false; // Don't auto-refresh when campaign is inactive
    },
  });

  return {
    status: data || null,
    isLoading,
    error: queryError?.message || null,
    refetch,
  };
}
