"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertTriangle, Info, AlertCircle } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const confirmDialogVariants = cva("", {
  variants: {
    variant: {
      default: "",
      warning: "",
      danger: "",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

export interface ConfirmDialogProps
  extends VariantProps<typeof confirmDialogVariants> {
  /** Controls dialog visibility */
  open: boolean
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void
  /** Dialog title */
  title: string
  /** Dialog description/message */
  description: string
  /** Confirm button label */
  confirmLabel?: string
  /** Cancel button label */
  cancelLabel?: string
  /** Loading state for async confirmations */
  isLoading?: boolean
  /** Callback when confirm button is clicked */
  onConfirm: () => void | Promise<void>
  /** Callback when cancel button is clicked or dialog is dismissed */
  onCancel?: () => void
}

const variantIcons = {
  default: Info,
  warning: AlertTriangle,
  danger: AlertCircle,
}

const variantTitleStyles = {
  default: "text-foreground",
  warning: "text-amber-600 dark:text-amber-500",
  danger: "text-destructive",
}

const variantIconStyles = {
  default: "text-blue-600 dark:text-blue-500",
  warning: "text-amber-600 dark:text-amber-500",
  danger: "text-destructive",
}

/**
 * ConfirmDialog - A confirmation dialog for destructive or important actions
 *
 * Features:
 * - Three variants: default, warning, and danger
 * - Loading state for async confirmations
 * - Focus trap and keyboard escape (handled by Radix Dialog)
 * - Proper ARIA attributes for accessibility
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   variant="danger"
 *   title="Delete Items"
 *   description="Are you sure you want to delete 5 items? This action cannot be undone."
 *   confirmLabel="Delete"
 *   isLoading={isDeleting}
 *   onConfirm={handleDelete}
 *   onCancel={() => setIsOpen(false)}
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  variant = "default",
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const IconComponent = variantIcons[variant || "default"]

  const handleConfirm = async () => {
    await onConfirm()
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                variant === "danger" && "bg-destructive/10",
                variant === "warning" && "bg-amber-100 dark:bg-amber-950",
                variant === "default" && "bg-blue-100 dark:bg-blue-950"
              )}
              aria-hidden="true"
            >
              <IconComponent
                className={cn("h-5 w-5", variantIconStyles[variant || "default"])}
              />
            </div>
            <div className="flex-1 space-y-2">
              <DialogTitle
                className={cn(
                  "text-left",
                  variantTitleStyles[variant || "default"]
                )}
              >
                {title}
              </DialogTitle>
              <DialogDescription className="text-left">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "danger" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
