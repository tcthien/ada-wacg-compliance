'use client';

import { useState } from 'react';
import { ExportOptions } from './ExportOptions';
import { ExportModal } from './ExportModal';
import { useReportStatus } from '@/hooks/useReportStatus';
import { useExport } from '@/hooks/useExport';
import { useAnalytics } from '@/hooks/useAnalytics';

interface ExportButtonProps {
  scanId: string;
}

export function ExportButton({ scanId }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { status, isLoading, refetch } = useReportStatus(scanId);
  const { exportReport, state, cancel, reset } = useExport();
  const { track } = useAnalytics();

  const handleDownload = async (format: 'pdf' | 'json', url: string) => {
    try {
      // Fetch the blob and trigger download
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to download file');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Create download link
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `accessibility-report-${scanId}.${format}`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // Cleanup
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      // Track successful export
      track('report_exported', {
        format,
        report_type: 'single',
        timestamp: new Date().toISOString(),
        sessionId: scanId,
      });

      // Track funnel completion
      const funnelSessionId = sessionStorage.getItem('funnel_session_id');
      if (funnelSessionId) {
        track('funnel_report_downloaded', {
          funnel_session_id: funnelSessionId,
          timestamp: new Date().toISOString(),
          sessionId: scanId,
        });
      }

      // Close dropdown after download
      setIsOpen(false);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  const handleGenerate = async (format: 'pdf' | 'json') => {
    setIsOpen(false);
    const success = await exportReport(scanId, format);
    if (success) {
      // Track successful export
      track('report_exported', {
        format,
        report_type: 'single',
        timestamp: new Date().toISOString(),
        sessionId: scanId,
      });

      // Track funnel completion
      const funnelSessionId = sessionStorage.getItem('funnel_session_id');
      if (funnelSessionId) {
        track('funnel_report_downloaded', {
          funnel_session_id: funnelSessionId,
          timestamp: new Date().toISOString(),
          sessionId: scanId,
        });
      }

      // Refetch status to update UI with new report
      await refetch();
    }
  };

  const handleModalClose = () => {
    reset();
  };

  const handleCancel = () => {
    cancel();
  };

  const handleRetry = async () => {
    if (state.format) {
      reset();
      await handleGenerate(state.format);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          disabled={isLoading}
        >
          <DownloadIcon className="w-4 h-4" />
          Export Report
          <ChevronDownIcon className="w-4 h-4" />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <ExportOptions
              reportStatus={status}
              onDownload={handleDownload}
              onGenerate={handleGenerate}
              disabled={isLoading}
            />
          </>
        )}
      </div>

      <ExportModal
        isOpen={state.status !== 'idle'}
        onClose={handleModalClose}
        format={state.format || 'pdf'}
        status={state.status === 'idle' ? 'generating' : state.status}
        {...(state.error ? { errorMessage: state.error } : {})}
        onRetry={handleRetry}
        onCancel={handleCancel}
      />
    </>
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
