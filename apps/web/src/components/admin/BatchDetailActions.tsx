'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { BatchStatus } from '@/lib/admin-api';

interface BatchDetailActionsProps {
  batchId: string;
  status: BatchStatus;
  failedCount: number;
  completedCount: number;
  totalUrls: number;
  onCancel?: (batchId: string) => Promise<void>;
  onDelete?: (batchId: string) => Promise<void>;
  onRetry?: (batchId: string) => Promise<void>;
  onExport?: (batchId: string, format: 'pdf' | 'json' | 'csv') => Promise<void>;
}

type ActionState = {
  action: 'cancel' | 'delete' | 'retry' | 'export' | null;
  isLoading: boolean;
  error: string | null;
};

export function BatchDetailActions({
  batchId,
  status,
  failedCount,
  completedCount,
  totalUrls,
  onCancel,
  onDelete,
  onRetry,
  onExport,
}: BatchDetailActionsProps) {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [state, setState] = useState<ActionState>({
    action: null,
    isLoading: false,
    error: null,
  });

  // Determine which buttons to show
  const canCancel = (status === 'PENDING' || status === 'RUNNING') && onCancel;
  const canRetry = failedCount > 0 && onRetry;
  const canExport = completedCount > 0 && onExport;
  const canDelete = onDelete;

  const handleCancel = async () => {
    const pendingCount = totalUrls - completedCount - failedCount;
    const preservedCount = completedCount + failedCount;

    const confirmMessage =
      `Cancel this batch?\n\n` +
      `${pendingCount} scan(s) will be cancelled\n` +
      `${preservedCount} scan(s) will be preserved\n\n` +
      `This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setState({ action: 'cancel', isLoading: true, error: null });
    try {
      await onCancel!(batchId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel batch';
      setState({ action: 'cancel', isLoading: false, error: errorMessage });
    }
  };

  const handleDelete = async () => {
    const confirmMessage =
      `Delete this batch permanently?\n\n` +
      `This will delete:\n` +
      `- ${totalUrls} scan(s)\n` +
      `- All scan results and reports\n\n` +
      `⚠️ This action is IRREVERSIBLE and cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setState({ action: 'delete', isLoading: true, error: null });
    try {
      await onDelete!(batchId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete batch';
      setState({ action: 'delete', isLoading: false, error: errorMessage });
    }
  };

  const handleRetry = async () => {
    const confirmMessage =
      `Retry ${failedCount} failed scan(s)?\n\n` +
      `This will re-queue all failed scans for processing.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setState({ action: 'retry', isLoading: true, error: null });
    try {
      await onRetry!(batchId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retry scans';
      setState({ action: 'retry', isLoading: false, error: errorMessage });
    }
  };

  const handleExport = async (format: 'pdf' | 'json' | 'csv') => {
    setIsExportOpen(false);
    setState({ action: 'export', isLoading: true, error: null });
    try {
      await onExport!(batchId, format);
      setState({ action: null, isLoading: false, error: null });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export batch';
      setState({ action: 'export', isLoading: false, error: errorMessage });
    }
  };

  const handleDismissError = () => {
    setState({ action: null, isLoading: false, error: null });
  };

  const isActionLoading = (action: string) =>
    state.isLoading && state.action === action;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Cancel Button - Only for PENDING/RUNNING batches */}
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={state.isLoading}
            className="flex items-center gap-2 px-4 py-2 border border-orange-300 text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isActionLoading('cancel') ? (
              <>
                <Spinner className="w-4 h-4" />
                Cancelling...
              </>
            ) : (
              <>
                <CancelIcon className="w-4 h-4" />
                Cancel Batch
              </>
            )}
          </button>
        )}

        {/* Retry Failed Button - Only if failed scans exist */}
        {canRetry && (
          <button
            onClick={handleRetry}
            disabled={state.isLoading}
            className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isActionLoading('retry') ? (
              <>
                <Spinner className="w-4 h-4" />
                Retrying...
              </>
            ) : (
              <>
                <RetryIcon className="w-4 h-4" />
                Retry Failed ({failedCount})
              </>
            )}
          </button>
        )}

        {/* Export Dropdown - Only if completed scans exist */}
        {canExport && (
          <div className="relative">
            <button
              onClick={() => setIsExportOpen(!isExportOpen)}
              disabled={state.isLoading}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isActionLoading('export') ? (
                <>
                  <Spinner className="w-4 h-4" />
                  Exporting...
                </>
              ) : (
                <>
                  <DownloadIcon className="w-4 h-4" />
                  Export
                  <ChevronDownIcon className="w-4 h-4" />
                </>
              )}
            </button>

            {isExportOpen && !state.isLoading && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsExportOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-lg z-20">
                  <div className="p-2">
                    {/* PDF Option */}
                    <button
                      onClick={() => handleExport('pdf')}
                      className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-gray-100 rounded transition-colors"
                    >
                      <PdfIcon className="w-5 h-5 text-red-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">PDF Report</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Executive summary
                        </div>
                      </div>
                    </button>

                    {/* JSON Option */}
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-gray-100 rounded transition-colors"
                    >
                      <JsonIcon className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">JSON Data</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Complete data export
                        </div>
                      </div>
                    </button>

                    {/* CSV Option */}
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-gray-100 rounded transition-colors"
                    >
                      <CsvIcon className="w-5 h-5 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">CSV File</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Spreadsheet format
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* View Scans Button - Navigate to scans list filtered by this batch */}
        <Link
          href={`/admin/scans?batchId=${batchId}`}
          className="flex items-center gap-2 px-4 py-2 border border-purple-300 text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
        >
          <ViewScansIcon className="w-4 h-4" />
          View Scans
        </Link>

        {/* Delete Button - Always visible, danger styling */}
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={state.isLoading}
            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-auto"
          >
            {isActionLoading('delete') ? (
              <>
                <Spinner className="w-4 h-4" />
                Deleting...
              </>
            ) : (
              <>
                <DeleteIcon className="w-4 h-4" />
                Delete Batch
              </>
            )}
          </button>
        )}
      </div>

      {/* Error Toast Notification */}
      {state.error && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg shadow-lg p-4 max-w-md z-50 animate-in slide-in-from-right">
          <div className="flex items-start gap-3">
            <ErrorIcon className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-sm text-red-900">
                {state.action === 'cancel' && 'Cancel Failed'}
                {state.action === 'delete' && 'Delete Failed'}
                {state.action === 'retry' && 'Retry Failed'}
                {state.action === 'export' && 'Export Failed'}
              </div>
              <div className="text-xs text-red-700 mt-1">{state.error}</div>
            </div>
            <button
              onClick={handleDismissError}
              className="text-red-600 hover:text-red-800 transition-colors"
              aria-label="Dismiss error"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Icon Components
function CancelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function DeleteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function RetryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 18a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5h1a1.5 1.5 0 010 3h-.5v.5a.5.5 0 01-.5.5zm1-2h-.5v-1h.5a.5.5 0 010 1zm3.5 2a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5h1a1.5 1.5 0 011.5 1.5v1a1.5 1.5 0 01-1.5 1.5h-1zm1-1h-.5v-2h.5a.5.5 0 01.5.5v1a.5.5 0 01-.5.5zm3.5 1a.5.5 0 01-.5-.5v-3a.5.5 0 011 0v1h1a.5.5 0 010 1h-1v1.5a.5.5 0 01-.5.5z"/>
    </svg>
  );
}

function JsonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M5 3h2v2H5v5a2 2 0 01-2 2 2 2 0 012 2v5h2v2H5c-1.07-.27-2-.9-2-2v-4a2 2 0 00-2-2H0v-2h1a2 2 0 002-2V5a2 2 0 012-2m14 0a2 2 0 012 2v4a2 2 0 002 2h1v2h-1a2 2 0 00-2 2v4a2 2 0 01-2 2h-2v-2h2v-5a2 2 0 012-2 2 2 0 01-2-2V5h-2V3h2z"/>
    </svg>
  );
}

function CsvIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-7 8h10v2H6v-2zm0 4h10v2H6v-2z"/>
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ViewScansIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}
