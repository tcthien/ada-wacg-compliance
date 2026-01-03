/**
 * Centralized Status Color System
 *
 * Provides consistent color variants for status indicators across the application.
 * Supports both light and dark modes with Tailwind CSS classes.
 *
 * @module status-colors
 */

/**
 * Valid status values used throughout the application
 * Covers scan statuses, batch statuses, and other operational states
 */
export type Status =
  | 'pending'
  | 'running'
  | 'scanning'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'stale';

/**
 * Color variant types for different UI contexts
 */
export interface StatusColorVariant {
  /** Background color classes */
  bg: string;
  /** Text color classes */
  text: string;
  /** Border color classes */
  border: string;
  /** Icon color classes */
  icon: string;
}

/**
 * Status color mapping
 *
 * Maps each status to its corresponding color variants.
 * Each variant includes light and dark mode classes.
 *
 * Color mapping (per design requirement 10.2):
 * - Pending: Gray/Muted (#6B7280 / gray-500)
 * - Running/Scanning: Blue (#2563EB / blue-600) - in progress
 * - Completed: Green (#16A34A / green-600) - success
 * - Failed: Red (#DC2626 / red-600) - error
 * - Cancelled: Gray (#6B7280 / gray-500) - neutral
 * - Stale: Orange (#EA580C / orange-600) - warning
 */
export const STATUS_COLORS: Record<Status, StatusColorVariant> = {
  pending: {
    bg: 'bg-gray-100 dark:bg-gray-900/20',
    text: 'text-gray-800 dark:text-gray-200',
    border: 'border-gray-300 dark:border-gray-700',
    icon: 'text-gray-500 dark:text-gray-400',
  },
  running: {
    bg: 'bg-blue-100 dark:bg-blue-900/20',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-300 dark:border-blue-700',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  scanning: {
    bg: 'bg-blue-100 dark:bg-blue-900/20',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-300 dark:border-blue-700',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  completed: {
    bg: 'bg-green-100 dark:bg-green-900/20',
    text: 'text-green-800 dark:text-green-200',
    border: 'border-green-300 dark:border-green-700',
    icon: 'text-green-600 dark:text-green-400',
  },
  failed: {
    bg: 'bg-red-100 dark:bg-red-900/20',
    text: 'text-red-800 dark:text-red-200',
    border: 'border-red-300 dark:border-red-700',
    icon: 'text-red-600 dark:text-red-400',
  },
  cancelled: {
    bg: 'bg-gray-100 dark:bg-gray-900/20',
    text: 'text-gray-800 dark:text-gray-200',
    border: 'border-gray-300 dark:border-gray-700',
    icon: 'text-gray-500 dark:text-gray-400',
  },
  stale: {
    bg: 'bg-orange-100 dark:bg-orange-900/20',
    text: 'text-orange-800 dark:text-orange-200',
    border: 'border-orange-300 dark:border-orange-700',
    icon: 'text-orange-600 dark:text-orange-400',
  },
};

/**
 * Get color variants for a specific status
 *
 * @param status - The status to get colors for
 * @returns Color variants object with bg, text, border, and icon classes
 * @throws {Error} If status is invalid
 *
 * @example
 * ```typescript
 * const colors = getStatusColors('completed');
 * // Returns: { bg: 'bg-green-100 dark:bg-green-900/20', ... }
 *
 * // Use in components:
 * <div className={colors.bg}>
 *   <span className={colors.text}>Scan Completed</span>
 * </div>
 * ```
 */
export function getStatusColors(status: string): StatusColorVariant {
  const normalizedStatus = status.toLowerCase() as Status;

  if (!(normalizedStatus in STATUS_COLORS)) {
    throw new Error(
      `Invalid status: "${status}". ` +
      `Valid values are: ${Object.keys(STATUS_COLORS).join(', ')}`
    );
  }

  return STATUS_COLORS[normalizedStatus];
}

/**
 * Check if a string is a valid status
 *
 * @param value - The value to check
 * @returns True if the value is a valid status
 *
 * @example
 * ```typescript
 * isValidStatus('completed'); // true
 * isValidStatus('invalid');   // false
 * ```
 */
export function isValidStatus(value: string): value is Status {
  return value.toLowerCase() in STATUS_COLORS;
}

/**
 * Get all available statuses
 *
 * @returns Array of valid status values
 *
 * @example
 * ```typescript
 * const statuses = getStatuses();
 * // Returns: ['pending', 'running', 'scanning', 'completed', 'failed', 'cancelled', 'stale']
 * ```
 */
export function getStatuses(): Status[] {
  return Object.keys(STATUS_COLORS) as Status[];
}
