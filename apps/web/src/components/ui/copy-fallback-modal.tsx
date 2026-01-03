"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface CopyFallbackModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** The text content to display for copying */
  text: string;
}

/**
 * Fallback modal for clipboard operations when clipboard API is denied
 * Shows selectable text input for manual copying
 */
export function CopyFallbackModal({
  isOpen,
  onClose,
  text,
}: CopyFallbackModalProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const modalRef = React.useRef<HTMLDivElement>(null);

  // Handle ESC key to close modal
  React.useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Focus trap inside modal
  React.useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    // Focus input when modal opens
    const input = inputRef.current;
    if (input) {
      input.focus();
      input.select(); // Auto-select all text
    }

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (
        e.shiftKey &&
        document.activeElement === firstElement &&
        firstElement
      ) {
        e.preventDefault();
        lastElement?.focus();
      } else if (
        !e.shiftKey &&
        document.activeElement === lastElement &&
        lastElement
      ) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener("keydown", handleTabKey);
    return () => document.removeEventListener("keydown", handleTabKey);
  }, [isOpen]);

  // Handle Select All button click
  const handleSelectAll = () => {
    const input = inputRef.current;
    if (input) {
      input.focus();
      input.select();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="copy-fallback-title"
      aria-describedby="copy-fallback-description"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col space-y-4">
          {/* Title */}
          <h2
            id="copy-fallback-title"
            className="text-xl font-semibold text-foreground"
          >
            Copy to clipboard
          </h2>

          {/* Description */}
          <p
            id="copy-fallback-description"
            className="text-sm text-muted-foreground"
          >
            Your browser denied clipboard access. Please manually select and
            copy the text below:
          </p>

          {/* Selectable Input */}
          <Input
            ref={inputRef}
            type="text"
            value={text}
            readOnly
            className="w-full font-mono text-sm"
            aria-label="Text to copy"
          />

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
