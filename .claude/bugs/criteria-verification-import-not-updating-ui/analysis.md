# Bug Analysis: Criteria Verification Import Not Updating UI

## Analysis Status
**Complete** - Root cause identified, fix designed

## Investigation Summary

### Data Flow Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CURRENT (BROKEN) DATA FLOW                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AI Import ──► DB (criteria_verifications) ✅ WORKS                         │
│                        │                                                    │
│                        ▼                                                    │
│  getScanById() ──► Query scan + issues ❌ NO criteriaVerifications          │
│                        │                                                    │
│                        ▼                                                    │
│  formatResult() ──► computeVerificationsFromLegacyData() ❌ IGNORES DB      │
│                        │                                                    │
│                        ▼                                                    │
│  API Response ──► Frontend ❌ Shows legacy computed data                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ EXPECTED (FIXED) DATA FLOW                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AI Import ──► DB (criteria_verifications) ✅                               │
│                        │                                                    │
│                        ▼                                                    │
│  getScanById() ──► Query scan + issues + criteriaVerifications ✅           │
│                        │                                                    │
│                        ▼                                                    │
│  formatResult() ──► Use stored verifications if exist,                      │
│                     else computeVerificationsFromLegacyData() ✅            │
│                        │                                                    │
│                        ▼                                                    │
│  API Response ──► Frontend ✅ Shows AI verification data                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Root Cause

**Two code locations need fixes:**

### Issue 1: Repository Missing Include

**File:** `apps/api/src/modules/scans/scan.repository.ts:172-185`

```typescript
const scan = await prisma.scan.findUnique({
  where: { id },
  include: {
    scanResult: {
      include: {
        issues: { orderBy: { impact: 'asc' } },
        // MISSING: criteriaVerifications
      },
    },
  },
});
```

**Problem:** The Prisma query doesn't include `criteriaVerifications` relation.

**Evidence from schema:** `ScanResult` model has relation defined:
```prisma
model ScanResult {
  ...
  criteriaVerifications CriteriaVerification[]
}
```

### Issue 2: Service Always Computes Instead of Using Stored Data

**File:** `apps/api/src/modules/results/result.service.ts:318-333`

```typescript
// Compute enhanced criteria verifications
// For now, compute from legacy data (until stored verifications are available)
const criteriaVerifications = coverageService.computeVerificationsFromLegacyData(
  { passedChecks, inapplicableChecks },
  issues,
  wcagLevel,
  [] // No specific rule IDs available in legacy data
);
```

**Problem:** The code explicitly says "until stored verifications are available" but:
1. Never fetches stored verifications (Issue 1)
2. Never checks if stored verifications exist
3. Always falls back to legacy computation

## Solution Design

### Fix 1: Update ScanWithResult Interface and Query

**File:** `apps/api/src/modules/scans/scan.repository.ts`

1. Update `ScanWithResult` interface to include `criteriaVerifications`:
```typescript
export interface ScanWithResult extends Scan {
  scanResult: (ScanResult & {
    issues: Issue[];
    criteriaVerifications: CriteriaVerification[];
  }) | null;
}
```

2. Update `getScanById` query to include `criteriaVerifications`:
```typescript
const scan = await prisma.scan.findUnique({
  where: { id },
  include: {
    scanResult: {
      include: {
        issues: { orderBy: { impact: 'asc' } },
        criteriaVerifications: {
          orderBy: { criterionId: 'asc' },
        },
      },
    },
  },
});
```

### Fix 2: Use Stored Verifications When Available

**File:** `apps/api/src/modules/results/result.service.ts`

Update `formatResult()` to check for stored verifications:

```typescript
// Use stored verifications if available (from AI import)
// Otherwise, compute from legacy data for backward compatibility
let criteriaVerifications: CriteriaVerification[];

if (scanResult.scanResult.criteriaVerifications &&
    scanResult.scanResult.criteriaVerifications.length > 0) {
  // Use stored AI verifications
  criteriaVerifications = scanResult.scanResult.criteriaVerifications.map(v => ({
    criterionId: v.criterionId,
    status: v.status as CriteriaStatus,
    scanner: v.scanner,
    confidence: v.confidence ?? undefined,
    reasoning: v.reasoning ?? undefined,
    // Note: issueIds need to be resolved from the relation if needed
  }));
} else {
  // Legacy fallback: compute from issues/passed checks
  const issues = scanResult.scanResult.issues.map(issue => ({
    id: issue.id,
    wcagCriteria: issue.wcagCriteria,
  }));

  criteriaVerifications = coverageService.computeVerificationsFromLegacyData(
    { passedChecks: scanResult.scanResult.passedChecks, ... },
    issues,
    scanResult.wcagLevel,
    []
  );
}
```

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Breaking existing scans | Low | Legacy fallback preserved |
| Performance impact | Low | Additional join is indexed |
| Type safety | Low | Update interface first |

## Testing Plan

### Manual Tests
1. Verify existing scans without AI still work (legacy fallback)
2. Import AI scan CSV and verify UI shows AI data
3. Check coverage percentages update correctly

### Verification Queries
```sql
-- Before fix: API returns computed data
-- After fix: API returns this data
SELECT cv."criterionId", cv.status, cv.scanner, cv.confidence
FROM criteria_verifications cv
JOIN scan_results sr ON sr.id = cv."scanResultId"
JOIN scans s ON s.id = sr."scanId"
WHERE s.id = '<scan-id>'
ORDER BY cv."criterionId";
```

## Implementation Order

1. **Fix 1:** Update `scan.repository.ts`
   - Update `ScanWithResult` interface
   - Add `criteriaVerifications` to include query

2. **Fix 2:** Update `result.service.ts`
   - Add conditional logic to use stored verifications
   - Preserve legacy fallback

3. **Test:** Verify both old and new scans work correctly

---

**Does this analysis look correct? If so, we can proceed to implement the fix.**
