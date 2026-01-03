/**
 * Batch PDF Report Generator
 *
 * Generates comprehensive batch accessibility reports in PDF format using PDFKit.
 * Creates multi-URL reports with cover pages, executive summaries, and aggregate statistics.
 *
 * Requirements:
 * - 4.2: PDF export shall include cover page with batch metadata
 * - 4.5: Executive summary shows aggregate statistics
 */

import PDFDocument from 'pdfkit';
import type { WcagLevel } from '@prisma/client';
import {
  COLORS,
  FONTS,
  SPACING,
  PAGE,
  SEVERITY_CONFIG,
  addHeader,
  addSectionHeading,
  addDivider,
  addInfoRow,
  addSeverityBadge,
  addFooter,
  addDisclaimerBox,
  formatDate,
  ensureSpace,
  truncateText,
  type PDFDocumentInstance,
} from './pdf-templates.js';
import type { EnrichedIssue } from '../../utils/result-formatter.js';
import { sanitizeHtml } from '../scanner/html-sanitizer.js';

/**
 * Batch metadata for cover page
 */
export interface BatchMetadata {
  batchId: string;
  homepageUrl: string;
  totalUrls: number;
  completedCount: number;
  failedCount: number;
  wcagLevel: WcagLevel;
  createdAt: Date;
  completedAt: Date | null;
  status: string;
}

/**
 * Aggregate statistics for executive summary
 */
export interface BatchAggregate {
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  passedChecks: number;
  urlsScanned: number;
}

/**
 * Top problematic URL for executive summary
 */
export interface TopCriticalUrl {
  url: string;
  pageTitle: string | null;
  criticalCount: number;
}

/**
 * Per-URL breakdown data for detailed section
 */
export interface UrlBreakdown {
  url: string;
  pageTitle: string | null;
  summary: {
    totalIssues: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    passed: number;
  };
  issuesByImpact: {
    critical: EnrichedIssue[];
    serious: EnrichedIssue[];
    moderate: EnrichedIssue[];
    minor: EnrichedIssue[];
  };
}

/**
 * Batch PDF generation input
 */
export interface BatchPdfInput {
  metadata: BatchMetadata;
  aggregate: BatchAggregate;
  topCriticalUrls: TopCriticalUrl[];
  urlBreakdowns?: UrlBreakdown[];
}

/**
 * Generate a batch PDF report with cover page and executive summary
 *
 * Creates a professional multi-page PDF report including:
 * - Cover page with batch metadata (Requirement 4.2)
 * - Executive summary with aggregate statistics (Requirement 4.5)
 * - Top problematic URLs
 *
 * @param input - Batch data for PDF generation
 * @returns Promise resolving to PDF buffer
 *
 * @example
 * ```typescript
 * const input = {
 *   metadata: {
 *     batchId: 'batch-123',
 *     homepageUrl: 'https://example.com',
 *     totalUrls: 10,
 *     completedCount: 9,
 *     failedCount: 1,
 *     wcagLevel: 'AA',
 *     createdAt: new Date(),
 *     completedAt: new Date(),
 *     status: 'COMPLETED'
 *   },
 *   aggregate: {
 *     totalIssues: 42,
 *     criticalCount: 5,
 *     seriousCount: 12,
 *     moderateCount: 20,
 *     minorCount: 5,
 *     passedChecks: 150,
 *     urlsScanned: 9
 *   },
 *   topCriticalUrls: [
 *     { url: 'https://example.com/page1', pageTitle: 'Page 1', criticalCount: 3 }
 *   ]
 * };
 * const pdfBuffer = await generateBatchPdfReport(input);
 * ```
 */
export async function generateBatchPdfReport(input: BatchPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Enable bufferPages to allow adding footers after all content is placed
      const doc = new PDFDocument({ margin: SPACING.margin, size: 'LETTER', bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Page 1: Cover Page (Requirement 4.2)
      addCoverPage(doc, input.metadata);

      // Page 2: Executive Summary (Requirement 4.5)
      doc.addPage();
      addExecutiveSummary(doc, input.metadata, input.aggregate, input.topCriticalUrls);

      // Page 3+: Per-URL Breakdown and Detailed Issues (Requirements 4.3, 4.6)
      if (input.urlBreakdowns && input.urlBreakdowns.length > 0) {
        doc.addPage();
        addPerUrlBreakdown(doc, input.urlBreakdowns);

        doc.addPage();
        addDetailedIssuesByUrl(doc, input.urlBreakdowns);
      }

      // Add transparency disclaimer footer on last page
      addTransparencyDisclaimer(doc);

      // Add footers to all pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        addFooter(doc, i + 1);
      }

      // Finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Add cover page with batch metadata
 *
 * Creates a professional cover page including:
 * - Report title
 * - Homepage URL
 * - Total URLs scanned
 * - WCAG level
 * - Scan date
 * - Batch status
 *
 * Requirement 4.2: PDF export shall include cover page with batch metadata
 */
function addCoverPage(doc: PDFDocumentInstance, metadata: BatchMetadata): void {
  // Add vertical spacing to center content
  doc.moveDown(3);

  // Main title
  doc
    .fontSize(FONTS.title + 6)
    .fillColor(COLORS.primary)
    .text('Batch Accessibility Report', { align: 'center' })
    .moveDown(0.5);

  // Subtitle
  doc
    .fontSize(FONTS.heading)
    .fillColor(COLORS.textSecondary)
    .text('Multi-Page WCAG Compliance Analysis', { align: 'center' })
    .moveDown(3);

  // Decorative divider
  const centerY = doc.y;
  doc
    .moveTo(SPACING.margin + 100, centerY)
    .lineTo(PAGE.width - SPACING.margin - 100, centerY)
    .strokeColor(COLORS.primary)
    .lineWidth(2)
    .stroke();

  doc.moveDown(2);

  // Batch metadata section
  const metadataStartY = doc.y;
  const labelWidth = 160;
  const valueX = SPACING.margin + labelWidth + 20;

  // Homepage URL
  doc
    .fontSize(FONTS.body)
    .fillColor(COLORS.textSecondary)
    .text('Homepage:', SPACING.margin, metadataStartY, { width: labelWidth, continued: false });

  doc
    .fontSize(FONTS.body)
    .fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .text(metadata.homepageUrl, valueX, metadataStartY, { width: PAGE.contentWidth - labelWidth - 20 });

  doc.font('Helvetica').moveDown(0.8);

  // Total URLs scanned
  addInfoRow(doc, 'Total URLs Scanned:', `${metadata.completedCount} of ${metadata.totalUrls}`);

  // Failed scans
  if (metadata.failedCount > 0) {
    addInfoRow(doc, 'Failed Scans:', metadata.failedCount.toString());
  }

  // WCAG level
  addInfoRow(doc, 'WCAG Level:', metadata.wcagLevel);

  // Scan date
  addInfoRow(doc, 'Scan Date:', formatDate(metadata.createdAt));

  // Completion date
  if (metadata.completedAt) {
    addInfoRow(doc, 'Completed:', formatDate(metadata.completedAt));
  }

  // Batch status
  const statusColor = metadata.status === 'COMPLETED' ? COLORS.success :
                      metadata.status === 'FAILED' ? COLORS.critical :
                      COLORS.textSecondary;

  doc
    .fontSize(FONTS.body)
    .fillColor(COLORS.textSecondary)
    .text('Status:', SPACING.margin, doc.y, { width: labelWidth, continued: false });

  doc
    .fontSize(FONTS.body)
    .fillColor(statusColor)
    .font('Helvetica-Bold')
    .text(metadata.status, valueX, doc.y - FONTS.body - 3);

  doc.font('Helvetica').moveDown(3);

  // Batch ID at bottom
  doc
    .fontSize(FONTS.small)
    .fillColor(COLORS.textSecondary)
    .text(`Batch ID: ${metadata.batchId}`, { align: 'center' })
    .moveDown(2);

  // Branding
  doc
    .fontSize(FONTS.body)
    .fillColor(COLORS.primary)
    .text('Generated by ADAShield', { align: 'center' })
    .moveDown(0.3);

  doc
    .fontSize(FONTS.small)
    .fillColor(COLORS.textSecondary)
    .text('Professional Accessibility Testing', { align: 'center' });
}

/**
 * Add executive summary section with aggregate statistics
 *
 * Creates comprehensive summary including:
 * - Total issues found across all pages
 * - Breakdown by severity (critical, serious, moderate, minor)
 * - Passed checks count
 * - Top 5 problematic URLs
 *
 * Requirement 4.5: Executive summary shows aggregate statistics
 */
function addExecutiveSummary(
  doc: PDFDocumentInstance,
  metadata: BatchMetadata,
  aggregate: BatchAggregate,
  topCriticalUrls: TopCriticalUrl[]
): void {
  addHeader(doc, 'Executive Summary');

  doc
    .fontSize(FONTS.body)
    .fillColor(COLORS.textSecondary)
    .text(`Analysis of ${aggregate.urlsScanned} pages from ${metadata.homepageUrl}`, { align: 'center' })
    .moveDown(1.5);

  // Aggregate statistics section
  addSectionHeading(doc, 'Aggregate Statistics', true);

  // Total issues - prominently displayed
  doc
    .fontSize(FONTS.heading)
    .fillColor(COLORS.text)
    .text('Total Issues Found: ', { continued: true })
    .font('Helvetica-Bold')
    .fillColor(aggregate.totalIssues > 0 ? COLORS.critical : COLORS.success)
    .text(aggregate.totalIssues.toString());

  doc.font('Helvetica').fillColor(COLORS.text);
  doc.moveDown(0.5);

  doc
    .fontSize(FONTS.body)
    .fillColor(COLORS.textSecondary)
    .text(`Across ${aggregate.urlsScanned} successfully scanned pages`)
    .moveDown(1.2);

  // Severity breakdown in 2x2 grid
  const startY = doc.y;
  const colWidth = PAGE.contentWidth / 2;

  // Left column
  addSeverityBadge(doc, 'critical', aggregate.criticalCount, SPACING.margin, startY, colWidth);
  doc.y = startY + 25;
  addSeverityBadge(doc, 'moderate', aggregate.moderateCount, SPACING.margin, doc.y, colWidth);

  // Right column
  doc.y = startY;
  addSeverityBadge(
    doc,
    'serious',
    aggregate.seriousCount,
    SPACING.margin + colWidth,
    doc.y,
    colWidth
  );
  doc.y += 25;
  addSeverityBadge(doc, 'minor', aggregate.minorCount, SPACING.margin + colWidth, doc.y, colWidth);

  doc.y += 30;
  doc.moveDown(0.8);

  // Passed checks
  doc
    .fontSize(FONTS.body)
    .fillColor(COLORS.success)
    .text('✓ ', { continued: true })
    .fillColor(COLORS.text)
    .text('Passed Checks: ', { continued: true })
    .font('Helvetica-Bold')
    .text(aggregate.passedChecks.toString());

  doc.font('Helvetica');
  doc.moveDown(1.5);

  // Divider
  addDivider(doc);

  // Top problematic URLs section
  if (topCriticalUrls.length > 0) {
    ensureSpace(doc, 150);

    addSectionHeading(doc, 'Top Problematic Pages', true);

    doc
      .fontSize(FONTS.body)
      .fillColor(COLORS.textSecondary)
      .text('Pages with the highest number of critical accessibility issues:')
      .moveDown(0.8);

    // List top URLs (max 5)
    topCriticalUrls.slice(0, 5).forEach((urlData, index) => {
      ensureSpace(doc, 60);

      // Rank and critical count
      const y = doc.y;
      doc
        .fontSize(FONTS.subheading)
        .fillColor(COLORS.critical)
        .text(`${index + 1}.`, SPACING.margin, y, { width: 20, continued: false });

      doc
        .fontSize(FONTS.body)
        .fillColor(COLORS.text)
        .font('Helvetica-Bold')
        .text(`${urlData.criticalCount} Critical Issues`, SPACING.margin + 25, y, { continued: false });

      doc.font('Helvetica').moveDown(0.3);

      // Page title (if available)
      if (urlData.pageTitle) {
        doc
          .fontSize(FONTS.body)
          .fillColor(COLORS.text)
          .text(truncateText(urlData.pageTitle, 60), SPACING.margin + 25, doc.y);
        doc.moveDown(0.2);
      }

      // URL
      doc
        .fontSize(FONTS.small)
        .fillColor(COLORS.primary)
        .text(truncateText(urlData.url, 70), SPACING.margin + 25, doc.y, { link: urlData.url });

      doc.moveDown(0.8);
    });
  } else {
    // No critical issues found
    ensureSpace(doc, 80);

    addSectionHeading(doc, 'Critical Issues', true);

    doc
      .fontSize(FONTS.body)
      .fillColor(COLORS.success)
      .text('✓ No critical accessibility issues found across all scanned pages.', {
        width: PAGE.contentWidth
      });

    doc.moveDown(1);
  }

  // Divider
  addDivider(doc);

  // Coverage note
  addSectionHeading(doc, 'Important Note');

  const coverageNote =
    'Automated testing can only detect approximately 30-40% of WCAG issues. ' +
    'Manual testing by accessibility experts is recommended for comprehensive compliance. ' +
    'This report should be used as a starting point for your accessibility improvement efforts.';

  doc
    .fontSize(FONTS.small)
    .fillColor(COLORS.textSecondary)
    .text(coverageNote, { width: PAGE.contentWidth, align: 'justify' });
}

/**
 * Add per-URL breakdown table section
 *
 * Creates a table showing each URL with issue counts by severity.
 * Requirement 4.3: PDF shall include per-URL breakdown section with issue counts by severity
 */
function addPerUrlBreakdown(doc: PDFDocumentInstance, urlBreakdowns: UrlBreakdown[]): void {
  addHeader(doc, 'Per-URL Breakdown');

  doc
    .fontSize(FONTS.body)
    .fillColor(COLORS.textSecondary)
    .text('Detailed issue counts for each scanned page', { align: 'center' })
    .moveDown(1.5);

  // Table configuration
  const tableTop = doc.y;
  const rowHeight = 35;
  const colWidths = {
    url: 220,
    critical: 55,
    serious: 55,
    moderate: 60,
    minor: 45,
    total: 50,
  };

  // Table header
  let currentY = tableTop;
  doc.fontSize(FONTS.small).font('Helvetica-Bold');

  // Header row background
  doc
    .rect(SPACING.margin, currentY - 5, PAGE.contentWidth, 25)
    .fillColor(COLORS.primary)
    .fillOpacity(0.1)
    .fill();

  doc.fillOpacity(1); // Reset opacity

  // Header text
  let currentX = SPACING.margin + 5;
  doc.fillColor(COLORS.text).text('URL', currentX, currentY, { width: colWidths.url, continued: false });

  currentX += colWidths.url + 5;
  doc.text('Critical', currentX, currentY, { width: colWidths.critical, align: 'center' });

  currentX += colWidths.critical + 5;
  doc.text('Serious', currentX, currentY, { width: colWidths.serious, align: 'center' });

  currentX += colWidths.serious + 5;
  doc.text('Moderate', currentX, currentY, { width: colWidths.moderate, align: 'center' });

  currentX += colWidths.moderate + 5;
  doc.text('Minor', currentX, currentY, { width: colWidths.minor, align: 'center' });

  currentX += colWidths.minor + 5;
  doc.text('Total', currentX, currentY, { width: colWidths.total, align: 'center' });

  doc.font('Helvetica'); // Reset font
  currentY += 25;

  // Table rows
  urlBreakdowns.forEach((breakdown, index) => {
    ensureSpace(doc, rowHeight + 10);

    // Alternate row background
    if (index % 2 === 0) {
      doc
        .rect(SPACING.margin, currentY - 5, PAGE.contentWidth, rowHeight)
        .fillColor(COLORS.textSecondary)
        .fillOpacity(0.05)
        .fill();
      doc.fillOpacity(1);
    }

    // Sanitize and truncate URL
    const sanitizedUrl = sanitizeUrl(breakdown.url);
    const displayUrl = truncateText(sanitizedUrl, 45);

    // URL column
    currentX = SPACING.margin + 5;
    doc
      .fontSize(FONTS.small)
      .fillColor(COLORS.primary)
      .text(displayUrl, currentX, currentY, {
        width: colWidths.url,
        continued: false,
        link: sanitizedUrl,
      });

    // Page title (if available)
    if (breakdown.pageTitle) {
      const sanitizedTitle = sanitizeText(breakdown.pageTitle);
      doc
        .fontSize(FONTS.small - 1)
        .fillColor(COLORS.textSecondary)
        .text(truncateText(sanitizedTitle, 40), currentX, currentY + 12, { width: colWidths.url });
    }

    // Issue counts
    currentX = SPACING.margin + colWidths.url + 10;

    // Critical
    doc
      .fontSize(FONTS.small)
      .fillColor(breakdown.summary.critical > 0 ? COLORS.critical : COLORS.textSecondary)
      .font(breakdown.summary.critical > 0 ? 'Helvetica-Bold' : 'Helvetica')
      .text(breakdown.summary.critical.toString(), currentX, currentY + 6, {
        width: colWidths.critical,
        align: 'center',
      });

    currentX += colWidths.critical + 5;

    // Serious
    doc
      .fillColor(breakdown.summary.serious > 0 ? COLORS.serious : COLORS.textSecondary)
      .font(breakdown.summary.serious > 0 ? 'Helvetica-Bold' : 'Helvetica')
      .text(breakdown.summary.serious.toString(), currentX, currentY + 6, {
        width: colWidths.serious,
        align: 'center',
      });

    currentX += colWidths.serious + 5;

    // Moderate
    doc
      .fillColor(breakdown.summary.moderate > 0 ? COLORS.moderate : COLORS.textSecondary)
      .font(breakdown.summary.moderate > 0 ? 'Helvetica-Bold' : 'Helvetica')
      .text(breakdown.summary.moderate.toString(), currentX, currentY + 6, {
        width: colWidths.moderate,
        align: 'center',
      });

    currentX += colWidths.moderate + 5;

    // Minor
    doc
      .fillColor(breakdown.summary.minor > 0 ? COLORS.minor : COLORS.textSecondary)
      .font(breakdown.summary.minor > 0 ? 'Helvetica-Bold' : 'Helvetica')
      .text(breakdown.summary.minor.toString(), currentX, currentY + 6, {
        width: colWidths.minor,
        align: 'center',
      });

    currentX += colWidths.minor + 5;

    // Total
    doc
      .fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .text(breakdown.summary.totalIssues.toString(), currentX, currentY + 6, {
        width: colWidths.total,
        align: 'center',
      });

    doc.font('Helvetica'); // Reset font
    currentY += rowHeight;
    doc.y = currentY;
  });

  doc.moveDown(1);
}

/**
 * Add detailed issues section organized by URL
 *
 * Shows all issues for each URL, organized by severity.
 * Similar to single scan PDF but grouped by URL.
 * Requirement 4.3: Detailed issues section organized by URL
 * Requirement 4.6: HTML sanitization for XSS prevention
 */
function addDetailedIssuesByUrl(doc: PDFDocumentInstance, urlBreakdowns: UrlBreakdown[]): void {
  addHeader(doc, 'Detailed Issues by URL');

  doc
    .fontSize(FONTS.body)
    .fillColor(COLORS.textSecondary)
    .text('Complete list of accessibility issues organized by page', { align: 'center' })
    .moveDown(1.5);

  urlBreakdowns.forEach((breakdown, urlIndex) => {
    // Add page break before each URL (except first)
    if (urlIndex > 0) {
      doc.addPage();
    }

    // URL heading
    ensureSpace(doc, 80);

    const sanitizedUrl = sanitizeUrl(breakdown.url);
    const displayUrl = truncateText(sanitizedUrl, 70);

    doc
      .fontSize(FONTS.heading)
      .fillColor(COLORS.primary)
      .text(displayUrl, { link: sanitizedUrl, underline: true });

    doc.moveDown(0.3);

    // Page title (if available)
    if (breakdown.pageTitle) {
      const sanitizedTitle = sanitizeText(breakdown.pageTitle);
      doc.fontSize(FONTS.body).fillColor(COLORS.textSecondary).text(sanitizedTitle);
      doc.moveDown(0.5);
    }

    // Issue summary for this URL
    doc
      .fontSize(FONTS.body)
      .fillColor(COLORS.text)
      .text(`Total Issues: ${breakdown.summary.totalIssues}`, { continued: true })
      .fillColor(COLORS.textSecondary)
      .text(` | Passed: ${breakdown.summary.passed}`);

    doc.moveDown(1);

    addDivider(doc);

    // Issues by severity
    const severities = ['critical', 'serious', 'moderate', 'minor'] as const;

    for (const severity of severities) {
      const issues = breakdown.issuesByImpact[severity];

      if (issues.length === 0) {
        continue;
      }

      ensureSpace(doc, 100);

      const severityConfig = SEVERITY_CONFIG[severity];
      addSectionHeading(
        doc,
        `${severityConfig?.label ?? severity.toUpperCase()} ISSUES (${issues.length})`,
        true
      );

      issues.forEach((issue, index) => {
        addSanitizedIssueDetail(doc, issue, index + 1);
      });

      doc.moveDown(1);
    }
  });
}

/**
 * Add detailed information for a single issue with HTML sanitization
 *
 * Similar to addIssueDetail from pdf-generator.ts but with sanitization
 * Requirement 4.6: Sanitize HTML content for XSS prevention
 */
function addSanitizedIssueDetail(
  doc: PDFDocumentInstance,
  issue: EnrichedIssue,
  issueNumber: number
): void {
  ensureSpace(doc, 150);

  const config = SEVERITY_CONFIG[issue.impact.toLowerCase()] ?? { label: 'UNKNOWN', color: COLORS.text };

  // Issue number and rule ID
  doc
    .fontSize(FONTS.subheading)
    .fillColor(config.color)
    .text(`${issueNumber}. ${sanitizeText(issue.ruleId)}`, { continued: false });

  doc.moveDown(0.3);

  // Sanitized description
  const sanitizedDescription = sanitizeText(issue.description);
  doc.fontSize(FONTS.body).fillColor(COLORS.text).text(sanitizedDescription, { width: PAGE.contentWidth });

  doc.moveDown(0.5);

  // Sanitized HTML snippet
  if (issue.htmlSnippet) {
    const sanitizedHtml = sanitizeHtml(issue.htmlSnippet);
    doc
      .fontSize(FONTS.small)
      .fillColor(COLORS.textSecondary)
      .text('Element:', { continued: true })
      .fillColor(COLORS.text)
      .text(` ${truncateText(sanitizedHtml, 80)}`);

    doc.moveDown(0.3);
  }

  // WCAG criteria (sanitize array items)
  if (issue.wcagCriteria && issue.wcagCriteria.length > 0) {
    const sanitizedCriteria = issue.wcagCriteria.map(sanitizeText);
    doc
      .fontSize(FONTS.small)
      .fillColor(COLORS.textSecondary)
      .text('WCAG:', { continued: true })
      .fillColor(COLORS.text)
      .text(` ${sanitizedCriteria.join(', ')}`);

    doc.moveDown(0.3);
  }

  // Sanitized help URL
  if (issue.helpUrl) {
    const sanitizedUrl = sanitizeUrl(issue.helpUrl);
    doc
      .fontSize(FONTS.small)
      .fillColor(COLORS.textSecondary)
      .text('Learn more:', { continued: true })
      .fillColor(COLORS.primary)
      .text(` ${sanitizedUrl}`, { link: sanitizedUrl });

    doc.moveDown(0.5);
  }

  // Fix guide with sanitization
  if (issue.fixGuide) {
    addSanitizedFixGuide(doc, issue);
  } else if (issue.helpText) {
    const sanitizedHelpText = sanitizeText(issue.helpText);
    doc.fontSize(FONTS.small).fillColor(COLORS.textSecondary).text('How to Fix:', { underline: true });

    doc
      .fontSize(FONTS.small)
      .fillColor(COLORS.text)
      .text(sanitizedHelpText, { width: PAGE.contentWidth - 20, indent: 10 });

    doc.moveDown(0.5);
  }

  doc.moveDown(0.8);
}

/**
 * Add fix guide section with HTML sanitization
 *
 * Requirement 4.6: Sanitize all user-provided content
 */
function addSanitizedFixGuide(doc: PDFDocumentInstance, issue: EnrichedIssue): void {
  if (!issue.fixGuide) return;

  const guide = issue.fixGuide;

  // Sanitized summary
  doc.fontSize(FONTS.small).fillColor(COLORS.textSecondary).text('Fix Summary:', { underline: true });

  const sanitizedSummary = sanitizeText(guide.summary);
  doc
    .fontSize(FONTS.small)
    .fillColor(COLORS.text)
    .text(sanitizedSummary, { width: PAGE.contentWidth - 20, indent: 10 });

  doc.moveDown(0.3);

  // Sanitized steps
  if (guide.steps && guide.steps.length > 0) {
    doc.fontSize(FONTS.small).fillColor(COLORS.textSecondary).text('Steps to Fix:', { underline: true });

    guide.steps.forEach((step, index) => {
      const sanitizedStep = sanitizeText(step);
      doc
        .fontSize(FONTS.small)
        .fillColor(COLORS.text)
        .text(`${index + 1}. ${sanitizedStep}`, { width: PAGE.contentWidth - 30, indent: 10 });
    });

    doc.moveDown(0.3);
  }

  // Sanitized code example
  if (guide.codeExample) {
    ensureSpace(doc, 80);

    doc.fontSize(FONTS.small).fillColor(COLORS.textSecondary).text('Code Example:', { underline: true });

    // Before
    doc.fontSize(FONTS.small).fillColor(COLORS.critical).text('Before:', { indent: 10 });

    const sanitizedBefore = sanitizeHtml(guide.codeExample.before);
    doc
      .font('Courier')
      .fontSize(FONTS.small)
      .fillColor(COLORS.text)
      .text(truncateText(sanitizedBefore, 150), { indent: 15 });

    // After
    doc.font('Helvetica').fontSize(FONTS.small).fillColor(COLORS.success).text('After:', { indent: 10 });

    const sanitizedAfter = sanitizeHtml(guide.codeExample.after);
    doc
      .font('Courier')
      .fontSize(FONTS.small)
      .fillColor(COLORS.text)
      .text(truncateText(sanitizedAfter, 150), { indent: 15 });

    doc.font('Helvetica'); // Reset font
    doc.moveDown(0.3);
  }

  // Sanitized WCAG link
  if (guide.wcagLink) {
    const sanitizedWcagLink = sanitizeUrl(guide.wcagLink);
    doc
      .fontSize(FONTS.small)
      .fillColor(COLORS.textSecondary)
      .text('WCAG Reference:', { continued: true })
      .fillColor(COLORS.primary)
      .text(` ${sanitizedWcagLink}`, { link: sanitizedWcagLink });

    doc.moveDown(0.5);
  }
}

/**
 * Add transparency disclaimer footer
 *
 * Adds a disclaimer about automated testing limitations to the last page.
 * Requirement 4.6: Add transparency disclaimer footer about automated testing limitations
 */
function addTransparencyDisclaimer(doc: PDFDocumentInstance): void {
  ensureSpace(doc, 100);

  addDivider(doc);

  addSectionHeading(doc, 'Testing Transparency');

  const disclaimerText =
    'This report is generated by automated accessibility testing tools (axe-core). ' +
    'Automated testing can only detect approximately 30-40% of WCAG issues. ' +
    'Many accessibility barriers require human judgment to identify, including:\n\n' +
    '• Keyboard navigation usability\n' +
    '• Screen reader experience quality\n' +
    '• Color contrast in context\n' +
    '• Content clarity and comprehension\n' +
    '• Logical heading and landmark structure\n\n' +
    'For comprehensive WCAG compliance, manual testing by accessibility experts is essential. ' +
    'This report should be used as a starting point to identify and fix common issues, ' +
    'not as a complete compliance certification.';

  addDisclaimerBox(doc, disclaimerText);
}

/**
 * Sanitize plain text to prevent injection attacks
 *
 * Removes potentially dangerous characters while preserving readability.
 * Used for descriptions, titles, and other text content.
 */
function sanitizeText(text: string): string {
  if (!text || text.trim().length === 0) {
    return '';
  }

  // Remove null bytes and other control characters
  return text
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Sanitize URLs to prevent injection attacks
 *
 * Validates URL format and removes dangerous protocols.
 * Used for all URL fields in the PDF.
 */
function sanitizeUrl(url: string): string {
  if (!url || url.trim().length === 0) {
    return '';
  }

  // Remove dangerous protocols
  const sanitized = url.trim().replace(/^(javascript|data|vbscript|file):/i, 'blocked:');

  // Validate URL format
  try {
    new URL(sanitized);
    return sanitized;
  } catch {
    // If URL is invalid, return a safe representation
    return sanitizeText(url);
  }
}

/**
 * Export batch PDF report (generate buffer and key)
 *
 * Matches the signature of exportBatchJson for consistent API.
 *
 * @param input - Batch data for PDF generation
 * @returns Promise resolving to buffer and S3 key
 */
export async function exportBatchPdf(
  input: BatchPdfInput
): Promise<{ buffer: Buffer; key: string }> {
  const buffer = await generateBatchPdfReport(input);

  // Generate S3 key path: reports/batch-{batchId}/report.pdf
  const key = `reports/batch-${input.metadata.batchId}/report.pdf`;

  return { buffer, key };
}

/**
 * Upload PDF buffer to S3 and return the storage URL
 *
 * @param buffer - PDF buffer to upload
 * @param key - S3 object key
 * @returns Promise resolving to storage URL
 */
export async function uploadBatchPdfToS3(buffer: Buffer, key: string): Promise<string> {
  const { uploadToS3, CONTENT_TYPES, ensureBucketExists } = await import('@adashield/core/storage');

  // Ensure bucket exists before uploading
  await ensureBucketExists();

  console.log(`[Batch-PDF-Generator] Uploading ${buffer.length} bytes to S3 key: ${key}`);
  const url = await uploadToS3(buffer, key, CONTENT_TYPES.pdf);
  console.log(`[Batch-PDF-Generator] Upload complete: ${url}`);

  return url;
}

/**
 * Generate batch PDF report and upload to S3
 *
 * @param input - Batch data for PDF generation
 * @param batchId - Batch identifier for S3 key
 * @returns Promise resolving to presigned URL
 *
 * @example
 * ```typescript
 * const input = { metadata, aggregate, topCriticalUrls };
 * const reportUrl = await generateAndUploadBatchReport(input, 'batch-123');
 * console.log(`Report available at: ${reportUrl}`);
 * ```
 */
export async function generateAndUploadBatchReport(
  input: BatchPdfInput,
  batchId: string
): Promise<string> {
  const buffer = await generateBatchPdfReport(input);
  const key = `reports/batch-${batchId}.pdf`;
  return uploadBatchPdfToS3(buffer, key);
}
