# Bug Report: AI Fail Criteria Missing Issues

## Bug ID
`ai-fail-criteria-missing-issues`

## Summary
When AI verifies WCAG criteria and marks them as `AI_VERIFIED_FAIL`, the corresponding issues are not displayed in the Issues tab if the AI found new issues not detected by axe-core. The import API stores the criteria verification but doesn't create issue records for AI-only failures.

## Severity
**High** - Users see criteria failures but cannot see the details or fix guidance

## Status
**Open** - Ready for analysis

## Environment
- Application: ADAShield API
- Database: PostgreSQL
- Import Source: AI scan CLI results CSV

## Steps to Reproduce
1. Run AI scan that detects issues beyond axe-core (e.g., skip navigation, multiple ways, duplicate IDs)
2. Import the CSV via API
3. View scan result in UI
4. Observe: Criteria Table shows AI_VERIFIED_FAIL for criteria like 2.4.1, 2.4.5, 4.1.1
5. Check Issues tab - no corresponding issues found

## Expected Behavior
When AI verifies a criterion as FAIL, the UI should:
1. Show the failure in the Criteria Table (working ✅)
2. Show a corresponding issue in the Issues tab (NOT working ❌)
3. Display the AI's reasoning and fix suggestions

## Actual Behavior
- Criteria Table shows AI_VERIFIED_FAIL correctly
- Issues tab does NOT show any issues for AI-only failures
- Users cannot see what specifically failed or how to fix it

## Evidence from Database

### Criteria Verifications (AI failures exist)
```sql
SELECT cv."criterionId", cv.status::text, cv.reasoning
FROM criteria_verifications cv
WHERE cv.status::text = 'AI_VERIFIED_FAIL';

-- Results:
-- 1.1.1 | AI_VERIFIED_FAIL | "SVGs inside buttons lack accessible names..."
-- 1.3.1 | AI_VERIFIED_FAIL | "heading hierarchy jumps from h2 to h4..."
-- 2.4.1 | AI_VERIFIED_FAIL | "No skip navigation link is present..."
-- 2.4.5 | AI_VERIFIED_FAIL | "lacks site search, sitemap, or breadcrumb..."
-- 4.1.1 | AI_VERIFIED_FAIL | "duplicate ID attributes..."
```

### Issues (only axe-core issues exist)
```sql
SELECT "ruleId", "wcagCriteria" FROM issues WHERE ...;

-- Results:
-- color-contrast | {1.4.3}  -- axe-core found
-- image-alt      | {1.1.1}  -- axe-core found
-- link-name      | {4.1.2}  -- axe-core found

-- Note: NO issues for 2.4.1, 2.4.5, 4.1.1
```

### AI Criteria with No Related Issues
```
2.4.1 (Bypass Blocks) - AI found: "No skip navigation link"
2.4.5 (Multiple Ways) - AI found: "lacks search, sitemap, breadcrumb"
4.1.1 (Parsing) - AI found: "duplicate ID attributes"
```

These are valid accessibility issues that AI detected but axe-core didn't.

## Root Cause (Preliminary)

The import API (`ai-queue.service.ts`) stores:
1. AI enhancements to existing issues (aiExplanation, aiFixSuggestion) ✅
2. Criteria verifications including AI_VERIFIED_FAIL ✅
3. **Does NOT create new issues for AI-only failures** ❌

The AI provides `reasoning` in the criteria verification, but this should also create an Issue record so users can see it in the Issues tab.

## Impact
- Users see failures but cannot understand what's wrong
- AI analysis is partially hidden from users
- Criteria coverage shows failures without actionable information
- Reduces the value of AI enhancement

## Related Files
- `apps/api/src/modules/ai-campaign/ai-queue.service.ts` - Import logic
- `tools/ai-scan-cli/src/result-transformer.ts` - CSV data structure
- UI criteria table and issues tab components

## Reporter
AI Bug Analysis System

## Date Reported
2026-01-18
