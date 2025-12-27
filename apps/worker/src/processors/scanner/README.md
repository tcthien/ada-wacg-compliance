# Page Scanner Module

Core accessibility scanning functionality for ADAShield using Playwright and axe-core.

## Overview

This module provides the core page scanning logic for detecting accessibility issues. It orchestrates:

1. **Browser Management** - Acquires pages from the browser pool
2. **Page Navigation** - Navigates to target URLs with timeout handling
3. **Security Validation** - Validates redirects to prevent SSRF attacks
4. **Accessibility Analysis** - Runs axe-core to detect WCAG violations
5. **Result Mapping** - Transforms axe-core results to our Issue format
6. **HTML Sanitization** - Cleans HTML snippets for safe storage

## Architecture

```
page-scanner.ts       - Main entry point, orchestrates scan workflow
├── axe-runner.ts     - axe-core integration and WCAG level mapping
├── result-mapper.ts  - Maps axe-core results to Issue format
└── html-sanitizer.ts - Sanitizes HTML snippets for security
```

## Usage

### Basic Scan

```typescript
import { scanPage } from './processors/scanner';

const result = await scanPage({
  url: 'https://example.com',
  wcagLevel: 'AA',
});

console.log(`Found ${result.issues.length} accessibility issues`);
console.log(`Scan took ${result.scanDuration}ms`);
```

### Multiple Pages

```typescript
import { scanPages } from './processors/scanner';

const results = await scanPages([
  { url: 'https://example.com', wcagLevel: 'AA' },
  { url: 'https://example.com/about', wcagLevel: 'AA' },
  { url: 'https://example.com/contact', wcagLevel: 'AA' },
]);
```

### Custom Configuration

```typescript
const result = await scanPage({
  url: 'https://example.com',
  wcagLevel: 'AAA',
  timeout: 30000,           // 30 second timeout
  waitUntil: 'load',        // Wait for 'load' event instead of 'networkidle'
});
```

## Security Features

### SSRF Prevention

The scanner validates redirects to prevent Server-Side Request Forgery attacks:

- ❌ **Blocks private IPs**: 10.x.x.x, 192.168.x.x, 127.x.x.x, etc.
- ❌ **Blocks cloud metadata**: 169.254.169.254 (AWS/GCP/Azure)
- ❌ **Blocks localhost**: localhost, .local, .internal domains
- ❌ **Blocks IPv6 private ranges**: ::1, fe80::, fc00::, etc.

### HTML Sanitization

All HTML snippets are sanitized before storage:

- Whitelist-only tags (semantic and interactive elements)
- Removes scripts, styles, and event handlers
- Preserves accessibility attributes (aria-*, role, etc.)
- Truncates long HTML to prevent storage bloat
- Prevents XSS attacks from malicious website content

## Error Handling

The scanner uses typed errors for different failure scenarios:

```typescript
try {
  const result = await scanPage({ url, wcagLevel: 'AA' });
} catch (error) {
  if (error instanceof ScanError) {
    switch (error.code) {
      case 'TIMEOUT':
        // Navigation took too long
        break;
      case 'BLOCKED_REDIRECT':
        // Redirect to private IP detected
        break;
      case 'ANALYSIS_FAILED':
        // axe-core analysis failed
        break;
      case 'NAVIGATION_FAILED':
        // Page failed to load
        break;
      case 'VALIDATION_FAILED':
        // Invalid URL format
        break;
    }
  }
}
```

## WCAG Levels

The scanner supports all three WCAG conformance levels:

| Level | Description | Use Case |
|-------|-------------|----------|
| **A** | Basic accessibility | Minimum legal requirement |
| **AA** | Enhanced accessibility | Most common compliance target |
| **AAA** | Maximum accessibility | Comprehensive coverage |

### Tag Mapping

- **Level A**: wcag2a, wcag21a, wcag22a
- **Level AA**: A tags + wcag2aa, wcag21aa, wcag22aa
- **Level AAA**: AA tags + wcag2aaa, wcag21aaa, wcag22aaa

## Result Structure

```typescript
interface ScanResult {
  url: string;              // Original URL requested
  finalUrl: string;         // Final URL after redirects
  title: string;            // Page title
  scanDuration: number;     // Scan time in milliseconds
  issues: MappedIssue[];    // Accessibility issues found
  passes: number;           // Number of rules that passed
  inapplicable: number;     // Number of inapplicable rules
  timestamp: Date;          // When scan completed
}

interface MappedIssue {
  id: string;               // Unique issue ID
  ruleId: string;           // axe-core rule ID (e.g., 'image-alt')
  impact: IssueImpact;      // CRITICAL | SERIOUS | MODERATE | MINOR
  description: string;      // Human-readable description
  helpText: string;         // How to fix guidance
  helpUrl: string;          // Link to detailed help docs
  wcagCriteria: string[];   // WCAG criteria (e.g., ['1.1.1'])
  cssSelector: string;      // Element selector
  htmlSnippet: string;      // Sanitized HTML snippet
  nodes: IssueNode[];       // All affected DOM nodes
}
```

## Testing

Run tests with:

```bash
pnpm test page-scanner
```

Test coverage includes:

- ✅ Successful scan flow
- ✅ Redirect validation (private IPs, localhost, metadata endpoints)
- ✅ HTML sanitization
- ✅ axe result mapping
- ✅ Timeout handling
- ✅ Error scenarios
- ✅ Concurrent scanning
- ✅ Browser pool integration

## Dependencies

- **@axe-core/playwright**: axe-core integration for Playwright
- **isomorphic-dompurify**: HTML sanitization library
- **playwright**: Browser automation framework

## Performance

- **Default timeout**: 60 seconds
- **Wait strategy**: networkidle (waits for network to be idle)
- **Browser pooling**: Reuses browser instances for efficiency
- **Concurrent scans**: Supports parallel scanning with browser pool
- **HTML truncation**: Limits HTML snippets to 500 characters

## Related Modules

- `/utils/browser-pool.ts` - Browser instance management
- `@adashield/core` - Shared types and utilities
- `/processors/scan-processor.ts` - BullMQ job processor (uses this scanner)
