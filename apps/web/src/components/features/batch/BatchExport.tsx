'use client';

import { useState } from 'react';
import { useBatchExport } from '@/hooks/useBatchExport';
import { ExportModal } from '@/components/features/export/ExportModal';
import type { BatchStatus } from '@/lib/batch-api';

/**
 * BatchExport component props
 */
interface BatchExportProps {
  batchId: string;
  status: BatchStatus | string;
  disabled?: boolean;
  className?: string;
}

type ExportFormat = 'pdf' | 'json';

/**
 * BatchExport component for exporting batch scan results
 *
 * Uses useBatchExport hook for state management and async export support.
 * Provides PDF and JSON format options with proper disabled states.
 *
 * @requirements 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.5
 *
 * @example
 * ```tsx
 * <BatchExport batchId="batch_123" status="COMPLETED" />
 * ```
 */
export function BatchExport({ batchId, status, disabled = false, className }: BatchExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Use the batch export hook for state management
  const {
    exportBatch,
    state,
    reset,
    cancel,
    isExporting,
    canExport: hookCanExport,
    showSuccessConfirmation,
    dismissSuccess,
  } = useBatchExport(status);

  // Combine hook canExport with disabled prop
  const canExport = hookCanExport && !disabled;

  const handleExport = async (format: ExportFormat) => {
    setIsOpen(false);
    setShowModal(true);
    await exportBatch(batchId, format);
  };

  const handleDismissError = () => {
    reset();
    setShowModal(false);
  };

  const handleCloseModal = () => {
    if (state.status === 'generating') {
      cancel();
    }
    reset();
    setShowModal(false);
  };

  const handleRetry = () => {
    if (state.format) {
      // Don't close modal, just retry
      exportBatch(batchId, state.format);
    }
  };

  const handleCancel = () => {
    cancel();
    setShowModal(false);
  };

  // Determine modal status
  const getModalStatus = (): 'generating' | 'completed' | 'error' => {
    if (state.status === 'error') return 'error';
    if (state.status === 'completed' || showSuccessConfirmation) return 'completed';
    return 'generating';
  };

  // Get tooltip text for disabled button
  const getDisabledTooltip = (): string | undefined => {
    if (disabled) return 'Export is currently unavailable';
    if (!hookCanExport) return 'Export is only available for completed batches';
    return undefined;
  };

  return (
    <>
      <div className={`relative ${className || ''}`}>
        {/* Main Export Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled={!canExport || isExporting}
          title={getDisabledTooltip() || 'Export batch results'}
          aria-label={canExport ? 'Export batch results' : getDisabledTooltip()}
          aria-disabled={!canExport || isExporting}
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <DownloadIcon className="w-4 h-4" />
          {isExporting ? (
            <>
              <Spinner className="w-4 h-4" />
              <span>Exporting {state.format?.toUpperCase()}...</span>
            </>
          ) : (
            <>
              <span>Export Results</span>
              <ChevronDownIcon className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Dropdown Menu */}
        {isOpen && canExport && (
          <>
            {/* Backdrop to close dropdown */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <div
              className="absolute right-0 mt-2 w-64 bg-white border rounded-lg shadow-lg z-20"
              role="menu"
              aria-orientation="vertical"
              aria-label="Export format options"
            >
              <div className="p-2">
                {/* PDF Option */}
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={isExporting}
                  className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-gray-100 rounded disabled:opacity-50 transition-colors"
                  role="menuitem"
                  aria-label="Export as PDF report"
                >
                  <PdfIcon className="w-5 h-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">PDF Report</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Executive summary with detailed stats
                    </div>
                  </div>
                </button>

                {/* JSON Option */}
                <button
                  onClick={() => handleExport('json')}
                  disabled={isExporting}
                  className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-gray-100 rounded disabled:opacity-50 transition-colors"
                  role="menuitem"
                  aria-label="Export as JSON data"
                >
                  <JsonIcon className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">JSON Data</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Complete batch data for CI/CD integration
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Screen reader announcements for status changes */}
      <div role="status" aria-live="polite" className="sr-only">
        {state.status === 'generating' && 'Generating export, please wait...'}
        {state.status === 'completed' && 'Export completed successfully. Download started.'}
        {state.status === 'error' && `Export failed: ${state.error}`}
      </div>

      {/* Export Modal for status display (Requirements 3.5, 4.1, 4.2, 4.4, 4.5) */}
      {state.format && (
        <ExportModal
          isOpen={showModal}
          onClose={handleCloseModal}
          format={state.format}
          status={getModalStatus()}
          {...(state.error ? { errorMessage: state.error } : {})}
          onRetry={handleRetry}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}

// Icon Components
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 18a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5h1a1.5 1.5 0 010 3h-.5v.5a.5.5 0 01-.5.5zm1-2h-.5v-1h.5a.5.5 0 010 1zm3.5 2a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5h1a1.5 1.5 0 011.5 1.5v1a1.5 1.5 0 01-1.5 1.5h-1zm1-1h-.5v-2h.5a.5.5 0 01.5.5v1a.5.5 0 01-.5.5zm3.5 1a.5.5 0 01-.5-.5v-3a.5.5 0 011 0v1h1a.5.5 0 010 1h-1v1.5a.5.5 0 01-.5.5z"/>
    </svg>
  );
}

function JsonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 3h2v2H5v5a2 2 0 01-2 2 2 2 0 012 2v5h2v2H5c-1.07-.27-2-.9-2-2v-4a2 2 0 00-2-2H0v-2h1a2 2 0 002-2V5a2 2 0 012-2m14 0a2 2 0 012 2v4a2 2 0 002 2h1v2h-1a2 2 0 00-2 2v4a2 2 0 01-2 2h-2v-2h2v-5a2 2 0 012-2 2 2 0 01-2-2V5h-2V3h2z"/>
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function SuccessIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
