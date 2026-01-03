import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FolderOpen, CheckCircle, Globe, Search } from "lucide-react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, secondaryAction, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center text-center py-12 px-4",
          className
        )}
      >
        {icon && (
          <div className="mb-4 text-muted-foreground">
            {React.isValidElement(icon) ? (
              React.cloneElement(icon as React.ReactElement, {
                className: cn(
                  "w-16 h-16",
                  (icon as React.ReactElement).props.className
                ),
              })
            ) : (
              icon
            )}
          </div>
        )}

        <h3 className="text-lg font-semibold mb-2">{title}</h3>

        {description && (
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            {description}
          </p>
        )}

        {(action || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
            {action && (
              <Button
                onClick={action.onClick}
                variant={action.variant === 'secondary' ? 'secondary' : 'default'}
                size="default"
              >
                {action.label}
              </Button>
            )}

            {secondaryAction && (
              <Button
                onClick={secondaryAction.onClick}
                variant="outline"
                size="default"
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }
);

EmptyState.displayName = "EmptyState";

export { EmptyState };

// Predefined Empty State Components

export interface PredefinedEmptyStateProps {
  onAction?: () => void;
  className?: string;
}

/**
 * EmptyHistory - Displayed when scan history is empty
 * Shows "No scans yet" with CTA to start first scan
 */
export const EmptyHistory = React.forwardRef<HTMLDivElement, PredefinedEmptyStateProps>(
  ({ onAction, className }, ref) => {
    return (
      <EmptyState
        ref={ref}
        icon={<FolderOpen className="text-muted-foreground" />}
        title="No scans yet"
        description="Start your first accessibility scan to check your website for WCAG compliance issues."
        {...(onAction && {
          action: {
            label: "Start Your First Scan",
            onClick: onAction,
            variant: 'primary' as const
          }
        })}
        {...(className && { className })}
      />
    );
  }
);

EmptyHistory.displayName = "EmptyHistory";

/**
 * EmptyIssues - Displayed when no accessibility issues are found
 * Success state with CheckCircle icon
 */
export const EmptyIssues = React.forwardRef<HTMLDivElement, PredefinedEmptyStateProps>(
  ({ onAction, className }, ref) => {
    return (
      <EmptyState
        ref={ref}
        icon={<CheckCircle className="text-green-500" />}
        title="No issues found!"
        description="Great job! Your page meets all tested WCAG accessibility guidelines. Keep up the good work maintaining accessibility standards."
        {...(onAction && {
          action: {
            label: "Scan Another Page",
            onClick: onAction,
            variant: 'secondary' as const
          }
        })}
        {...(className && { className })}
      />
    );
  }
);

EmptyIssues.displayName = "EmptyIssues";

/**
 * EmptyDiscovery - Displayed in discovery feature when no URL is entered
 * Prompts user to enter a URL to start discovering pages
 */
export const EmptyDiscovery = React.forwardRef<HTMLDivElement, PredefinedEmptyStateProps>(
  ({ onAction, className }, ref) => {
    return (
      <EmptyState
        ref={ref}
        icon={<Globe className="text-muted-foreground" />}
        title="Enter a URL to discover pages"
        description="Discover all pages on your website automatically or manually add URLs to scan for accessibility issues."
        {...(onAction && {
          action: {
            label: "Start Discovery",
            onClick: onAction,
            variant: 'primary' as const
          }
        })}
        {...(className && { className })}
      />
    );
  }
);

EmptyDiscovery.displayName = "EmptyDiscovery";

/**
 * EmptySearchResults - Displayed when search returns no results
 * Shows "No results found" message
 */
export const EmptySearchResults = React.forwardRef<HTMLDivElement, PredefinedEmptyStateProps>(
  ({ onAction, className }, ref) => {
    return (
      <EmptyState
        ref={ref}
        icon={<Search className="text-muted-foreground" />}
        title="No results found"
        description="Try adjusting your search terms or filters to find what you're looking for."
        {...(onAction && {
          action: {
            label: "Clear Filters",
            onClick: onAction,
            variant: 'secondary' as const
          }
        })}
        {...(className && { className })}
      />
    );
  }
);

EmptySearchResults.displayName = "EmptySearchResults";
