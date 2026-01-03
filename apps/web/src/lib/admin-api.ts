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
  /** Batch ID if scan is part of a batch */
  batchScanId: string | null;
  /** Batch homepage URL for display */
  batchHomepageUrl?: string | null;
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

// Batch types
export type BatchStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'STALE';
export type WcagLevel = 'A' | 'AA' | 'AAA';

/**
 * Aggregate statistics for batch scans
 */
export interface AggregateStats {
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  passedChecks: number;
}

/**
 * Summary information for a batch in list view
 */
export interface AdminBatchSummary {
  id: string;
  homepageUrl: string;
  totalUrls: number;
  completedCount: number;
  failedCount: number;
  status: BatchStatus;
  wcagLevel: WcagLevel;
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  sessionId: string | null;
  createdAt: string;
  completedAt: string | null;
}

/**
 * Response for listing admin batches with pagination and summary
 */
export interface AdminBatchListResponse {
  batches: AdminBatchSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalBatches: number;
    totalUrls: number;
    aggregateIssues: AggregateStats;
  };
}

/**
 * Individual URL scan information within a batch (from API response)
 */
export interface AdminBatchScan {
  id: string;
  url: string;
  pageTitle: string | null;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
}

/**
 * Top critical URL information for batch detail view
 */
export interface AdminTopCriticalUrl {
  scanId: string;
  url: string;
  pageTitle?: string | null;
  criticalCount: number;
}

/**
 * Session information for batch detail view
 */
export interface AdminSessionInfo {
  id: string;
  fingerprint: string;
  createdAt: string;
}

/**
 * Batch core information from API response
 */
export interface AdminBatchInfo {
  id: string;
  homepageUrl: string;
  wcagLevel: WcagLevel;
  status: BatchStatus;
  totalUrls: number;
  completedCount: number;
  failedCount: number;
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  guestSessionId: string | null;
  userId: string | null;
}

/**
 * Detailed batch information including individual URL scans
 * Matches the actual API response structure from /api/v1/admin/batches/:id
 */
export interface AdminBatchDetail {
  batch: AdminBatchInfo;
  scans: AdminBatchScan[];
  aggregate: AggregateStats;
  topCriticalUrls: AdminTopCriticalUrl[];
  sessionInfo: AdminSessionInfo | null;
}

/**
 * Batch metrics response for dashboard
 */
export interface BatchMetricsResponse {
  totals: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  averages: {
    urlsPerBatch: number;
    processingTimeMs: number;
    completionRate: number;
  };
  recentBatches: Array<{
    id: string;
    homepageUrl: string;
    status: string;
    progress: string;
    createdAt: string;
  }>;
  trends: Array<{
    date: string;
    batchCount: number;
    avgUrls: number;
    completionRate: number;
  }>;
}

/**
 * Filter parameters for admin batch list
 */
export interface AdminBatchFilters extends PaginationParams {
  status?: BatchStatus | undefined;
  sessionId?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  sortBy?: 'createdAt' | 'completedAt' | 'totalUrls' | 'totalIssues' | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

// Batch export types
/**
 * Export format options for batch exports
 */
export type BatchExportFormat = 'pdf' | 'json';

/**
 * Export status values for batch exports
 */
export type BatchExportStatus = 'ready' | 'generating' | 'failed';

/**
 * Batch export response when report is ready
 */
export interface BatchExportReadyResponse {
  status: 'ready';
  url: string;
  expiresAt: string;
  reportId: string;
}

/**
 * Batch export response when report is generating
 */
export interface BatchExportGeneratingResponse {
  status: 'generating';
  reportId: string;
  message?: string;
}

/**
 * Batch export response when report generation failed
 */
export interface BatchExportFailedResponse {
  status: 'failed';
  errorMessage: string;
  reportId?: string;
}

/**
 * Unified batch export response type
 */
export type BatchExportResponse =
  | BatchExportReadyResponse
  | BatchExportGeneratingResponse
  | BatchExportFailedResponse;

// Report types
/**
 * Information about an existing report
 */
export interface ReportInfo {
  exists: true;
  url: string;
  createdAt: string;
  fileSizeBytes: number;
  expiresAt: string;
}

/**
 * Report status for both PDF and JSON formats
 */
export interface ReportStatusResponse {
  scanId: string;
  scanStatus: ScanStatus;
  reports: {
    pdf: ReportInfo | null;
    json: ReportInfo | null;
  };
}

/**
 * Response when report is ready
 */
export interface ReportReadyResponse {
  url: string;
  expiresAt: string;
}

/**
 * Response when report is being generated
 */
export interface ReportGeneratingResponse {
  status: 'generating';
  jobId: string;
}

/**
 * Union type for report API responses
 */
export type ReportResponse = ReportReadyResponse | ReportGeneratingResponse;

// AI Campaign Admin types
export type AiStatus = 'PENDING' | 'DOWNLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type AiCampaignStatus = 'ACTIVE' | 'PAUSED' | 'DEPLETED' | 'ENDED';

/**
 * AI Campaign metrics for admin dashboard
 */
export interface AiCampaignMetrics {
  /** Total tokens allocated for campaign */
  totalTokenBudget: number;
  /** Tokens consumed so far */
  usedTokens: number;
  /** Tokens still available */
  remainingTokens: number;
  /** Percentage of token budget consumed (0-100) */
  percentUsed: number;
  /** Number of slots reserved */
  reservedSlots: number;
  /** Number of successfully completed AI scans */
  completedScans: number;
  /** Number of failed AI scans */
  failedScans: number;
  /** Number of scans awaiting processing */
  pendingScans: number;
  /** Average tokens consumed per scan */
  avgTokensPerScan: number;
  /** Estimated slots remaining based on current usage */
  projectedSlotsRemaining: number;
  /** Current campaign status */
  campaignStatus: AiCampaignStatus;
  /** Campaign start time */
  startsAt: string;
  /** Campaign end time */
  endsAt: string;
}

/**
 * AI Queue statistics
 * Matches backend QueueStats interface from ai-queue.service.ts
 */
export interface AiQueueStats {
  /** Total scans with AI enabled */
  totalScans: number;
  /** Scans by status breakdown */
  byStatus: {
    PENDING: number;
    DOWNLOADED: number;
    PROCESSING: number;
    COMPLETED: number;
    FAILED: number;
  };
  /** Total tokens used across all completed scans */
  totalTokensUsed: number;
  /** Average tokens per completed scan */
  avgTokensPerScan: number;
}

/**
 * AI Scan entry in queue list
 */
export interface AiQueueScan {
  id: string;
  url: string;
  email: string | null;
  wcagLevel: 'A' | 'AA' | 'AAA';
  aiStatus: AiStatus;
  aiInputTokens: number | null;
  aiOutputTokens: number | null;
  aiTotalTokens: number | null;
  aiModel: string | null;
  aiProcessingTime: number | null;
  createdAt: string;
  aiProcessedAt: string | null;
}

/**
 * AI Queue list response
 * Matches backend PaginatedAiScans interface with cursor-based pagination
 */
export interface AiQueueListResponse {
  /** List of AI scans (returned as 'items' from backend) */
  items: AiQueueScan[];
  /** Cursor for next page (null if no more pages) */
  nextCursor: string | null;
  /** Total count of matching scans */
  totalCount: number;
}

/**
 * AI Queue filter parameters
 */
export interface AiQueueFilters extends PaginationParams {
  status?: AiStatus | AiStatus[] | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

/**
 * AI Import result
 */
export interface AiImportResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: Array<{ scanId: string; error: string }>;
  tokensDeducted: number;
}

// Query parameter types
export interface PaginationParams {
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface ScanFilters extends PaginationParams {
  status?: ScanStatus | undefined;
  userEmail?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  sortBy?: 'createdAt' | 'completedAt' | 'issuesFound' | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
  /** Batch filter: 'all', 'batched', 'nonBatched', or 'specific' (use with batchId) */
  batchFilter?: 'all' | 'batched' | 'nonBatched' | 'specific' | undefined;
  /** Specific batch ID when filtering for a particular batch */
  batchId?: string | undefined;
}

export interface AuditFilters extends PaginationParams {
  adminEmail?: string | undefined;
  action?: string | undefined;
  resourceType?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
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

  reports: {
    /**
     * Get report status for both PDF and JSON formats (admin bypass)
     * @param scanId - Scan ID
     * @returns Report status for both formats
     */
    getStatus: (scanId: string) =>
      adminApiClient<ReportStatusResponse>(`/api/v1/admin/scans/${scanId}/reports`),

    /**
     * Generate or retrieve a report for any scan (admin bypass)
     * @param scanId - Scan ID
     * @param format - Report format (pdf or json)
     * @returns Report URL or generation status
     */
    generate: (scanId: string, format: 'pdf' | 'json') =>
      adminApiClient<ReportResponse>(`/api/v1/admin/reports/${scanId}/${format}`, {
        method: 'POST',
        body: JSON.stringify({}), // Empty body required for Fastify JSON content-type
      }),
  },

  batches: {
    /**
     * List all batches with filtering and pagination
     * @param filters - Filter and pagination parameters
     * @returns List of batches with summary
     */
    list: (filters?: AdminBatchFilters) => {
      const query = buildQueryString((filters || {}) as Record<string, unknown>);
      return adminApiClient<AdminBatchListResponse>(`/api/v1/admin/batches${query}`);
    },

    /**
     * Get detailed information for a specific batch
     * @param batchId - Batch ID
     * @returns Batch details with individual URL scans
     */
    get: (batchId: string) =>
      adminApiClient<AdminBatchDetail>(`/api/v1/admin/batches/${batchId}`),

    /**
     * Cancel a running batch scan
     * Preserves results of completed scans, stops pending scans
     * @param batchId - Batch ID
     */
    cancel: (batchId: string) =>
      adminApiClient<void>(`/api/v1/admin/batches/${batchId}/cancel`, {
        method: 'POST',
      }),

    /**
     * Delete a batch and all associated scan data
     * @param batchId - Batch ID
     */
    delete: (batchId: string) =>
      adminApiClient<void>(`/api/v1/admin/batches/${batchId}`, {
        method: 'DELETE',
      }),

    /**
     * Retry all failed scans in a batch
     * @param batchId - Batch ID
     */
    retry: (batchId: string) =>
      adminApiClient<void>(`/api/v1/admin/batches/${batchId}/retry`, {
        method: 'POST',
      }),

    /**
     * Export batch results to CSV (synchronous, returns blob)
     * @param batchId - Batch ID
     * @param format - Export format: 'csv'
     * @returns Data as blob
     */
    exportCsv: async (batchId: string) => {
      const url = `${env.apiUrl}/api/v1/admin/batches/${batchId}/export?format=csv`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      return response.blob();
    },

    /**
     * Request batch export with async job support (PDF or JSON)
     *
     * If report already exists and is ready, returns presigned URL.
     * If report needs to be generated, queues job and returns 'generating' status.
     *
     * @param batchId - Batch ID
     * @param format - Export format: 'pdf' or 'json'
     * @returns Export status with URL if ready, or reportId if generating
     *
     * @example
     * ```ts
     * const response = await adminApi.batches.requestExport('batch_abc123', 'pdf');
     *
     * if (response.status === 'ready') {
     *   window.location.href = response.url; // Download file
     * } else if (response.status === 'generating') {
     *   // Poll getExportStatus() until ready
     *   console.log('Report is being generated...');
     * }
     * ```
     */
    requestExport: async (
      batchId: string,
      format: BatchExportFormat
    ): Promise<BatchExportResponse> => {
      const url = `${env.apiUrl}/api/v1/admin/batches/${batchId}/export?format=${format}`;

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      const json = await response.json().catch(() => ({}));

      // 200 = ready, 202 = generating
      if (response.status === 200 || response.status === 202) {
        if (json.success && json.data) {
          return json.data as BatchExportResponse;
        }
        // Handle failed status in successful response
        if (!json.success && json.data) {
          return json.data as BatchExportFailedResponse;
        }
      }

      // Error case
      if (!response.ok) {
        throw new Error(json.error || json.message || `API error: ${response.status}`);
      }

      // Fallback - shouldn't happen
      throw new Error('Unexpected response format');
    },

    /**
     * Get batch export status
     *
     * Poll this endpoint to check if async export is complete.
     *
     * @param batchId - Batch ID
     * @param format - Export format: 'pdf' or 'json'
     * @returns Export status with URL if ready
     *
     * @example
     * ```ts
     * const status = await adminApi.batches.getExportStatus('batch_abc123', 'pdf');
     *
     * if (status.status === 'ready') {
     *   window.location.href = status.url; // Download file
     * } else if (status.status === 'generating') {
     *   // Still generating, poll again after delay
     * } else {
     *   console.error('Export failed:', status.errorMessage);
     * }
     * ```
     */
    getExportStatus: async (
      batchId: string,
      format: BatchExportFormat
    ): Promise<BatchExportResponse> => {
      const url = `${env.apiUrl}/api/v1/admin/batches/${batchId}/export/status?format=${format}`;

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      const json = await response.json().catch(() => ({}));

      if (response.ok && json.data) {
        return json.data as BatchExportResponse;
      }

      // Error case
      throw new Error(json.error || json.message || `API error: ${response.status}`);
    },

    /**
     * Get batch metrics for dashboard
     * @returns Batch metrics including totals, averages, and trends
     */
    getMetrics: () =>
      adminApiClient<BatchMetricsResponse>('/api/v1/admin/dashboard/batches'),
  },

  aiCampaign: {
    /**
     * Get AI campaign metrics for admin dashboard
     * @returns Campaign metrics including token budget, usage, and scan counts
     */
    getMetrics: () =>
      adminApiClient<AiCampaignMetrics>('/api/v1/admin/ai-campaign'),

    /**
     * List AI scans with filtering and pagination
     * @param filters - Filter and pagination parameters
     * @returns List of AI scans with stats
     */
    listQueue: (filters?: AiQueueFilters) => {
      const query = buildQueryString((filters || {}) as Record<string, unknown>);
      return adminApiClient<AiQueueListResponse>(`/api/v1/admin/ai-queue${query}`);
    },

    /**
     * Get queue statistics
     * @returns Queue stats by status
     */
    getQueueStats: () =>
      adminApiClient<AiQueueStats>('/api/v1/admin/ai-queue/stats'),

    /**
     * Export pending AI scans as CSV for offline processing
     * @returns CSV data as blob
     */
    exportPendingScans: async () => {
      const url = `${env.apiUrl}/api/v1/admin/ai-queue/export`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      return response.blob();
    },

    /**
     * Import AI results from CSV file
     * @param file - CSV file containing AI processing results
     * @returns Import result with success/failure counts
     */
    importResults: async (file: File) => {
      const url = `${env.apiUrl}/api/v1/admin/ai-queue/import`;
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json.success) {
        throw new Error(json.error || json.message || `Import failed: ${response.status}`);
      }

      return json.data as AiImportResult;
    },

    /**
     * Pause the AI campaign
     * Stops accepting new AI scan requests
     */
    pause: () =>
      adminApiClient<void>('/api/v1/admin/ai-campaign/pause', {
        method: 'POST',
        body: JSON.stringify({}),
      }),

    /**
     * Resume the AI campaign
     * Starts accepting new AI scan requests again
     */
    resume: () =>
      adminApiClient<void>('/api/v1/admin/ai-campaign/resume', {
        method: 'POST',
        body: JSON.stringify({}),
      }),

    /**
     * Retry a failed AI scan
     * Resets the scan's AI status to PENDING for reprocessing
     * @param scanId - Scan ID to retry
     */
    retryScan: (scanId: string) =>
      adminApiClient<void>(`/api/v1/admin/ai-queue/${scanId}/retry`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
  },
};
