/**
 * PDF Report Generator
 *
 * Generates branded accessibility reports in PDF format using PDFKit.
 * Creates comprehensive reports with scan summaries, issue listings,
 * fix recommendations, and WCAG compliance information.
 */

import PDFDocument from 'pdfkit';
import type { FormattedResult, EnrichedIssue } from '../../utils/result-formatter.js';
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
  addDisclaimerBox,
  addFooter,
  formatDate,
  formatDuration,
  truncateText,
  ensureSpace,
  type PDFDocumentInstance,
} from './pdf-templates.js';

/**
 * Generate a PDF report buffer from formatted scan results
 *
 * @param result - Formatted scan result with enriched issues
 * @returns Promise resolving to PDF buffer
 *
 * @example
 * ```typescript
 * const result = await getFormattedResult('scan-123');
 * const pdfBuffer = await generatePdfReport(result);
 * await uploadToS3(pdfBuffer, 'reports/scan-123.pdf');
 * ```
 */
export async function generatePdfReport(result: FormattedResult): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Enable bufferPages to allow adding footers after all content is placed
      const doc = new PDFDocument({ margin: SPACING.margin, size: 'LETTER', bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Page 1: Header and Summary
      addReportHeader(doc, result);
      addScanInformation(doc, result);
      addDivider(doc);
      addSummarySection(doc, result);
      addDivider(doc);
      addCoverageDisclaimer(doc, result.metadata.coverageNote);

      // Page 2+: Issues by severity
      doc.addPage();
      addIssuesSection(doc, result);

      // Now add footers to all pages using bufferedPageRange
      // This allows us to go back and add footers after all content is placed
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
 * Add the main report header
 */
function addReportHeader(doc: PDFDocumentInstance, result: FormattedResult): void {
  addHeader(doc, 'ADAShield Accessibility Report');

  doc
    .fontSize(FONTS.body)
    .fillColor(COLORS.textSecondary)
    .text(`Report generated on ${formatDate(result.completedAt)}`, { align: 'center' })
    .moveDown(1.5);
}

/**
 * Add scan information section
 */
function addScanInformation(doc: PDFDocumentInstance, result: FormattedResult): void {
  addSectionHeading(doc, 'Scan Information');

  addInfoRow(doc, 'URL:', result.url);
  addInfoRow(doc, 'Scan ID:', result.scanId);
  addInfoRow(doc, 'WCAG Level:', result.wcagLevel);
  addInfoRow(doc, 'WCAG Version:', result.metadata.wcagVersion);
  addInfoRow(doc, 'Scan Duration:', formatDuration(result.metadata.scanDuration));
  addInfoRow(doc, 'Tool Version:', result.metadata.toolVersion);

  doc.moveDown(0.5);
}

/**
 * Add summary section with issue counts
 */
function addSummarySection(doc: PDFDocumentInstance, result: FormattedResult): void {
  addSectionHeading(doc, 'Summary', true);

  // Total issues
  doc
    .fontSize(FONTS.subheading)
    .fillColor(COLORS.text)
    .text(`Total Issues Found: `, { continued: true })
    .font('Helvetica-Bold')
    .text(result.summary.totalIssues.toString());

  doc.font('Helvetica'); // Reset font
  doc.moveDown(0.8);

  // Severity breakdown in 2x2 grid
  const startY = doc.y;
  const colWidth = PAGE.contentWidth / 2;

  // Left column
  addSeverityBadge(doc, 'critical', result.summary.critical, SPACING.margin, startY, colWidth);
  doc.y = startY + 25;
  addSeverityBadge(doc, 'moderate', result.summary.moderate, SPACING.margin, doc.y, colWidth);

  // Right column
  doc.y = startY;
  addSeverityBadge(
    doc,
    'serious',
    result.summary.serious,
    SPACING.margin + colWidth,
    doc.y,
    colWidth
  );
  doc.y += 25;
  addSeverityBadge(doc, 'minor', result.summary.minor, SPACING.margin + colWidth, doc.y, colWidth);

  doc.y += 30;
  doc.moveDown(0.5);

  // Passed checks
  doc
    .fontSize(FONTS.body)
    .fillColor(COLORS.success)
    .text('✓ ', { continued: true })
    .fillColor(COLORS.text)
    .text(`Passed Checks: `, { continued: true })
    .font('Helvetica-Bold')
    .text(result.summary.passed.toString());

  doc.font('Helvetica');
  doc.moveDown(1);
}

/**
 * Add coverage disclaimer box
 */
function addCoverageDisclaimer(doc: PDFDocumentInstance, coverageNote: string): void {
  addSectionHeading(doc, 'Important Note');
  addDisclaimerBox(doc, coverageNote);
}

/**
 * Add issues section grouped by severity
 */
function addIssuesSection(doc: PDFDocumentInstance, result: FormattedResult): void {
  const severities = ['critical', 'serious', 'moderate', 'minor'] as const;

  for (const severity of severities) {
    const issues = result.issuesByImpact[severity];

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
      addIssueDetail(doc, issue, index + 1);
    });

    doc.moveDown(1);
  }
}

/**
 * Add detailed information for a single issue
 */
function addIssueDetail(doc: PDFDocumentInstance, issue: EnrichedIssue, issueNumber: number): void {
  ensureSpace(doc, 150);

  const config = SEVERITY_CONFIG[issue.impact.toLowerCase()] ?? { label: 'UNKNOWN', color: COLORS.text };

  // Issue number and rule ID
  doc
    .fontSize(FONTS.subheading)
    .fillColor(config.color)
    .text(`${issueNumber}. ${issue.ruleId}`, { continued: false });

  doc.moveDown(0.3);

  // Description
  doc
    .fontSize(FONTS.body)
    .fillColor(COLORS.text)
    .text(issue.description, { width: PAGE.contentWidth });

  doc.moveDown(0.5);

  // Element information
  if (issue.htmlSnippet) {
    doc
      .fontSize(FONTS.small)
      .fillColor(COLORS.textSecondary)
      .text('Element:', { continued: true })
      .fillColor(COLORS.text)
      .text(` ${truncateText(issue.htmlSnippet, 80)}`);

    doc.moveDown(0.3);
  }

  // WCAG criteria
  if (issue.wcagCriteria && issue.wcagCriteria.length > 0) {
    doc
      .fontSize(FONTS.small)
      .fillColor(COLORS.textSecondary)
      .text('WCAG:', { continued: true })
      .fillColor(COLORS.text)
      .text(` ${issue.wcagCriteria.join(', ')}`);

    doc.moveDown(0.3);
  }

  // Help URL
  if (issue.helpUrl) {
    doc
      .fontSize(FONTS.small)
      .fillColor(COLORS.textSecondary)
      .text('Learn more:', { continued: true })
      .fillColor(COLORS.primary)
      .text(` ${issue.helpUrl}`, { link: issue.helpUrl });

    doc.moveDown(0.5);
  }

  // Fix guide if available
  if (issue.fixGuide) {
    addFixGuide(doc, issue);
  } else {
    // Fallback to help text
    if (issue.helpText) {
      doc
        .fontSize(FONTS.small)
        .fillColor(COLORS.textSecondary)
        .text('How to Fix:', { underline: true });

      doc
        .fontSize(FONTS.small)
        .fillColor(COLORS.text)
        .text(issue.helpText, { width: PAGE.contentWidth - 20, indent: 10 });

      doc.moveDown(0.5);
    }
  }

  doc.moveDown(0.8);
}

/**
 * Add fix guide section for an issue
 */
function addFixGuide(doc: PDFDocumentInstance, issue: EnrichedIssue): void {
  if (!issue.fixGuide) return;

  const guide = issue.fixGuide;

  // Summary
  doc
    .fontSize(FONTS.small)
    .fillColor(COLORS.textSecondary)
    .text('Fix Summary:', { underline: true });

  doc
    .fontSize(FONTS.small)
    .fillColor(COLORS.text)
    .text(guide.summary, { width: PAGE.contentWidth - 20, indent: 10 });

  doc.moveDown(0.3);

  // Steps
  if (guide.steps && guide.steps.length > 0) {
    doc
      .fontSize(FONTS.small)
      .fillColor(COLORS.textSecondary)
      .text('Steps to Fix:', { underline: true });

    guide.steps.forEach((step, index) => {
      doc
        .fontSize(FONTS.small)
        .fillColor(COLORS.text)
        .text(`${index + 1}. ${step}`, { width: PAGE.contentWidth - 30, indent: 10 });
    });

    doc.moveDown(0.3);
  }

  // Code example
  if (guide.codeExample) {
    ensureSpace(doc, 80);

    doc
      .fontSize(FONTS.small)
      .fillColor(COLORS.textSecondary)
      .text('Code Example:', { underline: true });

    // Before
    doc
      .fontSize(FONTS.small)
      .fillColor(COLORS.critical)
      .text('Before:', { indent: 10 });

    doc
      .font('Courier')
      .fontSize(FONTS.small)
      .fillColor(COLORS.text)
      .text(truncateText(guide.codeExample.before, 150), { indent: 15 });

    // After
    doc
      .font('Helvetica')
      .fontSize(FONTS.small)
      .fillColor(COLORS.success)
      .text('After:', { indent: 10 });

    doc
      .font('Courier')
      .fontSize(FONTS.small)
      .fillColor(COLORS.text)
      .text(truncateText(guide.codeExample.after, 150), { indent: 15 });

    doc.font('Helvetica'); // Reset font
    doc.moveDown(0.3);
  }

  // WCAG link
  if (guide.wcagLink) {
    doc
      .fontSize(FONTS.small)
      .fillColor(COLORS.textSecondary)
      .text('WCAG Reference:', { continued: true })
      .fillColor(COLORS.primary)
      .text(` ${guide.wcagLink}`, { link: guide.wcagLink });

    doc.moveDown(0.5);
  }
}

/**
 * Upload PDF buffer to S3 and return the storage URL
 *
 * @param buffer - PDF buffer to upload
 * @param key - S3 object key
 * @returns Promise resolving to storage URL
 */
export async function uploadToS3(buffer: Buffer, key: string): Promise<string> {
  const { uploadToS3: s3Upload, CONTENT_TYPES, ensureBucketExists } = await import('@adashield/core/storage');

  // Ensure bucket exists before uploading
  await ensureBucketExists();

  console.log(`[PDF-Generator] Uploading ${buffer.length} bytes to S3 key: ${key}`);
  const url = await s3Upload(buffer, key, CONTENT_TYPES.pdf);
  console.log(`[PDF-Generator] Upload complete: ${url}`);

  return url;
}

/**
 * Generate PDF report and upload to S3
 *
 * @param result - Formatted scan result
 * @param scanId - Scan identifier for S3 key
 * @returns Promise resolving to presigned URL
 *
 * @example
 * ```typescript
 * const result = await getFormattedResult('scan-123');
 * const reportUrl = await generateAndUploadReport(result, 'scan-123');
 * console.log(`Report available at: ${reportUrl}`);
 * ```
 */
export async function generateAndUploadReport(
  result: FormattedResult,
  scanId: string
): Promise<string> {
  const buffer = await generatePdfReport(result);
  const key = `reports/${scanId}.pdf`;
  return uploadToS3(buffer, key);
}
