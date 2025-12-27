'use client';

import { useExport } from '@/hooks/useExport';

interface ExportOptionsProps {
  scanId: string;
  onClose: () => void;
}

export function ExportOptions({ scanId, onClose }: ExportOptionsProps) {
  const { exportReport, loading, error } = useExport();

  const handleExport = async (format: 'pdf' | 'json') => {
    await exportReport(scanId, format);
    onClose();
  };

  return (
    <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-20">
      <div className="p-2">
        <button
          onClick={() => handleExport('pdf')}
          disabled={loading}
          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 rounded disabled:opacity-50"
        >
          <PdfIcon className="w-5 h-5 text-red-600" />
          <div>
            <div className="font-medium">PDF Report</div>
            <div className="text-xs text-muted-foreground">Formatted document</div>
          </div>
        </button>

        <button
          onClick={() => handleExport('json')}
          disabled={loading}
          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 rounded disabled:opacity-50"
        >
          <JsonIcon className="w-5 h-5 text-blue-600" />
          <div>
            <div className="font-medium">JSON Data</div>
            <div className="text-xs text-muted-foreground">Raw scan data</div>
          </div>
        </button>
      </div>

      {loading && (
        <div className="px-3 py-2 text-sm text-center text-muted-foreground border-t">
          Generating report...
        </div>
      )}

      {error && (
        <div className="px-3 py-2 text-sm text-center text-red-600 border-t">
          {error}
        </div>
      )}
    </div>
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
