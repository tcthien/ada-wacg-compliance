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
 * Escape HTML special characters to prevent XSS
 *
 * @param text - Text to escape
 * @returns Escaped text
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] ?? char);
}
