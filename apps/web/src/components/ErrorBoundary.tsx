/**
 * Error Boundary Component
 *
 * React error boundary that catches JavaScript errors in the component tree
 * and tracks them via Google Analytics while showing a fallback UI.
 *
 * Features:
 * - Catches React component errors with componentDidCatch lifecycle
 * - Tracks error_js events to GTM dataLayer with sanitized error information
 * - Respects user analytics consent preferences
 * - Provides user-friendly fallback UI with retry option
 * - Extracts component context from error boundary info
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 *
 * Related:
 * - apps/web/src/lib/analytics.ts - pushToDataLayer, sanitizeError
 * - apps/web/src/lib/consent.ts - getConsent
 * - .claude/specs/google-analytics-integration/requirements.md - Requirement 6.2
 */

'use client';

import React, { Component, ReactNode } from 'react';
import { pushToDataLayer, sanitizeError } from '@/lib/analytics';
import { getConsent } from '@/lib/consent';
import { classifyError, getErrorMessage } from '@/lib/error-utils';
import { ErrorDisplay } from '@/components/ui/error-display';

// ============================================================================
// TYPES
// ============================================================================

interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Optional fallback UI renderer */
  fallback?: (error: Error, errorInfo: React.ErrorInfo, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean;
  /** The error object if one was caught */
  error: Error | null;
  /** React error info containing component stack */
  errorInfo: React.ErrorInfo | null;
}

// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================

/**
 * Error boundary component that catches JavaScript errors and tracks them
 *
 * Class component is required for error boundaries in React.
 * See: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Update state when an error is caught
   * This method is called during the "render" phase, so side effects are not allowed
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Track error to analytics when error is caught
   * This method is called during the "commit" phase, so side effects are allowed
   */
  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Store error info in state for fallback UI
    this.setState({
      errorInfo,
    });

    // Track error to analytics if consent granted
    const consent = getConsent();
    if (consent.analytics) {
      // Extract error type from error.name (e.g., 'TypeError', 'ReferenceError')
      const errorType = error.name || 'UnknownError';

      // Sanitize error message to remove PII (emails, URLs with query strings)
      const errorMessage = sanitizeError(error.message || 'No error message');

      // Extract component context from error info component stack
      // Component stack looks like:
      //   in ComponentName (at path/to/file.tsx:123)
      //   in ParentComponent (at path/to/file.tsx:456)
      const componentStack = errorInfo.componentStack || '';

      // Extract first component name from stack (the component where error occurred)
      const componentMatch = componentStack.match(/in (\w+)/);
      const componentContext = componentMatch ? componentMatch[1] : 'Unknown';

      // Push error_js event to dataLayer
      pushToDataLayer({
        event: 'error_js',
        timestamp: new Date().toISOString(),
        error_type: errorType,
        error_message: errorMessage,
        component_context: componentContext,
      });
    }

    // Log error to console in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by ErrorBoundary:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  /**
   * Reset error state to retry rendering
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  override render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    // Render fallback UI if error occurred
    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback && errorInfo) {
        return fallback(error, errorInfo, this.handleReset);
      }

      // Classify error and get appropriate message
      const errorType = classifyError(error);
      const { title, description, action } = getErrorMessage(errorType);

      // Default fallback UI using ErrorDisplay component
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <ErrorDisplay
            title={title}
            description={description}
            actionLabel={action}
            errorType={errorType}
            onRetry={this.handleReset}
            showDetails={process.env.NODE_ENV === 'development'}
            error={error}
            className="max-w-2xl w-full"
          />
        </div>
      );
    }

    // Render children normally when no error
    return children;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ErrorBoundary;
