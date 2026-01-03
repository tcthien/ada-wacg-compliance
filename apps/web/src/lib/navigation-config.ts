/**
 * Centralized navigation configuration for the application
 * Used by header navigation, breadcrumbs, and page layouts
 */

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Main navigation items displayed in the header
 */
export const navigationConfig: {
  mainNav: NavItem[];
} = {
  mainNav: [
    {
      label: 'Home',
      href: '/',
    },
    {
      label: 'History',
      href: '/history',
    },
    {
      label: 'Settings',
      href: '/settings',
    },
  ],
};

/**
 * Breadcrumb templates for different route patterns
 * Key is the route pattern, value is a function that returns breadcrumb items
 */
export const breadcrumbTemplates: Record<
  string,
  (params?: Record<string, string>) => BreadcrumbItem[]
> = {
  '/': () => [{ label: 'Home' }],

  '/history': () => [
    { label: 'Home', href: '/' },
    { label: 'Scan History' },
  ],

  '/scan/:id': (params) => [
    { label: 'Home', href: '/' },
    { label: 'Scan History', href: '/history' },
    { label: `Scan #${params?.id?.slice(0, 8) || '...'}` },
  ],

  '/batch/:id': (params) => [
    { label: 'Home', href: '/' },
    { label: 'Scan History', href: '/history' },
    { label: `Batch #${params?.id?.slice(0, 8) || '...'}` },
  ],

  '/settings': () => [
    { label: 'Home', href: '/' },
    { label: 'Settings' },
  ],

  '/discovery': () => [
    { label: 'Home', href: '/' },
    { label: 'URL Discovery' },
  ],

  '/early-bird': () => [
    { label: 'Home', href: '/' },
    { label: 'AI Early Bird' },
  ],
};

/**
 * Helper function to get breadcrumbs for a given pathname
 * @param pathname - Current page pathname (e.g., '/scan/abc123')
 * @returns Array of breadcrumb items
 */
export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  // Try exact match first
  if (breadcrumbTemplates[pathname]) {
    return breadcrumbTemplates[pathname]();
  }

  // Try pattern matching for dynamic routes
  for (const [pattern, template] of Object.entries(breadcrumbTemplates)) {
    if (pattern.includes(':')) {
      const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '$');
      const match = pathname.match(regex);

      if (match) {
        // Extract parameter names and values
        const paramNames = pattern.match(/:[^/]+/g)?.map(p => p.slice(1)) || [];
        const params: Record<string, string> = {};

        paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });

        return template(params);
      }
    }
  }

  // Default breadcrumb if no match found
  return [{ label: 'Home', href: '/' }];
}
