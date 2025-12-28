import { env } from './env';

/**
 * Type definitions for Admin API requests and responses
 */

// Admin auth types
export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  admin: {
    id: string;
    email: string;
    role: 'admin' | 'super_admin';
  };
}

export interface AdminMeResponse {
  admin: {
    id: string;
    email: string;
    role: 'admin' | 'super_admin';
  };
}

export interface AdminChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Admin users types
export interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'super_admin';
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminUsersListResponse {
  items: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

export interface CreateAdminRequest {
  email: string;
  password: string;
  role: 'admin' | 'super_admin';
}

export interface UpdateAdminRequest {
  email?: string;
  role?: 'admin' | 'super_admin';
  isActive?: boolean;
}

// Scans types - status values are uppercase from API
export type ScanStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface Scan {
  id: string;
  url: string;
  status: ScanStatus;
  email: string;
  guestSessionId: string | null;
  userId: string | null;
  wcagLevel: 'A' | 'AA' | 'AAA';
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

// Alias for backward compatibility with components using userEmail
export type ScanWithUserEmail = Scan & { userEmail: string };

export interface ScansListResponse {
  items: Scan[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ScanDetailsResponse {
  scan: Scan;
}

// Customers types
export interface Customer {
  email: string;
  totalScans: number;
  firstScanAt: string;
  lastScanAt: string;
  avgIssuesPerScan: number;
}

export interface CustomersListResponse {
  items: Customer[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CustomerFilters extends PaginationParams {
  email?: string;
  minScans?: number;
  maxScans?: number;
  startDate?: string;
  endDate?: string;
}

export interface CustomerDetailsResponse {
  customer: Customer;
}

export interface CustomerScansResponse {
  scans: Scan[];
  total: number;
  page: number;
  pageSize: number;
}

// Dashboard types
export interface DashboardMetricsResponse {
  totalScans: number;
  activeUsers: number;
  avgIssuesPerScan: number;
  completionRate: number;
}

export interface ScanTrend {
  date: string;
  count: number;
  successCount: number;
  failedCount: number;
}

export interface IssueDistribution {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

// Remove wrapper types - API returns arrays/objects directly
// export interface DashboardIssuesResponse {
//   distribution: IssueDistribution;
// }

export interface TopDomain {
  domain: string;
  scanCount: number;
}

export interface DashboardDomainsResponse {
  domains: TopDomain[];
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  queueSize: number;
  avgResponseTime: number;
}

export interface DashboardHealthResponse {
  health: SystemHealth;
}

// Audit types
export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
}

export interface AuditLogsResponse {
  items: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

// Query parameter types
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface ScanFilters extends PaginationParams {
  status?: ScanStatus;
  userEmail?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'completedAt' | 'issuesFound';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditFilters extends PaginationParams {
  adminEmail?: string;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Admin API response wrapper type
 * All Admin API responses follow this format
 */
interface AdminApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

/**
 * Generic Admin API client function
 * Unwraps the { success, data } response format from the API
 */
export async function adminApiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${env.apiUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include', // For session cookies
  });

  const json: AdminApiResponse<T> = await response.json().catch(() => ({}));

  if (!response.ok || !json.success) {
    throw new Error(json.error || json.message || `API error: ${response.status}`);
  }

  // Unwrap the data property from the API response
  return json.data as T;
}

/**
 * Helper function to build query string from params object
 */
function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Typed Admin API methods
 */
export const adminApi = {
  auth: {
    /**
     * Login with email and password
     * @param data - Login credentials
     * @returns Admin user information
     */
    login: (data: AdminLoginRequest) =>
      adminApiClient<AdminLoginResponse>('/api/v1/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    /**
     * Logout and clear session
     */
    logout: () =>
      adminApiClient<void>('/api/v1/admin/auth/logout', {
        method: 'POST',
      }),

    /**
     * Get current admin user information
     * @returns Admin user information if authenticated
     */
    getMe: () =>
      adminApiClient<AdminMeResponse>('/api/v1/admin/auth/me'),

    /**
     * Change password for current admin
     * @param data - Current and new password
     */
    changePassword: (data: AdminChangePasswordRequest) =>
      adminApiClient<void>('/api/v1/admin/auth/password', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  users: {
    /**
     * List all admin users with pagination
     * @param params - Pagination parameters
     * @returns List of admin users
     */
    list: (params?: PaginationParams) => {
      const query = buildQueryString((params || {}) as Record<string, unknown>);
      return adminApiClient<AdminUsersListResponse>(`/api/v1/admin/users${query}`);
    },

    /**
     * Create a new admin user
     * @param data - Admin user data
     * @returns Created admin user
     */
    create: (data: CreateAdminRequest) =>
      adminApiClient<AdminUser>('/api/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    /**
     * Update an admin user
     * @param id - Admin user ID
     * @param data - Updated admin user data
     * @returns Updated admin user
     */
    update: (id: string, data: UpdateAdminRequest) =>
      adminApiClient<AdminUser>(`/api/v1/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    /**
     * Deactivate an admin user
     * @param id - Admin user ID
     */
    deactivate: (id: string) =>
      adminApiClient<void>(`/api/v1/admin/users/${id}`, {
        method: 'DELETE',
      }),

    /**
     * Reset password for an admin user
     * @param id - Admin user ID
     */
    resetPassword: (id: string) =>
      adminApiClient<{ tempPassword: string }>(`/api/v1/admin/users/${id}/reset-password`, {
        method: 'POST',
      }),
  },

  scans: {
    /**
     * List all scans with filtering and pagination
     * @param filters - Filter and pagination parameters
     * @returns List of scans
     */
    list: (filters?: ScanFilters) => {
      const query = buildQueryString((filters || {}) as Record<string, unknown>);
      return adminApiClient<ScansListResponse>(`/api/v1/admin/scans${query}`);
    },

    /**
     * Get details of a specific scan
     * @param id - Scan ID
     * @returns Scan details
     */
    get: (id: string) =>
      adminApiClient<ScanDetailsResponse>(`/api/v1/admin/scans/${id}`),

    /**
     * Delete a scan
     * @param id - Scan ID
     */
    delete: (id: string) =>
      adminApiClient<void>(`/api/v1/admin/scans/${id}`, {
        method: 'DELETE',
      }),

    /**
     * Retry a failed scan
     * @param id - Scan ID
     */
    retry: (id: string) =>
      adminApiClient<void>(`/api/v1/admin/scans/${id}/retry`, {
        method: 'POST',
      }),
  },

  customers: {
    /**
     * List all customers with filtering and pagination
     * @param filters - Filter and pagination parameters
     * @returns List of customers
     */
    list: (filters?: CustomerFilters) => {
      const query = buildQueryString((filters || {}) as Record<string, unknown>);
      return adminApiClient<CustomersListResponse>(`/api/v1/admin/customers${query}`);
    },

    /**
     * Get details of a specific customer
     * @param email - Customer email
     * @returns Customer details
     */
    get: (email: string) =>
      adminApiClient<CustomerDetailsResponse>(`/api/v1/admin/customers/${encodeURIComponent(email)}`),

    /**
     * Get scans for a specific customer
     * @param email - Customer email
     * @param params - Pagination parameters
     * @returns Customer's scans
     */
    getScans: (email: string, params?: PaginationParams) => {
      const query = buildQueryString((params || {}) as Record<string, unknown>);
      return adminApiClient<CustomerScansResponse>(
        `/api/v1/admin/customers/${encodeURIComponent(email)}/scans${query}`
      );
    },

    /**
     * Export customers list to CSV or JSON
     * @param format - Export format: 'csv' or 'json'
     * @param filters - Optional filter parameters
     * @returns Data as blob
     */
    export: async (format: 'csv' | 'json' = 'csv', filters?: CustomerFilters) => {
      const queryParams = {
        format,
        ...(filters || {}),
      };
      const query = buildQueryString(queryParams as Record<string, unknown>);
      const url = `${env.apiUrl}/api/v1/admin/customers/export${query}`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      return response.blob();
    },
  },

  dashboard: {
    /**
     * Get dashboard metrics
     * @returns Dashboard metrics
     */
    getMetrics: () =>
      adminApiClient<DashboardMetricsResponse>('/api/v1/admin/dashboard/metrics'),

    /**
     * Get scan trends over time
     * @param params - Days parameter (default: 30)
     * @returns Array of scan trend data points
     */
    getTrends: (params?: { days?: number }) => {
      const query = buildQueryString((params || {}) as Record<string, unknown>);
      return adminApiClient<ScanTrend[]>(`/api/v1/admin/dashboard/trends${query}`);
    },

    /**
     * Get issue distribution by severity
     * @returns Issue distribution object
     */
    getIssues: () =>
      adminApiClient<IssueDistribution>('/api/v1/admin/dashboard/issues'),

    /**
     * Get top domains by scan count
     * @param params - Limit parameter
     * @returns Top domains
     */
    getDomains: (params?: { limit?: number }) => {
      const query = buildQueryString((params || {}) as Record<string, unknown>);
      return adminApiClient<DashboardDomainsResponse>(`/api/v1/admin/dashboard/domains${query}`);
    },

    /**
     * Get system health status
     * @returns System health information
     */
    getHealth: () =>
      adminApiClient<DashboardHealthResponse>('/api/v1/admin/dashboard/health'),
  },

  audit: {
    /**
     * List audit logs with filtering and pagination
     * @param filters - Filter and pagination parameters
     * @returns List of audit logs
     */
    list: (filters?: AuditFilters) => {
      const query = buildQueryString((filters || {}) as Record<string, unknown>);
      return adminApiClient<AuditLogsResponse>(`/api/v1/admin/audit${query}`);
    },

    /**
     * Export audit logs to CSV
     * @param filters - Filter parameters for export
     * @returns CSV data as blob
     */
    export: async (filters?: AuditFilters) => {
      const query = buildQueryString((filters || {}) as Record<string, unknown>);
      const url = `${env.apiUrl}/api/v1/admin/audit/export${query}`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      return response.blob();
    },
  },
};
