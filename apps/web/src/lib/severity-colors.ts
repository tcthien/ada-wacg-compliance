/**
 * Centralized Severity Color System
 *
 * Provides consistent color variants for severity levels across the application.
 * Supports both light and dark modes with Tailwind CSS classes.
 *
 * @module severity-colors
 */

/**
 * Valid severity levels for WCAG violations
 */
export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 * Color variant types for different UI contexts
 */
export interface SeverityColorVariant {
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
 * Severity color mapping
 *
 * Maps each severity level to its corresponding color variants.
 * Each variant includes light and dark mode classes.
 *
 * Color mapping (per design requirement 10.1):
 * - Critical: Red (#DC2626 / red-600)
 * - Serious: Orange (#EA580C / orange-600)
 * - Moderate: Yellow (#CA8A04 / yellow-600)
 * - Minor: Blue (#2563EB / blue-600)
 */
export const SEVERITY_COLORS: Record<Severity, SeverityColorVariant> = {
  critical: {
    bg: 'bg-red-100 dark:bg-red-900/20',
    text: 'text-red-800 dark:text-red-200',
    border: 'border-red-300 dark:border-red-700',
    icon: 'text-red-600 dark:text-red-400',
  },
  serious: {
    bg: 'bg-orange-100 dark:bg-orange-900/20',
    text: 'text-orange-800 dark:text-orange-200',
    border: 'border-orange-300 dark:border-orange-700',
    icon: 'text-orange-600 dark:text-orange-400',
  },
  moderate: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/20',
    text: 'text-yellow-800 dark:text-yellow-200',
    border: 'border-yellow-300 dark:border-yellow-700',
    icon: 'text-yellow-600 dark:text-yellow-400',
  },
  minor: {
    bg: 'bg-blue-100 dark:bg-blue-900/20',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-300 dark:border-blue-700',
    icon: 'text-blue-600 dark:text-blue-400',
  },
};

/**
 * Get color variants for a specific severity level
 *
 * @param severity - The severity level to get colors for
 * @returns Color variants object with bg, text, border, and icon classes
 * @throws {Error} If severity level is invalid
 *
 * @example
 * ```typescript
 * const colors = getSeverityColors('critical');
 * // Returns: { bg: 'bg-red-100 dark:bg-red-900/20', ... }
 *
 * // Use in components:
 * <div className={colors.bg}>
 *   <span className={colors.text}>Critical Issue</span>
 * </div>
 * ```
 */
export function getSeverityColors(severity: string): SeverityColorVariant {
  const normalizedSeverity = severity.toLowerCase() as Severity;

  if (!(normalizedSeverity in SEVERITY_COLORS)) {
    throw new Error(
      `Invalid severity level: "${severity}". ` +
      `Valid values are: ${Object.keys(SEVERITY_COLORS).join(', ')}`
    );
  }

  return SEVERITY_COLORS[normalizedSeverity];
}

/**
 * Check if a string is a valid severity level
 *
 * @param value - The value to check
 * @returns True if the value is a valid severity level
 *
 * @example
 * ```typescript
 * isValidSeverity('critical'); // true
 * isValidSeverity('invalid');  // false
 * ```
 */
export function isValidSeverity(value: string): value is Severity {
  return value.toLowerCase() in SEVERITY_COLORS;
}

/**
 * Get all available severity levels
 *
 * @returns Array of valid severity levels
 *
 * @example
 * ```typescript
 * const levels = getSeverityLevels();
 * // Returns: ['critical', 'serious', 'moderate', 'minor']
 * ```
 */
export function getSeverityLevels(): Severity[] {
  return Object.keys(SEVERITY_COLORS) as Severity[];
}
