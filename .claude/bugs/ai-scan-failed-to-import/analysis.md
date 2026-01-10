# Bug Analysis: AI Scan Failed to Import

## Status
**ANALYZED & FIXED** - Implementation complete, pending end-to-end verification

## Root Cause Analysis

### Investigation Summary
The ai-scan-cli tool was developed to process accessibility scans using Claude AI. When attempting to import the generated CSV results via the admin API endpoint `/api/v1/admin/ai-queue/import`, validation errors occurred due to mismatches between the CLI output format and the API's expected schema.

Investigation revealed two distinct issues:
1. **CSV column/format mismatches** - Wrong column names and data formats
2. **AI issues format mismatch** - CLI was creating new issues instead of enhancing existing axe-core issues

### Root Cause
**Primary cause**: The CLI was designed in isolation without properly referencing the API's import schema (`apps/api/src/modules/ai-campaign/ai-campaign.schema.ts`).

**Secondary cause**: Architectural misunderstanding - the intended workflow is for AI to **enhance** existing axe-core issues (which already have UUIDs in the database), not to **discover** new issues from scratch.

### Contributing Factors
1. **Missing integration testing** - No end-to-end test between CLI and API
2. **Schema drift** - CLI types diverged from API expectations
3. **Documentation gap** - The export/import workflow wasn't clearly documented

## Technical Details

### Affected Code Locations

**Issue 1: CSV Column/Format Mismatches**

- **File**: `tools/ai-scan-cli/src/csv-writer.ts`
  - **Issue**: CSV headers didn't match API schema
  - **Mismatch**: `issues_with_ai_json` vs expected `ai_issues_json`

- **File**: `tools/ai-scan-cli/src/result-transformer.ts`
  - **Issue**: Missing required fields (`tokens_used`, `processing_time`)
  - **Issue**: `ai_summary` and `ai_remediation_plan` output as JSON objects instead of plain text

- **File**: `tools/ai-scan-cli/src/types.ts`
  - **Issue**: `ImportRow` interface didn't match API schema

**Issue 2: AI Issues Format Mismatch**

- **File**: `tools/ai-scan-cli/src/mini-batch-processor.ts`
  - **Issue**: Always used discovery mode, ignoring existing issues

- **File**: `tools/ai-scan-cli/src/csv-parser.ts`
  - **Issue**: Didn't parse `issues_json` column from exported CSV

- **File**: `tools/ai-scan-cli/templates/html-analysis-prompt.hbs`
  - **Issue**: Only template for discovering new issues, not enhancing existing ones

### Data Flow Analysis

**Original (Broken) Flow:**
```
Export CSV → CLI reads only scan_id, url, wcag_level
           → Downloads website
           → Claude discovers NEW issues (new UUIDs)
           → CLI outputs CSV with issues_with_ai_json (wrong column name)
           → API rejects: wrong columns, wrong format, wrong issue IDs
```

**Corrected Flow:**
```
Export CSV → CLI reads scan_id, url, wcag_level, issues_json (existing issues with UUIDs)
           → Downloads website for context
           → Claude enhances EXISTING issues (preserves UUIDs)
           → CLI outputs CSV with ai_issues_json (correct format)
           → API accepts and merges AI enhancements with existing issues
```

### Dependencies

- **API Schema**: `apps/api/src/modules/ai-campaign/ai-campaign.schema.ts`
  - Defines `csvImportRowSchema` with required fields
- **Database Schema**: Expects `Issue` records to exist before AI enhancement
- **Admin Export**: Must include `issues_json` column for enhancement mode

## Impact Analysis

### Direct Impact
- **Blocked workflow**: Cannot import AI scan results into the system
- **Manual workaround required**: Admin cannot use CLI for batch AI processing
- **Data isolation**: AI analysis results stuck in local files

### Indirect Impact
- **Feature incomplete**: AI campaign feature non-functional
- **User experience**: Admins expected seamless export → process → import flow
- **Time waste**: CLI runs successfully but results can't be used

### Risk Assessment
- **High priority**: Core feature of AI campaign is blocked
- **No data loss**: Original scans and issues remain intact in database
- **Recoverable**: Once fixed, existing CLI outputs can be reprocessed

## Solution Approach

### Fix Strategy
**Option A (Implemented)**: Modify CLI to enhance existing axe-core issues

This approach:
1. Reads `issues_json` from exported CSV
2. Uses enhancement-specific prompt template
3. Outputs `ai_issues_json` with `issueId` references matching existing database records
4. Maintains backward compatibility with discovery mode

### Alternative Solutions

**Option B (Not chosen)**: Modify API to accept new issues
- Pros: AI could find issues axe-core missed
- Cons: Changes data model, requires database schema changes, more complex

**Option C (Not chosen)**: Two separate CLI modes
- Pros: Clear separation of concerns
- Cons: More complex user experience, duplicate code

### Risks and Trade-offs

- **Enhancement mode limitation**: AI can only enhance issues already detected by axe-core
- **Discovery mode still available**: When no `issues_json` in input, CLI uses discovery mode
- **Dependency on export format**: CLI now depends on admin export including `issues_json`

## Implementation Plan

### Changes Required (All Completed)

1. **Update types** (`src/types.ts`)
   - Added `ExistingIssue` interface
   - Added `AiIssueEnhancement` interface
   - Updated `PendingScan` to include `existingIssues`
   - Updated `ScanResult` to include `aiEnhancements`

2. **Update CSV parser** (`src/csv-parser.ts`)
   - Parse `issues_json` column
   - Parse `page_title` column
   - Store as `existingIssues` on `PendingScan`

3. **Create enhancement template** (`templates/issue-enhancement-prompt.hbs`)
   - New template for enhancing existing issues
   - Outputs `aiEnhancements` array with `issueId` references

4. **Update prompt generator** (`src/prompt-generator.ts`)
   - Added `generateIssueEnhancementPrompt()` function

5. **Update result parser** (`src/result-parser.ts`)
   - Added `normalizeEnhancement()` and `normalizeEnhancements()`
   - Updated `normalizeScanResult()` for both modes

6. **Update result transformer** (`src/result-transformer.ts`)
   - Added `getAiIssuesJson()` for correct output format
   - Updated formatters for plain text output

7. **Update processor** (`src/mini-batch-processor.ts`)
   - Detect enhancement mode when existing issues present
   - Use appropriate prompt template based on mode

### Testing Strategy

1. **Build verification**: `pnpm build` - PASSED
2. **Mode detection test**: Verify CLI detects enhancement vs discovery mode
3. **Output format test**: Verify CSV has correct columns and formats
4. **API import test**: POST to import endpoint and verify acceptance
5. **Data merge test**: Verify AI enhancements merge with existing issues

### Rollback Plan

If fix causes issues:
1. Revert changes to `tools/ai-scan-cli/src/*` files
2. Remove new template `templates/issue-enhancement-prompt.hbs`
3. Rebuild: `pnpm build`
4. Discovery mode still works (existing functionality)

## Verification Pending

The following items need end-to-end testing:
- [ ] Export from admin includes `issues_json` column
- [ ] Import API accepts generated CSV
- [ ] AI enhancements merge with existing axe-core issues
- [ ] Combined results display correctly in admin panel

## Notes

This analysis documents a bug that has already been fixed. All code changes are complete and the CLI builds successfully. The remaining work is end-to-end verification testing.
