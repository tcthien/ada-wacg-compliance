import { randomUUID } from 'crypto';
import type { ScanResult, Issue, ImpactLevel, AiIssueEnhancement } from './types.js';

/**
 * Extracts JSON from markdown code blocks
 * @param output - Raw Claude Code output that may contain markdown
 * @returns Extracted JSON string or null if not found
 */
export function extractJsonFromMarkdown(output: string): string | null {
  const markdownPattern = /```(?:json)?\s*([\s\S]*?)```/;
  const match = output.match(markdownPattern);

  if (match && match[1]) {
    return match[1].trim();
  }

  return null;
}

/**
 * Validates if a value is a valid ImpactLevel
 * @param value - Value to validate
 * @returns true if value is a valid ImpactLevel
 */
function isValidImpactLevel(value: unknown): value is ImpactLevel {
  return (
    typeof value === 'string' &&
    ['CRITICAL', 'SERIOUS', 'MODERATE', 'MINOR'].includes(value)
  );
}

/**
 * Normalizes a raw issue object to the Issue interface
 * @param rawIssue - Raw issue object from Claude Code output
 * @returns Normalized Issue object
 */
export function normalizeIssue(rawIssue: unknown): Issue {
  if (typeof rawIssue !== 'object' || rawIssue === null) {
    throw new Error('Invalid issue: must be an object');
  }

  const issue = rawIssue as Record<string, unknown>;

  // Check for required fields
  if (!issue.description || typeof issue.description !== 'string') {
    throw new Error('Invalid issue: missing required field "description"');
  }

  // Normalize impact level
  const impact = isValidImpactLevel(issue.impact)
    ? issue.impact
    : 'MODERATE';

  // Normalize aiPriority (must be 1-10)
  let aiPriority = 5; // default
  if (typeof issue.aiPriority === 'number' &&
      issue.aiPriority >= 1 &&
      issue.aiPriority <= 10) {
    aiPriority = issue.aiPriority;
  }

  return {
    id: randomUUID(),
    ruleId: typeof issue.ruleId === 'string' ? issue.ruleId : '',
    wcagCriteria: typeof issue.wcagCriteria === 'string' ? issue.wcagCriteria : '',
    impact,
    description: issue.description,
    helpText: typeof issue.helpText === 'string' ? issue.helpText : '',
    helpUrl: issue.helpUrl === undefined || issue.helpUrl === null
      ? ''
      : String(issue.helpUrl),
    htmlSnippet: typeof issue.htmlSnippet === 'string' ? issue.htmlSnippet : '',
    cssSelector: typeof issue.cssSelector === 'string' ? issue.cssSelector : '',
    aiExplanation: typeof issue.aiExplanation === 'string' ? issue.aiExplanation : '',
    aiFixSuggestion: typeof issue.aiFixSuggestion === 'string' ? issue.aiFixSuggestion : '',
    aiPriority,
  };
}

/**
 * Normalizes an array of raw issues
 * @param rawIssues - Array of raw issue objects
 * @returns Array of normalized Issue objects
 */
export function normalizeIssues(rawIssues: unknown[]): Issue[] {
  if (!Array.isArray(rawIssues)) {
    return [];
  }

  const normalized: Issue[] = [];

  for (const rawIssue of rawIssues) {
    try {
      const normalizedIssue = normalizeIssue(rawIssue);
      normalized.push(normalizedIssue);
    } catch {
      // Filter out completely invalid issues (missing required fields)
      // Silently skip invalid issues
    }
  }

  return normalized;
}

/**
 * Normalizes a raw AI issue enhancement object
 * @param rawEnhancement - Raw enhancement object from Claude Code output
 * @returns Normalized AiIssueEnhancement object or null if invalid
 */
function normalizeEnhancement(rawEnhancement: unknown): AiIssueEnhancement | null {
  if (typeof rawEnhancement !== 'object' || rawEnhancement === null) {
    return null;
  }

  const enhancement = rawEnhancement as Record<string, unknown>;

  // issueId is required
  if (!enhancement.issueId || typeof enhancement.issueId !== 'string') {
    return null;
  }

  // Normalize aiPriority (must be 1-10)
  let aiPriority = 5; // default
  if (typeof enhancement.aiPriority === 'number' &&
      enhancement.aiPriority >= 1 &&
      enhancement.aiPriority <= 10) {
    aiPriority = Math.round(enhancement.aiPriority);
  }

  return {
    issueId: enhancement.issueId,
    aiExplanation: typeof enhancement.aiExplanation === 'string' ? enhancement.aiExplanation : '',
    aiFixSuggestion: typeof enhancement.aiFixSuggestion === 'string' ? enhancement.aiFixSuggestion : '',
    aiPriority,
  };
}

/**
 * Normalizes an array of raw AI enhancements
 * @param rawEnhancements - Array of raw enhancement objects
 * @returns Array of normalized AiIssueEnhancement objects
 */
function normalizeEnhancements(rawEnhancements: unknown[]): AiIssueEnhancement[] {
  if (!Array.isArray(rawEnhancements)) {
    return [];
  }

  const normalized: AiIssueEnhancement[] = [];

  for (const rawEnhancement of rawEnhancements) {
    const enhancement = normalizeEnhancement(rawEnhancement);
    if (enhancement) {
      normalized.push(enhancement);
    }
  }

  return normalized;
}

/**
 * Normalizes issues in a ScanResult object
 * Handles both legacy mode (with issues) and enhancement mode (with aiEnhancements)
 * @param result - Raw ScanResult object
 * @returns ScanResult with normalized issues/enhancements
 */
function normalizeScanResult(result: unknown): ScanResult {
  if (typeof result !== 'object' || result === null) {
    throw new Error('Invalid scan result: must be an object');
  }

  const scanResult = result as Record<string, unknown>;

  // Normalize issues if present (legacy mode)
  const issues = Array.isArray(scanResult.issues)
    ? normalizeIssues(scanResult.issues)
    : [];

  // Normalize AI enhancements if present (enhancement mode)
  const aiEnhancements = Array.isArray(scanResult.aiEnhancements)
    ? normalizeEnhancements(scanResult.aiEnhancements)
    : undefined;

  return {
    ...scanResult,
    issues,
    aiEnhancements,
  } as ScanResult;
}

/**
 * Extracts results array from parsed JSON
 * Handles both direct array and nested {results: [...]} structure
 */
function extractResultsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    // Check for nested 'results' array (our template format)
    if (Array.isArray(obj.results)) {
      return obj.results;
    }
    // Single result object
    return [parsed];
  }

  return [];
}

/**
 * Parses Claude Code output into structured ScanResult array
 * @param output - Raw output from Claude Code scan
 * @returns Array of ScanResult objects (empty array if parsing fails)
 */
export function parseClaudeOutput(output: string): ScanResult[] {
  let parsedResults: unknown[] = [];

  // Strategy 1: Try direct JSON parsing
  try {
    const parsed = JSON.parse(output);
    parsedResults = extractResultsArray(parsed);
  } catch {
    // Direct parsing failed, continue to next strategy
  }

  // Strategy 2: Try extracting from markdown code blocks
  if (parsedResults.length === 0) {
    const extractedJson = extractJsonFromMarkdown(output);
    if (extractedJson) {
      try {
        const parsed = JSON.parse(extractedJson);
        parsedResults = extractResultsArray(parsed);
      } catch {
        // Markdown extraction parsing failed, continue to next strategy
      }
    }
  }

  // Strategy 3: Try finding object pattern with 'results' key
  if (parsedResults.length === 0) {
    const objectPattern = /\{\s*"wcagLevel"[\s\S]*"results"\s*:\s*\[[\s\S]*\]\s*\}/;
    const objectMatch = output.match(objectPattern);
    if (objectMatch) {
      try {
        const parsed = JSON.parse(objectMatch[0]);
        parsedResults = extractResultsArray(parsed);
      } catch {
        // Object pattern parsing failed
      }
    }
  }

  // Strategy 4: Try finding array pattern in the output
  if (parsedResults.length === 0) {
    const arrayPattern = /\[\s*\{[\s\S]*\}\s*\]/;
    const arrayMatch = output.match(arrayPattern);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) {
          parsedResults = parsed;
        }
      } catch {
        // Array pattern parsing failed
      }
    }
  }

  // Normalize all parsed results
  const normalized: ScanResult[] = [];
  for (const result of parsedResults) {
    try {
      normalized.push(normalizeScanResult(result));
    } catch {
      // Skip invalid scan results
    }
  }

  return normalized;
}
