'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigationConfig, type NavItem } from '@/lib/navigation-config';

/**
 * HeaderNav Component
 *
 * Desktop header navigation links with:
 * - Navigation to Home, History, and Settings
 * - Active route highlighting using pathname matching
 * - WCAG-compliant accessible navigation
 * - Smooth transitions and hover states
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

export interface HeaderNavProps {
  /**
   * Navigation items to display
   * Defaults to main navigation from config
   */
  items?: NavItem[];
  /**
   * Additional CSS classes for the nav element
   */
  className?: string;
}

export function HeaderNav({ items = navigationConfig.mainNav, className = '' }: HeaderNavProps) {
  const pathname = usePathname();

  /**
   * Determines if a nav item is active based on the current pathname
   * - Exact match for home (/)
   * - Starts with match for other routes
   */
  const isActive = (href: string): boolean => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className={className} aria-label="Main navigation">
      <ul className="flex items-center gap-6" role="list">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`
                  text-sm font-medium transition-colors
                  ${
                    active
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                `}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
