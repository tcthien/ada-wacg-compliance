'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuthStore } from '@/stores/admin-auth';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminProviders } from './providers';

/**
 * Admin layout wrapper
 *
 * This layout:
 * - Checks authentication status on mount
 * - Redirects to /admin/login if not authenticated (except for login page)
 * - Shows loading state while verifying session
 * - Wraps authenticated content with admin shell (sidebar + header)
 * - Handles session expiration by redirecting to login
 *
 * @param children - Child routes to render
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAdminAuthStore();

  // Determine if current page is the login page
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    // Skip auth check for login page
    if (isLoginPage) {
      return;
    }

    // Skip if already authenticated (e.g., just logged in)
    if (isAuthenticated) {
      return;
    }

    // Check authentication status on mount
    const verifyAuth = async () => {
      const user = await checkAuth();

      // If not authenticated, redirect to login with return URL
      if (!user) {
        const returnUrl = encodeURIComponent(pathname);
        router.push(`/admin/login?returnUrl=${returnUrl}`);
      }
    };

    verifyAuth();
  }, [pathname, isLoginPage, isAuthenticated, checkAuth, router]);

  // Login page doesn't need auth wrapper
  if (isLoginPage) {
    return <AdminProviders>{children}</AdminProviders>;
  }

  // Show loading state while checking authentication
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-sm text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Authenticated: Render admin shell with sidebar and header
  return (
    <AdminProviders>
      <div className="flex min-h-screen bg-gray-100">
        {/* Admin Sidebar - Task 33 */}
        <AdminSidebar />

        {/* Main content area */}
        <div className="flex flex-1 flex-col">
          {/* Admin Header - Task 34 */}
          <AdminHeader />

          {/* Page content */}
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </AdminProviders>
  );
}
