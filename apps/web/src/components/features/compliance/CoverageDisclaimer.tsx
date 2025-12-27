export function CoverageDisclaimer() {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
      <div className="flex gap-3">
        <InfoIcon className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Important:</strong> Automated testing detects approximately{' '}
            <strong>57%</strong> of WCAG issues. Manual testing by accessibility
            experts is recommended for complete compliance verification.
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
            This tool uses industry-standard automated testing (axe-core) to
            identify common accessibility issues. However, many WCAG success
            criteria require human judgment and cannot be fully automated.
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`w-5 h-5 ${className || ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
