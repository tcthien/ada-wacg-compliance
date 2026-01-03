import React from 'react';

interface EstimatedTimeProps {
  urlCount: number;
}

/**
 * EstimatedTime Component
 *
 * Displays estimated scan duration based on URL count.
 * Formula: ~30 seconds per URL, displayed in minutes.
 *
 * @param urlCount - Number of URLs to be scanned
 *
 * Requirements: FR-3.2 - Show estimated scan duration
 */
export const EstimatedTime: React.FC<EstimatedTimeProps> = ({ urlCount }) => {
  // Calculate estimated time: 30 seconds per URL, converted to minutes
  const estimatedMinutes = Math.ceil(urlCount * 30 / 60);

  // Don't render if no URLs
  if (urlCount === 0) {
    return null;
  }

  // Format time string with proper singular/plural
  const timeText = estimatedMinutes === 1
    ? '~1 minute'
    : `~${estimatedMinutes} minutes`;

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>Estimated scan time: {timeText}</span>
    </div>
  );
};
