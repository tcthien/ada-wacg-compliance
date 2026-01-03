/**
 * Email Templates
 *
 * Provides email content generation for scan notifications.
 * Includes both HTML and plain text versions for better email client compatibility.
 */

/**
 * Data for scan completion email
 */
export interface ScanCompleteEmailData {
  url: string;
  issueCount: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  resultsUrl: string;
}

/**
 * Data for scan failure email
 */
export interface ScanFailedEmailData {
  url: string;
  error: string;
}

/**
 * Email content structure
 */
export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * Data for batch scan completion email
 */
export interface BatchCompleteEmailData {
  /** The homepage/primary URL of the batch scan */
  homepageUrl: string;
  /** Total number of URLs scanned in the batch */
  totalUrls: number;
  /** Number of URLs that completed successfully */
  completedCount: number;
  /** Number of URLs that failed to scan */
  failedCount: number;
  /** Total number of accessibility issues found across all URLs */
  totalIssues: number;
  /** Number of critical severity issues */
  criticalCount: number;
  /** Number of serious severity issues */
  seriousCount: number;
  /** Number of moderate severity issues */
  moderateCount: number;
  /** Number of minor severity issues */
  minorCount: number;
  /** Number of accessibility checks that passed */
  passedChecks: number;
  /** URLs with the most critical issues, sorted by count */
  topCriticalUrls: Array<{ url: string; criticalCount: number }>;
  /** URL to view the full batch results */
  resultsUrl: string;
  /** URL to download the PDF report (optional) */
  pdfReportUrl?: string;
}

/**
 * Data for AI-enhanced scan completion email
 * Extends the basic scan complete data with AI-generated insights
 */
export interface AiScanCompleteEmailData extends ScanCompleteEmailData {
  /** AI-generated summary of the scan results */
  aiSummary: string;
  /** Top priority fixes recommended by AI */
  topPriorityFixes: Array<{
    issue: string;
    impact: string;
    wcagCriteria: string;
  }>;
  /** Estimated time to fix the issues (in hours) */
  estimatedFixTime: number;
  /** Preview of remediation code/guidance */
  remediationPreview: string;
}

/**
 * Generate scan completion email
 *
 * @param data - Scan completion data
 * @returns Email content with subject, HTML, and text versions
 */
export function getScanCompleteEmail(data: ScanCompleteEmailData): EmailContent {
  const {
    url,
    issueCount,
    criticalCount,
    seriousCount,
    moderateCount,
    minorCount,
    resultsUrl,
  } = data;

  const subject = `Your accessibility scan is complete - ${issueCount} issue${issueCount !== 1 ? 's' : ''} found`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scan Complete</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h1 style="color: #2c3e50; margin: 0 0 16px 0; font-size: 24px;">Accessibility Scan Complete</h1>
    <p style="margin: 0; font-size: 16px;">Your accessibility scan of <strong>${escapeHtml(url)}</strong> has finished.</p>
  </div>

  <div style="background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h2 style="color: #2c3e50; margin: 0 0 16px 0; font-size: 20px;">Summary</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-size: 16px;">Total Issues:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right;">${issueCount}</td>
      </tr>
      ${criticalCount > 0 ? `
      <tr>
        <td style="padding: 8px 0; font-size: 16px; color: #dc3545;">Critical Issues:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #dc3545;">${criticalCount}</td>
      </tr>
      ` : ''}
      ${seriousCount > 0 ? `
      <tr>
        <td style="padding: 8px 0; font-size: 16px; color: #fd7e14;">Serious Issues:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #fd7e14;">${seriousCount}</td>
      </tr>
      ` : ''}
      ${moderateCount > 0 ? `
      <tr>
        <td style="padding: 8px 0; font-size: 16px; color: #ffc107;">Moderate Issues:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #ffc107;">${moderateCount}</td>
      </tr>
      ` : ''}
      ${minorCount > 0 ? `
      <tr>
        <td style="padding: 8px 0; font-size: 16px; color: #6c757d;">Minor Issues:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #6c757d;">${minorCount}</td>
      </tr>
      ` : ''}
    </table>

    <div style="margin-top: 24px; text-align: center;">
      <a href="${escapeHtml(resultsUrl)}"
         style="display: inline-block; background-color: #007bff; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
        View Full Results
      </a>
    </div>
  </div>

  <div style="border-top: 1px solid #dee2e6; padding-top: 16px; color: #6c757d; font-size: 14px;">
    <p style="margin: 0 0 8px 0;">This email was sent by ADAShield.</p>
    <p style="margin: 0;">Your email address has been deleted from our systems in compliance with GDPR.</p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Accessibility Scan Complete

Your accessibility scan of ${url} has finished.

Summary:
- Total Issues: ${issueCount}
${criticalCount > 0 ? `- Critical Issues: ${criticalCount}\n` : ''}${seriousCount > 0 ? `- Serious Issues: ${seriousCount}\n` : ''}${moderateCount > 0 ? `- Moderate Issues: ${moderateCount}\n` : ''}${minorCount > 0 ? `- Minor Issues: ${minorCount}\n` : ''}
View Full Results: ${resultsUrl}

---
This email was sent by ADAShield.
Your email address has been deleted from our systems in compliance with GDPR.
  `.trim();

  return { subject, html, text };
}

/**
 * Generate scan failure email
 *
 * @param data - Scan failure data
 * @returns Email content with subject, HTML, and text versions
 */
export function getScanFailedEmail(data: ScanFailedEmailData): EmailContent {
  const { url, error } = data;

  const subject = `Your accessibility scan failed`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scan Failed</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h1 style="color: #856404; margin: 0 0 16px 0; font-size: 24px;">Accessibility Scan Failed</h1>
    <p style="margin: 0; font-size: 16px; color: #856404;">Unfortunately, your accessibility scan of <strong>${escapeHtml(url)}</strong> encountered an error.</p>
  </div>

  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h2 style="color: #2c3e50; margin: 0 0 16px 0; font-size: 20px;">Error Details</h2>
    <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 14px; color: #dc3545; background-color: #fff; padding: 16px; border-radius: 4px; border: 1px solid #dee2e6;">
      ${escapeHtml(error)}
    </p>
  </div>

  <div style="background-color: #e7f3ff; border-left: 4px solid #007bff; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h2 style="color: #004085; margin: 0 0 16px 0; font-size: 20px;">What You Can Do</h2>
    <ul style="margin: 0; padding-left: 20px; color: #004085;">
      <li style="margin-bottom: 8px;">Verify that the URL is accessible and publicly available</li>
      <li style="margin-bottom: 8px;">Check if the website is behind authentication or a firewall</li>
      <li style="margin-bottom: 8px;">Try scanning again in a few minutes</li>
      <li>Contact support if the issue persists</li>
    </ul>
  </div>

  <div style="border-top: 1px solid #dee2e6; padding-top: 16px; color: #6c757d; font-size: 14px;">
    <p style="margin: 0 0 8px 0;">This email was sent by ADAShield.</p>
    <p style="margin: 0;">Your email address has been deleted from our systems in compliance with GDPR.</p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Accessibility Scan Failed

Unfortunately, your accessibility scan of ${url} encountered an error.

Error Details:
${error}

What You Can Do:
- Verify that the URL is accessible and publicly available
- Check if the website is behind authentication or a firewall
- Try scanning again in a few minutes
- Contact support if the issue persists

---
This email was sent by ADAShield.
Your email address has been deleted from our systems in compliance with GDPR.
  `.trim();

  return { subject, html, text };
}

/**
 * Generate batch scan completion email
 *
 * @param data - Batch scan completion data
 * @returns Email content with subject, HTML, and text versions
 */
export function getBatchCompleteEmail(data: BatchCompleteEmailData): EmailContent {
  const {
    homepageUrl,
    totalUrls,
    completedCount,
    failedCount,
    totalIssues,
    criticalCount,
    seriousCount,
    moderateCount,
    minorCount,
    passedChecks,
    topCriticalUrls,
    resultsUrl,
    pdfReportUrl,
  } = data;

  const subject = `Batch scan complete: ${totalUrls} URLs scanned - ${totalIssues} issue${totalIssues !== 1 ? 's' : ''} found`;

  // Build top critical URLs HTML list (up to 5)
  const topUrlsHtml = topCriticalUrls.length > 0
    ? `
    <div style="background-color: #fff5f5; border: 1px solid #dc3545; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
      <h2 style="color: #dc3545; margin: 0 0 16px 0; font-size: 20px;">URLs with Most Critical Issues</h2>
      <ul style="margin: 0; padding-left: 20px; color: #333;">
        ${topCriticalUrls.slice(0, 5).map(item => `
        <li style="margin-bottom: 8px;">
          <span style="font-weight: bold; color: #dc3545;">${item.criticalCount}</span> critical issue${item.criticalCount !== 1 ? 's' : ''}:
          <a href="${escapeHtml(item.url)}" style="color: #007bff; text-decoration: none;">${escapeHtml(truncateUrl(item.url, 60))}</a>
        </li>
        `).join('')}
      </ul>
    </div>
    `
    : '';

  // Build download PDF button if available
  const pdfButtonHtml = pdfReportUrl
    ? `
      <a href="${escapeHtml(pdfReportUrl)}"
         style="display: inline-block; background-color: #28a745; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; margin-left: 16px;">
        Download PDF Report
      </a>
    `
    : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Batch Scan Complete</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h1 style="color: #2c3e50; margin: 0 0 16px 0; font-size: 24px;">Batch Accessibility Scan Complete</h1>
    <p style="margin: 0; font-size: 16px;">Your batch accessibility scan of <strong>${escapeHtml(homepageUrl)}</strong> has finished.</p>
    <p style="margin: 8px 0 0 0; font-size: 14px; color: #6c757d;">Scanned ${totalUrls} URL${totalUrls !== 1 ? 's' : ''}</p>
  </div>

  <div style="background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h2 style="color: #2c3e50; margin: 0 0 16px 0; font-size: 20px;">Scan Summary</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-size: 16px;">URLs Scanned:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right;">${totalUrls}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-size: 16px; color: #28a745;">Completed Successfully:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #28a745;">${completedCount}</td>
      </tr>
      ${failedCount > 0 ? `
      <tr>
        <td style="padding: 8px 0; font-size: 16px; color: #dc3545;">Failed:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #dc3545;">${failedCount}</td>
      </tr>
      ` : ''}
    </table>
  </div>

  <div style="background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h2 style="color: #2c3e50; margin: 0 0 16px 0; font-size: 20px;">Aggregate Issue Breakdown</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-size: 16px;">Total Issues:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right;">${totalIssues}</td>
      </tr>
      ${criticalCount > 0 ? `
      <tr>
        <td style="padding: 8px 0; font-size: 16px; color: #dc3545;">Critical Issues:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #dc3545;">${criticalCount}</td>
      </tr>
      ` : ''}
      ${seriousCount > 0 ? `
      <tr>
        <td style="padding: 8px 0; font-size: 16px; color: #fd7e14;">Serious Issues:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #fd7e14;">${seriousCount}</td>
      </tr>
      ` : ''}
      ${moderateCount > 0 ? `
      <tr>
        <td style="padding: 8px 0; font-size: 16px; color: #ffc107;">Moderate Issues:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #ffc107;">${moderateCount}</td>
      </tr>
      ` : ''}
      ${minorCount > 0 ? `
      <tr>
        <td style="padding: 8px 0; font-size: 16px; color: #6c757d;">Minor Issues:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #6c757d;">${minorCount}</td>
      </tr>
      ` : ''}
      <tr>
        <td style="padding: 8px 0; font-size: 16px; color: #28a745;">Passed Checks:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #28a745;">${passedChecks}</td>
      </tr>
    </table>
  </div>

  ${topUrlsHtml}

  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${escapeHtml(resultsUrl)}"
       style="display: inline-block; background-color: #007bff; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
      View Full Results
    </a>
    ${pdfButtonHtml}
  </div>

  <div style="border-top: 1px solid #dee2e6; padding-top: 16px; color: #6c757d; font-size: 14px;">
    <p style="margin: 0 0 8px 0;">This email was sent by ADAShield.</p>
    <p style="margin: 0;">Your email address has been deleted from our systems in compliance with GDPR.</p>
  </div>
</body>
</html>
  `.trim();

  // Build top critical URLs plain text list
  const topUrlsText = topCriticalUrls.length > 0
    ? `
URLs with Most Critical Issues:
${topCriticalUrls.slice(0, 5).map(item => `- ${item.criticalCount} critical issue${item.criticalCount !== 1 ? 's' : ''}: ${item.url}`).join('\n')}
`
    : '';

  const text = `
Batch Accessibility Scan Complete

Your batch accessibility scan of ${homepageUrl} has finished.
Scanned ${totalUrls} URL${totalUrls !== 1 ? 's' : ''}

Scan Summary:
- URLs Scanned: ${totalUrls}
- Completed Successfully: ${completedCount}
${failedCount > 0 ? `- Failed: ${failedCount}\n` : ''}
Aggregate Issue Breakdown:
- Total Issues: ${totalIssues}
${criticalCount > 0 ? `- Critical Issues: ${criticalCount}\n` : ''}${seriousCount > 0 ? `- Serious Issues: ${seriousCount}\n` : ''}${moderateCount > 0 ? `- Moderate Issues: ${moderateCount}\n` : ''}${minorCount > 0 ? `- Minor Issues: ${minorCount}\n` : ''}- Passed Checks: ${passedChecks}
${topUrlsText}
View Full Results: ${resultsUrl}
${pdfReportUrl ? `Download PDF Report: ${pdfReportUrl}\n` : ''}
---
This email was sent by ADAShield.
Your email address has been deleted from our systems in compliance with GDPR.
  `.trim();

  return { subject, html, text };
}

/**
 * Generate AI-enhanced scan completion email
 *
 * @param data - AI scan completion data
 * @returns Email content with subject, HTML, and text versions
 */
export function getAiScanCompleteEmail(data: AiScanCompleteEmailData): EmailContent {
  const {
    url,
    issueCount,
    criticalCount,
    seriousCount,
    moderateCount,
    minorCount,
    resultsUrl,
    aiSummary,
    topPriorityFixes,
    estimatedFixTime,
    remediationPreview,
  } = data;

  const subject = `AI-Enhanced Scan Complete - ${issueCount} issue${issueCount !== 1 ? 's' : ''} found`;

  // Build top priority fixes HTML list
  const topFixesHtml = topPriorityFixes.length > 0
    ? `
    <div style="background-color: #f0f8ff; border: 1px solid #007bff; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; margin-bottom: 16px;">
        <span style="background-color: #007bff; color: #ffffff; font-weight: bold; font-size: 12px; padding: 4px 8px; border-radius: 4px; margin-right: 8px;">AI</span>
        <h2 style="color: #007bff; margin: 0; font-size: 20px;">Top Priority Fixes</h2>
      </div>
      <ul style="margin: 0; padding-left: 20px; color: #333;">
        ${topPriorityFixes.map(fix => `
        <li style="margin-bottom: 16px;">
          <div style="font-weight: bold; color: #2c3e50; margin-bottom: 4px;">${escapeHtml(fix.issue)}</div>
          <div style="font-size: 14px; color: #6c757d; margin-bottom: 4px;">Impact: ${escapeHtml(fix.impact)}</div>
          <div style="font-size: 14px; color: #6c757d;">
            <span style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 12px;">${escapeHtml(fix.wcagCriteria)}</span>
          </div>
        </li>
        `).join('')}
      </ul>
    </div>
    `
    : '';

  // Build remediation preview HTML
  const remediationHtml = remediationPreview
    ? `
    <div style="background-color: #f0f8ff; border: 1px solid #007bff; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; margin-bottom: 16px;">
        <span style="background-color: #007bff; color: #ffffff; font-weight: bold; font-size: 12px; padding: 4px 8px; border-radius: 4px; margin-right: 8px;">AI</span>
        <h2 style="color: #007bff; margin: 0; font-size: 20px;">Remediation Preview</h2>
      </div>
      <div style="background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 4px; padding: 16px; font-family: 'Courier New', monospace; font-size: 14px; color: #333; white-space: pre-wrap; overflow-x: auto;">
${escapeHtml(remediationPreview)}
      </div>
      <p style="margin: 12px 0 0 0; font-size: 14px; color: #6c757d;">
        View the full report for complete remediation guidance.
      </p>
    </div>
    `
    : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI-Enhanced Scan Complete</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <div style="display: flex; align-items: center; margin-bottom: 16px;">
      <span style="background-color: #007bff; color: #ffffff; font-weight: bold; font-size: 12px; padding: 4px 8px; border-radius: 4px; margin-right: 8px;">AI-ENHANCED</span>
    </div>
    <h1 style="color: #2c3e50; margin: 0 0 16px 0; font-size: 24px;">Accessibility Scan Complete</h1>
    <p style="margin: 0; font-size: 16px;">Your AI-enhanced accessibility scan of <strong>${escapeHtml(url)}</strong> has finished.</p>
  </div>

  <div style="background-color: #f0f8ff; border-left: 4px solid #007bff; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <div style="display: flex; align-items: center; margin-bottom: 12px;">
      <span style="background-color: #007bff; color: #ffffff; font-weight: bold; font-size: 12px; padding: 4px 8px; border-radius: 4px; margin-right: 8px;">AI</span>
      <h2 style="color: #007bff; margin: 0; font-size: 20px;">AI Summary</h2>
    </div>
    <p style="margin: 0; font-size: 16px; color: #004085; line-height: 1.8;">
      ${escapeHtml(aiSummary)}
    </p>
  </div>

  <div style="background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h2 style="color: #2c3e50; margin: 0 0 16px 0; font-size: 20px;">Issue Summary</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-size: 16px;">Total Issues:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right;">${issueCount}</td>
      </tr>
      ${criticalCount > 0 ? `
      <tr>
        <td style="padding: 8px 0; font-size: 16px; color: #dc3545;">Critical Issues:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #dc3545;">${criticalCount}</td>
      </tr>
      ` : ''}
      ${seriousCount > 0 ? `
      <tr>
        <td style="padding: 8px 0; font-size: 16px; color: #fd7e14;">Serious Issues:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #fd7e14;">${seriousCount}</td>
      </tr>
      ` : ''}
      ${moderateCount > 0 ? `
      <tr>
        <td style="padding: 8px 0; font-size: 16px; color: #ffc107;">Moderate Issues:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #ffc107;">${moderateCount}</td>
      </tr>
      ` : ''}
      ${minorCount > 0 ? `
      <tr>
        <td style="padding: 8px 0; font-size: 16px; color: #6c757d;">Minor Issues:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #6c757d;">${minorCount}</td>
      </tr>
      ` : ''}
      <tr style="border-top: 2px solid #dee2e6;">
        <td style="padding: 8px 0; font-size: 16px; color: #007bff; font-weight: bold;">Estimated Fix Time:</td>
        <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #007bff;">~${estimatedFixTime} hour${estimatedFixTime !== 1 ? 's' : ''}</td>
      </tr>
    </table>
  </div>

  ${topFixesHtml}

  ${remediationHtml}

  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${escapeHtml(resultsUrl)}"
       style="display: inline-block; background-color: #007bff; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
      View Full AI Report
    </a>
  </div>

  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <p style="margin: 0; font-size: 14px; color: #856404;">
      <strong>Note:</strong> AI-generated insights are provided to help prioritize fixes. Always verify recommendations against WCAG guidelines and test with real users and assistive technologies.
    </p>
  </div>

  <div style="border-top: 1px solid #dee2e6; padding-top: 16px; color: #6c757d; font-size: 14px;">
    <p style="margin: 0 0 8px 0;">This email was sent by ADAShield.</p>
    <p style="margin: 0;">Your email address has been deleted from our systems in compliance with GDPR.</p>
  </div>
</body>
</html>
  `.trim();

  // Build top priority fixes plain text list
  const topFixesText = topPriorityFixes.length > 0
    ? `
[AI] Top Priority Fixes:
${topPriorityFixes.map((fix, index) => `${index + 1}. ${fix.issue}
   Impact: ${fix.impact}
   WCAG: ${fix.wcagCriteria}`).join('\n')}
`
    : '';

  // Build remediation preview plain text
  const remediationText = remediationPreview
    ? `
[AI] Remediation Preview:
${remediationPreview}

View the full report for complete remediation guidance.
`
    : '';

  const text = `
AI-Enhanced Accessibility Scan Complete

Your AI-enhanced accessibility scan of ${url} has finished.

[AI] AI Summary:
${aiSummary}

Issue Summary:
- Total Issues: ${issueCount}
${criticalCount > 0 ? `- Critical Issues: ${criticalCount}\n` : ''}${seriousCount > 0 ? `- Serious Issues: ${seriousCount}\n` : ''}${moderateCount > 0 ? `- Moderate Issues: ${moderateCount}\n` : ''}${minorCount > 0 ? `- Minor Issues: ${minorCount}\n` : ''}- Estimated Fix Time: ~${estimatedFixTime} hour${estimatedFixTime !== 1 ? 's' : ''}
${topFixesText}${remediationText}
View Full AI Report: ${resultsUrl}

Note: AI-generated insights are provided to help prioritize fixes. Always verify recommendations against WCAG guidelines and test with real users and assistive technologies.

---
This email was sent by ADAShield.
Your email address has been deleted from our systems in compliance with GDPR.
  `.trim();

  return { subject, html, text };
}

/**
 * Truncate URL for display purposes
 *
 * @param url - URL to truncate
 * @param maxLength - Maximum length (default 60)
 * @returns Truncated URL with ellipsis if needed
 */
function truncateUrl(url: string, maxLength: number = 60): string {
  if (url.length <= maxLength) {
    return url;
  }
  return url.substring(0, maxLength - 3) + '...';
}

/**
 * Escape HTML special characters to prevent XSS
 *
 * @param text - Text to escape
 * @returns Escaped text
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] ?? char);
}
