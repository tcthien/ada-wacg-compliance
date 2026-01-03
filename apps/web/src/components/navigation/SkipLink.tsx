import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkipLinkProps {
  /**
   * The ID of the target element to skip to
   * @default "main-content"
   */
  targetId?: string;
  /**
   * The text to display in the skip link
   * @default "Skip to main content"
   */
  children?: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * SkipLink component for keyboard accessibility (WCAG 2.4.1)
 *
 * Provides a "Skip to main content" link that:
 * - Is the first focusable element on the page
 * - Visually hidden until focused (sr-only pattern)
 * - Moves focus to main content when activated
 * - Meets WCAG 2.2 AA requirements (2.4.1 Bypass Blocks)
 *
 * @example
 * ```tsx
 * <SkipLink targetId="main-content">Skip to main content</SkipLink>
 * ```
 */
export const SkipLink = React.forwardRef<HTMLAnchorElement, SkipLinkProps>(
  ({ targetId = "main-content", children = "Skip to main content", className }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();

      const target = document.getElementById(targetId);
      if (target) {
        // Move focus to the target element
        target.focus();

        // Ensure the element is focusable
        // If it's not naturally focusable, add tabindex="-1"
        if (!target.hasAttribute('tabindex')) {
          target.setAttribute('tabindex', '-1');
        }

        // Scroll the target into view
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    return (
      <a
        ref={ref}
        href={`#${targetId}`}
        onClick={handleClick}
        className={cn(
          // Screen reader only by default (visually hidden)
          "sr-only",
          // Make visible when focused
          "focus:not-sr-only",
          // Position and styling when visible
          "focus:absolute focus:top-4 focus:left-4 focus:z-50",
          // Visual styling
          "focus:bg-white focus:text-gray-900",
          "focus:px-4 focus:py-2",
          // WCAG 2.5.5: Touch target minimum 44x44px
          "focus:min-h-[44px] focus:min-w-[44px]",
          // Focus indicator (WCAG 2.4.7)
          "focus:ring-2 focus:ring-primary focus:ring-offset-2",
          "focus:outline-none",
          // Additional styling for better visibility
          "focus:rounded-md focus:shadow-lg",
          "focus:font-medium focus:text-sm",
          // Transition for smooth appearance
          "transition-all duration-150",
          className
        )}
      >
        {children}
      </a>
    );
  }
);

SkipLink.displayName = "SkipLink";
