"use client";

import * as React from "react";
import { Share2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/ui/copy-button";
import { useAnalytics } from "@/hooks/useAnalytics";

/**
 * Generate share URL for scan or batch results
 * @param type - Type of result (scan or batch)
 * @param id - ID of the scan or batch
 * @returns Full share URL with shared=true parameter
 */
function generateShareUrl(type: "scan" | "batch", id: string): string {
  // Get base URL (client-side only)
  if (typeof window === "undefined") {
    return "";
  }

  const baseUrl = window.location.origin;
  return `${baseUrl}/${type}/${id}?shared=true`;
}

const shareButtonVariants = cva("", {
  variants: {
    variant: {
      icon: "",
      button: "",
      inline: "",
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

export interface ShareButtonProps
  extends Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      "onClick" | "type" | "onError" | "onCopy"
    >,
    VariantProps<typeof shareButtonVariants> {
  /** Type of result to share (scan or batch) */
  resultType: "scan" | "batch";
  /** ID of the scan or batch */
  resultId: string;
  /** Optional custom label (defaults to "Share" for button variant) */
  label?: string;
  /** Callback fired when share is successful */
  onShare?: (url: string) => void;
  /** Callback fired when copy fails */
  onError?: (error: Error) => void;
  /** Duration to show success state in milliseconds */
  successDuration?: number;
}

/**
 * ShareButton Component
 *
 * Provides a button to share scan or batch results by copying the share URL to clipboard.
 * Uses CopyButton internally for clipboard functionality and tracks share events with analytics.
 *
 * Features:
 * - Generates share URL with format: /scan/{id}?shared=true or /batch/{id}?shared=true
 * - Supports icon/button/inline variants matching CopyButton API
 * - Tracks share event with analytics (result_shared event)
 * - Provides visual feedback on successful copy
 *
 * @example
 * ```tsx
 * // Icon variant (minimal)
 * <ShareButton resultType="scan" resultId="scan-123" variant="icon" />
 *
 * // Button variant with label
 * <ShareButton resultType="batch" resultId="batch-456" label="Share Results" />
 *
 * // Inline variant
 * <ShareButton resultType="scan" resultId="scan-789" variant="inline" />
 *
 * // With callback
 * <ShareButton
 *   resultType="scan"
 *   resultId="scan-123"
 *   onShare={(url) => console.log('Shared:', url)}
 * />
 * ```
 */
const ShareButton = React.forwardRef<HTMLButtonElement, ShareButtonProps>(
  (
    {
      className,
      variant = "button",
      size = "md",
      resultType,
      resultId,
      label,
      onShare,
      onError,
      successDuration,
      disabled,
      ...props
    },
    ref
  ) => {
    const { track } = useAnalytics();
    const shareUrl = React.useMemo(() => generateShareUrl(resultType, resultId), [resultType, resultId]);

    const handleShare = React.useCallback(() => {
      // Track share event with analytics
      track("result_shared", {
        result_type: resultType,
        result_id: resultId,
        share_method: "link",
        timestamp: new Date().toISOString(),
        sessionId: typeof window !== "undefined" ? window.sessionStorage.getItem("sessionId") || "" : "",
      });

      // Invoke callback if provided
      onShare?.(shareUrl);
    }, [track, resultType, resultId, shareUrl, onShare]);

    // Determine label based on variant
    const buttonLabel = React.useMemo(() => {
      if (label) return label;
      if (variant === "button") return "Share";
      return undefined;
    }, [label, variant]);

    return (
      <CopyButton
        ref={ref}
        className={cn(shareButtonVariants({ variant }), className)}
        variant={variant}
        size={size}
        text={shareUrl}
        {...(buttonLabel && { label: buttonLabel })}
        onCopy={handleShare}
        {...(onError && { onError })}
        {...(successDuration && { successDuration })}
        disabled={disabled}
        aria-label={variant === "icon" ? "Share results link" : undefined}
        {...props}
      />
    );
  }
);
ShareButton.displayName = "ShareButton";

export { ShareButton, generateShareUrl };
