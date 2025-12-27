import DOMPurify from 'isomorphic-dompurify';

/**
 * HTML Sanitizer for accessibility scan results
 *
 * Cleans HTML snippets from axe-core results to prevent:
 * - XSS attacks from malicious website content
 * - Database storage bloat from large HTML snippets
 * - Information leakage of sensitive data in HTML
 *
 * Security measures:
 * - Whitelist-only approach for allowed tags and attributes
 * - Removes all scripts, styles, and event handlers
 * - Truncates long HTML to prevent storage issues
 * - Preserves accessibility-relevant attributes (aria-*, role, etc.)
 */

/**
 * Maximum length for sanitized HTML snippets
 * Prevents database bloat while preserving useful context
 */
const MAX_HTML_LENGTH = 500;

/**
 * Allowed HTML tags for accessibility context
 * Focus on semantic and interactive elements relevant to accessibility testing
 */
const ALLOWED_TAGS = [
  'div',
  'span',
  'p',
  'a',
  'img',
  'button',
  'input',
  'label',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'table',
  'tr',
  'td',
  'th',
  'form',
  'nav',
  'header',
  'footer',
  'main',
  'section',
  'article',
  'aside',
  'select',
  'option',
  'textarea',
  'fieldset',
  'legend',
];

/**
 * Allowed HTML attributes for accessibility context
 * Preserves accessibility-relevant attributes while removing security risks
 */
const ALLOWED_ATTR = [
  'class',
  'id',
  'href',
  'src',
  'alt',
  'title',
  'type',
  'name',
  'value',
  'placeholder',
  'role',
  'for',
  'tabindex',
  // ARIA attributes (wildcard pattern)
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'aria-hidden',
  'aria-live',
  'aria-atomic',
  'aria-relevant',
  'aria-busy',
  'aria-controls',
  'aria-expanded',
  'aria-haspopup',
  'aria-invalid',
  'aria-required',
  'aria-disabled',
  'aria-readonly',
  'aria-checked',
  'aria-pressed',
  'aria-selected',
  'aria-orientation',
  'aria-valuemin',
  'aria-valuemax',
  'aria-valuenow',
  'aria-valuetext',
];

/**
 * Sanitize HTML snippet for safe storage and display
 *
 * Applies DOMPurify sanitization with strict whitelist and truncates long HTML.
 * Safe to call with untrusted input from scanned websites.
 *
 * @param html - Raw HTML snippet from axe-core results
 * @returns Sanitized and truncated HTML snippet
 *
 * @example
 * ```typescript
 * const raw = '<script>alert("xss")</script><button onclick="hack()">Click</button>';
 * const clean = sanitizeHtml(raw);
 * // Returns: '<button>Click</button>'
 * ```
 */
export function sanitizeHtml(html: string): string {
  // Early return for empty input
  if (!html || html.trim().length === 0) {
    return '';
  }

  // Sanitize with strict whitelist
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Additional security options
    ALLOW_DATA_ATTR: false, // Block data-* attributes to prevent data leakage
    ALLOW_UNKNOWN_PROTOCOLS: false, // Block non-standard protocols
    KEEP_CONTENT: true, // Preserve text content when removing tags
    RETURN_DOM: false, // Return string, not DOM
    RETURN_DOM_FRAGMENT: false,
    SANITIZE_DOM: true, // Sanitize DOM clobbering attacks
  });

  // Truncate if too long (add ellipsis for clarity)
  if (clean.length > MAX_HTML_LENGTH) {
    return clean.substring(0, MAX_HTML_LENGTH) + '...';
  }

  return clean;
}

/**
 * Batch sanitize multiple HTML snippets
 * Useful for processing multiple nodes from a single violation
 *
 * @param htmlSnippets - Array of raw HTML snippets
 * @returns Array of sanitized HTML snippets
 */
export function sanitizeHtmlBatch(htmlSnippets: string[]): string[] {
  return htmlSnippets.map(sanitizeHtml);
}
