import { env } from './env';
import type { GetEventsResponse, GetEventsOptions } from '@/types/scan-event';
import { pushToDataLayer, sanitizeError, sanitizeUrl } from './analytics';
import { getConsent } from './consent';

/**
 * Type definitions for API requests and responses
 */

// Scan API types
export interface CreateScanRequest {
  url: string;
  email?: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  recaptchaToken: string;
  aiEnabled?: boolean;
}

/**
 * Scan status values from API (uppercase)
 */
export type ScanStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface CreateScanResponse {
  scanId: string;
  status: ScanStatus;
  url: string;
}

export interface ScanStatusResponse {
  scanId: string;
  status: ScanStatus;
  progress?: number;
  url: string;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  aiEnabled?: boolean;
  email?: string;
}

/**
 * Issue node from axe-core scan
 */
export interface IssueNode {
  html: string;
  target: string[];
  failureSummary: string;
}

/**
 * Fix guide for accessibility issues
 */
export interface FixGuide {
  ruleId: string;
  summary: string;
  codeExample: {
    before: string;
    after: string;
  };
  steps: string[];
  wcagLink: string;
}

/**
 * Enriched issue with fix guide
 */
export interface EnrichedIssue {
  id: string;
  scanResultId: string;
  ruleId: string;
  wcagCriteria: string[];
  impact: 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR';
  description: string;
  helpText: string;
  helpUrl: string;
  htmlSnippet: string;
  cssSelector: string;
  nodes: IssueNode[];
  createdAt: string;
  fixGuide?: FixGuide;
  // AI Enhancement Fields (REQ-6 AC 3-4)
  aiExplanation?: string | null;
  aiFixSuggestion?: string | null;
  aiPriority?: number | null;
}

/**
 * Issues grouped by severity impact
 */
export interface IssuesByImpact {
  critical: EnrichedIssue[];
  serious: EnrichedIssue[];
  moderate: EnrichedIssue[];
  minor: EnrichedIssue[];
}

/**
 * Result metadata
 */
export interface ResultMetadata {
  coverageNote: string;
  wcagVersion: string;
  toolVersion: string;
  scanDuration: number;
  inapplicableChecks: number;
}

export interface ScanResultResponse {
  scanId: string;
  url: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  completedAt: string;
  summary: {
    totalIssues: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    passed: number;
  };
  issuesByImpact: IssuesByImpact;
  metadata: ResultMetadata;
}

export interface ScanListResponse {
  scans: Array<{
    id: string;
    url: string;
    status: ScanStatus;
    wcagLevel: 'A' | 'AA' | 'AAA';
    createdAt: string;
    completedAt: string | null;
  }>;
  nextCursor: string | null;
  total: number;
}

// Report API types
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

// AI Campaign API types
/**
 * Status of a specific AI analysis task for a scan
 */
export type AiTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Individual AI analysis task for a scan
 */
export interface AiTask {
  taskType: string;
  status: AiTaskStatus;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

/**
 * AI processing status for a single scan
 */
export interface AiScanStatus {
  scanId: string;
  aiEnabled: boolean;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  summary?: string | null;
  remediationPlan?: string | null;
  processedAt?: string | null;
  metrics?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    model: string;
    processingTime: number;
  } | null;
}

/**
 * Overall AI campaign statistics and status
 *
 * Provides campaign status, slot availability, and urgency indicators.
 * Used for displaying campaign status to users and making reservation decisions.
 */
export interface CampaignStatusResponse {
  /** Whether the campaign is currently active */
  active: boolean;
  /** Number of slots still available */
  slotsRemaining: number;
  /** Total slots allocated for campaign */
  totalSlots: number;
  /** Percentage of slots remaining (0-100) */
  percentRemaining: number;
  /** Visual urgency indicator for UI */
  urgencyLevel: 'normal' | 'limited' | 'almost_gone' | 'final' | 'depleted';
  /** Human-readable status message */
  message: string;
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
 * Generic API client function
 * Unwraps the { success, data } response format from the API
 */
export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${env.apiUrl}${endpoint}`;

  try {
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
      const errorMessage = json.error || json.message || `API error: ${response.status}`;
      const errorCode = json.code || String(response.status);

      // Track API error if analytics consent granted
      if (getConsent().analytics) {
        pushToDataLayer({
          event: 'error_api',
          timestamp: new Date().toISOString(),
          sessionId: '', // Will be populated by session tracking
          error_code: errorCode,
          error_message: sanitizeError(errorMessage),
          endpoint: sanitizeUrl(url),
        });
      }

      throw new Error(errorMessage);
    }

    // Unwrap the data property from the API response
    return json.data as T;
  } catch (error) {
    // If error was not already tracked (e.g., network error, JSON parse error)
    if (error instanceof Error && !error.message.startsWith('API error:')) {
      if (getConsent().analytics) {
        pushToDataLayer({
          event: 'error_api',
          timestamp: new Date().toISOString(),
          sessionId: '', // Will be populated by session tracking
          error_code: 'network_error',
          error_message: sanitizeError(error.message),
          endpoint: sanitizeUrl(url),
        });
      }
    }

    throw error;
  }
}

/**
 * Typed API methods
 */
export const api = {
  scans: {
    create: (data: CreateScanRequest) =>
      apiClient<CreateScanResponse>('/api/v1/scans', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getStatus: (id: string) =>
      apiClient<ScanStatusResponse>(`/api/v1/scans/${id}`),
    getResult: (id: string) =>
      apiClient<ScanResultResponse>(`/api/v1/scans/${id}/result`),
    list: (cursor?: string) =>
      apiClient<ScanListResponse>(
        `/api/v1/scans${cursor ? `?cursor=${cursor}` : ''}`
      ),
    getEvents: (scanId: string, options?: GetEventsOptions) => {
      const params = new URLSearchParams();
      if (options?.since) {
        params.set('since', options.since);
      }
      if (options?.limit !== undefined) {
        params.set('limit', options.limit.toString());
      }
      const queryString = params.toString();
      return apiClient<GetEventsResponse>(
        `/api/v1/scans/${scanId}/events${queryString ? `?${queryString}` : ''}`
      );
    },
    getReportStatus: (scanId: string) =>
      apiClient<ReportStatusResponse>(`/api/v1/scans/${scanId}/reports`),
  },
  reports: {
    get: (scanId: string, format: 'pdf' | 'json') =>
      apiClient<ReportResponse>(`/api/v1/reports/${scanId}/${format}`),
  },
  sessions: {
    delete: (token: string) =>
      apiClient<void>(`/api/v1/sessions/${token}`, { method: 'DELETE' }),
  },
  aiCampaign: {
    /**
     * Get overall AI campaign status and statistics
     */
    getStatus: () =>
      apiClient<CampaignStatusResponse>('/api/v1/ai-campaign/status'),
    /**
     * Get AI processing status for a specific scan
     */
    getAiStatus: (scanId: string) =>
      apiClient<AiScanStatus>(`/api/v1/scans/${scanId}/ai-status`),
  },
};
