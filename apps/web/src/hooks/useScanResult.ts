'use client';

import { useState, useEffect } from 'react';
import { api, type ScanResultResponse } from '@/lib/api';

interface UseScanResultOptions {
  /** Only fetch when enabled is true (default: true) */
  enabled?: boolean;
}

interface UseScanResultReturn {
  result: ScanResultResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage scan results
 * @param scanId - The ID of the scan to fetch results for
 * @param options - Hook options including enabled flag
 * @returns Object containing result data, loading state, error state, and refetch function
 */
export function useScanResult(
  scanId: string,
  options: UseScanResultOptions = {}
): UseScanResultReturn {
  const { enabled = true } = options;
  const [result, setResult] = useState<ScanResultResponse | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchResult = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.scans.getResult(scanId);
      setResult(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load scan results';
      setError(errorMessage);
      console.error('Error fetching scan result:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (scanId && enabled) {
      fetchResult();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId, enabled]);

  return { result, loading, error, refetch: fetchResult };
}
