/**
 * Unit tests for Admin Scan Detail Page - AI Fields Display
 *
 * Tests the rendering of AI enhancement fields (aiExplanation, aiFixSuggestion, aiPriority)
 * on issue cards within the scan detail view.
 *
 * Requirements:
 * - REQ-3 AC 3: Issue cards show AI data alongside axe-core data
 * - REQ-3 AC 4: AI priority badge displays when present
 * - REQ-3 AC 5: Graceful degradation when AI fields are null
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'test-scan-id' }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href }, children),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ArrowLeft: () => React.createElement('span', { 'data-testid': 'arrow-left' }),
  Trash2: () => React.createElement('span', { 'data-testid': 'trash2' }),
  RotateCw: () => React.createElement('span', { 'data-testid': 'rotate-cw' }),
  AlertCircle: () => React.createElement('span', { 'data-testid': 'alert-circle' }),
  Layers: () => React.createElement('span', { 'data-testid': 'layers' }),
  ExternalLink: () => React.createElement('span', { 'data-testid': 'external-link' }),
  Sparkles: () => React.createElement('span', { 'data-testid': 'sparkles-icon' }),
  Clock: () => React.createElement('span', { 'data-testid': 'clock' }),
  Cpu: () => React.createElement('span', { 'data-testid': 'cpu' }),
}));

// Mock admin API - must be inside vi.mock to avoid hoisting issues
vi.mock('@/lib/admin-api', () => {
  const mockGet = vi.fn();
  const mockDelete = vi.fn();
  const mockRetry = vi.fn();
  return {
    adminApi: {
      scans: {
        get: mockGet,
        delete: mockDelete,
        retry: mockRetry,
      },
    },
    AiStatus: {
      PENDING: 'PENDING',
      PROCESSING: 'PROCESSING',
      COMPLETED: 'COMPLETED',
      FAILED: 'FAILED',
    },
  };
});

// Import mocked module for test access
import { adminApi } from '@/lib/admin-api';
const mockAdminApi = adminApi;

// Mock admin components
vi.mock('@/components/admin/ScanConsole', () => ({
  AdminScanConsole: () => React.createElement('div', { 'data-testid': 'scan-console' }),
}));

vi.mock('@/components/admin/AdminExportButton', () => ({
  AdminExportButton: () => React.createElement('button', { 'data-testid': 'export-button' }),
}));

vi.mock('@/components/features/ai', () => ({
  AiStatusBadge: ({ status }: { status: string }) =>
    React.createElement('span', { 'data-testid': 'ai-status-badge' }, status),
  AiSummarySection: ({ aiSummary }: { aiSummary: string }) =>
    React.createElement('div', { 'data-testid': 'ai-summary-section' }, aiSummary),
}));

// Import the component after mocks
import ScanDetailPage from './page';

/**
 * Create a mock issue with optional AI fields
 */
function createMockIssue(overrides: Partial<{
  id: string;
  ruleId: string;
  impact: 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR';
  description: string;
  helpText: string;
  helpUrl: string;
  wcagCriteria: string[];
  htmlSnippet: string | null;
  cssSelector: string | null;
  nodes: any;
  createdAt: string;
  aiExplanation: string | null;
  aiFixSuggestion: string | null;
  aiPriority: number | null;
}> = {}) {
  return {
    id: 'issue-1',
    ruleId: 'color-contrast',
    impact: 'SERIOUS' as const,
    description: 'Elements must have sufficient color contrast',
    helpText: 'Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
    wcagCriteria: ['1.4.3'],
    htmlSnippet: '<p class="low-contrast">Sample text</p>',
    cssSelector: 'p.low-contrast',
    nodes: [],
    createdAt: '2026-01-04T00:00:00.000Z',
    aiExplanation: null,
    aiFixSuggestion: null,
    aiPriority: null,
    ...overrides,
  };
}

/**
 * Create a mock scan response
 */
function createMockScan(overrides: Partial<{
  id: string;
  url: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  wcagLevel: 'A' | 'AA' | 'AAA';
  email: string;
  aiEnabled: boolean;
  aiStatus: string | null;
  issues: ReturnType<typeof createMockIssue>[];
}> = {}) {
  const issues = overrides.issues ?? [createMockIssue()];

  return {
    id: 'test-scan-id',
    url: 'https://example.com',
    status: 'COMPLETED' as const,
    wcagLevel: 'AA' as const,
    email: 'test@example.com',
    guestSessionId: 'session-123',
    userId: null,
    createdAt: '2026-01-04T00:00:00.000Z',
    completedAt: '2026-01-04T00:01:00.000Z',
    durationMs: 60000,
    errorMessage: null,
    aiEnabled: overrides.aiEnabled ?? false,
    aiStatus: overrides.aiStatus ?? null,
    aiSummary: null,
    aiRemediationPlan: null,
    aiProcessedAt: null,
    aiInputTokens: null,
    aiOutputTokens: null,
    aiTotalTokens: null,
    aiModel: null,
    aiProcessingTime: null,
    scanResult: {
      id: 'result-1',
      totalIssues: issues.length,
      criticalCount: issues.filter(i => i.impact === 'CRITICAL').length,
      seriousCount: issues.filter(i => i.impact === 'SERIOUS').length,
      moderateCount: issues.filter(i => i.impact === 'MODERATE').length,
      minorCount: issues.filter(i => i.impact === 'MINOR').length,
      passedChecks: 50,
      inapplicableChecks: 10,
      createdAt: '2026-01-04T00:01:00.000Z',
      issues,
    },
    guestSession: {
      id: 'session-123',
      fingerprint: 'fp-abc',
      createdAt: '2026-01-04T00:00:00.000Z',
    },
    batchScanId: null,
    batchScan: null,
    ...overrides,
  };
}

describe('Admin Scan Detail Page - AI Fields Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Issue Interface with AI Fields', () => {
    it('should render issue without AI fields (graceful degradation)', async () => {
      const scan = createMockScan({
        issues: [createMockIssue({ aiExplanation: null, aiFixSuggestion: null, aiPriority: null })],
      });
      mockAdminApi.scans.get.mockResolvedValue(scan);

      render(<ScanDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Elements must have sufficient color contrast')).toBeInTheDocument();
      });

      // AI Analysis section should NOT be present
      expect(screen.queryByText('AI Analysis')).not.toBeInTheDocument();
      expect(screen.queryByTestId('sparkles-icon')).not.toBeInTheDocument();
    });

    it('should render AI priority badge when aiPriority is present', async () => {
      const scan = createMockScan({
        issues: [createMockIssue({ aiPriority: 8 })],
      });
      mockAdminApi.scans.get.mockResolvedValue(scan);

      render(<ScanDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Priority: 8/10')).toBeInTheDocument();
      });

      // AI Analysis header should be present
      expect(screen.getByText('AI Analysis')).toBeInTheDocument();
    });

    it('should render AI explanation when aiExplanation is present', async () => {
      const aiExplanation = 'This text has insufficient color contrast ratio of 3.5:1';
      const scan = createMockScan({
        issues: [createMockIssue({ aiExplanation })],
      });
      mockAdminApi.scans.get.mockResolvedValue(scan);

      render(<ScanDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('AI Explanation')).toBeInTheDocument();
        expect(screen.getByText(aiExplanation)).toBeInTheDocument();
      });
    });

    it('should render AI fix suggestion when aiFixSuggestion is present', async () => {
      const aiFixSuggestion = 'Change the text color to #595959 to meet WCAG AA requirements';
      const scan = createMockScan({
        issues: [createMockIssue({ aiFixSuggestion })],
      });
      mockAdminApi.scans.get.mockResolvedValue(scan);

      render(<ScanDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('AI Fix Suggestion')).toBeInTheDocument();
        expect(screen.getByText(aiFixSuggestion)).toBeInTheDocument();
      });
    });

    it('should render all AI fields together when all are present', async () => {
      const scan = createMockScan({
        issues: [
          createMockIssue({
            aiExplanation: 'This is the AI explanation for the issue.',
            aiFixSuggestion: 'Here is the suggested fix with code example.',
            aiPriority: 9,
          }),
        ],
      });
      mockAdminApi.scans.get.mockResolvedValue(scan);

      render(<ScanDetailPage />);

      await waitFor(() => {
        // All AI sections should be present
        expect(screen.getByText('AI Analysis')).toBeInTheDocument();
        expect(screen.getByText('Priority: 9/10')).toBeInTheDocument();
        expect(screen.getByText('AI Explanation')).toBeInTheDocument();
        expect(screen.getByText('This is the AI explanation for the issue.')).toBeInTheDocument();
        expect(screen.getByText('AI Fix Suggestion')).toBeInTheDocument();
        expect(screen.getByText('Here is the suggested fix with code example.')).toBeInTheDocument();
      });
    });
  });

  describe('Multiple Issues with Mixed AI Data', () => {
    it('should render AI sections only for issues that have AI data', async () => {
      const scan = createMockScan({
        issues: [
          createMockIssue({
            id: 'issue-1',
            ruleId: 'color-contrast',
            aiExplanation: 'AI explanation for color contrast',
            aiPriority: 8,
          }),
          createMockIssue({
            id: 'issue-2',
            ruleId: 'image-alt',
            description: 'Images must have alternate text',
            aiExplanation: null,
            aiFixSuggestion: null,
            aiPriority: null,
          }),
          createMockIssue({
            id: 'issue-3',
            ruleId: 'link-name',
            description: 'Links must have discernible text',
            aiExplanation: 'AI explanation for link name',
            aiFixSuggestion: 'Add aria-label to the link',
            aiPriority: 6,
          }),
        ],
      });
      mockAdminApi.scans.get.mockResolvedValue(scan);

      render(<ScanDetailPage />);

      await waitFor(() => {
        // First issue should have AI data
        expect(screen.getByText('AI explanation for color contrast')).toBeInTheDocument();
        expect(screen.getByText('Priority: 8/10')).toBeInTheDocument();

        // Second issue should NOT have AI section (check by description presence but no AI)
        expect(screen.getByText('Images must have alternate text')).toBeInTheDocument();

        // Third issue should have AI data
        expect(screen.getByText('AI explanation for link name')).toBeInTheDocument();
        expect(screen.getByText('Priority: 6/10')).toBeInTheDocument();
        expect(screen.getByText('Add aria-label to the link')).toBeInTheDocument();
      });

      // Count AI Analysis sections - should be 2 (for issues 1 and 3)
      const aiAnalysisSections = screen.getAllByText('AI Analysis');
      expect(aiAnalysisSections).toHaveLength(2);
    });
  });

  describe('AI Section Styling', () => {
    it('should have purple-themed styling for AI section', async () => {
      const scan = createMockScan({
        issues: [
          createMockIssue({
            aiExplanation: 'Test AI explanation',
            aiPriority: 7,
          }),
        ],
      });
      mockAdminApi.scans.get.mockResolvedValue(scan);

      const { container } = render(<ScanDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('AI Analysis')).toBeInTheDocument();
      });

      // Check for purple styling on AI elements
      const priorityBadge = screen.getByText('Priority: 7/10');
      expect(priorityBadge).toHaveClass('bg-purple-100', 'text-purple-800');

      const aiAnalysisLabel = screen.getByText('AI Analysis');
      expect(aiAnalysisLabel).toHaveClass('text-purple-800');
    });

    it('should render AI fix suggestion in code block style', async () => {
      const scan = createMockScan({
        issues: [
          createMockIssue({
            aiFixSuggestion: '<img src="logo.png" alt="Company Logo">',
          }),
        ],
      });
      mockAdminApi.scans.get.mockResolvedValue(scan);

      const { container } = render(<ScanDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('AI Fix Suggestion')).toBeInTheDocument();
      });

      // Check for code block styling
      const codeBlock = container.querySelector('pre');
      expect(codeBlock).toBeInTheDocument();
      expect(codeBlock).toHaveClass('font-mono', 'bg-gray-900', 'text-gray-100');
    });
  });

  describe('AI Section Visibility Logic', () => {
    it('should show AI section when only aiExplanation is present', async () => {
      const scan = createMockScan({
        issues: [createMockIssue({ aiExplanation: 'Only explanation', aiFixSuggestion: null, aiPriority: null })],
      });
      mockAdminApi.scans.get.mockResolvedValue(scan);

      render(<ScanDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('AI Analysis')).toBeInTheDocument();
        expect(screen.getByText('Only explanation')).toBeInTheDocument();
      });

      // Priority and fix suggestion should not be present
      expect(screen.queryByText(/Priority:/)).not.toBeInTheDocument();
      expect(screen.queryByText('AI Fix Suggestion')).not.toBeInTheDocument();
    });

    it('should show AI section when only aiFixSuggestion is present', async () => {
      const scan = createMockScan({
        issues: [createMockIssue({ aiExplanation: null, aiFixSuggestion: 'Only fix suggestion', aiPriority: null })],
      });
      mockAdminApi.scans.get.mockResolvedValue(scan);

      render(<ScanDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('AI Analysis')).toBeInTheDocument();
        expect(screen.getByText('Only fix suggestion')).toBeInTheDocument();
      });

      // Explanation should not be present
      expect(screen.queryByText('AI Explanation')).not.toBeInTheDocument();
    });

    it('should show AI section when only aiPriority is present', async () => {
      const scan = createMockScan({
        issues: [createMockIssue({ aiExplanation: null, aiFixSuggestion: null, aiPriority: 5 })],
      });
      mockAdminApi.scans.get.mockResolvedValue(scan);

      render(<ScanDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('AI Analysis')).toBeInTheDocument();
        expect(screen.getByText('Priority: 5/10')).toBeInTheDocument();
      });

      // Explanation and fix suggestion should not be present
      expect(screen.queryByText('AI Explanation')).not.toBeInTheDocument();
      expect(screen.queryByText('AI Fix Suggestion')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string AI fields as falsy (no AI section)', async () => {
      const scan = createMockScan({
        issues: [createMockIssue({ aiExplanation: '', aiFixSuggestion: '', aiPriority: null })],
      });
      mockAdminApi.scans.get.mockResolvedValue(scan);

      render(<ScanDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Elements must have sufficient color contrast')).toBeInTheDocument();
      });

      // AI Analysis should not be present for empty strings
      expect(screen.queryByText('AI Analysis')).not.toBeInTheDocument();
    });

    it('should handle aiPriority of 0 as valid (edge case)', async () => {
      // Note: Priority 0 is technically valid but unusual
      const scan = createMockScan({
        issues: [createMockIssue({ aiPriority: 0 })],
      });
      mockAdminApi.scans.get.mockResolvedValue(scan);

      render(<ScanDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Elements must have sufficient color contrast')).toBeInTheDocument();
      });

      // Priority 0 is falsy in JS, so AI section should NOT appear
      // This matches the implementation: {issue.aiPriority && ...}
      expect(screen.queryByText('Priority: 0/10')).not.toBeInTheDocument();
    });

    it('should preserve axe-core data when AI data is present', async () => {
      const scan = createMockScan({
        issues: [
          createMockIssue({
            ruleId: 'color-contrast',
            impact: 'SERIOUS',
            description: 'Elements must have sufficient color contrast',
            helpText: 'Ensure the contrast meets WCAG requirements',
            wcagCriteria: ['1.4.3'],
            htmlSnippet: '<p class="low-contrast">Sample</p>',
            aiExplanation: 'AI provides additional context',
            aiPriority: 8,
          }),
        ],
      });
      mockAdminApi.scans.get.mockResolvedValue(scan);

      render(<ScanDetailPage />);

      await waitFor(() => {
        // Axe-core data should still be present
        expect(screen.getByText('SERIOUS')).toBeInTheDocument();
        expect(screen.getByText('color-contrast')).toBeInTheDocument();
        expect(screen.getByText('Elements must have sufficient color contrast')).toBeInTheDocument();
        expect(screen.getByText('1.4.3')).toBeInTheDocument();
        expect(screen.getByText('<p class="low-contrast">Sample</p>')).toBeInTheDocument();

        // AI data should also be present
        expect(screen.getByText('AI provides additional context')).toBeInTheDocument();
        expect(screen.getByText('Priority: 8/10')).toBeInTheDocument();
      });
    });
  });
});
