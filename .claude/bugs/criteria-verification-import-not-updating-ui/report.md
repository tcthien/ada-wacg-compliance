# Bug Report: Criteria Verification Import Not Updating UI

## Bug ID
`criteria-verification-import-not-updating-ui`

## Summary
After successfully importing AI scan results with criteria verifications (`ai_criteria_verifications_json`), the UI does not display the AI verification data. The database contains the imported verifications (50 rows), but the API returns computed legacy data instead of the stored AI verifications.

## Severity
**High** - Feature not working despite successful import

## Status
**Open** - Ready for analysis

## Environment
- Application: ADAShield API + Web Frontend
- Database: PostgreSQL with criteria_verifications table
- Import Source: `tools/ai-scan-cli/results/ai-results-ai-pending-scans-2026-01-18(1)-20260118-134238.csv`

## Steps to Reproduce
1. Run AI scan CLI to generate results CSV (includes `ai_criteria_verifications_json` with 50 criteria)
2. Import CSV via API - import succeeds
3. View scan result in UI
4. Observe: UI shows legacy computed verifications, not AI-imported ones

## Expected Behavior
The UI should display:
- AI-verified criteria statuses (AI_VERIFIED_PASS, AI_VERIFIED_FAIL)
- Confidence scores from AI
- Reasoning text from AI analysis
- Scanner showing AI model name (e.g., "claude-opus-4-5-20251101" or "axe-core + AI")

## Actual Behavior
The UI displays:
- Only legacy computed statuses (PASS, FAIL, NOT_TESTED)
- No confidence scores
- No reasoning text
- Scanner showing only "axe-core" or "N/A"

## Evidence of Data Being Stored
```sql
SELECT "criterionId", status, scanner, confidence
FROM criteria_verifications LIMIT 10;

 criterionId |      status      |         scanner          | confidence
-------------+------------------+--------------------------+------------
 1.1.1       | AI_VERIFIED_FAIL | claude-opus-4-5-20251101 |         85
 1.2.1       | NOT_TESTED       | N/A                      |         95
 1.3.1       | AI_VERIFIED_FAIL | claude-opus-4-5-20251101 |         80
 1.3.2       | AI_VERIFIED_PASS | claude-opus-4-5-20251101 |         75
...

SELECT COUNT(*) FROM criteria_verifications;
-- count: 50
```

## Root Cause (Preliminary)

### 1. Repository Doesn't Fetch Verifications
`apps/api/src/modules/scans/scan.repository.ts:172-185`:
```typescript
const scan = await prisma.scan.findUnique({
  where: { id },
  include: {
    scanResult: {
      include: {
        issues: { ... }, // Issues included
        // criteriaVerifications: NOT INCLUDED
      },
    },
  },
});
```

### 2. Service Uses Legacy Computation
`apps/api/src/modules/results/result.service.ts:325-333`:
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

The code explicitly says "until stored verifications are available" but never actually fetches them.

## Related Files
- `apps/api/src/modules/scans/scan.repository.ts:164-187` - `getScanById()` missing include
- `apps/api/src/modules/results/result.service.ts:318-333` - Uses legacy computation
- `apps/api/src/modules/results/coverage.service.ts:419-494` - `computeVerificationsFromLegacyData()`
- `apps/api/src/modules/ai-campaign/ai-queue.service.ts:699` - Stores verifications correctly

## Impact
- AI criteria verification feature is not visible to users
- Users cannot see AI analysis results (confidence, reasoning)
- Coverage percentages are incorrect (computed vs actual)
- Feature appears broken despite working import

## Reporter
AI Bug Analysis System

## Date Reported
2026-01-18
