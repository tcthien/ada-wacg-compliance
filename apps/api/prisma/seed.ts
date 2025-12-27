import { PrismaClient, ScanStatus, WcagLevel, IssueImpact, ReportFormat } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Prisma 7.x requires explicit adapter configuration
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.report.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.scanResult.deleteMany();
  await prisma.scan.deleteMany();
  await prisma.guestSession.deleteMany();

  // Create GuestSessions
  console.log('👤 Creating guest sessions...');
  const activeSess = await prisma.guestSession.create({
    data: {
      fingerprint: 'fp_active_user_12345',
      sessionToken: 'sess_active_abc123xyz',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
  });

  const expiredSess = await prisma.guestSession.create({
    data: {
      fingerprint: 'fp_expired_user_67890',
      sessionToken: 'sess_expired_def456uvw',
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      expiresAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago (expired)
    },
  });

  const anonymizedSess = await prisma.guestSession.create({
    data: {
      fingerprint: 'fp_anonymized_xxxxx',
      sessionToken: 'sess_anonymized_ghi789rst',
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      expiresAt: new Date(Date.now() - 53 * 24 * 60 * 60 * 1000), // 53 days ago
      anonymizedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago (GDPR compliance)
    },
  });

  console.log('✅ Created 3 guest sessions');

  // Create Scans
  console.log('🔍 Creating scans...');
  const pendingScan = await prisma.scan.create({
    data: {
      guestSessionId: activeSess.id,
      url: 'https://example.com',
      email: 'user@example.com',
      status: ScanStatus.PENDING,
      wcagLevel: WcagLevel.AA,
    },
  });

  const runningScan = await prisma.scan.create({
    data: {
      guestSessionId: activeSess.id,
      url: 'https://shopping-site.com',
      email: 'admin@shopping-site.com',
      status: ScanStatus.RUNNING,
      wcagLevel: WcagLevel.AA,
    },
  });

  const completedScan = await prisma.scan.create({
    data: {
      guestSessionId: expiredSess.id,
      url: 'https://blog-example.com',
      email: 'owner@blog-example.com',
      status: ScanStatus.COMPLETED,
      wcagLevel: WcagLevel.AA,
      durationMs: 4523,
      completedAt: new Date(),
    },
  });

  const failedScan = await prisma.scan.create({
    data: {
      guestSessionId: activeSess.id,
      url: 'https://invalid-url-test.com',
      email: 'test@invalid-url-test.com',
      status: ScanStatus.FAILED,
      wcagLevel: WcagLevel.AA,
      errorMessage: 'Network timeout: Failed to connect to host after 30 seconds',
      completedAt: new Date(),
    },
  });

  const anotherCompletedScan = await prisma.scan.create({
    data: {
      guestSessionId: anonymizedSess.id,
      url: 'https://portfolio-site.dev',
      email: 'contact@portfolio-site.dev',
      status: ScanStatus.COMPLETED,
      wcagLevel: WcagLevel.AAA,
      durationMs: 3872,
      completedAt: new Date(),
    },
  });

  console.log('✅ Created 5 scans (PENDING, RUNNING, COMPLETED x2, FAILED)');

  // Create ScanResults for completed scans
  console.log('📊 Creating scan results...');
  const result1 = await prisma.scanResult.create({
    data: {
      scanId: completedScan.id,
      totalIssues: 12,
      criticalCount: 2,
      seriousCount: 4,
      moderateCount: 5,
      minorCount: 1,
      passedChecks: 45,
      inapplicableChecks: 8,
    },
  });

  const result2 = await prisma.scanResult.create({
    data: {
      scanId: anotherCompletedScan.id,
      totalIssues: 3,
      criticalCount: 0,
      seriousCount: 1,
      moderateCount: 2,
      minorCount: 0,
      passedChecks: 62,
      inapplicableChecks: 5,
    },
  });

  console.log('✅ Created 2 scan results');

  // Create Issues
  console.log('🐛 Creating issues...');
  await prisma.issue.createMany({
    data: [
      // Issues for result1
      {
        scanResultId: result1.id,
        ruleId: 'color-contrast',
        wcagCriteria: ['1.4.3'],
        impact: IssueImpact.CRITICAL,
        description: 'Elements must have sufficient color contrast',
        helpText: 'Ensures the contrast between foreground and background colors meets WCAG 2 AA contrast ratio thresholds',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/color-contrast',
        htmlSnippet: '<button class="btn-primary">Submit</button>',
        cssSelector: 'button.btn-primary',
        nodes: [
          {
            html: '<button class="btn-primary">Submit</button>',
            target: ['button.btn-primary'],
            failureSummary: 'Element has insufficient color contrast of 2.1:1 (foreground color: #9e9e9e, background color: #ffffff)',
          },
        ],
      },
      {
        scanResultId: result1.id,
        ruleId: 'image-alt',
        wcagCriteria: ['1.1.1'],
        impact: IssueImpact.CRITICAL,
        description: 'Images must have alternate text',
        helpText: 'Ensures <img> elements have alternate text or a role of none or presentation',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/image-alt',
        htmlSnippet: '<img src="/logo.png">',
        cssSelector: 'img[src="/logo.png"]',
        nodes: [
          {
            html: '<img src="/logo.png">',
            target: ['img[src="/logo.png"]'],
            failureSummary: 'Element does not have an alt attribute',
          },
        ],
      },
      {
        scanResultId: result1.id,
        ruleId: 'label',
        wcagCriteria: ['1.3.1', '4.1.2'],
        impact: IssueImpact.SERIOUS,
        description: 'Form elements must have labels',
        helpText: 'Ensures every form element has a label',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/label',
        htmlSnippet: '<input type="text" name="email">',
        cssSelector: 'input[name="email"]',
        nodes: [
          {
            html: '<input type="text" name="email">',
            target: ['input[name="email"]'],
            failureSummary: 'Form element does not have an implicit (wrapped) <label>',
          },
        ],
      },
      {
        scanResultId: result1.id,
        ruleId: 'heading-order',
        wcagCriteria: ['1.3.1'],
        impact: IssueImpact.MODERATE,
        description: 'Heading levels should only increase by one',
        helpText: 'Ensures the order of headings is semantically correct',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/heading-order',
        htmlSnippet: '<h3>Section Title</h3>',
        cssSelector: 'main > h3',
        nodes: [
          {
            html: '<h3>Section Title</h3>',
            target: ['main > h3'],
            failureSummary: 'Heading order invalid: h3 appears without a preceding h2',
          },
        ],
      },
      {
        scanResultId: result1.id,
        ruleId: 'link-name',
        wcagCriteria: ['2.4.4', '4.1.2'],
        impact: IssueImpact.SERIOUS,
        description: 'Links must have discernible text',
        helpText: 'Ensures links have discernible text',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/link-name',
        htmlSnippet: '<a href="/contact"></a>',
        cssSelector: 'a[href="/contact"]',
        nodes: [
          {
            html: '<a href="/contact"></a>',
            target: ['a[href="/contact"]'],
            failureSummary: 'Element is in tab order and does not have accessible text',
          },
        ],
      },
      // Issues for result2
      {
        scanResultId: result2.id,
        ruleId: 'button-name',
        wcagCriteria: ['4.1.2'],
        impact: IssueImpact.SERIOUS,
        description: 'Buttons must have discernible text',
        helpText: 'Ensures buttons have discernible text',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/button-name',
        htmlSnippet: '<button><i class="icon-save"></i></button>',
        cssSelector: 'button.icon-only',
        nodes: [
          {
            html: '<button><i class="icon-save"></i></button>',
            target: ['button.icon-only'],
            failureSummary: 'Element does not have inner text that is visible to screen readers',
          },
        ],
      },
      {
        scanResultId: result2.id,
        ruleId: 'html-has-lang',
        wcagCriteria: ['3.1.1'],
        impact: IssueImpact.MODERATE,
        description: '<html> element must have a lang attribute',
        helpText: 'Ensures every HTML document has a lang attribute',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/html-has-lang',
        htmlSnippet: '<html>',
        cssSelector: 'html',
        nodes: [
          {
            html: '<html>',
            target: ['html'],
            failureSummary: 'The <html> element does not have a lang attribute',
          },
        ],
      },
      {
        scanResultId: result2.id,
        ruleId: 'meta-viewport',
        wcagCriteria: ['1.4.4'],
        impact: IssueImpact.MODERATE,
        description: 'Zooming and scaling should not be disabled',
        helpText: 'Ensures <meta name="viewport"> does not disable text scaling and zooming',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/meta-viewport',
        htmlSnippet: '<meta name="viewport" content="user-scalable=no">',
        cssSelector: 'meta[name="viewport"]',
        nodes: [
          {
            html: '<meta name="viewport" content="user-scalable=no">',
            target: ['meta[name="viewport"]'],
            failureSummary: '<meta> tag disables zooming on mobile devices',
          },
        ],
      },
    ],
  });

  console.log('✅ Created 8 issues (5 for scan 1, 3 for scan 2)');

  // Create Reports
  console.log('📄 Creating reports...');
  await prisma.report.createMany({
    data: [
      {
        scanId: completedScan.id,
        format: ReportFormat.PDF,
        storageKey: 'reports/2024/12/blog-example-com-report.pdf',
        storageUrl: 'https://storage.adashield.dev/reports/2024/12/blog-example-com-report.pdf',
        fileSizeBytes: 145823,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      {
        scanId: anotherCompletedScan.id,
        format: ReportFormat.JSON,
        storageKey: 'reports/2024/12/portfolio-site-dev-report.json',
        storageUrl: 'https://storage.adashield.dev/reports/2024/12/portfolio-site-dev-report.json',
        fileSizeBytes: 32456,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    ],
  });

  console.log('✅ Created 2 reports');

  console.log('✨ Seed completed successfully!');
  console.log('\nSummary:');
  console.log('- 3 Guest Sessions (active, expired, anonymized)');
  console.log('- 5 Scans (PENDING, RUNNING, COMPLETED x2, FAILED)');
  console.log('- 2 Scan Results');
  console.log('- 8 Issues (various impacts and WCAG criteria)');
  console.log('- 2 Reports (PDF, JSON)');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
