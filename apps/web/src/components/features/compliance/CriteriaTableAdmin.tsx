'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CriteriaTable,
  type CriteriaTableProps,
  type CriteriaVerification,
} from './CriteriaTable';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Brain } from 'lucide-react';

/**
 * Props for CriteriaTableAdmin component
 */
export interface CriteriaTableAdminProps extends CriteriaTableProps {
  /** Whether to show an expanded view with reasoning panels */
  showExpandedDetails?: boolean;
}

/**
 * Get confidence color based on score
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'bg-green-500';
  if (confidence >= 60) return 'bg-yellow-500';
  if (confidence >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

/**
 * Get confidence label based on score
 */
function getConfidenceLabel(confidence: number): string {
  if (confidence >= 80) return 'High';
  if (confidence >= 60) return 'Medium';
  if (confidence >= 40) return 'Low';
  return 'Very Low';
}

/**
 * Admin-specific panel showing AI verification details
 */
interface AiVerificationPanelProps {
  verifications: CriteriaVerification[];
  className?: string;
}

function AiVerificationPanel({ verifications, className }: AiVerificationPanelProps) {
  // Filter to only AI-verified criteria
  const aiVerifications = verifications.filter(
    (v) =>
      (v.status === 'AI_VERIFIED_PASS' || v.status === 'AI_VERIFIED_FAIL') &&
      (v.confidence !== undefined || v.reasoning)
  );

  if (aiVerifications.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">AI Verification Details</h3>
        <Badge variant="secondary" className="ml-auto">
          {aiVerifications.length} AI-verified criteria
        </Badge>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {aiVerifications.map((verification) => (
          <AccordionItem
            key={verification.criterionId}
            value={verification.criterionId}
            className="rounded-lg border bg-white px-4"
          >
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left">
                <span className="font-mono text-sm font-medium text-gray-700">
                  {verification.criterionId}
                </span>
                <Badge
                  className={cn(
                    'text-xs',
                    verification.status === 'AI_VERIFIED_PASS'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-orange-100 text-orange-800'
                  )}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {verification.status === 'AI_VERIFIED_PASS' ? 'AI Pass' : 'AI Fail'}
                </Badge>
                {verification.confidence !== undefined && (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          getConfidenceColor(verification.confidence)
                        )}
                        style={{ width: `${verification.confidence}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {verification.confidence}% ({getConfidenceLabel(verification.confidence)})
                    </span>
                  </div>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pb-2">
                {verification.reasoning ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">
                      AI Reasoning
                    </label>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md whitespace-pre-wrap">
                      {verification.reasoning}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    No reasoning provided for this verification.
                  </p>
                )}
                {verification.issueIds && verification.issueIds.length > 0 && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-500 mb-2">
                      Related Issues
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {verification.issueIds.map((id) => (
                        <Badge key={id} variant="outline" className="text-xs font-mono">
                          {id.substring(0, 8)}...
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

/**
 * CriteriaTableAdmin component
 *
 * Extends CriteriaTable with admin-specific features:
 * - Always shows confidence score column with progress bar visualization
 * - Shows expandable reasoning text for AI verifications
 * - Provides a dedicated AI verification panel for detailed review
 * - Maintains all existing CriteriaTable functionality (sorting, filtering, click-through)
 *
 * @example
 * ```tsx
 * <CriteriaTableAdmin
 *   verifications={verifications}
 *   wcagLevel="AA"
 *   aiModel="claude-opus-4"
 *   onCriterionClick={(id) => console.log(`Clicked: ${id}`)}
 *   showExpandedDetails
 * />
 * ```
 */
export function CriteriaTableAdmin({
  verifications,
  wcagLevel,
  aiModel,
  onCriterionClick,
  isLoading,
  className,
  showExpandedDetails = false,
}: CriteriaTableAdminProps) {
  const [showAiPanel, setShowAiPanel] = useState(showExpandedDetails);

  // Count AI-verified criteria
  const aiVerifiedCount = verifications.filter(
    (v) => v.status === 'AI_VERIFIED_PASS' || v.status === 'AI_VERIFIED_FAIL'
  ).length;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Admin controls header */}
      {aiVerifiedCount > 0 && (
        <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium text-purple-800">
              {aiVerifiedCount} criteria verified by AI
            </span>
            {aiModel && (
              <Badge variant="secondary" className="text-xs">
                Model: {aiModel}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAiPanel(!showAiPanel)}
            className="text-purple-700 border-purple-300 hover:bg-purple-100"
          >
            <Brain className="h-4 w-4 mr-2" />
            {showAiPanel ? 'Hide' : 'Show'} AI Details
          </Button>
        </div>
      )}

      {/* AI Verification Panel (admin-only expanded view) */}
      {showAiPanel && (
        <AiVerificationPanel
          verifications={verifications}
          className="bg-gray-50 rounded-lg p-4 border"
        />
      )}

      {/* Standard CriteriaTable with isAdmin=true */}
      <CriteriaTable
        verifications={verifications}
        wcagLevel={wcagLevel}
        {...(aiModel ? { aiModel } : {})}
        {...(onCriterionClick ? { onCriterionClick } : {})}
        isAdmin={true}
        {...(isLoading !== undefined ? { isLoading } : {})}
      />
    </div>
  );
}
