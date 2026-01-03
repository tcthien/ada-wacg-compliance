"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

export interface Step {
  id: string
  label: string
  description?: string
}

const stepIndicatorVariants = cva(
  "step-indicator transition-all duration-300 ease-in-out",
  {
    variants: {
      variant: {
        horizontal: "flex items-start",
        vertical: "flex flex-col space-y-4",
      },
      size: {
        sm: "",
        md: "",
        lg: "",
      },
    },
    defaultVariants: {
      variant: "horizontal",
      size: "md",
    },
  }
)

const stepCircleVariants = cva(
  "flex items-center justify-center rounded-full border-2 font-medium transition-all duration-300 ease-in-out shrink-0",
  {
    variants: {
      state: {
        completed: "bg-primary border-primary text-primary-foreground",
        current: "bg-background border-primary text-primary animate-pulse",
        upcoming: "bg-background border-muted-foreground/30 text-muted-foreground",
      },
      size: {
        sm: "h-6 w-6 text-xs",
        md: "h-8 w-8 text-sm",
        lg: "h-10 w-10 text-base",
      },
    },
    defaultVariants: {
      state: "upcoming",
      size: "md",
    },
  }
)

const stepLineVariants = cva(
  "transition-all duration-300 ease-in-out",
  {
    variants: {
      variant: {
        horizontal: "h-0.5 flex-1 mx-2",
        vertical: "w-0.5 h-8 ml-3",
      },
      state: {
        completed: "bg-primary",
        upcoming: "bg-muted-foreground/30",
      },
    },
    defaultVariants: {
      variant: "horizontal",
      state: "upcoming",
    },
  }
)

const stepLabelVariants = cva(
  "transition-all duration-300 ease-in-out",
  {
    variants: {
      state: {
        completed: "text-foreground font-medium",
        current: "text-primary font-semibold",
        upcoming: "text-muted-foreground",
      },
      size: {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
      },
    },
    defaultVariants: {
      state: "upcoming",
      size: "md",
    },
  }
)

export interface StepIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stepIndicatorVariants> {
  steps: Step[]
  currentStep: number
  showLabels?: boolean
  onStepClick?: (stepIndex: number) => void
  allowNavigation?: boolean
}

const StepIndicator = React.forwardRef<HTMLDivElement, StepIndicatorProps>(
  (
    {
      steps,
      currentStep,
      variant = "horizontal",
      size = "md",
      showLabels = true,
      onStepClick,
      allowNavigation = false,
      className,
      ...props
    },
    ref
  ) => {
    const getStepState = (index: number): "completed" | "current" | "upcoming" => {
      if (index < currentStep) return "completed"
      if (index === currentStep) return "current"
      return "upcoming"
    }

    const handleStepClick = (index: number) => {
      if (allowNavigation && onStepClick && index <= currentStep) {
        onStepClick(index)
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
      if (!allowNavigation || !onStepClick) return

      const isHorizontal = variant === "horizontal"
      const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown"
      const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp"

      if (e.key === nextKey && index < currentStep && index < steps.length - 1) {
        e.preventDefault()
        onStepClick(index + 1)
        // Focus next step
        const nextElement = e.currentTarget.nextElementSibling?.nextElementSibling as HTMLElement
        nextElement?.focus()
      } else if (e.key === prevKey && index > 0 && index <= currentStep) {
        e.preventDefault()
        onStepClick(index - 1)
        // Focus previous step
        const prevElement = e.currentTarget.previousElementSibling?.previousElementSibling as HTMLElement
        prevElement?.focus()
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleStepClick(index)
      }
    }

    return (
      <div
        ref={ref}
        className={cn(stepIndicatorVariants({ variant, size, className }))}
        role="navigation"
        aria-label="Progress steps"
        {...props}
      >
        {steps.map((step, index) => {
          const state = getStepState(index)
          const isClickable = allowNavigation && index <= currentStep
          const isLast = index === steps.length - 1

          return (
            <React.Fragment key={step.id}>
              <div
                className={cn(
                  "flex items-center",
                  variant === "vertical" && "w-full",
                  variant === "horizontal" && "flex-col items-center"
                )}
              >
                <div className="flex items-center">
                  <div
                    role="button"
                    tabIndex={isClickable ? 0 : -1}
                    aria-current={state === "current" ? "step" : undefined}
                    aria-label={`Step ${index + 1}: ${step.label}`}
                    className={cn(
                      stepCircleVariants({ state, size }),
                      isClickable && "cursor-pointer hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    )}
                    onClick={() => handleStepClick(index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                  >
                    {state === "completed" ? (
                      <Check className={cn(
                        size === "sm" && "h-3 w-3",
                        size === "md" && "h-4 w-4",
                        size === "lg" && "h-5 w-5"
                      )} />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                </div>

                {showLabels && (
                  <div
                    className={cn(
                      variant === "horizontal" && "mt-2 text-center",
                      variant === "vertical" && "ml-3 flex-1"
                    )}
                  >
                    <div className={cn(stepLabelVariants({ state, size }))}>
                      {step.label}
                    </div>
                    {step.description && (
                      <div className={cn(
                        "text-muted-foreground mt-0.5",
                        size === "sm" && "text-[10px]",
                        size === "md" && "text-xs",
                        size === "lg" && "text-sm"
                      )}>
                        {step.description}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!isLast && (
                <div
                  className={cn(
                    stepLineVariants({
                      variant,
                      state: index < currentStep ? "completed" : "upcoming",
                    }),
                    variant === "horizontal" && !showLabels && "self-center"
                  )}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    )
  }
)

StepIndicator.displayName = "StepIndicator"

export { StepIndicator, stepIndicatorVariants, stepCircleVariants, stepLineVariants, stepLabelVariants }
