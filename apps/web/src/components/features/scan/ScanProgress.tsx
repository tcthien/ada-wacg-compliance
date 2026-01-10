'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Mail, Clock, Loader2 } from 'lucide-react';

interface ScanProgressProps {
  progress: number; // 0-100
  stage: string;
  estimatedTimeRemaining?: number | undefined; // seconds
  /** Whether AI analysis is pending (shows AI allocation message at 95-99%) */
  aiPending?: boolean | undefined;
  /** Email address for AI notification (shown when aiPending is true) */
  aiNotificationEmail?: string | undefined;
}

// Contextual loading messages based on scan stage
const STAGE_MESSAGES: Record<string, string[]> = {
  PENDING: [
    'Connecting to server...',
    'Preparing accessibility scanner...',
    'Waiting in queue...',
  ],
  RUNNING: [
    'Connecting to URL...',
    'Analyzing page structure...',
    'Running accessibility tests...',
    'Checking WCAG compliance...',
    'Evaluating color contrast...',
    'Testing keyboard navigation...',
    'Validating ARIA attributes...',
    'Generating report...',
  ],
  // AI-specific messages shown at 95-99% when AI scan is pending (REQ-1 AC 4)
  AI_PENDING: [
    'Allocating resources for AI analysis...',
  ],
  COMPLETED: ['Scan complete!'],
  FAILED: ['Scan failed'],
};

// Determine which message set to use based on progress
function getContextualMessage(progress: number, stage: string, aiPending?: boolean): string {
  // If AI is pending and progress is high (95-99%), show AI allocation message
  if (aiPending && progress >= 95) {
    return STAGE_MESSAGES['AI_PENDING']![0]!;
  }

  // Try to match stage to known status
  const stageKey = Object.keys(STAGE_MESSAGES).find((key) =>
    stage.toLowerCase().includes(key.toLowerCase())
  ) as keyof typeof STAGE_MESSAGES | undefined;

  const messages = stageKey ? STAGE_MESSAGES[stageKey] : STAGE_MESSAGES['RUNNING'];

  if (!messages || messages.length === 0) {
    return 'Processing...';
  }

  // For RUNNING status, rotate messages based on progress
  if (messages === STAGE_MESSAGES['RUNNING']) {
    if (progress < 15) return messages[0]!;
    if (progress < 30) return messages[1]!;
    if (progress < 50) return messages[2]!;
    if (progress < 60) return messages[3]!;
    if (progress < 70) return messages[4]!;
    if (progress < 80) return messages[5]!;
    if (progress < 90) return messages[6]!;
    return messages[7]!;
  }

  // For PENDING status, rotate messages every 2 seconds
  if (messages === STAGE_MESSAGES['PENDING']) {
    const messageIndex = Math.floor(Date.now() / 2000) % messages.length;
    return messages[messageIndex]!;
  }

  // For COMPLETED or FAILED, use the single message
  return messages[0]!;
}

export function ScanProgress({
  progress,
  stage,
  estimatedTimeRemaining,
  aiPending,
  aiNotificationEmail,
}: ScanProgressProps) {
  const [contextualMessage, setContextualMessage] = useState(() =>
    getContextualMessage(progress, stage, aiPending)
  );

  // Update contextual message when progress or stage changes
  useEffect(() => {
    setContextualMessage(getContextualMessage(progress, stage, aiPending));
  }, [progress, stage, aiPending]);

  // For PENDING status, rotate messages every 2 seconds
  useEffect(() => {
    if (stage.toLowerCase().includes('pending') || stage.toLowerCase().includes('waiting')) {
      const interval = setInterval(() => {
        setContextualMessage(getContextualMessage(progress, stage, aiPending));
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [progress, stage, aiPending]);

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Contextual message with accessibility announcement */}
      <div className="flex justify-between text-sm">
        <span className="font-medium" role="status" aria-live="polite" aria-atomic="true">
          {contextualMessage}
        </span>
        <span className="text-muted-foreground">{progress}%</span>
      </div>

      {/* AI notification message (REQ-1 AC 4, REQ-6 AC 5) */}
      {aiPending && progress >= 95 && (
        <div className="mt-6 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-2 bg-white/20 rounded-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-base">
                  AI Analysis in Progress
                </h3>
                <p className="text-purple-100 text-sm">
                  Preparing intelligent accessibility insights
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 py-4 space-y-4">
            {/* Status indicator */}
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-100">
              <Loader2 className="h-5 w-5 text-purple-600 animate-spin flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  Allocating AI Resources
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Claude is analyzing your accessibility issues with expert-level insights
                </p>
              </div>
            </div>

            {/* Processing steps */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2 p-2.5 bg-white/60 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 text-xs font-bold">1</span>
                </div>
                <span className="text-xs text-gray-700">Scan Complete</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-purple-100/50 rounded-lg border border-purple-200">
                <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                  <Loader2 className="h-3 w-3 text-white animate-spin" />
                </div>
                <span className="text-xs text-purple-800 font-medium">AI Processing</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-white/60 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-500 text-xs font-bold">3</span>
                </div>
                <span className="text-xs text-gray-500">Results Ready</span>
              </div>
            </div>

            {/* Email notification info */}
            {aiNotificationEmail && (
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-purple-100">
                <div className="flex-shrink-0 p-1.5 bg-purple-100 rounded-md">
                  <Mail className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium text-gray-900">We&apos;ll notify you when ready</span>
                    <br />
                    <span className="text-purple-700 font-medium break-all">{aiNotificationEmail}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Estimated time */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500 pt-1">
              <Clock className="h-3.5 w-3.5" />
              <span>AI analysis typically takes 1-3 minutes</span>
            </div>
          </div>
        </div>
      )}

      {/* Estimated time */}
      {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Estimated time remaining: {formatTime(estimatedTimeRemaining)}
        </p>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}
