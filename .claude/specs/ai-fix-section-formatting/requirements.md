# Requirements Document

## Introduction

This feature improves the readability of the "How to Fix It" section in AI-enhanced accessibility scan results. Currently, the AI-generated fix suggestions are displayed as a single continuous line of text, making it difficult to read code examples, before/after comparisons, and step-by-step instructions.

**Root Cause Analysis:**
1. The AI prompt template (`tools/ai-scan-cli/templates/issue-enhancement-prompt.hbs`) instructs the AI to include `\n` newlines and code examples, but doesn't enforce markdown code block syntax (triple backticks)
2. The frontend component (`apps/web/src/components/features/ai/AiIssueEnhancement.tsx`) only handles markdown-style backticks for code formatting, but doesn't handle:
   - Plain `\n` newlines (HTML renders these as spaces, not line breaks)
   - Unformatted code examples (HTML/CSS without triple backticks)
   - "Before:" and "After:" sections
   - URLs that should be clickable links

**Note:** CSV storage is NOT an issue. The `csv-stringify` library with `quoted: true` and JSON encoding correctly preserves all special characters including newlines, quotes, and backticks. The data is stored and retrieved correctly.

**Two-Part Solution:**
1. **AI Prompt Improvement** (tools/ai-scan-cli): Update the prompt template to enforce consistent markdown formatting with explicit triple backticks for code blocks
2. **Frontend Formatting** (apps/web): Enhance the display component to intelligently parse and format the content, handling both well-formatted markdown and legacy content with plain `\n` newlines

## Alignment with Product Vision

This feature directly supports ADAShield's positioning as an **honest, AI-enhanced accessibility testing tool** that provides **transparent, actionable testing results**. From the product vision:

- **Actionable Results**: The fix suggestions become truly actionable when developers can clearly see code examples and step-by-step instructions
- **AI-Enhanced Value**: Improving the display of AI-generated content demonstrates the value of AI enhancement over standard automated testing
- **User Experience**: SMB owners and developers (primary users) need clear, readable remediation guidance to fix accessibility issues efficiently

## Requirements

### Requirement 1: Multi-Line Text Rendering

**User Story:** As a developer reviewing accessibility scan results, I want to see AI-generated fix suggestions with proper line breaks and paragraphs, so that I can easily read and understand the remediation steps.

#### Acceptance Criteria

1. WHEN the fix suggestion contains newline characters (`\n`) THEN the system SHALL render them as visible line breaks in the UI
2. WHEN the fix suggestion contains double newlines (`\n\n`) THEN the system SHALL render them as paragraph separations with appropriate spacing
3. WHEN the fix suggestion contains "Before:" and "After:" sections THEN the system SHALL display these as visually distinct blocks

### Requirement 2: Code Block Detection and Formatting

**User Story:** As a developer, I want to see HTML/CSS code examples in a formatted code block style, so that I can easily copy and understand the code changes needed.

#### Acceptance Criteria

1. WHEN the fix suggestion contains code-like content (HTML tags, CSS rules) THEN the system SHALL detect and render them in a styled code block
2. IF the content contains patterns like `<tag>...</tag>` or `.class { ... }` THEN the system SHALL apply monospace font and code styling
3. WHEN code blocks are detected THEN the system SHALL preserve indentation and formatting within the code
4. WHEN the fix suggestion contains inline code references THEN the system SHALL display them with inline code styling (monospace, subtle background)

### Requirement 3: Structured Section Detection

**User Story:** As a developer, I want to see "Before" and "After" code comparisons clearly separated and labeled, so that I can quickly understand what changes are needed.

#### Acceptance Criteria

1. WHEN the fix suggestion contains "Before:" followed by code THEN the system SHALL render it as a labeled "Before" section with code styling
2. WHEN the fix suggestion contains "After:" followed by code THEN the system SHALL render it as a labeled "After" section with code styling
3. WHEN both "Before:" and "After:" sections exist THEN the system SHALL display them in a visually comparable layout
4. IF the fix suggestion contains numbered steps (e.g., "1.", "2.") THEN the system SHALL render them as a numbered list

### Requirement 4: URL and Link Rendering

**User Story:** As a developer, I want URLs mentioned in fix suggestions to be clickable links, so that I can easily access referenced resources like WCAG documentation or tools.

#### Acceptance Criteria

1. WHEN the fix suggestion contains a URL (e.g., `https://...`) THEN the system SHALL render it as a clickable link
2. WHEN a URL is rendered as a link THEN the system SHALL open it in a new tab (target="_blank")
3. WHEN rendering external links THEN the system SHALL include appropriate security attributes (rel="noopener noreferrer")

### Requirement 5: AI Prompt Template Improvement

**User Story:** As an AI scan administrator, I want the AI prompt to enforce consistent formatting in fix suggestions, so that the output is always well-structured and easy to display.

#### Acceptance Criteria

1. WHEN the AI generates a fix suggestion THEN it SHALL wrap all code examples in markdown code blocks (triple backticks)
2. WHEN the AI shows "Before" and "After" examples THEN it SHALL use a consistent format with labeled sections and code blocks
3. WHEN the AI references external tools or resources THEN it SHALL include the full URL in a standard format
4. WHEN the AI provides step-by-step instructions THEN it SHALL use numbered lists with clear line breaks

### Requirement 6: Maintain Existing Functionality

**User Story:** As a user, I want the AI enhancement display to continue working correctly for all existing features while gaining improved formatting.

#### Acceptance Criteria

1. WHEN the fix suggestion contains markdown-style backtick code (`` `code` `` or ``` ```code``` ```) THEN the system SHALL continue to format them correctly
2. WHEN the AI data is loading THEN the system SHALL continue to show the skeleton loader
3. WHEN no AI data is available THEN the system SHALL continue to show the loading state
4. WHEN priority scores are displayed THEN the system SHALL continue to show them with correct styling (Critical/High/Medium/Low)
5. WHEN displaying existing scan results (legacy data without markdown formatting) THEN the system SHALL apply intelligent formatting to improve readability

## Non-Functional Requirements

### Performance
- The text parsing and formatting MUST complete within 50ms for typical fix suggestion lengths (up to 2000 characters)
- The component MUST not cause layout shifts during rendering

### Accessibility
- Code blocks MUST be properly announced by screen readers (using appropriate ARIA roles)
- Color contrast for code block styling MUST meet WCAG AA standards (already met by existing styling)
- Links MUST be focusable and have visible focus indicators

### Maintainability
- The formatting logic SHOULD be implemented as a reusable utility function
- The code detection patterns SHOULD be configurable or easily extendable
- The component MUST have comprehensive unit tests covering all formatting scenarios

### Usability
- Formatted content MUST be responsive and work on mobile viewport sizes
- Code blocks SHOULD support horizontal scrolling for long lines
- The visual hierarchy MUST clearly distinguish explanatory text from code examples

---

**Document Created**: 2026-01-17
**Status**: Ready for Review
