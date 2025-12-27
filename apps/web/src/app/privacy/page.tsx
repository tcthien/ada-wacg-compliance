import { MainLayout } from '@/components/layouts/MainLayout';

export default function PrivacyPage() {
  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto prose prose-slate">
        <h1>Privacy Policy</h1>
        <p className="lead">Last updated: December 2024</p>

        <h2>What Data We Collect</h2>
        <p>When you use ADAShield, we collect:</p>
        <ul>
          <li><strong>URLs you scan</strong> - Stored to show your scan history</li>
          <li><strong>Scan results</strong> - Accessibility issues found on scanned pages</li>
          <li><strong>Email (optional)</strong> - Only if you provide it for notifications, deleted immediately after sending</li>
          <li><strong>Session identifier</strong> - A random token to identify your browser session</li>
        </ul>

        <h2>How We Use Your Data</h2>
        <ul>
          <li>Display your scan history</li>
          <li>Generate accessibility reports</li>
          <li>Send email notifications (if requested)</li>
        </ul>

        <h2>Data Retention</h2>
        <p>
          Your scan data is retained for 30 days, after which it is automatically deleted.
          You can request immediate deletion at any time via the Settings page.
        </p>

        <h2>Data Protection</h2>
        <p>We implement pseudonymization techniques:</p>
        <ul>
          <li>Session tokens are randomly generated</li>
          <li>Fingerprints are hashed with SHA-256</li>
          <li>Emails are deleted after use</li>
        </ul>

        <h2>Your Rights (GDPR)</h2>
        <ul>
          <li><strong>Right to Access</strong> - View all your data in scan history</li>
          <li><strong>Right to Erasure</strong> - Delete your data via Settings</li>
          <li><strong>Right to Portability</strong> - Export your data as JSON</li>
        </ul>

        <h2>Cookies</h2>
        <p>We use only essential cookies:</p>
        <ul>
          <li><strong>session</strong> - Identifies your browser session (24 hours)</li>
        </ul>

        <h2>Contact</h2>
        <p>For privacy inquiries, contact us at privacy@adashield.io</p>
      </div>
    </MainLayout>
  );
}
