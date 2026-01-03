'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Props for BackButton component
 */
export interface BackButtonProps {
  /**
   * The href to navigate to when clicked.
   * Defaults to '/history' for scan/batch detail pages.
   */
  href?: string;

  /**
   * The tooltip label to display on hover.
   * Defaults to 'Back to History'.
   */
  label?: string;

  /**
   * Whether to use browser history navigation instead of router.push.
   * When true, uses router.back() to navigate to the previous page.
   * Defaults to false.
   */
  useBrowserBack?: boolean;
}

/**
 * BackButton Component
 *
 * A consistent back navigation button for detail pages that returns users to
 * the appropriate listing or history page.
 *
 * Features:
 * - Icon button with ArrowLeft icon
 * - Tooltip showing destination on hover
 * - Supports both programmatic navigation (router.push) and browser back
 * - WCAG compliant with proper aria-label and focus states
 * - Follows existing design patterns from BatchDetailHeader
 *
 * Requirements:
 * - REQ 2.1: Display back button on scan detail pages
 * - REQ 2.2: Display back button on batch detail pages
 * - REQ 2.3: Navigate to /history by default
 * - REQ 2.4: Support returning to originating page with useBrowserBack
 * - REQ 2.5: Show tooltip on hover indicating destination
 *
 * @example
 * ```tsx
 * // Default: navigate to /history
 * <BackButton />
 *
 * // Custom destination
 * <BackButton href="/admin/scans" label="Back to Scans" />
 *
 * // Use browser back navigation
 * <BackButton useBrowserBack label="Back to Previous Page" />
 * ```
 */
export function BackButton({
  href = '/history',
  label = 'Back to History',
  useBrowserBack = false,
}: BackButtonProps) {
  const router = useRouter();

  /**
   * Handle back button click
   * Uses browser history if useBrowserBack is true, otherwise navigates to href
   */
  const handleClick = () => {
    if (useBrowserBack) {
      router.back();
    } else {
      router.push(href);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick}
            aria-label={label}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
