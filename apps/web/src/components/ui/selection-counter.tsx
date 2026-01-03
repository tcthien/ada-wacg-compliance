"use client"

import * as React from "react"
import { X, CheckSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface SelectionCounterProps {
  /**
   * Number of currently selected items
   */
  selectedCount: number
  /**
   * Total number of items available for selection
   */
  totalCount: number
  /**
   * Callback when Clear Selection is clicked
   */
  onClearSelection: () => void
  /**
   * Callback when Select All is clicked
   */
  onSelectAll: () => void
  /**
   * Whether to use sticky positioning (useful for mobile)
   * @default false
   */
  sticky?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
}

const SelectionCounter = React.forwardRef<HTMLDivElement, SelectionCounterProps>(
  (
    {
      selectedCount,
      totalCount,
      onClearSelection,
      onSelectAll,
      sticky = false,
      className,
    },
    ref
  ) => {
    const isVisible = selectedCount > 0
    const isAllSelected = selectedCount === totalCount

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-between gap-4 rounded-lg border bg-card p-3 shadow-sm transition-all duration-200 ease-in-out",
          sticky && "sticky bottom-4 z-10",
          isVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0",
          className
        )}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-medium">
            <span className="text-primary">{selectedCount}</span> of{" "}
            {totalCount} item{totalCount !== 1 ? "s" : ""} selected
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isAllSelected && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAll}
              className="h-8"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Select All
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-8"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>
    )
  }
)

SelectionCounter.displayName = "SelectionCounter"

export { SelectionCounter }
