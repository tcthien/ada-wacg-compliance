import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ShowMoreLessProps {
  isExpanded: boolean;
  onToggle: () => void;
  hiddenCount: number;
  className?: string;
}

export function ShowMoreLess({
  isExpanded,
  onToggle,
  hiddenCount,
  className,
}: ShowMoreLessProps) {
  const Icon = isExpanded ? ChevronUp : ChevronDown;
  const text = isExpanded
    ? "Show less"
    : `Show more (+${hiddenCount} more)`;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className={cn("gap-1 text-primary", className)}
      aria-expanded={isExpanded}
      aria-label={
        isExpanded
          ? "Show less URLs"
          : `Show ${hiddenCount} more URLs`
      }
    >
      {text}
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
