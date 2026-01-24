/**
 * @fileoverview Result Parser Module
 *
 * This module provides parsing and normalization functions for AI-generated accessibility
 * scan results. It handles the extraction of JSON from various AI output formats (raw JSON,
 * markdown code blocks, etc.) and normalizes the data to match expected TypeScript interfaces.
 *
 * ## Key Responsibilities
 *
 * 1. **JSON Extraction**: Extract valid JSON from AI responses that may contain:
 *    - Raw JSON strings
 *    - JSON wrapped in markdown code blocks (```json ... ```)
 *    - JSON with nested code blocks in string values
 *    - Mixed text and JSON output
 *
 * 2. **Data Normalization**: Convert raw AI output to strongly-typed interfaces:
 *    - Validate required fields
 *    - Apply default values for missing optional fields
 *    - Normalize enum values (e.g., PASS -> AI_VERIFIED_PASS)
 *    - Filter out completely invalid entries
 *
 * 3. **Criteria Verification Parsing**: Parse AI verification results with status normalization:
 *    - PASS -> AI_VERIFIED_PASS (indicates AI verified the criterion passes)
 *    - FAIL -> AI_VERIFIED_FAIL (indicates AI verified the criterion fails)
 *    - NOT_TESTED -> NOT_TESTED (criterion could not be verified)
 *
 * ## Parsing Strategies
 *
 * The module employs multiple strategies to extract JSON, tried in order:
 * 1. Direct JSON.parse() - For clean JSON output
 * 2. Markdown code block extraction - For ```json ... ``` wrapped output
 * 3. Object pattern matching - For responses with {results: [...]} structure
 * 4. Array pattern matching - For array-only responses
 * 5. Brace matching - For complex nested JSON with embedded code blocks
 *
 * @module result-parser
 * @see {@link parseBatchVerificationOutput} for criteria verification parsing
 * @see {@link parseClaudeOutput} for general scan result parsing
 */

import { randomUUID } from 'crypto';
import type { ScanResult, Issue, ImpactLevel, AiIssueEnhancement, AiCriteriaVerification, CriteriaStatus } from './types.js';

/**
 * Result from parsing batch verification AI output.
 *
 * Contains an array of criteria verification results parsed from AI response.
 * Each verification includes the criterion ID, status, confidence, and reasoning.
 *
 * @example
 * const result: BatchVerificationResult = {
 *   criteriaVerifications: [
 *     {
 *       criterionId: '1.1.1',
 *       status: 'AI_VERIFIED_PASS',
 *       confidence: 95,
 *       reasoning: 'All images have descriptive alt text',
 *       relatedIssueIds: []
 *     }
 *   ]
 * };
 */
export interface BatchVerificationResult {
  /** Array of parsed criteria verification results */
  criteriaVerifications: AiCriteriaVerification[];
}

/**
 * Extracts JSON from markdown code blocks.
 *
 * Handles various markdown code block formats that AI models may use to wrap JSON output.
 * Uses multiple extraction strategies to handle edge cases like nested code blocks
 * within JSON string values.
 *
 * ## Extraction Strategies
 *
 * 1. **```json block with greedy matching**: Finds ```json and extracts to the LAST closing ```.
 *    This handles cases where JSON string values contain embedded code blocks.
 *
 * 2. **Generic ``` block**: Falls back to non-greedy matching for simple cases where
 *    the first closing ``` is correct.
 *
 * @param output - Raw AI output that may contain markdown code blocks with JSON
 * @returns The extracted JSON string, or null if no valid JSON found
 *
 * @example
 * // Simple markdown code block
 * const input = '```json\n{"status": "PASS"}\n```';
 * const json = extractJsonFromMarkdown(input);
 * // Returns: '{"status": "PASS"}'
 *
 * @example
 * // JSON with embedded code block in string value
 * const input = '```json\n{"code": "```html\\n<div>\\n```"}\n```';
 * const json = extractJsonFromMarkdown(input);
 * // Returns: '{"code": "```html\\n<div>\\n```"}'
 *
 * @example
 * // No markdown - returns null
 * const input = '{"status": "PASS"}';
 * const json = extractJsonFromMarkdown(input);
 * // Returns: null (use JSON.parse directly for this case)
 */
export function extractJsonFromMarkdown(output: string): string | null {
  // Strategy 1: Find ```json block and extract to the LAST closing ```
  // This handles cases where JSON contains embedded code blocks in string values
  const jsonBlockMatch = output.match(/```json\s*\n([\s\S]*)/);
  if (jsonBlockMatch) {
    const content = jsonBlockMatch[1];
    // Find the last ``` that closes our JSON block
    // by finding the content that forms valid JSON
    const lastBackticks = content.lastIndexOf('\n```');
    if (lastBackticks !== -1) {
      const candidate = content.substring(0, lastBackticks).trim();
      // Verify it's valid JSON before returning
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // Try other extraction methods
      }
    }
  }

  // Strategy 2: Generic ``` block (non-greedy for simple cases)
  const genericMatch = output.match(/```\s*\n?([\s\S]*?)```/);
  if (genericMatch && genericMatch[1]) {
    const candidate = genericMatch[1].trim();
    // Only return if it looks like JSON (starts with { or [)
    if (candidate.startsWith('{') || candidate.startsWith('[')) {
      return candidate;
    }
  }

  return null;
}

/**
 * Extracts JSON by finding balanced braces.
 *
 * A robust JSON extraction method that scans for the first opening brace `{`
 * and finds its matching closing brace `}`, properly handling:
 * - Braces inside string values (ignored)
 * - Escaped characters within strings
 * - Nested objects and arrays
 *
 * This is useful for extracting JSON from AI responses that contain
 * explanatory text before or after the JSON object.
 *
 * @param output - Raw output that may contain JSON mixed with other text
 * @returns The extracted JSON string, or null if no valid JSON object found
 *
 * @example
 * // JSON with surrounding text
 * const input = 'Here is the result:\n{"status": "PASS"}\nThat completes the analysis.';
 * const json = extractJsonByBraceMatching(input);
 * // Returns: '{"status": "PASS"}'
 *
 * @example
 * // Nested JSON objects
 * const input = '{"outer": {"inner": "value"}}';
 * const json = extractJsonByBraceMatching(input);
 * // Returns: '{"outer": {"inner": "value"}}'
 *
 * @example
 * // Braces in string values are handled correctly
 * const input = '{"code": "function() { return {}; }"}';
 * const json = extractJsonByBraceMatching(input);
 * // Returns: '{"code": "function() { return {}; }"}'
 */
function extractJsonByBraceMatching(output: string): string | null {
  // Find the first opening brace
  const startIdx = output.indexOf('{');
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIdx; i < output.length; i++) {
    const char = output[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        const candidate = output.substring(startIdx, i + 1);
        // Verify it's valid JSON before returning
        try {
          JSON.parse(candidate);
          return candidate;
        } catch {
          // Keep looking for a valid JSON object
          continue;
        }
      }
    }
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
 * Valid CriteriaStatus values including raw AI output values.
 *
 * The AI may return simplified status values (PASS, FAIL) which need to be
 * normalized to the full CriteriaStatus enum values (AI_VERIFIED_PASS, AI_VERIFIED_FAIL).
 *
 * @constant {string[]}
 */
const VALID_CRITERIA_STATUSES = ['PASS', 'FAIL', 'AI_VERIFIED_PASS', 'AI_VERIFIED_FAIL', 'NOT_TESTED'];

/**
 * Validates if a value is a valid CriteriaStatus (including raw AI values).
 *
 * Accepts both the simplified values that AI may return (PASS, FAIL) and
 * the full enum values (AI_VERIFIED_PASS, AI_VERIFIED_FAIL, NOT_TESTED).
 *
 * @param value - The value to validate
 * @returns True if the value is a valid criteria status string
 *
 * @example
 * isValidCriteriaStatus('PASS');           // true
 * isValidCriteriaStatus('AI_VERIFIED_PASS'); // true
 * isValidCriteriaStatus('INVALID');        // false
 * isValidCriteriaStatus(123);              // false
 */
function isValidCriteriaStatus(value: unknown): value is CriteriaStatus | 'PASS' | 'FAIL' {
  return (
    typeof value === 'string' &&
    VALID_CRITERIA_STATUSES.includes(value)
  );
}

/**
 * Normalizes status values from AI output to CriteriaStatus enum.
 *
 * AI models may return simplified status values for brevity. This function
 * maps them to the canonical CriteriaStatus values used in the application:
 *
 * - `PASS` -> `AI_VERIFIED_PASS` (AI confirmed criterion is satisfied)
 * - `FAIL` -> `AI_VERIFIED_FAIL` (AI confirmed criterion is not satisfied)
 * - `NOT_TESTED` -> `NOT_TESTED` (unchanged - criterion could not be verified)
 * - `AI_VERIFIED_PASS` -> `AI_VERIFIED_PASS` (unchanged)
 * - `AI_VERIFIED_FAIL` -> `AI_VERIFIED_FAIL` (unchanged)
 *
 * @param status - The raw status string from AI output
 * @returns The normalized CriteriaStatus value
 *
 * @example
 * normalizeCriteriaStatusValue('PASS');     // Returns: 'AI_VERIFIED_PASS'
 * normalizeCriteriaStatusValue('FAIL');     // Returns: 'AI_VERIFIED_FAIL'
 * normalizeCriteriaStatusValue('NOT_TESTED'); // Returns: 'NOT_TESTED'
 */
function normalizeCriteriaStatusValue(status: string): CriteriaStatus {
  if (status === 'PASS') return 'AI_VERIFIED_PASS';
  if (status === 'FAIL') return 'AI_VERIFIED_FAIL';
  return status as CriteriaStatus;
}

/**
 * Normalizes a raw criteria verification object from AI output.
 *
 * Validates required fields and applies defaults for optional fields.
 * Normalizes status values (PASS -> AI_VERIFIED_PASS, FAIL -> AI_VERIFIED_FAIL).
 *
 * ## Required Fields
 * - `criterionId` (string): WCAG criterion ID (e.g., "1.1.1")
 * - `status` (string): One of PASS, FAIL, AI_VERIFIED_PASS, AI_VERIFIED_FAIL, NOT_TESTED
 *
 * ## Optional Fields with Defaults
 * - `confidence` (number): 0-100, defaults to 70
 * - `reasoning` (string): Explanation, defaults to empty string
 * - `relatedIssueIds` (string[]): Related issue IDs, defaults to undefined
 *
 * @param rawVerification - Raw verification object from AI output
 * @returns Normalized AiCriteriaVerification object, or null if validation fails
 *
 * @example
 * // Valid input with all fields
 * const result = normalizeCriteriaVerification({
 *   criterionId: '1.1.1',
 *   status: 'PASS',
 *   confidence: 95,
 *   reasoning: 'All images have alt text',
 *   relatedIssueIds: ['issue-1']
 * });
 * // Returns: { criterionId: '1.1.1', status: 'AI_VERIFIED_PASS', confidence: 95, ... }
 *
 * @example
 * // Minimal valid input (uses defaults)
 * const result = normalizeCriteriaVerification({
 *   criterionId: '1.2.1',
 *   status: 'NOT_TESTED'
 * });
 * // Returns: { criterionId: '1.2.1', status: 'NOT_TESTED', confidence: 70, reasoning: '' }
 *
 * @example
 * // Invalid input (missing required field)
 * const result = normalizeCriteriaVerification({ status: 'PASS' });
 * // Returns: null
 */
function normalizeCriteriaVerification(rawVerification: unknown): AiCriteriaVerification | null {
  if (typeof rawVerification !== 'object' || rawVerification === null) {
    return null;
  }

  const verification = rawVerification as Record<string, unknown>;

  // criterionId is required
  if (!verification.criterionId || typeof verification.criterionId !== 'string') {
    return null;
  }

  // Status is required and must be valid
  if (!isValidCriteriaStatus(verification.status)) {
    return null;
  }

  // Normalize confidence (must be 0-100)
  let confidence = 70; // default
  if (typeof verification.confidence === 'number' &&
      verification.confidence >= 0 &&
      verification.confidence <= 100) {
    confidence = Math.round(verification.confidence);
  }

  return {
    criterionId: verification.criterionId,
    // Normalize PASS -> AI_VERIFIED_PASS and FAIL -> AI_VERIFIED_FAIL
    status: normalizeCriteriaStatusValue(verification.status as string),
    confidence,
    reasoning: typeof verification.reasoning === 'string' ? verification.reasoning : '',
    relatedIssueIds: Array.isArray(verification.relatedIssueIds)
      ? verification.relatedIssueIds.filter((id): id is string => typeof id === 'string')
      : undefined,
  };
}

/**
 * Parses and normalizes an array of raw criteria verifications.
 *
 * Iterates through the raw verification array, normalizing each item and
 * filtering out invalid entries. This provides a fault-tolerant parsing
 * approach where partially valid AI output still yields usable results.
 *
 * @param rawVerifications - Array of raw verification objects from AI output
 * @returns Array of normalized AiCriteriaVerification objects (invalid entries filtered out)
 *
 * @example
 * const rawVerifications = [
 *   { criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'OK' },
 *   { criterionId: '1.2.1', status: 'INVALID' }, // Invalid - will be filtered
 *   { criterionId: '1.3.1', status: 'FAIL', confidence: 85, reasoning: 'Missing landmarks' }
 * ];
 *
 * const results = parseCriteriaVerifications(rawVerifications);
 * // Returns array with 2 items (1.1.1 and 1.3.1), the invalid one is filtered out
 * console.log(results.length); // 2
 * console.log(results[0].status); // 'AI_VERIFIED_PASS'
 * console.log(results[1].status); // 'AI_VERIFIED_FAIL'
 */
export function parseCriteriaVerifications(rawVerifications: unknown[]): AiCriteriaVerification[] {
  if (!Array.isArray(rawVerifications)) {
    return [];
  }

  const normalized: AiCriteriaVerification[] = [];

  for (const rawVerification of rawVerifications) {
    const verification = normalizeCriteriaVerification(rawVerification);
    if (verification) {
      normalized.push(verification);
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

  // Normalize criteria verifications if present
  const criteriaVerifications = Array.isArray(scanResult.criteriaVerifications)
    ? parseCriteriaVerifications(scanResult.criteriaVerifications)
    : undefined;

  return {
    ...scanResult,
    issues,
    aiEnhancements,
    criteriaVerifications,
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

  // Strategy 5: Robust JSON extraction by finding balanced braces
  // This handles cases where JSON contains embedded code blocks
  if (parsedResults.length === 0) {
    const extracted = extractJsonByBraceMatching(output);
    if (extracted) {
      try {
        const parsed = JSON.parse(extracted);
        parsedResults = extractResultsArray(parsed);
      } catch {
        // Brace matching extraction failed
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

/**
 * Parses batch verification output from AI into structured BatchVerificationResult.
 *
 * This is the main entry point for parsing AI criteria verification responses.
 * It handles various output formats and applies multiple extraction strategies
 * to reliably extract the JSON content.
 *
 * ## Expected AI Output Format
 *
 * The AI should return JSON (possibly wrapped in markdown code blocks) with this structure:
 *
 * ```json
 * {
 *   "criteriaVerifications": [
 *     {
 *       "criterionId": "1.1.1",
 *       "status": "PASS",           // or "FAIL", "NOT_TESTED"
 *       "confidence": 85,           // 0-100
 *       "reasoning": "All images have descriptive alt text that conveys purpose",
 *       "relatedIssueIds": ["issue-uuid-1"]  // optional
 *     },
 *     {
 *       "criterionId": "1.2.1",
 *       "status": "NOT_TESTED",
 *       "confidence": 0,
 *       "reasoning": "No audio content found on page"
 *     }
 *   ]
 * }
 * ```
 *
 * ## Status Values
 *
 * The AI may return these status values (all are valid):
 * - `PASS` - Normalized to `AI_VERIFIED_PASS`
 * - `FAIL` - Normalized to `AI_VERIFIED_FAIL`
 * - `AI_VERIFIED_PASS` - Used as-is
 * - `AI_VERIFIED_FAIL` - Used as-is
 * - `NOT_TESTED` - Used as-is (criterion could not be verified)
 *
 * ## Parsing Strategies
 *
 * The function tries these extraction methods in order:
 * 1. Direct JSON.parse() - For clean JSON output
 * 2. Markdown code block extraction - For ```json ... ``` wrapped output
 * 3. Brace matching - For JSON with surrounding text or embedded code blocks
 *
 * @param output - Raw AI output that may contain JSON in various formats
 * @returns BatchVerificationResult with parsed and normalized verifications
 * @throws Error if JSON extraction fails or the structure is invalid
 *
 * @example
 * // Parse clean JSON output
 * const result = parseBatchVerificationOutput(JSON.stringify({
 *   criteriaVerifications: [
 *     { criterionId: '1.1.1', status: 'PASS', confidence: 90, reasoning: 'OK' }
 *   ]
 * }));
 * console.log(result.criteriaVerifications[0].status); // 'AI_VERIFIED_PASS'
 *
 * @example
 * // Parse markdown-wrapped output
 * const aiOutput = `Here are the results:
 * \`\`\`json
 * {
 *   "criteriaVerifications": [
 *     { "criterionId": "1.1.1", "status": "FAIL", "confidence": 80, "reasoning": "Missing alt" }
 *   ]
 * }
 * \`\`\`
 * Analysis complete.`;
 *
 * const result = parseBatchVerificationOutput(aiOutput);
 * console.log(result.criteriaVerifications[0].status); // 'AI_VERIFIED_FAIL'
 *
 * @example
 * // Handle parsing errors
 * try {
 *   const result = parseBatchVerificationOutput('invalid output');
 * } catch (error) {
 *   console.error('Parsing failed:', error.message);
 *   // "Failed to extract JSON from AI output: No valid JSON found"
 * }
 */
export function parseBatchVerificationOutput(output: string): BatchVerificationResult {
  // Strategy 1: Try direct JSON parsing
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    // Direct parsing failed, try extracting from markdown
    const extractedJson = extractJsonFromMarkdown(output);
    if (extractedJson) {
      try {
        parsed = JSON.parse(extractedJson);
      } catch {
        // Markdown extraction failed, try brace matching
        const bracesExtracted = extractJsonByBraceMatching(output);
        if (bracesExtracted) {
          try {
            parsed = JSON.parse(bracesExtracted);
          } catch {
            throw new Error('Failed to parse JSON from AI output: Invalid JSON structure');
          }
        } else {
          throw new Error('Failed to extract JSON from AI output: No valid JSON found');
        }
      }
    } else {
      // Try brace matching as fallback
      const bracesExtracted = extractJsonByBraceMatching(output);
      if (bracesExtracted) {
        try {
          parsed = JSON.parse(bracesExtracted);
        } catch {
          throw new Error('Failed to parse JSON from AI output: Invalid JSON structure');
        }
      } else {
        throw new Error('Failed to extract JSON from AI output: No valid JSON found');
      }
    }
  }

  // Validate parsed structure
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid batch verification output: Expected an object');
  }

  const result = parsed as Record<string, unknown>;

  // Extract criteriaVerifications array
  if (!Array.isArray(result.criteriaVerifications)) {
    throw new Error('Invalid batch verification output: Missing or invalid criteriaVerifications array');
  }

  // Parse and normalize each verification
  const criteriaVerifications = parseCriteriaVerifications(result.criteriaVerifications);

  return {
    criteriaVerifications,
  };
}
