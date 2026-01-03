'use client';

import { useRef, useLayoutEffect } from 'react';
import { IssueCard } from './IssueCard';
import { IssueListControls } from './IssueListControls';
import { IssueCardSkeleton } from '@/components/ui/skeleton';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { useIssueFilterStore } from '@/stores/issue-filter-store';
import type { AiIssueData } from '../ai/AiIssueEnhancement';

export interface Issue {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary: string;
  }>;
  // AI Enhancement Fields (optional)
  aiExplanation?: string | null;
  aiFixSuggestion?: string | null;
  aiPriority?: number | null;
}

interface IssueListProps {
  issues: Issue[];
  /** Whether AI analysis is still loading */
  aiLoading?: boolean;
  /** Whether the issue list is loading */
  isLoading?: boolean;
}

export function IssueList({ issues, aiLoading = false, isLoading = false }: IssueListProps) {
  const { selectedSeverities, expandedIssueIds, toggleIssueExpanded } = useIssueFilterStore();

  // Refs for scroll position preservation
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const lastExpandedCountRef = useRef<number>(expandedIssueIds.size);

  // Filter issues based on selected severities
  const filteredIssues =
    selectedSeverities.length > 0
      ? issues.filter((issue) => selectedSeverities.includes(issue.impact))
      : issues;

  // Restore scroll position after expand/collapse using useLayoutEffect for synchronous updates
  useLayoutEffect(() => {
    // Only restore scroll if expansion state changed
    if (lastExpandedCountRef.current !== expandedIssueIds.size) {
      const container = containerRef.current?.closest('[data-scroll-container]')
        || containerRef.current?.parentElement
        || window;

      if (container && scrollPositionRef.current > 0) {
        // Restore scroll position
        if (container === window) {
          window.scrollTo({ top: scrollPositionRef.current });
        } else if (container instanceof HTMLElement) {
          container.scrollTop = scrollPositionRef.current;
        }
      }

      // Update the last expanded count
      lastExpandedCountRef.current = expandedIssueIds.size;
    }
  }, [expandedIssueIds]);

  // Handle issue toggle with scroll position preservation
  const handleToggleExpand = (issueId: string) => {
    // Store scroll position before expand
    const container = containerRef.current?.closest('[data-scroll-container]')
      || containerRef.current?.parentElement
      || window;

    if (container === window) {
      scrollPositionRef.current = window.scrollY;
    } else if (container instanceof HTMLElement) {
      scrollPositionRef.current = container.scrollTop;
    }

    // Toggle the expansion
    toggleIssueExpanded(issueId);
  };

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <IssueCardSkeleton />
        <IssueCardSkeleton />
        <IssueCardSkeleton />
      </div>
    );
  }

  // Helper function to render a single issue card
  const renderIssueCard = (issue: Issue) => {
    // Map issue AI data if available
    const aiData: AiIssueData | null =
      issue.aiExplanation && issue.aiFixSuggestion && issue.aiPriority
        ? {
            issueId: issue.id,
            explanation: issue.aiExplanation,
            fixSuggestion: issue.aiFixSuggestion,
            priority: issue.aiPriority,
          }
        : null;

    return (
      <IssueCard
        key={issue.id}
        issue={issue}
        aiData={aiData}
        aiLoading={aiLoading}
        expanded={expandedIssueIds.has(issue.id)}
        onToggleExpand={() => handleToggleExpand(issue.id)}
      />
    );
  };

  // Determine if virtualization should be used
  const useVirtualization = filteredIssues.length > 50;

  // Calculate item height for virtualization
  // Collapsed cards: ~100-120px
  // Expanded cards: highly variable (200-800px+)
  // Using an average estimate of 150px provides reasonable performance
  const estimatedItemHeight = 150;

  // Calculate virtualized list height (max 600px, or based on visible items)
  const virtualizedHeight = Math.min(600, filteredIssues.length * estimatedItemHeight);

  return (
    <div ref={containerRef}>
      {/* Issue List Controls - Expand/Collapse buttons and severity filters */}
      <IssueListControls issues={issues} />

      {/* Issue cards */}
      <div className="mt-6">
        {filteredIssues.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No issues found in this category.
          </p>
        ) : useVirtualization ? (
          /* Use virtualized list for large datasets (>50 issues) */
          <VirtualizedList
            itemCount={filteredIssues.length}
            itemSize={estimatedItemHeight}
            height={virtualizedHeight}
            itemData={filteredIssues}
            aria-label="Accessibility issues list"
            renderItem={({ index, style, data }) => {
              const issue = data?.[index];
              if (!issue) return null;

              return (
                <div style={style} className="pb-4">
                  {renderIssueCard(issue)}
                </div>
              );
            }}
          />
        ) : (
          /* Use standard list for smaller datasets (≤50 issues) */
          <div className="space-y-4">
            {filteredIssues.map((issue) => renderIssueCard(issue))}
          </div>
        )}
      </div>
    </div>
  );
}
