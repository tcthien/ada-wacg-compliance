import * as React from "react";
import { X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ShowMoreLess } from "@/components/ui/show-more-less";

export interface BatchUrl {
  id: string;
  url: string;
  title?: string;
}

export interface BatchUrlTableProps {
  urls: BatchUrl[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  initialDisplayCount?: number;
}

export function BatchUrlTable({
  urls,
  onRemove,
  onClearAll,
  initialDisplayCount = 3,
}: BatchUrlTableProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const totalCount = urls.length;
  const shouldShowToggle = totalCount > initialDisplayCount;
  const displayedUrls = shouldShowToggle && !isExpanded
    ? urls.slice(0, initialDisplayCount)
    : urls;
  const hiddenCount = totalCount - initialDisplayCount;

  return (
    <div className="space-y-2">
      {/* Header with count and Clear All button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalCount} {totalCount === 1 ? "URL" : "URLs"} selected
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          aria-label="Clear all URLs"
        >
          Clear All
        </Button>
      </div>

      {/* Compact table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[45%]">URL</TableHead>
              <TableHead className="w-[45%]">Title</TableHead>
              <TableHead className="w-[10%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedUrls.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs truncate max-w-0">
                  <span className="block truncate" title={item.url}>
                    {item.url}
                  </span>
                </TableCell>
                <TableCell className="text-sm truncate max-w-0">
                  <span className="block truncate" title={item.title || "—"}>
                    {item.title || "—"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(item.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    aria-label={`Remove ${item.url}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Show More/Less toggle */}
      {shouldShowToggle && (
        <div className="flex justify-center">
          <ShowMoreLess
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
            hiddenCount={hiddenCount}
          />
        </div>
      )}
    </div>
  );
}
