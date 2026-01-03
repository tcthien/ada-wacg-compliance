'use client';

import { CopyButton } from '@/components/ui/copy-button';
import { useAnalyticsContext } from '@/components/features/analytics';
import type { ClipboardCopyEvent } from '@/lib/analytics.types';

interface IssueCodeProps {
  html: string;
  selector: string;
}

export function IssueCode({ html, selector }: IssueCodeProps) {
  const { track } = useAnalyticsContext();

  // Helper to get session ID
  const getSessionId = () =>
    typeof window !== 'undefined' ? window.sessionStorage.getItem('sessionId') || '' : '';

  const handleCopyHtml = () => {
    const event: ClipboardCopyEvent = {
      event: 'code_snippet_copied',
      copy_target: 'code_snippet',
      success: true,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    };
    track(event);
  };

  const handleCopySelector = () => {
    const event: ClipboardCopyEvent = {
      event: 'selector_copied',
      copy_target: 'selector',
      success: true,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    };
    track(event);
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-800">
      <div className="text-xs text-muted-foreground mb-2 flex items-start gap-2">
        <span className="font-medium shrink-0">Selector:</span>
        <code className="bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded font-mono break-all flex-1">
          {selector}
        </code>
        <CopyButton
          text={selector}
          variant="icon"
          size="sm"
          onCopy={handleCopySelector}
          className="h-6 w-6 shrink-0"
          aria-label="Copy selector"
        />
      </div>
      <div className="text-xs text-muted-foreground mb-2 font-medium flex items-center justify-between">
        <span>HTML:</span>
        <CopyButton
          text={html}
          variant="icon"
          size="sm"
          onCopy={handleCopyHtml}
          className="h-6 w-6"
          aria-label="Copy HTML"
        />
      </div>
      {/* Responsive code snippet with horizontal scroll and visual indicator */}
      <div className="relative">
        <pre className="text-sm overflow-x-auto whitespace-pre-wrap break-all font-mono bg-white dark:bg-black p-3 rounded border border-gray-300 dark:border-gray-700 max-w-full">
          <code dangerouslySetInnerHTML={{ __html: escapeHtml(html) }} />
        </pre>
        {/* Visual scroll indicator for mobile - gradient fade on right edge */}
        <div
          className="absolute right-0 top-0 bottom-0 w-8
                     bg-gradient-to-l from-white to-transparent
                     dark:from-black dark:to-transparent
                     pointer-events-none md:hidden rounded-r"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

/**
 * Escape HTML special characters to prevent XSS and display HTML as text
 */
function escapeHtml(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
