'use client';

import { useState } from 'react';
import {
  Pencil,
  Key,
  UserX,
  UserCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

/**
 * Admin user type based on API response
 */
export interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'super_admin';
  isActive: boolean;
  lastLoginAt: string | null;
}

/**
 * Sort configuration
 */
type SortField = 'email' | 'role' | 'isActive' | 'lastLoginAt';
type SortOrder = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  order: SortOrder;
}

/**
 * Props for the AdminUserTable component
 */
interface AdminUserTableProps {
  /** Array of admin users to display */
  users: AdminUser[];
  /** Loading state - shows skeleton rows when true */
  loading?: boolean;
  /** Current logged-in admin user ID to prevent self-deactivation */
  currentUserId: string;
  /** Callback when edit button is clicked */
  onEdit: (userId: string) => void;
  /** Callback when deactivate/activate button is clicked */
  onDeactivate: (userId: string, currentStatus: boolean) => void;
  /** Callback when reset password button is clicked */
  onResetPassword: (userId: string) => void;
}

/**
 * Role badge component
 */
function RoleBadge({ role }: { role: AdminUser['role'] }) {
  const roleConfig = {
    admin: {
      label: 'Admin',
      className: 'bg-blue-100 text-blue-800',
    },
    super_admin: {
      label: 'Super Admin',
      className: 'bg-purple-100 text-purple-800',
    },
  };

  const config = roleConfig[role];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

/**
 * Status badge component
 */
function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isActive
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

/**
 * Sort icon component
 */
function SortIcon({
  field,
  currentSort
}: {
  field: SortField;
  currentSort: SortConfig | null;
}) {
  if (currentSort?.field !== field) {
    return <ArrowUpDown className="ml-1 h-4 w-4 text-gray-400" />;
  }

  return currentSort.order === 'asc'
    ? <ArrowUp className="ml-1 h-4 w-4 text-blue-600" />
    : <ArrowDown className="ml-1 h-4 w-4 text-blue-600" />;
}

/**
 * Skeleton row for loading state
 */
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-48 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-6 w-20 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-6 w-16 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex gap-2">
          <div className="h-8 w-8 bg-gray-200 rounded"></div>
          <div className="h-8 w-8 bg-gray-200 rounded"></div>
          <div className="h-8 w-8 bg-gray-200 rounded"></div>
        </div>
      </td>
    </tr>
  );
}

/**
 * Empty state component
 */
function EmptyState() {
  return (
    <tr>
      <td colSpan={5} className="px-6 py-12 text-center">
        <div className="flex flex-col items-center justify-center">
          <div className="text-gray-400 mb-2">
            <svg
              className="h-12 w-12 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-gray-900">No admin users found</h3>
          <p className="mt-1 text-sm text-gray-500">
            No admin users have been created yet.
          </p>
        </div>
      </td>
    </tr>
  );
}

/**
 * AdminUserTable component
 *
 * This component:
 * - Displays admin users in a table with email, role, status, and last login columns
 * - Provides sortable column headers (click to toggle sort direction)
 * - Shows role badges (ADMIN=blue, SUPER_ADMIN=purple) and status badges (Active=green, Inactive=red)
 * - Includes action buttons: Edit (pencil icon), Deactivate/Activate (toggle), Reset Password (key icon)
 * - Prevents current user from deactivating themselves
 * - Displays loading state with skeleton rows
 * - Shows empty state when no users are available
 *
 * Requirements:
 * - REQ 2.2: Return all admin users with pagination support
 * - REQ 7.3: Display data in responsive tables with sorting, filtering, and pagination controls
 * - NFR-Usability: Intuitive table interface with clear role and status indicators
 */
export function AdminUserTable({
  users,
  loading = false,
  currentUserId,
  onEdit,
  onDeactivate,
  onResetPassword
}: AdminUserTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  /**
   * Handle column header click for sorting
   */
  const handleSort = (field: SortField) => {
    setSortConfig((current) => {
      // If clicking the same field, toggle order
      if (current?.field === field) {
        return {
          field,
          order: current.order === 'asc' ? 'desc' : 'asc',
        };
      }
      // Default to descending for new field
      return { field, order: 'desc' };
    });
  };

  /**
   * Sort users based on current sort configuration
   */
  const sortedUsers = sortConfig
    ? [...users].sort((a, b) => {
        const { field, order } = sortConfig;
        let aValue: string | number | boolean;
        let bValue: string | number | boolean;

        switch (field) {
          case 'email':
            aValue = a.email.toLowerCase();
            bValue = b.email.toLowerCase();
            break;
          case 'role':
            aValue = a.role;
            bValue = b.role;
            break;
          case 'isActive':
            aValue = a.isActive ? 1 : 0;
            bValue = b.isActive ? 1 : 0;
            break;
          case 'lastLoginAt':
            aValue = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
            bValue = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) {
          return order === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return order === 'asc' ? 1 : -1;
        }
        return 0;
      })
    : users;

  /**
   * Format date for display
   */
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {/* Email Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('email')}
            >
              <div className="flex items-center">
                Email
                <SortIcon field="email" currentSort={sortConfig} />
              </div>
            </th>

            {/* Role Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('role')}
            >
              <div className="flex items-center">
                Role
                <SortIcon field="role" currentSort={sortConfig} />
              </div>
            </th>

            {/* Status Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('isActive')}
            >
              <div className="flex items-center">
                Status
                <SortIcon field="isActive" currentSort={sortConfig} />
              </div>
            </th>

            {/* Last Login Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('lastLoginAt')}
            >
              <div className="flex items-center">
                Last Login
                <SortIcon field="lastLoginAt" currentSort={sortConfig} />
              </div>
            </th>

            {/* Actions Column */}
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {/* Loading State */}
          {loading && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}

          {/* Empty State */}
          {!loading && sortedUsers.length === 0 && <EmptyState />}

          {/* Data Rows */}
          {!loading &&
            sortedUsers.map((user) => {
              const isCurrentUser = user.id === currentUserId;

              return (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  {/* Email */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.email}
                    {isCurrentUser && (
                      <span className="ml-2 text-xs text-gray-500">(You)</span>
                    )}
                  </td>

                  {/* Role */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <RoleBadge role={user.role} />
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge isActive={user.isActive} />
                  </td>

                  {/* Last Login */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(user.lastLoginAt)}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      {/* Edit Button */}
                      <button
                        onClick={() => onEdit(user.id)}
                        className="inline-flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Edit user"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </button>

                      {/* Deactivate/Activate Button - Disabled for current user */}
                      <button
                        onClick={() => onDeactivate(user.id, user.isActive)}
                        disabled={isCurrentUser}
                        className={`inline-flex items-center justify-center p-2 rounded-md transition-colors ${
                          isCurrentUser
                            ? 'text-gray-400 cursor-not-allowed'
                            : user.isActive
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title={
                          isCurrentUser
                            ? 'Cannot deactivate yourself'
                            : user.isActive
                            ? 'Deactivate user'
                            : 'Activate user'
                        }
                      >
                        {user.isActive ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                        <span className="sr-only">
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </span>
                      </button>

                      {/* Reset Password Button */}
                      <button
                        onClick={() => onResetPassword(user.id)}
                        className="inline-flex items-center justify-center p-2 text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                        title="Reset password"
                      >
                        <Key className="h-4 w-4" />
                        <span className="sr-only">Reset Password</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
