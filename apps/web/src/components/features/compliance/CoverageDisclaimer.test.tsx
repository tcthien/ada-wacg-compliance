/**
 * Unit tests for CoverageDisclaimer component
 *
 * Tests:
 * - Default (standard) rendering shows 57%
 * - AI-enhanced COMPLETED shows 75-85%
 * - AI PENDING/PROCESSING shows 57% with note
 * - AI FAILED shows 57% with note
 * - AI badge and purple styling for enhanced scans
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  CoverageDisclaimer,
  type CoverageDisclaimerProps,
  type AiStatus,
} from './CoverageDisclaimer';

describe('CoverageDisclaimer', () => {
  describe('Standard scan (no AI)', () => {
    it('should render default 57% coverage message', () => {
      render(<CoverageDisclaimer />);

      expect(screen.getByText(/57%/)).toBeInTheDocument();
      expect(screen.getByText(/Automated testing detects approximately/)).toBeInTheDocument();
    });

    it('should show amber styling for standard scan', () => {
      const { container } = render(<CoverageDisclaimer />);

      const wrapper = container.querySelector('.bg-amber-50');
      expect(wrapper).toBeInTheDocument();
    });

    it('should not show AI-Enhanced badge for standard scan', () => {
      render(<CoverageDisclaimer />);

      expect(screen.queryByText('AI-Enhanced')).not.toBeInTheDocument();
    });

    it('should show axe-core description for standard scan', () => {
      render(<CoverageDisclaimer />);

      expect(screen.getByText(/This tool uses industry-standard automated testing/)).toBeInTheDocument();
      expect(screen.getByText(/axe-core/)).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<CoverageDisclaimer className="custom-class" />);

      const wrapper = container.querySelector('.custom-class');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('AI-enhanced scan (COMPLETED)', () => {
    const aiCompletedProps: CoverageDisclaimerProps = {
      isAiEnhanced: true,
      aiStatus: 'COMPLETED',
    };

    it('should show 75-85% coverage for AI-enhanced completed scan', () => {
      render(<CoverageDisclaimer {...aiCompletedProps} />);

      expect(screen.getByText(/75-85%/)).toBeInTheDocument();
    });

    it('should show AI-enhanced testing message', () => {
      render(<CoverageDisclaimer {...aiCompletedProps} />);

      expect(screen.getByText(/AI-enhanced testing detects approximately/)).toBeInTheDocument();
    });

    it('should show AI-Enhanced badge', () => {
      render(<CoverageDisclaimer {...aiCompletedProps} />);

      expect(screen.getByText('AI-Enhanced')).toBeInTheDocument();
    });

    it('should have AI badge with proper aria-label', () => {
      render(<CoverageDisclaimer {...aiCompletedProps} />);

      const badge = screen.getByRole('status', { name: 'AI-enhanced scan' });
      expect(badge).toBeInTheDocument();
    });

    it('should show purple gradient styling for AI-enhanced scan', () => {
      const { container } = render(<CoverageDisclaimer {...aiCompletedProps} />);

      // Check for purple gradient background
      const wrapper = container.querySelector('.from-purple-50');
      expect(wrapper).toBeInTheDocument();
    });

    it('should show Enhanced Coverage header', () => {
      render(<CoverageDisclaimer {...aiCompletedProps} />);

      expect(screen.getByText('Enhanced Coverage')).toBeInTheDocument();
    });

    it('should show AI-powered description', () => {
      render(<CoverageDisclaimer {...aiCompletedProps} />);

      expect(screen.getByText(/AI-powered analysis/)).toBeInTheDocument();
    });

    it('should show Sparkles icon for AI-enhanced scan', () => {
      const { container } = render(<CoverageDisclaimer {...aiCompletedProps} />);

      // Sparkles icon should be present (lucide-react renders SVG)
      const sparklesIcon = container.querySelector('svg');
      expect(sparklesIcon).toBeInTheDocument();
    });
  });

  describe('AI-enhanced scan (PENDING/PROCESSING)', () => {
    const pendingStatuses: AiStatus[] = ['PENDING', 'DOWNLOADED', 'PROCESSING'];

    pendingStatuses.forEach((status) => {
      describe(`AI status: ${status}`, () => {
        const props: CoverageDisclaimerProps = {
          isAiEnhanced: true,
          aiStatus: status,
        };

        it('should show 57% coverage while processing', () => {
          render(<CoverageDisclaimer {...props} />);

          expect(screen.getByText(/57%/)).toBeInTheDocument();
        });

        it('should show amber styling while processing', () => {
          const { container } = render(<CoverageDisclaimer {...props} />);

          const wrapper = container.querySelector('.bg-amber-50');
          expect(wrapper).toBeInTheDocument();
        });

        it('should show processing note', () => {
          render(<CoverageDisclaimer {...props} />);

          expect(screen.getByText(/AI enhancement is being processed/)).toBeInTheDocument();
          expect(screen.getByText(/Coverage will improve to 75-85%/)).toBeInTheDocument();
        });

        it('should not show AI-Enhanced badge while processing', () => {
          render(<CoverageDisclaimer {...props} />);

          expect(screen.queryByText('AI-Enhanced')).not.toBeInTheDocument();
        });
      });
    });
  });

  describe('AI-enhanced scan (FAILED)', () => {
    const failedProps: CoverageDisclaimerProps = {
      isAiEnhanced: true,
      aiStatus: 'FAILED',
    };

    it('should show 57% coverage when AI failed', () => {
      render(<CoverageDisclaimer {...failedProps} />);

      expect(screen.getByText(/57%/)).toBeInTheDocument();
    });

    it('should show amber styling when AI failed', () => {
      const { container } = render(<CoverageDisclaimer {...failedProps} />);

      const wrapper = container.querySelector('.bg-amber-50');
      expect(wrapper).toBeInTheDocument();
    });

    it('should show failure note', () => {
      render(<CoverageDisclaimer {...failedProps} />);

      expect(screen.getByText(/AI enhancement was not applied/)).toBeInTheDocument();
      expect(screen.getByText(/processing error/)).toBeInTheDocument();
    });

    it('should not show AI-Enhanced badge when failed', () => {
      render(<CoverageDisclaimer {...failedProps} />);

      expect(screen.queryByText('AI-Enhanced')).not.toBeInTheDocument();
    });
  });

  describe('AI enabled but no status', () => {
    it('should show standard 57% when isAiEnhanced is true but no status', () => {
      render(<CoverageDisclaimer isAiEnhanced={true} />);

      expect(screen.getByText(/57%/)).toBeInTheDocument();
    });

    it('should not show any AI status notes when no status provided', () => {
      render(<CoverageDisclaimer isAiEnhanced={true} />);

      expect(screen.queryByText(/AI enhancement is being processed/)).not.toBeInTheDocument();
      expect(screen.queryByText(/AI enhancement was not applied/)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have region role for standard scan', () => {
      render(<CoverageDisclaimer />);

      const region = screen.getByRole('region', { name: 'Scan coverage information' });
      expect(region).toBeInTheDocument();
    });

    it('should have region role for AI-enhanced scan', () => {
      render(<CoverageDisclaimer isAiEnhanced={true} aiStatus="COMPLETED" />);

      const region = screen.getByRole('region', { name: 'Scan coverage information' });
      expect(region).toBeInTheDocument();
    });

    it('should have aria-hidden on decorative icons', () => {
      const { container } = render(<CoverageDisclaimer />);

      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Content verification', () => {
    it('should recommend manual testing for standard scan', () => {
      render(<CoverageDisclaimer />);

      expect(screen.getByText(/Manual testing by accessibility experts is recommended/)).toBeInTheDocument();
    });

    it('should recommend manual testing for AI-enhanced scan', () => {
      render(<CoverageDisclaimer isAiEnhanced={true} aiStatus="COMPLETED" />);

      expect(screen.getByText(/Manual testing by accessibility experts is recommended/)).toBeInTheDocument();
    });

    it('should mention WCAG in both standard and AI-enhanced states', () => {
      const { rerender } = render(<CoverageDisclaimer />);
      expect(screen.getByText(/WCAG issues/)).toBeInTheDocument();

      rerender(<CoverageDisclaimer isAiEnhanced={true} aiStatus="COMPLETED" />);
      expect(screen.getByText(/WCAG issues/)).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined isAiEnhanced', () => {
      render(<CoverageDisclaimer isAiEnhanced={undefined} />);

      expect(screen.getByText(/57%/)).toBeInTheDocument();
    });

    it('should handle false isAiEnhanced explicitly', () => {
      render(<CoverageDisclaimer isAiEnhanced={false} />);

      expect(screen.getByText(/57%/)).toBeInTheDocument();
    });

    it('should handle isAiEnhanced false with aiStatus', () => {
      // Even if aiStatus is provided, if isAiEnhanced is false, treat as standard
      render(<CoverageDisclaimer isAiEnhanced={false} aiStatus="COMPLETED" />);

      expect(screen.getByText(/57%/)).toBeInTheDocument();
      expect(screen.queryByText('AI-Enhanced')).not.toBeInTheDocument();
    });
  });
});
