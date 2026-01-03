'use client';

import { StepIndicator } from '@/components/ui/step-indicator';
import type { Step } from '@/components/ui/step-indicator';
import { useDiscoveryFlowV2 } from '@/hooks/useDiscoveryFlowV2';
import { Step1InputUrls } from './Step1InputUrls';
import { Step2SelectUrls } from './Step2SelectUrls';
import { Step3Preview } from './Step3Preview';

/**
 * Discovery Flow V2 Component
 *
 * Main orchestration component for the 3-step discovery flow redesign.
 * Manages step transitions and renders appropriate step components.
 *
 * Step Flow:
 * 1. Input URLs (sitemap or manual)
 * 2. Select URLs (choose which to scan)
 * 3. Preview (confirm and start scan)
 *
 * Features:
 * - Step indicator navigation (US-6)
 * - Conditional step rendering
 * - State management via useDiscoveryFlowV2 hook
 * - Responsive design
 * - Error display with retry functionality
 *
 * Implements:
 * - US-1: Sitemap URL Discovery
 * - US-2: Manual URL Entry
 * - US-3: URL Selection with Checkboxes
 * - US-4: Batch Preview
 * - US-5: Scan Submission
 * - US-6: Free Navigation Between Steps
 *
 * Usage:
 * ```tsx
 * <DiscoveryFlowV2 />
 * ```
 */
export function DiscoveryFlowV2() {
  const {
    currentStep,
    error,
    setError,
    goBack,
    submitSelection,
    getSelectedUrls,
    isSubmitting,
  } = useDiscoveryFlowV2();

  // Define step configuration for StepIndicator
  const steps: Step[] = [
    {
      id: 'input',
      label: 'Input URLs',
      description: 'Enter sitemap or manual URLs',
    },
    {
      id: 'select',
      label: 'Select URLs',
      description: 'Choose URLs to scan',
    },
    {
      id: 'preview',
      label: 'Preview',
      description: 'Confirm and start scan',
    },
  ];

  // Map FlowStep to step index for StepIndicator
  const stepIndexMap = {
    input: 0,
    select: 1,
    preview: 2,
  } as const;

  const currentStepIndex = stepIndexMap[currentStep];

  /**
   * Clear error when user clicks retry
   * Error will be re-displayed if the action fails again
   */
  const handleRetry = () => {
    setError(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Step Indicator */}
      <StepIndicator
        steps={steps}
        currentStep={currentStepIndex}
        variant="horizontal"
        size="md"
        showLabels={true}
        allowNavigation={false}
      />

      {/* Error Display - shown above current step when error exists */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">
                {error.message}
              </h3>
              {error.details && (
                <p className="mt-1 text-sm text-red-700">{error.details}</p>
              )}
            </div>
            {error.retryable && (
              <button
                type="button"
                onClick={handleRetry}
                className="flex-shrink-0 rounded-md text-sm font-medium text-red-800 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-red-50"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="min-h-[400px]">
        {/* Step 1: Input URLs - self-contained, no props needed */}
        {currentStep === 'input' && <Step1InputUrls />}

        {/* Step 2: Select URLs - uses hook's selection handlers and navigation */}
        {currentStep === 'select' && <Step2SelectUrls />}

        {/* Step 3: Preview - needs selected URLs, back handler, and submit handler */}
        {currentStep === 'preview' && (
          <Step3Preview
            selectedUrls={getSelectedUrls()}
            onBack={goBack}
            onStartScan={submitSelection}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
