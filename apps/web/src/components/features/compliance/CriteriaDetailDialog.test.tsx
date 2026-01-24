'use client';

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CriteriaDetailDialog,
  type EnrichedVerification,
  type CriteriaDetailDialogProps,
} from './CriteriaDetailDialog';

// Mock WCAG_CRITERIA
vi.mock('@/lib/wcag-constants', () => ({
  WCAG_CRITERIA: {
    '1.1.1': {
      id: '1.1.1',
      title: 'Non-text Content',
      description: 'All non-text content has a text alternative that serves the equivalent purpose',
      level: 'A',
    },
    '1.4.3': {
      id: '1.4.3',
      title: 'Contrast (Minimum)',
      description: 'Text has a contrast ratio of at least 4.5:1 (3:1 for large text)',
      level: 'AA',
    },
    '1.2.6': {
      id: '1.2.6',
      title: 'Sign Language (Prerecorded)',
      description: 'Sign language interpretation is provided for prerecorded audio content',
      level: 'AAA',
    },
  },
}));

describe('CriteriaDetailDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnViewIssues = vi.fn();

  const baseCriterion: EnrichedVerification = {
    criterionId: '1.1.1',
    status: 'PASS',
    scanner: 'axe-core',
  };

  const defaultProps: CriteriaDetailDialogProps = {
    open: true,
    onClose: mockOnClose,
    criterion: baseCriterion,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders criterion ID and title', () => {
      render(<CriteriaDetailDialog {...defaultProps} />);

      expect(screen.getByText('1.1.1')).toBeInTheDocument();
      expect(screen.getByText('Non-text Content')).toBeInTheDocument();
    });

    it('renders WCAG level badge', () => {
      render(<CriteriaDetailDialog {...defaultProps} />);

      expect(screen.getByText('Level A')).toBeInTheDocument();
    });

    it('renders WCAG level AA badge correctly', () => {
      const aaCriterion: EnrichedVerification = {
        criterionId: '1.4.3',
        status: 'PASS',
        scanner: 'axe-core',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={aaCriterion} />);

      expect(screen.getByText('Level AA')).toBeInTheDocument();
    });

    it('renders WCAG level AAA badge correctly', () => {
      const aaaCriterion: EnrichedVerification = {
        criterionId: '1.2.6',
        status: 'PASS',
        scanner: 'axe-core',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={aaaCriterion} />);

      expect(screen.getByText('Level AAA')).toBeInTheDocument();
    });

    it('renders criterion description', () => {
      render(<CriteriaDetailDialog {...defaultProps} />);

      expect(
        screen.getByText('All non-text content has a text alternative that serves the equivalent purpose')
      ).toBeInTheDocument();
    });

    it('displays scanner source', () => {
      render(<CriteriaDetailDialog {...defaultProps} />);

      expect(screen.getByText('axe-core')).toBeInTheDocument();
    });

    it('displays scanner source with AI model name when provided', () => {
      const aiCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'AI_VERIFIED_PASS',
        scanner: 'axe-core + AI',
      };
      render(
        <CriteriaDetailDialog
          {...defaultProps}
          criterion={aiCriterion}
          aiModel="claude-opus-4"
        />
      );

      expect(screen.getByText('axe-core + claude-opus-4')).toBeInTheDocument();
    });
  });

  describe('Status Badge Rendering', () => {
    it('renders status badge with correct styling for PASS', () => {
      const passCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'PASS',
        scanner: 'axe-core',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={passCriterion} />);

      expect(screen.getByText('Pass')).toBeInTheDocument();
      expect(
        screen.getByText('This criterion passed automated testing.')
      ).toBeInTheDocument();
    });

    it('renders status badge with correct styling for FAIL', () => {
      const failCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'FAIL',
        scanner: 'axe-core',
        issueIds: ['issue-1', 'issue-2'],
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={failCriterion} />);

      expect(screen.getByText('Fail (2 issues)')).toBeInTheDocument();
      expect(
        screen.getByText('This criterion failed automated testing.')
      ).toBeInTheDocument();
    });

    it('renders status badge for FAIL without issue count when no issues', () => {
      const failCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'FAIL',
        scanner: 'axe-core',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={failCriterion} />);

      expect(screen.getByText('Fail')).toBeInTheDocument();
    });

    it('renders status badge with correct styling for AI_VERIFIED_PASS', () => {
      const aiPassCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'AI_VERIFIED_PASS',
        scanner: 'axe-core + AI',
        confidence: 85,
        reasoning: 'All images have appropriate alt text',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={aiPassCriterion} />);

      expect(screen.getByText('AI Verified Pass')).toBeInTheDocument();
      expect(
        screen.getByText('AI analysis determined this criterion passes.')
      ).toBeInTheDocument();
    });

    it('renders status badge with correct styling for AI_VERIFIED_FAIL', () => {
      const aiFailCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'AI_VERIFIED_FAIL',
        scanner: 'axe-core + AI',
        issueIds: ['issue-1'],
        confidence: 72,
        reasoning: 'Missing alt text on decorative images',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={aiFailCriterion} />);

      expect(screen.getByText('AI Verified Fail (1 issues)')).toBeInTheDocument();
      expect(
        screen.getByText('AI analysis determined this criterion fails.')
      ).toBeInTheDocument();
    });

    it('renders status badge with correct styling for NOT_TESTED', () => {
      const notTestedCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'NOT_TESTED',
        scanner: 'N/A',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={notTestedCriterion} />);

      expect(screen.getByText('Not Tested')).toBeInTheDocument();
      expect(
        screen.getByText(
          'This criterion cannot be tested by automated tools and requires manual review.'
        )
      ).toBeInTheDocument();
    });
  });

  describe('AI Confidence Display', () => {
    it('shows AI confidence when available', () => {
      const aiCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'AI_VERIFIED_PASS',
        scanner: 'axe-core + AI',
        confidence: 85,
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={aiCriterion} />);

      expect(screen.getByText('AI Confidence')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('does not show AI confidence for non-AI statuses', () => {
      const passCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'PASS',
        scanner: 'axe-core',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={passCriterion} />);

      expect(screen.queryByText('AI Confidence')).not.toBeInTheDocument();
    });

    it('does not show AI confidence when undefined for AI status', () => {
      const aiCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'AI_VERIFIED_PASS',
        scanner: 'axe-core + AI',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={aiCriterion} />);

      expect(screen.queryByText('AI Confidence')).not.toBeInTheDocument();
    });
  });

  describe('AI Reasoning Display', () => {
    it('shows AI reasoning when available', () => {
      const aiCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'AI_VERIFIED_PASS',
        scanner: 'axe-core + AI',
        confidence: 85,
        reasoning: 'All images have descriptive alt text that provides equivalent information.',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={aiCriterion} />);

      expect(screen.getByText('AI Reasoning')).toBeInTheDocument();
      expect(
        screen.getByText(
          'All images have descriptive alt text that provides equivalent information.'
        )
      ).toBeInTheDocument();
    });

    it('does not show AI reasoning for non-AI statuses', () => {
      const passCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'PASS',
        scanner: 'axe-core',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={passCriterion} />);

      expect(screen.queryByText('AI Reasoning')).not.toBeInTheDocument();
    });

    it('does not show AI reasoning when empty for AI status', () => {
      const aiCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'AI_VERIFIED_PASS',
        scanner: 'axe-core + AI',
        confidence: 85,
        reasoning: '',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={aiCriterion} />);

      expect(screen.queryByText('AI Reasoning')).not.toBeInTheDocument();
    });
  });

  describe('View Issues Button', () => {
    it('shows View Issues button for FAIL status with issues', () => {
      const failCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'FAIL',
        scanner: 'axe-core',
        issueIds: ['issue-1', 'issue-2'],
      };
      render(
        <CriteriaDetailDialog
          {...defaultProps}
          criterion={failCriterion}
          onViewIssues={mockOnViewIssues}
        />
      );

      const button = screen.getByRole('button', { name: /View Related Issues/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('View Related Issues (2)');
    });

    it('shows View Issues button for AI_VERIFIED_FAIL status with issues', () => {
      const aiFailCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'AI_VERIFIED_FAIL',
        scanner: 'axe-core + AI',
        issueIds: ['issue-1'],
        confidence: 72,
      };
      render(
        <CriteriaDetailDialog
          {...defaultProps}
          criterion={aiFailCriterion}
          onViewIssues={mockOnViewIssues}
        />
      );

      const button = screen.getByRole('button', { name: /View Related Issues/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('View Related Issues (1)');
    });

    it('hides View Issues button for PASS status', () => {
      const passCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'PASS',
        scanner: 'axe-core',
      };
      render(
        <CriteriaDetailDialog
          {...defaultProps}
          criterion={passCriterion}
          onViewIssues={mockOnViewIssues}
        />
      );

      expect(
        screen.queryByRole('button', { name: /View Related Issues/i })
      ).not.toBeInTheDocument();
    });

    it('hides View Issues button for AI_VERIFIED_PASS status', () => {
      const aiPassCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'AI_VERIFIED_PASS',
        scanner: 'axe-core + AI',
        confidence: 85,
      };
      render(
        <CriteriaDetailDialog
          {...defaultProps}
          criterion={aiPassCriterion}
          onViewIssues={mockOnViewIssues}
        />
      );

      expect(
        screen.queryByRole('button', { name: /View Related Issues/i })
      ).not.toBeInTheDocument();
    });

    it('hides View Issues button for NOT_TESTED status', () => {
      const notTestedCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'NOT_TESTED',
        scanner: 'N/A',
      };
      render(
        <CriteriaDetailDialog
          {...defaultProps}
          criterion={notTestedCriterion}
          onViewIssues={mockOnViewIssues}
        />
      );

      expect(
        screen.queryByRole('button', { name: /View Related Issues/i })
      ).not.toBeInTheDocument();
    });

    it('hides View Issues button when FAIL status has no issues', () => {
      const failCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'FAIL',
        scanner: 'axe-core',
        issueIds: [],
      };
      render(
        <CriteriaDetailDialog
          {...defaultProps}
          criterion={failCriterion}
          onViewIssues={mockOnViewIssues}
        />
      );

      expect(
        screen.queryByRole('button', { name: /View Related Issues/i })
      ).not.toBeInTheDocument();
    });

    it('hides View Issues button when onViewIssues callback is not provided', () => {
      const failCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'FAIL',
        scanner: 'axe-core',
        issueIds: ['issue-1'],
      };
      render(
        <CriteriaDetailDialog
          {...defaultProps}
          criterion={failCriterion}
          onViewIssues={undefined}
        />
      );

      expect(
        screen.queryByRole('button', { name: /View Related Issues/i })
      ).not.toBeInTheDocument();
    });

    it('calls onViewIssues when button clicked', () => {
      const failCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'FAIL',
        scanner: 'axe-core',
        issueIds: ['issue-1', 'issue-2'],
      };
      render(
        <CriteriaDetailDialog
          {...defaultProps}
          criterion={failCriterion}
          onViewIssues={mockOnViewIssues}
        />
      );

      const button = screen.getByRole('button', { name: /View Related Issues/i });
      fireEvent.click(button);

      expect(mockOnViewIssues).toHaveBeenCalledTimes(1);
      expect(mockOnViewIssues).toHaveBeenCalledWith('1.1.1');
    });
  });

  describe('Dialog Close Behavior', () => {
    it('calls onClose when dialog closes via close button', () => {
      render(<CriteriaDetailDialog {...defaultProps} />);

      // Find and click the close button (X icon)
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not render dialog content when open is false', () => {
      render(<CriteriaDetailDialog {...defaultProps} open={false} />);

      expect(screen.queryByText('1.1.1')).not.toBeInTheDocument();
      expect(screen.queryByText('Non-text Content')).not.toBeInTheDocument();
    });
  });

  describe('Missing Data Handling', () => {
    it('handles missing WCAG criterion data gracefully', () => {
      const unknownCriterion: EnrichedVerification = {
        criterionId: '9.9.9',
        status: 'PASS',
        scanner: 'axe-core',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={unknownCriterion} />);

      // Should display the criterion ID
      expect(screen.getByText('9.9.9')).toBeInTheDocument();
      // Should display "Unknown Criterion" as fallback title
      expect(screen.getByText('Unknown Criterion')).toBeInTheDocument();
      // Should have a default level badge
      expect(screen.getByText('Level A')).toBeInTheDocument();
    });

    it('handles null criterion gracefully', () => {
      render(<CriteriaDetailDialog {...defaultProps} criterion={null} />);

      expect(screen.getByText('Criterion Details')).toBeInTheDocument();
      expect(screen.getByText('No criterion data available.')).toBeInTheDocument();
    });

    it('uses provided title over WCAG_CRITERIA lookup', () => {
      const criterionWithTitle: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'PASS',
        scanner: 'axe-core',
        title: 'Custom Title',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={criterionWithTitle} />);

      expect(screen.getByText('Custom Title')).toBeInTheDocument();
      expect(screen.queryByText('Non-text Content')).not.toBeInTheDocument();
    });

    it('uses provided description over WCAG_CRITERIA lookup', () => {
      const criterionWithDescription: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'PASS',
        scanner: 'axe-core',
        description: 'Custom description for testing',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={criterionWithDescription} />);

      expect(screen.getByText('Custom description for testing')).toBeInTheDocument();
    });

    it('uses provided level over WCAG_CRITERIA lookup', () => {
      const criterionWithLevel: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'PASS',
        scanner: 'axe-core',
        level: 'AAA',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={criterionWithLevel} />);

      expect(screen.getByText('Level AAA')).toBeInTheDocument();
      expect(screen.queryByText('Level A')).not.toBeInTheDocument();
    });
  });

  describe('Scanner Display', () => {
    it('displays "N/A" scanner correctly', () => {
      const notTestedCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'NOT_TESTED',
        scanner: 'N/A',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={notTestedCriterion} />);

      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('displays AI scanner without model name when not provided', () => {
      const aiCriterion: EnrichedVerification = {
        criterionId: '1.1.1',
        status: 'AI_VERIFIED_PASS',
        scanner: 'axe-core + AI',
      };
      render(<CriteriaDetailDialog {...defaultProps} criterion={aiCriterion} />);

      expect(screen.getByText('axe-core + AI')).toBeInTheDocument();
    });
  });
});
