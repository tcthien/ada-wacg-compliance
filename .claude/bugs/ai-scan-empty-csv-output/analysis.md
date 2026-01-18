# Bug Analysis

## Root Cause Analysis

### Investigation Summary

The `ai-fix-section-formatting` spec (completed 2026-01-18) updated the prompt template to require markdown code blocks inside the `aiFixSuggestion` field for code examples. This change inadvertently broke the Claude output parsing.

### Root Cause

**The markdown extraction regex fails when JSON contains embedded code blocks.**

In `result-parser.ts:10`, the `extractJsonFromMarkdown()` function uses:
```javascript
const markdownPattern = /```(?:json)?\s*([\s\S]*?)```/;
```

The `*?` is a **non-greedy** quantifier that matches the **minimum** amount of text before the first closing ` ``` `.

When Claude wraps its response in markdown AND the JSON contains embedded code blocks:
```markdown
```json
{
  "aiFixSuggestion": "Before:\n```html\n<img>\n```\nAfter:..."
}
```
```

The regex stops at the first ` ``` ` (after `<img>`) instead of the outer closing block, extracting:
```
{
  "aiFixSuggestion": "Before:\n
```

This partial string fails JSON.parse(), causing all parsing strategies to fail.

### Contributing Factors

1. **Non-greedy regex pattern**: The regex was designed for simple JSON blocks without nested code blocks
2. **Prompt template change**: Added requirement for markdown code blocks in `aiFixSuggestion`:
   ```
   **REQUIRED**: Wrap ALL code examples in markdown triple backticks (```)
   Use `Before:` and `After:` labels for code comparisons
   Include the language identifier after opening backticks (e.g., ```html, ```css)
   ```
3. **Silent failure**: The parser returns empty array `[]` instead of throwing, so the scan appears to "succeed"

## Technical Details

### Affected Code Locations

1. **`tools/ai-scan-cli/src/result-parser.ts:9-18`** - `extractJsonFromMarkdown()` with flawed regex
2. **`tools/ai-scan-cli/templates/issue-enhancement-prompt.hbs:96-103`** - New formatting requirements
3. **`tools/ai-scan-cli/src/mini-batch-processor.ts:345-377`** - Returns null when parsing fails

### Data Flow Analysis
```
Input CSV → parseInputCsv → organizeBatches → MiniBatchProcessor
  → PromptGenerator (issue-enhancement-prompt.hbs)
  → ClaudeInvoker → parseClaudeOutput [FAILURE POINT]
      Strategy 1: JSON.parse(output) - FAILS (Claude wraps in markdown)
      Strategy 2: extractJsonFromMarkdown() - FAILS (regex stops at embedded ```)
      Strategy 3-4: Pattern matching - FAILS (wrong patterns)
  → Returns [] (empty array)
  → transformToImportFormat produces empty values
  → writeCsv outputs: "","","[]"
```

### Dependencies
- Claude Code CLI
- Playwright MCP server

## Solution Approach

### Fix Strategy

**Option A (Recommended): Improve JSON extraction to handle nested code blocks**

Replace the non-greedy regex with a smarter extraction that:
1. Finds the outermost `\`\`\`json` block
2. Tracks nesting depth of triple backticks
3. Extracts content between the correct opening and closing markers

Implementation:
```typescript
export function extractJsonFromMarkdown(output: string): string | null {
  // Find ```json or ``` at the start
  const jsonBlockStart = output.match(/```(?:json)?\s*\n/);
  if (!jsonBlockStart) return null;

  const startIndex = jsonBlockStart.index! + jsonBlockStart[0].length;

  // Find matching closing ``` by tracking nesting
  let depth = 1;
  let i = startIndex;
  while (i < output.length && depth > 0) {
    if (output.substring(i, i + 3) === '```') {
      // Check if this is inside a JSON string (escaped)
      const beforeBlock = output.substring(startIndex, i);
      const lastNewline = beforeBlock.lastIndexOf('\n');
      const currentLine = beforeBlock.substring(lastNewline + 1);

      // If we're inside a string value, skip
      if (!/^\s*```/.test(currentLine)) {
        i += 3;
        continue;
      }
      depth--;
      if (depth === 0) {
        return output.substring(startIndex, i).trim();
      }
    }
    i++;
  }

  return null;
}
```

**Option B: Find largest valid JSON object**

Try parsing progressively larger substrings until a valid JSON is found:
```typescript
// Find all potential JSON starts
const jsonStarts = [...output.matchAll(/\{\s*"/g)];
for (const match of jsonStarts) {
  // Try to find closing brace and parse
  for (let end = match.index + 10; end <= output.length; end++) {
    try {
      const candidate = output.substring(match.index, end);
      const parsed = JSON.parse(candidate);
      if (parsed.scanId || parsed.aiEnhancements) {
        return [parsed];
      }
    } catch { continue; }
  }
}
```

**Option C: Escape embedded code blocks before extraction**

Pre-process the output to escape `\`\`\`` inside string values before regex matching.

### Recommended Fix

Go with **Option B** - more robust, handles any edge cases with nested content. Add it as Strategy 5 in `parseClaudeOutput()`.

### Testing Strategy

1. **Unit test**: Create test case with embedded markdown code blocks
2. **Integration test**: Run AI scan on a sample URL and verify output contains data
3. **Regression test**: Verify old scan results still parse correctly

---
**Status**: Analysis Complete - Ready for Fix
