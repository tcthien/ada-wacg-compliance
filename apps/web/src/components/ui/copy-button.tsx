"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CopyFallbackModal } from "@/components/ui/copy-fallback-modal";

/**
 * Copies text to clipboard using the Clipboard API
 * @param text - The text to copy
 * @returns Promise<{ success: boolean; isSecurityError: boolean }> - Success status and error type
 */
async function copyToClipboard(
  text: string
): Promise<{ success: boolean; isSecurityError: boolean }> {
  try {
    await navigator.clipboard.writeText(text);
    return { success: true, isSecurityError: false };
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    const isSecurityError =
      error instanceof DOMException &&
      (error.name === "SecurityError" || error.name === "NotAllowedError");
    return { success: false, isSecurityError };
  }
}

const copyButtonVariants = cva("relative", {
  variants: {
    variant: {
      icon: "",
      button: "",
      inline: "inline-flex items-center gap-1",
    },
    size: {
      sm: "",
      md: "",
      lg: "",
    },
  },
  defaultVariants: {
    variant: "button",
    size: "md",
  },
});

export interface CopyButtonProps
  extends Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      "onClick" | "size" | "variant" | "onError"
    >,
    VariantProps<typeof copyButtonVariants> {
  /** The text to copy to clipboard */
  text: string;
  /** Optional label to display (for button and inline variants) */
  label?: string;
  /** Callback fired when copy is successful */
  onCopy?: () => void;
  /** Callback fired when copy fails */
  onError?: (error: Error) => void;
  /** Duration to show success state in milliseconds */
  successDuration?: number;
}

const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      className,
      variant = "button",
      size = "md",
      text,
      label,
      onCopy,
      onError,
      successDuration = 2000,
      disabled,
      ...props
    },
    ref
  ) => {
    const [isCopied, setIsCopied] = React.useState(false);
    const [showFallbackModal, setShowFallbackModal] = React.useState(false);
    const timeoutRef = React.useRef<NodeJS.Timeout>();

    // Cleanup timeout on unmount
    React.useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    const handleCopy = async () => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const { success, isSecurityError } = await copyToClipboard(text);

      if (success) {
        setIsCopied(true);
        onCopy?.();

        // Reset copied state after duration
        timeoutRef.current = setTimeout(() => {
          setIsCopied(false);
        }, successDuration);
      } else {
        // Show fallback modal if clipboard access was denied
        if (isSecurityError) {
          setShowFallbackModal(true);
        } else {
          const error = new Error("Failed to copy to clipboard");
          onError?.(error);
        }
      }
    };

    // Map variant to button variant
    const getButtonVariant = () => {
      if (variant === "icon") return "ghost";
      if (variant === "inline") return "ghost";
      return "outline";
    };

    // Map size to button size
    const getButtonSize = (): "default" | "sm" | "lg" | "icon" => {
      if (variant === "icon") return "icon";
      if (size === "md") return "default";
      return size || "default";
    };

    const icon = isCopied ? (
      <Check className="h-4 w-4" />
    ) : (
      <Copy className="h-4 w-4" />
    );

    return (
      <>
        <div className={cn(copyButtonVariants({ variant }), className)}>
          <Button
            ref={ref}
            variant={getButtonVariant()}
            size={getButtonSize()}
            onClick={handleCopy}
            disabled={disabled}
            aria-label={isCopied ? "Copied" : label || "Copy to clipboard"}
            {...props}
          >
            {variant === "icon" ? (
              icon
            ) : (
              <>
                {icon}
                {variant === "inline" && (label || (isCopied ? "Copied!" : "Copy"))}
                {variant === "button" && (label || "Copy")}
              </>
            )}
          </Button>

          {/* Tooltip for success state */}
          {isCopied && variant === "icon" && (
            <span
              className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-primary px-2 py-1 text-xs text-primary-foreground shadow-md"
              role="status"
              aria-live="polite"
            >
              Copied!
            </span>
          )}
        </div>

        {/* Fallback modal for clipboard permission denied */}
        <CopyFallbackModal
          isOpen={showFallbackModal}
          onClose={() => setShowFallbackModal(false)}
          text={text}
        />
      </>
    );
  }
);
CopyButton.displayName = "CopyButton";

export { CopyButton, copyToClipboard };
