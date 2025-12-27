'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useScan } from '@/hooks/useScan';
import { ScanProgress } from './ScanProgress';

interface ScanStatusProps {
  scanId: string;
  onComplete?: () => void;
}

export function ScanStatus({ scanId, onComplete }: ScanStatusProps) {
  const router = useRouter();
  const { scan, loading, error } = useScan(scanId, { pollInterval: 2000 });

  useEffect(() => {
    if (scan?.status === 'COMPLETED') {
      onComplete?.();
      // Give user a moment to see completion before redirect
      setTimeout(() => {
        router.push(`/scan/${scanId}`);
      }, 1000);
    }
  }, [scan?.status, scanId, router, onComplete]);

  if (loading && !scan) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
        <p className="mt-2 text-muted-foreground">Loading scan status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-blue-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!scan) return null;

  // Map status to user-friendly stages
  const stageMap: Record<string, { text: string; progress: number }> = {
    PENDING: { text: 'Waiting in queue...', progress: 10 },
    RUNNING: { text: 'Scanning page...', progress: scan.progress || 50 },
    COMPLETED: { text: 'Scan complete!', progress: 100 },
    FAILED: { text: 'Scan failed', progress: 0 },
  };

  if (scan.status === 'FAILED') {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-2">❌ Scan Failed</div>
        <p className="text-muted-foreground">
          {scan.errorMessage || 'An error occurred'}
        </p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 text-blue-600 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (scan.status === 'COMPLETED') {
    return (
      <div className="text-center py-8">
        <div className="text-green-600 mb-2">✅ Scan Complete!</div>
        <p className="text-muted-foreground">Redirecting to results...</p>
      </div>
    );
  }

  const currentStage = stageMap[scan.status] || {
    text: 'Processing...',
    progress: 50,
  };

  // Use the current stage text
  const stageText = currentStage.text;

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="text-center mb-6">
        <div className="animate-pulse text-4xl mb-2">🔍</div>
        <h2 className="text-xl font-semibold">Scanning...</h2>
        <p className="text-muted-foreground text-sm mt-1">Scan ID: {scanId}</p>
      </div>

      <ScanProgress
        progress={currentStage.progress}
        stage={stageText}
        estimatedTimeRemaining={undefined} // Could be calculated based on queue position
      />
    </div>
  );
}
