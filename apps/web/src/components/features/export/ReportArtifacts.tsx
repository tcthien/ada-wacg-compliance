'use client';

import { useState } from 'react';

/**
 * Report artifact information
 */
export interface ReportArtifact {
  exists: true;
  url: string;
  createdAt?: string;
  expiresAt?: string;
  fileSizeBytes?: number;
  reportId?: string;
}

/**
 * Report status for both formats
 */
export interface ReportArtifactStatus {
  pdf: ReportArtifact | null;
  json: ReportArtifact | null;
}

interface ReportArtifactsProps {
  /** Report status with PDF and JSON availability */
  status: ReportArtifactStatus | null;
  /** Loading state */
  isLoading?: boolean;
  /** ID for filename (scanId or batchId) */
  resourceId: string;
  /** Resource type for filename prefix */
  resourceType?: 'scan' | 'batch';
  /** Optional className for container */
  className?: string;
}

/**
 * ReportArtifacts Component
 *
 * Displays available report artifacts (PDF/JSON) with download links.
 * Shows icons for each format with "View Report" links when available.
 * Indicates loading state and handles download with proper filenames.
 *
 * @example
 * ```tsx
 * // For single scan
 * const { status, isLoading } = useReportStatus(scanId);
 * <ReportArtifacts
 *   status={status}
 *   isLoading={isLoading}
 *   resourceId={scanId}
 *   resourceType="scan"
 * />
 *
 * // For batch scan
 * const { status, isLoading } = useBatchReportStatus(batchId);
 * <ReportArtifacts
 *   status={status}
 *   isLoading={isLoading}
 *   resourceId={batchId}
 *   resourceType="batch"
 * />
 * ```
 */
export function ReportArtifacts({
  status,
  isLoading = false,
  resourceId,
  resourceType = 'scan',
  className = '',
}: ReportArtifactsProps) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingJson, setDownloadingJson] = useState(false);

  // Don't render anything if no reports exist
  if (!status || (!status.pdf && !status.json)) {
    if (isLoading) {
      return (
        <div className={`flex items-center gap-2 ${className}`}>
          <span className="text-sm text-muted-foreground">Checking reports...</span>
        </div>
      );
    }
    return null;
  }

  const handleDownload = async (
    format: 'pdf' | 'json',
    url: string,
    setDownloading: (v: boolean) => void
  ) => {
    setDownloading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to download file');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Create download link with proper filename
      const filename = `accessibility-report-${resourceType}-${resourceId.slice(0, 8)}.${format}`;
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // Cleanup
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(url, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="text-sm text-muted-foreground mr-1">Reports:</span>

      {/* PDF Report */}
      {status.pdf && (
        <button
          onClick={() => handleDownload('pdf', status.pdf!.url, setDownloadingPdf)}
          disabled={downloadingPdf}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
          title="Download PDF Report"
        >
          <PdfIcon className="w-4 h-4" />
          <span>{downloadingPdf ? 'Downloading...' : 'PDF'}</span>
        </button>
      )}

      {/* JSON Report */}
      {status.json && (
        <button
          onClick={() => handleDownload('json', status.json!.url, setDownloadingJson)}
          disabled={downloadingJson}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
          title="Download JSON Report"
        >
          <JsonIcon className="w-4 h-4" />
          <span>{downloadingJson ? 'Downloading...' : 'JSON'}</span>
        </button>
      )}
    </div>
  );
}

/**
 * PDF icon component
 */
function PdfIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M10 12v4" />
      <path d="M8 14h4" />
      <text
        x="12"
        y="18"
        textAnchor="middle"
        fontSize="6"
        fill="currentColor"
        stroke="none"
        fontWeight="bold"
      >
        PDF
      </text>
    </svg>
  );
}

/**
 * JSON icon component
 */
function JsonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h2" />
      <path d="M8 17h2" />
      <path d="M14 13h2" />
      <path d="M14 17h2" />
    </svg>
  );
}

export default ReportArtifacts;
