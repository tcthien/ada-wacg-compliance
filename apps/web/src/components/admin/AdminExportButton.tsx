'use client';

import { useState, useEffect } from 'react';
import { ExportOptions } from '@/components/features/export/ExportOptions';
import { ExportModal } from '@/components/features/export/ExportModal';
import { adminApi } from '@/lib/admin-api';
import { useAdminExport } from '@/hooks/useAdminExport';

interface AdminExportButtonProps {
  scanId: string;
  scanStatus: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
}

interface ReportInfo {
  exists: true;
  url: string;
  createdAt: string;
  fileSizeBytes: number;
  expiresAt: string;
}

interface ReportStatus {
  pdf: ReportInfo | null;
  json: ReportInfo | null;
}

export function AdminExportButton({ scanId, scanStatus }: AdminExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { exportReport, state, cancel, reset } = useAdminExport();

  // Fetch report status from admin API
  const fetchReportStatus = async () => {
    try {
      setIsLoading(true);
      const response = await adminApi.reports.getStatus(scanId);
      setStatus(response.reports);
    } catch (error) {
      console.error('Failed to fetch report status:', error);
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch status on mount and when scan status changes
  useEffect(() => {
    if (scanStatus === 'COMPLETED') {
      fetchReportStatus();
    }
  }, [scanId, scanStatus]);

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
      // Refetch status to update UI with new report
      await fetchReportStatus();
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

  // Disabled if scan is not completed
  const isDisabled = scanStatus !== 'COMPLETED' || isLoading;

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isDisabled}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <DownloadIcon className="h-4 w-4" />
          Export Report
          <ChevronDownIcon className="h-4 w-4" />
        </button>

        {isOpen && !isDisabled && (
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

      {state.status !== 'idle' && (
        <ExportModal
          isOpen={true}
          onClose={handleModalClose}
          format={state.format || 'pdf'}
          status={state.status}
          {...(state.error && { errorMessage: state.error })}
          onRetry={handleRetry}
          onCancel={handleCancel}
        />
      )}
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
