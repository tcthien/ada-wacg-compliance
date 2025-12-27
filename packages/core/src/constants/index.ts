/**
 * Constants Module
 *
 * Exports all accessibility testing constants including WCAG criteria,
 * severity levels, and rule mappings.
 */

// WCAG 2.1 Constants
export {
  WCAG_CRITERIA,
  AXE_RULE_TO_WCAG,
  getCriteriaByLevel,
  getCriteriaUpToLevel,
  getWCAGForAxeRule,
  type WCAGLevel,
  type WCAGCriterion
} from './wcag.constants.js';

// Severity Constants
export {
  Severity,
  SEVERITY_LEVELS,
  AXE_IMPACT_TO_SEVERITY,
  getSeverityInfo,
  getSeveritiesByPriority,
  mapAxeImpactToSeverity,
  compareSeverity,
  isHigherSeverity,
  filterByMinimumSeverity,
  type SeverityInfo
} from './severity.constants.js';

// GDPR Compliance Constants
export {
  GDPR_RETENTION_PERIODS,
  ANONYMIZATION_CONFIG,
  ANONYMIZED_FIELDS,
  PRESERVED_FIELDS,
  generateAnonFingerprint,
  isAnonymizedFingerprint,
  shouldAnonymizeField,
  shouldPreserveField,
  calculateExpirationDate,
  hasDataExpired,
  type AnonymizedField,
  type PreservedField
} from './gdpr.constants.js';

// Fix Guides Constants
export {
  FIX_GUIDES,
  getFixGuideRuleIds,
  hasFixGuide,
  type FixGuide
} from './fix-guides.constants.js';
