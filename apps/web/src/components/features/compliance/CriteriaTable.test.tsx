'use client';

import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CriteriaTable, type CriteriaVerification } from './CriteriaTable';

// Mock WCAG_CRITERIA
vi.mock('@adashield/core/constants', () => ({
  WCAG_CRITERIA: {
    '1.1.1': {
      id: '1.1.1',
      title: 'Non-text Content',
      description: 'All non-text content has a text alternative',
      level: 'A',
    },
    '1.2.1': {
      id: '1.2.1',
      title: 'Audio-only and Video-only',
      description: 'Alternatives for time-based media',
      level: 'A',
    },
    '1.4.3': {
      id: '1.4.3',
      title: 'Contrast (Minimum)',
      description: 'Text has sufficient contrast ratio',
      level: 'AA',
    },
    '2.1.1': {
      id: '2.1.1',
      title: 'Keyboard',
      description: 'All functionality is available from a keyboard',
      level: 'A',
    },
    '2.4.1': {
      id: '2.4.1',
      title: 'Bypass Blocks',
      description: 'A mechanism is available to bypass blocks of content',
      level: 'A',
    },
  },
}));

describe('CriteriaTable', () => {
  const mockVerifications: CriteriaVerification[] = [
    {
      criterionId: '1.1.1',
      status: 'FAIL',
      scanner: 'axe-core',
      issueIds: ['issue-1', 'issue-2'],
    },
    {
      criterionId: '1.2.1',
      status: 'PASS',
      scanner: 'axe-core',
    },
    {
      criterionId: '1.4.3',
      status: 'AI_VERIFIED_PASS',
      scanner: 'axe-core + AI',
      confidence: 85,
      reasoning: 'Contrast ratios verified across all text elements',
    },
    {
      criterionId: '2.1.1',
      status: 'NOT_TESTED',
      scanner: 'N/A',
    },
    {
      criterionId: '2.4.1',
      status: 'AI_VERIFIED_FAIL',
      scanner: 'axe-core + AI',
      issueIds: ['issue-3'],
      confidence: 72,
      reasoning: 'Missing skip link on main navigation',
    },
  ];

  const defaultProps = {
    verifications: mockVerifications,
    wcagLevel: 'AA' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the table with all verifications', () => {
      render(<CriteriaTable {...defaultProps} />);

      // Check all criterion IDs are displayed
      expect(screen.getByText('1.1.1')).toBeInTheDocument();
      expect(screen.getByText('1.2.1')).toBeInTheDocument();
      expect(screen.getByText('1.4.3')).toBeInTheDocument();
      expect(screen.getByText('2.1.1')).toBeInTheDocument();
      expect(screen.getByText('2.4.1')).toBeInTheDocument();
    });

    it('displays criterion titles from WCAG_CRITERIA', () => {
      render(<CriteriaTable {...defaultProps} />);

      expect(screen.getByText('Non-text Content')).toBeInTheDocument();
      expect(screen.getByText('Audio-only and Video-only')).toBeInTheDocument();
      expect(screen.getByText('Contrast (Minimum)')).toBeInTheDocument();
    });

    it('displays status badges with correct labels', () => {
      render(<CriteriaTable {...defaultProps} />);

      expect(screen.getByText('Fail (2)')).toBeInTheDocument();
      expect(screen.getByText('Pass')).toBeInTheDocument();
      expect(screen.getByText('AI Pass')).toBeInTheDocument();
      expect(screen.getByText('Not Tested')).toBeInTheDocument();
      expect(screen.getByText('AI Fail (1)')).toBeInTheDocument();
    });

    it('displays scanner information', () => {
      render(<CriteriaTable {...defaultProps} />);

      const scannerCells = screen.getAllByText('axe-core');
      expect(scannerCells.length).toBeGreaterThan(0);
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('displays AI model name when provided', () => {
      render(<CriteriaTable {...defaultProps} aiModel="claude-opus-4" />);

      expect(screen.getByText('axe-core + claude-opus-4')).toBeInTheDocument();
    });

    it('shows count of displayed criteria', () => {
      render(<CriteriaTable {...defaultProps} />);

      expect(screen.getByText(/Showing 5 of 5 criteria/)).toBeInTheDocument();
    });

    it('shows empty state when no criteria match filters', () => {
      render(
        <CriteriaTable
          verifications={[]}
          wcagLevel="AA"
        />
      );

      expect(screen.getByText(/No criteria match the current filters/)).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('filters by status', async () => {
      render(<CriteriaTable {...defaultProps} />);

      // Find and click the status filter
      const statusSelect = screen.getByRole('combobox', { name: /status/i });
      fireEvent.click(statusSelect);

      // Select "Fail" option
      const failOption = screen.getByRole('option', { name: 'Fail' });
      fireEvent.click(failOption);

      // Should only show FAIL status
      expect(screen.getByText('1.1.1')).toBeInTheDocument();
      expect(screen.queryByText('1.2.1')).not.toBeInTheDocument();
      expect(screen.getByText(/Showing 1 of 5 criteria/)).toBeInTheDocument();
    });

    it('filters by level', async () => {
      render(<CriteriaTable {...defaultProps} />);

      // Find and click the level filter
      const levelSelect = screen.getByRole('combobox', { name: /level/i });
      fireEvent.click(levelSelect);

      // Select "Level AA" option
      const aaOption = screen.getByRole('option', { name: 'Level AA' });
      fireEvent.click(aaOption);

      // Should only show AA level criteria
      expect(screen.getByText('1.4.3')).toBeInTheDocument();
      expect(screen.queryByText('1.1.1')).not.toBeInTheDocument();
      expect(screen.getByText(/Showing 1 of 5 criteria/)).toBeInTheDocument();
    });

    it('shows AAA filter option when wcagLevel is AAA', () => {
      render(<CriteriaTable {...defaultProps} wcagLevel="AAA" />);

      const levelSelect = screen.getByRole('combobox', { name: /level/i });
      fireEvent.click(levelSelect);

      expect(screen.getByRole('option', { name: 'Level AAA' })).toBeInTheDocument();
    });

    it('does not show AAA filter option when wcagLevel is AA', () => {
      render(<CriteriaTable {...defaultProps} wcagLevel="AA" />);

      const levelSelect = screen.getByRole('combobox', { name: /level/i });
      fireEvent.click(levelSelect);

      expect(screen.queryByRole('option', { name: 'Level AAA' })).not.toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('sorts by status by default (failures first)', () => {
      render(<CriteriaTable {...defaultProps} />);

      const rows = screen.getAllByRole('row');
      // First data row should be FAIL (1.1.1)
      const firstDataRow = rows[1];
      expect(within(firstDataRow).getByText('1.1.1')).toBeInTheDocument();
    });

    it('toggles sort order when clicking status header', () => {
      render(<CriteriaTable {...defaultProps} />);

      const statusHeader = screen.getByText('Status').closest('th');
      if (statusHeader) {
        fireEvent.click(statusHeader);
      }

      // After clicking, order should be reversed (passes first)
      const rows = screen.getAllByRole('row');
      const firstDataRow = rows[1];
      expect(within(firstDataRow).getByText('Pass')).toBeInTheDocument();
    });

    it('sorts by ID when clicking ID header', () => {
      render(<CriteriaTable {...defaultProps} />);

      const idHeader = screen.getByText('ID').closest('th');
      if (idHeader) {
        fireEvent.click(idHeader);
      }

      const rows = screen.getAllByRole('row');
      const firstDataRow = rows[1];
      expect(within(firstDataRow).getByText('1.1.1')).toBeInTheDocument();
    });

    it('sorts by name when clicking Name header', () => {
      render(<CriteriaTable {...defaultProps} />);

      const nameHeader = screen.getByText('Name').closest('th');
      if (nameHeader) {
        fireEvent.click(nameHeader);
      }

      // After clicking, should sort alphabetically by title
      const rows = screen.getAllByRole('row');
      const firstDataRow = rows[1];
      expect(within(firstDataRow).getByText('Audio-only and Video-only')).toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    it('calls onCriterionClick when clicking a failed criterion', () => {
      const onCriterionClick = vi.fn();
      render(<CriteriaTable {...defaultProps} onCriterionClick={onCriterionClick} />);

      // Find and click the row with FAIL status
      const failRow = screen.getByText('1.1.1').closest('tr');
      if (failRow) {
        fireEvent.click(failRow);
      }

      expect(onCriterionClick).toHaveBeenCalledWith('1.1.1');
    });

    it('calls onCriterionClick when clicking an AI_VERIFIED_FAIL criterion', () => {
      const onCriterionClick = vi.fn();
      render(<CriteriaTable {...defaultProps} onCriterionClick={onCriterionClick} />);

      // Find and click the row with AI_VERIFIED_FAIL status
      const aiFailRow = screen.getByText('2.4.1').closest('tr');
      if (aiFailRow) {
        fireEvent.click(aiFailRow);
      }

      expect(onCriterionClick).toHaveBeenCalledWith('2.4.1');
    });

    it('does not call onCriterionClick for passing criteria', () => {
      const onCriterionClick = vi.fn();
      render(<CriteriaTable {...defaultProps} onCriterionClick={onCriterionClick} />);

      // Find and click the row with PASS status
      const passRow = screen.getByText('1.2.1').closest('tr');
      if (passRow) {
        fireEvent.click(passRow);
      }

      expect(onCriterionClick).not.toHaveBeenCalled();
    });

    it('does not call onCriterionClick for NOT_TESTED criteria', () => {
      const onCriterionClick = vi.fn();
      render(<CriteriaTable {...defaultProps} onCriterionClick={onCriterionClick} />);

      // Find and click the row with NOT_TESTED status
      const notTestedRow = screen.getByText('2.1.1').closest('tr');
      if (notTestedRow) {
        fireEvent.click(notTestedRow);
      }

      expect(onCriterionClick).not.toHaveBeenCalled();
    });
  });

  describe('Admin View', () => {
    it('shows confidence column when isAdmin is true', () => {
      render(<CriteriaTable {...defaultProps} isAdmin={true} />);

      expect(screen.getByText('Confidence')).toBeInTheDocument();
    });

    it('hides confidence column when isAdmin is false', () => {
      render(<CriteriaTable {...defaultProps} isAdmin={false} />);

      expect(screen.queryByText('Confidence')).not.toBeInTheDocument();
    });

    it('displays confidence bars for AI-verified criteria', () => {
      render(<CriteriaTable {...defaultProps} isAdmin={true} />);

      // Check for confidence values
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('72%')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper table structure', () => {
      render(<CriteriaTable {...defaultProps} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0);
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    });

    it('applies cursor-pointer class to clickable rows', () => {
      const onCriterionClick = vi.fn();
      render(<CriteriaTable {...defaultProps} onCriterionClick={onCriterionClick} />);

      const failRow = screen.getByText('1.1.1').closest('tr');
      expect(failRow).toHaveClass('cursor-pointer');
    });

    it('does not apply cursor-pointer class to non-clickable rows', () => {
      const onCriterionClick = vi.fn();
      render(<CriteriaTable {...defaultProps} onCriterionClick={onCriterionClick} />);

      const passRow = screen.getByText('1.2.1').closest('tr');
      expect(passRow).not.toHaveClass('cursor-pointer');
    });
  });

  describe('Edge Cases', () => {
    it('handles unknown criterion IDs gracefully', () => {
      const verificationWithUnknown: CriteriaVerification[] = [
        {
          criterionId: '9.9.9',
          status: 'PASS',
          scanner: 'axe-core',
        },
      ];

      render(<CriteriaTable verifications={verificationWithUnknown} wcagLevel="AA" />);

      expect(screen.getByText('9.9.9')).toBeInTheDocument();
      expect(screen.getByText('Unknown Criterion')).toBeInTheDocument();
    });

    it('handles verifications without issueIds', () => {
      const verificationWithoutIssues: CriteriaVerification[] = [
        {
          criterionId: '1.1.1',
          status: 'FAIL',
          scanner: 'axe-core',
        },
      ];

      render(<CriteriaTable verifications={verificationWithoutIssues} wcagLevel="AA" />);

      // Should show "Fail" without count
      expect(screen.getByText('Fail')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <CriteriaTable {...defaultProps} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
