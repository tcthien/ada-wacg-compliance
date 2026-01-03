import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, AiCampaignMetrics } from '@/lib/admin-api';

/**
 * Return type for useAdminAiCampaign hook
 */
export interface UseAdminAiCampaignReturn {
  /** Campaign metrics data */
  metrics: AiCampaignMetrics | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if request failed */
  error: string | null;
  /** Function to manually refetch campaign metrics */
  refetch: () => void;
  /** Pause the campaign */
  pauseCampaign: () => Promise<void>;
  /** Resume the campaign */
  resumeCampaign: () => Promise<void>;
  /** Whether pause/resume is in progress */
  isUpdating: boolean;
}

/**
 * React hook for fetching and managing AI campaign metrics
 *
 * Provides campaign metrics with pause/resume functionality.
 * Uses React Query with 30s stale time for optimal caching.
 *
 * @returns Campaign metrics, loading state, error state, and control functions
 *
 * @example
 * ```tsx
 * function AiCampaignDashboard() {
 *   const {
 *     metrics,
 *     isLoading,
 *     error,
 *     pauseCampaign,
 *     resumeCampaign,
 *     isUpdating
 *   } = useAdminAiCampaign();
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error} />;
 *
 *   return (
 *     <div>
 *       <h2>Token Usage: {metrics?.percentUsed}%</h2>
 *       <button
 *         onClick={metrics?.campaignStatus === 'ACTIVE' ? pauseCampaign : resumeCampaign}
 *         disabled={isUpdating}
 *       >
 *         {metrics?.campaignStatus === 'ACTIVE' ? 'Pause' : 'Resume'}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAdminAiCampaign(): UseAdminAiCampaignReturn {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<AiCampaignMetrics, Error>({
    queryKey: ['admin', 'ai-campaign', 'metrics'],
    queryFn: () => adminApi.aiCampaign.getMetrics(),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Auto-refresh every minute
  });

  // Pause campaign mutation
  const pauseMutation = useMutation({
    mutationFn: () => adminApi.aiCampaign.pause(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-campaign'] });
    },
  });

  // Resume campaign mutation
  const resumeMutation = useMutation({
    mutationFn: () => adminApi.aiCampaign.resume(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-campaign'] });
    },
  });

  return {
    metrics: data || null,
    isLoading,
    error: queryError?.message || pauseMutation.error?.message || resumeMutation.error?.message || null,
    refetch,
    pauseCampaign: pauseMutation.mutateAsync,
    resumeCampaign: resumeMutation.mutateAsync,
    isUpdating: pauseMutation.isPending || resumeMutation.isPending,
  };
}
