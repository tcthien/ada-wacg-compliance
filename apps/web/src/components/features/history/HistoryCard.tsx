import Link from 'next/link';
import { ScanStatus } from '@/lib/api';

// Extended status type that includes batch-specific statuses
type HistoryStatus = ScanStatus | 'CANCELLED' | 'STALE';

interface HistoryItem {
  id: string;
  type: 'scan' | 'batch';
  url: string;
  status: HistoryStatus;
  wcagLevel: string;
  createdAt: string;
  completedAt?: string | null | undefined;
  issueCount?: number | undefined;
  // Batch-specific fields
  totalUrls?: number | undefined;
  completedCount?: number | undefined;
  failedCount?: number | undefined;
}

interface HistoryCardProps {
  item: HistoryItem;
  /** Whether this item is selected (for bulk actions) */
  isSelected?: boolean;
  /** Callback when selection changes */
  onSelectionChange?: (selected: boolean) => void;
}

export function HistoryCard({ item, isSelected = false, onSelectionChange }: HistoryCardProps) {
  const statusColors: Record<HistoryStatus, string> = {
    PENDING: 'bg-gray-100 text-gray-800',
    RUNNING: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-orange-100 text-orange-800',
    STALE: 'bg-gray-100 text-gray-600',
  };

  const href = item.type === 'batch' ? `/batch/${item.id}` : `/scan/${item.id}`;
  const isBatch = item.type === 'batch';

  /**
   * Handle checkbox click - prevent navigation
   */
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  /**
   * Handle checkbox change
   */
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectionChange?.(e.target.checked);
  };

  return (
    <div className={`border rounded-lg p-4 transition-colors ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        {/* Selection Checkbox */}
        {onSelectionChange && (
          <div className="pt-1" onClick={handleCheckboxClick}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleCheckboxChange}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              aria-label={`Select ${item.type} ${item.url}`}
            />
          </div>
        )}

        {/* Main Content - Clickable Link */}
        <Link href={href} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="font-medium truncate">{item.url}</div>
            {isBatch && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 shrink-0">
                Batch: {item.totalUrls} URLs
              </span>
            )}
              </div>
              <div className="text-sm text-muted-foreground">
                {new Date(item.createdAt).toLocaleString()} • Level {item.wcagLevel}
              </div>
              {isBatch && item.status === 'COMPLETED' && (
                <div className="text-sm text-muted-foreground mt-1">
                  Completed: {item.completedCount}/{item.totalUrls}
                  {item.failedCount ? ` • Failed: ${item.failedCount}` : ''}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {item.status === 'COMPLETED' && item.issueCount !== undefined && !isBatch && (
                <div className="text-sm">
                  <span className="font-medium">{item.issueCount}</span> issues
                </div>
              )}
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  statusColors[item.status]
                }`}
              >
                {item.status}
              </span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
