'use client';

import { useId } from 'react';
import type { DiscoveryMode } from '@/lib/discovery-api';

/**
 * Props for DiscoveryModeSelector component
 */
export interface DiscoveryModeSelectorProps {
  /** Currently selected mode */
  value: DiscoveryMode;
  /** Callback when mode changes */
  onChange: (mode: DiscoveryMode) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Optional class name for styling */
  className?: string;
}

/**
 * Mode option configuration
 */
interface ModeOption {
  value: DiscoveryMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}

/**
 * Mode options configuration
 */
const MODE_OPTIONS: ModeOption[] = [
  {
    value: 'AUTO',
    label: 'Auto Discover',
    description: 'Automatically find pages via sitemap and navigation',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    ),
  },
  {
    value: 'MANUAL',
    label: 'Manual Entry',
    description: 'Enter page URLs manually',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
    ),
  },
];

/**
 * DiscoveryModeSelector component
 *
 * Allows users to choose between automatic discovery and manual URL entry.
 * Uses ARIA radio group pattern for accessibility.
 *
 * @example
 * ```tsx
 * const [mode, setMode] = useState<DiscoveryMode>('AUTO');
 *
 * <DiscoveryModeSelector
 *   value={mode}
 *   onChange={setMode}
 * />
 * ```
 */
export function DiscoveryModeSelector({
  value,
  onChange,
  disabled = false,
  className = '',
}: DiscoveryModeSelectorProps) {
  const groupId = useId();

  const handleKeyDown = (
    e: React.KeyboardEvent,
    currentIndex: number
  ): void => {
    const optionsCount = MODE_OPTIONS.length;
    let nextIndex = currentIndex;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        nextIndex = (currentIndex + 1) % optionsCount;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        nextIndex = (currentIndex - 1 + optionsCount) % optionsCount;
        break;
      default:
        return;
    }

    const nextOption = MODE_OPTIONS[nextIndex];
    if (!disabled && nextOption) {
      onChange(nextOption.value);
      // Focus the next option
      const nextButton = document.getElementById(
        `${groupId}-option-${nextIndex}`
      );
      nextButton?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Discovery mode"
      className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className}`}
    >
      {MODE_OPTIONS.map((option, index) => {
        const isSelected = value === option.value;
        const optionId = `${groupId}-option-${index}`;

        return (
          <button
            key={option.value}
            id={optionId}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-describedby={`${optionId}-description`}
            tabIndex={isSelected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`
              relative flex flex-col items-center p-6 rounded-lg border-2
              transition-all duration-200
              ${
                isSelected
                  ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600 ring-offset-2'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }
              ${
                disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2'
              }
            `}
          >
            {/* Selection indicator */}
            <div
              className={`
                absolute top-3 right-3 w-5 h-5 rounded-full border-2
                flex items-center justify-center
                ${
                  isSelected
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-gray-300 bg-white'
                }
              `}
              aria-hidden="true"
            >
              {isSelected && (
                <svg
                  className="w-3 h-3 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>

            {/* Icon */}
            <div
              className={`
                p-3 rounded-full mb-3
                ${isSelected ? 'text-blue-600 bg-blue-100' : 'text-gray-500 bg-gray-100'}
              `}
            >
              {option.icon}
            </div>

            {/* Label */}
            <span
              className={`
                text-lg font-semibold
                ${isSelected ? 'text-blue-900' : 'text-gray-900'}
              `}
            >
              {option.label}
            </span>

            {/* Description */}
            <span
              id={`${optionId}-description`}
              className={`
                mt-1 text-sm text-center
                ${isSelected ? 'text-blue-700' : 'text-gray-500'}
              `}
            >
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
