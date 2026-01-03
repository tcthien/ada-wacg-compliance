'use client';

import React, { useEffect, useRef } from 'react';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  format: 'pdf' | 'json';
  status: 'generating' | 'completed' | 'error';
  errorMessage?: string;
  onRetry: () => void;
  onCancel: () => void;
}

export function ExportModal({
  isOpen,
  onClose,
  format,
  status,
  errorMessage,
  onRetry,
  onCancel,
}: ExportModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus trap inside modal
  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    // Focus first focusable element when modal opens
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    if (firstElement) {
      firstElement.focus();
    }

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || focusableElements.length === 0) return;

      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement && firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement && lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen, status]);

  // Auto-dismiss on completion after 2 seconds
  useEffect(() => {
    if (status === 'completed' && isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status, isOpen, onClose]);

  if (!isOpen) return null;

  const formatLabel = format === 'pdf' ? 'PDF' : 'JSON';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="export-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {status === 'generating' && (
          <>
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Spinner Animation */}
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>

              {/* Title */}
              <h2 id="export-modal-title" className="text-xl font-semibold text-foreground">
                Generating {formatLabel} Report...
              </h2>

              {/* Description */}
              <p className="text-sm text-muted-foreground">
                This may take a few moments
              </p>

              {/* Cancel Button */}
              <button
                onClick={onCancel}
                className="mt-4 px-6 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {status === 'completed' && (
          <>
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Success Icon */}
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              {/* Success Message */}
              <h2 id="export-modal-title" className="text-xl font-semibold text-foreground">
                Download started!
              </h2>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Error Icon */}
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>

              {/* Error Title */}
              <h2 id="export-modal-title" className="text-xl font-semibold text-foreground">
                Failed to generate report
              </h2>

              {/* Error Message */}
              {errorMessage && (
                <p className="text-sm text-muted-foreground">
                  {errorMessage}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  ref={closeButtonRef}
                  onClick={onRetry}
                  className="px-6 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  Retry
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  Close
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
