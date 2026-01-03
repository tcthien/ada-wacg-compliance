import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/lib/navigation-config';

export interface BreadcrumbsProps {
  /**
   * Array of breadcrumb items to display
   */
  items: BreadcrumbItem[];
  /**
   * Custom separator between breadcrumb items
   * @default ">"
   */
  separator?: string;
  /**
   * Maximum length for breadcrumb labels before truncation
   * @default undefined (no truncation)
   */
  maxLabelLength?: number;
  /**
   * Additional CSS classes to apply to the breadcrumb container
   */
  className?: string;
}

/**
 * Breadcrumbs component for hierarchical page navigation
 *
 * Displays a breadcrumb trail showing the current page's location
 * in the navigation hierarchy. Clickable items link to their pages,
 * while the current page is displayed as non-clickable text.
 *
 * @example
 * ```tsx
 * <Breadcrumbs
 *   items={[
 *     { label: 'Home', href: '/' },
 *     { label: 'History', href: '/history' },
 *     { label: 'Scan Results' }
 *   ]}
 * />
 * ```
 */
export function Breadcrumbs({
  items,
  separator = '>',
  maxLabelLength,
  className,
}: BreadcrumbsProps) {
  if (!items || items.length === 0) {
    return null;
  }

  const truncateLabel = (label: string): string => {
    if (!maxLabelLength || label.length <= maxLabelLength) {
      return label;
    }
    return `${label.slice(0, maxLabelLength)}...`;
  };

  return (
    <nav aria-label="Breadcrumb" className={cn('mb-4', className)}>
      <ol role="list" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const displayLabel = truncateLabel(item.label);

          return (
            <li key={index} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className={cn(
                    'hover:text-foreground transition-colors',
                    maxLabelLength && 'truncate'
                  )}
                  title={item.label}
                >
                  {displayLabel}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn(
                    isLast && 'text-foreground font-medium',
                    maxLabelLength && 'truncate'
                  )}
                  title={item.label}
                >
                  {displayLabel}
                </span>
              )}
              {!isLast && (
                <span aria-hidden="true" className="text-muted-foreground/50">
                  {separator}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
