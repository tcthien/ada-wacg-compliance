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
  };
}
