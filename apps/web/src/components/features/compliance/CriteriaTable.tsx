'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle,
  XCircle,
  MinusCircle,
  Sparkles,
  AlertCircle,
  ArrowUpDown,
  Info,
} from 'lucide-react';
// Import WCAG criteria from a local copy to avoid Node.js crypto dependency
// The core package's constants barrel export includes gdpr.constants which uses node:crypto
import { WCAG_CRITERIA, type WCAGLevel } from '@/lib/wcag-constants';
import { CriteriaDetailDialog } from './CriteriaDetailDialog';

/**
 * Criteria verification status type
 */
export type CriteriaStatus =
  | 'PASS'
  | 'FAIL'
  | 'AI_VERIFIED_PASS'
  | 'AI_VERIFIED_FAIL'
  | 'NOT_TESTED';

/**
 * Scanner source type
 */
export type ScannerSource = 'axe-core' | 'axe-core + AI' | 'N/A' | string;

/**
 * Criteria verification data
 */
export interface CriteriaVerification {
  criterionId: string;
  status: CriteriaStatus;
  scanner: ScannerSource;
  issueIds?: string[];
  confidence?: number;
  reasoning?: string;
}

/**
 * Enriched verification with WCAG criterion details
 */
interface EnrichedVerification extends CriteriaVerification {
  title: string;
  description: string;
  level: WCAGLevel;
}

/**
 * Sort column options
 */
type SortColumn = 'id' | 'status' | 'name';
type SortOrder = 'asc' | 'desc';

/**
 * Filter options
 */
type StatusFilter = CriteriaStatus | 'all';
type LevelFilter = WCAGLevel | 'all';

/**
 * Props for CriteriaTable component
 */
export interface CriteriaTableProps {
  /** Array of criteria verifications */
  verifications: CriteriaVerification[];
  /** WCAG conformance level */
  wcagLevel: WCAGLevel;
  /** AI model name if AI-enhanced */
  aiModel?: string;
  /** Callback when a failed criterion is clicked */
  onCriterionClick?: (criterionId: string) => void;
  /** Whether this is an admin view (shows confidence/reasoning) */
  isAdmin?: boolean;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Status sort order: Fail first, then Not Tested, then Pass
 */
const STATUS_SORT_ORDER: Record<CriteriaStatus, number> = {
  FAIL: 0,
  AI_VERIFIED_FAIL: 1,
  NOT_TESTED: 2,
  AI_VERIFIED_PASS: 3,
  PASS: 4,
};

/**
 * Get status badge configuration
 */
function getStatusBadge(status: CriteriaStatus, issueCount?: number) {
  switch (status) {
    case 'PASS':
      return {
        icon: <CheckCircle className="h-4 w-4" />,
        label: 'Pass',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200',
      };
    case 'FAIL':
      return {
        icon: <XCircle className="h-4 w-4" />,
        label: issueCount ? `Fail (${issueCount})` : 'Fail',
        className: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200',
      };
    case 'AI_VERIFIED_PASS':
      return {
        icon: <Sparkles className="h-4 w-4" />,
        label: 'AI Pass',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
      };
    case 'AI_VERIFIED_FAIL':
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        label: issueCount ? `AI Fail (${issueCount})` : 'AI Fail',
        className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200',
      };
    case 'NOT_TESTED':
      return {
        icon: <MinusCircle className="h-4 w-4" />,
        label: 'Not Tested',
        className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
      };
  }
}

/**
 * Get scanner display name
 */
function getScannerDisplay(scanner: ScannerSource, aiModel?: string): string {
  if (scanner === 'axe-core') return 'axe-core';
  if (scanner === 'axe-core + AI') return aiModel ? `axe-core + ${aiModel}` : 'axe-core + AI';
  if (scanner === 'N/A') return 'N/A';
  return aiModel || scanner;
}

/**
 * Sort criteria by ID numerically (1.1.1 < 1.2.1 < 2.1.1)
 */
function sortById(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const diff = (aParts[i] || 0) - (bParts[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * CriteriaTable component displays all WCAG criteria with verification status
 */
/**
 * Loading skeleton for table rows
 */
function TableRowSkeleton({ columns }: { columns: number }) {
  return (
    <TableRow>
      {Array.from({ length: columns }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </TableCell>
      ))}
    </TableRow>
  );
}

export function CriteriaTable({
  verifications,
  wcagLevel,
  aiModel,
  onCriterionClick,
  isAdmin = false,
  isLoading = false,
  className,
}: CriteriaTableProps) {
  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>('status');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Filtering state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');

  // Dialog state for selected criterion
  const [selectedCriterion, setSelectedCriterion] = useState<EnrichedVerification | null>(null);

  // Process and enrich verifications with WCAG data
  const enrichedVerifications = useMemo(() => {
    return verifications.map((v) => {
      const criterion = WCAG_CRITERIA[v.criterionId];
      return {
        ...v,
        title: criterion?.title || 'Unknown Criterion',
        description: criterion?.description || '',
        level: criterion?.level || 'A',
      };
    });
  }, [verifications]);

  // Filter verifications
  const filteredVerifications = useMemo(() => {
    return enrichedVerifications.filter((v) => {
      // Status filter
      if (statusFilter !== 'all' && v.status !== statusFilter) {
        return false;
      }

      // Level filter
      if (levelFilter !== 'all' && v.level !== levelFilter) {
        return false;
      }

      return true;
    });
  }, [enrichedVerifications, statusFilter, levelFilter]);

  // Sort verifications
  const sortedVerifications = useMemo(() => {
    const sorted = [...filteredVerifications];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'id':
          comparison = sortById(a.criterionId, b.criterionId);
          break;
        case 'status':
          comparison = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
          break;
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredVerifications, sortColumn, sortOrder]);

  // Toggle sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('asc');
    }
  };

  // Handle row click - opens dialog for any row
  const handleRowClick = (verification: EnrichedVerification) => {
    setSelectedCriterion(verification);
  };

  // Handle "View Issues" from dialog - closes dialog then navigates
  const handleViewIssues = (criterionId: string) => {
    setSelectedCriterion(null); // Close dialog first
    onCriterionClick?.(criterionId); // Then navigate
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PASS">Pass</SelectItem>
              <SelectItem value="FAIL">Fail</SelectItem>
              <SelectItem value="AI_VERIFIED_PASS">AI Pass</SelectItem>
              <SelectItem value="AI_VERIFIED_FAIL">AI Fail</SelectItem>
              <SelectItem value="NOT_TESTED">Not Tested</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Level:</span>
          <Select
            value={levelFilter}
            onValueChange={(value) => setLevelFilter(value as LevelFilter)}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="A">Level A</SelectItem>
              <SelectItem value="AA">Level AA</SelectItem>
              {wcagLevel === 'AAA' && <SelectItem value="AAA">Level AAA</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        <span className="ml-auto text-sm text-muted-foreground">
          Showing {sortedVerifications.length} of {verifications.length} criteria
        </span>
      </div>

      {/* Table - horizontally scrollable on mobile */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="w-[80px] cursor-pointer select-none"
                onClick={() => handleSort('id')}
              >
                <div className="flex items-center gap-1">
                  ID
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Name
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead
                className="w-[130px] cursor-pointer select-none"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  Status
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="w-[120px]">Scanner</TableHead>
              {isAdmin && <TableHead className="w-[80px]">Confidence</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 10 }).map((_, i) => (
                <TableRowSkeleton key={i} columns={isAdmin ? 6 : 5} />
              ))
            ) : sortedVerifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="h-24 text-center">
                  No criteria match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              sortedVerifications.map((verification) => {
                const statusBadge = getStatusBadge(
                  verification.status,
                  verification.issueIds?.length
                );

                return (
                  <TableRow
                    key={verification.criterionId}
                    className="cursor-pointer hover:bg-muted/80"
                    onClick={() => handleRowClick(verification)}
                  >
                    <TableCell className="font-mono text-sm">
                      {verification.criterionId}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {verification.title}
                        <Badge variant="outline" className="text-xs">
                          {verification.level}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-md truncate">
                      {verification.description}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              className={cn(
                                'inline-flex items-center gap-1.5 cursor-default',
                                statusBadge.className
                              )}
                            >
                              {statusBadge.icon}
                              <span>{statusBadge.label}</span>
                            </Badge>
                          </TooltipTrigger>
                          {verification.status === 'NOT_TESTED' && (
                            <TooltipContent>
                              <p>This criterion cannot be tested by automated tools.</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Manual testing or AI analysis is required.
                              </p>
                            </TooltipContent>
                          )}
                          {(verification.status === 'FAIL' ||
                            verification.status === 'AI_VERIFIED_FAIL') && (
                            <TooltipContent>
                              <p>Click to view details and related issues</p>
                            </TooltipContent>
                          )}
                          {(verification.status === 'AI_VERIFIED_PASS' ||
                            verification.status === 'AI_VERIFIED_FAIL') &&
                            verification.reasoning && (
                              <TooltipContent className="max-w-sm">
                                <p className="font-medium">AI Analysis:</p>
                                <p className="text-sm mt-1">{verification.reasoning}</p>
                              </TooltipContent>
                            )}
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getScannerDisplay(verification.scanner, aiModel)}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        {verification.confidence !== undefined && (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  verification.confidence >= 80
                                    ? 'bg-green-500'
                                    : verification.confidence >= 50
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                )}
                                style={{ width: `${verification.confidence}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {verification.confidence}%
                            </span>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Criterion Detail Dialog */}
      <CriteriaDetailDialog
        open={selectedCriterion !== null}
        onClose={() => setSelectedCriterion(null)}
        criterion={selectedCriterion}
        aiModel={aiModel}
        onViewIssues={onCriterionClick ? handleViewIssues : undefined}
      />
    </div>
  );
}
