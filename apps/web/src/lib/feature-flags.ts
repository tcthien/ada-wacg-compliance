/**
 * Feature Flags
 *
 * Centralized feature flag management for gradual rollout and A/B testing.
 * Feature flags are read from NEXT_PUBLIC_* environment variables.
 */

export interface FeatureFlags {
  /**
   * Enable Discovery Flow V2
   *
   * When enabled, users will see the redesigned discovery flow with:
   * - Improved UX and accessibility
   * - Better error handling
   * - Enhanced URL validation
   *
   * Default: false (use legacy discovery flow)
   */
  discoveryV2Enabled: boolean;

  /**
   * Enable WCAG Criteria Coverage Table
   *
   * When enabled, scan result pages will show:
   * - Tabbed interface with Issues and Criteria Coverage tabs
   * - Complete WCAG criteria table with verification status
   * - Scanner source attribution (axe-core, AI, N/A)
   * - Click-through from failed criteria to related issues
   *
   * Default: true (enabled by default for new feature)
   */
  criteriaCoverageEnabled: boolean;
}

/**
 * Parse boolean from environment variable string
 * Handles 'true', 'false', '1', '0', undefined
 */
function parseEnvBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1';
}

/**
 * Feature Flags Hook
 *
 * @returns Object containing all feature flags
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { discoveryV2Enabled } = useFeatureFlags();
 *
 *   if (discoveryV2Enabled) {
 *     return <DiscoveryV2 />;
 *   }
 *
 *   return <DiscoveryLegacy />;
 * }
 * ```
 */
export function useFeatureFlags(): FeatureFlags {
  return {
    discoveryV2Enabled: parseEnvBoolean(
      process.env.NEXT_PUBLIC_DISCOVERY_V2_ENABLED,
      false
    ),
    criteriaCoverageEnabled: parseEnvBoolean(
      process.env.NEXT_PUBLIC_CRITERIA_COVERAGE_ENABLED,
      true // Enabled by default
    ),
  };
}

/**
 * Get feature flags (non-hook version for use outside React components)
 *
 * @returns Object containing all feature flags
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    discoveryV2Enabled: parseEnvBoolean(
      process.env.NEXT_PUBLIC_DISCOVERY_V2_ENABLED,
      false
    ),
    criteriaCoverageEnabled: parseEnvBoolean(
      process.env.NEXT_PUBLIC_CRITERIA_COVERAGE_ENABLED,
      true // Enabled by default
    ),
  };
}
