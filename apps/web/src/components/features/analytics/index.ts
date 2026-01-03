/**
 * Analytics Module Barrel Export
 *
 * Clean public API for the analytics module providing:
 * - AnalyticsProvider for React context integration
 * - GTMScript for Google Tag Manager initialization
 * - useAnalyticsContext hook for accessing analytics functionality
 * - Type definitions for type-safe analytics operations
 *
 * Usage:
 * ```tsx
 * import { AnalyticsProvider, GTMScript, useAnalyticsContext } from '@/components/features/analytics';
 * import type { AnalyticsEvent, ConsentStatus } from '@/components/features/analytics';
 * ```
 */

// ============================================================================
// COMPONENTS
// ============================================================================

export { AnalyticsProvider } from './AnalyticsProvider';
export { GTMScript } from './GTMScript';
export { PageViewTracker } from './PageViewTracker';

// ============================================================================
// HOOKS
// ============================================================================

export { useAnalyticsContext } from './AnalyticsProvider';

// ============================================================================
// TYPES
// ============================================================================

export type {
  // Base types
  WcagLevel,
  ScanType,
  ReportFormat,
  ReportType,
  IssueSeverity,
  RegistrationMethod,
  LoginMethod,
  SessionType,
  ApiErrorType,
  JsErrorType,

  // Base event interfaces
  BaseAnalyticsEvent,
  BaseFunnelEvent,

  // Scan events
  ScanInitiatedEvent,
  ScanCompletedEvent,
  ReportExportedEvent,
  SignUpEvent,
  LoginEvent,
  IssueCountBySeverity,

  // Funnel events
  FunnelScanFormViewedEvent,
  FunnelScanUrlEnteredEvent,
  FunnelScanSubmittedEvent,
  FunnelScanResultsViewedEvent,
  FunnelReportDownloadedEvent,
  FunnelSignupStartedEvent,
  FunnelSignupCompletedEvent,
  FunnelFirstScanEvent,
  FunnelEvent,

  // Error and performance events
  ErrorApiEvent,
  ErrorJsEvent,
  WebVitalsEvent,
  WebVitalsMetrics,

  // Union types
  AnalyticsEvent,

  // Consent management
  ConsentStatus,
  DataLayerEvent,
} from '@/lib/analytics.types';

// ============================================================================
// TYPE GUARDS
// ============================================================================

export {
  isWcagLevel,
  isScanType,
  isReportFormat,
  isReportType,
  isFunnelEvent,
  isErrorEvent,
} from '@/lib/analytics.types';
