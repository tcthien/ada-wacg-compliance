'use client';

import { useRouter } from 'next/navigation';
import { useAdminAuthStore } from '@/stores/admin-auth';
import { LogOut, User } from 'lucide-react';
import { AdminSearch } from './AdminSearch';

/**
 * Admin header component
 *
 * This component:
 * - Displays the current admin's email
 * - Provides a logout button
 * - Redirects to /admin/login after logout
 * - Shows a loading state during logout operation
 *
 * Requirements: 7.2 - Admin authenticated UI with navigation
 */
export function AdminHeader() {
  const router = useRouter();
  const { admin, logout, isLoading } = useAdminAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/admin/login');
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout API fails, we still redirect to login
      router.push('/admin/login');
    }
  };

  return (
    <header className="bg-white shadow">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side - Title */}
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            Admin Dashboard
          </h1>
        </div>

        {/* Center - Search bar */}
        <div className="flex-1 max-w-xl mx-8">
          <AdminSearch />
        </div>

        {/* Right side - User info & logout */}
        <div className="flex items-center gap-4">
          {/* Admin email display */}
          {admin && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="h-4 w-4" aria-hidden="true" />
              <span className="font-medium">{admin.email}</span>
              {admin.role === 'super_admin' && (
                <span className="ml-2 rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                  Super Admin
                </span>
              )}
            </div>
          )}

          {/* Logout button */}
          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Logout from admin panel"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>{isLoading ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
