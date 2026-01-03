import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { getSeverityColors, type Severity } from "@/lib/severity-colors"
import { getStatusColors, type Status } from "@/lib/status-colors"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Severity variants (requirement 10.1)
        critical:
          "border-transparent bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 hover:bg-red-100/80 dark:hover:bg-red-900/30",
        serious:
          "border-transparent bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 hover:bg-orange-100/80 dark:hover:bg-orange-900/30",
        moderate:
          "border-transparent bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-100/80 dark:hover:bg-yellow-900/30",
        minor:
          "border-transparent bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 hover:bg-blue-100/80 dark:hover:bg-blue-900/30",
        // Status variants (requirement 10.2)
        pending:
          "border-transparent bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-gray-900/30",
        running:
          "border-transparent bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 hover:bg-blue-100/80 dark:hover:bg-blue-900/30",
        completed:
          "border-transparent bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 hover:bg-green-100/80 dark:hover:bg-green-900/30",
        failed:
          "border-transparent bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 hover:bg-red-100/80 dark:hover:bg-red-900/30",
        cancelled:
          "border-transparent bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-gray-900/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
