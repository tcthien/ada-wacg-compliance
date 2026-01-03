'use client';

/**
 * AI Summary Section Component
 *
 * Displays AI-generated executive summary and remediation roadmap
 * Features:
 * - Collapsible sections using shadcn/ui Accordion
 * - Executive summary with key insights
 * - Remediation roadmap with prioritized action items
 * - AI attribution badge
 * - Loading and empty states
 */

import { cn } from '@/lib/utils';
import { Sparkles, FileText, ListChecks, AlertCircle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface AiSummarySectionProps {
  /** AI-generated executive summary */
  aiSummary?: string | null;
  /** AI-generated remediation roadmap */
  aiRemediationPlan?: string | null;
  /** Loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AI Attribution Badge
 * Displays badge indicating content is AI-generated
 */
function AiAttributionBadge() {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'bg-gradient-to-r from-purple-600 to-blue-600 text-white',
        'text-xs font-medium'
      )}
      role="status"
      aria-label="AI-generated content"
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      <span>AI-Powered</span>
    </div>
  );
}

/**
 * Empty State Component
 * Shown when no AI summary or plan is available
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
        <AlertCircle className="h-6 w-6 text-gray-400" aria-hidden="true" />
      </div>
      <p className="text-sm text-gray-600 mb-1">No AI analysis available</p>
      <p className="text-xs text-gray-500">
        AI analysis results will appear here once processing is complete
      </p>
    </div>
  );
}

/**
 * Loading State Component
 * Shown while AI content is loading
 */
function LoadingState() {
  return (
    <div className="space-y-4 py-4">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
        <div className="h-4 w-full bg-gray-200 rounded"></div>
        <div className="h-4 w-5/6 bg-gray-200 rounded"></div>
        <div className="h-4 w-2/3 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}

/**
 * Formats text content for display
 * Handles markdown-style formatting, bullet points, and line breaks
 */
function formatContent(content: string): JSX.Element {
  // Split into paragraphs
  const paragraphs = content.split('\n\n').filter(p => p.trim());

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, idx) => {
        const trimmed = paragraph.trim();

        // Check if it's a list (starts with -, *, or number)
        if (trimmed.match(/^[-*•]\s/) || trimmed.match(/^\d+\.\s/)) {
          const items = trimmed.split('\n').filter(line => line.trim());
          return (
            <ul key={idx} className="space-y-1.5 ml-4">
              {items.map((item, itemIdx) => {
                // Remove list markers (-, *, •, or numbers)
                const cleanItem = item.replace(/^[-*•]\s/, '').replace(/^\d+\.\s/, '');
                return (
                  <li key={itemIdx} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-purple-600 mt-0.5 flex-shrink-0">•</span>
                    <span>{cleanItem}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // Check if it's a heading (starts with #)
        if (trimmed.startsWith('#')) {
          const text = trimmed.replace(/^#+\s*/, '');
          return (
            <h4 key={idx} className="text-sm font-semibold text-gray-900 mt-4 first:mt-0">
              {text}
            </h4>
          );
        }

        // Regular paragraph
        return (
          <p key={idx} className="text-sm text-gray-700 leading-relaxed">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

export function AiSummarySection({
  aiSummary,
  aiRemediationPlan,
  isLoading = false,
  className,
}: AiSummarySectionProps) {
  // Show loading state
  if (isLoading) {
    return (
      <div className={cn('border rounded-lg p-6 bg-white', className)}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">AI Analysis</h3>
          <AiAttributionBadge />
        </div>
        <LoadingState />
      </div>
    );
  }

  // Show empty state if no content
  if (!aiSummary && !aiRemediationPlan) {
    return (
      <div className={cn('border rounded-lg p-6 bg-white', className)}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">AI Analysis</h3>
          <AiAttributionBadge />
        </div>
        <EmptyState />
      </div>
    );
  }

  // Determine default expanded items
  const defaultExpanded: string[] = [];
  if (aiSummary) defaultExpanded.push('summary');
  if (aiRemediationPlan && !aiSummary) defaultExpanded.push('roadmap');

  return (
    <div className={cn('border rounded-lg p-6 bg-white', className)}>
      {/* Header with AI badge */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">AI Analysis</h3>
        <AiAttributionBadge />
      </div>

      {/* Accordion sections */}
      <Accordion
        type="multiple"
        defaultValue={defaultExpanded}
        className="space-y-2"
      >
        {/* Executive Summary Section */}
        {aiSummary && (
          <AccordionItem
            value="summary"
            className={cn(
              'border rounded-lg px-4',
              'bg-gradient-to-r from-purple-50 to-blue-50',
              'border-purple-200'
            )}
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" aria-hidden="true" />
                <span className="font-semibold text-gray-900">Executive Summary</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-2">
              {formatContent(aiSummary)}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Remediation Roadmap Section */}
        {aiRemediationPlan && (
          <AccordionItem
            value="roadmap"
            className={cn(
              'border rounded-lg px-4',
              'bg-gradient-to-r from-blue-50 to-indigo-50',
              'border-blue-200'
            )}
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-blue-600" aria-hidden="true" />
                <span className="font-semibold text-gray-900">Remediation Roadmap</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-2">
              {formatContent(aiRemediationPlan)}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Footer attribution */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          AI-generated insights may require human verification. Use as a starting point for accessibility improvements.
        </p>
      </div>
    </div>
  );
}
