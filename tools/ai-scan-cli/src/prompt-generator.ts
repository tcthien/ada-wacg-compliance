import Handlebars from 'handlebars';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { PendingScan, ExistingIssue } from './types.js';
import type { DownloadedSite } from './website-downloader.js';

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
