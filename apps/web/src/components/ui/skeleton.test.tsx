/**
 * Unit tests for Skeleton component
 *
 * Tests:
 * - All variants (text, circular, rectangular, card)
 * - Animation modes (pulse, wave, none)
 * - Skeleton variant components (IssueCardSkeleton, HistoryItemSkeleton, BatchUrlSkeleton, ResultsSummarySkeleton)
 * - Reduced-motion styles
 * - Custom width/height props
 * - ClassName prop merging
 * - Accessibility features
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  IssueCardSkeleton,
  HistoryItemSkeleton,
  BatchUrlSkeleton,
  ResultsSummarySkeleton,
} from './skeleton';

describe('Skeleton', () => {
  describe('Rendering', () => {
    it('should render with default props', () => {
      const { container } = render(<Skeleton />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton).toBeInTheDocument();
    });

    it('should have proper ARIA attributes', () => {
      const { container } = render(<Skeleton />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton).toHaveAttribute('aria-live', 'polite');
      expect(skeleton).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Variants', () => {
    it('should render text variant correctly', () => {
      const { container } = render(<Skeleton variant="text" />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton?.className).toContain('h-4');
      expect(skeleton?.className).toContain('w-full');
      expect(skeleton?.className).toContain('rounded');
    });

    it('should render circular variant correctly', () => {
      const { container } = render(<Skeleton variant="circular" />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton?.className).toContain('rounded-full');
      expect(skeleton?.className).toContain('aspect-square');
    });

    it('should render rectangular variant correctly', () => {
      const { container } = render(<Skeleton variant="rectangular" />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton?.className).toContain('w-full');
    });

    it('should render card variant correctly', () => {
      const { container } = render(<Skeleton variant="card" />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton?.className).toContain('w-full');
      expect(skeleton?.className).toContain('h-32');
      expect(skeleton?.className).toContain('rounded-lg');
    });

    it('should apply default variant when not specified', () => {
      const { container } = render(<Skeleton />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton?.className).toContain('w-full');
    });
  });

  describe('Animation modes', () => {
    it('should render pulse animation by default', () => {
      const { container } = render(<Skeleton />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton?.className).toContain('animate-pulse');
    });

    it('should render wave animation correctly', () => {
      const { container } = render(<Skeleton animation="wave" />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton?.className).toContain('animate-shimmer');
      expect(skeleton?.className).toContain('bg-gradient-to-r');
    });

    it('should render no animation when specified', () => {
      const { container } = render(<Skeleton animation="none" />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton?.className).not.toContain('animate-pulse');
      expect(skeleton?.className).not.toContain('animate-shimmer');
    });

    it('should combine variant and animation classes', () => {
      const { container } = render(<Skeleton variant="text" animation="wave" />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton?.className).toContain('h-4');
      expect(skeleton?.className).toContain('animate-shimmer');
    });
  });

  describe('Reduced motion styles', () => {
    it('should apply reduced motion classes', () => {
      const { container } = render(<Skeleton />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton?.className).toContain('motion-reduce:animate-none');
      expect(skeleton?.className).toContain('motion-reduce:bg-muted');
    });

    it('should apply reduced motion classes with wave animation', () => {
      const { container } = render(<Skeleton animation="wave" />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton?.className).toContain('motion-reduce:animate-none');
      expect(skeleton?.className).toContain('motion-reduce:bg-muted');
    });

    it('should apply reduced motion classes with all variants', () => {
      const variants = ['text', 'circular', 'rectangular', 'card'] as const;

      variants.forEach((variant) => {
        const { container } = render(<Skeleton variant={variant} />);

        const skeleton = container.querySelector('div[aria-busy="true"]');
        expect(skeleton?.className).toContain('motion-reduce:animate-none');
        expect(skeleton?.className).toContain('motion-reduce:bg-muted');
      });
    });
  });

  describe('Custom width and height props', () => {
    it('should apply custom width as string', () => {
      const { container } = render(<Skeleton width="200px" />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton).toHaveStyle({ width: '200px' });
    });

    it('should apply custom height as string', () => {
      const { container } = render(<Skeleton height="100px" />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton).toHaveStyle({ height: '100px' });
    });

    it('should apply custom width as number (pixels)', () => {
      const { container } = render(<Skeleton width={250} />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton).toHaveStyle({ width: '250px' });
    });

    it('should apply custom height as number (pixels)', () => {
      const { container } = render(<Skeleton height={150} />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton).toHaveStyle({ height: '150px' });
    });

    it('should apply both custom width and height', () => {
      const { container } = render(<Skeleton width="300px" height="200px" />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton).toHaveStyle({ width: '300px', height: '200px' });
    });

    it('should support percentage values for width', () => {
      const { container } = render(<Skeleton width="50%" />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton).toHaveStyle({ width: '50%' });
    });

    it('should preserve existing style prop when applying dimensions', () => {
      const { container } = render(
        <Skeleton width={200} style={{ marginTop: '10px' }} />
      );

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton).toHaveStyle({ width: '200px', marginTop: '10px' });
    });
  });

  describe('ClassName prop merging', () => {
    it('should merge custom className with default classes', () => {
      const { container } = render(<Skeleton className="custom-class" />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton?.className).toContain('custom-class');
      expect(skeleton?.className).toContain('bg-muted');
    });

    it('should merge className with variant classes', () => {
      const { container } = render(
        <Skeleton variant="text" className="my-custom-class" />
      );

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton?.className).toContain('my-custom-class');
      expect(skeleton?.className).toContain('h-4');
    });

    it('should allow overriding default classes', () => {
      const { container } = render(<Skeleton className="bg-blue-200" />);

      const skeleton = container.querySelector('div[aria-busy="true"]');
      expect(skeleton?.className).toContain('bg-blue-200');
    });
  });

  describe('Additional HTML attributes', () => {
    it('should support data attributes', () => {
      const { container } = render(<Skeleton data-testid="my-skeleton" />);

      const skeleton = container.querySelector('[data-testid="my-skeleton"]');
      expect(skeleton).toBeInTheDocument();
    });

    it('should support id attribute', () => {
      const { container } = render(<Skeleton id="skeleton-1" />);

      const skeleton = container.querySelector('#skeleton-1');
      expect(skeleton).toBeInTheDocument();
    });

    it('should support role attribute', () => {
      const { container } = render(<Skeleton role="status" />);

      const skeleton = container.querySelector('[role="status"]');
      expect(skeleton).toBeInTheDocument();
    });
  });
});

describe('IssueCardSkeleton', () => {
  it('should render issue card skeleton structure', () => {
    const { container } = render(<IssueCardSkeleton />);

    // Check for border and card styling
    const card = container.querySelector('.border.rounded-lg');
    expect(card).toBeInTheDocument();
    expect(card?.className).toContain('border-l-4');
    expect(card?.className).toContain('bg-card');
  });

  it('should render badge skeleton', () => {
    const { container } = render(<IssueCardSkeleton />);

    const badge = container.querySelector('.h-6.w-20');
    expect(badge).toBeInTheDocument();
  });

  it('should render title skeleton', () => {
    const { container } = render(<IssueCardSkeleton />);

    const title = container.querySelector('.h-5.flex-1');
    expect(title).toBeInTheDocument();
  });

  it('should render WCAG info skeleton', () => {
    const { container } = render(<IssueCardSkeleton />);

    const info = container.querySelector('.h-4.w-64');
    expect(info).toBeInTheDocument();
  });

  it('should render chevron icon skeleton', () => {
    const { container } = render(<IssueCardSkeleton />);

    const chevron = container.querySelector('.h-5.w-5');
    expect(chevron).toBeInTheDocument();
  });

  it('should have proper flexbox layout', () => {
    const { container } = render(<IssueCardSkeleton />);

    const layout = container.querySelector('.flex.justify-between.items-start');
    expect(layout).toBeInTheDocument();
  });
});

describe('HistoryItemSkeleton', () => {
  it('should render history item skeleton structure', () => {
    const { container } = render(<HistoryItemSkeleton />);

    const card = container.querySelector('.border.rounded-lg');
    expect(card).toBeInTheDocument();
  });

  it('should render URL/title skeleton', () => {
    const { container } = render(<HistoryItemSkeleton />);

    const url = container.querySelector('.h-5.flex-1.max-w-md');
    expect(url).toBeInTheDocument();
  });

  it('should render batch badge skeleton', () => {
    const { container } = render(<HistoryItemSkeleton />);

    const badge = container.querySelector('.h-5.w-24.shrink-0');
    expect(badge).toBeInTheDocument();
  });

  it('should render date + WCAG level skeleton', () => {
    const { container } = render(<HistoryItemSkeleton />);

    const date = container.querySelector('.h-4.w-48');
    expect(date).toBeInTheDocument();
  });

  it('should render batch completion info skeleton', () => {
    const { container } = render(<HistoryItemSkeleton />);

    const completion = container.querySelector('.h-4.w-40');
    expect(completion).toBeInTheDocument();
  });

  it('should render issue count skeleton', () => {
    const { container } = render(<HistoryItemSkeleton />);

    const issueCount = container.querySelector('.h-4.w-16');
    expect(issueCount).toBeInTheDocument();
  });

  it('should render status badge skeleton', () => {
    const { container } = render(<HistoryItemSkeleton />);

    const statusBadge = container.querySelector('.h-6.w-20');
    expect(statusBadge).toBeInTheDocument();
  });

  it('should have proper responsive layout', () => {
    const { container } = render(<HistoryItemSkeleton />);

    const layout = container.querySelector('.flex.justify-between.items-start');
    expect(layout).toBeInTheDocument();

    const leftSection = container.querySelector('.min-w-0.flex-1');
    expect(leftSection).toBeInTheDocument();
  });
});

describe('BatchUrlSkeleton', () => {
  it('should render batch URL skeleton structure', () => {
    const { container } = render(<BatchUrlSkeleton />);

    const card = container.querySelector('.border.rounded-lg');
    expect(card).toBeInTheDocument();
    expect(card?.className).toContain('bg-card');
  });

  it('should render page title skeleton', () => {
    const { container } = render(<BatchUrlSkeleton />);

    const title = container.querySelector('.h-4.max-w-sm');
    expect(title).toBeInTheDocument();
  });

  it('should render URL skeleton', () => {
    const { container } = render(<BatchUrlSkeleton />);

    const url = container.querySelector('.h-4.max-w-md');
    expect(url).toBeInTheDocument();
  });

  it('should render status badge skeleton', () => {
    const { container } = render(<BatchUrlSkeleton />);

    const status = container.querySelector('.h-6.w-20');
    expect(status).toBeInTheDocument();
  });

  it('should render issue count skeleton', () => {
    const { container } = render(<BatchUrlSkeleton />);

    const issueCount = container.querySelector('.h-4.w-24');
    expect(issueCount).toBeInTheDocument();
  });

  it('should render chevron icon skeleton', () => {
    const { container } = render(<BatchUrlSkeleton />);

    const chevron = container.querySelector('.h-5.w-5');
    expect(chevron).toBeInTheDocument();
  });

  it('should have proper flexbox layout with min-width', () => {
    const { container } = render(<BatchUrlSkeleton />);

    const layout = container.querySelector('.flex.justify-between.items-start');
    expect(layout).toBeInTheDocument();

    const content = container.querySelector('.flex-1.min-w-0');
    expect(content).toBeInTheDocument();
  });
});

describe('ResultsSummarySkeleton', () => {
  it('should render results summary skeleton structure', () => {
    const { container } = render(<ResultsSummarySkeleton />);

    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid?.className).toContain('grid-cols-1');
    expect(grid?.className).toContain('sm:grid-cols-2');
    expect(grid?.className).toContain('lg:grid-cols-4');
  });

  it('should render 4 severity cards', () => {
    const { container } = render(<ResultsSummarySkeleton />);

    const cards = container.querySelectorAll('.p-4.rounded-lg.border');
    expect(cards).toHaveLength(4);
  });

  it('should render critical card with red styling', () => {
    const { container } = render(<ResultsSummarySkeleton />);

    const criticalCard = container.querySelector('.border-red-200.bg-red-50');
    expect(criticalCard).toBeInTheDocument();
  });

  it('should render serious card with orange styling', () => {
    const { container } = render(<ResultsSummarySkeleton />);

    const seriousCard = container.querySelector('.border-orange-200.bg-orange-50');
    expect(seriousCard).toBeInTheDocument();
  });

  it('should render moderate card with yellow styling', () => {
    const { container } = render(<ResultsSummarySkeleton />);

    const moderateCard = container.querySelector('.border-yellow-200.bg-yellow-50');
    expect(moderateCard).toBeInTheDocument();
  });

  it('should render minor card with blue styling', () => {
    const { container } = render(<ResultsSummarySkeleton />);

    const minorCard = container.querySelector('.border-blue-200.bg-blue-50');
    expect(minorCard).toBeInTheDocument();
  });

  it('should render count skeletons in each card', () => {
    const { container } = render(<ResultsSummarySkeleton />);

    const counts = container.querySelectorAll('.h-8.w-16');
    expect(counts).toHaveLength(4);
  });

  it('should render label skeletons in each card', () => {
    const { container } = render(<ResultsSummarySkeleton />);

    const labels = container.querySelectorAll('.h-4.w-20');
    expect(labels).toHaveLength(4);
  });

  it('should have gap between cards', () => {
    const { container } = render(<ResultsSummarySkeleton />);

    const grid = container.querySelector('.grid');
    expect(grid?.className).toContain('gap-4');
  });

  it('should have proper responsive grid layout', () => {
    const { container } = render(<ResultsSummarySkeleton />);

    const grid = container.querySelector('.grid');
    expect(grid?.className).toContain('grid-cols-1');
    expect(grid?.className).toContain('sm:grid-cols-2');
    expect(grid?.className).toContain('lg:grid-cols-4');
  });
});

describe('Skeleton variants integration', () => {
  it('should all skeleton variants support reduced motion', () => {
    const variants = [
      <IssueCardSkeleton key="issue" />,
      <HistoryItemSkeleton key="history" />,
      <BatchUrlSkeleton key="batch" />,
      <ResultsSummarySkeleton key="results" />,
    ];

    variants.forEach((variant) => {
      const { container } = render(variant);

      // All skeletons should have motion-reduce classes
      const skeletons = container.querySelectorAll('[aria-busy="true"]');
      skeletons.forEach((skeleton) => {
        expect(skeleton.className).toContain('motion-reduce:animate-none');
      });
    });
  });

  it('should all skeleton variants have proper ARIA attributes', () => {
    const variants = [
      <IssueCardSkeleton key="issue" />,
      <HistoryItemSkeleton key="history" />,
      <BatchUrlSkeleton key="batch" />,
      <ResultsSummarySkeleton key="results" />,
    ];

    variants.forEach((variant) => {
      const { container } = render(variant);

      // All skeletons should have proper ARIA attributes
      const skeletons = container.querySelectorAll('[aria-busy="true"]');
      expect(skeletons.length).toBeGreaterThan(0);

      skeletons.forEach((skeleton) => {
        expect(skeleton).toHaveAttribute('aria-live', 'polite');
        expect(skeleton).toHaveAttribute('aria-busy', 'true');
      });
    });
  });
});
