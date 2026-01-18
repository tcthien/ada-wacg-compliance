/**
 * Unit tests for CriteriaCoverage component
 *
 * Tests:
 * - Rendering with different WCAG levels
 * - Tooltip content shows correct breakdown
 * - Accessibility attributes
 * - Progress indicator displays correctly
 *
 * Requirements: 2.1, 2.2
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CriteriaCoverage, type CriteriaCoverageProps } from './CriteriaCoverage';

describe('CriteriaCoverage', () => {
  const defaultProps: CriteriaCoverageProps = {
    criteriaChecked: 32,
    criteriaTotal: 50,
    criteriaWithIssues: 8,
    criteriaPassed: 24,
    criteriaNotTestable: 18,
    wcagLevel: 'AA',
  };

  describe('Rendering', () => {
    it('should render the component with criteria counts', () => {
      render(<CriteriaCoverage {...defaultProps} />);

      expect(screen.getByText('32 of 50')).toBeInTheDocument();
      expect(screen.getByText('Criteria Checked')).toBeInTheDocument();
    });

    it('should display coverage percentage', () => {
      render(<CriteriaCoverage {...defaultProps} />);

      // 32/50 = 64%
      expect(screen.getByText('64%')).toBeInTheDocument();
    });

    it('should render as a button', () => {
      render(<CriteriaCoverage {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <CriteriaCoverage {...defaultProps} className="custom-class" />
      );

      const button = container.querySelector('.custom-class');
      expect(button).toBeInTheDocument();
    });
  });

  describe('WCAG Levels', () => {
    it('should render correctly for Level A', () => {
      render(
        <CriteriaCoverage
          {...defaultProps}
          criteriaChecked={20}
          criteriaTotal={30}
          wcagLevel="A"
        />
      );

      expect(screen.getByText('20 of 30')).toBeInTheDocument();
    });

    it('should render correctly for Level AA', () => {
      render(
        <CriteriaCoverage
          {...defaultProps}
          criteriaChecked={32}
          criteriaTotal={50}
          wcagLevel="AA"
        />
      );

      expect(screen.getByText('32 of 50')).toBeInTheDocument();
    });

    it('should render correctly for Level AAA', () => {
      render(
        <CriteriaCoverage
          {...defaultProps}
          criteriaChecked={50}
          criteriaTotal={78}
          wcagLevel="AAA"
        />
      );

      expect(screen.getByText('50 of 78')).toBeInTheDocument();
    });
  });

  describe('Tooltip content', () => {
    it('should show tooltip with breakdown on hover', async () => {
      const user = userEvent.setup();

      render(<CriteriaCoverage {...defaultProps} />);

      const button = screen.getByRole('button');
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText('WCAG 2.1 Level AA Coverage')).toBeInTheDocument();
      });
    });

    it('should display criteria with issues in tooltip', async () => {
      const user = userEvent.setup();

      render(<CriteriaCoverage {...defaultProps} />);

      const button = screen.getByRole('button');
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText('8 criteria with issues found')).toBeInTheDocument();
      });
    });

    it('should display criteria passed in tooltip', async () => {
      const user = userEvent.setup();

      render(<CriteriaCoverage {...defaultProps} />);

      const button = screen.getByRole('button');
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText('24 criteria passed')).toBeInTheDocument();
      });
    });

    it('should display criteria not testable in tooltip', async () => {
      const user = userEvent.setup();

      render(<CriteriaCoverage {...defaultProps} />);

      const button = screen.getByRole('button');
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText('18 criteria not testable by automation')).toBeInTheDocument();
      });
    });

    it('should display total summary in tooltip', async () => {
      const user = userEvent.setup();

      render(<CriteriaCoverage {...defaultProps} />);

      const button = screen.getByRole('button');
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText('Total: 32 of 50 criteria checked')).toBeInTheDocument();
      });
    });

    it('should show correct WCAG level name in tooltip for Level A', async () => {
      const user = userEvent.setup();

      render(<CriteriaCoverage {...defaultProps} wcagLevel="A" />);

      const button = screen.getByRole('button');
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText('WCAG 2.1 Level A Coverage')).toBeInTheDocument();
      });
    });

    it('should show correct WCAG level name in tooltip for Level AAA', async () => {
      const user = userEvent.setup();

      render(<CriteriaCoverage {...defaultProps} wcagLevel="AAA" />);

      const button = screen.getByRole('button');
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText('WCAG 2.1 Level AAA Coverage')).toBeInTheDocument();
      });
    });

    it('should not show breakdown items with zero count', async () => {
      const user = userEvent.setup();

      render(
        <CriteriaCoverage
          {...defaultProps}
          criteriaWithIssues={0}
          criteriaPassed={32}
          criteriaNotTestable={0}
        />
      );

      const button = screen.getByRole('button');
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText('32 criteria passed')).toBeInTheDocument();
        expect(screen.queryByText(/criteria with issues found/)).not.toBeInTheDocument();
        expect(screen.queryByText(/criteria not testable/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label on the button', () => {
      render(<CriteriaCoverage {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute(
        'aria-label',
        expect.stringContaining('32 of 50 WCAG AA criteria checked')
      );
    });

    it('should include coverage percentage in aria-label', () => {
      render(<CriteriaCoverage {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute(
        'aria-label',
        expect.stringContaining('64% coverage')
      );
    });

    it('should have progressbar role on the circular indicator', () => {
      render(<CriteriaCoverage {...defaultProps} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeInTheDocument();
    });

    it('should have correct aria-valuenow on progressbar', () => {
      render(<CriteriaCoverage {...defaultProps} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '64');
    });

    it('should have aria-valuemin and aria-valuemax on progressbar', () => {
      render(<CriteriaCoverage {...defaultProps} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    });

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();

      render(<CriteriaCoverage {...defaultProps} />);

      const button = screen.getByRole('button');

      // Tab to focus the button
      await user.tab();
      expect(button).toHaveFocus();
    });

    it('should show tooltip on keyboard focus', async () => {
      const user = userEvent.setup();

      render(<CriteriaCoverage {...defaultProps} />);

      // Tab to focus the button
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('WCAG 2.1 Level AA Coverage')).toBeInTheDocument();
      });
    });

    it('should have aria-label on breakdown list in tooltip', async () => {
      const user = userEvent.setup();

      render(<CriteriaCoverage {...defaultProps} />);

      const button = screen.getByRole('button');
      await user.hover(button);

      await waitFor(() => {
        const list = screen.getByRole('list', { name: 'Criteria breakdown' });
        expect(list).toBeInTheDocument();
      });
    });
  });

  describe('Progress indicator', () => {
    it('should calculate correct percentage for full coverage', () => {
      render(
        <CriteriaCoverage
          {...defaultProps}
          criteriaChecked={50}
          criteriaTotal={50}
        />
      );

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should calculate correct percentage for zero coverage', () => {
      render(
        <CriteriaCoverage
          {...defaultProps}
          criteriaChecked={0}
          criteriaTotal={50}
        />
      );

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle zero total gracefully', () => {
      render(
        <CriteriaCoverage
          {...defaultProps}
          criteriaChecked={0}
          criteriaTotal={0}
        />
      );

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should round percentage correctly', () => {
      render(
        <CriteriaCoverage
          {...defaultProps}
          criteriaChecked={1}
          criteriaTotal={3}
        />
      );

      // 1/3 = 33.33% -> rounds to 33%
      expect(screen.getByText('33%')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should render with only required props', () => {
      render(
        <CriteriaCoverage
          criteriaChecked={10}
          criteriaTotal={50}
          wcagLevel="AA"
        />
      );

      expect(screen.getByText('10 of 50')).toBeInTheDocument();
    });

    it('should handle missing breakdown values', async () => {
      const user = userEvent.setup();

      render(
        <CriteriaCoverage
          criteriaChecked={10}
          criteriaTotal={50}
          wcagLevel="AA"
        />
      );

      const button = screen.getByRole('button');
      await user.hover(button);

      await waitFor(() => {
        // Should still show the header and total
        expect(screen.getByText('WCAG 2.1 Level AA Coverage')).toBeInTheDocument();
        expect(screen.getByText('Total: 10 of 50 criteria checked')).toBeInTheDocument();
      });
    });

    it('should handle very high coverage percentage', () => {
      render(
        <CriteriaCoverage
          {...defaultProps}
          criteriaChecked={49}
          criteriaTotal={50}
        />
      );

      expect(screen.getByText('98%')).toBeInTheDocument();
    });
  });
});
