# Implementation Plan: WCAG Criteria Coverage Table

## Task Overview

This implementation adds a comprehensive WCAG criteria coverage table to scan detail pages, enhances the AI scan tool to verify additional criteria, and updates coverage statistics to show actual computed values. The work is organized into 6 phases with atomic tasks.

## Steering Document Compliance

- **structure.md**: Components in `apps/web/src/components/features/compliance/`, API in `apps/api/src/modules/results/`
- **tech.md**: React + TypeScript, Radix UI components, TailwindCSS, Prisma ORM

## Atomic Task Requirements

**Each task meets these criteria:**
- **File Scope**: 1-3 related files
- **Time Boxing**: 15-30 minutes
- **Single Purpose**: One testable outcome
- **Specific Files**: Exact paths provided
- **Agent-Friendly**: Clear input/output

## Tasks

### Phase 1: Core Types and Constants

- [ ] 1. Create CriteriaVerification types in shared package
  - File: `packages/core/src/types/criteria.types.ts`
  - Define `CriteriaStatus`, `ScannerSource`, `CriteriaVerification`, `CriteriaVerificationSummary` interfaces
  - Export from `packages/core/src/types/index.ts`
  - Purpose: Establish shared type definitions for criteria verification
  - _Leverage: `packages/core/src/types/issue.types.ts` for pattern_
  - _Requirements: 2.1, 6.2_

- [ ] 2. Add list of untestable WCAG criteria to constants
  - File: `packages/core/src/constants/wcag.constants.ts`
  - Add `UNTESTABLE_CRITERIA` array with 28 criteria IDs that axe-core can't test
  - Add `getUntestableCriteria(level: WCAGLevel)` helper function
  - Purpose: Define which criteria AI should attempt to verify
  - _Leverage: Existing `WCAG_CRITERIA`, `AXE_RULE_TO_WCAG` in same file_
  - _Requirements: 5.1_

- [ ] 3. Build core package and verify exports
  - Files: `packages/core/package.json`, `packages/core/src/index.ts`
  - Run `pnpm build` in packages/core
  - Verify new types are exported correctly
  - Purpose: Ensure types are available for API and web packages
  - _Leverage: Existing build configuration_
  - _Requirements: 1.1, 2.1_

### Phase 2: Database and API Layer

- [ ] 4. Create CriteriaVerification database schema
  - File: `apps/api/prisma/schema.prisma`
  - Add `CriteriaVerification` model with fields: id, scanResultId, criterionId, status, scanner, confidence, reasoning, createdAt
  - Add relation to ScanResult and unique constraint on [scanResultId, criterionId]
  - Purpose: Store per-criterion verification status
  - _Leverage: Existing `ScanResult`, `Issue` models in same file_
  - _Requirements: 6.1, 6.2_

- [ ] 5. Generate and run Prisma migration
  - Files: `apps/api/prisma/migrations/`
  - Run `pnpm prisma migrate dev --name add_criteria_verification`
  - Verify migration applies successfully
  - Purpose: Apply database schema changes
  - _Leverage: Existing migration patterns_
  - _Requirements: 6.1_

- [ ] 6. Update CoverageService with buildCriteriaVerifications method
  - File: `apps/api/src/modules/results/coverage.service.ts`
  - Add `buildCriteriaVerifications()` method that:
    - Maps axe-core passed rules to PASS status
    - Maps issues to FAIL status
    - Merges AI verifications (AI takes precedence)
    - Marks remaining as NOT_TESTED
  - Purpose: Build verification list from scan data
  - _Leverage: Existing `AXE_RULE_TO_WCAG` mapping, `getUniqueCriteriaFromIssues()`_
  - _Requirements: 9.5, 9.6, 9.7_

- [ ] 7. Update CoverageService with calculateCoverageFromVerifications method
  - File: `apps/api/src/modules/results/coverage.service.ts`
  - Add `calculateCoverageFromVerifications()` method that:
    - Counts criteria by status
    - Calculates ACTUAL percentage: `(criteriaChecked / criteriaTotal) * 100`
    - Returns `EnhancedCoverageMetrics` with summary
  - Purpose: Replace estimated coverage with actual computed values
  - _Leverage: Existing `calculateCoverage()` method structure_
  - _Requirements: 9.1, 9.2, 10.1, 10.2, 10.3_

- [ ] 8. Add computeVerificationsFromLegacyData for backward compatibility
  - File: `apps/api/src/modules/results/coverage.service.ts`
  - Add method to compute verifications from issues + passed checks for old scans
  - Purpose: Support existing scans without stored verifications
  - _Leverage: Existing `estimateCriteriaFromPassedChecks()` logic_
  - _Requirements: 6.4, 9.5_

- [ ] 9. Write unit tests for CoverageService new methods
  - File: `apps/api/src/modules/results/coverage.service.test.ts`
  - Test `buildCriteriaVerifications()` with various input combinations
  - Test `calculateCoverageFromVerifications()` accuracy
  - Test backward compatibility method
  - Purpose: Verify coverage calculations are accurate
  - _Leverage: Existing test patterns in codebase_
  - _Requirements: 9.1-9.7, 10.1-10.5_

- [ ] 10. Update ResultService to include criteriaVerifications in response
  - File: `apps/api/src/modules/results/result.service.ts`
  - Modify `formatScanResult()` to call coverage service and include verifications
  - Add aiModel field to response for scanner display
  - Purpose: Serve criteria verification data to frontend
  - _Leverage: Existing `formatScanResult()` method_
  - _Requirements: 6.3, 3.2_

### Phase 3: Frontend Components - Criteria Table

- [ ] 11. Create CriteriaTable component
  - File: `apps/web/src/components/features/compliance/CriteriaTable.tsx`
  - Create table component with columns: ID, Name, Description, Status, Scanner
  - Accept `verifications`, `wcagLevel`, `onCriterionClick`, `aiModel` props
  - Implement status badge rendering with colors from design
  - Purpose: Display all WCAG criteria with verification status
  - _Leverage: `apps/web/src/components/ui/table.tsx`, `Badge` component_
  - _Requirements: 2.1-2.8, 3.1-3.4_

- [ ] 12. Add sorting functionality to CriteriaTable
  - File: `apps/web/src/components/features/compliance/CriteriaTable.tsx`
  - Implement custom sort order: Fail → Not Tested → Pass
  - Implement numeric sorting for criterion IDs
  - Add sortable column headers
  - Purpose: Enable users to sort criteria by status or ID
  - _Leverage: Existing table patterns_
  - _Requirements: 7.1, 7.2_

- [ ] 13. Add filtering functionality to CriteriaTable
  - File: `apps/web/src/components/features/compliance/CriteriaTable.tsx`
  - Add status filter dropdown (All, Pass, Fail, Not Tested)
  - Add WCAG level filter (All, A, AA)
  - Display filter count "Showing X of Y criteria"
  - Purpose: Enable users to focus on specific criteria
  - _Leverage: Existing filter patterns, Radix UI Select_
  - _Requirements: 7.3, 7.4, 7.5_

- [ ] 14. Add click handler for failed criteria linking
  - File: `apps/web/src/components/features/compliance/CriteriaTable.tsx`
  - Make failed criteria rows clickable
  - Display issue count badge (e.g., "Fail (3 issues)")
  - Call `onCriterionClick` callback when clicked
  - Purpose: Enable navigation from criteria to related issues
  - _Leverage: Existing clickable row patterns_
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 15. Write tests for CriteriaTable component
  - File: `apps/web/src/components/features/compliance/CriteriaTable.test.tsx`
  - Test rendering with various verification statuses
  - Test sorting functionality
  - Test filtering functionality
  - Test click handler for failed criteria
  - Purpose: Ensure component works correctly
  - _Leverage: Existing component test patterns_
  - _Requirements: 2.1-2.8, 7.1-7.5_

### Phase 4: Frontend Components - Tabbed Interface

- [ ] 16. Create ScanResultsTabs container component
  - File: `apps/web/src/components/features/compliance/ScanResultsTabs.tsx`
  - Create tabbed container with "Issues" and "Criteria Coverage" tabs
  - Manage active tab state and filter state
  - Pass filtered issues to IssueList based on criterion filter
  - Purpose: Container for switching between issues and criteria views
  - _Leverage: `apps/web/src/components/ui/tabs.tsx` (Radix UI)_
  - _Requirements: 1.1, 1.2, 1.3, 4.2_

- [ ] 17. Add issue filtering logic to ScanResultsTabs
  - File: `apps/web/src/components/features/compliance/ScanResultsTabs.tsx`
  - Implement `handleCriterionClick` to switch tab and set filter
  - Implement `handleClearFilter` to reset filter
  - Filter issues by `wcagCriteria` field
  - Purpose: Enable navigation from criteria table to filtered issues
  - _Leverage: React useState for state management_
  - _Requirements: 4.2, 4.3_

- [ ] 18. Add tab persistence with URL state
  - File: `apps/web/src/components/features/compliance/ScanResultsTabs.tsx`
  - Use URL search params to persist active tab
  - Restore tab state on page load
  - Purpose: Preserve user's tab selection on navigation
  - _Leverage: Next.js useSearchParams hook_
  - _Requirements: 1.5_

- [ ] 19. Update scan detail page to use ScanResultsTabs
  - File: `apps/web/src/app/scan/[id]/page.tsx`
  - Replace direct IssueList usage with ScanResultsTabs
  - Pass issues, verifications, wcagLevel, aiModel props
  - Purpose: Integrate tabbed interface into scan results page
  - _Leverage: Existing page structure_
  - _Requirements: 1.1-1.5_

- [ ] 20. Write tests for ScanResultsTabs component
  - File: `apps/web/src/components/features/compliance/ScanResultsTabs.test.tsx`
  - Test tab switching
  - Test issue filtering when criterion clicked
  - Test filter clearing
  - Purpose: Ensure tabbed interface works correctly
  - _Leverage: Existing component test patterns_
  - _Requirements: 1.1-1.5, 4.1-4.4_

### Phase 5: Update Scan Coverage Card

- [ ] 21. Update ScanCoverageCard to use actual computed values
  - File: `apps/web/src/components/features/compliance/ScanCoverageCard.tsx`
  - Update to display actual coverage percentage from verifications
  - Update breakdown to show criteriaWithIssues, criteriaPassed, criteriaNotTested
  - Remove hardcoded 57%/75-85% ranges
  - Purpose: Display accurate statistics from criteria verifications
  - _Leverage: Existing component structure_
  - _Requirements: 9.1-9.4, 10.1-10.5_

- [ ] 22. Update CriteriaCoverage tooltip component
  - File: `apps/web/src/components/features/compliance/CriteriaCoverage.tsx`
  - Update tooltip to show new breakdown categories
  - Add AI-verified count to breakdown
  - Purpose: Show detailed breakdown in tooltip
  - _Leverage: Existing tooltip structure_
  - _Requirements: 9.2_

- [ ] 23. Update CoverageDisclaimer for actual values
  - File: `apps/web/src/components/features/compliance/CoverageDisclaimer.tsx`
  - Update disclaimer text to reflect actual coverage
  - Show AI-enhanced message when AI criteria are verified
  - Purpose: Provide accurate context for coverage values
  - _Leverage: Existing component_
  - _Requirements: 10.4, 10.5_

- [ ] 24. Write tests for updated coverage components
  - File: `apps/web/src/components/features/compliance/ScanCoverageCard.test.tsx`
  - Test that actual percentage is displayed (not theoretical)
  - Test breakdown shows correct counts
  - Purpose: Verify coverage display accuracy
  - _Leverage: Existing test patterns_
  - _Requirements: 9.1-9.4, 10.1-10.5_

### Phase 6: AI Scan Tool Enhancement

- [ ] 25. Add AiCriteriaVerification type to AI scan CLI
  - File: `tools/ai-scan-cli/src/types.ts`
  - Add `AiCriteriaVerification` interface with criterionId, status, confidence, reasoning
  - Update `ScanResult` type to include optional `criteriaVerifications` array
  - Purpose: Define types for AI criteria verification output
  - _Leverage: Existing types in same file_
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 26. Create prompt generator for criteria verification
  - File: `tools/ai-scan-cli/src/prompt-generator.ts`
  - Add function to generate criteria verification section
  - Include list of untestable criteria for the WCAG level
  - Purpose: Generate prompt for AI to verify additional criteria
  - _Leverage: Existing `generateIssueEnhancementPrompt()` function_
  - _Requirements: 5.1_

- [ ] 27. Update issue-enhancement-prompt.hbs template
  - File: `tools/ai-scan-cli/templates/issue-enhancement-prompt.hbs`
  - Add "Additional Criteria Verification" section
  - Include output format for criteriaVerifications array
  - Add rules for confidence scoring
  - Purpose: Instruct AI to verify untestable criteria
  - _Leverage: Existing template structure_
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 28. Add parseCriteriaVerifications to result parser
  - File: `tools/ai-scan-cli/src/result-parser.ts`
  - Add function to extract and validate criteriaVerifications from AI response
  - Validate confidence is 0-100
  - Truncate reasoning to 1000 chars
  - Purpose: Parse AI verification output
  - _Leverage: Existing `parseClaudeOutput()` patterns_
  - _Requirements: 5.2, 5.3_

- [ ] 29. Update result transformer for criteria verifications
  - File: `tools/ai-scan-cli/src/result-transformer.ts`
  - Include criteriaVerifications in CSV output
  - Add ai_criteria_verifications_json column
  - Purpose: Include AI verifications in import file
  - _Leverage: Existing `transformToImportFormat()` function_
  - _Requirements: 5.5_

- [ ] 30. Update AI import API to accept criteria verifications
  - File: `apps/api/src/modules/results/result.service.ts` (or import endpoint)
  - Parse and store criteriaVerifications from AI import
  - Merge with axe-core verifications
  - Purpose: Store AI-verified criteria in database
  - _Leverage: Existing import logic_
  - _Requirements: 5.5, 6.1_

- [ ] 31. Build and test AI scan CLI changes
  - Files: `tools/ai-scan-cli/`
  - Run `pnpm build` in tools/ai-scan-cli
  - Test with sample scan to verify criteria verification output
  - Purpose: Verify AI scan enhancement works end-to-end
  - _Leverage: Existing test patterns_
  - _Requirements: 5.1-5.5_

### Phase 7: Admin View Enhancement

- [ ] 32. Create CriteriaTableAdmin component
  - File: `apps/web/src/components/features/compliance/CriteriaTableAdmin.tsx`
  - Extend CriteriaTable with confidence and reasoning columns
  - Display confidence as progress bar (0-100)
  - Show reasoning in expandable row
  - Purpose: Provide admin-specific view with AI details
  - _Leverage: CriteriaTable component_
  - _Requirements: 8.2, 8.3_

- [ ] 33. Update admin scan detail page to use tabbed interface
  - File: `apps/web/src/app/admin/scans/[id]/page.tsx`
  - Add ScanResultsTabs with isAdmin=true prop
  - Use CriteriaTableAdmin for criteria tab
  - Purpose: Integrate tabbed interface into admin view
  - _Leverage: Existing admin page structure_
  - _Requirements: 8.1_

- [ ] 34. Add criteria coverage to scan export
  - File: `apps/api/src/modules/results/` (export endpoint)
  - Include criteriaVerifications in exported report
  - Add confidence and reasoning for admin exports
  - Purpose: Enable exporting criteria coverage data
  - _Leverage: Existing export logic_
  - _Requirements: 8.4_

### Phase 8: Final Integration and Testing

- [ ] 35. Add feature flag for criteria coverage table
  - Files: `apps/web/src/lib/feature-flags.ts`, environment config
  - Add `FEATURE_CRITERIA_TABLE` flag
  - Conditionally render ScanResultsTabs based on flag
  - Purpose: Enable gradual rollout
  - _Leverage: Existing feature flag patterns if any_
  - _Requirements: Non-functional (Compatibility)_

- [ ] 36. Write E2E test for complete criteria coverage flow
  - File: `apps/web/e2e/criteria-coverage.spec.ts` (or similar)
  - Test complete flow: view scan → switch to criteria tab → click failed criterion → view filtered issues
  - Test coverage card shows accurate statistics
  - Purpose: Verify end-to-end functionality
  - _Leverage: Existing E2E test patterns_
  - _Requirements: All_

- [ ] 37. Update batch scan page with criteria coverage
  - File: `apps/web/src/app/batch/[id]/page.tsx`
  - Add aggregated criteria coverage display
  - Show breakdown across all scans in batch
  - Purpose: Extend criteria coverage to batch view
  - _Leverage: Existing BatchCoverageCard component_
  - _Requirements: 2.1 (extended)_

- [ ] 38. Performance optimization and final polish
  - Files: Various components
  - Add loading states for criteria table
  - Implement virtualization for 78+ criteria (AAA level)
  - Ensure mobile responsiveness
  - Purpose: Meet performance and usability requirements
  - _Leverage: React virtualization libraries_
  - _Requirements: Non-functional (Performance, Usability)_

---

**Total Tasks**: 38
**Estimated Phases**: 8
**Created**: 2026-01-18
**Status**: Draft - Pending Approval
