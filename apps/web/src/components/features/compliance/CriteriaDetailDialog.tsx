'use client';

import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  XCircle,
  MinusCircle,
  Sparkles,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { WCAG_CRITERIA, type WCAGLevel } from '@/lib/wcag-constants';
import type { CriteriaStatus, ScannerSource } from './CriteriaTable';

/**
 * Enriched verification data with WCAG criterion details
 */
export interface EnrichedVerification {
  criterionId: string;
  status: CriteriaStatus;
  scanner: ScannerSource;
  issueIds?: string[];
  confidence?: number;
  reasoning?: string;
  title?: string;
  description?: string;
  level?: WCAGLevel;
}

/**
 * Props for CriteriaDetailDialog component
 */
export interface CriteriaDetailDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** The criterion data to display */
  criterion: EnrichedVerification | null;
  /** AI model name if AI-enhanced */
  aiModel?: string;
  /** Callback when "View Issues" button is clicked */
  onViewIssues?: (criterionId: string) => void;
}

/**
 * Get status badge configuration
 * Reuses the same pattern from CriteriaTable for consistency
 */
function getStatusBadge(status: CriteriaStatus, issueCount?: number) {
  switch (status) {
    case 'PASS':
      return {
        icon: <CheckCircle className="h-4 w-4" />,
        label: 'Pass',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200',
        description: 'This criterion passed automated testing.',
      };
    case 'FAIL':
      return {
        icon: <XCircle className="h-4 w-4" />,
        label: issueCount ? `Fail (${issueCount} issues)` : 'Fail',
        className: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200',
        description: 'This criterion failed automated testing.',
      };
    case 'AI_VERIFIED_PASS':
      return {
        icon: <Sparkles className="h-4 w-4" />,
        label: 'AI Verified Pass',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
        description: 'AI analysis determined this criterion passes.',
      };
    case 'AI_VERIFIED_FAIL':
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        label: issueCount ? `AI Verified Fail (${issueCount} issues)` : 'AI Verified Fail',
        className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200',
        description: 'AI analysis determined this criterion fails.',
      };
    case 'NOT_TESTED':
      return {
        icon: <MinusCircle className="h-4 w-4" />,
        label: 'Not Tested',
        className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
        description: 'This criterion cannot be tested by automated tools and requires manual review.',
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
 * Get level badge variant
 */
function getLevelBadgeClass(level: WCAGLevel): string {
  switch (level) {
    case 'A':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200';
    case 'AA':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200';
    case 'AAA':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200';
    default:
      return '';
  }
}

/**
 * Get confidence bar color based on percentage
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'bg-green-500';
  if (confidence >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

/**
 * CriteriaDetailDialog component displays detailed information about a WCAG criterion
 */
export function CriteriaDetailDialog({
  open,
  onClose,
  criterion,
  aiModel,
  onViewIssues,
}: CriteriaDetailDialogProps) {
  // Return early if no criterion data
  if (!criterion) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criterion Details</DialogTitle>
            <DialogDescription>No criterion data available.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  // Get enriched data from WCAG_CRITERIA if not already present
  const wcagData = WCAG_CRITERIA[criterion.criterionId];
  const title = criterion.title || wcagData?.title || 'Unknown Criterion';
  const description = criterion.description || wcagData?.description || '';
  const level = criterion.level || wcagData?.level || 'A';

  const statusBadge = getStatusBadge(criterion.status, criterion.issueIds?.length);
  const isFailure = criterion.status === 'FAIL' || criterion.status === 'AI_VERIFIED_FAIL';
  const hasIssues = criterion.issueIds && criterion.issueIds.length > 0;
  const showViewIssuesButton = isFailure && hasIssues && onViewIssues;
  const isAiVerified = criterion.status === 'AI_VERIFIED_PASS' || criterion.status === 'AI_VERIFIED_FAIL';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          {/* Header: Criterion ID + Title + Level badge */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <span className="font-mono text-primary">{criterion.criterionId}</span>
                <Badge className={cn('text-xs', getLevelBadgeClass(level))}>
                  Level {level}
                </Badge>
              </DialogTitle>
              <DialogDescription className="mt-1 text-base font-medium text-foreground">
                {title}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Description section */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
            <p className="text-sm text-foreground">{description}</p>
          </div>

          {/* Status section */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Verification Status</h4>
            <div className="space-y-2">
              <Badge
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1',
                  statusBadge.className
                )}
              >
                {statusBadge.icon}
                <span>{statusBadge.label}</span>
              </Badge>
              <p className="text-sm text-muted-foreground">{statusBadge.description}</p>
            </div>
          </div>

          {/* Scanner info */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Scanner</h4>
            <p className="text-sm text-foreground">
              {getScannerDisplay(criterion.scanner, aiModel)}
            </p>
          </div>

          {/* AI confidence bar (if AI verified) */}
          {isAiVerified && criterion.confidence !== undefined && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">AI Confidence</h4>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      getConfidenceColor(criterion.confidence)
                    )}
                    style={{ width: `${criterion.confidence}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-foreground min-w-[3rem] text-right">
                  {criterion.confidence}%
                </span>
              </div>
            </div>
          )}

          {/* AI reasoning (if available) */}
          {isAiVerified && criterion.reasoning && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">AI Reasoning</h4>
              <div className="bg-muted/50 rounded-md p-3">
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {criterion.reasoning}
                </p>
              </div>
            </div>
          )}

          {/* View Issues button (if failed with issues) */}
          {showViewIssuesButton && (
            <div className="pt-2">
              <Button
                variant="default"
                className="w-full"
                onClick={() => onViewIssues(criterion.criterionId)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Related Issues ({criterion.issueIds?.length})
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
