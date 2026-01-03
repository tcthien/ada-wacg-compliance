/**
 * Analytics Constants
 *
 * Centralized configuration constants for Google Analytics 4 (GA4)
 * integrated via Google Tag Manager (GTM).
 *
 * This file defines:
 * - Storage keys for consent management
 * - Default consent states
 * - Event name strings for tracking
 * - GTM domain whitelist for CSP configuration
 */

import type { ConsentStatus } from './analytics.types';

// ============================================================================
// CONSENT MANAGEMENT (Requirement 3)
// ============================================================================

/**
 * Local storage key for persisting user consent preferences
 * Format: 'adashield:consent'
 */
export const CONSENT_STORAGE_KEY = 'adashield:consent';

/**
 * Default consent state for new users
 * - Essential cookies: Always enabled (required for functionality)
 * - Analytics cookies: Disabled by default (requires user consent)
 * - Marketing cookies: Disabled by default (requires user consent)
 * - Version: '1.0' - increment when consent policy changes
 */
export const DEFAULT_CONSENT: ConsentStatus = {
  essential: true,
  analytics: false,
  marketing: false,
  timestamp: new Date().toISOString(),
  version: '1.0',
};

// ============================================================================
// ANALYTICS EVENTS (Requirements 4 & 5)
// ============================================================================

/**
 * Analytics event name strings
 * Centralized to prevent typos and ensure consistency
 */
export const ANALYTICS_EVENTS = {
  // Core Events (Requirement 4)
  SCAN_INITIATED: 'scan_initiated',
  SCAN_COMPLETED: 'scan_completed',
  REPORT_EXPORTED: 'report_exported',
  SIGN_UP: 'sign_up',
  LOGIN: 'login',

  // Scan Funnel Events (Requirement 5)
  FUNNEL_SCAN_FORM_VIEWED: 'funnel_scan_form_viewed',
  FUNNEL_SCAN_URL_ENTERED: 'funnel_scan_url_entered',
  FUNNEL_SCAN_SUBMITTED: 'funnel_scan_submitted',
  FUNNEL_SCAN_RESULTS_VIEWED: 'funnel_scan_results_viewed',
  FUNNEL_REPORT_DOWNLOADED: 'funnel_report_downloaded',

  // Signup Funnel Events (Requirement 5)
  FUNNEL_SIGNUP_STARTED: 'funnel_signup_started',
  FUNNEL_SIGNUP_COMPLETED: 'funnel_signup_completed',
  FUNNEL_FIRST_SCAN: 'funnel_first_scan',

  // Error Events (Requirement 6)
  ERROR_API: 'error_api',
  ERROR_JS: 'error_js',

  // Performance Events (Requirement 6)
  WEB_VITALS: 'web_vitals',
} as const;

// ============================================================================
// UI/UX EVENTS (Customer UI/UX Improvement Specification)
// ============================================================================

/**
 * UI/UX improvement analytics event name strings
 * Tracks user interactions with enhanced UI components
 */
export const UI_UX_EVENTS = {
  // Issue List Interactions (Requirement 3)
  ISSUE_EXPAND_ALL: 'issue_expand_all',
  ISSUE_COLLAPSE_ALL: 'issue_collapse_all',
  ISSUE_SEVERITY_FILTER: 'issue_severity_filter',
  ISSUE_SEARCH: 'issue_search',
  ISSUE_CARD_EXPANDED: 'issue_card_expanded',
  ISSUE_CARD_COLLAPSED: 'issue_card_collapsed',

  // Clipboard Events (Requirement 7)
  URL_COPIED: 'url_copied',
  CODE_SNIPPET_COPIED: 'code_snippet_copied',
  SELECTOR_COPIED: 'selector_copied',
  SHARE_LINK_CLICKED: 'share_link_clicked',
  SHARE_LINK_COPIED: 'share_link_copied',
  CLIPBOARD_FALLBACK_SHOWN: 'clipboard_fallback_shown',

  // Discovery Flow Events (Requirement 4)
  DISCOVERY_STEP_VIEWED: 'discovery_step_viewed',
  DISCOVERY_STEP_BACK: 'discovery_step_back',
  DISCOVERY_CACHE_PROMPT_SHOWN: 'discovery_cache_prompt_shown',
  DISCOVERY_CACHE_REFRESHED: 'discovery_cache_refreshed',
  DISCOVERY_CACHE_REUSED: 'discovery_cache_reused',
  DISCOVERY_PAGES_SELECTED: 'discovery_pages_selected',
  DISCOVERY_SUMMARY_VIEWED: 'discovery_summary_viewed',

  // Batch Scan Events (Requirement 5)
  BATCH_STATUS_GROUP_TOGGLED: 'batch_status_group_toggled',
  BATCH_RESULTS_PREVIEW_VIEWED: 'batch_results_preview_viewed',
  BATCH_SORT_CHANGED: 'batch_sort_changed',
  BATCH_URL_FAILURE_VIEWED: 'batch_url_failure_viewed',
  BATCH_AGGREGATE_STATS_VIEWED: 'batch_aggregate_stats_viewed',

  // History Page Events (Requirement 9)
  HISTORY_FILTER_APPLIED: 'history_filter_applied',
  HISTORY_DATE_RANGE_CHANGED: 'history_date_range_changed',
  HISTORY_SCAN_TYPE_FILTER: 'history_scan_type_filter',
  HISTORY_SEARCH: 'history_search',
  HISTORY_SORT_CHANGED: 'history_sort_changed',
  HISTORY_ITEM_SELECTED: 'history_item_selected',
  HISTORY_BULK_DELETE: 'history_bulk_delete',
  HISTORY_SELECTION_CLEARED: 'history_selection_cleared',

  // WCAG Level Selector Events (Requirement 6)
  WCAG_LEVEL_TOOLTIP_VIEWED: 'wcag_level_tooltip_viewed',
  WCAG_LEVEL_HELP_EXPANDED: 'wcag_level_help_expanded',
  WCAG_LEVEL_CHANGED: 'wcag_level_changed',

  // Empty State Events
  EMPTY_STATE_CTA_CLICKED: 'empty_state_cta_clicked',

  // Loading State Events (Requirement 1)
  LOADING_SKELETON_SHOWN: 'loading_skeleton_shown',
  LOADING_RETRY_CLICKED: 'loading_retry_clicked',

  // Error Recovery Events (Requirement 2)
  ERROR_RETRY_CLICKED: 'error_retry_clicked',
  ERROR_DETAILS_EXPANDED: 'error_details_expanded',
} as const;

// ============================================================================
// GTM CONFIGURATION
// ============================================================================

/**
 * Google Tag Manager domain whitelist for Content Security Policy (CSP)
 * These domains must be allowed in CSP headers for GTM to function properly
 *
 * Domains:
 * - www.googletagmanager.com: GTM container script
 * - www.google-analytics.com: GA4 measurement protocol
 * - analytics.google.com: GA4 configuration and reporting
 */
export const GTM_DOMAINS = [
  'www.googletagmanager.com',
  'www.google-analytics.com',
  'analytics.google.com',
] as const;
