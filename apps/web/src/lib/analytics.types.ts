/**
 * Analytics Type Definitions
 *
 * Type-safe definitions for Google Analytics 4 (GA4) event tracking
 * integrated via Google Tag Manager (GTM).
 *
 * These types ensure consistent event structures across the application
 * and provide compile-time type checking for analytics operations.
 */

// ============================================================================
// BASE TYPES
// ============================================================================

/**
 * WCAG conformance level
 */
export type WcagLevel = 'A' | 'AA' | 'AAA';

/**
 * Scan type classification
 */
export type ScanType = 'single' | 'batch';

/**
 * Report export format
 */
export type ReportFormat = 'pdf' | 'json';

/**
 * Report type classification
 */
export type ReportType = 'single' | 'batch';

/**
 * Issue severity level
 */
export type IssueSeverity = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 * User registration method
 */
export type RegistrationMethod = 'email' | 'google' | 'github';

/**
 * User login method
 */
export type LoginMethod = 'email' | 'google' | 'github';

/**
 * Session type classification
 */
export type SessionType = 'new' | 'return';

/**
 * API error types
 */
export type ApiErrorType = 'network' | 'validation' | 'server' | 'timeout' | 'unknown';

/**
 * JavaScript error types
 */
export type JsErrorType = 'runtime' | 'promise' | 'resource' | 'syntax' | 'unknown';

// ============================================================================
// BASE EVENT INTERFACE
// ============================================================================

/**
 * Base analytics event structure
 * All analytics events extend from this base interface
 */
export interface BaseAnalyticsEvent {
  /** Event name identifier */
  event: string;
  /** ISO 8601 timestamp when event occurred */
  timestamp: string;
  /** User session identifier for tracking user journeys */
  sessionId: string;
}

// ============================================================================
// SCAN EVENTS (Requirement 4)
// ============================================================================

/**
 * Event fired when a user initiates a scan
 * Tracks scan configuration and user intent
 */
export interface ScanInitiatedEvent extends BaseAnalyticsEvent {
  event: 'scan_initiated';
  /** WCAG conformance level selected */
  wcag_level: WcagLevel;
  /** Type of scan being performed */
  scan_type: ScanType;
  /** Number of URLs being scanned (1 for single, >1 for batch) */
  url_count: number;
}

/**
 * Issue count breakdown by severity
 */
export interface IssueCountBySeverity {
  /** Number of critical severity issues */
  critical: number;
  /** Number of serious severity issues */
  serious: number;
  /** Number of moderate severity issues */
  moderate: number;
  /** Number of minor severity issues */
  minor: number;
}

/**
 * Event fired when a scan completes successfully
 * Tracks scan performance and results
 */
export interface ScanCompletedEvent extends BaseAnalyticsEvent {
  event: 'scan_completed';
  /** Time taken to complete scan in milliseconds */
  scan_duration_ms: number;
  /** Breakdown of issues found by severity level */
  issue_count: IssueCountBySeverity;
  /** WCAG conformance level used for scan */
  wcag_level: WcagLevel;
}

/**
 * Event fired when a user exports a report
 * Tracks report generation and export preferences
 */
export interface ReportExportedEvent extends BaseAnalyticsEvent {
  event: 'report_exported';
  /** Format of exported report */
  format: ReportFormat;
  /** Type of report being exported */
  report_type: ReportType;
}

/**
 * Result type for sharing (scan or batch)
 */
export type ResultType = 'scan' | 'batch';

/**
 * Share method classification
 */
export type ShareMethod = 'link' | 'social' | 'email';

/**
 * Event fired when a user shares a result
 * Tracks result sharing and distribution
 */
export interface ResultSharedEvent extends BaseAnalyticsEvent {
  event: 'result_shared';
  /** Type of result being shared */
  result_type: ResultType;
  /** ID of the result being shared */
  result_id: string;
  /** Method used for sharing */
  share_method: ShareMethod;
}

/**
 * Code type classification for copy events
 */
export type CodeType = 'html_snippet' | 'fix_example';

/**
 * Event fired when a user copies code snippets
 * Tracks usage of copy functionality in issue cards
 */
export interface CodeCopiedEvent extends BaseAnalyticsEvent {
  event: 'code_copied';
  /** Type of code being copied */
  code_type: CodeType;
}

/**
 * Event fired when a user signs up
 * Tracks user acquisition sources
 */
export interface SignUpEvent extends BaseAnalyticsEvent {
  event: 'sign_up';
  /** Method used for registration */
  method: RegistrationMethod;
  /** Referral source (UTM parameters, direct, etc.) */
  referral_source: string | null;
}

/**
 * Event fired when a user logs in
 * Tracks user engagement and session types
 */
export interface LoginEvent extends BaseAnalyticsEvent {
  event: 'login';
  /** Method used for login */
  method: LoginMethod;
  /** Whether this is a new or returning session */
  session_type: SessionType;
}

// ============================================================================
// FUNNEL EVENTS (Requirement 5)
// ============================================================================

/**
 * Base funnel event interface
 * All funnel events extend from this to ensure funnel_session_id is tracked
 */
export interface BaseFunnelEvent extends BaseAnalyticsEvent {
  /** Unique identifier to correlate events in the same funnel journey */
  funnel_session_id: string;
}

/**
 * Event fired when scan form is viewed
 * First step in scan funnel
 */
export interface FunnelScanFormViewedEvent extends BaseFunnelEvent {
  event: 'funnel_scan_form_viewed';
}

/**
 * Event fired when user enters URL in scan form
 * Second step in scan funnel
 */
export interface FunnelScanUrlEnteredEvent extends BaseFunnelEvent {
  event: 'funnel_scan_url_entered';
}

/**
 * Event fired when user submits scan
 * Third step in scan funnel
 */
export interface FunnelScanSubmittedEvent extends BaseFunnelEvent {
  event: 'funnel_scan_submitted';
}

/**
 * Event fired when user views scan results
 * Fourth step in scan funnel
 */
export interface FunnelScanResultsViewedEvent extends BaseFunnelEvent {
  event: 'funnel_scan_results_viewed';
}

/**
 * Event fired when user downloads report
 * Final step in scan funnel
 */
export interface FunnelReportDownloadedEvent extends BaseFunnelEvent {
  event: 'funnel_report_downloaded';
}

/**
 * Event fired when user starts signup process
 * First step in signup funnel
 */
export interface FunnelSignupStartedEvent extends BaseFunnelEvent {
  event: 'funnel_signup_started';
}

/**
 * Event fired when user completes signup
 * Second step in signup funnel
 */
export interface FunnelSignupCompletedEvent extends BaseFunnelEvent {
  event: 'funnel_signup_completed';
}

/**
 * Event fired when user performs first scan after signup
 * Final step in signup funnel
 */
export interface FunnelFirstScanEvent extends BaseFunnelEvent {
  event: 'funnel_first_scan';
}

/**
 * Union type of all funnel events
 * Useful for funnel-specific handlers
 */
export type FunnelEvent =
  | FunnelScanFormViewedEvent
  | FunnelScanUrlEnteredEvent
  | FunnelScanSubmittedEvent
  | FunnelScanResultsViewedEvent
  | FunnelReportDownloadedEvent
  | FunnelSignupStartedEvent
  | FunnelSignupCompletedEvent
  | FunnelFirstScanEvent;

// ============================================================================
// ERROR AND PERFORMANCE EVENTS (Requirement 6)
// ============================================================================

/**
 * Event fired when an API error occurs
 * Tracks backend errors for reliability monitoring
 */
export interface ErrorApiEvent extends BaseAnalyticsEvent {
  event: 'error_api';
  /** HTTP status code or custom error code */
  error_code: string;
  /** Sanitized error message (no PII) */
  error_message: string;
  /** API endpoint where error occurred */
  endpoint: string;
}

/**
 * Event fired when a JavaScript error occurs
 * Tracks frontend errors for stability monitoring
 */
export interface ErrorJsEvent extends BaseAnalyticsEvent {
  event: 'error_js';
  /** Type of JavaScript error */
  error_type: JsErrorType;
  /** Sanitized error message (no PII) */
  error_message: string;
  /** Component or context where error occurred */
  component: string;
}

/**
 * Core Web Vitals metrics
 * Performance metrics for user experience monitoring
 */
export interface WebVitalsMetrics {
  /** Largest Contentful Paint in milliseconds */
  lcp: number | null;
  /** First Input Delay in milliseconds */
  fid: number | null;
  /** Cumulative Layout Shift score */
  cls: number | null;
}

/**
 * Event fired when Core Web Vitals are measured
 * Tracks frontend performance metrics
 */
export interface WebVitalsEvent extends BaseAnalyticsEvent {
  event: 'web_vitals';
  /** Core Web Vitals performance metrics */
  metrics: WebVitalsMetrics;
}

// ============================================================================
// UI/UX IMPROVEMENT EVENTS (Customer UI/UX Improvement Specification)
// ============================================================================

/**
 * Issue list interaction event types
 */
export type IssueListAction =
  | 'expand_all'
  | 'collapse_all'
  | 'card_expanded'
  | 'card_collapsed';

/**
 * Event fired when user interacts with issue list controls
 * Tracks usage of expand/collapse functionality
 */
export interface IssueListInteractionEvent extends BaseAnalyticsEvent {
  event: 'issue_expand_all' | 'issue_collapse_all' | 'issue_card_expanded' | 'issue_card_collapsed';
  /** Number of issues in the list */
  issue_count: number;
  /** Issue ID for card-specific events */
  issue_id?: string;
}

/**
 * Event fired when user applies severity filter
 * Tracks filter usage patterns
 */
export interface IssueSeverityFilterEvent extends BaseAnalyticsEvent {
  event: 'issue_severity_filter';
  /** Selected severity levels */
  severities: IssueSeverity[];
  /** Number of matching issues after filter */
  filtered_count: number;
  /** Total number of issues */
  total_count: number;
}

/**
 * Event fired when user searches issues
 */
export interface IssueSearchEvent extends BaseAnalyticsEvent {
  event: 'issue_search';
  /** Search query (truncated for privacy) */
  query_length: number;
  /** Number of matching issues */
  result_count: number;
}

/**
 * Clipboard copy target types
 */
export type ClipboardCopyTarget = 'url' | 'code_snippet' | 'selector' | 'share_link';

/**
 * Event fired when user copies content to clipboard
 * Tracks copy functionality usage
 */
export interface ClipboardCopyEvent extends BaseAnalyticsEvent {
  event: 'url_copied' | 'code_snippet_copied' | 'selector_copied' | 'share_link_copied';
  /** Type of content copied */
  copy_target: ClipboardCopyTarget;
  /** Whether copy was successful */
  success: boolean;
}

/**
 * Event fired when clipboard access is denied and fallback is shown
 */
export interface ClipboardFallbackEvent extends BaseAnalyticsEvent {
  event: 'clipboard_fallback_shown';
  /** Type of content that triggered fallback */
  copy_target: ClipboardCopyTarget;
}

/**
 * Event fired when share link button is clicked
 */
export interface ShareLinkClickedEvent extends BaseAnalyticsEvent {
  event: 'share_link_clicked';
  /** Type of result being shared */
  result_type: ResultType;
  /** ID of the result */
  result_id: string;
}

/**
 * Discovery step identifiers
 */
export type DiscoveryStep = 'url_entry' | 'discovering' | 'select_pages' | 'review';

/**
 * Event fired when user views a discovery step
 */
export interface DiscoveryStepViewedEvent extends BaseAnalyticsEvent {
  event: 'discovery_step_viewed';
  /** Current step in the discovery flow */
  step: DiscoveryStep;
  /** Step number (1-based) */
  step_number: number;
}

/**
 * Event fired when user navigates back in discovery flow
 */
export interface DiscoveryStepBackEvent extends BaseAnalyticsEvent {
  event: 'discovery_step_back';
  /** Step navigating from */
  from_step: DiscoveryStep;
  /** Step navigating to */
  to_step: DiscoveryStep;
}

/**
 * Event fired when cache prompt is shown or user makes a choice
 */
export interface DiscoveryCacheEvent extends BaseAnalyticsEvent {
  event: 'discovery_cache_prompt_shown' | 'discovery_cache_refreshed' | 'discovery_cache_reused';
  /** Age of cached results in minutes */
  cache_age_minutes: number;
  /** Number of pages in cache */
  cached_page_count: number;
}

/**
 * Event fired when user selects pages for batch scan
 */
export interface DiscoveryPagesSelectedEvent extends BaseAnalyticsEvent {
  event: 'discovery_pages_selected';
  /** Number of pages selected */
  selected_count: number;
  /** Total number of discovered pages */
  total_count: number;
}

/**
 * Event fired when discovery summary is viewed
 */
export interface DiscoverySummaryViewedEvent extends BaseAnalyticsEvent {
  event: 'discovery_summary_viewed';
  /** Number of pages discovered */
  page_count: number;
  /** URL that was discovered */
  base_url_domain: string;
}

/**
 * Batch scan URL status
 */
export type BatchUrlStatus = 'pending' | 'scanning' | 'completed' | 'failed';

/**
 * Event fired when user toggles a status group
 */
export interface BatchStatusGroupEvent extends BaseAnalyticsEvent {
  event: 'batch_status_group_toggled';
  /** Status group that was toggled */
  status: BatchUrlStatus;
  /** Whether group is now expanded */
  expanded: boolean;
  /** Number of URLs in the group */
  url_count: number;
}

/**
 * Event fired when user views partial batch results
 */
export interface BatchResultsPreviewEvent extends BaseAnalyticsEvent {
  event: 'batch_results_preview_viewed';
  /** Number of completed scans */
  completed_count: number;
  /** Total number of URLs in batch */
  total_count: number;
}

/**
 * Batch sort options
 */
export type BatchSortOption = 'url' | 'issue_count' | 'severity' | 'status';

/**
 * Event fired when user changes batch result sorting
 */
export interface BatchSortChangedEvent extends BaseAnalyticsEvent {
  event: 'batch_sort_changed';
  /** Sort field selected */
  sort_by: BatchSortOption;
  /** Sort direction */
  sort_order: 'asc' | 'desc';
}

/**
 * Event fired when user views a failed URL's details
 */
export interface BatchUrlFailureViewedEvent extends BaseAnalyticsEvent {
  event: 'batch_url_failure_viewed';
  /** Failure reason category */
  failure_reason: string;
}

/**
 * Event fired when aggregate stats are viewed
 */
export interface BatchAggregateStatsViewedEvent extends BaseAnalyticsEvent {
  event: 'batch_aggregate_stats_viewed';
  /** Total issues found */
  total_issues: number;
  /** Average score across batch */
  average_score: number;
  /** Number of URLs in batch */
  url_count: number;
}

/**
 * History filter types
 */
export type HistoryFilterType = 'date_range' | 'scan_type' | 'search';

/**
 * Event fired when user applies a history filter
 */
export interface HistoryFilterAppliedEvent extends BaseAnalyticsEvent {
  event: 'history_filter_applied';
  /** Type of filter applied */
  filter_type: HistoryFilterType;
}

/**
 * Event fired when date range filter changes
 */
export interface HistoryDateRangeEvent extends BaseAnalyticsEvent {
  event: 'history_date_range_changed';
  /** Start date (YYYY-MM-DD format) */
  start_date: string | null;
  /** End date (YYYY-MM-DD format) */
  end_date: string | null;
}

/**
 * Event fired when scan type filter changes
 */
export interface HistoryScanTypeFilterEvent extends BaseAnalyticsEvent {
  event: 'history_scan_type_filter';
  /** Selected scan types */
  scan_types: ScanType[];
}

/**
 * Event fired when user searches history
 */
export interface HistorySearchEvent extends BaseAnalyticsEvent {
  event: 'history_search';
  /** Search query length for privacy */
  query_length: number;
  /** Number of matching results */
  result_count: number;
}

/**
 * History sort options
 */
export type HistorySortOption = 'date' | 'issue_count' | 'url';

/**
 * Event fired when user changes history sorting
 */
export interface HistorySortChangedEvent extends BaseAnalyticsEvent {
  event: 'history_sort_changed';
  /** Sort field selected */
  sort_by: HistorySortOption;
  /** Sort direction */
  sort_order: 'asc' | 'desc';
}

/**
 * Event fired when user selects a history item
 */
export interface HistoryItemSelectedEvent extends BaseAnalyticsEvent {
  event: 'history_item_selected';
  /** Whether item is now selected */
  selected: boolean;
  /** Total selected count after action */
  total_selected: number;
}

/**
 * Event fired when user bulk deletes history items
 */
export interface HistoryBulkDeleteEvent extends BaseAnalyticsEvent {
  event: 'history_bulk_delete';
  /** Number of items deleted */
  deleted_count: number;
}

/**
 * Event fired when user clears selection
 */
export interface HistorySelectionClearedEvent extends BaseAnalyticsEvent {
  event: 'history_selection_cleared';
  /** Number of items that were selected */
  cleared_count: number;
}

/**
 * Event fired when WCAG level tooltip is viewed
 */
export interface WcagLevelTooltipEvent extends BaseAnalyticsEvent {
  event: 'wcag_level_tooltip_viewed';
  /** WCAG level being viewed */
  level: WcagLevel;
}

/**
 * Event fired when WCAG help section is expanded
 */
export interface WcagLevelHelpExpandedEvent extends BaseAnalyticsEvent {
  event: 'wcag_level_help_expanded';
}

/**
 * Event fired when WCAG level is changed
 */
export interface WcagLevelChangedEvent extends BaseAnalyticsEvent {
  event: 'wcag_level_changed';
  /** Previous level */
  from_level: WcagLevel;
  /** New level */
  to_level: WcagLevel;
}

/**
 * Empty state context
 */
export type EmptyStateContext = 'history' | 'issues' | 'discovery' | 'search_results';

/**
 * Event fired when user clicks empty state CTA
 */
export interface EmptyStateCTAClickedEvent extends BaseAnalyticsEvent {
  event: 'empty_state_cta_clicked';
  /** Context where empty state was shown */
  context: EmptyStateContext;
  /** CTA action taken */
  action: string;
}

/**
 * Skeleton context
 */
export type SkeletonContext = 'issues' | 'history' | 'batch' | 'results';

/**
 * Event fired when skeleton loader is shown
 */
export interface LoadingSkeletonEvent extends BaseAnalyticsEvent {
  event: 'loading_skeleton_shown';
  /** Context where skeleton is shown */
  context: SkeletonContext;
}

/**
 * Event fired when user clicks retry during loading
 */
export interface LoadingRetryEvent extends BaseAnalyticsEvent {
  event: 'loading_retry_clicked';
  /** Context where retry was triggered */
  context: string;
}

/**
 * Event fired when user clicks error retry
 */
export interface ErrorRetryEvent extends BaseAnalyticsEvent {
  event: 'error_retry_clicked';
  /** Error type that occurred */
  error_type: ApiErrorType;
  /** Context where error occurred */
  context: string;
}

/**
 * Event fired when user expands error details
 */
export interface ErrorDetailsExpandedEvent extends BaseAnalyticsEvent {
  event: 'error_details_expanded';
  /** Error type */
  error_type: ApiErrorType;
}

// ============================================================================
// DISCOVERY FLOW V2 EVENTS (Discovery Flow V2 Specification)
// ============================================================================

/**
 * Discovery method selection
 */
export type DiscoveryMethod = 'sitemap' | 'manual';

/**
 * Event fired when user selects a discovery method (sitemap or manual)
 */
export interface DiscoveryV2MethodSelectedEvent extends BaseAnalyticsEvent {
  event: 'discovery_v2_method_selected';
  /** Method selected by user */
  method: DiscoveryMethod;
}

/**
 * Event fired when URLs are parsed from sitemap or manual input
 */
export interface DiscoveryV2UrlsParsedEvent extends BaseAnalyticsEvent {
  event: 'discovery_v2_urls_parsed';
  /** Number of URLs parsed */
  count: number;
  /** Method used for parsing */
  method: DiscoveryMethod;
}

/**
 * Event fired when user changes URL selection
 */
export interface DiscoveryV2SelectionChangedEvent extends BaseAnalyticsEvent {
  event: 'discovery_v2_selection_changed';
  /** Number of URLs currently selected */
  selected: number;
  /** Total number of URLs available */
  total: number;
}

/**
 * Event fired when user clicks select all button
 */
export interface DiscoveryV2SelectAllClickedEvent extends BaseAnalyticsEvent {
  event: 'discovery_v2_select_all_clicked';
}

/**
 * Event fired when user clicks deselect all button
 */
export interface DiscoveryV2DeselectAllClickedEvent extends BaseAnalyticsEvent {
  event: 'discovery_v2_deselect_all_clicked';
}

/**
 * Event fired when user views the preview step
 */
export interface DiscoveryV2PreviewViewedEvent extends BaseAnalyticsEvent {
  event: 'discovery_v2_preview_viewed';
  /** Number of URLs in preview */
  url_count: number;
}

/**
 * Event fired when user starts batch scan from discovery flow
 */
export interface DiscoveryV2ScanStartedEvent extends BaseAnalyticsEvent {
  event: 'discovery_v2_scan_started';
  /** Number of URLs being scanned */
  url_count: number;
  /** Method used for URL discovery */
  method: DiscoveryMethod;
}

/**
 * Union type of all Discovery Flow V2 events
 */
export type DiscoveryV2Event =
  | DiscoveryV2MethodSelectedEvent
  | DiscoveryV2UrlsParsedEvent
  | DiscoveryV2SelectionChangedEvent
  | DiscoveryV2SelectAllClickedEvent
  | DiscoveryV2DeselectAllClickedEvent
  | DiscoveryV2PreviewViewedEvent
  | DiscoveryV2ScanStartedEvent;

/**
 * Union type of all UI/UX improvement events
 */
export type UIUXEvent =
  | IssueListInteractionEvent
  | IssueSeverityFilterEvent
  | IssueSearchEvent
  | ClipboardCopyEvent
  | ClipboardFallbackEvent
  | ShareLinkClickedEvent
  | DiscoveryStepViewedEvent
  | DiscoveryStepBackEvent
  | DiscoveryCacheEvent
  | DiscoveryPagesSelectedEvent
  | DiscoverySummaryViewedEvent
  | BatchStatusGroupEvent
  | BatchResultsPreviewEvent
  | BatchSortChangedEvent
  | BatchUrlFailureViewedEvent
  | BatchAggregateStatsViewedEvent
  | HistoryFilterAppliedEvent
  | HistoryDateRangeEvent
  | HistoryScanTypeFilterEvent
  | HistorySearchEvent
  | HistorySortChangedEvent
  | HistoryItemSelectedEvent
  | HistoryBulkDeleteEvent
  | HistorySelectionClearedEvent
  | WcagLevelTooltipEvent
  | WcagLevelHelpExpandedEvent
  | WcagLevelChangedEvent
  | EmptyStateCTAClickedEvent
  | LoadingSkeletonEvent
  | LoadingRetryEvent
  | ErrorRetryEvent
  | ErrorDetailsExpandedEvent
  | DiscoveryV2Event;

// ============================================================================
// UNION TYPES
// ============================================================================

/**
 * Union type of all analytics events
 * Ensures type safety for all analytics operations
 */
export type AnalyticsEvent =
  | ScanInitiatedEvent
  | ScanCompletedEvent
  | ReportExportedEvent
  | ResultSharedEvent
  | CodeCopiedEvent
  | SignUpEvent
  | LoginEvent
  | FunnelEvent
  | ErrorApiEvent
  | ErrorJsEvent
  | WebVitalsEvent
  | UIUXEvent;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if a value is a valid WcagLevel
 */
export function isWcagLevel(value: unknown): value is WcagLevel {
  return typeof value === 'string' && ['A', 'AA', 'AAA'].includes(value);
}

/**
 * Check if a value is a valid ScanType
 */
export function isScanType(value: unknown): value is ScanType {
  return typeof value === 'string' && ['single', 'batch'].includes(value);
}

/**
 * Check if a value is a valid ReportFormat
 */
export function isReportFormat(value: unknown): value is ReportFormat {
  return typeof value === 'string' && ['pdf', 'json'].includes(value);
}

/**
 * Check if a value is a valid ReportType
 */
export function isReportType(value: unknown): value is ReportType {
  return typeof value === 'string' && ['single', 'batch'].includes(value);
}

/**
 * Check if an event is a funnel event
 */
export function isFunnelEvent(event: AnalyticsEvent): event is FunnelEvent {
  return event.event.startsWith('funnel_');
}

/**
 * Check if an event is an error event
 */
export function isErrorEvent(
  event: AnalyticsEvent
): event is ErrorApiEvent | ErrorJsEvent {
  return event.event.startsWith('error_');
}

// ============================================================================
// CONSENT MANAGEMENT (Requirement 3)
// ============================================================================

/**
 * Consent status for different cookie categories
 * Tracks user consent preferences for GDPR/privacy compliance
 */
export interface ConsentStatus {
  /** Essential cookies always enabled (required for site functionality) */
  essential: boolean;
  /** Analytics cookies consent status (user choice) */
  analytics: boolean;
  /** Marketing cookies consent status (future use) */
  marketing: boolean;
  /** ISO 8601 timestamp when consent was granted/updated */
  timestamp: string;
  /** Consent version for tracking consent policy changes */
  version: string;
}

/**
 * Google Tag Manager DataLayer event structure
 * Used for pushing events to GTM's dataLayer
 */
export interface DataLayerEvent {
  /** Event name */
  event: string;
  /** Additional event parameters */
  [key: string]: unknown;
}

// ============================================================================
// WINDOW INTERFACE AUGMENTATION
// ============================================================================

/**
 * Augment Window interface for GTM integration
 * Provides type safety for Google Tag Manager globals
 */
declare global {
  interface Window {
    /**
     * Google Tag Manager dataLayer array
     * Used to push events and configuration to GTM
     */
    dataLayer: DataLayerEvent[];

    /**
     * Google gtag function for GA4
     * Used for consent management and configuration
     */
    gtag: (
      command: 'consent' | 'config' | 'event',
      targetIdOrAction: string,
      params?: Record<string, unknown>
    ) => void;
  }
}
