'use client';

import { useEffect, useState } from 'react';

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
      {aiPending && progress >= 95 && aiNotificationEmail && (
        <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm text-purple-800">
            <span className="font-medium">AI analysis may take longer.</span>
            {' '}We&apos;ll send you a notification via email at{' '}
            <strong>{aiNotificationEmail}</strong> when it&apos;s ready.
          </p>
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
