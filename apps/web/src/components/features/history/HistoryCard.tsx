import Link from 'next/link';
import { ScanStatus } from '@/lib/api';

interface Scan {
  id: string;
  url: string;
  status: ScanStatus;
  wcagLevel: string;
  createdAt: string;
  completedAt?: string | null;
  issueCount?: number;
}

interface HistoryCardProps {
  scan: Scan;
}

export function HistoryCard({ scan }: HistoryCardProps) {
  const statusColors: Record<ScanStatus, string> = {
    PENDING: 'bg-gray-100 text-gray-800',
    RUNNING: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
  };

  return (
    <Link
      href={`/scan/${scan.id}`}
      className="block border rounded-lg p-4 hover:border-blue-300 transition-colors"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{scan.url}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {new Date(scan.createdAt).toLocaleString()} • Level {scan.wcagLevel}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {scan.status === 'COMPLETED' && scan.issueCount !== undefined && (
            <div className="text-sm">
              <span className="font-medium">{scan.issueCount}</span> issues
            </div>
          )}
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              statusColors[scan.status]
            }`}
          >
            {scan.status}
          </span>
        </div>
      </div>
    </Link>
  );
}
