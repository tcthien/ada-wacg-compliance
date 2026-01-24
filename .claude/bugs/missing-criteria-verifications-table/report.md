# Bug Report: Missing criteria_verifications Table

## Bug ID
`missing-criteria-verifications-table`

## Summary
AI scan result import fails because the `criteria_verifications` database table does not exist, despite the migration file being present.

## Severity
**Critical** - Blocks AI scan import functionality entirely

## Status
**Open** - Ready for analysis

## Environment
- Application: ADAShield API
- Database: PostgreSQL
- Tool Version: AI Scan CLI v1.0.0
- AI Model: claude-opus-4-5-20251101

## Steps to Reproduce
1. Run AI scan CLI to generate results CSV:
   - Input: `tools/ai-scan-cli/results/ai-results-ai-pending-scans-2026-01-18(1)-20260118-134238.csv`
2. Import the CSV results using the API
3. Observe the error during import

## Expected Behavior
The AI scan results should be imported successfully, storing:
- AI summary and remediation plan
- AI-enhanced issue data
- Criteria verifications for WCAG criteria (up to 50 for AA level)

## Actual Behavior
Import fails with Prisma error:
```
Import failed: Invalid `tx.criteriaVerification.findMany()` invocation in
/mnt/ubuntu-data/sources/per-projects/ada-wacg-compliance/apps/api/src/modules/ai-campaign/ai-queue.service.ts:699:65

696 const defaultAiModel = aiModel || 'claude-opus-4-5-20251101';
697
698 // Step 1: Get all existing verifications for this scan result to determine precedence
→ 699 const existingVerifications = await tx.criteriaVerification.findMany(

The table `public.criteria_verifications` does not exist in the current database.
```

## Error Analysis

### Root Cause
The migration `20260118000001_add_criteria_verification` exists in the codebase but has not been applied to the database.

### Migration File Location
`apps/api/prisma/migrations/20260118000001_add_criteria_verification/migration.sql`

### Migration Contents
The migration creates:
1. `CriteriaVerificationStatus` enum (PASS, FAIL, AI_VERIFIED_PASS, AI_VERIFIED_FAIL, NOT_TESTED)
2. `criteria_verifications` table with columns:
   - id (UUID)
   - scanResultId (UUID, FK to scan_results)
   - criterionId (VARCHAR)
   - status (CriteriaVerificationStatus)
   - scanner (VARCHAR)
   - confidence (INTEGER)
   - reasoning (TEXT)
   - createdAt (TIMESTAMPTZ)
3. `_CriteriaIssues` join table for many-to-many relation with issues
4. Associated indexes and foreign keys

### Schema Definition
The `CriteriaVerification` model is defined in `apps/api/prisma/schema.prisma` (lines 270-289) and is properly linked to `ScanResult` and `Issue` models.

## CSV Data Format
The AI scan output CSV includes:
- `ai_criteria_verifications_json` column containing 50 WCAG criteria verifications
- Each verification includes: criterionId, status, confidence, reasoning, relatedIssueIds

## Related Files
- `apps/api/src/modules/ai-campaign/ai-queue.service.ts:699` - Error location
- `apps/api/prisma/schema.prisma` - Schema definition
- `apps/api/prisma/migrations/20260118000001_add_criteria_verification/migration.sql` - Migration file
- `tools/ai-scan-cli/results/ai-results-ai-pending-scans-2026-01-18(1)-20260118-134238.csv` - CSV with data

## Suggested Fix
Run the pending database migration to create the missing table:
```bash
cd apps/api && npx prisma migrate deploy
```

## Impact
- All AI scan imports are blocked
- New WCAG criteria verification feature is non-functional
- Users cannot benefit from AI-enhanced accessibility analysis

## Reporter
AI Bug Analysis System

## Date Reported
2026-01-18
