# Bug Report

## Bug Summary
AI scan tool successfully processes scans but outputs empty/missing data in the CSV result file. The scan completes successfully, but `ai_summary`, `ai_remediation_plan`, and `ai_issues_json` columns are all empty.

## Bug Details

### Expected Behavior
After a successful AI scan, the output CSV should contain populated fields:
- `ai_summary`: A plain text summary of accessibility findings
- `ai_remediation_plan`: A structured remediation plan with quick wins, short-term, and long-term fixes
- `ai_issues_json`: A JSON array of AI issue enhancements with `issueId`, `aiExplanation`, `aiFixSuggestion`, and `aiPriority`

### Actual Behavior
The output CSV contains empty values:
```csv
"scan_id","ai_summary","ai_remediation_plan","ai_issues_json","tokens_used","ai_model","processing_time"
"d8f537a9-473c-4287-8c23-7121d0e18351","","","[]","2001","claude-opus-4-5-20251101","50"
```

Key observations:
- `ai_summary`: Empty string `""`
- `ai_remediation_plan`: Empty string `""`
- `ai_issues_json`: Empty array `"[]"`
- `tokens_used`: Low value (2001) suggests minimal output processed
- The scan appears to "succeed" (no error reported)

### Steps to Reproduce
1. Run AI scan CLI with a valid input CSV containing scan IDs
2. Wait for Claude Code invocation to complete
3. Check the output CSV in `results/` directory
4. Observe empty values in AI-related columns

### Environment
- **Version**: ai-scan-cli@1.0.0
- **Platform**: Linux (Ubuntu)
- **AI Model**: claude-opus-4-5-20251101
- **Template**: issue-enhancement-prompt.hbs

## Impact Assessment

### Severity
- [x] High - Major functionality broken

The core purpose of the AI scan tool is to generate AI-enhanced accessibility insights. Empty output means the tool is not fulfilling its primary function.

### Affected Users
- Administrators running AI scan batches
- End users expecting AI-enhanced scan results in the web application

### Affected Features
- AI scan processing pipeline
- AI-enhanced issue explanations and fix suggestions
- Executive summary generation
- Remediation roadmap generation

## Additional Context

### Error Messages
```
✓ Claude Code invocation completed successfully in 45722ms
✓ Successfully analyzed https://webmail.tma.com.vn/
✓ Mini-batch 1 completed: 1 succeeded, 0 failed (52775ms)
```

Note: No error messages are shown - the tool reports success despite empty output.

### Related Issues
- Recently fixed: `formatSummary` null/undefined handling (may be related)
- The fix for null handling may have masked a deeper issue with Claude output parsing

## Initial Analysis

### Suspected Root Cause
Potential causes to investigate:
1. **Claude output parsing failure**: The `parseClaudeOutput` function may not be extracting the JSON correctly from Claude's response
2. **Prompt template issue**: The updated prompt template may not be generating expected output format
3. **Result transformation issue**: Data may be lost during `transformToImportFormat` processing
4. **Mini-batch aggregation issue**: Results may not be properly aggregated from mini-batch processing

### Affected Components
- `tools/ai-scan-cli/src/result-parser.ts` - Claude output parsing
- `tools/ai-scan-cli/src/result-transformer.ts` - Result to CSV transformation
- `tools/ai-scan-cli/src/mini-batch-processor.ts` - Batch processing orchestration
- `tools/ai-scan-cli/templates/issue-enhancement-prompt.hbs` - AI prompt template

---
**Created**: 2026-01-18
**Fixed**: 2026-01-18
**Status**: Fixed

## Fix Summary

The issue was caused by the `ai-fix-section-formatting` spec changes that added embedded markdown code blocks to `aiFixSuggestion`. The non-greedy regex in `extractJsonFromMarkdown()` was matching the first closing ` ``` ` inside the JSON string instead of the outer block.

**Fix**: Updated `result-parser.ts` with:
1. Improved `extractJsonFromMarkdown()` to use greedy matching + JSON validation
2. Added `extractJsonByBraceMatching()` as robust fallback (tracks balanced braces)
