interface IssueCodeProps {
  html: string;
  selector: string;
}

export function IssueCode({ html, selector }: IssueCodeProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-800">
      <div className="text-xs text-muted-foreground mb-2 flex items-start gap-2">
        <span className="font-medium shrink-0">Selector:</span>
        <code className="bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded font-mono break-all">
          {selector}
        </code>
      </div>
      <div className="text-xs text-muted-foreground mb-2 font-medium">
        HTML:
      </div>
      <pre className="text-sm overflow-x-auto whitespace-pre-wrap break-all font-mono bg-white dark:bg-black p-3 rounded border border-gray-300 dark:border-gray-700">
        <code dangerouslySetInnerHTML={{ __html: escapeHtml(html) }} />
      </pre>
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
