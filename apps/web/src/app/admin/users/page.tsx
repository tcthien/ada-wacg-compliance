'use client';

import { useEffect, useState } from 'react';
import { AdminUserTable, type AdminUser } from '@/components/admin/AdminUserTable';
import { adminApi, type CreateAdminRequest, type UpdateAdminRequest } from '@/lib/admin-api';
import { ChevronLeft, ChevronRight, X, UserPlus, Eye, EyeOff } from 'lucide-react';

/**
 * Admin Users Management Page
 *
 * This page:
 * - Displays all admin users in a table with sorting
 * - Provides "Create Admin" button that opens a modal dialog
 * - Implements create form with email, password, confirm password, and role fields
 * - Provides edit modal for updating admin (email, role, isActive)
 * - Shows confirmation dialogs for deactivate/activate and reset password actions
 * - Displays temporary password after reset in a modal
 * - Includes pagination controls (Previous/Next buttons, page info)
 * - Shows loading and error states
 *
 * Requirements:
 * - REQ 2.1: Create new admin user with email and password
 * - REQ 2.2: View admin user list with pagination
 * - REQ 2.3: Update admin's details (email, role, isActive status)
 * - REQ 2.4: Deactivate admin account
 * - REQ 2.6: Reset admin's password (generates temp password)
 * - REQ 7.3: Display data in responsive tables
 */
export default function AdminUsersPage() {
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Data state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createConfirmPassword, setCreateConfirmPassword] = useState('');
  const [createRole, setCreateRole] = useState<'admin' | 'super_admin'>('admin');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirmPassword, setShowCreateConfirmPassword] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUserId, setEditUserId] = useState<string>('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'super_admin'>('admin');
  const [editError, setEditError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Deactivate confirmation modal state
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateUserId, setDeactivateUserId] = useState<string>('');
  const [deactivateUserEmail, setDeactivateUserEmail] = useState('');
  const [deactivateAction, setDeactivateAction] = useState<'activate' | 'deactivate'>('deactivate');
  const [deactivating, setDeactivating] = useState(false);

  // Reset password confirmation modal state
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string>('');
  const [resetPasswordUserEmail, setResetPasswordUserEmail] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  // Temp password display modal state
  const [showTempPasswordModal, setShowTempPasswordModal] = useState(false);
  const [tempPassword, setTempPassword] = useState('');

  /**
   * Fetch current admin user
   */
  const fetchCurrentUser = async () => {
    try {
      const response = await adminApi.auth.getMe();
      setCurrentUserId(response.admin.id);
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };

  /**
   * Fetch admin users data from API
   */
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await adminApi.users.list({
        page,
        pageSize,
      });
      setUsers(response.items || []);
      setTotal(response.pagination?.totalCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch admin users');
      console.error('Failed to fetch admin users:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch users and current user on mount and when page changes
   */
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [page]);

  /**
   * Handle create admin button click
   */
  const handleCreateClick = () => {
    setCreateEmail('');
    setCreatePassword('');
    setCreateConfirmPassword('');
    setCreateRole('admin');
    setCreateError(null);
    setShowCreateModal(true);
  };

  /**
   * Handle create admin form submission
   */
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    // Validate inputs
    if (!createEmail || !createPassword || !createConfirmPassword) {
      setCreateError('All fields are required');
      return;
    }

    if (createPassword !== createConfirmPassword) {
      setCreateError('Passwords do not match');
      return;
    }

    if (createPassword.length < 8) {
      setCreateError('Password must be at least 8 characters long');
      return;
    }

    try {
      setCreating(true);

      const data: CreateAdminRequest = {
        email: createEmail,
        password: createPassword,
        role: createRole,
      };

      await adminApi.users.create(data);
      setShowCreateModal(false);
      fetchUsers();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create admin user');
      console.error('Failed to create admin user:', err);
    } finally {
      setCreating(false);
    }
  };

  /**
   * Handle edit button click
   */
  const handleEditClick = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    setEditUserId(userId);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditError(null);
    setShowEditModal(true);
  };

  /**
   * Handle edit admin form submission
   */
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    if (!editEmail) {
      setEditError('Email is required');
      return;
    }

    try {
      setEditing(true);

      const data: UpdateAdminRequest = {
        email: editEmail,
        role: editRole,
      };

      await adminApi.users.update(editUserId, data);
      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update admin user');
      console.error('Failed to update admin user:', err);
    } finally {
      setEditing(false);
    }
  };

  /**
   * Handle deactivate/activate button click
   */
  const handleDeactivateClick = (userId: string, isActive: boolean) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    setDeactivateUserId(userId);
    setDeactivateUserEmail(user.email);
    setDeactivateAction(isActive ? 'deactivate' : 'activate');
    setShowDeactivateModal(true);
  };

  /**
   * Handle deactivate/activate confirmation
   */
  const handleDeactivateConfirm = async () => {
    try {
      setDeactivating(true);

      if (deactivateAction === 'deactivate') {
        await adminApi.users.deactivate(deactivateUserId);
      } else {
        // Activate by updating isActive status
        await adminApi.users.update(deactivateUserId, { isActive: true });
      }

      setShowDeactivateModal(false);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${deactivateAction} admin user`);
      console.error(`Failed to ${deactivateAction} admin user:`, err);
    } finally {
      setDeactivating(false);
    }
  };

  /**
   * Handle reset password button click
   */
  const handleResetPasswordClick = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    setResetPasswordUserId(userId);
    setResetPasswordUserEmail(user.email);
    setShowResetPasswordModal(true);
  };

  /**
   * Handle reset password confirmation
   */
  const handleResetPasswordConfirm = async () => {
    try {
      setResettingPassword(true);

      const response = await adminApi.users.resetPassword(resetPasswordUserId);
      setTempPassword(response.tempPassword);

      setShowResetPasswordModal(false);
      setShowTempPasswordModal(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reset password');
      console.error('Failed to reset password:', err);
    } finally {
      setResettingPassword(false);
    }
  };

  /**
   * Copy temp password to clipboard
   */
  const handleCopyTempPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    alert('Temporary password copied to clipboard');
  };

  /**
   * Calculate total pages
   */
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Users</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage administrator accounts and permissions
          </p>
        </div>

        {/* Create Admin button */}
        <button
          onClick={handleCreateClick}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <UserPlus className="h-4 w-4" />
          Create Admin
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading admin users</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Admin users table */}
      <AdminUserTable
        users={users}
        loading={loading}
        currentUserId={currentUserId}
        onEdit={handleEditClick}
        onDeactivate={handleDeactivateClick}
        onResetPassword={handleResetPasswordClick}
      />

      {/* Pagination controls */}
      {!loading && total > 0 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border border-gray-200 rounded-lg shadow-sm">
          {/* Mobile pagination */}
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>

          {/* Desktop pagination */}
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">{(page - 1) * pageSize + 1}</span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(page * pageSize, total)}
                </span>{' '}
                of <span className="font-medium">{total}</span> results
              </p>
            </div>
            <div>
              <nav
                className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                aria-label="Pagination"
              >
                {/* Previous button */}
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>

                {/* Page info */}
                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                  Page {page} of {totalPages}
                </span>

                {/* Next button */}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowCreateModal(false)}
            />

            {/* Modal */}
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                    Create Admin User
                  </h3>

                  <form onSubmit={handleCreateSubmit} className="space-y-4">
                    {/* Email field */}
                    <div>
                      <label
                        htmlFor="create-email"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Email
                      </label>
                      <input
                        type="email"
                        id="create-email"
                        value={createEmail}
                        onChange={(e) => setCreateEmail(e.target.value)}
                        required
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="admin@example.com"
                      />
                    </div>

                    {/* Password field */}
                    <div>
                      <label
                        htmlFor="create-password"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showCreatePassword ? 'text' : 'password'}
                          id="create-password"
                          value={createPassword}
                          onChange={(e) => setCreatePassword(e.target.value)}
                          required
                          minLength={8}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="At least 8 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCreatePassword(!showCreatePassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                        >
                          {showCreatePassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password field */}
                    <div>
                      <label
                        htmlFor="create-confirm-password"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          type={showCreateConfirmPassword ? 'text' : 'password'}
                          id="create-confirm-password"
                          value={createConfirmPassword}
                          onChange={(e) => setCreateConfirmPassword(e.target.value)}
                          required
                          className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Confirm your password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCreateConfirmPassword(!showCreateConfirmPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                        >
                          {showCreateConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Role dropdown */}
                    <div>
                      <label
                        htmlFor="create-role"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Role
                      </label>
                      <select
                        id="create-role"
                        value={createRole}
                        onChange={(e) => setCreateRole(e.target.value as 'admin' | 'super_admin')}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </div>

                    {/* Error message */}
                    {createError && (
                      <div className="rounded-md bg-red-50 p-3">
                        <p className="text-sm text-red-800">{createError}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                      <button
                        type="submit"
                        disabled={creating}
                        className="inline-flex w-full justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {creating ? 'Creating...' : 'Create Admin'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCreateModal(false)}
                        disabled={creating}
                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowEditModal(false)}
            />

            {/* Modal */}
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                    Edit Admin User
                  </h3>

                  <form onSubmit={handleEditSubmit} className="space-y-4">
                    {/* Email field */}
                    <div>
                      <label
                        htmlFor="edit-email"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Email
                      </label>
                      <input
                        type="email"
                        id="edit-email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        required
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Role dropdown */}
                    <div>
                      <label
                        htmlFor="edit-role"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Role
                      </label>
                      <select
                        id="edit-role"
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as 'admin' | 'super_admin')}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </div>

                    {/* Error message */}
                    {editError && (
                      <div className="rounded-md bg-red-50 p-3">
                        <p className="text-sm text-red-800">{editError}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                      <button
                        type="submit"
                        disabled={editing}
                        className="inline-flex w-full justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {editing ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEditModal(false)}
                        disabled={editing}
                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate/Activate Confirmation Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowDeactivateModal(false)}
            />

            {/* Modal */}
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="sm:flex sm:items-start">
                <div
                  className={`mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${
                    deactivateAction === 'deactivate' ? 'bg-red-100' : 'bg-green-100'
                  } sm:mx-0 sm:h-10 sm:w-10`}
                >
                  <svg
                    className={`h-6 w-6 ${
                      deactivateAction === 'deactivate' ? 'text-red-600' : 'text-green-600'
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <h3 className="text-base font-semibold leading-6 text-gray-900">
                    {deactivateAction === 'deactivate' ? 'Deactivate' : 'Activate'} Admin User
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to {deactivateAction} <strong>{deactivateUserEmail}</strong>?
                      {deactivateAction === 'deactivate' && ' This user will no longer be able to log in.'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                <button
                  type="button"
                  onClick={handleDeactivateConfirm}
                  disabled={deactivating}
                  className={`inline-flex w-full justify-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed ${
                    deactivateAction === 'deactivate'
                      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                      : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                  }`}
                >
                  {deactivating ? 'Processing...' : deactivateAction === 'deactivate' ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeactivateModal(false)}
                  disabled={deactivating}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Confirmation Modal */}
      {showResetPasswordModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowResetPasswordModal(false)}
            />

            {/* Modal */}
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg
                    className="h-6 w-6 text-orange-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <h3 className="text-base font-semibold leading-6 text-gray-900">
                    Reset Password
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to reset the password for <strong>{resetPasswordUserEmail}</strong>?
                      A temporary password will be generated.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                <button
                  type="button"
                  onClick={handleResetPasswordConfirm}
                  disabled={resettingPassword}
                  className="inline-flex w-full justify-center rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resettingPassword ? 'Resetting...' : 'Reset Password'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetPasswordModal(false)}
                  disabled={resettingPassword}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Temporary Password Display Modal */}
      {showTempPasswordModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowTempPasswordModal(false)}
            />

            {/* Modal */}
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <svg
                    className="h-6 w-6 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-base font-semibold leading-6 text-gray-900">
                    Password Reset Successful
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-4">
                      The temporary password has been generated. Please share it securely with the user.
                    </p>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">Temporary Password</p>
                      <p className="text-lg font-mono font-semibold text-gray-900 break-all">
                        {tempPassword}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse gap-3">
                <button
                  type="button"
                  onClick={handleCopyTempPassword}
                  className="inline-flex w-full justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
                >
                  Copy to Clipboard
                </button>
                <button
                  type="button"
                  onClick={() => setShowTempPasswordModal(false)}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
