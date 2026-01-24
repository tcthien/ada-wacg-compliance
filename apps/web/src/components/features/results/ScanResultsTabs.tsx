'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IssueList, type Issue } from './IssueList';
import { CriteriaTable, CriteriaTableAdmin, type CriteriaVerification } from '@/components/features/compliance';
import { Badge } from '@/components/ui/badge';
import { ListChecks, TableProperties } from 'lucide-react';
import type { IssuesByImpact, EnhancedCoverageResponse } from '@/lib/api';
// Use local wcag constants to avoid Node.js crypto dependency
import type { WCAGLevel } from '@/lib/wcag-constants';

/**
 * Tab identifiers
 */
export type ScanResultsTab = 'issues' | 'coverage';

/**
 * Props for ScanResultsTabs component
 */
export interface ScanResultsTabsProps {
  /** Issues grouped by severity */
  issuesByImpact: IssuesByImpact;
  /** Enhanced coverage data with criteria verifications */
  enhancedCoverage?: EnhancedCoverageResponse;
  /** WCAG conformance level */
  wcagLevel: WCAGLevel;
  /** Whether AI enhancement is loading */
  aiLoading?: boolean;
  /** Whether this is an admin view */
  isAdmin?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Flatten issuesByImpact into a single array for the IssueList component
 * Converts API issue format to component-expected format with AI data
 */
function flattenIssues(issuesByImpact: IssuesByImpact): Issue[] {
  const allIssues: Issue[] = [];

  const impactLevels: (keyof IssuesByImpact)[] = ['critical', 'serious', 'moderate', 'minor'];

  for (const level of impactLevels) {
    const issues = issuesByImpact[level] || [];
    for (const issue of issues) {
      allIssues.push({
        id: issue.id,
        impact: level,
        description: issue.description,
        help: issue.helpText,
        helpUrl: issue.helpUrl,
        tags: issue.wcagCriteria,
        nodes: issue.nodes,
        aiExplanation: issue.aiExplanation ?? null,
        aiFixSuggestion: issue.aiFixSuggestion ?? null,
        aiPriority: issue.aiPriority ?? null,
      });
    }
  }

  return allIssues;
}

/**
 * Filter issues by WCAG criterion ID
 * Returns issues that include the specified criterion in their wcagCriteria array
 */
function filterIssuesByCriterion(
  issuesByImpact: IssuesByImpact,
  criterionId: string
): IssuesByImpact {
  const filtered: IssuesByImpact = {
    critical: [],
    serious: [],
    moderate: [],
    minor: [],
  };

  const impactLevels: (keyof IssuesByImpact)[] = ['critical', 'serious', 'moderate', 'minor'];

  for (const level of impactLevels) {
    const issues = issuesByImpact[level] || [];
    filtered[level] = issues.filter((issue) =>
      issue.wcagCriteria.includes(criterionId)
    );
  }

  return filtered;
}

/**
 * ScanResultsTabs component provides a tabbed interface for scan results
 * - Issues tab: Shows all accessibility issues
 * - Coverage tab: Shows WCAG criteria coverage table
 *
 * Supports URL state persistence for tab selection and criterion filtering
 */
export function ScanResultsTabs({
  issuesByImpact,
  enhancedCoverage,
  wcagLevel,
  aiLoading = false,
  isAdmin = false,
  className,
}: ScanResultsTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get current tab from URL or default to 'issues'
  const currentTab = (searchParams.get('tab') as ScanResultsTab) || 'issues';

  // Get criterion filter from URL (for linking from coverage table to issues)
  const criterionFilter = searchParams.get('criterion') || null;

  // Ref to track if we should scroll to issues section
  const issuesSectionRef = useRef<HTMLDivElement>(null);

  // Flatten issues for the IssueList component
  const flattenedIssues = useMemo(
    () => flattenIssues(issuesByImpact),
    [issuesByImpact]
  );

  // Filter issues if criterion filter is active
  const displayIssues = useMemo(() => {
    if (!criterionFilter) {
      return flattenedIssues;
    }
    const filtered = filterIssuesByCriterion(issuesByImpact, criterionFilter);
    return flattenIssues(filtered);
  }, [flattenedIssues, issuesByImpact, criterionFilter]);

  // Convert enhanced coverage verifications to CriteriaTable format
  const criteriaVerifications: CriteriaVerification[] = useMemo(() => {
    if (!enhancedCoverage?.criteriaVerifications) {
      return [];
    }
    return enhancedCoverage.criteriaVerifications;
  }, [enhancedCoverage]);

  // Count total issues
  const totalIssues = useMemo(() => {
    return (
      (issuesByImpact.critical?.length || 0) +
      (issuesByImpact.serious?.length || 0) +
      (issuesByImpact.moderate?.length || 0) +
      (issuesByImpact.minor?.length || 0)
    );
  }, [issuesByImpact]);

  // Update URL when tab changes
  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', value);
      // Clear criterion filter when switching tabs
      params.delete('criterion');
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Handle criterion click from coverage table
  const handleCriterionClick = useCallback(
    (criterionId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'issues');
      params.set('criterion', criterionId);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Clear criterion filter
  const clearCriterionFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('criterion');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  // Scroll to issues section when criterion filter changes
  useEffect(() => {
    if (criterionFilter && issuesSectionRef.current) {
      issuesSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [criterionFilter]);

  return (
    <Tabs
      value={currentTab}
      onValueChange={handleTabChange}
      className={className}
    >
      <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-grid">
        <TabsTrigger value="issues" className="flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          <span>Issues</span>
          <Badge variant="secondary" className="ml-1">
            {totalIssues}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="coverage" className="flex items-center gap-2">
          <TableProperties className="h-4 w-4" />
          <span>Criteria Coverage</span>
          {enhancedCoverage && (
            <Badge variant="secondary" className="ml-1">
              {enhancedCoverage.criteriaChecked}/{enhancedCoverage.criteriaTotal}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      {/* Issues Tab Content */}
      <TabsContent value="issues" className="mt-6" ref={issuesSectionRef}>
        {/* Criterion Filter Banner */}
        {criterionFilter && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
            <span className="text-sm text-blue-800 dark:text-blue-200">
              Showing issues for criterion{' '}
              <strong className="font-mono">{criterionFilter}</strong>
              {displayIssues.length === 0 && ' (no issues found)'}
            </span>
            <button
              onClick={clearCriterionFilter}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Show all issues
            </button>
          </div>
        )}

        {displayIssues.length > 0 ? (
          <IssueList issues={displayIssues} aiLoading={aiLoading} />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border p-8 text-center">
            {criterionFilter ? (
              <>
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-2">
                  No Issues for Criterion {criterionFilter}
                </h3>
                <p className="text-muted-foreground">
                  No issues were found that relate to this criterion.
                </p>
                <button
                  onClick={clearCriterionFilter}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View All Issues
                </button>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-semibold mb-2">No Issues Detected</h3>
                <p className="text-muted-foreground">
                  Great job! No automated accessibility issues were found on this page.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Remember: Manual testing is still recommended for complete compliance
                  verification.
                </p>
              </>
            )}
          </div>
        )}
      </TabsContent>

      {/* Coverage Tab Content */}
      <TabsContent value="coverage" className="mt-6">
        {criteriaVerifications.length > 0 ? (
          isAdmin ? (
            <CriteriaTableAdmin
              verifications={criteriaVerifications}
              wcagLevel={wcagLevel}
              {...(enhancedCoverage?.aiModel ? { aiModel: enhancedCoverage.aiModel } : {})}
              onCriterionClick={handleCriterionClick}
            />
          ) : (
            <CriteriaTable
              verifications={criteriaVerifications}
              wcagLevel={wcagLevel}
              {...(enhancedCoverage?.aiModel ? { aiModel: enhancedCoverage.aiModel } : {})}
              onCriterionClick={handleCriterionClick}
              isAdmin={false}
            />
          )
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border p-8 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">
              Coverage Data Not Available
            </h3>
            <p className="text-muted-foreground">
              Detailed criteria coverage data is not available for this scan.
            </p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
