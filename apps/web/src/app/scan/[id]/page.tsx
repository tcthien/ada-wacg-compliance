'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useScan } from '@/hooks/useScan';
import { useScanResult } from '@/hooks/useScanResult';
import { ScanProgress } from '@/components/features/scan/ScanProgress';
import { ResultsSummary } from '@/components/features/results/ResultsSummary';
import { IssueList, type Issue } from '@/components/features/results/IssueList';
import { ExportButton } from '@/components/features/export/ExportButton';
import { CoverageDisclaimer } from '@/components/features/compliance/CoverageDisclaimer';
import type { IssuesByImpact } from '@/lib/api';

/**
 * Flatten issuesByImpact into a single array for the IssueList component
 * Converts API issue format to component-expected format
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
      });
    }
  }

  return allIssues;
}

export default function ScanResultPage() {
  const params = useParams();
  const router = useRouter();
  const scanId = params['id'] as string;

  // Poll for scan status
  const { scan, loading: statusLoading, error: statusError } = useScan(scanId, {
    pollInterval: 2000,
  });

  // Fetch results only when scan is completed
  const {
    result,
    loading: resultLoading,
    error: resultError,
  } = useScanResult(scanId, {
    enabled: scan?.status === 'COMPLETED',
  });

  // Flatten issues from issuesByImpact for IssueList component
  // Must be called unconditionally (React hooks rule)
  const flattenedIssues = useMemo(
    () => (result?.issuesByImpact ? flattenIssues(result.issuesByImpact) : []),
    [result?.issuesByImpact]
  );

  // Loading state - initial fetch
  if (statusLoading && !scan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading scan...</p>
        </div>
      </div>
    );
  }

  // Error state - scan not found or fetch error
  if (statusError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold mb-2">Scan Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {statusError || 'Unable to load scan information.'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start New Scan
          </button>
        </div>
      </div>
    );
  }

  // No scan data
  if (!scan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold mb-2">Scan Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The requested scan does not exist or has been deleted.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start New Scan
          </button>
        </div>
      </div>
    );
  }

  // Failed scan state
  if (scan.status === 'FAILED') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">Scan Failed</h1>
          <p className="text-muted-foreground mb-6">
            {scan.errorMessage ||
              'An error occurred while scanning the page. Please try again.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Scanning in progress state
  if (scan.status === 'PENDING' || scan.status === 'RUNNING') {
    // Map status to user-friendly stages
    const stageMap: Record<string, { text: string; progress: number }> = {
      PENDING: { text: 'Waiting in queue...', progress: 10 },
      RUNNING: { text: 'Scanning page...', progress: scan.progress || 50 },
    };

    const currentStage = stageMap[scan.status] || {
      text: 'Processing...',
      progress: 50,
    };

    // Use the current stage text
    const stageText = currentStage.text;

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="animate-pulse text-6xl mb-4">🔍</div>
            <h1 className="text-2xl font-bold mb-2">Scanning in Progress</h1>
            <p className="text-muted-foreground text-sm">Scan ID: {scanId}</p>
          </div>

          <ScanProgress
            progress={currentStage.progress}
            stage={stageText}
          />

          <p className="text-center text-sm text-muted-foreground mt-6">
            This page will automatically update when the scan is complete.
          </p>
        </div>
      </div>
    );
  }

  // Completed scan - show results
  if (scan.status === 'COMPLETED') {
    // Loading results
    if (resultLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading results...</p>
          </div>
        </div>
      );
    }

    // Error loading results
    if (resultError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold mb-2">Error Loading Results</h1>
            <p className="text-muted-foreground mb-6">{resultError}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    // No results data
    if (!result) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="text-6xl mb-4">🔍</div>
            <h1 className="text-2xl font-bold mb-2">No Results Available</h1>
            <p className="text-muted-foreground mb-6">
              Results for this scan are not available.
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start New Scan
            </button>
          </div>
        </div>
      );
    }

    // Display full results
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">
                  Accessibility Scan Results
                </h1>
                <p className="text-muted-foreground">
                  <span className="font-medium">URL:</span>{' '}
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {result.url}
                  </a>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Scanned on {new Date(result.completedAt).toLocaleString()} |
                  WCAG {result.wcagLevel}
                </p>
              </div>
              <ExportButton scanId={scanId} />
            </div>

            {/* Coverage Disclaimer */}
            <CoverageDisclaimer />
          </div>

          {/* Results Summary */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Summary</h2>
            <ResultsSummary summary={result.summary} />
          </div>

          {/* Issue List */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">
              Issues Found ({result.summary.totalIssues})
            </h2>
            {flattenedIssues.length > 0 ? (
              <IssueList issues={flattenedIssues} />
            ) : (
              <div className="bg-white rounded-lg border p-8 text-center">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-semibold mb-2">
                  No Issues Detected
                </h3>
                <p className="text-muted-foreground">
                  Great job! No automated accessibility issues were found on
                  this page.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Remember: Manual testing is still recommended for complete
                  compliance verification.
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex justify-center gap-4 py-8 border-t">
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start New Scan
            </button>
            <button
              onClick={() => router.push('/history')}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              View History
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for unknown status
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="text-6xl mb-4">🤔</div>
        <h1 className="text-2xl font-bold mb-2">Unknown Status</h1>
        <p className="text-muted-foreground mb-6">
          The scan is in an unknown state. Please try refreshing the page.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
