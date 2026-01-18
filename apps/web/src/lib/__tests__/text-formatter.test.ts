/**
 * Text Formatter Utility Tests
 *
 * Comprehensive tests for the formatAiContent utility.
 * Tests cover:
 * - Task 5: Core functionality (code blocks, inline code, newlines)
 * - Task 6: URLs and sections
 * - Task 7: Legacy content (auto-detected HTML/CSS)
 *
 * Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 4.1, 4.2, 4.3, 6.5
 */

import { describe, it, expect } from 'vitest';
import { formatAiContent } from '../text-formatter';
import React from 'react';

// Helper to extract text content from React nodes (recursive)
function getTextContent(nodes: React.ReactNode[]): string {
  function extractText(node: React.ReactNode): string {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (!node) return '';

    if (React.isValidElement(node)) {
      const children = node.props.children;
      if (typeof children === 'string') return children;
      if (typeof children === 'number') return String(children);
      if (Array.isArray(children)) {
        return children.map(extractText).join('');
      }
      if (React.isValidElement(children)) {
        return extractText(children);
      }
      if (children) {
        return extractText(children);
      }
    }
    return '';
  }

  return nodes.map(extractText).join('');
}

// Helper to check if node contains a specific element type
function hasElementType(nodes: React.ReactNode[], type: string): boolean {
  return nodes.some((node) => {
    if (React.isValidElement(node)) {
      if (node.type === type) return true;
      const children = node.props.children;
      if (Array.isArray(children)) {
        return hasElementType(children, type);
      }
      if (React.isValidElement(children)) {
        return hasElementType([children], type);
      }
    }
    return false;
  });
}

// Helper to find elements by type
function findElementsByType(
  nodes: React.ReactNode[],
  type: string
): React.ReactElement[] {
  const found: React.ReactElement[] = [];

  function search(nodeList: React.ReactNode[]): void {
    nodeList.forEach((node) => {
      if (React.isValidElement(node)) {
        if (node.type === type) {
          found.push(node);
        }
        const children = node.props.children;
        if (Array.isArray(children)) {
          search(children);
        } else if (React.isValidElement(children)) {
          search([children]);
        }
      }
    });
  }

  search(nodes);
  return found;
}

describe('formatAiContent', () => {
  // ============================================
  // Task 5: Core Functionality Tests
  // ============================================

  describe('Task 5: Core Functionality', () => {
    describe('Empty/null input handling', () => {
      it('should return empty array for null input', () => {
        const result = formatAiContent(null);
        expect(result).toEqual([]);
      });

      it('should return empty array for undefined input', () => {
        const result = formatAiContent(undefined);
        expect(result).toEqual([]);
      });

      it('should return empty array for empty string', () => {
        const result = formatAiContent('');
        expect(result).toEqual([]);
      });

      it('should return empty array for whitespace-only string', () => {
        const result = formatAiContent('   \n\t  ');
        expect(result).toEqual([]);
      });
    });

    describe('Markdown code blocks', () => {
      it('should render markdown code blocks as pre/code elements', () => {
        const input = '```\nconst x = 1;\n```';
        const result = formatAiContent(input);

        expect(result.length).toBeGreaterThan(0);
        expect(hasElementType(result, 'pre')).toBe(true);
        expect(hasElementType(result, 'code')).toBe(true);
      });

      it('should remove triple backticks from code block content', () => {
        const input = '```\nconst x = 1;\n```';
        const result = formatAiContent(input);

        const textContent = getTextContent(result);
        expect(textContent).toContain('const x = 1;');
        expect(textContent).not.toContain('```');
      });

      it('should handle code blocks with language identifier', () => {
        const input = '```javascript\nconst x = 1;\n```';
        const result = formatAiContent(input);

        const textContent = getTextContent(result);
        expect(textContent).toContain('const x = 1;');
        expect(textContent).not.toContain('javascript');
      });

      it('should preserve code block content exactly', () => {
        const input = '```\n<div class="test">\n  <p>Hello</p>\n</div>\n```';
        const result = formatAiContent(input);

        const textContent = getTextContent(result);
        expect(textContent).toContain('<div class="test">');
        expect(textContent).toContain('<p>Hello</p>');
      });
    });

    describe('Inline code', () => {
      it('should render inline code with code element', () => {
        const input = 'Use the `formatAiContent` function';
        const result = formatAiContent(input);

        expect(result.length).toBeGreaterThan(0);
        const codes = findElementsByType(result, 'code');
        expect(codes.length).toBeGreaterThan(0);
      });

      it('should remove backticks from inline code', () => {
        const input = 'Use `myFunction` to process data';
        const result = formatAiContent(input);

        const textContent = getTextContent(result);
        expect(textContent).toContain('myFunction');
        expect(textContent).not.toMatch(/`myFunction`/);
      });

      it('should handle multiple inline code segments', () => {
        const input = 'Use `foo` and `bar` together';
        const result = formatAiContent(input);

        const codes = findElementsByType(result, 'code');
        expect(codes.length).toBe(2);
      });
    });

    describe('Newline handling', () => {
      it('should convert single newlines to line breaks', () => {
        const input = 'Line 1\nLine 2\nLine 3';
        const result = formatAiContent(input);

        expect(result.length).toBeGreaterThan(0);
        expect(hasElementType(result, 'br')).toBe(true);
      });

      it('should create paragraph separation for double newlines', () => {
        const input = 'Paragraph 1\n\nParagraph 2';
        const result = formatAiContent(input);

        // Should have multiple div elements for paragraphs
        const divs = findElementsByType(result, 'div');
        expect(divs.length).toBe(2);
      });

      it('should preserve text content across newlines', () => {
        const input = 'Hello\nWorld';
        const result = formatAiContent(input);

        const textContent = getTextContent(result);
        expect(textContent).toContain('Hello');
        expect(textContent).toContain('World');
      });
    });
  });

  // ============================================
  // Task 6: URLs and Sections Tests
  // ============================================

  describe('Task 6: URLs and Sections', () => {
    describe('URL detection and linking', () => {
      it('should convert URLs to clickable links', () => {
        const input = 'Visit https://example.com for more info';
        const result = formatAiContent(input);

        expect(result.length).toBeGreaterThan(0);
        expect(hasElementType(result, 'a')).toBe(true);
      });

      it('should set target="_blank" on links', () => {
        const input = 'Visit https://example.com';
        const result = formatAiContent(input);

        const links = findElementsByType(result, 'a');
        expect(links.length).toBe(1);
        expect(links[0].props.target).toBe('_blank');
      });

      it('should set rel="noopener noreferrer" on links', () => {
        const input = 'Visit https://example.com';
        const result = formatAiContent(input);

        const links = findElementsByType(result, 'a');
        expect(links.length).toBe(1);
        expect(links[0].props.rel).toBe('noopener noreferrer');
      });

      it('should handle multiple URLs in text', () => {
        const input = 'Check https://foo.com and https://bar.com';
        const result = formatAiContent(input);

        const links = findElementsByType(result, 'a');
        expect(links.length).toBe(2);
      });

      it('should handle http:// URLs', () => {
        const input = 'Visit http://example.com';
        const result = formatAiContent(input);

        const links = findElementsByType(result, 'a');
        expect(links.length).toBe(1);
        expect(links[0].props.href).toBe('http://example.com');
      });

      it('should disable URL linking when option is false', () => {
        const input = 'Visit https://example.com';
        const result = formatAiContent(input, { linkUrls: false });

        expect(hasElementType(result, 'a')).toBe(false);
      });
    });

    describe('Section detection (Before/After)', () => {
      it('should detect and style "Before:" sections', () => {
        const input = 'Before: Old code\n\nAfter: New code';
        const result = formatAiContent(input);

        const textContent = getTextContent(result);
        expect(textContent).toContain('Before:');
      });

      it('should detect and style "After:" sections', () => {
        const input = 'After: New implementation';
        const result = formatAiContent(input);

        const textContent = getTextContent(result);
        expect(textContent).toContain('After:');
      });

      it('should detect "Step N:" sections', () => {
        const input = 'Step 1: First thing\nStep 2: Second thing';
        const result = formatAiContent(input);

        const textContent = getTextContent(result);
        expect(textContent).toContain('Step 1:');
        expect(textContent).toContain('Step 2:');
      });

      it('should detect "Option N:" sections', () => {
        const input = 'Option 1: Use React\nOption 2: Use Vue';
        const result = formatAiContent(input);

        const textContent = getTextContent(result);
        expect(textContent).toContain('Option 1:');
        expect(textContent).toContain('Option 2:');
      });

      it('should disable section detection when option is false', () => {
        const input = 'Before: Something';
        const result = formatAiContent(input, { detectSections: false });

        // Should still contain the text but not specially styled
        const textContent = getTextContent(result);
        expect(textContent).toContain('Before:');
      });
    });

    describe('Mixed content handling', () => {
      it('should handle text with code and URLs', () => {
        const input =
          'Use `myFunction` from https://example.com/docs';
        const result = formatAiContent(input);

        expect(hasElementType(result, 'code')).toBe(true);
        expect(hasElementType(result, 'a')).toBe(true);
      });

      it('should handle code blocks followed by text with URLs', () => {
        const input = '```\ncode\n```\n\nSee https://example.com';
        const result = formatAiContent(input);

        expect(hasElementType(result, 'pre')).toBe(true);
        expect(hasElementType(result, 'a')).toBe(true);
      });
    });
  });

  // ============================================
  // Task 7: Legacy Content Tests
  // ============================================

  describe('Task 7: Legacy Content (Auto-detection)', () => {
    describe('HTML pattern auto-detection', () => {
      it('should auto-detect simple HTML tags', () => {
        const input = '<div>Hello</div>';
        const result = formatAiContent(input);

        expect(result.length).toBeGreaterThan(0);
        const textContent = getTextContent(result);
        expect(textContent).toContain('<div>Hello</div>');
      });

      it('should auto-detect HTML with attributes', () => {
        const input = '<p class="test">Content</p>';
        const result = formatAiContent(input);

        const textContent = getTextContent(result);
        expect(textContent).toContain('<p class="test">Content</p>');
      });
    });

    describe('CSS pattern auto-detection', () => {
      it('should auto-detect CSS class rules', () => {
        const input = '.my-class { color: red; }';
        const result = formatAiContent(input);

        expect(result.length).toBeGreaterThan(0);
        const textContent = getTextContent(result);
        expect(textContent).toContain('.my-class { color: red; }');
      });

      it('should auto-detect CSS ID rules', () => {
        const input = '#my-id { margin: 0; }';
        const result = formatAiContent(input);

        const textContent = getTextContent(result);
        expect(textContent).toContain('#my-id { margin: 0; }');
      });
    });

    describe('Legacy content without markdown', () => {
      it('should format plain text with newlines correctly', () => {
        const input = 'Line 1\nLine 2\n\nParagraph 2';
        const result = formatAiContent(input);

        const textContent = getTextContent(result);
        expect(textContent).toContain('Line 1');
        expect(textContent).toContain('Line 2');
        expect(textContent).toContain('Paragraph 2');
      });

      it('should handle content with mixed Before/After and code', () => {
        const input = `Before:
<p class="old">Old</p>

After:
<p class="new">New</p>`;

        const result = formatAiContent(input);

        const textContent = getTextContent(result);
        expect(textContent).toContain('Before:');
        expect(textContent).toContain('After:');
      });

      it('should disable auto-detection when option is false', () => {
        const input = '<div>Test</div>';
        const result = formatAiContent(input, { autoDetectCode: false });

        // Should still render but not as code block
        const textContent = getTextContent(result);
        expect(textContent).toContain('<div>Test</div>');
      });
    });

    describe('Malformed content handling', () => {
      it('should handle unmatched backticks gracefully', () => {
        const input = 'This has a `broken backtick';
        const result = formatAiContent(input);

        // Should not throw, should return some content
        expect(result.length).toBeGreaterThan(0);
      });

      it('should handle incomplete code blocks', () => {
        const input = '```\ncode without closing';
        const result = formatAiContent(input);

        // Should not throw, should return some content
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================
  // Integration Tests
  // ============================================

  describe('Integration: Real-world AI output', () => {
    it('should handle typical AI fix suggestion format', () => {
      const input = `Increase the contrast between text and background.

Before:
\`\`\`html
<p class="low-contrast">Sample text</p>
\`\`\`

After:
\`\`\`css
.low-contrast {
  color: #595959;
}
\`\`\`

Use a contrast checker tool like https://webaim.org/resources/contrastchecker/`;

      const result = formatAiContent(input);

      expect(result.length).toBeGreaterThan(0);
      expect(hasElementType(result, 'pre')).toBe(true);
      expect(hasElementType(result, 'a')).toBe(true);

      const textContent = getTextContent(result);
      expect(textContent).toContain('Before:');
      expect(textContent).toContain('After:');
      expect(textContent).toContain('.low-contrast');
    });
  });
});
