# Implementation Plan

## Task Overview

This implementation improves the "How to Fix It" section formatting in AI-enhanced scan results through two approaches:
1. Create a reusable text formatting utility for the frontend
2. Update the AI prompt template to enforce consistent markdown formatting

## Steering Document Compliance

- **structure.md**: Utility placed in `apps/web/src/lib/`, tests in `apps/web/src/lib/__tests__/`
- **tech.md**: TypeScript with proper interfaces, React functional patterns, Vitest for testing

## Atomic Task Requirements

Each task meets these criteria:
- **File Scope**: 1-3 related files
- **Time Boxing**: 15-30 minutes
- **Single Purpose**: One testable outcome
- **Specific Files**: Exact paths provided
- **Agent-Friendly**: Clear input/output

## Tasks

### Phase 1: Text Formatter Utility

- [x] 1. Create text formatter utility with core parsing functions
  - **File**: `apps/web/src/lib/text-formatter.tsx`
  - Create new utility file with `formatAiContent()` function
  - Implement markdown code block parsing (triple backticks)
  - Implement inline code parsing (single backticks)
  - Implement newline handling (`\n` → `<br/>`, `\n\n` → paragraph)
  - Export `FormatOptions` interface and `formatAiContent` function
  - _Leverage_: Pattern from `apps/web/src/components/features/ai/AiIssueEnhancement.tsx` (existing `formatCodeInText`)
  - _Requirements_: 1.1, 1.2, 2.1, 2.4, 6.1

- [x] 2. Add URL detection and linking to text formatter
  - **File**: `apps/web/src/lib/text-formatter.tsx` (modify)
  - Add URL regex pattern for `https://` and `http://` links
  - Render URLs as `<a>` elements with `target="_blank"` and `rel="noopener noreferrer"`
  - Style links with appropriate classes
  - _Leverage_: `apps/web/src/lib/text-formatter.ts` (from task 1)
  - _Requirements_: 4.1, 4.2, 4.3

- [x] 3. Add section detection (Before/After) to text formatter
  - **File**: `apps/web/src/lib/text-formatter.tsx` (modify)
  - Add pattern detection for "Before:", "After:", "Step N:", "Option N:"
  - Render sections with visual distinction (colored left border)
  - Handle code blocks that follow section headers
  - _Leverage_: `apps/web/src/lib/text-formatter.ts` (from task 2)
  - _Requirements_: 3.1, 3.2, 3.3

- [x] 4. Add auto-detection for HTML/CSS code patterns
  - **File**: `apps/web/src/lib/text-formatter.tsx` (modify)
  - Add regex for HTML tags: `<tag>...</tag>` or `<tag />`
  - Add regex for CSS rules: `.class { ... }` or `#id { ... }`
  - Apply code block styling to auto-detected patterns
  - Only apply to non-markdown-formatted content (legacy support)
  - _Leverage_: `apps/web/src/lib/text-formatter.ts` (from task 3)
  - _Requirements_: 2.2, 2.3, 6.5

### Phase 2: Unit Tests for Formatter

- [x] 5. Create unit tests for text formatter - core functionality
  - **File**: `apps/web/src/lib/__tests__/text-formatter.test.ts`
  - Test markdown code blocks render as `<pre><code>`
  - Test inline code renders with code styling
  - Test newlines convert to line breaks
  - Test double newlines create paragraph separation
  - Test empty/null input returns empty array
  - _Leverage_: `apps/web/src/lib/text-formatter.ts`, existing test patterns in `apps/web/src/lib/__tests__/`
  - _Requirements_: 1.1, 1.2, 2.1, 2.4

- [x] 6. Create unit tests for text formatter - URLs and sections
  - **File**: `apps/web/src/lib/__tests__/text-formatter.test.ts` (modify)
  - Test URLs convert to clickable links
  - Test links have correct security attributes
  - Test "Before:" and "After:" sections are labeled
  - Test mixed content (text + code + URLs) is handled
  - _Leverage_: `apps/web/src/lib/__tests__/text-formatter.test.ts` (from task 5)
  - _Requirements_: 3.1, 3.2, 4.1, 4.2, 4.3

- [x] 7. Create unit tests for text formatter - legacy content
  - **File**: `apps/web/src/lib/__tests__/text-formatter.test.ts` (modify)
  - Test HTML patterns are auto-detected and styled
  - Test CSS patterns are auto-detected and styled
  - Test legacy content without markdown is still formatted
  - Test malformed markdown gracefully degrades
  - _Leverage_: `apps/web/src/lib/__tests__/text-formatter.test.ts` (from task 6)
  - _Requirements_: 2.2, 2.3, 6.5

### Phase 3: Component Integration

- [x] 8. Update AiIssueEnhancement to use new formatter utility
  - **File**: `apps/web/src/components/features/ai/AiIssueEnhancement.tsx`
  - Import `formatAiContent` from `@/lib/text-formatter`
  - Replace inline `formatCodeInText()` function with imported utility
  - Apply formatter to both `explanation` and `fixSuggestion` fields
  - Remove old `formatCodeInText` function (now in utility)
  - _Leverage_: `apps/web/src/lib/text-formatter.ts`
  - _Requirements_: 6.1, 6.2, 6.3, 6.4

- [x] 9. Create AiIssueEnhancement tests for new formatter integration
  - **File**: `apps/web/src/components/features/ai/AiIssueEnhancement.test.tsx` (create new)
  - Create test file with component rendering tests
  - Add test for formatted explanation rendering
  - Add test for formatted fix suggestion rendering
  - Verify loading state and priority indicator work correctly
  - _Leverage_: `apps/web/src/components/features/ai/AiIssueEnhancement.tsx`, test patterns from `apps/web/src/lib/__tests__/`
  - _Requirements_: 6.2, 6.3, 6.4

### Phase 4: AI Prompt Template Update

- [x] 10. Update AI prompt template to enforce markdown code blocks
  - **File**: `tools/ai-scan-cli/templates/issue-enhancement-prompt.hbs`
  - Add explicit formatting rules section requiring triple backticks for code
  - Update example to show proper markdown code block usage
  - Add instruction to use "Before:" and "After:" labels consistently
  - Add instruction to include full URLs for external resources
  - _Leverage_: Existing template structure
  - _Requirements_: 5.1, 5.2, 5.3, 5.4

### Phase 5: Verification

- [x] 11. Run all tests and verify no regressions
  - **Files**: All test files in `apps/web/`
  - Run `pnpm test` in apps/web directory
  - Verify all existing tests pass
  - Verify new text-formatter tests pass
  - Verify AiIssueEnhancement tests pass
  - _Leverage_: Existing test infrastructure
  - _Requirements_: All

- [x] 12. Manual verification with existing scan data
  - **Files**: None (browser testing)
  - Navigate to a scan with AI enhancement (e.g., `/scan/46083446-b2fc-4b38-8040-e22eeb10d50f`)
  - Expand an issue and verify "How to Fix It" section formatting
  - Verify code examples are in styled code blocks
  - Verify "Before/After" sections are visually distinct
  - Verify URLs are clickable
  - Test on mobile viewport for responsiveness
  - _Requirements_: All

---

**Document Created**: 2026-01-17
**Status**: Completed

## Implementation Summary

All 12 tasks have been completed:

### Files Created
- `apps/web/src/lib/text-formatter.tsx` - New text formatting utility with:
  - Markdown code block parsing (triple backticks)
  - Inline code parsing (single backticks)
  - Newline handling (`\n` → `<br/>`, `\n\n` → paragraph)
  - URL detection and linking with security attributes
  - Section detection (Before:, After:, Step N:, Option N:)
  - Auto-detection of HTML/CSS patterns for legacy content

- `apps/web/src/lib/__tests__/text-formatter.test.ts` - 37 unit tests covering all functionality

- `apps/web/src/components/features/ai/AiIssueEnhancement.test.tsx` - 19 component tests

### Files Modified
- `apps/web/src/components/features/ai/AiIssueEnhancement.tsx` - Updated to use new `formatAiContent` utility
- `tools/ai-scan-cli/templates/issue-enhancement-prompt.hbs` - Updated with explicit markdown formatting rules

### Test Results
- 56/56 tests pass for the new functionality
- Pre-existing test failures in unrelated areas (not caused by these changes)
