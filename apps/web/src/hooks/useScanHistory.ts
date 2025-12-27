import { useState, useEffect, useCallback } from 'react';
import { api, ScanListResponse, ScanStatus } from '@/lib/api';

interface Scan {
  id: string;
  url: string;
  status: ScanStatus;
  wcagLevel: string;
  createdAt: string;
  completedAt: string | null;
  issueCount?: number;
}

export function useScanHistory() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScans = useCallback(async (nextCursor?: string) => {
    setLoading(true);
    try {
      const response: ScanListResponse = await api.scans.list(nextCursor);

      // Map API response to internal Scan type
      const mappedScans = response.scans.map((scan) => ({
        id: scan.id,
        url: scan.url,
        status: scan.status,
        wcagLevel: scan.wcagLevel,
        createdAt: scan.createdAt,
        completedAt: scan.completedAt,
      }));

      if (nextCursor) {
        setScans((prev) => [...prev, ...mappedScans]);
      } else {
        setScans(mappedScans);
      }

      setCursor(response.nextCursor);
      setHasMore(response.nextCursor !== null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  const loadMore = () => {
    if (cursor && !loading) {
      fetchScans(cursor);
    }
  };

  return {
    scans,
    loading,
    error,
    loadMore,
    hasMore,
    refresh: () => fetchScans(),
  };
}
