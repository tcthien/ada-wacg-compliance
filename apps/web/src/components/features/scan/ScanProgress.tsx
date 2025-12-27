'use client';

interface ScanProgressProps {
  progress: number; // 0-100
  stage: string;
  estimatedTimeRemaining?: number; // seconds
}

export function ScanProgress({
  progress,
  stage,
  estimatedTimeRemaining,
}: ScanProgressProps) {
  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stage info */}
      <div className="flex justify-between text-sm">
        <span className="font-medium">{stage}</span>
        <span className="text-muted-foreground">{progress}%</span>
      </div>

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
