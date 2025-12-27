/**
 * Severity Constants for Accessibility Issues
 *
 * Defines severity levels and their characteristics based on axe-core impact levels
 * and accessibility best practices.
 */

/**
 * Severity levels for accessibility issues
 */
export enum Severity {
  CRITICAL = 'critical',
  SERIOUS = 'serious',
  MODERATE = 'moderate',
  MINOR = 'minor'
}

/**
 * Detailed information about a severity level
 */
export interface SeverityInfo {
  /** Severity level identifier */
  level: Severity;
  /** Numeric priority (higher = more severe) */
  priority: number;
  /** User-friendly label */
  label: string;
  /** Detailed description of what this severity means */
  description: string;
  /** Impact on users with disabilities */
  userImpact: string;
  /** Recommended timeframe for remediation */
  remediationTimeframe: string;
  /** Color code for UI display (hex format) */
  color: string;
}

/**
 * Complete severity level definitions
 */
export const SEVERITY_LEVELS: Record<Severity, SeverityInfo> = {
  [Severity.CRITICAL]: {
    level: Severity.CRITICAL,
    priority: 4,
    label: 'Critical',
    description: 'Blocks access to key features or content for users with disabilities',
    userImpact: 'Complete barrier - prevents access to essential functionality or content. Users with disabilities cannot complete critical tasks.',
    remediationTimeframe: 'Immediate (within 24-48 hours)',
    color: '#d32f2f'
  },
  [Severity.SERIOUS]: {
    level: Severity.SERIOUS,
    priority: 3,
    label: 'Serious',
    description: 'Creates significant barriers to access for users with disabilities',
    userImpact: 'Significant barrier - causes major difficulty or frustration. Users may find workarounds but with substantial effort.',
    remediationTimeframe: 'High priority (within 1-2 weeks)',
    color: '#f57c00'
  },
  [Severity.MODERATE]: {
    level: Severity.MODERATE,
    priority: 2,
    label: 'Moderate',
    description: 'Creates some difficulty for users with disabilities',
    userImpact: 'Noticeable barrier - causes inconvenience or extra effort. Users can typically find alternative ways to access content.',
    remediationTimeframe: 'Medium priority (within 1 month)',
    color: '#fbc02d'
  },
  [Severity.MINOR]: {
    level: Severity.MINOR,
    priority: 1,
    label: 'Minor',
    description: 'Creates minor inconvenience for users with disabilities',
    userImpact: 'Minimal barrier - slightly annoying or confusing but doesn\'t prevent access. Users may not notice or can easily work around.',
    remediationTimeframe: 'Low priority (within 3 months)',
    color: '#7cb342'
  }
};

/**
 * Mapping from axe-core impact levels to our Severity enum
 *
 * axe-core uses impact levels: critical, serious, moderate, minor
 * This provides a standardized mapping for consistency.
 */
export const AXE_IMPACT_TO_SEVERITY: Record<string, Severity> = {
  'critical': Severity.CRITICAL,
  'serious': Severity.SERIOUS,
  'moderate': Severity.MODERATE,
  'minor': Severity.MINOR
};

/**
 * Get severity information by level
 */
export function getSeverityInfo(severity: Severity): SeverityInfo {
  return SEVERITY_LEVELS[severity];
}

/**
 * Get all severity levels ordered by priority (highest to lowest)
 */
export function getSeveritiesByPriority(): SeverityInfo[] {
  return Object.values(SEVERITY_LEVELS).sort((a, b) => b.priority - a.priority);
}

/**
 * Convert axe-core impact string to Severity enum
 */
export function mapAxeImpactToSeverity(impact: string): Severity {
  return AXE_IMPACT_TO_SEVERITY[impact.toLowerCase()] || Severity.MODERATE;
}

/**
 * Compare two severity levels
 * @returns positive if a > b, negative if a < b, 0 if equal
 */
export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_LEVELS[a].priority - SEVERITY_LEVELS[b].priority;
}

/**
 * Check if a severity level is higher than another
 */
export function isHigherSeverity(a: Severity, b: Severity): boolean {
  return compareSeverity(a, b) > 0;
}

/**
 * Filter severity levels by minimum priority
 */
export function filterByMinimumSeverity(minSeverity: Severity): Severity[] {
  const minPriority = SEVERITY_LEVELS[minSeverity].priority;
  return Object.values(Severity).filter(
    severity => SEVERITY_LEVELS[severity].priority >= minPriority
  );
}
