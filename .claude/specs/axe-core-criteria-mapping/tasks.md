# Implementation Plan: Axe-Core Criteria Mapping

## Status: Ready for Implementation

## Task Overview

This plan implements the axe-core criteria mapping feature to store and map passed rule IDs to WCAG criteria. The implementation follows a database-first approach: schema → types → scanner → job processor → API service → tests.

**Approach:** Minimal changes leveraging existing `coverageService.buildCriteriaVerifications()` which already accepts `passedChecks: string[]`. We simply need to capture and pass the actual rule IDs instead of empty arrays.

## Steering Document Compliance

- **tech.md:** Uses Prisma ORM patterns, TypeScript interfaces, existing service methods
- **structure.md:** Changes follow established paths (prisma schema, worker processors, API modules)

## Atomic Task Requirements

Each task in this plan meets these criteria:
- **File Scope:** 1-3 related files maximum
- **Time Boxing:** 15-30 minutes for experienced developer
- **Single Purpose:** One testable outcome
- **Specific Files:** Exact paths provided
- **Agent-Friendly:** Clear implementation details with code snippets

## Task Dependencies

```
Task 1 (Schema) → Task 2 (Migration) → Task 3 (Types)
                                           ↓
                           Task 4 (Scanner) → Task 5 (Job)
                                                  ↓
                                           Task 6 (Service)
                                                  ↓
                              Task 7 (Unit Tests) + Task 8 (E2E Tests)
```

## Tasks

### Task 1: Add passedRuleIds to Prisma Schema
**Requirement Reference:** R1 (Store Axe-Core Passed Rule IDs)
**Files:** `apps/api/prisma/schema.prisma`
**Leverages:** Existing ScanResult model

#### Specification
Add `passedRuleIds` field to the `ScanResult` model in the Prisma schema.

#### Implementation Details
1. Open `apps/api/prisma/schema.prisma`
2. Find the `ScanResult` model (around line 216)
3. Add after `inapplicableChecks`:
   ```prisma
   passedRuleIds      String[] @default([])
   ```
4. Ensure field is added BEFORE the relation fields

#### Acceptance Criteria
- [ ] `passedRuleIds` field added to ScanResult model
- [ ] Default value is empty array `[]`
- [ ] Field type is `String[]` (PostgreSQL text array)

---

### Task 2: Generate and Apply Database Migration
**Requirement Reference:** R1, R5 (Backward Compatibility)
**Files:** `apps/api/prisma/migrations/` (new migration folder)
**Leverages:** Prisma migrate

#### Specification
Generate Prisma migration for the new `passedRuleIds` column.

#### Implementation Details
1. Navigate to `apps/api` directory
2. Run: `npx prisma migrate dev --name add_passed_rule_ids`
3. Verify migration SQL contains:
   ```sql
   ALTER TABLE "scan_results" ADD COLUMN "passedRuleIds" TEXT[] DEFAULT '{}';
   ```
4. Run: `npx prisma generate` to update Prisma client

#### Acceptance Criteria
- [ ] Migration file created in `apps/api/prisma/migrations/`
- [ ] Migration applies successfully to development database
- [ ] Prisma client regenerated with new field
- [ ] Existing scan_results rows unaffected (default empty array)

---

### Task 3: Update ScanResult Type Definition
**Requirement Reference:** R1
**Files:** `apps/worker/src/processors/scanner/page-scanner.ts`
**Leverages:** Existing ScanResult interface defined inline in page-scanner.ts

#### Specification
Add `passedRuleIds: string[]` to the ScanResult interface returned by the scanner.

#### Implementation Details
1. Open `apps/worker/src/processors/scanner/page-scanner.ts`
2. Find the `ScanResult` interface (defined at the top of the file or inline)
3. Add `passedRuleIds: string[]` field alongside existing `passes: number`:
   ```typescript
   interface ScanResult {
     issues: MappedIssue[];
     passes: number;
     passedRuleIds: string[];  // NEW
     inapplicable: number;
   }
   ```

**Note:** The type is defined locally in page-scanner.ts, not in a shared package. This keeps the worker self-contained.

#### Acceptance Criteria
- [x] `passedRuleIds: string[]` added to ScanResult type
- [x] TypeScript compiles without errors
- [x] Existing `passes: number` field retained for backward compatibility

---

### Task 4: Extract passedRuleIds in Page Scanner
**Requirement Reference:** R1.AC1
**Files:** `apps/worker/src/processors/scanner/page-scanner.ts`
**Leverages:** Existing axeResults.passes array

#### Specification
Modify the scanner to extract and return the array of passed rule IDs from axe-core results.

#### Implementation Details
1. Open `apps/worker/src/processors/scanner/page-scanner.ts`
2. Find the `scanPage()` function return statement
3. Add extraction of rule IDs:
   ```typescript
   return {
     issues: mappedIssues,
     passes: axeResults.passes.length,
     passedRuleIds: axeResults.passes.map((pass) => pass.id),  // NEW
     inapplicable: axeResults.inapplicable.length,
   };
   ```

#### Acceptance Criteria
- [x] `passedRuleIds` extracted from `axeResults.passes[].id`
- [x] Returns array of strings (rule IDs like "color-contrast", "image-alt")
- [x] Empty array returned when no passes
- [x] `passes` count matches `passedRuleIds.length`

---

### Task 5: Persist passedRuleIds in Job Processor
**Requirement Reference:** R1.AC1, R1.AC3
**Files:** `apps/worker/src/jobs/scan-page.job.ts`
**Leverages:** Existing createScanResult() function

#### Specification
Update the job processor to store passedRuleIds when creating ScanResult records.

#### Implementation Details
1. Open `apps/worker/src/jobs/scan-page.job.ts`
2. Find the `createScanResult()` function or where `prisma.scanResult.create()` is called
3. Add `passedRuleIds` to the data object:
   ```typescript
   await prisma.scanResult.create({
     data: {
       // existing fields...
       passedChecks: scanResult.passes,
       passedRuleIds: scanResult.passedRuleIds ?? [],  // NEW - with fallback
       inapplicableChecks: scanResult.inapplicable,
     }
   });
   ```

#### Acceptance Criteria
- [x] `passedRuleIds` included in ScanResult creation
- [x] Fallback to empty array if undefined (defensive coding)
- [x] Database stores array correctly
- [x] No changes to existing fields

---

### Task 6: Pass passedRuleIds to Coverage Service
**Requirement Reference:** R2 (Map Passed Rules to WCAG Criteria)
**Files:** `apps/api/src/modules/results/result.service.ts`
**Leverages:** Existing buildCriteriaVerifications() method, existing passedChecks parameter

#### Specification
Update result.service.ts to pass the stored passedRuleIds to buildCriteriaVerifications() instead of an empty array.

#### Implementation Details
1. Open `apps/api/src/modules/results/result.service.ts`
2. Find the `formatResult()` method where `buildCriteriaVerifications()` is called
3. Change from:
   ```typescript
   passedChecks: [],  // or some legacy handling
   ```
   To:
   ```typescript
   passedChecks: scanResult.scanResult?.passedRuleIds ?? [],
   ```
4. Ensure the scanResult query includes `passedRuleIds` in the select

#### Acceptance Criteria
- [x] `passedRuleIds` passed to `buildCriteriaVerifications()`
- [x] Fallback to empty array for legacy scans without passedRuleIds
- [x] Criteria verifications now show PASS status for axe-core passed criteria
- [x] API response structure unchanged

---

### Task 6b: Verify Summary Statistics Alignment
**Requirement Reference:** R4 (Align Summary Statistics with Criteria Table)
**Files:** `apps/api/src/modules/results/result.service.ts`, `apps/api/src/modules/results/coverage.service.ts`
**Leverages:** Existing enhancedCoverage computation

#### Specification
Verify that the `enhancedCoverage.breakdown` (which feeds Summary display) correctly reflects criteria-level counts derived from `criteriaVerifications`.

#### Implementation Details
1. Review the flow in `result.service.ts`:
   - `buildCriteriaVerifications()` returns `criteriaVerifications[]`
   - `enhancedCoverage` is computed from these verifications
   - `breakdown.passed` = count of PASS + AI_VERIFIED_PASS
   - `breakdown.failed` = count of FAIL + AI_VERIFIED_FAIL
2. Verify `coverage.service.ts` computes `breakdown` correctly
3. **No code changes expected** - this task verifies the existing flow works correctly with new data
4. If issues found, document and create follow-up tasks

#### Acceptance Criteria
- [ ] `enhancedCoverage.breakdown.passed` equals count of criteria with PASS or AI_VERIFIED_PASS status
- [ ] `enhancedCoverage.breakdown.failed` equals count of criteria with FAIL or AI_VERIFIED_FAIL status
- [ ] Numbers derivable from criteria table match Summary section display

---

### Task 7: Add Unit Tests for Passed Rule ID Handling
**Requirement Reference:** R2.AC1, R2.AC2, R2.AC3
**Files:** `apps/api/src/modules/results/coverage.service.test.ts`
**Leverages:** Existing test patterns, AXE_RULE_TO_WCAG constant

#### Specification
Add unit tests to verify that passedRuleIds are correctly mapped to criteria verifications.

#### Implementation Details
1. Open `apps/api/src/modules/results/coverage.service.test.ts`
2. Add test cases for:
   - Passed rule IDs map to PASS status
   - Multiple rules mapping to same criterion
   - FAIL overrides PASS for same criterion
   - AI_VERIFIED_* overrides axe-core status
   - Unknown rule IDs are skipped

#### Test Cases
```typescript
describe('buildCriteriaVerifications with passedRuleIds', () => {
  it('should mark criteria as PASS when rule passes', () => {
    // passedChecks: ['color-contrast'] → criterion 1.4.3 = PASS
  });

  it('should mark FAIL when issue exists for passed criterion', () => {
    // passedChecks: ['color-contrast'], issues with 1.4.3 → FAIL (not PASS)
  });

  it('should skip unknown rule IDs', () => {
    // passedChecks: ['unknown-rule-xyz'] → no criteria affected
  });
});
```

#### Acceptance Criteria
- [x] Test for PASS status from passed rules
- [x] Test for FAIL precedence over PASS
- [x] Test for AI_VERIFIED_* precedence
- [x] Test for unknown rule ID handling
- [x] All tests pass

---

### Task 8: Add Integration Test for End-to-End Flow
**Requirement Reference:** R3, R4, R5
**Files:** `apps/web/e2e/criteria-coverage.spec.ts` (extend existing)
**Leverages:** Existing E2E test infrastructure

#### Specification
Add or extend E2E tests to verify the complete flow from scan to criteria table display.

#### Implementation Details
1. Open `apps/web/e2e/criteria-coverage.spec.ts`
2. Add test case for axe-core passed criteria display:
   - Trigger a new scan
   - Wait for completion
   - Verify criteria table shows PASS status for criteria with passed axe rules
   - Verify scanner field shows "axe-core" for those criteria

#### Acceptance Criteria
- [x] E2E test verifies PASS status appears in criteria table
- [x] Scanner field shows correct source
- [x] Test passes in CI environment

---

## Completion Checklist

- [x] Task 1: Prisma schema updated
- [x] Task 2: Database migration applied
- [x] Task 3: Type definitions updated
- [x] Task 4: Scanner extracts passedRuleIds
- [x] Task 5: Job processor persists passedRuleIds
- [x] Task 6: Service passes passedRuleIds to coverage
- [ ] Task 6b: Summary statistics alignment verified
- [x] Task 7: Unit tests added and passing
- [x] Task 8: E2E test added and passing

## Notes

- **Backward Compatibility:** Legacy scans without `passedRuleIds` will have `null` or `[]`, which falls back to existing behavior via `computeVerificationsFromLegacyData()`
- **No UI Changes Required:** The existing CriteriaTable component already displays PASS/FAIL status; this feature just provides accurate data
- **Incremental Deployment:** Each task can be deployed independently after its dependencies are complete
