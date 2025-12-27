/**
 * Utility Functions Module
 *
 * Exports all utility functions for the ADAShield core package.
 */

// Fix Guide Mapper utilities
export {
  getFixGuideByRuleId,
  getFixGuidesByRuleIds,
  getAllFixGuides,
  hasFixGuideForRule,
  getFixGuideCount,
  searchFixGuides
} from './fix-guide-mapper.js';

// URL Security utilities
export {
  isPrivateIP,
  isBlockedHostname,
} from './url-security.js';
