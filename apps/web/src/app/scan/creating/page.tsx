'use client';

/**
 * Scan Creating Page
 *
 * Handles the scan creation API call while showing a progress UI.
 * This provides optimistic navigation - user sees progress immediately
 * after form submission instead of waiting for API response on the form.
 *
 * Flow:
 * 1. ScanForm stores pending scan data in sessionStorage
 * 2. Navigates here immediately after reCAPTCHA
 * 3. This page calls the API to create the scan
 * 4. On success, redirects to /scan/[id] for status polling
 * 5. On error, shows error state with retry option
 */

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { batchApi } from '@/lib/batch-api';
import { ScanProgress } from '@/components/features/scan/ScanProgress';

interface PendingScanData {
  type: 'single' | 'batch';
  url?: string;
  urls?: string[];
  wcagLevel: 'A' | 'AA' | 'AAA';
  recaptchaToken: string;
  email?: string;
  aiEnabled?: boolean;
  discoveryId?: string;
  pageTitles?: Record<string, string>;
  homepageUrl?: string;
  timestamp: number;
}

const PENDING_SCAN_KEY = 'pendingScanData';
const MAX_AGE_MS = 60000; // 1 minute max age for pending data

export default function ScanCreatingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'creating' | 'error'>('creating');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [progress, setProgress] = useState(10);
  const creationStartedRef = useRef(false);

  useEffect(() => {
    // Prevent double execution in React strict mode
    if (creationStartedRef.current) return;
    creationStartedRef.current = true;

    const createScan = async () => {
      try {
        // Get pending scan data from sessionStorage
        const storedData = sessionStorage.getItem(PENDING_SCAN_KEY);

        if (!storedData) {
          // No pending data - redirect to home
          console.warn('No pending scan data found, redirecting to home');
          router.replace('/');
          return;
        }

        const pendingData: PendingScanData = JSON.parse(storedData);

        // Check if data is too old
        if (Date.now() - pendingData.timestamp > MAX_AGE_MS) {
          console.warn('Pending scan data expired, redirecting to home');
          sessionStorage.removeItem(PENDING_SCAN_KEY);
          router.replace('/');
          return;
        }

        // Clear pending data immediately to prevent re-use
        sessionStorage.removeItem(PENDING_SCAN_KEY);

        // Update progress - making API call
        setProgress(30);

        if (pendingData.type === 'batch' && pendingData.urls && pendingData.urls.length > 0) {
          // Batch scan creation
          setProgress(40);

          // Build batch request with only defined properties
          const batchRequest: Parameters<typeof batchApi.create>[0] = {
            urls: pendingData.urls,
            wcagLevel: pendingData.wcagLevel,
            recaptchaToken: pendingData.recaptchaToken,
          };

          if (pendingData.discoveryId) {
            batchRequest.discoveryId = pendingData.discoveryId;
          }
          if (pendingData.pageTitles && Object.keys(pendingData.pageTitles).length > 0) {
            batchRequest.pageTitles = pendingData.pageTitles;
          }
          if (pendingData.email) {
            batchRequest.email = pendingData.email;
          }
          if (pendingData.aiEnabled) {
            batchRequest.aiEnabled = pendingData.aiEnabled;
          }

          const result = await batchApi.create(batchRequest);

          setProgress(80);

          // Navigate to batch page
          router.replace(`/batch/${result.batchId}`);
        } else if (pendingData.url) {
          // Single scan creation
          setProgress(40);

          // Build scan request with only defined properties
          const scanRequest: Parameters<typeof api.scans.create>[0] = {
            url: pendingData.url,
            wcagLevel: pendingData.wcagLevel,
            recaptchaToken: pendingData.recaptchaToken,
          };

          if (pendingData.email) {
            scanRequest.email = pendingData.email;
          }
          if (pendingData.aiEnabled) {
            scanRequest.aiEnabled = pendingData.aiEnabled;
          }

          const result = await api.scans.create(scanRequest);

          setProgress(80);

          // Navigate to scan page
          router.replace(`/scan/${result.scanId}`);
        } else {
          throw new Error('Invalid pending scan data - missing URL');
        }
      } catch (error) {
        console.error('Failed to create scan:', error);
        setStatus('error');
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to create scan. Please try again.'
        );
      }
    };

    createScan();
  }, [router]);

  // Animate progress while creating
  useEffect(() => {
    if (status !== 'creating') return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        // Slowly increase progress up to 70% while waiting
        if (prev < 70) {
          return prev + 2;
        }
        return prev;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [status]);

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">Failed to Start Scan</h1>
          <p className="text-muted-foreground mb-6">{errorMessage}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/history')}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              View History
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Creating state - show progress
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="animate-pulse text-6xl mb-4">🚀</div>
          <h1 className="text-2xl font-bold mb-2">Starting Your Scan</h1>
          <p className="text-muted-foreground">
            Setting up accessibility analysis...
          </p>
        </div>

        <ScanProgress progress={progress} stage="Initializing scan..." />

        <p className="text-center text-sm text-muted-foreground mt-6">
          You&apos;ll see results as soon as the scan begins processing.
        </p>
      </div>
    </div>
  );
}
