/**
 * Text Formatter Utility
 *
 * Parses and formats AI-generated text into React nodes with proper styling.
 * Handles markdown code blocks, inline code, newlines, URLs, sections, and
 * auto-detects HTML/CSS patterns for legacy content.
 *
 * Requirements: 1.1, 1.2, 2.1, 2.4, 6.1
 */

import React from 'react';
import { cn } from './utils';

/**
 * Options for text formatting
 */
export interface FormatOptions {
  /** Enable URL detection and linking (default: true) */
  linkUrls?: boolean;
  /** Enable "Before/After" section detection (default: true) */
  detectSections?: boolean;
  /** Enable automatic code pattern detection (default: true) */
  autoDetectCode?: boolean;
}

/**
 * Patterns for content detection
 */
const PATTERNS = {
  // Markdown code blocks: ```code``` or ```lang\ncode```
  CODE_BLOCK: /(```(?:\w*\n)?[\s\S]*?```)/g,

  // Inline code: `code`
  INLINE_CODE: /(`[^`\n]+`)/g,

  // URLs: https://... or http://...
  URL: /(https?:\/\/[^\s<>"')\]]+)/g,

  // Section headers: Before:, After:, Step N:, Option N:
  SECTION_HEADER: /^(Before|After|Step\s+\d+|Option\s+\d+):\s*/i,

  // HTML tags: <tag>...</tag> or <tag />
  HTML_CODE: /<([a-z][a-z0-9]*)\b[^>]*>[\s\S]*?<\/\1>|<[a-z][a-z0-9]*\b[^>]*\/?>/gi,

  // CSS rules: .class { ... } or #id { ... } or element { ... }
  CSS_CODE: /[.#]?[a-z][a-z0-9_-]*\s*\{[^}]+\}/gi,
};

/**
 * Default formatting options
 */
const DEFAULT_OPTIONS: Required<FormatOptions> = {
  linkUrls: true,
  detectSections: true,
  autoDetectCode: true,
};

/**
 * Renders a code block with styling
 */
function renderCodeBlock(code: string, key: string): React.ReactNode {
  // Remove the ``` markers and optional language identifier
  let cleanCode = code.slice(3, -3);
  // Remove language identifier if present (e.g., ```html\n)
  const firstNewline = cleanCode.indexOf('\n');
  if (firstNewline !== -1 && firstNewline < 20) {
    const possibleLang = cleanCode.slice(0, firstNewline).trim();
    if (/^[a-z]+$/i.test(possibleLang)) {
      cleanCode = cleanCode.slice(firstNewline + 1);
    }
  }

  return (
    <pre
      key={key}
      className={cn(
        'mt-2 mb-2 p-3 rounded-md overflow-x-auto',
        'bg-gray-900 text-gray-100 text-sm font-mono',
        'border border-gray-700'
      )}
    >
      <code>{cleanCode.trim()}</code>
    </pre>
  );
}

/**
 * Renders inline code with styling
 */
function renderInlineCode(code: string, key: string): React.ReactNode {
  // Remove the ` markers
  const cleanCode = code.slice(1, -1);

  return (
    <code
      key={key}
      className={cn(
        'px-1.5 py-0.5 rounded text-sm font-mono',
        'bg-gray-900 text-gray-100',
        'border border-gray-700'
      )}
    >
      {cleanCode}
    </code>
  );
}

/**
 * Renders a URL as a clickable link
 */
function renderLink(url: string, key: string): React.ReactNode {
  return (
    <a
      key={key}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'text-purple-600 hover:text-purple-800 underline',
        'break-all'
      )}
    >
      {url}
    </a>
  );
}

/**
 * Renders auto-detected code (HTML/CSS patterns)
 */
function renderAutoDetectedCode(code: string, key: string): React.ReactNode {
  return (
    <pre
      key={key}
      className={cn(
        'mt-2 mb-2 p-3 rounded-md overflow-x-auto',
        'bg-gray-900 text-gray-100 text-sm font-mono',
        'border border-gray-700'
      )}
    >
      <code>{code}</code>
    </pre>
  );
}

/**
 * Renders a section header (Before:, After:, etc.)
 */
function renderSectionHeader(
  header: string,
  key: string
): React.ReactNode {
  const lowerHeader = header.toLowerCase();
  const isBefore = lowerHeader.startsWith('before');
  const isAfter = lowerHeader.startsWith('after');

  return (
    <div
      key={key}
      className={cn(
        'font-semibold text-gray-800 mt-3 mb-1 text-sm',
        isBefore && 'text-red-700',
        isAfter && 'text-green-700'
      )}
    >
      {header}
    </div>
  );
}

/**
 * Splits text by a pattern while preserving the matched parts
 */
function splitByPattern(
  text: string,
  pattern: RegExp
): { text: string; isMatch: boolean }[] {
  const result: { text: string; isMatch: boolean }[] = [];
  let lastIndex = 0;

  // Create a new regex with global flag to use with exec
  const globalPattern = new RegExp(pattern.source, 'g');
  let match;

  while ((match = globalPattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      result.push({
        text: text.slice(lastIndex, match.index),
        isMatch: false,
      });
    }
    // Add the match itself
    result.push({
      text: match[0],
      isMatch: true,
    });
    lastIndex = globalPattern.lastIndex;
  }

  // Add any remaining text
  if (lastIndex < text.length) {
    result.push({
      text: text.slice(lastIndex),
      isMatch: false,
    });
  }

  return result;
}

/**
 * Processes plain text with newlines
 */
function processPlainText(
  text: string,
  keyPrefix: string,
  options: Required<FormatOptions>
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];

  // Split by double newlines for paragraphs
  const paragraphs = text.split(/\n\n+/);

  paragraphs.forEach((paragraph, pIndex) => {
    if (!paragraph.trim()) return;

    const paragraphNodes: React.ReactNode[] = [];

    // Check for section header at the start
    if (options.detectSections) {
      const headerMatch = paragraph.match(PATTERNS.SECTION_HEADER);
      if (headerMatch) {
        paragraphNodes.push(
          renderSectionHeader(headerMatch[0], `${keyPrefix}-header-${pIndex}`)
        );
        paragraph = paragraph.slice(headerMatch[0].length);
      }
    }

    // Split by single newlines
    const lines = paragraph.split(/\n/);

    lines.forEach((line, lIndex) => {
      if (!line.trim() && lIndex > 0) {
        // Empty line within paragraph - add line break
        paragraphNodes.push(<br key={`${keyPrefix}-br-${pIndex}-${lIndex}`} />);
        return;
      }

      // Process inline elements (inline code, URLs)
      let lineNodes: React.ReactNode[] = [];
      let currentText = line;
      let nodeIndex = 0;

      // First, handle inline code
      const inlineCodeParts = splitByPattern(currentText, PATTERNS.INLINE_CODE);
      inlineCodeParts.forEach((part, idx) => {
        if (part.isMatch) {
          lineNodes.push(
            renderInlineCode(
              part.text,
              `${keyPrefix}-ic-${pIndex}-${lIndex}-${idx}`
            )
          );
        } else if (part.text) {
          // Check for URLs in non-code text
          if (options.linkUrls) {
            const urlParts = splitByPattern(part.text, PATTERNS.URL);
            urlParts.forEach((urlPart, urlIdx) => {
              if (urlPart.isMatch) {
                lineNodes.push(
                  renderLink(
                    urlPart.text,
                    `${keyPrefix}-url-${pIndex}-${lIndex}-${idx}-${urlIdx}`
                  )
                );
              } else if (urlPart.text) {
                // Check for auto-detected code patterns
                if (options.autoDetectCode && !urlPart.text.startsWith(' ')) {
                  // Check for HTML patterns
                  const htmlMatch = urlPart.text.match(PATTERNS.HTML_CODE);
                  if (htmlMatch && htmlMatch[0] === urlPart.text.trim()) {
                    lineNodes.push(
                      renderAutoDetectedCode(
                        urlPart.text,
                        `${keyPrefix}-html-${pIndex}-${lIndex}-${idx}-${urlIdx}`
                      )
                    );
                    return;
                  }

                  // Check for CSS patterns
                  const cssMatch = urlPart.text.match(PATTERNS.CSS_CODE);
                  if (cssMatch && cssMatch[0] === urlPart.text.trim()) {
                    lineNodes.push(
                      renderAutoDetectedCode(
                        urlPart.text,
                        `${keyPrefix}-css-${pIndex}-${lIndex}-${idx}-${urlIdx}`
                      )
                    );
                    return;
                  }
                }

                lineNodes.push(
                  <span key={`${keyPrefix}-text-${pIndex}-${lIndex}-${idx}-${urlIdx}`}>
                    {urlPart.text}
                  </span>
                );
              }
            });
          } else {
            lineNodes.push(
              <span key={`${keyPrefix}-text-${pIndex}-${lIndex}-${idx}`}>
                {part.text}
              </span>
            );
          }
        }
        nodeIndex++;
      });

      paragraphNodes.push(...lineNodes);

      // Add line break between lines (but not after the last line)
      if (lIndex < lines.length - 1) {
        paragraphNodes.push(<br key={`${keyPrefix}-lbr-${pIndex}-${lIndex}`} />);
      }
    });

    // Wrap paragraph in a div with spacing
    if (paragraphNodes.length > 0) {
      nodes.push(
        <div key={`${keyPrefix}-p-${pIndex}`} className="mb-2">
          {paragraphNodes}
        </div>
      );
    }
  });

  return nodes;
}

/**
 * Formats AI-generated text into React nodes
 *
 * Handles:
 * - Markdown code blocks (```)
 * - Inline code (`)
 * - Newlines (\n)
 * - Before/After sections
 * - URLs as clickable links
 * - Auto-detected HTML/CSS code
 *
 * @param text - Raw text from AI response
 * @param options - Formatting options
 * @returns Array of React nodes
 *
 * Requirements: 1.1, 1.2, 2.1, 2.4, 3.1, 3.2, 4.1, 6.1
 */
export function formatAiContent(
  text: string | null | undefined,
  options?: FormatOptions
): React.ReactNode[] {
  // Handle null/undefined/empty input
  if (!text || typeof text !== 'string' || !text.trim()) {
    return [];
  }

  const mergedOptions: Required<FormatOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const nodes: React.ReactNode[] = [];
  let keyCounter = 0;

  // First, split by markdown code blocks (highest priority)
  const codeBlockParts = splitByPattern(text, PATTERNS.CODE_BLOCK);

  codeBlockParts.forEach((part) => {
    if (part.isMatch) {
      // This is a code block
      nodes.push(renderCodeBlock(part.text, `cb-${keyCounter++}`));
    } else if (part.text.trim()) {
      // Process the text between code blocks
      const textNodes = processPlainText(
        part.text,
        `txt-${keyCounter++}`,
        mergedOptions
      );
      nodes.push(...textNodes);
    }
  });

  return nodes;
}

export default formatAiContent;
