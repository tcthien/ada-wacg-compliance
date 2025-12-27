import { useState, useCallback } from 'react';
import { api, type ReportResponse } from '@/lib/api';

/**
 * Type guard to check if response is in "generating" state
 */
function isGenerating(response: ReportResponse): response is { status: 'generating'; jobId: string } {
  return 'status' in response && response.status === 'generating';
}

export function useExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportReport = useCallback(async (scanId: string, format: 'pdf' | 'json') => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.reports.get(scanId, format);

      if (isGenerating(response)) {
        // Poll for completion
        await pollForReport(scanId, format, response.jobId);
      } else if (response.url) {
        // Download immediately
        downloadFile(response.url, `accessibility-report-${scanId}.${format}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export report');
    } finally {
      setLoading(false);
    }
  }, []);

  return { exportReport, loading, error };
}

async function pollForReport(scanId: string, format: 'pdf' | 'json', _jobId: string): Promise<void> {
  const maxAttempts = 30; // 30 seconds max
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await api.reports.get(scanId, format);

    // Check if report is ready (has url property)
    if (!isGenerating(response)) {
      downloadFile(response.url, `accessibility-report-${scanId}.${format}`);
      return;
    }

    attempts++;
  }

  throw new Error('Report generation timed out');
}

function downloadFile(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
