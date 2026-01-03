import { useState, useCallback, useRef, useEffect } from 'react';
import { requestBatchExport, getBatchExportStatus, type BatchExportResponse } from '@/lib/batch-api';
import type { BatchStatus } from '@/lib/batch-api';

/**
 * Export state interface for tracking batch export status
 * Matches the state machine: idle → generating → completed | error
 *
 * @requirements 3.1, 4.1
 */
export interface BatchExportState {
  status: 'idle' | 'generating' | 'completed' | 'error';
  format: 'pdf' | 'json' | null;
  error: string | null;
  reportId: string | null;
}

/**
 * Return type for useBatchExport hook
 *
 * @requirements 3.1, 4.1, 4.5
 */
export interface UseBatchExportReturn {
  /** Export batch results in specified format */
  exportBatch: (batchId: string, format: 'pdf' | 'json') => Promise<boolean>;
  /** Current export state */
  state: BatchExportState;
  /** Cancel ongoing export */
  cancel: () => void;
  /** Reset state to idle */
  reset: () => void;
  /** Whether an export is currently in progress */
  isExporting: boolean;
  /** Whether export is available for this batch (based on status) */
  canExport: boolean;
  /** Whether to show success confirmation (Requirement 4.5) */
  showSuccessConfirmation: boolean;
  /** Dismiss success confirmation */
  dismissSuccess: () => void;
}

/**
 * Type guard to check if response is ready with URL
 */
function isReady(response: BatchExportResponse): response is {
  status: 'ready';
  url: string;
  expiresAt: string;
  reportId: string;
} {
  return response.status === 'ready' && 'url' in response;
}

/**
 * Type guard to check if response is in "generating" state
 */
function isGenerating(response: BatchExportResponse): response is {
  status: 'generating';
  reportId: string;
  message?: string;
} {
  return response.status === 'generating';
}

/**
 * Type guard to check if response is failed
 */
function isFailed(response: BatchExportResponse): response is {
  status: 'failed';
  errorMessage: string;
  reportId?: string;
} {
  return response.status === 'failed';
}

/**
 * Download file from URL
 * For cross-origin URLs (like S3), we need to fetch the blob first
 */
async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    // For cross-origin URLs (S3 presigned URLs), fetch the content first
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
    console.warn('Direct download failed, opening in new tab:', err);
    window.open(url, '_blank');
  }
}

/**
 * Poll for batch report completion with exponential backoff
 * Returns the download URL when ready, or throws on timeout
 */
async function pollForBatchReport(
  batchId: string,
  format: 'pdf' | 'json',
  cancelledRef: React.MutableRefObject<boolean>
): Promise<{ url: string; reportId: string } | null> {
  const maxAttempts = 30; // 30 attempts max (with backoff: ~2 minutes total)
  let attempts = 0;
  let delay = 1000; // Start with 1 second

  while (attempts < maxAttempts) {
    // Check if cancelled before waiting
    if (cancelledRef.current) return null;

    await new Promise(resolve => setTimeout(resolve, delay));

    // Check if cancelled after waiting
    if (cancelledRef.current) return null;

    try {
      const response = await getBatchExportStatus(batchId, format);

      // Check if report is ready
      if (isReady(response)) {
        return { url: response.url, reportId: response.reportId };
      }

      // Check if generation failed
      if (isFailed(response)) {
        throw new Error(response.errorMessage || 'Report generation failed');
      }

      // If still generating, increase delay with exponential backoff (max 5 seconds)
      delay = Math.min(delay * 1.5, 5000);
      attempts++;
    } catch (err) {
      // If it's our explicit error, rethrow
      if (err instanceof Error && err.message.includes('Report generation failed')) {
        throw err;
      }
      // Don't fail on individual poll errors, just retry
      attempts++;
    }
  }

  throw new Error('Report generation timed out. Please try again.');
}

/**
 * Hook for managing batch export state and operations
 *
 * Provides state machine for export flow:
 * idle → generating → completed | error
 *
 * Features:
 * - Async export with polling
 * - Cancellation support
 * - Success confirmation display
 * - canExport derived from batch status
 *
 * @param batchStatus - Current batch status (PENDING, RUNNING, COMPLETED, etc.)
 * @returns UseBatchExportReturn with export functions and state
 *
 * @requirements 3.1, 4.1, 4.5
 *
 * @example
 * ```tsx
 * const { exportBatch, state, canExport, showSuccessConfirmation } = useBatchExport('COMPLETED');
 *
 * return (
 *   <button
 *     onClick={() => exportBatch('batch_123', 'pdf')}
 *     disabled={!canExport || state.status === 'generating'}
 *   >
 *     {state.status === 'generating' ? 'Generating...' : 'Export PDF'}
 *   </button>
 * );
 * ```
 */
export function useBatchExport(batchStatus: BatchStatus | string): UseBatchExportReturn {
  // Export state management
  const [state, setState] = useState<BatchExportState>({
    status: 'idle',
    format: null,
    error: null,
    reportId: null,
  });

  // Success confirmation state (Requirement 4.5)
  const [showSuccessConfirmation, setShowSuccessConfirmation] = useState(false);

  // Track if export is cancelled to prevent memory leaks
  const cancelledRef = useRef(false);

  // Auto-hide success confirmation after 2 seconds (Requirement 4.5)
  useEffect(() => {
    if (showSuccessConfirmation) {
      const timer = setTimeout(() => {
        setShowSuccessConfirmation(false);
        // Reset state to idle after success confirmation
        setState({
          status: 'idle',
          format: null,
          error: null,
          reportId: null,
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessConfirmation]);

  /**
   * Determine if export is available based on batch status
   * Export is only available for completed batches (Requirement 1.4, 2.5)
   */
  const canExport = batchStatus === 'COMPLETED';

  /**
   * Export batch results in specified format
   */
  const exportBatch = useCallback(async (batchId: string, format: 'pdf' | 'json'): Promise<boolean> => {
    // Reset cancelled state for new export
    cancelledRef.current = false;
    setShowSuccessConfirmation(false);

    // Update state to generating
    setState({
      status: 'generating',
      format,
      error: null,
      reportId: null,
    });

    try {
      const response = await requestBatchExport(batchId, format);

      // Check if cancelled during the request
      if (cancelledRef.current) return false;

      if (isGenerating(response)) {
        // Update state with reportId
        setState(prev => ({
          ...prev,
          reportId: response.reportId,
        }));

        // Poll for completion with cancellation support
        const result = await pollForBatchReport(batchId, format, cancelledRef);
        if (result && !cancelledRef.current) {
          await downloadFile(result.url, `batch-report-${batchId}.${format}`);

          // Update state to completed
          setState({
            status: 'completed',
            format,
            error: null,
            reportId: result.reportId,
          });

          // Show success confirmation (Requirement 4.5)
          setShowSuccessConfirmation(true);

          return true;
        }
        return false;
      } else if (isReady(response)) {
        // Download immediately
        await downloadFile(response.url, `batch-report-${batchId}.${format}`);

        // Update state to completed
        setState({
          status: 'completed',
          format,
          error: null,
          reportId: response.reportId,
        });

        // Show success confirmation (Requirement 4.5)
        setShowSuccessConfirmation(true);

        return true;
      } else if (isFailed(response)) {
        throw new Error(response.errorMessage || 'Export generation failed');
      }

      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export batch report';

      // Don't set error if cancelled
      if (!cancelledRef.current) {
        // Update state to error
        setState(prev => ({
          status: 'error',
          format,
          error: errorMessage,
          reportId: prev.reportId,
        }));
      }
      return false;
    }
  }, []);

  /**
   * Cancel any ongoing export
   */
  const cancel = useCallback(() => {
    cancelledRef.current = true;

    // Reset state to idle when cancelled
    setState({
      status: 'idle',
      format: null,
      error: null,
      reportId: null,
    });
    setShowSuccessConfirmation(false);
  }, []);

  /**
   * Reset state to idle
   */
  const reset = useCallback(() => {
    setState({
      status: 'idle',
      format: null,
      error: null,
      reportId: null,
    });
    setShowSuccessConfirmation(false);
  }, []);

  /**
   * Dismiss success confirmation manually
   */
  const dismissSuccess = useCallback(() => {
    setShowSuccessConfirmation(false);
    // Reset state to idle
    setState({
      status: 'idle',
      format: null,
      error: null,
      reportId: null,
    });
  }, []);

  return {
    exportBatch,
    state,
    cancel,
    reset,
    isExporting: state.status === 'generating',
    canExport,
    showSuccessConfirmation,
    dismissSuccess,
  };
}
