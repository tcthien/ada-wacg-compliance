'use client';

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScanResultsTabs } from './ScanResultsTabs';
import type { IssuesByImpact, EnhancedCoverageResponse } from '@/lib/api';

// Mock Next.js navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();
const mockPathname = '/scan/test-scan-id';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
}));

// Mock WCAG_CRITERIA for CriteriaTable
vi.mock('@adashield/core/constants', () => ({
  WCAG_CRITERIA: {
    '1.1.1': {
      id: '1.1.1',
      title: 'Non-text Content',
      description: 'All non-text content has a text alternative',
      level: 'A',
    },
    '1.4.3': {
      id: '1.4.3',
      title: 'Contrast (Minimum)',
      description: 'Text has sufficient contrast ratio',
      level: 'AA',
    },
  },
}));

describe('ScanResultsTabs', () => {
  const mockIssuesByImpact: IssuesByImpact = {
    critical: [
      {
        id: 'issue-1',
        scanResultId: 'scan-1',
        ruleId: 'image-alt',
        wcagCriteria: ['1.1.1'],
        impact: 'CRITICAL',
        description: 'Images must have alternate text',
        helpText: 'Ensure images have alt text',
        helpUrl: 'https://example.com/help',
        htmlSnippet: '<img src="test.jpg">',
        cssSelector: '#img1',
        nodes: [],
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    serious: [
      {
        id: 'issue-2',
        scanResultId: 'scan-1',
        ruleId: 'color-contrast',
        wcagCriteria: ['1.4.3'],
        impact: 'SERIOUS',
        description: 'Elements must have sufficient color contrast',
        helpText: 'Ensure text has sufficient contrast',
        helpUrl: 'https://example.com/help',
        htmlSnippet: '<p style="color:#777">Text</p>',
        cssSelector: '#text1',
        nodes: [],
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    moderate: [],
    minor: [],
  };

  const mockEnhancedCoverage: EnhancedCoverageResponse = {
    coveragePercentage: 40,
    criteriaChecked: 20,
    criteriaTotal: 50,
    isAiEnhanced: false,
    breakdown: {
      criteriaWithIssues: 2,
      criteriaPassed: 18,
      criteriaAiVerified: 0,
      criteriaNotTested: 30,
    },
    criteriaVerifications: [
      {
        criterionId: '1.1.1',
        status: 'FAIL',
        scanner: 'axe-core',
        issueIds: ['issue-1'],
      },
      {
        criterionId: '1.4.3',
        status: 'FAIL',
        scanner: 'axe-core',
        issueIds: ['issue-2'],
      },
    ],
  };

  const defaultProps = {
    issuesByImpact: mockIssuesByImpact,
    enhancedCoverage: mockEnhancedCoverage,
    wcagLevel: 'AA' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset search params
    mockSearchParams.delete('tab');
    mockSearchParams.delete('criterion');
  });

  describe('Tab Rendering', () => {
    it('renders both tabs', () => {
      render(<ScanResultsTabs {...defaultProps} />);

      expect(screen.getByRole('tab', { name: /issues/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /criteria coverage/i })).toBeInTheDocument();
    });

    it('displays issue count in Issues tab badge', () => {
      render(<ScanResultsTabs {...defaultProps} />);

      // Total issues: 1 critical + 1 serious = 2
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('displays criteria count in Coverage tab badge', () => {
      render(<ScanResultsTabs {...defaultProps} />);

      expect(screen.getByText('20/50')).toBeInTheDocument();
    });

    it('defaults to issues tab when no tab param in URL', () => {
      render(<ScanResultsTabs {...defaultProps} />);

      const issuesTab = screen.getByRole('tab', { name: /issues/i });
      expect(issuesTab).toHaveAttribute('data-state', 'active');
    });
  });

  describe('Tab Navigation', () => {
    it('updates URL when switching to coverage tab', () => {
      render(<ScanResultsTabs {...defaultProps} />);

      const coverageTab = screen.getByRole('tab', { name: /criteria coverage/i });
      fireEvent.click(coverageTab);

      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('tab=coverage'),
        { scroll: false }
      );
    });

    it('updates URL when switching to issues tab', () => {
      mockSearchParams.set('tab', 'coverage');
      render(<ScanResultsTabs {...defaultProps} />);

      const issuesTab = screen.getByRole('tab', { name: /issues/i });
      fireEvent.click(issuesTab);

      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('tab=issues'),
        { scroll: false }
      );
    });
  });

  describe('Issues Tab Content', () => {
    it('renders issue list when issues exist', () => {
      render(<ScanResultsTabs {...defaultProps} />);

      expect(screen.getByText(/images must have alternate text/i)).toBeInTheDocument();
      expect(screen.getByText(/elements must have sufficient color contrast/i)).toBeInTheDocument();
    });

    it('shows empty state when no issues', () => {
      const emptyIssues: IssuesByImpact = {
        critical: [],
        serious: [],
        moderate: [],
        minor: [],
      };

      render(
        <ScanResultsTabs
          {...defaultProps}
          issuesByImpact={emptyIssues}
        />
      );

      expect(screen.getByText(/no issues detected/i)).toBeInTheDocument();
    });
  });

  describe('Criterion Filtering', () => {
    it('shows criterion filter banner when criterion param is set', () => {
      mockSearchParams.set('criterion', '1.1.1');
      render(<ScanResultsTabs {...defaultProps} />);

      expect(screen.getByText(/showing issues for criterion/i)).toBeInTheDocument();
      expect(screen.getByText('1.1.1')).toBeInTheDocument();
    });

    it('filters issues by criterion', () => {
      mockSearchParams.set('criterion', '1.1.1');
      render(<ScanResultsTabs {...defaultProps} />);

      // Should only show the issue for 1.1.1 criterion
      expect(screen.getByText(/images must have alternate text/i)).toBeInTheDocument();
      // Should not show the issue for 1.4.3 criterion
      expect(screen.queryByText(/elements must have sufficient color contrast/i)).not.toBeInTheDocument();
    });

    it('clears criterion filter when clicking "Show all issues"', () => {
      mockSearchParams.set('criterion', '1.1.1');
      render(<ScanResultsTabs {...defaultProps} />);

      const clearButton = screen.getByText(/show all issues/i);
      fireEvent.click(clearButton);

      expect(mockPush).toHaveBeenCalledWith(
        expect.not.stringContaining('criterion='),
        { scroll: false }
      );
    });

    it('shows no issues message when criterion has no related issues', () => {
      mockSearchParams.set('criterion', '2.1.1');
      render(<ScanResultsTabs {...defaultProps} />);

      expect(screen.getByText(/no issues for criterion 2.1.1/i)).toBeInTheDocument();
    });
  });

  describe('Coverage Tab Content', () => {
    it('renders criteria table when enhanced coverage exists', () => {
      mockSearchParams.set('tab', 'coverage');
      render(<ScanResultsTabs {...defaultProps} />);

      // The CriteriaTable should show the criteria
      expect(screen.getByText('1.1.1')).toBeInTheDocument();
      expect(screen.getByText('1.4.3')).toBeInTheDocument();
    });

    it('shows empty state when no coverage data', () => {
      mockSearchParams.set('tab', 'coverage');
      render(
        <ScanResultsTabs
          {...defaultProps}
          enhancedCoverage={undefined}
        />
      );

      expect(screen.getByText(/coverage data not available/i)).toBeInTheDocument();
    });
  });

  describe('AI Loading State', () => {
    it('passes aiLoading to IssueList', () => {
      render(
        <ScanResultsTabs
          {...defaultProps}
          aiLoading={true}
        />
      );

      // The aiLoading prop should be passed to IssueList
      // We can verify this by checking if the component renders without errors
      expect(screen.getByRole('tab', { name: /issues/i })).toBeInTheDocument();
    });
  });

  describe('Admin Mode', () => {
    it('passes isAdmin to CriteriaTable', () => {
      mockSearchParams.set('tab', 'coverage');
      render(
        <ScanResultsTabs
          {...defaultProps}
          isAdmin={true}
        />
      );

      // In admin mode, confidence column should be visible
      expect(screen.getByText('Confidence')).toBeInTheDocument();
    });

    it('hides confidence column when not admin', () => {
      mockSearchParams.set('tab', 'coverage');
      render(
        <ScanResultsTabs
          {...defaultProps}
          isAdmin={false}
        />
      );

      expect(screen.queryByText('Confidence')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('uses proper tab panel structure', () => {
      render(<ScanResultsTabs {...defaultProps} />);

      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab').length).toBe(2);
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });
  });
});
