/**
 * @fileoverview Prompt Generator Module
 *
 * This module provides functions for generating AI prompts from Handlebars templates.
 * It handles template loading, compilation, and rendering for various accessibility
 * analysis tasks including HTML analysis, issue enhancement, and criteria verification.
 *
 * ## Template System
 *
 * The module uses Handlebars templates stored in the `templates/` directory:
 * - `default-prompt.hbs` - Legacy batch scan prompt
 * - `html-analysis-prompt.hbs` - Full HTML accessibility analysis
 * - `issue-enhancement-prompt.hbs` - Enhance existing axe-core issues with AI
 * - `criteria-verification-prompt.hbs` - Verify specific WCAG criteria
 *
 * ## Verification Instructions
 *
 * WCAG criteria verification instructions are stored in `data/wcag-verification-instructions.json`.
 * This JSON file contains:
 * - Per-criterion verification guidance (what to check, pass conditions, fail indicators)
 * - WCAG level classification (A, AA, AAA)
 * - Manual review requirements
 *
 * ## Caching
 *
 * Verification instructions are cached in memory after first load to avoid repeated
 * file system reads. Use `clearVerificationInstructionsCache()` to force reload.
 *
 * @module prompt-generator
 * @see {@link generateCriteriaVerificationPrompt} for criteria verification prompts
 * @see {@link loadVerificationInstructions} for loading verification guidance
 * @see {@link batchCriteriaByLevel} for splitting criteria into batches
 */

import Handlebars from 'handlebars';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { PendingScan, ExistingIssue, CriterionVerificationInstruction, WcagLevel } from './types.js';
import type { DownloadedSite } from './website-downloader.js';

/**
 * Structure of a criterion in the verification instructions JSON file.
 *
 * Extends CriterionVerificationInstruction with the WCAG level field,
 * which is used for filtering criteria by conformance level.
 *
 * @example
 * const criterion: CriterionWithLevel = {
 *   criterionId: '1.1.1',
 *   title: 'Non-text Content',
 *   level: 'A',
 *   description: 'All non-text content has a text alternative',
 *   whatToCheck: 'Check all images have alt text...',
 *   passCondition: 'All images have appropriate alt text',
 *   failIndicators: 'Images without alt, decorative images with alt',
 *   requiresManualReview: false
 * };
 */
export interface CriterionWithLevel extends CriterionVerificationInstruction {
  /** WCAG conformance level (A, AA, or AAA) */
  level: string;
}

/**
 * Structure of the wcag-verification-instructions.json file.
 *
 * Contains the complete set of WCAG criteria verification instructions
 * used to guide AI in verifying accessibility compliance.
 *
 * @example
 * const instructions: WcagVerificationInstructions = {
 *   version: '2.1',
 *   lastUpdated: '2024-01-15',
 *   description: 'WCAG 2.1 verification instructions',
 *   criteria: {
 *     '1.1.1': { criterionId: '1.1.1', level: 'A', ... },
 *     '1.2.1': { criterionId: '1.2.1', level: 'A', ... },
 *     // ... more criteria
 *   }
 * };
 */
export interface WcagVerificationInstructions {
  /** Version of the WCAG specification (e.g., "2.1", "2.2") */
  version: string;
  /** Date the instructions were last updated (ISO 8601 format) */
  lastUpdated?: string;
  /** Description of the instructions file */
  description?: string;
  /** Map of criterion ID (e.g., "1.1.1") to verification instructions */
  criteria: Record<string, CriterionWithLevel>;
}

// Cache for verification instructions to avoid repeated file reads
let cachedInstructions: WcagVerificationInstructions | null = null;

/**
 * Context object for generating prompts (batch mode - deprecated)
 */
export interface PromptContext {
  scans: PendingScan[];
  wcagLevel: string;
}

/**
 * Context object for generating HTML analysis prompts (new architecture)
 */
export interface HtmlAnalysisContext {
  scanId: string;
  url: string;
  wcagLevel: string;
  pageTitle: string;
  htmlContent: string;
  accessibilitySnapshot?: string;
  screenshotPath?: string;
}

/**
 * Get the default template path relative to the package
 * @returns Absolute path to the default Handlebars template
 */
export function getDefaultTemplatePath(): string {
  // Get the directory of the current module file
  const currentFileUrl = import.meta.url;
  const currentFilePath = fileURLToPath(currentFileUrl);
  const currentDir = dirname(currentFilePath);

  // Navigate to the templates directory (one level up from src)
  const templatePath = join(currentDir, '..', 'templates', 'default-prompt.hbs');

  return templatePath;
}

/**
 * Load a custom template from a file path
 * @param templatePath - Path to the custom template file
 * @returns Promise resolving to the template content as a string
 */
export async function loadCustomTemplate(templatePath: string): Promise<string> {
  const templateContent = await readFile(templatePath, 'utf-8');
  return templateContent;
}

/**
 * Validate that a template contains all required placeholders
 * @param templateContent - The template content to validate
 * @throws Error if required placeholders are missing or template has syntax errors
 */
export function validateTemplate(templateContent: string): void {
  // Required placeholders for the template
  const requiredPlaceholders = [
    { pattern: /\{\{#each\s+scans\}\}/i, name: '{{#each scans}}' },
    { pattern: /\{\{wcagLevel\}\}/i, name: '{{wcagLevel}}' },
    { pattern: /\{\{this\.url\}\}/i, name: '{{this.url}}' },
    { pattern: /\{\{this\.scanId\}\}/i, name: '{{this.scanId}}' }
  ];

  // Check for missing placeholders
  const missingPlaceholders: string[] = [];
  for (const { pattern, name } of requiredPlaceholders) {
    if (!pattern.test(templateContent)) {
      missingPlaceholders.push(name);
    }
  }

  // If any placeholders are missing, throw an error
  if (missingPlaceholders.length > 0) {
    const placeholderList = missingPlaceholders.join(', ');
    throw new Error(
      `Template validation failed. Missing required placeholders: ${placeholderList}`
    );
  }

  // Validate Handlebars syntax by attempting to compile
  try {
    Handlebars.compile(templateContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Template syntax validation failed: ${message}`);
  }
}

/**
 * Generate a prompt for Claude Code invocation using Handlebars templates
 * @param context - The prompt context containing scans and WCAG level
 * @param templatePath - Optional custom template path (uses default if not provided)
 * @returns Promise resolving to the generated prompt string
 */
export async function generatePrompt(
  context: PromptContext,
  templatePath?: string
): Promise<string> {
  // Determine which template to use
  const resolvedTemplatePath = templatePath ?? getDefaultTemplatePath();

  // Load the template file
  const templateContent = templatePath
    ? await loadCustomTemplate(resolvedTemplatePath)
    : await readFile(resolvedTemplatePath, 'utf-8');

  // Validate the template before rendering
  validateTemplate(templateContent);

  // Compile the Handlebars template
  const template = Handlebars.compile(templateContent);

  // Render the template with the provided context
  const renderedPrompt = template(context);

  return renderedPrompt;
}

/**
 * Get the HTML analysis template path relative to the package
 * @returns Absolute path to the HTML analysis Handlebars template
 */
export function getHtmlAnalysisTemplatePath(): string {
  const currentFileUrl = import.meta.url;
  const currentFilePath = fileURLToPath(currentFileUrl);
  const currentDir = dirname(currentFilePath);

  const templatePath = join(currentDir, '..', 'templates', 'html-analysis-prompt.hbs');

  return templatePath;
}

/**
 * Generate a prompt for HTML content analysis using Handlebars templates
 * @param downloadedSite - The downloaded site data to analyze
 * @param maxHtmlLength - Maximum HTML content length (default: 50000)
 * @returns Promise resolving to the generated prompt string
 */
export async function generateHtmlAnalysisPrompt(
  downloadedSite: DownloadedSite,
  maxHtmlLength: number = 50000
): Promise<string> {
  const templatePath = getHtmlAnalysisTemplatePath();
  const templateContent = await readFile(templatePath, 'utf-8');

  // Compile the Handlebars template
  const template = Handlebars.compile(templateContent);

  // Truncate HTML if too long
  let htmlContent = downloadedSite.htmlContent;
  if (htmlContent.length > maxHtmlLength) {
    htmlContent = htmlContent.substring(0, maxHtmlLength) + '\n<!-- CONTENT TRUNCATED -->';
  }

  // Build context for the template
  const context: HtmlAnalysisContext = {
    scanId: downloadedSite.scanId,
    url: downloadedSite.url,
    wcagLevel: downloadedSite.wcagLevel,
    pageTitle: downloadedSite.pageTitle,
    htmlContent,
    accessibilitySnapshot: downloadedSite.accessibilitySnapshot,
    screenshotPath: downloadedSite.screenshotPath,
  };

  // Render the template with the provided context
  const renderedPrompt = template(context);

  return renderedPrompt;
}

/**
 * Context object for generating issue enhancement prompts
 */
export interface IssueEnhancementContext {
  scanId: string;
  url: string;
  wcagLevel: string;
  pageTitle: string;
  existingIssuesJson: string;
  htmlContent?: string;
  accessibilitySnapshot?: string;
}

/**
 * Get the issue enhancement template path relative to the package
 * @returns Absolute path to the issue enhancement Handlebars template
 */
export function getIssueEnhancementTemplatePath(): string {
  const currentFileUrl = import.meta.url;
  const currentFilePath = fileURLToPath(currentFileUrl);
  const currentDir = dirname(currentFilePath);

  const templatePath = join(currentDir, '..', 'templates', 'issue-enhancement-prompt.hbs');

  return templatePath;
}

/**
 * Generate a prompt for enhancing existing axe-core issues with AI analysis
 * @param downloadedSite - The downloaded site data for context
 * @param existingIssues - Array of existing issues from axe-core to enhance
 * @param maxHtmlLength - Maximum HTML content length (default: 30000 - smaller for enhancement)
 * @returns Promise resolving to the generated prompt string
 */
export async function generateIssueEnhancementPrompt(
  downloadedSite: DownloadedSite,
  existingIssues: ExistingIssue[],
  maxHtmlLength: number = 30000
): Promise<string> {
  const templatePath = getIssueEnhancementTemplatePath();
  const templateContent = await readFile(templatePath, 'utf-8');

  // Compile the Handlebars template
  const template = Handlebars.compile(templateContent);

  // Truncate HTML if too long (smaller limit since we include issues JSON)
  let htmlContent: string | undefined = downloadedSite.htmlContent;
  if (htmlContent && htmlContent.length > maxHtmlLength) {
    htmlContent = htmlContent.substring(0, maxHtmlLength) + '\n<!-- CONTENT TRUNCATED -->';
  }

  // Build context for the template
  const context: IssueEnhancementContext = {
    scanId: downloadedSite.scanId,
    url: downloadedSite.url,
    wcagLevel: downloadedSite.wcagLevel,
    pageTitle: downloadedSite.pageTitle,
    existingIssuesJson: JSON.stringify(existingIssues, null, 2),
    htmlContent,
    accessibilitySnapshot: downloadedSite.accessibilitySnapshot,
  };

  // Render the template with the provided context
  const renderedPrompt = template(context);

  return renderedPrompt;
}

/**
 * Context object for generating criteria verification prompts.
 *
 * Contains all the data needed to render the criteria-verification-prompt.hbs template.
 * This context includes both the page content to analyze and the specific WCAG criteria
 * to verify against.
 *
 * @example
 * const context: CriteriaVerificationContext = {
 *   scanId: 'scan-123',
 *   url: 'https://example.com',
 *   wcagLevel: 'AA',
 *   pageTitle: 'Example Homepage',
 *   htmlContent: '<html>...</html>',
 *   accessibilitySnapshot: 'Button "Submit" ...',
 *   criteriaBatch: [
 *     { criterionId: '1.1.1', title: 'Non-text Content', ... },
 *     { criterionId: '1.2.1', title: 'Audio-only and Video-only', ... }
 *   ],
 *   existingIssueIds: ['issue-uuid-1', 'issue-uuid-2']
 * };
 */
export interface CriteriaVerificationContext {
  /** Unique identifier for the scan session */
  scanId: string;
  /** URL of the page being analyzed */
  url: string;
  /** Target WCAG conformance level (A, AA, or AAA) */
  wcagLevel: string;
  /** Title of the page from HTML <title> element */
  pageTitle: string;
  /** Full or truncated HTML content of the page */
  htmlContent?: string;
  /** Playwright accessibility snapshot (if available) */
  accessibilitySnapshot?: string;
  /** Array of criteria instructions to verify in this batch */
  criteriaBatch: CriterionVerificationInstruction[];
  /** IDs of existing issues from axe-core that may relate to these criteria */
  existingIssueIds: string[];
}

/**
 * Get the criteria verification template path relative to the package.
 *
 * Returns the absolute path to the `criteria-verification-prompt.hbs` template file.
 * The path is resolved relative to the current module's location.
 *
 * @returns Absolute path to the criteria verification Handlebars template
 *
 * @example
 * const templatePath = getCriteriaVerificationTemplatePath();
 * // Returns: '/path/to/ai-scan-cli/templates/criteria-verification-prompt.hbs'
 */
export function getCriteriaVerificationTemplatePath(): string {
  const currentFileUrl = import.meta.url;
  const currentFilePath = fileURLToPath(currentFileUrl);
  const currentDir = dirname(currentFilePath);

  const templatePath = join(currentDir, '..', 'templates', 'criteria-verification-prompt.hbs');

  return templatePath;
}

/**
 * Generate a prompt for AI verification of WCAG criteria.
 *
 * Creates a complete prompt string by rendering the criteria-verification-prompt.hbs
 * template with the provided context. The prompt includes:
 * - Page metadata (URL, title, WCAG level)
 * - HTML content (truncated if exceeding maxHtmlLength)
 * - Accessibility snapshot (if available)
 * - Batch of criteria to verify with detailed instructions
 * - List of existing issue IDs for cross-referencing
 *
 * ## HTML Truncation
 *
 * HTML content is truncated to maxHtmlLength characters (default: 30,000) to stay
 * within AI context limits. A comment `<!-- CONTENT TRUNCATED -->` is appended when
 * truncation occurs. The default is smaller than HTML analysis (50,000) because
 * criteria verification includes additional context (criteria batch, issue IDs).
 *
 * @param downloadedSite - The downloaded site data containing HTML and metadata
 * @param criteriaBatch - Array of criteria instructions to verify (typically 10 per batch)
 * @param existingIssueIds - Array of existing issue IDs from axe-core for cross-referencing
 * @param maxHtmlLength - Maximum HTML content length before truncation (default: 30000)
 * @returns Promise resolving to the generated prompt string ready for AI invocation
 *
 * @example
 * // Generate prompt for a batch of criteria
 * const prompt = await generateCriteriaVerificationPrompt(
 *   downloadedSite,
 *   [
 *     { criterionId: '1.1.1', title: 'Non-text Content', ... },
 *     { criterionId: '1.2.1', title: 'Audio-only and Video-only', ... }
 *   ],
 *   ['issue-uuid-1', 'issue-uuid-2'],
 *   30000
 * );
 *
 * // Use prompt with AI invoker
 * const result = await invokeClaudeCode(prompt, { timeout: 120000 });
 *
 * @example
 * // Generated prompt structure (simplified)
 * // === WCAG Criteria Verification ===
 * // URL: https://example.com
 * // WCAG Level: AA
 * //
 * // === Criteria to Verify ===
 * // 1.1.1 - Non-text Content
 * //   What to check: ...
 * //   Pass condition: ...
 * //
 * // === HTML Content ===
 * // <html>...</html>
 * //
 * // === Output Format ===
 * // Return JSON with criteriaVerifications array...
 */
export async function generateCriteriaVerificationPrompt(
  downloadedSite: DownloadedSite,
  criteriaBatch: CriterionVerificationInstruction[],
  existingIssueIds: string[],
  maxHtmlLength: number = 30000
): Promise<string> {
  const templatePath = getCriteriaVerificationTemplatePath();
  const templateContent = await readFile(templatePath, 'utf-8');

  // Compile the Handlebars template
  const template = Handlebars.compile(templateContent);

  // Truncate HTML if too long (smaller limit since we include criteria batch)
  let htmlContent: string | undefined = downloadedSite.htmlContent;
  if (htmlContent && htmlContent.length > maxHtmlLength) {
    htmlContent = htmlContent.substring(0, maxHtmlLength) + '\n<!-- CONTENT TRUNCATED -->';
  }

  // Build context for the template
  const context: CriteriaVerificationContext = {
    scanId: downloadedSite.scanId,
    url: downloadedSite.url,
    wcagLevel: downloadedSite.wcagLevel,
    pageTitle: downloadedSite.pageTitle,
    htmlContent,
    accessibilitySnapshot: downloadedSite.accessibilitySnapshot,
    criteriaBatch,
    existingIssueIds,
  };

  // Render the template with the provided context
  const renderedPrompt = template(context);

  return renderedPrompt;
}

/**
 * Get the path to the verification instructions JSON file.
 *
 * Returns the absolute path to the `wcag-verification-instructions.json` data file.
 * This file contains detailed verification guidance for all WCAG 2.1 criteria.
 *
 * @returns Absolute path to the wcag-verification-instructions.json file
 *
 * @example
 * const path = getVerificationInstructionsPath();
 * // Returns: '/path/to/ai-scan-cli/data/wcag-verification-instructions.json'
 */
export function getVerificationInstructionsPath(): string {
  const currentFileUrl = import.meta.url;
  const currentFilePath = fileURLToPath(currentFileUrl);
  const currentDir = dirname(currentFilePath);

  const instructionsPath = join(currentDir, '..', 'data', 'wcag-verification-instructions.json');

  return instructionsPath;
}

/**
 * Load verification instructions from the JSON file.
 *
 * Loads and parses the WCAG verification instructions from the data file.
 * Results are cached in memory to avoid repeated file system reads.
 * Subsequent calls return the cached data immediately.
 *
 * The instructions file contains:
 * - Criterion IDs (e.g., "1.1.1", "1.2.1")
 * - WCAG levels (A, AA, AAA)
 * - What to check for each criterion
 * - Pass conditions and fail indicators
 * - Manual review requirements
 *
 * @returns Promise resolving to the parsed verification instructions
 *
 * @example
 * // Load instructions (first call reads from file)
 * const instructions = await loadVerificationInstructions();
 * console.log(`Version: ${instructions.version}`);
 * console.log(`Criteria count: ${Object.keys(instructions.criteria).length}`);
 *
 * // Get a specific criterion
 * const criterion = instructions.criteria['1.1.1'];
 * console.log(`${criterion.criterionId}: ${criterion.title}`);
 * console.log(`Level: ${criterion.level}`);
 *
 * @example
 * // Second call returns cached data (no file read)
 * const instructions2 = await loadVerificationInstructions();
 * // Same object reference as first call
 */
export async function loadVerificationInstructions(): Promise<WcagVerificationInstructions> {
  // Return cached instructions if available
  if (cachedInstructions !== null) {
    return cachedInstructions;
  }

  const instructionsPath = getVerificationInstructionsPath();
  const fileContent = await readFile(instructionsPath, 'utf-8');
  const instructions = JSON.parse(fileContent) as WcagVerificationInstructions;

  // Cache the instructions
  cachedInstructions = instructions;

  return instructions;
}

/**
 * Clear the cached verification instructions.
 *
 * Resets the in-memory cache so the next call to `loadVerificationInstructions()`
 * will read from the file system again. Useful for:
 * - Testing with different instruction files
 * - Reloading after the instructions file has been updated
 * - Memory management in long-running processes
 *
 * @example
 * // Clear cache before test
 * clearVerificationInstructionsCache();
 *
 * // Next load will read from file
 * const instructions = await loadVerificationInstructions();
 *
 * @example
 * // Reload after updating instructions file
 * await updateInstructionsFile(newContent);
 * clearVerificationInstructionsCache();
 * const freshInstructions = await loadVerificationInstructions();
 */
export function clearVerificationInstructionsCache(): void {
  cachedInstructions = null;
}

/**
 * Get verification instructions for specific criteria IDs.
 *
 * Retrieves verification instructions for a specific set of criterion IDs.
 * IDs not found in the instructions file are silently skipped.
 * Useful when you know exactly which criteria you want to verify.
 *
 * @param criteriaIds - Array of criterion IDs (e.g., ["1.1.1", "1.2.1", "1.3.1"])
 * @returns Promise resolving to array of CriterionVerificationInstruction (skips IDs not found)
 *
 * @example
 * // Get specific criteria
 * const criteria = await getCriteriaBatch(['1.1.1', '1.2.1', '1.3.1']);
 * console.log(`Found ${criteria.length} criteria`);
 *
 * for (const criterion of criteria) {
 *   console.log(`${criterion.criterionId}: ${criterion.title}`);
 * }
 *
 * @example
 * // Unknown IDs are silently skipped
 * const criteria = await getCriteriaBatch(['1.1.1', 'INVALID', '1.2.1']);
 * console.log(criteria.length); // 2 (INVALID was skipped)
 */
export async function getCriteriaBatch(
  criteriaIds: string[]
): Promise<CriterionVerificationInstruction[]> {
  const instructions = await loadVerificationInstructions();
  const result: CriterionVerificationInstruction[] = [];

  for (const criterionId of criteriaIds) {
    const criterion = instructions.criteria[criterionId];
    if (criterion) {
      // Convert CriterionWithLevel to CriterionVerificationInstruction
      // by extracting only the fields defined in CriterionVerificationInstruction
      const verificationInstruction: CriterionVerificationInstruction = {
        criterionId: criterion.criterionId,
        title: criterion.title,
        description: criterion.description,
        whatToCheck: Array.isArray(criterion.whatToCheck)
          ? criterion.whatToCheck.join('\n')
          : criterion.whatToCheck,
        passCondition: criterion.passCondition,
        failIndicators: Array.isArray(criterion.failIndicators)
          ? criterion.failIndicators.join('\n')
          : criterion.failIndicators,
        requiresManualReview: criterion.requiresManualReview,
      };
      result.push(verificationInstruction);
    }
  }

  return result;
}

/**
 * Get all criteria that apply to a given WCAG level.
 *
 * WCAG conformance levels are cumulative:
 * - Level A: Only includes Level A criteria (~30 criteria)
 * - Level AA: Includes Level A + Level AA criteria (~50 criteria)
 * - Level AAA: Includes Level A + Level AA + Level AAA criteria (~78 criteria)
 *
 * Results are sorted by criterion ID for consistent ordering
 * (e.g., 1.1.1, 1.2.1, 1.2.2, 1.3.1, ..., 4.1.3).
 *
 * @param wcagLevel - The target WCAG conformance level (A, AA, or AAA)
 * @returns Promise resolving to array of CriterionVerificationInstruction sorted by ID
 *
 * @example
 * // Get all Level AA criteria (includes Level A)
 * const aaCriteria = await getCriteriaForLevel('AA');
 * console.log(`Level AA has ${aaCriteria.length} criteria`); // ~50
 *
 * @example
 * // Get only Level A criteria
 * const aCriteria = await getCriteriaForLevel('A');
 * console.log(`Level A has ${aCriteria.length} criteria`); // ~30
 *
 * @example
 * // Iterate through criteria
 * const criteria = await getCriteriaForLevel('AA');
 * for (const criterion of criteria) {
 *   console.log(`${criterion.criterionId}: ${criterion.title}`);
 * }
 */
export async function getCriteriaForLevel(
  wcagLevel: WcagLevel
): Promise<CriterionVerificationInstruction[]> {
  const instructions = await loadVerificationInstructions();
  const result: CriterionVerificationInstruction[] = [];

  // Determine which levels to include based on the target level
  const includedLevels: Set<string> = new Set();
  switch (wcagLevel) {
    case 'A':
      includedLevels.add('A');
      break;
    case 'AA':
      includedLevels.add('A');
      includedLevels.add('AA');
      break;
    case 'AAA':
      includedLevels.add('A');
      includedLevels.add('AA');
      includedLevels.add('AAA');
      break;
  }

  // Filter criteria by level
  for (const [, criterion] of Object.entries(instructions.criteria)) {
    if (includedLevels.has(criterion.level)) {
      // Convert CriterionWithLevel to CriterionVerificationInstruction
      const verificationInstruction: CriterionVerificationInstruction = {
        criterionId: criterion.criterionId,
        title: criterion.title,
        description: criterion.description,
        whatToCheck: Array.isArray(criterion.whatToCheck)
          ? criterion.whatToCheck.join('\n')
          : criterion.whatToCheck,
        passCondition: criterion.passCondition,
        failIndicators: Array.isArray(criterion.failIndicators)
          ? criterion.failIndicators.join('\n')
          : criterion.failIndicators,
        requiresManualReview: criterion.requiresManualReview,
      };
      result.push(verificationInstruction);
    }
  }

  // Sort by criterion ID for consistent ordering
  result.sort((a, b) => {
    const aParts = a.criterionId.split('.').map(Number);
    const bParts = b.criterionId.split('.').map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] ?? 0;
      const bVal = bParts[i] ?? 0;
      if (aVal !== bVal) {
        return aVal - bVal;
      }
    }
    return 0;
  });

  return result;
}

/**
 * Split criteria into batches based on WCAG level.
 *
 * Filters criteria by the target conformance level and divides them into
 * equal-sized batches for AI processing. This is the recommended way to
 * prepare criteria for batch verification.
 *
 * ## Batch Size Considerations
 *
 * The default batch size of 10 is optimized for:
 * - Token usage: ~10 criteria fit well within context limits
 * - Processing time: Each batch typically completes in 30-60 seconds
 * - Error handling: Smaller batches limit impact of failures
 *
 * Larger batches (15-20) may be more efficient for simple pages.
 * Smaller batches (5-8) may be needed for complex pages with lots of HTML.
 *
 * @param wcagLevel - The target WCAG level (A, AA, or AAA)
 * @param batchSize - Number of criteria per batch (default: 10)
 * @returns Promise resolving to array of batches (each batch is an array of CriterionVerificationInstruction)
 *
 * @example
 * // Create batches for Level AA verification
 * const batches = await batchCriteriaByLevel('AA', 10);
 * console.log(`Created ${batches.length} batches`); // ~5-6 batches for AA
 *
 * for (let i = 0; i < batches.length; i++) {
 *   console.log(`Batch ${i + 1}: ${batches[i].length} criteria`);
 *   // Process each batch...
 * }
 *
 * @example
 * // Custom batch size for complex pages
 * const smallBatches = await batchCriteriaByLevel('AA', 5);
 * console.log(`Created ${smallBatches.length} smaller batches`); // ~10-11 batches
 *
 * @example
 * // Use with CriteriaBatchProcessor
 * const batches = await batchCriteriaByLevel('AA');
 * for (const batch of batches) {
 *   const result = await processor.processSingleBatch(batchNumber, batch, ...);
 * }
 */
export async function batchCriteriaByLevel(
  wcagLevel: WcagLevel,
  batchSize: number = 10
): Promise<CriterionVerificationInstruction[][]> {
  const criteria = await getCriteriaForLevel(wcagLevel);
  const batches: CriterionVerificationInstruction[][] = [];

  for (let i = 0; i < criteria.length; i += batchSize) {
    const batch = criteria.slice(i, i + batchSize);
    batches.push(batch);
  }

  return batches;
}
