import { env } from './env';
import type { GetEventsResponse, GetEventsOptions } from '@/types/scan-event';

/**
 * Type definitions for API requests and responses
 */

// Scan API types
export interface CreateScanRequest {
  url: string;
  email?: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  recaptchaToken: string;
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
  },
  reports: {
    get: (scanId: string, format: 'pdf' | 'json') =>
      apiClient<ReportResponse>(`/api/v1/reports/${scanId}/${format}`),
  },
  sessions: {
    delete: (token: string) =>
      apiClient<void>(`/api/v1/sessions/${token}`, { method: 'DELETE' }),
  },
};
