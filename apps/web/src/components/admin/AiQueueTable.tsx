'use client';

/**
 * AI Queue Table Component
 *
 * Displays AI scan queue with filtering, sorting, and management actions:
 * - Table with columns: Scan ID, URL, Email, Status, Tokens, Requested At, Processed At
 * - Status filter dropdown (PENDING, DOWNLOADED, COMPLETED, FAILED, All)
 * - Date range picker filter
 * - Export pending scans button
 * - Import AI results button with file input
 * - Retry action for failed scans
 *
 * Requirements: REQ-4, REQ-8 AC 2
 */

import { useState, useRef } from 'react';
import { useAdminAiQueue, AiQueueListFilters } from '@/hooks/useAdminAiQueue';
import { AiStatus } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  Upload,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileDown,
} from 'lucide-react';

/**
 * Format date for display
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format number with commas
 */
function formatNumber(num: number | null): string {
  if (num === null) return '-';
  return num.toLocaleString();
}

/**
 * Truncate long URLs
 */
function truncateUrl(url: string, maxLength: number = 40): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
}

/**
 * Get status badge variant and icon
 */
function getStatusDisplay(status: AiStatus): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: React.ReactNode;
  label: string;
} {
  switch (status) {
    case 'PENDING':
      return {
        variant: 'outline',
        icon: <Clock className="h-3 w-3" />,
        label: 'Pending',
      };
    case 'DOWNLOADED':
      return {
        variant: 'secondary',
        icon: <FileDown className="h-3 w-3" />,
        label: 'Downloaded',
      };
    case 'PROCESSING':
      return {
        variant: 'default',
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        label: 'Processing',
      };
    case 'COMPLETED':
      return {
        variant: 'default',
        icon: <CheckCircle2 className="h-3 w-3" />,
        label: 'Completed',
      };
    case 'FAILED':
      return {
        variant: 'destructive',
        icon: <XCircle className="h-3 w-3" />,
        label: 'Failed',
      };
    default:
      return {
        variant: 'outline',
        icon: null,
        label: status,
      };
  }
}

interface AiQueueTableProps {
  /** Initial filters for the queue */
  initialFilters?: AiQueueListFilters;
}

export function AiQueueTable({ initialFilters }: AiQueueTableProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const {
    scans,
    pagination,
    stats,
    isLoading,
    error,
    filters,
    setFilters,
    refetch,
    exportCsv,
    isExporting,
    importCsv,
    isImporting,
    importResult,
    retryFailedScan,
    isRetrying,
  } = useAdminAiQueue(initialFilters);

  // Handle file import
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(null);

    try {
      const result = await importCsv(file);
      if (result.success) {
        setImportSuccess(
          `Successfully imported ${result.processed} scans. ${result.tokensDeducted} tokens deducted.`
        );
        if (result.failed > 0) {
          setImportError(`${result.failed} scans failed to import.`);
        }
      } else {
        setImportError(`Import failed: ${result.errors.map((e) => e.error).join(', ')}`);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle status filter change
  const handleStatusChange = (value: string) => {
    if (value === 'all') {
      // Remove status property when 'all' is selected
      const { status: _removed, ...rest } = filters;
      setFilters({ ...rest, page: 1 });
    } else {
      setFilters({
        ...filters,
        status: value as AiStatus,
        page: 1,
      });
    }
  };

  // Handle date filter changes
  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setFilters({ ...filters, dateFrom: e.target.value, page: 1 });
    } else {
      const { dateFrom: _removed, ...rest } = filters;
      setFilters({ ...rest, page: 1 });
    }
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setFilters({ ...filters, dateTo: e.target.value, page: 1 });
    } else {
      const { dateTo: _removed, ...rest } = filters;
      setFilters({ ...rest, page: 1 });
    }
  };

  // Pagination handlers
  const handlePrevPage = () => {
    if (pagination.page > 1) {
      setFilters({ ...filters, page: pagination.page - 1 });
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.totalPages) {
      setFilters({ ...filters, page: pagination.page + 1 });
    }
  };

  return (
    <div className="space-y-4">
      {/* Queue Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 bg-gray-50 rounded-lg p-4">
          <StatBadge label="Pending" value={stats.byStatus.PENDING} color="text-yellow-600" />
          <StatBadge label="Downloaded" value={stats.byStatus.DOWNLOADED} color="text-blue-600" />
          <StatBadge label="Processing" value={stats.byStatus.PROCESSING} color="text-purple-600" />
          <StatBadge label="Completed" value={stats.byStatus.COMPLETED} color="text-green-600" />
          <StatBadge label="Failed" value={stats.byStatus.FAILED} color="text-red-600" />
          <StatBadge
            label="Total Tokens"
            value={stats.totalTokensUsed}
            color="text-gray-700"
            format
          />
        </div>
      )}

      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-3">
          {/* Status Filter */}
          <Select
            value={
              Array.isArray(filters.status)
                ? 'all'
                : filters.status || 'all'
            }
            onValueChange={handleStatusChange}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="DOWNLOADED">Downloaded</SelectItem>
              <SelectItem value="PROCESSING">Processing</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Filters */}
          <Input
            type="date"
            placeholder="From"
            value={filters.dateFrom || ''}
            onChange={handleDateFromChange}
            className="w-[150px]"
          />
          <Input
            type="date"
            placeholder="To"
            value={filters.dateTo || ''}
            onChange={handleDateToChange}
            className="w-[150px]"
          />
        </div>

        <div className="flex gap-2">
          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCsv()}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export Pending
          </Button>

          {/* Import Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Import Results
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Refresh Button */}
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Import Feedback */}
      {importSuccess && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{importSuccess}</AlertDescription>
        </Alert>
      )}
      {importError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{importError}</AlertDescription>
        </Alert>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button variant="outline" size="sm" className="ml-4" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Scan ID</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Processed</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <span className="text-sm text-muted-foreground mt-2 block">
                    Loading AI scans...
                  </span>
                </TableCell>
              </TableRow>
            ) : scans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No AI scans found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              scans.map((scan) => {
                const statusDisplay = getStatusDisplay(scan.aiStatus);
                return (
                  <TableRow key={scan.id}>
                    <TableCell className="font-mono text-xs">
                      {scan.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <a
                        href={scan.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                        title={scan.url}
                      >
                        {truncateUrl(scan.url)}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm">
                      {scan.email || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusDisplay.variant}
                        className="flex items-center gap-1 w-fit"
                      >
                        {statusDisplay.icon}
                        {statusDisplay.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatNumber(scan.aiTotalTokens)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(scan.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(scan.aiProcessedAt)}
                    </TableCell>
                    <TableCell>
                      {scan.aiStatus === 'FAILED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => retryFailedScan(scan.id)}
                          disabled={isRetrying}
                        >
                          {isRetrying ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1} -{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 py-1 text-sm">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={pagination.page >= pagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Stat Badge Component
 */
function StatBadge({
  label,
  value,
  color,
  format = false,
}: {
  label: string;
  value: number;
  color: string;
  format?: boolean;
}) {
  return (
    <div className="text-center">
      <p className={`text-xl font-bold ${color}`}>
        {format ? formatNumber(value) : value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
