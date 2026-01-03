import { useState, useCallback, useRef } from 'react';
import { api, type ReportResponse } from '@/lib/api';

/**
 * Export state interface for tracking export status
 */
export interface ExportState {
  status: 'idle' | 'generating' | 'completed' | 'error';
  format: 'pdf' | 'json' | null;
  error: string | null;
}

/**
 * Return type for useExport hook
 */
export interface UseExportReturn {
  exportReport: (scanId: string, format: 'pdf' | 'json') => Promise<boolean>;
  state: ExportState;
  cancel: () => void;
  reset: () => void;
  isExporting: boolean; // Backward compatibility
  loading: boolean; // Backward compatibility
  error: string | null; // Backward compatibility
}

/**
 * Type guard to check if response is in "generating" state
 */
function isGenerating(response: ReportResponse): response is { status: 'generating'; jobId: string } {
  return 'status' in response && response.status === 'generating';
}

/**
 * Type guard to check if response is ready with URL
 */
function isReady(response: ReportResponse): response is { url: string; expiresAt: string } {
  return 'url' in response && typeof response.url === 'string';
}

export function useExport(): UseExportReturn {
  // New state management
  const [state, setState] = useState<ExportState>({
    status: 'idle',
    format: null,
    error: null
  });

  // Legacy state for backward compatibility
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if export is cancelled to prevent memory leaks
  const cancelledRef = useRef(false);

  const exportReport = useCallback(async (scanId: string, format: 'pdf' | 'json'): Promise<boolean> => {
    // Reset cancelled state for new export
    cancelledRef.current = false;

    // Update state to generating
    setState({
      status: 'generating',
      format,
      error: null
    });

    // Legacy state updates for backward compatibility
    setLoading(true);
    setError(null);

    try {
      const response = await api.reports.get(scanId, format);

      // Check if cancelled during the request
      if (cancelledRef.current) return false;

      if (isGenerating(response)) {
        // Poll for completion with cancellation support
        const url = await pollForReport(scanId, format, cancelledRef);
        if (url && !cancelledRef.current) {
          await downloadFile(url, `accessibility-report-${scanId}.${format}`, format);

          // Update state to completed
          setState({
            status: 'completed',
            format,
            error: null
          });

          return true;
        }
        return false;
      } else if (isReady(response)) {
        // Download immediately
        await downloadFile(response.url, `accessibility-report-${scanId}.${format}`, format);

        // Update state to completed
        setState({
          status: 'completed',
          format,
          error: null
        });

        return true;
      }
      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export report';

      // Don't set error if cancelled
      if (!cancelledRef.current) {
        // Update state to error
        setState({
          status: 'error',
          format,
          error: errorMessage
        });

        // Legacy error state
        setError(errorMessage);
      }
      return false;
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Cancel any ongoing export when component unmounts
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setLoading(false);

    // Reset state to idle when cancelled
    setState({
      status: 'idle',
      format: null,
      error: null
    });
  }, []);

  // Reset state to idle
  const reset = useCallback(() => {
    setState({
      status: 'idle',
      format: null,
      error: null
    });
    setLoading(false);
    setError(null);
  }, []);

  return {
    exportReport,
    state,
    cancel,
    reset,
    // Backward compatibility properties
    isExporting: state.status === 'generating',
    loading,
    error
  };
}

/**
 * Poll for report completion with exponential backoff
 * Returns the download URL when ready, or throws on timeout
 */
async function pollForReport(
  scanId: string,
  format: 'pdf' | 'json',
  cancelledRef: React.MutableRefObject<boolean>
): Promise<string | null> {
  const maxAttempts = 15; // 15 attempts max (with backoff: ~45 seconds total)
  let attempts = 0;
  let delay = 1000; // Start with 1 second

  while (attempts < maxAttempts) {
    // Check if cancelled before waiting
    if (cancelledRef.current) return null;

    await new Promise(resolve => setTimeout(resolve, delay));

    // Check if cancelled after waiting
    if (cancelledRef.current) return null;

    try {
      const response = await api.reports.get(scanId, format);

      // Check if report is ready (has url property)
      if (isReady(response)) {
        return response.url;
      }

      // If still generating, increase delay with exponential backoff (max 5 seconds)
      delay = Math.min(delay * 1.5, 5000);
      attempts++;
    } catch (err) {
      // Don't fail on individual poll errors, just retry
      attempts++;
    }
  }

  throw new Error('Report generation timed out. Please try again.');
}

/**
 * Download file from URL
 * For cross-origin URLs (like S3), we need to fetch the blob first
 */
async function downloadFile(url: string, filename: string, format: 'pdf' | 'json'): Promise<void> {
  try {
    // For cross-origin URLs (S3 presigned URLs), fetch the content first
    // This ensures the download works even with CORS restrictions on the download attribute
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const blob = await response.blob();

    // Create object URL from blob
    const blobUrl = URL.createObjectURL(blob);

    // Create download link
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // Cleanup
    document.body.removeChild(a);
    // Revoke the blob URL after a short delay to ensure download starts
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    // Fallback: open in new tab if fetch fails (e.g., CORS issues)
    // This at least allows the user to manually save the file
    console.warn('Direct download failed, opening in new tab:', err);
    window.open(url, '_blank');
  }
}
