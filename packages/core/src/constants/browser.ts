/**
 * Browser-Safe Constants Module
 *
 * Exports only constants that are safe for browser use (no Node.js dependencies).
 * Use this import for frontend components.
 */

// WCAG 2.1 Constants (browser-safe)
export {
  WCAG_CRITERIA,
  AXE_RULE_TO_WCAG,
  UNTESTABLE_CRITERIA,
  getCriteriaByLevel,
  getCriteriaUpToLevel,
  getWCAGForAxeRule,
  getUntestableCriteria,
  getTestableCriteria,
  getAxeCoveredCriteria,
  type WCAGLevel,
  type WCAGCriterion
} from './wcag.constants.js';

// Severity Constants (browser-safe)
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

// Fix Guides Constants (browser-safe)
export {
  FIX_GUIDES,
  getFixGuideRuleIds,
  hasFixGuide,
  type FixGuide
} from './fix-guides.constants.js';
