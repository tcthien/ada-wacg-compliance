import { create } from 'zustand';
import { adminApi } from '@/lib/admin-api';

/**
 * Admin user information
 * Note: JWT token is stored in HTTP-only cookie, not in this store
 */
export interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'super_admin';
}

/**
 * Admin authentication state
 */
interface AdminAuthState {
  /** Current authenticated admin user */
  admin: AdminUser | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Loading state for async operations */
  isLoading: boolean;
}

/**
 * Admin authentication actions
 */
interface AdminAuthActions {
  /**
   * Login admin user
   * @param email - Admin email
   * @param password - Admin password
   * @returns Promise that resolves with admin user or rejects with error
   */
  login: (email: string, password: string) => Promise<AdminUser>;

  /**
   * Logout current admin user
   * Clears local state and calls API to invalidate session
   */
  logout: () => Promise<void>;

  /**
   * Check authentication status
   * Verifies current session on app load
   * @returns Promise that resolves with admin user if authenticated
   */
  checkAuth: () => Promise<AdminUser | null>;
}

/**
 * Combined store type
 */
type AdminAuthStore = AdminAuthState & AdminAuthActions;

/**
 * Admin authentication store
 * Manages admin user state and authentication operations
 *
 * Note: This store does NOT store the JWT token - tokens are managed
 * via HTTP-only cookies for security. Only user info is stored here.
 */
export const useAdminAuthStore = create<AdminAuthStore>((set, get) => ({
  // Initial state
  admin: null,
  isAuthenticated: false,
  isLoading: false,

  // Actions
  login: async (email: string, password: string) => {
    set({ isLoading: true });

    try {
      const data = await adminApi.auth.login({ email, password });
      const admin: AdminUser = {
        id: data.admin.id,
        email: data.admin.email,
        role: data.admin.role,
      };

      set({
        admin,
        isAuthenticated: true,
        isLoading: false,
      });

      return admin;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });

    try {
      await adminApi.auth.logout();

      set({
        admin: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      // Even if API call fails, clear local state
      set({
        admin: null,
        isAuthenticated: false,
        isLoading: false,
      });
      throw error;
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });

    try {
      const data = await adminApi.auth.getMe();
      const admin: AdminUser = {
        id: data.admin.id,
        email: data.admin.email,
        role: data.admin.role,
      };

      set({
        admin,
        isAuthenticated: true,
        isLoading: false,
      });

      return admin;
    } catch (error) {
      set({
        admin: null,
        isAuthenticated: false,
        isLoading: false,
      });
      return null;
    }
  },
}));
