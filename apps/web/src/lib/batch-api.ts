import { env } from './env';

/**
 * Type definitions for Batch API requests and responses
 */

// Batch scan status values from API (uppercase)
export type BatchStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'STALE';

/**
 * Request body for creating a batch scan
 */
export interface CreateBatchRequest {
  urls: string[]; // 1-50 URLs
  wcagLevel?: 'A' | 'AA' | 'AAA';
  recaptchaToken: string;
  discoveryId?: string; // Optional link to discovery session
  pageTitles?: Record<string, string>; // URL -> title mapping
  email?: string; // Email for AI scan notifications
  aiEnabled?: boolean; // Enable AI-powered validation
}

/**
 * Response when creating a batch scan
 */
export interface CreateBatchResponse {
  batchId: string;
  status: BatchStatus;
  totalUrls: number;
  homepageUrl: string;
  scanIds: string[]; // Individual scan IDs
}

/**
 * Status information for a single scan within a batch
 */
export interface BatchScanInfo {
  id: string;
  url: string;
  pageTitle?: string | null;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  errorMessage?: string | null;
  completedAt?: string | null;
}

/**
 * Batch status response with progress information
 */
export interface BatchStatusResponse {
  batchId: string;
  status: BatchStatus;
  homepageUrl: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  totalUrls: number;
  completedCount: number;
  failedCount: number;
  progress?: number; // 0-100, computed client-side
  urls: BatchScanInfo[];
  createdAt: string;
  completedAt: string | null;
  cancelledAt?: string | null;
}

/**
 * Issue summary for a single URL in batch results
 */
export interface UrlIssueSummary {
  scanId: string;
  url: string;
  pageTitle?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  errorMessage?: string;
  issues?: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

/**
 * Top critical URL information
 */
export interface TopCriticalUrl {
  scanId: string;
  url: string;
  pageTitle?: string | null;
  criticalCount: number;
}

/**
 * Per-URL breakdown in batch results
 */
export interface UrlIssueSummaryDetailed {
  id: string;
  url: string;
  status: string;
  pageTitle: string | null;
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  errorMessage: string | null;
  /** Whether AI analysis is enabled for this scan */
  aiEnabled?: boolean;
  /** Current AI processing status */
  aiStatus?: 'PENDING' | 'PROCESSING' | 'DOWNLOADED' | 'COMPLETED' | 'FAILED' | null;
}

/**
 * Aggregate statistics for batch results
 */
export interface BatchAggregateStats {
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  passedChecks: number;
  urlsScanned: number;
}

/**
 * Coverage metrics for batch results (Enhanced Trust Indicators)
 */
export interface BatchCoverageMetrics {
  /** Average coverage percentage across all scans */
  averageCoveragePercentage: number;
  /** Total unique criteria checked across batch */
  totalCriteriaChecked: number;
  /** Total WCAG criteria for the conformance level */
  totalCriteriaTotal: number;
  /** Number of AI-enhanced scans */
  aiEnhancedCount: number;
  /** Number of standard scans */
  standardCount: number;
  /** Whether any scans are AI-enhanced */
  hasAiEnhanced: boolean;
}

/**
 * Aggregate batch results response
 */
export interface BatchResultsResponse {
  batchId: string;
  status: BatchStatus;
  homepageUrl: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  totalUrls: number;
  completedCount: number;
  failedCount: number;
  createdAt: string;
  completedAt: string | null;
  aggregate: BatchAggregateStats;
  urls: UrlIssueSummaryDetailed[];
  topCriticalUrls: TopCriticalUrl[];
  /** Coverage metrics (Enhanced Trust Indicators) */
  coverage?: BatchCoverageMetrics;
}

/**
 * Pagination parameters for batch listing
 */
export interface PaginationParams {
  page?: number; // Default: 1
  limit?: number; // Default: 20, max: 100
}

/**
 * Pagination metadata in list response
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

/**
 * List batches response with pagination
 */
export interface BatchListResponse {
  batches: BatchStatusResponse[];
  pagination: PaginationMeta;
}

/**
 * API response wrapper type
 * All API responses follow this format
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

/**
 * Generic API client function for batch endpoints
 * Unwraps the { success, data } response format from the API
 */
async function batchApiClient<T>(
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

  const json: ApiResponse<T> = await response.json().catch(() => ({}));

  if (!response.ok || !json.success) {
    throw new Error(json.error || json.message || `API error: ${response.status}`);
  }

  // Unwrap the data property from the API response
  return json.data as T;
}

/**
 * Create a new batch scan
 *
 * @param data - Batch creation request (urls, wcagLevel, recaptchaToken)
 * @returns Batch ID and initial status
 *
 * @example
 * ```ts
 * const batch = await createBatch({
 *   urls: ['https://example.com', 'https://example.com/about'],
 *   wcagLevel: 'AA',
 *   recaptchaToken: 'abc123...'
 * });
 * console.log(batch.batchId); // 'batch_abc123'
 * ```
 */
export async function createBatch(
  data: CreateBatchRequest
): Promise<CreateBatchResponse> {
  return batchApiClient<CreateBatchResponse>('/api/v1/batches', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get batch status with individual scan statuses
 *
 * @param batchId - Unique batch identifier
 * @returns Current batch status and progress
 *
 * @example
 * ```ts
 * const status = await getBatchStatus('batch_abc123');
 * console.log(`Progress: ${status.progress}%`);
 * console.log(`Completed: ${status.completedCount}/${status.totalUrls}`);
 * ```
 */
export async function getBatchStatus(
  batchId: string
): Promise<BatchStatusResponse> {
  return batchApiClient<BatchStatusResponse>(`/api/v1/batches/${batchId}`);
}

/**
 * Get aggregated results for a completed batch
 *
 * @param batchId - Unique batch identifier
 * @returns Aggregate statistics and scan results
 *
 * @example
 * ```ts
 * const results = await getBatchResults('batch_abc123');
 * console.log(`Total issues: ${results.totalIssues}`);
 * console.log(`Critical: ${results.criticalCount}`);
 * ```
 */
export async function getBatchResults(
  batchId: string
): Promise<BatchResultsResponse> {
  return batchApiClient<BatchResultsResponse>(
    `/api/v1/batches/${batchId}/results`
  );
}

/**
 * Cancel a running batch scan
 * Preserves results of completed scans, stops pending scans
 *
 * @param batchId - Unique batch identifier
 * @returns void
 *
 * @example
 * ```ts
 * await cancelBatch('batch_abc123');
 * // Batch status will be updated to CANCELLED
 * ```
 */
export async function cancelBatch(batchId: string): Promise<void> {
  return batchApiClient<void>(`/api/v1/batches/${batchId}/cancel`, {
    method: 'POST',
  });
}

/**
 * List batches for the current session with pagination
 *
 * @param params - Pagination parameters (page, limit)
 * @returns Paginated list of batch scans
 *
 * @example
 * ```ts
 * const response = await listBatches({ page: 1, limit: 20 });
 * console.log(`Found ${response.pagination.totalItems} batches`);
 * response.batches.forEach(batch => {
 *   console.log(`${batch.homepageUrl}: ${batch.status}`);
 * });
 * ```
 */
export async function listBatches(
  params?: PaginationParams
): Promise<BatchListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page !== undefined) {
    queryParams.set('page', params.page.toString());
  }
  if (params?.limit !== undefined) {
    queryParams.set('limit', params.limit.toString());
  }

  const queryString = queryParams.toString();
  return batchApiClient<BatchListResponse>(
    `/api/v1/batches${queryString ? `?${queryString}` : ''}`
  );
}

// ============================================================================
// BATCH EXPORT API
// ============================================================================

/**
 * Export format options
 */
export type BatchExportFormat = 'pdf' | 'json';

/**
 * Export status values
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
  errorMessage?: string;
  reportId?: string;
}

/**
 * Unified batch export response type
 */
export type BatchExportResponse =
  | BatchExportReadyResponse
  | BatchExportGeneratingResponse
  | BatchExportFailedResponse;

/**
 * Request batch export with async job support
 *
 * If report already exists and is ready, returns presigned URL.
 * If report needs to be generated, queues job and returns 'generating' status.
 *
 * @param batchId - Unique batch identifier
 * @param format - Export format ('pdf' or 'json')
 * @returns Export status with URL if ready, or reportId if generating
 *
 * @example
 * ```ts
 * const response = await requestBatchExport('batch_abc123', 'pdf');
 *
 * if (response.status === 'ready') {
 *   window.location.href = response.url; // Download file
 * } else if (response.status === 'generating') {
 *   // Poll getBatchExportStatus() until ready
 *   console.log('Report is being generated...');
 * }
 * ```
 */
export async function requestBatchExport(
  batchId: string,
  format: BatchExportFormat
): Promise<BatchExportResponse> {
  const url = `${env.apiUrl}/api/v1/batches/${batchId}/export?format=${format}`;

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include', // For session cookies
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
}

/**
 * Get batch export status
 *
 * Poll this endpoint to check if async export is complete.
 *
 * @param batchId - Unique batch identifier
 * @param format - Export format ('pdf' or 'json')
 * @returns Export status with URL if ready
 *
 * @example
 * ```ts
 * const status = await getBatchExportStatus('batch_abc123', 'pdf');
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
export async function getBatchExportStatus(
  batchId: string,
  format: BatchExportFormat
): Promise<BatchExportResponse> {
  const url = `${env.apiUrl}/api/v1/batches/${batchId}/export/status?format=${format}`;

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include', // For session cookies
  });

  const json = await response.json().catch(() => ({}));

  if (response.ok && json.data) {
    return json.data as BatchExportResponse;
  }

  // Error case
  throw new Error(json.error || json.message || `API error: ${response.status}`);
}

/**
 * Typed batch API methods
 * Provides a convenient namespace for batch operations
 */
export const batchApi = {
  create: createBatch,
  getStatus: getBatchStatus,
  getResults: getBatchResults,
  cancel: cancelBatch,
  list: listBatches,
  // Export operations
  requestExport: requestBatchExport,
  getExportStatus: getBatchExportStatus,
};
