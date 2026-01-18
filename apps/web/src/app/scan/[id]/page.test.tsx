/**
 * Integration tests for ScanResultPage with coverage components
 *
 * Tests:
 * - ScanCoverageCard renders with coverage data
 * - AI-enhanced vs standard display
 * - Criteria coverage tooltip interaction
 *
 * Requirements: All enhanced trust indicators requirements
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the hooks
vi.mock('@/hooks/useScan', () => ({
  useScan: vi.fn(),
}));

vi.mock('@/hooks/useScanResult', () => ({
  useScanResult: vi.fn(),
}));

vi.mock('@/hooks/useAiScanStatus', () => ({
  useAiScanStatus: vi.fn(),
}));

vi.mock('@/hooks/useReportStatus', () => ({
  useReportStatus: vi.fn(),
}));

vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'test-scan-id' }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/scan/test-scan-id',
}));

// Import mocked hooks
import { useScan } from '@/hooks/useScan';
import { useScanResult } from '@/hooks/useScanResult';
import { useAiScanStatus } from '@/hooks/useAiScanStatus';
import { useReportStatus } from '@/hooks/useReportStatus';

// Import the page component
import ScanResultPage from './page';

describe('ScanResultPage with Coverage', () => {
  const mockStandardScan = {
    id: 'test-scan-id',
    url: 'https://example.com',
    status: 'COMPLETED' as const,
    wcagLevel: 'AA' as const,
    aiEnabled: false,
    email: null,
    createdAt: '2024-01-01T10:00:00Z',
    completedAt: '2024-01-01T10:05:00Z',
  };

  const mockAiScan = {
    ...mockStandardScan,
    aiEnabled: true,
    email: 'test@example.com',
  };

  const mockStandardResult = {
    scanId: 'test-scan-id',
    url: 'https://example.com',
    wcagLevel: 'AA' as const,
    completedAt: '2024-01-01T10:05:00Z',
    summary: {
      totalIssues: 5,
      critical: 1,
      serious: 2,
      moderate: 1,
      minor: 1,
      passed: 156,
    },
    issuesByImpact: {
      critical: [],
      serious: [],
      moderate: [],
      minor: [],
    },
    metadata: {
      coverageNote: 'Automated testing detects approximately 57% of WCAG issues.',
      wcagVersion: '2.1',
      toolVersion: '1.0.0',
      scanDuration: 5000,
      inapplicableChecks: 10,
    },
    coverage: {
      coveragePercentage: 57,
      criteriaChecked: 32,
      criteriaTotal: 50,
      isAiEnhanced: false,
      breakdown: {
        criteriaWithIssues: 8,
        criteriaPassed: 24,
        criteriaNotTestable: 18,
      },
    },
  };

  const mockAiResult = {
    ...mockStandardResult,
    coverage: {
      coveragePercentage: 80,
      criteriaChecked: 38,
      criteriaTotal: 50,
      isAiEnhanced: true,
      breakdown: {
        criteriaWithIssues: 10,
        criteriaPassed: 28,
        criteriaNotTestable: 12,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(useReportStatus).mockReturnValue({
      status: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  describe('Standard scan with coverage', () => {
    beforeEach(() => {
      vi.mocked(useScan).mockReturnValue({
        scan: mockStandardScan,
        loading: false,
        error: null,
      });

      vi.mocked(useScanResult).mockReturnValue({
        result: mockStandardResult,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      vi.mocked(useAiScanStatus).mockReturnValue({
        aiStatus: null,
        loading: false,
        error: null,
      });
    });

    it('should render ScanCoverageCard', () => {
      render(<ScanResultPage />);

      expect(screen.getByText('Scan Coverage')).toBeInTheDocument();
    });

    it('should display 57% detection coverage', () => {
      render(<ScanResultPage />);

      // Coverage value appears in multiple places (metric card and disclaimer)
      const coverageValues = screen.getAllByText('57%');
      expect(coverageValues.length).toBeGreaterThan(0);
      expect(screen.getByText('Detection Coverage')).toBeInTheDocument();
    });

    it('should display Standard sublabel', () => {
      render(<ScanResultPage />);

      expect(screen.getByText('Standard')).toBeInTheDocument();
    });

    it('should display criteria coverage', () => {
      render(<ScanResultPage />);

      expect(screen.getByText('32 of 50')).toBeInTheDocument();
      expect(screen.getByText('Criteria Checked')).toBeInTheDocument();
    });

    it('should display passed checks', () => {
      render(<ScanResultPage />);

      expect(screen.getByText('156')).toBeInTheDocument();
      expect(screen.getByText('Passed Checks')).toBeInTheDocument();
    });

    it('should not show AI-Enhanced badge for standard scan', () => {
      render(<ScanResultPage />);

      // Should not have AI-Enhanced badge in the header
      const badges = screen.queryAllByRole('status', { name: 'AI-enhanced scan' });
      expect(badges.length).toBe(0);
    });
  });

  describe('AI-enhanced scan with coverage', () => {
    beforeEach(() => {
      vi.mocked(useScan).mockReturnValue({
        scan: mockAiScan,
        loading: false,
        error: null,
      });

      vi.mocked(useScanResult).mockReturnValue({
        result: mockAiResult,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      vi.mocked(useAiScanStatus).mockReturnValue({
        aiStatus: {
          scanId: 'test-scan-id',
          aiEnabled: true,
          status: 'COMPLETED',
          summary: 'AI summary',
          remediationPlan: 'Remediation plan',
        },
        loading: false,
        error: null,
      });
    });

    it('should display 75-85% detection coverage for AI-enhanced', () => {
      render(<ScanResultPage />);

      // Coverage value appears in multiple places (metric card and disclaimer)
      const coverageValues = screen.getAllByText('75-85%');
      expect(coverageValues.length).toBeGreaterThan(0);
    });

    it('should display AI-enhanced sublabel', () => {
      render(<ScanResultPage />);

      expect(screen.getByText('AI-enhanced')).toBeInTheDocument();
    });

    it('should show AI-Enhanced badge', () => {
      render(<ScanResultPage />);

      // Should have at least one AI-Enhanced badge
      const badges = screen.getAllByText('AI-Enhanced');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('should display higher criteria checked for AI scan', () => {
      render(<ScanResultPage />);

      expect(screen.getByText('38 of 50')).toBeInTheDocument();
    });
  });

  describe('AI-enhanced scan processing', () => {
    beforeEach(() => {
      vi.mocked(useScan).mockReturnValue({
        scan: mockAiScan,
        loading: false,
        error: null,
      });

      vi.mocked(useScanResult).mockReturnValue({
        result: mockStandardResult, // Standard coverage while AI is processing
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      vi.mocked(useAiScanStatus).mockReturnValue({
        aiStatus: {
          scanId: 'test-scan-id',
          aiEnabled: true,
          status: 'PROCESSING',
          summary: null,
          remediationPlan: null,
        },
        loading: false,
        error: null,
      });
    });

    it('should display 57% while AI is processing', () => {
      render(<ScanResultPage />);

      // Coverage value appears in multiple places
      const coverageValues = screen.getAllByText('57%');
      expect(coverageValues.length).toBeGreaterThan(0);
    });

    it('should show processing note in coverage disclaimer', () => {
      render(<ScanResultPage />);

      expect(screen.getByText(/AI enhancement is being processed/)).toBeInTheDocument();
    });
  });

  describe('Criteria coverage tooltip interaction', () => {
    beforeEach(() => {
      vi.mocked(useScan).mockReturnValue({
        scan: mockStandardScan,
        loading: false,
        error: null,
      });

      vi.mocked(useScanResult).mockReturnValue({
        result: mockStandardResult,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      vi.mocked(useAiScanStatus).mockReturnValue({
        aiStatus: null,
        loading: false,
        error: null,
      });
    });

    it('should show tooltip with breakdown on hover', async () => {
      const user = userEvent.setup();
      render(<ScanResultPage />);

      // Find the criteria coverage button
      const criteriaButton = screen.getByRole('button', {
        name: /32 of 50 WCAG AA criteria checked/,
      });

      await user.hover(criteriaButton);

      await waitFor(() => {
        // Radix UI tooltip may render multiple elements
        const tooltipHeaders = screen.getAllByText('WCAG 2.1 Level AA Coverage');
        expect(tooltipHeaders.length).toBeGreaterThan(0);
      });
    });

    it('should show breakdown details in tooltip', async () => {
      const user = userEvent.setup();
      render(<ScanResultPage />);

      const criteriaButton = screen.getByRole('button', {
        name: /32 of 50 WCAG AA criteria checked/,
      });

      await user.hover(criteriaButton);

      await waitFor(() => {
        // Radix UI tooltip may render multiple elements
        const issuesText = screen.getAllByText('8 criteria with issues found');
        expect(issuesText.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Fallback behavior without coverage data', () => {
    beforeEach(() => {
      vi.mocked(useScan).mockReturnValue({
        scan: mockStandardScan,
        loading: false,
        error: null,
      });

      // Result without coverage data
      const resultWithoutCoverage = {
        ...mockStandardResult,
        coverage: undefined,
      };

      vi.mocked(useScanResult).mockReturnValue({
        result: resultWithoutCoverage,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      vi.mocked(useAiScanStatus).mockReturnValue({
        aiStatus: null,
        loading: false,
        error: null,
      });
    });

    it('should display default 57% when coverage is undefined', () => {
      render(<ScanResultPage />);

      // Coverage value appears in multiple places
      const coverageValues = screen.getAllByText('57%');
      expect(coverageValues.length).toBeGreaterThan(0);
    });

    it('should display default criteria total of 50 for AA level', () => {
      render(<ScanResultPage />);

      expect(screen.getByText('0 of 50')).toBeInTheDocument();
    });
  });
});
