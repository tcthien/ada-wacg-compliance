# Bug Analysis: Missing criteria_verifications Table

## Analysis Status
**Complete** - Root cause identified

## Investigation Summary

### Database State Verification
Confirmed that the migration `20260118000001_add_criteria_verification` has NOT been applied to the database:

```sql
-- Applied migrations (most recent first):
20260101030934_add_ai_early_bird
20260101030013_add_ai_token_tracking_fields
20251230143257_add_email_to_batch_scan
...

-- Criteria migration check:
SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '%criteria%';
-- Returns: (0 rows)
```

The migration file exists at:
```
apps/api/prisma/migrations/20260118000001_add_criteria_verification/migration.sql
```

But it was never deployed to the database.

## Root Cause

**Type:** Deployment/Migration Gap

The migration file was created as part of the AI WCAG Criteria Verification feature (spec: `ai-wcag-criteria-verification`) but the database migration was never executed against the development/production database.

### Timeline Analysis
1. Migration file created: `20260118000001` (timestamp: 2026-01-18)
2. Last applied migration: `20260101030934_add_ai_early_bird` (2026-01-01)
3. Gap: Migration exists in code but was not deployed

### Why This Happened
The migration was likely:
1. Generated during feature development
2. Committed to the codebase
3. But `prisma migrate deploy` was never run against the database

## Technical Details

### Missing Database Objects
The migration should create:

1. **Enum Type**
   ```sql
   CREATE TYPE "CriteriaVerificationStatus" AS ENUM (
     'PASS', 'FAIL', 'AI_VERIFIED_PASS', 'AI_VERIFIED_FAIL', 'NOT_TESTED'
   );
   ```

2. **Main Table**
   ```sql
   CREATE TABLE "criteria_verifications" (
     "id" UUID NOT NULL PRIMARY KEY,
     "scanResultId" UUID NOT NULL REFERENCES scan_results(id) ON DELETE CASCADE,
     "criterionId" VARCHAR(20) NOT NULL,
     "status" "CriteriaVerificationStatus" NOT NULL,
     "scanner" VARCHAR(100) NOT NULL,
     "confidence" INTEGER,
     "reasoning" TEXT,
     "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
   );
   ```

3. **Join Table** (for many-to-many with issues)
   ```sql
   CREATE TABLE "_CriteriaIssues" (
     "A" UUID NOT NULL REFERENCES criteria_verifications(id),
     "B" UUID NOT NULL REFERENCES issues(id)
   );
   ```

4. **Indexes**
   - `criteria_verifications_scanResultId_idx`
   - `criteria_verifications_status_idx`
   - `criteria_verifications_scanResultId_criterionId_key` (unique)

### Code Location Using This Table
- `apps/api/src/modules/ai-campaign/ai-queue.service.ts:699` - `storeCriteriaVerifications()`
- Uses `tx.criteriaVerification.findMany()` and `tx.criteriaVerification.create()`

## Solution

### Fix Approach
**Simple:** Run the pending migration

```bash
cd apps/api && npx prisma migrate deploy
```

This will:
1. Execute `20260118000001_add_criteria_verification/migration.sql`
2. Record the migration in `_prisma_migrations` table
3. Make the `criteria_verifications` table available

### Risk Assessment
| Risk | Level | Mitigation |
|------|-------|------------|
| Data loss | None | Migration only creates new objects |
| Downtime | Minimal | ~1-2 seconds for table creation |
| Rollback | Easy | Drop table and enum if needed |

### Pre-deployment Checklist
- [ ] Backup database (optional, no data loss risk)
- [ ] Verify migration file is correct
- [ ] Run in dev environment first
- [ ] Regenerate Prisma client after migration

### Post-fix Verification
1. Run migration: `npx prisma migrate deploy`
2. Regenerate client: `npx prisma generate`
3. Verify table exists: `SELECT * FROM criteria_verifications LIMIT 1;`
4. Test AI scan import with the CSV file

## Alternative Approaches Considered

1. **Manual SQL execution** - Not recommended, bypasses Prisma migration tracking
2. **Reset database** - Overkill, would lose existing data
3. **Recreate migration** - Unnecessary, existing migration is correct

## Recommendation

**Proceed with the simple fix:** Run `npx prisma migrate deploy`

This is a standard deployment gap, not a code bug. The migration is already correct and just needs to be applied.

---

**Does this analysis look correct? If so, we can proceed to apply the fix.**
