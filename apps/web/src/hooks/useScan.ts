import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ScanStatus as ApiScanStatus } from '@/lib/api';

interface ScanState {
  scanId: string;
  status: ApiScanStatus;
  progress: number | undefined;
  url: string;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

interface UseScanOptions {
  pollInterval?: number; // ms, default 2000
}

export function useScan(scanId: string, options: UseScanOptions = {}) {
  const { pollInterval = 2000 } = options;
  const [scan, setScan] = useState<ScanState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.scans.getStatus(scanId);
      setScan({
        scanId: data.scanId,
        status: data.status,
        progress: data.progress,
        url: data.url,
        createdAt: data.createdAt,
        completedAt: data.completedAt,
        errorMessage: data.errorMessage,
      });
      setError(null);

      // Stop polling if scan is complete or failed
      if (data.status === 'COMPLETED' || data.status === 'FAILED') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  }, [scanId]);

  useEffect(() => {
    // Initial fetch
    fetchStatus();

    // Set up polling
    intervalRef.current = setInterval(fetchStatus, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchStatus, pollInterval]);

  return { scan, loading, error, refetch: fetchStatus };
}
