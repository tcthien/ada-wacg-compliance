'use client';

import { useNavigationProgress } from '@/hooks/useNavigationProgress';

/**
 * NavigationProgress Component
 *
 * Displays a thin progress bar at the top of the viewport during page transitions.
 *
 * Features:
 * - Shows loading indicator within 200ms if navigation is not complete (Req 9.1)
 * - Displays progress bar when transition exceeds 500ms (Req 9.2)
 * - Removes indicator immediately when navigation completes (Req 9.3)
 * - Uses indeterminate animation to show activity
 * - Respects prefers-reduced-motion for accessibility
 * - Fixed positioning at top of viewport
 * - Blue gradient with 2px height
 *
 * @example
 * ```tsx
 * <NavigationProgress />
 * ```
 */
export function NavigationProgress() {
  const { isNavigating } = useNavigationProgress();

  if (!isNavigating) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500"
      role="progressbar"
      aria-label="Page navigation in progress"
      aria-valuetext="Loading"
    >
      <div
        className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-navigation-progress motion-reduce:animate-none"
        aria-hidden="true"
      />
    </div>
  );
}

NavigationProgress.displayName = 'NavigationProgress';
