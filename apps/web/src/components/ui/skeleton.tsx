import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const skeletonVariants = cva(
  "relative overflow-hidden rounded-md bg-muted",
  {
    variants: {
      variant: {
        text: "h-4 w-full rounded",
        circular: "rounded-full aspect-square",
        rectangular: "w-full",
        card: "w-full h-32 rounded-lg",
      },
      animation: {
        pulse: "animate-pulse",
        wave: "animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%]",
        none: "",
      },
    },
    defaultVariants: {
      variant: "rectangular",
      animation: "pulse",
    },
  }
)

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  width?: string | number;
  height?: string | number;
}

function Skeleton({
  className,
  variant,
  animation,
  width,
  height,
  style,
  ...props
}: SkeletonProps) {
  const inlineStyles: React.CSSProperties = {
    ...style,
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height }),
  }

  return (
    <div
      className={cn(
        skeletonVariants({ variant, animation }),
        // Respect reduced motion preferences
        "motion-reduce:animate-none motion-reduce:bg-muted",
        className
      )}
      style={inlineStyles}
      aria-live="polite"
      aria-busy="true"
      {...props}
    />
  )
}

// ============================================================
// Skeleton Variants for Common Layouts
// ============================================================

/**
 * IssueCardSkeleton
 *
 * Matches IssueCard layout:
 * - Border with left accent
 * - Badge + title on top
 * - WCAG info and instance count below
 * - Chevron icon on right
 */
export function IssueCardSkeleton() {
  return (
    <div className="border rounded-lg border-l-4 border-l-gray-300 bg-card p-4">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 space-y-2">
          {/* Badge + Title row */}
          <div className="flex items-start gap-3">
            <Skeleton variant="rectangular" className="h-6 w-20" />
            <Skeleton variant="text" className="h-5 flex-1" />
          </div>

          {/* WCAG info + instance count */}
          <Skeleton variant="text" className="h-4 w-64" />
        </div>

        {/* Chevron icon */}
        <Skeleton variant="rectangular" className="h-5 w-5" />
      </div>
    </div>
  );
}

/**
 * HistoryItemSkeleton
 *
 * Matches HistoryCard layout:
 * - URL/title with optional batch badge
 * - Date + WCAG level info
 * - Optional batch completion info
 * - Status badge and issue count on right
 */
export function HistoryItemSkeleton() {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          {/* URL/Title + Optional batch badge */}
          <div className="flex items-center gap-2">
            <Skeleton variant="text" className="h-5 flex-1 max-w-md" />
            <Skeleton variant="rectangular" className="h-5 w-24 shrink-0" />
          </div>

          {/* Date + WCAG level */}
          <Skeleton variant="text" className="h-4 w-48" />

          {/* Optional batch completion info */}
          <Skeleton variant="text" className="h-4 w-40" />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Issue count */}
          <Skeleton variant="text" className="h-4 w-16" />

          {/* Status badge */}
          <Skeleton variant="rectangular" className="h-6 w-20" />
        </div>
      </div>
    </div>
  );
}

/**
 * BatchUrlSkeleton
 *
 * Matches BatchUrlList UrlCard layout:
 * - Page title (optional)
 * - URL
 * - Status badge + issue count
 * - Chevron icon
 */
export function BatchUrlSkeleton() {
  return (
    <div className="border rounded-lg border-gray-300 bg-card p-4">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Page title (optional) */}
          <Skeleton variant="text" className="h-4 max-w-sm" />

          {/* URL */}
          <Skeleton variant="text" className="h-4 max-w-md" />

          {/* Status + issue count */}
          <div className="flex items-center gap-3">
            <Skeleton variant="rectangular" className="h-6 w-20" />
            <Skeleton variant="text" className="h-4 w-24" />
          </div>
        </div>

        {/* Chevron icon */}
        <Skeleton variant="rectangular" className="h-5 w-5" />
      </div>
    </div>
  );
}

/**
 * ResultsSummarySkeleton
 *
 * Matches 4-card grid layout showing severity counts:
 * - Critical, Serious, Moderate, Minor cards
 * - Each card has a count and label
 */
export function ResultsSummarySkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Critical */}
      <div className="p-4 rounded-lg border border-red-200 bg-red-50">
        <Skeleton variant="text" className="h-8 w-16 mb-2" />
        <Skeleton variant="text" className="h-4 w-20" />
      </div>

      {/* Serious */}
      <div className="p-4 rounded-lg border border-orange-200 bg-orange-50">
        <Skeleton variant="text" className="h-8 w-16 mb-2" />
        <Skeleton variant="text" className="h-4 w-20" />
      </div>

      {/* Moderate */}
      <div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50">
        <Skeleton variant="text" className="h-8 w-16 mb-2" />
        <Skeleton variant="text" className="h-4 w-20" />
      </div>

      {/* Minor */}
      <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
        <Skeleton variant="text" className="h-8 w-16 mb-2" />
        <Skeleton variant="text" className="h-4 w-20" />
      </div>
    </div>
  );
}

export { Skeleton, skeletonVariants }
