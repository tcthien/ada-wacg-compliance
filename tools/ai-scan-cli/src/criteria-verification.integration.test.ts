import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type {
  AiCriteriaVerification,
  WcagLevel,
  CriteriaStatus,
  ExistingIssue,
  CriteriaBatchResult,
} from './types.js';
import type { DownloadedSite } from './website-downloader.js';
import type { Logger } from './logger.js';
import type { InvocationResult } from './claude-invoker.js';

// Mock the claude-invoker module
vi.mock('./claude-invoker.js', () => ({
  invokeClaudeCode: vi.fn(),
}));

// Import the mocked module to set up responses
import { invokeClaudeCode } from './claude-invoker.js';

// =============================================================================
// Test Fixtures: HTML Pages
// =============================================================================

/**
 * A basic HTML page with reasonable accessibility
 */
const sampleHtmlPage = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Page</title>
</head>
<body>
  <header>
    <nav aria-label="Main navigation">
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    </nav>
  </header>
  <main id="main-content">
    <h1>Main Heading</h1>
    <img src="test.jpg" alt="Test image description">
    <p>Some content with proper text.</p>
    <a href="/link">Click here for more information</a>
  </main>
  <footer>
    <p>&copy; 2024 Test Company</p>
  </footer>
</body>
</html>
`;

/**
 * An accessible page with good accessibility features
 */
const accessiblePage = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessible Page - Example Company</title>
  <style>
    body { font-family: Arial, sans-serif; color: #333; background: #fff; }
    .skip-link { position: absolute; left: -9999px; }
    .skip-link:focus { left: 0; top: 0; padding: 10px; background: #000; color: #fff; }
    h1 { color: #222; }
    a { color: #005a9c; }
    a:focus { outline: 3px solid #ff0; }
  </style>
</head>
<body>
  <a href="#main" class="skip-link">Skip to main content</a>

  <header role="banner">
    <nav aria-label="Primary navigation">
      <ul role="menubar">
        <li role="none"><a href="/" role="menuitem">Home</a></li>
        <li role="none"><a href="/products" role="menuitem">Products</a></li>
        <li role="none"><a href="/about" role="menuitem">About Us</a></li>
        <li role="none"><a href="/contact" role="menuitem">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main id="main" role="main">
    <article>
      <h1>Welcome to Our Accessible Website</h1>
      <p>This page demonstrates proper accessibility practices.</p>

      <section aria-labelledby="features-heading">
        <h2 id="features-heading">Key Features</h2>
        <ul>
          <li>Proper heading hierarchy</li>
          <li>Sufficient color contrast</li>
          <li>Keyboard navigation support</li>
          <li>Screen reader compatible</li>
        </ul>
      </section>

      <section aria-labelledby="images-heading">
        <h2 id="images-heading">Images with Alt Text</h2>
        <figure>
          <img src="product.jpg" alt="Our flagship product in action">
          <figcaption>Figure 1: Product demonstration</figcaption>
        </figure>
      </section>

      <section aria-labelledby="form-heading">
        <h2 id="form-heading">Contact Form</h2>
        <form action="/submit" method="post">
          <div>
            <label for="name">Full Name (required)</label>
            <input type="text" id="name" name="name" required aria-required="true">
          </div>
          <div>
            <label for="email">Email Address (required)</label>
            <input type="email" id="email" name="email" required aria-required="true">
          </div>
          <div>
            <label for="message">Message</label>
            <textarea id="message" name="message" rows="5"></textarea>
          </div>
          <button type="submit">Send Message</button>
        </form>
      </section>
    </article>
  </main>

  <footer role="contentinfo">
    <p>&copy; 2024 Example Company. All rights reserved.</p>
  </footer>
</body>
</html>
`;

/**
 * An inaccessible page with multiple accessibility issues
 */
const inaccessiblePage = `
<!DOCTYPE html>
<html>
<head>
  <title>Bad Page</title>
  <style>
    body { font-family: Arial; color: #ccc; background: #eee; }
    .small-text { font-size: 8px; color: #bbb; }
    a { color: #aaa; }
  </style>
</head>
<body>
  <div onclick="openMenu()">Menu</div>

  <div style="font-size: 24px; font-weight: bold;">Welcome</div>

  <img src="banner.jpg">
  <img src="logo.png" alt="">
  <img src="photo.jpg" alt="image">

  <div class="small-text">Important information here</div>

  <p>Click <a href="/page">here</a> to learn more.</p>

  <table>
    <tr><td>Name</td><td>Value</td></tr>
    <tr><td>Item 1</td><td>100</td></tr>
    <tr><td>Item 2</td><td>200</td></tr>
  </table>

  <form>
    <input type="text" placeholder="Enter name">
    <input type="email" placeholder="Enter email">
    <input type="submit" value="Go">
  </form>

  <div style="color: red; animation: blink 1s infinite;">FLASH SALE!</div>
</body>
</html>
`;

/**
 * A minimal HTML page for edge case testing
 */
const minimalPage = `
<!DOCTYPE html>
<html lang="en">
<head><title>Minimal</title></head>
<body><p>Hello World</p></body>
</html>
`;

// =============================================================================
// Test Fixtures: Mock Verification Responses
// =============================================================================

/**
 * Mock verification response for an accessible page
 */
const mockVerificationResponsePass: { criteriaVerifications: AiCriteriaVerification[] } = {
  criteriaVerifications: [
    {
      criterionId: '1.1.1',
      status: 'AI_VERIFIED_PASS',
      confidence: 90,
      reasoning: 'All images have descriptive alt text that conveys the purpose of the image.',
    },
    {
      criterionId: '1.3.1',
      status: 'AI_VERIFIED_PASS',
      confidence: 85,
      reasoning: 'Proper heading structure (h1, h2) is used. Semantic HTML elements like nav, main, article, and section are properly employed.',
    },
    {
      criterionId: '1.4.3',
      status: 'AI_VERIFIED_PASS',
      confidence: 88,
      reasoning: 'Text colors (#333 on #fff, #222 for headings) provide sufficient contrast ratios above 4.5:1.',
    },
    {
      criterionId: '2.1.1',
      status: 'AI_VERIFIED_PASS',
      confidence: 82,
      reasoning: 'All interactive elements (links, form inputs, buttons) are accessible via keyboard. Focus indicators are visible.',
    },
    {
      criterionId: '2.4.1',
      status: 'AI_VERIFIED_PASS',
      confidence: 95,
      reasoning: 'Skip link is provided to bypass repeated navigation content.',
    },
    {
      criterionId: '2.4.2',
      status: 'AI_VERIFIED_PASS',
      confidence: 92,
      reasoning: 'Page has a descriptive title "Accessible Page - Example Company".',
    },
    {
      criterionId: '3.1.1',
      status: 'AI_VERIFIED_PASS',
      confidence: 98,
      reasoning: 'HTML lang attribute is set to "en" indicating English language.',
    },
    {
      criterionId: '4.1.1',
      status: 'AI_VERIFIED_PASS',
      confidence: 85,
      reasoning: 'HTML is well-formed with proper nesting and closing tags.',
    },
    {
      criterionId: '4.1.2',
      status: 'AI_VERIFIED_PASS',
      confidence: 87,
      reasoning: 'Form controls have associated labels and ARIA attributes where appropriate.',
    },
  ],
};

/**
 * Mock verification response for an inaccessible page
 */
const mockVerificationResponseFail: { criteriaVerifications: AiCriteriaVerification[] } = {
  criteriaVerifications: [
    {
      criterionId: '1.1.1',
      status: 'AI_VERIFIED_FAIL',
      confidence: 95,
      reasoning: 'Multiple images lack alt text. One image has empty alt attribute, another has non-descriptive "image" as alt text.',
      relatedIssueIds: ['issue-img-001', 'issue-img-002', 'issue-img-003'],
    },
    {
      criterionId: '1.3.1',
      status: 'AI_VERIFIED_FAIL',
      confidence: 88,
      reasoning: 'No proper heading structure. Visual heading uses div with inline styles instead of h1. Table lacks headers.',
      relatedIssueIds: ['issue-heading-001', 'issue-table-001'],
    },
    {
      criterionId: '1.4.3',
      status: 'AI_VERIFIED_FAIL',
      confidence: 92,
      reasoning: 'Poor color contrast throughout. Gray text (#ccc) on light gray background (#eee) fails minimum contrast ratio.',
      relatedIssueIds: ['issue-contrast-001'],
    },
    {
      criterionId: '2.1.1',
      status: 'AI_VERIFIED_FAIL',
      confidence: 85,
      reasoning: 'Menu div uses onclick handler but is not keyboard accessible. No keyboard handler or proper button role.',
      relatedIssueIds: ['issue-keyboard-001'],
    },
    {
      criterionId: '2.4.1',
      status: 'AI_VERIFIED_FAIL',
      confidence: 90,
      reasoning: 'No skip navigation link provided to bypass repeated content.',
    },
    {
      criterionId: '2.4.2',
      status: 'AI_VERIFIED_FAIL',
      confidence: 75,
      reasoning: 'Page title "Bad Page" is not descriptive and does not indicate page purpose.',
    },
    {
      criterionId: '2.4.4',
      status: 'AI_VERIFIED_FAIL',
      confidence: 88,
      reasoning: 'Link text "here" does not describe its purpose without surrounding context.',
      relatedIssueIds: ['issue-link-001'],
    },
    {
      criterionId: '3.1.1',
      status: 'AI_VERIFIED_FAIL',
      confidence: 98,
      reasoning: 'HTML lang attribute is missing from the html element.',
    },
    {
      criterionId: '3.3.2',
      status: 'AI_VERIFIED_FAIL',
      confidence: 90,
      reasoning: 'Form inputs use placeholder text instead of proper labels. No visible labels provided.',
      relatedIssueIds: ['issue-label-001', 'issue-label-002'],
    },
  ],
};

/**
 * Mock verification response with mixed results
 */
const mockVerificationResponseMixed: { criteriaVerifications: AiCriteriaVerification[] } = {
  criteriaVerifications: [
    {
      criterionId: '1.1.1',
      status: 'AI_VERIFIED_PASS',
      confidence: 90,
      reasoning: 'All images have appropriate alt text.',
    },
    {
      criterionId: '1.3.1',
      status: 'AI_VERIFIED_PASS',
      confidence: 85,
      reasoning: 'Proper heading hierarchy with h1 followed by appropriate subheadings.',
    },
    {
      criterionId: '2.4.4',
      status: 'AI_VERIFIED_FAIL',
      confidence: 78,
      reasoning: 'One link uses "Click here" which is not descriptive without context.',
      relatedIssueIds: ['issue-link-generic-001'],
    },
    {
      criterionId: '3.1.1',
      status: 'AI_VERIFIED_PASS',
      confidence: 98,
      reasoning: 'HTML lang="en" is properly set.',
    },
  ],
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a mock logger that captures log messages
 */
function createMockLogger(): Logger & { messages: { level: string; message: string }[] } {
  const messages: { level: string; message: string }[] = [];

  return {
    messages,
    info: vi.fn((msg: string) => messages.push({ level: 'info', message: msg })),
    debug: vi.fn((msg: string) => messages.push({ level: 'debug', message: msg })),
    warning: vi.fn((msg: string) => messages.push({ level: 'warning', message: msg })),
    error: vi.fn((msg: string) => messages.push({ level: 'error', message: msg })),
    success: vi.fn((msg: string) => messages.push({ level: 'success', message: msg })),
    setVerbose: vi.fn(),
    setQuiet: vi.fn(),
    logProgress: vi.fn(),
    logBatchProgress: vi.fn(),
    logSummary: vi.fn(),
  };
}

/**
 * Create a downloaded site fixture from HTML content
 */
function createDownloadedSite(
  html: string,
  options: {
    scanId?: string;
    url?: string;
    wcagLevel?: WcagLevel;
    pageTitle?: string;
  } = {}
): DownloadedSite {
  const {
    scanId = 'test-scan-123',
    url = 'https://example.com',
    wcagLevel = 'AA',
    pageTitle = 'Test Page',
  } = options;

  return {
    scanId,
    url,
    wcagLevel,
    pageTitle,
    htmlContent: html,
    success: true,
    durationMs: 1000,
  };
}

/**
 * Create mock existing issues from axe-core
 */
function createMockExistingIssues(): ExistingIssue[] {
  return [
    {
      id: 'issue-img-001',
      ruleId: 'image-alt',
      wcagCriteria: '1.1.1',
      impact: 'CRITICAL',
      description: 'Image missing alt text',
      helpText: 'Provide alt text for images',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
      htmlSnippet: '<img src="banner.jpg">',
      cssSelector: 'img[src="banner.jpg"]',
    },
    {
      id: 'issue-contrast-001',
      ruleId: 'color-contrast',
      wcagCriteria: '1.4.3',
      impact: 'SERIOUS',
      description: 'Insufficient color contrast',
      helpText: 'Ensure sufficient contrast between text and background',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
      htmlSnippet: '<p style="color: #ccc">Text</p>',
      cssSelector: '.small-text',
    },
    {
      id: 'issue-label-001',
      ruleId: 'label',
      wcagCriteria: '3.3.2',
      impact: 'CRITICAL',
      description: 'Form input missing label',
      helpText: 'Associate a label with every form input',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/label',
      htmlSnippet: '<input type="text" placeholder="Enter name">',
      cssSelector: 'input[type="text"]',
    },
  ];
}

/**
 * Set up mock AI response for invokeClaudeCode
 * @param response - The mock response object to return
 */
function mockAiResponse(response: { criteriaVerifications: AiCriteriaVerification[] }): void {
  const mockResult: InvocationResult = {
    success: true,
    output: JSON.stringify(response, null, 2),
    durationMs: 5000,
  };

  vi.mocked(invokeClaudeCode).mockResolvedValue(mockResult);
}

/**
 * Set up mock AI response to return an error
 */
function mockAiError(errorMessage: string): void {
  const mockResult: InvocationResult = {
    success: false,
    error: errorMessage,
    durationMs: 1000,
  };

  vi.mocked(invokeClaudeCode).mockResolvedValue(mockResult);
}

/**
 * Set up mock AI response for multiple sequential calls
 */
function mockAiResponseSequence(responses: InvocationResult[]): void {
  const mock = vi.mocked(invokeClaudeCode);
  responses.forEach((response, index) => {
    mock.mockResolvedValueOnce(response);
  });
}

/**
 * Create a mock batch verification response for a specific batch
 */
function createMockBatchResponse(
  batchNumber: number,
  criteriaIds: string[],
  status: CriteriaStatus = 'AI_VERIFIED_PASS'
): { criteriaVerifications: AiCriteriaVerification[] } {
  return {
    criteriaVerifications: criteriaIds.map((id) => ({
      criterionId: id,
      status,
      confidence: 80 + Math.floor(Math.random() * 15),
      reasoning: `Batch ${batchNumber + 1}: Criterion ${id} verification completed with status ${status}.`,
    })),
  };
}

/**
 * Create mock invocation result from verification response
 */
function createMockInvocationResult(
  response: { criteriaVerifications: AiCriteriaVerification[] },
  durationMs = 5000
): InvocationResult {
  return {
    success: true,
    output: JSON.stringify(response, null, 2),
    durationMs,
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Criteria Verification Integration Tests', () => {
  let testCacheDir: string;
  let testCheckpointDir: string;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    // Create unique temporary directories for each test
    testCacheDir = await mkdtemp(join(tmpdir(), 'integration-cache-'));
    testCheckpointDir = await mkdtemp(join(tmpdir(), 'integration-checkpoint-'));
    mockLogger = createMockLogger();

    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Restore all mocks
    vi.restoreAllMocks();

    // Clean up test directories
    try {
      await rm(testCacheDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    try {
      await rm(testCheckpointDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Test Harness Setup', () => {
    it('should create mock logger correctly', () => {
      expect(mockLogger).toBeDefined();
      expect(mockLogger.info).toBeDefined();
      expect(mockLogger.error).toBeDefined();
      expect(mockLogger.messages).toEqual([]);

      mockLogger.info('Test message');
      expect(mockLogger.messages).toHaveLength(1);
      expect(mockLogger.messages[0]).toEqual({ level: 'info', message: 'Test message' });
    });

    it('should create downloaded site fixture correctly', () => {
      const site = createDownloadedSite(sampleHtmlPage);

      expect(site.scanId).toBe('test-scan-123');
      expect(site.url).toBe('https://example.com');
      expect(site.wcagLevel).toBe('AA');
      expect(site.htmlContent).toBe(sampleHtmlPage);
      expect(site.success).toBe(true);
    });

    it('should create downloaded site with custom options', () => {
      const site = createDownloadedSite(accessiblePage, {
        scanId: 'custom-scan-456',
        url: 'https://custom.example.com',
        wcagLevel: 'AAA',
        pageTitle: 'Custom Page',
      });

      expect(site.scanId).toBe('custom-scan-456');
      expect(site.url).toBe('https://custom.example.com');
      expect(site.wcagLevel).toBe('AAA');
      expect(site.pageTitle).toBe('Custom Page');
    });

    it('should create mock existing issues correctly', () => {
      const issues = createMockExistingIssues();

      expect(issues).toHaveLength(3);
      expect(issues[0].ruleId).toBe('image-alt');
      expect(issues[1].ruleId).toBe('color-contrast');
      expect(issues[2].ruleId).toBe('label');
    });

    it('should create temp directories for each test', () => {
      expect(testCacheDir).toBeTruthy();
      expect(testCheckpointDir).toBeTruthy();
      expect(testCacheDir).toContain('integration-cache-');
      expect(testCheckpointDir).toContain('integration-checkpoint-');
    });
  });

  describe('Mock AI Response Setup', () => {
    it('should mock AI response for pass scenario', async () => {
      mockAiResponse(mockVerificationResponsePass);

      const result = await invokeClaudeCode('test prompt');

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();

      const parsed = JSON.parse(result.output!);
      expect(parsed.criteriaVerifications).toHaveLength(9);
      expect(parsed.criteriaVerifications[0].criterionId).toBe('1.1.1');
      expect(parsed.criteriaVerifications[0].status).toBe('AI_VERIFIED_PASS');
    });

    it('should mock AI response for fail scenario', async () => {
      mockAiResponse(mockVerificationResponseFail);

      const result = await invokeClaudeCode('test prompt');

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output!);
      expect(parsed.criteriaVerifications).toHaveLength(9);
      expect(parsed.criteriaVerifications[0].status).toBe('AI_VERIFIED_FAIL');
      expect(parsed.criteriaVerifications[0].relatedIssueIds).toBeDefined();
    });

    it('should mock AI error response', async () => {
      mockAiError('Rate limit exceeded');

      const result = await invokeClaudeCode('test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });

    it('should mock sequential AI responses', async () => {
      const responses: InvocationResult[] = [
        createMockInvocationResult(createMockBatchResponse(0, ['1.1.1', '1.2.1'])),
        createMockInvocationResult(createMockBatchResponse(1, ['1.3.1', '1.4.3'])),
        createMockInvocationResult(createMockBatchResponse(2, ['2.1.1', '2.4.1'])),
      ];

      mockAiResponseSequence(responses);

      // First call
      const result1 = await invokeClaudeCode('batch 1');
      expect(result1.success).toBe(true);
      const parsed1 = JSON.parse(result1.output!);
      expect(parsed1.criteriaVerifications[0].criterionId).toBe('1.1.1');

      // Second call
      const result2 = await invokeClaudeCode('batch 2');
      expect(result2.success).toBe(true);
      const parsed2 = JSON.parse(result2.output!);
      expect(parsed2.criteriaVerifications[0].criterionId).toBe('1.3.1');

      // Third call
      const result3 = await invokeClaudeCode('batch 3');
      expect(result3.success).toBe(true);
      const parsed3 = JSON.parse(result3.output!);
      expect(parsed3.criteriaVerifications[0].criterionId).toBe('2.1.1');
    });
  });

  describe('Test Fixtures Validation', () => {
    it('should have valid sample HTML page', () => {
      expect(sampleHtmlPage).toContain('<!DOCTYPE html>');
      expect(sampleHtmlPage).toContain('lang="en"');
      expect(sampleHtmlPage).toContain('<h1>');
      expect(sampleHtmlPage).toContain('alt=');
    });

    it('should have valid accessible page with accessibility features', () => {
      expect(accessiblePage).toContain('lang="en"');
      expect(accessiblePage).toContain('skip-link');
      expect(accessiblePage).toContain('role="banner"');
      expect(accessiblePage).toContain('role="main"');
      expect(accessiblePage).toContain('aria-label');
      expect(accessiblePage).toContain('<label');
      expect(accessiblePage).toContain('aria-required');
    });

    it('should have valid inaccessible page with known issues', () => {
      // No lang attribute
      expect(inaccessiblePage).not.toContain('lang="en"');
      // Using onclick without keyboard support
      expect(inaccessiblePage).toContain('onclick=');
      // Missing alt text
      expect(inaccessiblePage).toContain('<img src="banner.jpg">');
      // Empty alt text
      expect(inaccessiblePage).toContain('alt=""');
      // Placeholder instead of labels
      expect(inaccessiblePage).toContain('placeholder=');
      expect(inaccessiblePage).not.toContain('<label');
    });

    it('should have valid minimal page', () => {
      expect(minimalPage).toContain('<!DOCTYPE html>');
      expect(minimalPage).toContain('lang="en"');
      expect(minimalPage.length).toBeLessThan(200);
    });

    it('should have valid mock verification response for pass', () => {
      expect(mockVerificationResponsePass.criteriaVerifications).toHaveLength(9);

      for (const verification of mockVerificationResponsePass.criteriaVerifications) {
        expect(verification.criterionId).toMatch(/^\d+\.\d+\.\d+$/);
        expect(verification.status).toBe('AI_VERIFIED_PASS');
        expect(verification.confidence).toBeGreaterThanOrEqual(0);
        expect(verification.confidence).toBeLessThanOrEqual(100);
        expect(verification.reasoning).toBeTruthy();
      }
    });

    it('should have valid mock verification response for fail', () => {
      expect(mockVerificationResponseFail.criteriaVerifications).toHaveLength(9);

      for (const verification of mockVerificationResponseFail.criteriaVerifications) {
        expect(verification.criterionId).toMatch(/^\d+\.\d+\.\d+$/);
        expect(verification.status).toBe('AI_VERIFIED_FAIL');
        expect(verification.confidence).toBeGreaterThanOrEqual(0);
        expect(verification.confidence).toBeLessThanOrEqual(100);
        expect(verification.reasoning).toBeTruthy();
      }

      // Check that some failures have related issue IDs
      const withIssueIds = mockVerificationResponseFail.criteriaVerifications.filter(
        (v) => v.relatedIssueIds && v.relatedIssueIds.length > 0
      );
      expect(withIssueIds.length).toBeGreaterThan(0);
    });

    it('should have valid mock verification response for mixed results', () => {
      const passes = mockVerificationResponseMixed.criteriaVerifications.filter(
        (v) => v.status === 'AI_VERIFIED_PASS'
      );
      const fails = mockVerificationResponseMixed.criteriaVerifications.filter(
        (v) => v.status === 'AI_VERIFIED_FAIL'
      );

      expect(passes.length).toBeGreaterThan(0);
      expect(fails.length).toBeGreaterThan(0);
    });
  });

  describe('Batch Response Generation', () => {
    it('should create mock batch response with specified criteria IDs', () => {
      const response = createMockBatchResponse(0, ['1.1.1', '1.3.1', '2.1.1']);

      expect(response.criteriaVerifications).toHaveLength(3);
      expect(response.criteriaVerifications[0].criterionId).toBe('1.1.1');
      expect(response.criteriaVerifications[1].criterionId).toBe('1.3.1');
      expect(response.criteriaVerifications[2].criterionId).toBe('2.1.1');
    });

    it('should create mock batch response with specified status', () => {
      const passResponse = createMockBatchResponse(0, ['1.1.1'], 'AI_VERIFIED_PASS');
      const failResponse = createMockBatchResponse(1, ['1.4.3'], 'AI_VERIFIED_FAIL');

      expect(passResponse.criteriaVerifications[0].status).toBe('AI_VERIFIED_PASS');
      expect(failResponse.criteriaVerifications[0].status).toBe('AI_VERIFIED_FAIL');
    });

    it('should include batch number in reasoning', () => {
      const response = createMockBatchResponse(2, ['1.1.1']);

      expect(response.criteriaVerifications[0].reasoning).toContain('Batch 3');
    });

    it('should generate confidence values in valid range', () => {
      const response = createMockBatchResponse(0, ['1.1.1', '1.3.1', '2.1.1', '2.4.1', '3.1.1']);

      for (const verification of response.criteriaVerifications) {
        expect(verification.confidence).toBeGreaterThanOrEqual(80);
        expect(verification.confidence).toBeLessThanOrEqual(94);
      }
    });
  });

  describe('Integration Test Smoke Test', () => {
    it('should successfully run a basic integration test scenario', async () => {
      // Set up mock response
      mockAiResponse(mockVerificationResponseMixed);

      // Create test fixtures
      const downloadedSite = createDownloadedSite(sampleHtmlPage);
      const existingIssues = createMockExistingIssues();

      // Verify fixtures are set up correctly
      expect(downloadedSite.success).toBe(true);
      expect(downloadedSite.htmlContent.length).toBeGreaterThan(0);
      expect(existingIssues.length).toBeGreaterThan(0);

      // Call the mocked AI
      const result = await invokeClaudeCode('Verify criteria for test page');

      // Verify the mock worked
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();

      const parsed = JSON.parse(result.output!);
      expect(parsed.criteriaVerifications).toBeDefined();
      expect(Array.isArray(parsed.criteriaVerifications)).toBe(true);

      // Verify mock was called
      expect(invokeClaudeCode).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple batch processing scenario', async () => {
      // Set up sequential mock responses for 3 batches
      const batch1 = createMockBatchResponse(0, ['1.1.1', '1.2.1', '1.2.2']);
      const batch2 = createMockBatchResponse(1, ['1.3.1', '1.4.1', '1.4.3']);
      const batch3 = createMockBatchResponse(2, ['2.1.1', '2.4.1', '2.4.2']);

      mockAiResponseSequence([
        createMockInvocationResult(batch1, 3000),
        createMockInvocationResult(batch2, 3500),
        createMockInvocationResult(batch3, 2800),
      ]);

      // Process batches
      const allVerifications: AiCriteriaVerification[] = [];
      let totalDuration = 0;

      for (let i = 0; i < 3; i++) {
        const result = await invokeClaudeCode(`Process batch ${i + 1}`);
        expect(result.success).toBe(true);

        const parsed = JSON.parse(result.output!);
        allVerifications.push(...parsed.criteriaVerifications);
        totalDuration += result.durationMs;
      }

      // Verify all batches were processed
      expect(allVerifications).toHaveLength(9);
      expect(invokeClaudeCode).toHaveBeenCalledTimes(3);
      expect(totalDuration).toBe(3000 + 3500 + 2800);
    });

    it('should handle error recovery scenario', async () => {
      // First call fails, second succeeds
      mockAiResponseSequence([
        { success: false, error: 'Temporary error', durationMs: 500 },
        createMockInvocationResult(mockVerificationResponsePass, 4000),
      ]);

      // First attempt fails
      const result1 = await invokeClaudeCode('First attempt');
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Temporary error');

      // Retry succeeds
      const result2 = await invokeClaudeCode('Retry attempt');
      expect(result2.success).toBe(true);

      const parsed = JSON.parse(result2.output!);
      expect(parsed.criteriaVerifications.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Happy Path Integration Tests
// =============================================================================

// Import actual implementations for integration testing
import { CriteriaBatchProcessor } from './criteria-batch-processor.js';
import * as promptGenerator from './prompt-generator.js';
import { readdir } from 'fs/promises';
import { join } from 'path';

describe('Happy Path Integration Tests', () => {
  let testCacheDir: string;
  let testCheckpointDir: string;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let processor: CriteriaBatchProcessor;

  beforeEach(async () => {
    // Create unique temporary directories for each test
    testCacheDir = await mkdtemp(join(tmpdir(), 'happy-path-cache-'));
    testCheckpointDir = await mkdtemp(join(tmpdir(), 'happy-path-checkpoint-'));
    mockLogger = createMockLogger();

    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Restore all mocks
    vi.restoreAllMocks();

    // Clear the verification instructions cache between tests
    promptGenerator.clearVerificationInstructionsCache();

    // Clean up test directories
    try {
      await rm(testCacheDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    try {
      await rm(testCheckpointDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Full criteria verification workflow', () => {
    it('should process all 50 AA criteria in 5 batches with default batch size 10', async () => {
      // Use real verification instructions (load from file)
      // Don't mock loadVerificationInstructions to test actual data loading

      // Create processor with default batch size (10)
      processor = new CriteriaBatchProcessor(mockLogger, {
        batchSize: 10,
        delayBetweenBatches: 0, // No delay for faster tests
        timeout: 5000,
      });

      await processor.initialize();

      // Verify instructions are loaded
      const instructions = processor.getVerificationInstructions();
      expect(instructions).not.toBeNull();
      expect(instructions?.criteria).toBeDefined();

      // Create batches for AA level
      const batches = processor.createBatches('AA');

      // Verify we get 5 batches for 50 AA criteria (30 Level A + 20 Level AA)
      expect(batches.length).toBe(5);

      // Verify total criteria count is 50
      const totalCriteria = batches.reduce((sum, batch) => sum + batch.length, 0);
      expect(totalCriteria).toBe(50);

      // Verify each batch has 10 criteria
      expect(batches[0]).toHaveLength(10);
      expect(batches[1]).toHaveLength(10);
      expect(batches[2]).toHaveLength(10);
      expect(batches[3]).toHaveLength(10);
      expect(batches[4]).toHaveLength(10);

      // Verify first batch contains criteria from the start (1.1.1, 1.2.1, etc.)
      const firstBatchIds = batches[0].map((c) => c.criterionId);
      expect(firstBatchIds).toContain('1.1.1');
      expect(firstBatchIds).toContain('1.2.1');

      // Verify last batch contains criteria from the end (4.x.x criteria)
      const lastBatchIds = batches[4].map((c) => c.criterionId);
      expect(lastBatchIds).toContain('4.1.2');
      expect(lastBatchIds).toContain('4.1.3');
    });

    it('should complete happy path workflow: CSV input -> batching -> mock AI -> output', async () => {
      // Create processor with custom batch size for predictable testing
      processor = new CriteriaBatchProcessor(mockLogger, {
        batchSize: 10,
        delayBetweenBatches: 0,
        timeout: 5000,
      });

      await processor.initialize();

      // Clear cache to ensure fresh processing (no cached entries from previous runs)
      await processor.getCache().clearAll();

      // Create a mock downloaded site (simulating CSV input)
      const downloadedSite = createDownloadedSite(accessiblePage, {
        scanId: 'happy-path-scan-001',
        url: 'https://example.com/test',
        wcagLevel: 'AA',
        pageTitle: 'Test Accessible Page',
      });

      // Create mock existing issues (simulating axe-core output)
      const existingIssues = createMockExistingIssues();

      // Create batches
      const batches = processor.createBatches('AA');
      expect(batches.length).toBe(5);

      // Set up mock AI responses for all 5 batches
      const mockResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          3000 + index * 500 // Varying durations
        );
      });

      mockAiResponseSequence(mockResponses);

      // Process all criteria batches
      const results = await processor.processCriteriaBatches(
        downloadedSite,
        existingIssues,
        'AA'
      );

      // Verify results structure
      expect(results).toHaveLength(5);

      // Verify all 50 criteria were verified
      const totalVerified = results.reduce((sum, r) => sum + r.criteriaVerified, 0);
      expect(totalVerified).toBe(50);

      // Verify each batch result
      results.forEach((result, index) => {
        expect(result.batchNumber).toBe(index + 1); // 1-indexed
        expect(result.criteriaVerified).toBe(10);
        expect(result.verifications).toHaveLength(10);
        expect(result.errors).toHaveLength(0);
      });

      // Verify AI was called 5 times
      expect(invokeClaudeCode).toHaveBeenCalledTimes(5);
    });

    it('should populate cache after processing batches', async () => {
      processor = new CriteriaBatchProcessor(mockLogger, {
        batchSize: 10,
        delayBetweenBatches: 0,
        timeout: 5000,
      });

      await processor.initialize();

      // Clear cache to start with a known state
      await processor.getCache().clearAll();

      const downloadedSite = createDownloadedSite(sampleHtmlPage, {
        scanId: 'cache-test-scan-001',
        url: 'https://example.com/cache-test',
        wcagLevel: 'AA',
        pageTitle: 'Cache Test Page',
      });

      const existingIssues = createMockExistingIssues();
      const batches = processor.createBatches('AA');

      // Set up mock AI responses
      const mockResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          2000
        );
      });

      mockAiResponseSequence(mockResponses);

      // Get cache stats before processing
      const cache = processor.getCache();
      const statsBefore = cache.getStats();
      const entriesCountBefore = statsBefore.entriesCount;

      // Process all batches
      await processor.processCriteriaBatches(downloadedSite, existingIssues, 'AA');

      // Verify cache was populated (5 new entries for 5 batches)
      const statsAfter = cache.getStats();
      expect(statsAfter.entriesCount).toBe(entriesCountBefore + 5);

      // Verify we can retrieve cached entries
      for (let i = 0; i < 5; i++) {
        const cacheKey = cache.generateKey(downloadedSite.htmlContent, 'AA', i);
        const cachedEntry = await cache.get(cacheKey);
        expect(cachedEntry).not.toBeNull();
        expect(cachedEntry?.verifications).toHaveLength(10);
      }
    });

    it('should create checkpoint during processing and clear after completion', async () => {
      processor = new CriteriaBatchProcessor(mockLogger, {
        batchSize: 10,
        delayBetweenBatches: 0,
        timeout: 5000,
      });

      await processor.initialize();

      // Clear cache to ensure AI calls are made (for checkpoint to be created)
      await processor.getCache().clearAll();

      const scanId = 'checkpoint-test-scan-001';
      const downloadedSite = createDownloadedSite(minimalPage, {
        scanId,
        url: 'https://example.com/checkpoint-test',
        wcagLevel: 'AA',
        pageTitle: 'Checkpoint Test Page',
      });

      const existingIssues: ExistingIssue[] = [];
      const batches = processor.createBatches('AA');

      // Track checkpoint state during processing
      const checkpointManager = processor.getCheckpointManager();

      // Set up mock AI responses
      const mockResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          1000
        );
      });

      mockAiResponseSequence(mockResponses);

      // Process all batches
      await processor.processCriteriaBatches(downloadedSite, existingIssues, 'AA');

      // Verify checkpoint is cleared after successful completion
      const checkpointAfter = await checkpointManager.getCheckpoint(scanId);
      expect(checkpointAfter).toBeNull();
    });

    it('should use cache on second processing of same content', async () => {
      processor = new CriteriaBatchProcessor(mockLogger, {
        batchSize: 10,
        delayBetweenBatches: 0,
        timeout: 5000,
      });

      await processor.initialize();

      // Clear cache to start fresh
      await processor.getCache().clearAll();

      const downloadedSite = createDownloadedSite(accessiblePage, {
        scanId: 'cache-reuse-scan-001',
        url: 'https://example.com/cache-reuse',
        wcagLevel: 'AA',
        pageTitle: 'Cache Reuse Test',
      });

      const existingIssues = createMockExistingIssues();
      const batches = processor.createBatches('AA');

      // Set up mock AI responses for first pass
      const mockResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          2000
        );
      });

      mockAiResponseSequence(mockResponses);

      // First processing - should call AI
      const results1 = await processor.processCriteriaBatches(
        downloadedSite,
        existingIssues,
        'AA'
      );

      expect(results1).toHaveLength(5);
      expect(invokeClaudeCode).toHaveBeenCalledTimes(5);

      // Reset mock call count
      vi.mocked(invokeClaudeCode).mockClear();

      // Create new site with SAME content but different scan ID
      const downloadedSite2 = createDownloadedSite(accessiblePage, {
        scanId: 'cache-reuse-scan-002',
        url: 'https://example.com/cache-reuse',
        wcagLevel: 'AA',
        pageTitle: 'Cache Reuse Test',
      });

      // Second processing with same content - should use cache
      const results2 = await processor.processCriteriaBatches(
        downloadedSite2,
        existingIssues,
        'AA'
      );

      expect(results2).toHaveLength(5);

      // Verify no AI calls were made (all from cache)
      expect(invokeClaudeCode).toHaveBeenCalledTimes(0);

      // Verify results are equivalent (same verifications)
      const totalVerified2 = results2.reduce((sum, r) => sum + r.criteriaVerified, 0);
      expect(totalVerified2).toBe(50);

      // Verify tokens used is 0 for all cached results
      results2.forEach((result) => {
        expect(result.tokensUsed).toBe(0);
      });
    });

    it('should verify all criteria IDs are unique and properly distributed', async () => {
      processor = new CriteriaBatchProcessor(mockLogger, {
        batchSize: 10,
        delayBetweenBatches: 0,
        timeout: 5000,
      });

      await processor.initialize();

      const batches = processor.createBatches('AA');

      // Collect all criteria IDs
      const allCriteriaIds: string[] = [];
      batches.forEach((batch) => {
        batch.forEach((criterion) => {
          allCriteriaIds.push(criterion.criterionId);
        });
      });

      // Verify no duplicates
      const uniqueIds = new Set(allCriteriaIds);
      expect(uniqueIds.size).toBe(allCriteriaIds.length);
      expect(uniqueIds.size).toBe(50);

      // Verify expected AA level criteria are present
      const expectedLevelACriteria = [
        '1.1.1', '1.2.1', '1.2.2', '1.2.3', '1.3.1', '1.3.2', '1.3.3',
        '1.4.1', '1.4.2', '2.1.1', '2.1.2', '2.1.4', '2.2.1', '2.2.2',
        '2.3.1', '2.4.1', '2.4.2', '2.4.3', '2.4.4', '2.5.1', '2.5.2',
        '2.5.3', '2.5.4', '3.1.1', '3.2.1', '3.2.2', '3.3.1', '3.3.2',
        '4.1.1', '4.1.2',
      ];

      const expectedLevelAACriteria = [
        '1.2.4', '1.2.5', '1.3.4', '1.3.5', '1.4.3', '1.4.4', '1.4.5',
        '1.4.10', '1.4.11', '1.4.12', '1.4.13', '2.4.5', '2.4.6', '2.4.7',
        '3.1.2', '3.2.3', '3.2.4', '3.3.3', '3.3.4', '4.1.3',
      ];

      expectedLevelACriteria.forEach((id) => {
        expect(uniqueIds.has(id)).toBe(true);
      });

      expectedLevelAACriteria.forEach((id) => {
        expect(uniqueIds.has(id)).toBe(true);
      });
    });

    it('should handle mixed verification results across batches', async () => {
      processor = new CriteriaBatchProcessor(mockLogger, {
        batchSize: 10,
        delayBetweenBatches: 0,
        timeout: 5000,
      });

      await processor.initialize();

      // Clear cache to ensure fresh processing
      await processor.getCache().clearAll();

      const downloadedSite = createDownloadedSite(inaccessiblePage, {
        scanId: 'mixed-results-scan-001',
        url: 'https://example.com/inaccessible',
        wcagLevel: 'AA',
        pageTitle: 'Inaccessible Test Page',
      });

      const existingIssues = createMockExistingIssues();
      const batches = processor.createBatches('AA');

      // Set up mock responses with mixed results:
      // Batch 0, 2, 4: PASS
      // Batch 1, 3: FAIL
      const mockResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        const status = index % 2 === 0 ? 'AI_VERIFIED_PASS' : 'AI_VERIFIED_FAIL';
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, status as CriteriaStatus),
          2000
        );
      });

      mockAiResponseSequence(mockResponses);

      const results = await processor.processCriteriaBatches(
        downloadedSite,
        existingIssues,
        'AA'
      );

      // Verify we got all batches
      expect(results).toHaveLength(5);

      // Verify pass/fail distribution
      const passResults = results.filter((r, i) => i % 2 === 0);
      const failResults = results.filter((r, i) => i % 2 !== 0);

      expect(passResults).toHaveLength(3); // Batches 0, 2, 4
      expect(failResults).toHaveLength(2); // Batches 1, 3

      // Verify pass batch verifications are AI_VERIFIED_PASS
      passResults.forEach((result) => {
        result.verifications.forEach((v) => {
          expect(v.status).toBe('AI_VERIFIED_PASS');
        });
      });

      // Verify fail batch verifications are AI_VERIFIED_FAIL
      failResults.forEach((result) => {
        result.verifications.forEach((v) => {
          expect(v.status).toBe('AI_VERIFIED_FAIL');
        });
      });
    });

    it('should correctly aggregate token usage across all batches', async () => {
      processor = new CriteriaBatchProcessor(mockLogger, {
        batchSize: 10,
        delayBetweenBatches: 0,
        timeout: 5000,
      });

      await processor.initialize();

      // Clear cache to ensure fresh processing
      await processor.getCache().clearAll();

      const downloadedSite = createDownloadedSite(sampleHtmlPage, {
        scanId: 'token-tracking-scan-001',
        url: 'https://example.com/tokens',
        wcagLevel: 'AA',
        pageTitle: 'Token Tracking Test',
      });

      const existingIssues: ExistingIssue[] = [];
      const batches = processor.createBatches('AA');

      // Set up mock responses with varying output sizes to simulate different token usage
      const mockResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          2000 + index * 1000
        );
      });

      mockAiResponseSequence(mockResponses);

      const results = await processor.processCriteriaBatches(
        downloadedSite,
        existingIssues,
        'AA'
      );

      // Verify token usage is tracked for each batch
      results.forEach((result) => {
        expect(result.tokensUsed).toBeGreaterThan(0);
      });

      // Verify total tokens is sum of all batches
      const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);
      expect(totalTokens).toBeGreaterThan(0);

      // Verify duration is tracked
      const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
      expect(totalDuration).toBeGreaterThan(0);
    });
  });

  describe('Edge cases in happy path', () => {
    it('should handle Level A processing with 30 criteria in 3 batches', async () => {
      processor = new CriteriaBatchProcessor(mockLogger, {
        batchSize: 10,
        delayBetweenBatches: 0,
        timeout: 5000,
      });

      await processor.initialize();

      const batches = processor.createBatches('A');

      // Level A has 30 criteria = 3 batches
      expect(batches.length).toBe(3);

      const totalCriteria = batches.reduce((sum, batch) => sum + batch.length, 0);
      expect(totalCriteria).toBe(30);
    });

    it('should handle custom batch size of 8 creating 7 batches for AA', async () => {
      processor = new CriteriaBatchProcessor(mockLogger, {
        batchSize: 8,
        delayBetweenBatches: 0,
        timeout: 5000,
      });

      await processor.initialize();

      const batches = processor.createBatches('AA');

      // 50 criteria / 8 per batch = 7 batches (6 full + 1 partial)
      expect(batches.length).toBe(7);

      const totalCriteria = batches.reduce((sum, batch) => sum + batch.length, 0);
      expect(totalCriteria).toBe(50);

      // First 6 batches should have 8 criteria
      expect(batches[0]).toHaveLength(8);
      expect(batches[5]).toHaveLength(8);

      // Last batch should have 2 criteria (50 - 6*8 = 2)
      expect(batches[6]).toHaveLength(2);
    });

    it('should handle empty existing issues array', async () => {
      processor = new CriteriaBatchProcessor(mockLogger, {
        batchSize: 10,
        delayBetweenBatches: 0,
        timeout: 5000,
      });

      await processor.initialize();

      // Clear cache to ensure fresh processing
      await processor.getCache().clearAll();

      const downloadedSite = createDownloadedSite(accessiblePage, {
        scanId: 'empty-issues-scan-001',
        url: 'https://example.com/empty-issues',
        wcagLevel: 'AA',
        pageTitle: 'Empty Issues Test',
      });

      // Empty issues array
      const existingIssues: ExistingIssue[] = [];
      const batches = processor.createBatches('AA');

      const mockResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          1500
        );
      });

      mockAiResponseSequence(mockResponses);

      const results = await processor.processCriteriaBatches(
        downloadedSite,
        existingIssues,
        'AA'
      );

      expect(results).toHaveLength(5);
      expect(invokeClaudeCode).toHaveBeenCalledTimes(5);
    });
  });
});

// =============================================================================
// Checkpoint Resume Integration Tests
// =============================================================================

import { CriteriaCheckpointManager } from './criteria-checkpoint-manager.js';
import type { CriteriaCheckpoint, AiCriteriaVerification } from './types.js';

describe('Checkpoint Resume Integration Tests', () => {
  let testCacheDir: string;
  let testCheckpointDir: string;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let processor: CriteriaBatchProcessor;
  let checkpointManager: CriteriaCheckpointManager;

  beforeEach(async () => {
    // Create unique temporary directories for each test
    testCacheDir = await mkdtemp(join(tmpdir(), 'checkpoint-resume-cache-'));
    testCheckpointDir = await mkdtemp(join(tmpdir(), 'checkpoint-resume-checkpoint-'));
    mockLogger = createMockLogger();

    // Create checkpoint manager with test directory
    checkpointManager = new CriteriaCheckpointManager(testCheckpointDir);

    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Restore all mocks
    vi.restoreAllMocks();

    // Clear the verification instructions cache between tests
    promptGenerator.clearVerificationInstructionsCache();

    // Clean up test directories
    try {
      await rm(testCacheDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    try {
      await rm(testCheckpointDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /**
   * Helper to create a processor with custom checkpoint directory
   */
  async function createProcessorWithCheckpoint(): Promise<CriteriaBatchProcessor> {
    // Create processor - we'll need to use a workaround since the processor
    // creates its own checkpoint manager internally
    const proc = new CriteriaBatchProcessor(mockLogger, {
      batchSize: 10,
      delayBetweenBatches: 0, // No delay for faster tests
      timeout: 5000,
    });

    await proc.initialize();

    // Clear cache to ensure fresh processing
    await proc.getCache().clearAll();

    return proc;
  }

  describe('Simulated interruption and resume', () => {
    it('should simulate interruption after 2 batches and resume from batch 3', async () => {
      const scanId = 'resume-test-scan-001';
      const wcagLevel = 'AA' as const;
      const url = 'https://example.com/resume-test';

      // Initialize checkpoint manager
      const checkpointMgr = new CriteriaCheckpointManager(testCheckpointDir);

      // Create processor to get batch info
      processor = await createProcessorWithCheckpoint();
      const batches = processor.createBatches(wcagLevel);
      const totalBatches = batches.length; // Should be 5 for AA level

      expect(totalBatches).toBe(5);

      // PHASE 1: Simulate processing first 2 batches (0, 1) before interruption
      // Create a checkpoint manually to simulate state after 2 batches completed
      const checkpoint = checkpointMgr.initCheckpoint(scanId, url, wcagLevel, totalBatches);
      await checkpointMgr.saveCheckpoint(checkpoint);

      // Simulate batch 0 completion
      const batch0Verifications: AiCriteriaVerification[] = batches[0].map((c) => ({
        criterionId: c.criterionId,
        status: 'AI_VERIFIED_PASS' as const,
        confidence: 85,
        reasoning: `Batch 0: Criterion ${c.criterionId} verified during initial run.`,
      }));
      await checkpointMgr.markBatchComplete(scanId, 0, batch0Verifications, 1000);

      // Simulate batch 1 completion
      const batch1Verifications: AiCriteriaVerification[] = batches[1].map((c) => ({
        criterionId: c.criterionId,
        status: 'AI_VERIFIED_PASS' as const,
        confidence: 88,
        reasoning: `Batch 1: Criterion ${c.criterionId} verified during initial run.`,
      }));
      await checkpointMgr.markBatchComplete(scanId, 1, batch1Verifications, 1200);

      // Verify checkpoint state after "interruption"
      const checkpointAfterInterruption = await checkpointMgr.getCheckpoint(scanId);
      expect(checkpointAfterInterruption).not.toBeNull();
      expect(checkpointAfterInterruption!.completedBatches).toEqual([0, 1]);
      expect(checkpointAfterInterruption!.partialVerifications).toHaveLength(20); // 10 + 10

      // Get incomplete batches
      const incompleteBatches = checkpointMgr.getIncompleteBatches(checkpointAfterInterruption!);
      expect(incompleteBatches).toEqual([2, 3, 4]); // Batches 2, 3, 4 remain

      // PHASE 2: Resume processing - should only process batches 2, 3, 4
      // Create a new processor instance (simulating fresh start after interruption)
      // Note: The real processor uses its own checkpoint manager, so we verify behavior differently

      // Set up mock AI responses for remaining batches (2, 3, 4)
      const remainingMockResponses: InvocationResult[] = [2, 3, 4].map((batchIdx) => {
        const batchCriteriaIds = batches[batchIdx].map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(batchIdx, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          2500
        );
      });

      mockAiResponseSequence(remainingMockResponses);

      // Verify that only 3 batches would need processing
      // We verify this by checking the incomplete batches calculation
      expect(incompleteBatches).toHaveLength(3);

      // Verify the checkpoint correctly identifies which batches are complete
      expect(checkpointMgr.isBatchComplete(checkpointAfterInterruption!, 0)).toBe(true);
      expect(checkpointMgr.isBatchComplete(checkpointAfterInterruption!, 1)).toBe(true);
      expect(checkpointMgr.isBatchComplete(checkpointAfterInterruption!, 2)).toBe(false);
      expect(checkpointMgr.isBatchComplete(checkpointAfterInterruption!, 3)).toBe(false);
      expect(checkpointMgr.isBatchComplete(checkpointAfterInterruption!, 4)).toBe(false);
    });

    it('should resume processing and verify only remaining batches are processed', async () => {
      const scanId = 'resume-verify-scan-002';
      const wcagLevel = 'AA' as const;
      const url = 'https://example.com/resume-verify';

      processor = await createProcessorWithCheckpoint();
      const batches = processor.createBatches(wcagLevel);
      const totalBatches = batches.length;

      // Get the processor's checkpoint manager
      const procCheckpointMgr = processor.getCheckpointManager();

      // Create initial checkpoint with 2 completed batches
      const checkpoint = procCheckpointMgr.initCheckpoint(scanId, url, wcagLevel, totalBatches);
      await procCheckpointMgr.saveCheckpoint(checkpoint);

      // Mark batches 0 and 1 as complete
      const batch0Verifications: AiCriteriaVerification[] = batches[0].map((c) => ({
        criterionId: c.criterionId,
        status: 'AI_VERIFIED_PASS' as const,
        confidence: 85,
        reasoning: `Batch 0 completed.`,
      }));
      await procCheckpointMgr.markBatchComplete(scanId, 0, batch0Verifications, 1000);

      const batch1Verifications: AiCriteriaVerification[] = batches[1].map((c) => ({
        criterionId: c.criterionId,
        status: 'AI_VERIFIED_PASS' as const,
        confidence: 88,
        reasoning: `Batch 1 completed.`,
      }));
      await procCheckpointMgr.markBatchComplete(scanId, 1, batch1Verifications, 1200);

      // Create downloaded site
      const downloadedSite = createDownloadedSite(accessiblePage, {
        scanId,
        url,
        wcagLevel,
        pageTitle: 'Resume Verify Test',
      });

      const existingIssues = createMockExistingIssues();

      // Set up mock AI responses for ONLY the remaining batches (2, 3, 4)
      const mockResponses: InvocationResult[] = [2, 3, 4].map((batchIdx) => {
        const batchCriteriaIds = batches[batchIdx].map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(batchIdx, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          2000
        );
      });

      mockAiResponseSequence(mockResponses);

      // Process criteria batches - should resume from checkpoint
      const results = await processor.processCriteriaBatches(downloadedSite, existingIssues, wcagLevel);

      // Verify only 3 batches were processed (not 5)
      // The results array contains only newly processed batches
      expect(results).toHaveLength(3);

      // Verify AI was called exactly 3 times (batches 2, 3, 4)
      expect(invokeClaudeCode).toHaveBeenCalledTimes(3);

      // Verify the batch numbers in results are correct (3, 4, 5 in 1-indexed)
      expect(results[0].batchNumber).toBe(3); // Batch index 2 -> number 3
      expect(results[1].batchNumber).toBe(4); // Batch index 3 -> number 4
      expect(results[2].batchNumber).toBe(5); // Batch index 4 -> number 5

      // Verify checkpoint is cleared after successful completion
      const finalCheckpoint = await procCheckpointMgr.getCheckpoint(scanId);
      expect(finalCheckpoint).toBeNull();
    });

    it('should produce same final result as fresh run when merging checkpoint data', async () => {
      const scanId = 'merge-verify-scan-003';
      const wcagLevel = 'AA' as const;
      const url = 'https://example.com/merge-verify';

      processor = await createProcessorWithCheckpoint();
      const batches = processor.createBatches(wcagLevel);
      const totalBatches = batches.length;
      const procCheckpointMgr = processor.getCheckpointManager();

      // Set up consistent mock responses for ALL batches (for comparison)
      const allBatchResponses: { criteriaVerifications: AiCriteriaVerification[] }[] = batches.map(
        (batch, index) => createMockBatchResponse(index, batch.map((c) => c.criterionId), 'AI_VERIFIED_PASS')
      );

      // Create downloaded site
      const downloadedSite = createDownloadedSite(accessiblePage, {
        scanId,
        url,
        wcagLevel,
        pageTitle: 'Merge Verify Test',
      });

      const existingIssues = createMockExistingIssues();

      // FRESH RUN: Process all batches from scratch
      const freshMockResponses = allBatchResponses.map((resp) =>
        createMockInvocationResult(resp, 2000)
      );
      mockAiResponseSequence(freshMockResponses);

      const freshResults = await processor.processCriteriaBatches(downloadedSite, existingIssues, wcagLevel);

      // Collect all verifications from fresh run
      const freshVerifications = freshResults.flatMap((r) => r.verifications);
      const freshCriteriaIds = freshVerifications.map((v) => v.criterionId).sort();

      // Clear mocks and cache for resumed run
      vi.mocked(invokeClaudeCode).mockClear();
      await processor.getCache().clearAll();

      // RESUMED RUN: Create checkpoint with first 2 batches already done
      const checkpoint = procCheckpointMgr.initCheckpoint(scanId, url, wcagLevel, totalBatches);
      await procCheckpointMgr.saveCheckpoint(checkpoint);

      // Mark batches 0 and 1 as complete with SAME verifications as fresh run
      await procCheckpointMgr.markBatchComplete(
        scanId,
        0,
        allBatchResponses[0].criteriaVerifications,
        1000
      );
      await procCheckpointMgr.markBatchComplete(
        scanId,
        1,
        allBatchResponses[1].criteriaVerifications,
        1000
      );

      // Get the checkpoint to access partial verifications
      const resumeCheckpoint = await procCheckpointMgr.getCheckpoint(scanId);
      expect(resumeCheckpoint).not.toBeNull();

      // Set up mock responses for remaining batches (2, 3, 4)
      const remainingMockResponses = [2, 3, 4].map((idx) =>
        createMockInvocationResult(allBatchResponses[idx], 2000)
      );
      mockAiResponseSequence(remainingMockResponses);

      // Process with resume
      const resumeResults = await processor.processCriteriaBatches(downloadedSite, existingIssues, wcagLevel);

      // Merge checkpoint partial verifications with newly processed results
      const checkpointVerifications = resumeCheckpoint!.partialVerifications;
      const newVerifications = resumeResults.flatMap((r) => r.verifications);
      const mergedVerifications = [...checkpointVerifications, ...newVerifications];
      const mergedCriteriaIds = mergedVerifications.map((v) => v.criterionId).sort();

      // Verify merged results match fresh run
      expect(mergedCriteriaIds).toEqual(freshCriteriaIds);
      expect(mergedVerifications).toHaveLength(freshVerifications.length);

      // Verify same criteria were verified
      expect(mergedVerifications).toHaveLength(50); // All 50 AA criteria
    });
  });

  describe('Fresh start behavior (--fresh flag)', () => {
    it('should ignore existing checkpoint when starting fresh', async () => {
      const scanId = 'fresh-start-scan-004';
      const wcagLevel = 'AA' as const;
      const url = 'https://example.com/fresh-start';

      processor = await createProcessorWithCheckpoint();
      const batches = processor.createBatches(wcagLevel);
      const totalBatches = batches.length;

      // Get the processor's checkpoint manager
      const procCheckpointMgr = processor.getCheckpointManager();

      // Create a checkpoint with 3 batches already completed
      const existingCheckpoint = procCheckpointMgr.initCheckpoint(scanId, url, wcagLevel, totalBatches);
      await procCheckpointMgr.saveCheckpoint(existingCheckpoint);

      // Mark batches 0, 1, 2 as complete
      for (let i = 0; i < 3; i++) {
        const verifications: AiCriteriaVerification[] = batches[i].map((c) => ({
          criterionId: c.criterionId,
          status: 'AI_VERIFIED_PASS' as const,
          confidence: 85,
          reasoning: `Batch ${i} was previously completed.`,
        }));
        await procCheckpointMgr.markBatchComplete(scanId, i, verifications, 1000);
      }

      // Verify checkpoint exists with 3 completed batches
      const checkpointBefore = await procCheckpointMgr.getCheckpoint(scanId);
      expect(checkpointBefore).not.toBeNull();
      expect(checkpointBefore!.completedBatches).toHaveLength(3);

      // Simulate --fresh flag by clearing the checkpoint before processing
      await procCheckpointMgr.clearCheckpoint(scanId);

      // Verify checkpoint is cleared
      const checkpointAfterClear = await procCheckpointMgr.getCheckpoint(scanId);
      expect(checkpointAfterClear).toBeNull();

      // Create downloaded site
      const downloadedSite = createDownloadedSite(accessiblePage, {
        scanId,
        url,
        wcagLevel,
        pageTitle: 'Fresh Start Test',
      });

      const existingIssues = createMockExistingIssues();

      // Set up mock AI responses for ALL 5 batches (fresh start)
      const mockResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          2000
        );
      });

      mockAiResponseSequence(mockResponses);

      // Process criteria batches - should process all 5 batches
      const results = await processor.processCriteriaBatches(downloadedSite, existingIssues, wcagLevel);

      // Verify ALL 5 batches were processed (not just 2)
      expect(results).toHaveLength(5);

      // Verify AI was called exactly 5 times
      expect(invokeClaudeCode).toHaveBeenCalledTimes(5);

      // Verify all 50 criteria were verified
      const totalVerified = results.reduce((sum, r) => sum + r.criteriaVerified, 0);
      expect(totalVerified).toBe(50);
    });

    it('should process all batches on fresh run even when checkpoint exists for same URL', async () => {
      const scanId = 'fresh-overwrite-scan-005';
      const wcagLevel = 'AA' as const;
      const url = 'https://example.com/fresh-overwrite';

      processor = await createProcessorWithCheckpoint();
      const batches = processor.createBatches(wcagLevel);
      const totalBatches = batches.length;

      const procCheckpointMgr = processor.getCheckpointManager();

      // Create an old checkpoint with different state
      const oldCheckpoint = procCheckpointMgr.initCheckpoint(scanId, url, wcagLevel, totalBatches);
      await procCheckpointMgr.saveCheckpoint(oldCheckpoint);

      // Mark only batch 0 as complete in old checkpoint
      const oldVerifications: AiCriteriaVerification[] = batches[0].map((c) => ({
        criterionId: c.criterionId,
        status: 'AI_VERIFIED_FAIL' as const, // Different status than fresh run
        confidence: 50,
        reasoning: `Old batch 0 result (should be ignored).`,
      }));
      await procCheckpointMgr.markBatchComplete(scanId, 0, oldVerifications, 500);

      // Verify old checkpoint exists
      const oldCheckpointData = await procCheckpointMgr.getCheckpoint(scanId);
      expect(oldCheckpointData).not.toBeNull();
      expect(oldCheckpointData!.completedBatches).toEqual([0]);

      // Clear checkpoint to simulate --fresh flag
      await procCheckpointMgr.clearCheckpoint(scanId);

      // Create downloaded site
      const downloadedSite = createDownloadedSite(accessiblePage, {
        scanId,
        url,
        wcagLevel,
        pageTitle: 'Fresh Overwrite Test',
      });

      const existingIssues = createMockExistingIssues();

      // Set up mock AI responses for ALL 5 batches with PASS status
      const mockResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          2000
        );
      });

      mockAiResponseSequence(mockResponses);

      // Process criteria batches
      const results = await processor.processCriteriaBatches(downloadedSite, existingIssues, wcagLevel);

      // Verify all 5 batches were processed fresh
      expect(results).toHaveLength(5);
      expect(invokeClaudeCode).toHaveBeenCalledTimes(5);

      // Verify all results are PASS (not the FAIL from old checkpoint)
      results.forEach((result) => {
        result.verifications.forEach((v) => {
          expect(v.status).toBe('AI_VERIFIED_PASS');
        });
      });

      // Verify checkpoint is cleared after successful completion
      const finalCheckpoint = await procCheckpointMgr.getCheckpoint(scanId);
      expect(finalCheckpoint).toBeNull();
    });
  });

  describe('Checkpoint state management', () => {
    it('should correctly track token usage across interrupted and resumed runs', async () => {
      const scanId = 'token-tracking-resume-006';
      const wcagLevel = 'AA' as const;
      const url = 'https://example.com/token-tracking-resume';

      const checkpointMgr = new CriteriaCheckpointManager(testCheckpointDir);

      processor = await createProcessorWithCheckpoint();
      const batches = processor.createBatches(wcagLevel);
      const totalBatches = batches.length;

      // Initialize checkpoint
      const checkpoint = checkpointMgr.initCheckpoint(scanId, url, wcagLevel, totalBatches);
      await checkpointMgr.saveCheckpoint(checkpoint);

      // Mark batch 0 complete with 1500 tokens
      const batch0Verifications: AiCriteriaVerification[] = batches[0].map((c) => ({
        criterionId: c.criterionId,
        status: 'AI_VERIFIED_PASS' as const,
        confidence: 85,
        reasoning: `Batch 0 verification.`,
      }));
      await checkpointMgr.markBatchComplete(scanId, 0, batch0Verifications, 1500);

      // Mark batch 1 complete with 1800 tokens
      const batch1Verifications: AiCriteriaVerification[] = batches[1].map((c) => ({
        criterionId: c.criterionId,
        status: 'AI_VERIFIED_PASS' as const,
        confidence: 88,
        reasoning: `Batch 1 verification.`,
      }));
      await checkpointMgr.markBatchComplete(scanId, 1, batch1Verifications, 1800);

      // Verify accumulated token usage
      const checkpointAfter2Batches = await checkpointMgr.getCheckpoint(scanId);
      expect(checkpointAfter2Batches).not.toBeNull();
      expect(checkpointAfter2Batches!.tokensUsed).toBe(3300); // 1500 + 1800

      // Mark batch 2 complete with 2000 tokens
      const batch2Verifications: AiCriteriaVerification[] = batches[2].map((c) => ({
        criterionId: c.criterionId,
        status: 'AI_VERIFIED_PASS' as const,
        confidence: 90,
        reasoning: `Batch 2 verification.`,
      }));
      await checkpointMgr.markBatchComplete(scanId, 2, batch2Verifications, 2000);

      // Verify total token usage after 3 batches
      const checkpointAfter3Batches = await checkpointMgr.getCheckpoint(scanId);
      expect(checkpointAfter3Batches!.tokensUsed).toBe(5300); // 1500 + 1800 + 2000
    });

    it('should maintain partial verifications correctly during multi-batch interruption', async () => {
      const scanId = 'partial-verifications-007';
      const wcagLevel = 'AA' as const;
      const url = 'https://example.com/partial-verifications';

      const checkpointMgr = new CriteriaCheckpointManager(testCheckpointDir);

      processor = await createProcessorWithCheckpoint();
      const batches = processor.createBatches(wcagLevel);
      const totalBatches = batches.length;

      // Initialize checkpoint
      const checkpoint = checkpointMgr.initCheckpoint(scanId, url, wcagLevel, totalBatches);
      await checkpointMgr.saveCheckpoint(checkpoint);

      // Mark first 2 batches complete with different verification results
      const batch0Verifications: AiCriteriaVerification[] = batches[0].map((c) => ({
        criterionId: c.criterionId,
        status: 'AI_VERIFIED_PASS' as const,
        confidence: 85,
        reasoning: `Batch 0: Criterion ${c.criterionId} passed.`,
      }));
      await checkpointMgr.markBatchComplete(scanId, 0, batch0Verifications, 1000);

      const batch1Verifications: AiCriteriaVerification[] = batches[1].map((c, idx) => ({
        criterionId: c.criterionId,
        status: idx % 2 === 0 ? 'AI_VERIFIED_PASS' as const : 'AI_VERIFIED_FAIL' as const,
        confidence: 80 + idx,
        reasoning: `Batch 1: Criterion ${c.criterionId} ${idx % 2 === 0 ? 'passed' : 'failed'}.`,
      }));
      await checkpointMgr.markBatchComplete(scanId, 1, batch1Verifications, 1200);

      // Verify partial verifications are preserved
      const checkpointData = await checkpointMgr.getCheckpoint(scanId);
      expect(checkpointData).not.toBeNull();
      expect(checkpointData!.partialVerifications).toHaveLength(20); // 10 + 10

      // Verify verification details are preserved
      const batch0StoredIds = checkpointData!.partialVerifications
        .slice(0, 10)
        .map((v) => v.criterionId);
      const batch0OriginalIds = batch0Verifications.map((v) => v.criterionId);
      expect(batch0StoredIds).toEqual(batch0OriginalIds);

      // Verify mixed statuses in batch 1 are preserved
      const batch1Stored = checkpointData!.partialVerifications.slice(10, 20);
      const passCount = batch1Stored.filter((v) => v.status === 'AI_VERIFIED_PASS').length;
      const failCount = batch1Stored.filter((v) => v.status === 'AI_VERIFIED_FAIL').length;
      expect(passCount).toBe(5); // Even indices pass
      expect(failCount).toBe(5); // Odd indices fail
    });

    it('should handle edge case of resuming with all batches already complete', async () => {
      const scanId = 'all-complete-resume-008';
      const wcagLevel = 'AA' as const;
      const url = 'https://example.com/all-complete';

      processor = await createProcessorWithCheckpoint();
      const batches = processor.createBatches(wcagLevel);
      const totalBatches = batches.length;

      const procCheckpointMgr = processor.getCheckpointManager();

      // Create checkpoint with ALL batches marked complete
      const checkpoint = procCheckpointMgr.initCheckpoint(scanId, url, wcagLevel, totalBatches);
      await procCheckpointMgr.saveCheckpoint(checkpoint);

      // Mark all 5 batches as complete
      for (let i = 0; i < totalBatches; i++) {
        const verifications: AiCriteriaVerification[] = batches[i].map((c) => ({
          criterionId: c.criterionId,
          status: 'AI_VERIFIED_PASS' as const,
          confidence: 85,
          reasoning: `Batch ${i} completed.`,
        }));
        await procCheckpointMgr.markBatchComplete(scanId, i, verifications, 1000);
      }

      // Verify checkpoint has all batches complete
      const checkpointData = await procCheckpointMgr.getCheckpoint(scanId);
      expect(checkpointData!.completedBatches).toHaveLength(5);

      // Get incomplete batches - should be empty
      const incompleteBatches = procCheckpointMgr.getIncompleteBatches(checkpointData!);
      expect(incompleteBatches).toEqual([]);

      // Create downloaded site
      const downloadedSite = createDownloadedSite(accessiblePage, {
        scanId,
        url,
        wcagLevel,
        pageTitle: 'All Complete Resume Test',
      });

      const existingIssues = createMockExistingIssues();

      // Process criteria batches - should skip all batches
      const results = await processor.processCriteriaBatches(downloadedSite, existingIssues, wcagLevel);

      // Verify no batches were processed (all skipped)
      expect(results).toHaveLength(0);

      // Verify AI was never called
      expect(invokeClaudeCode).not.toHaveBeenCalled();

      // Verify checkpoint is cleared (all batches complete)
      const finalCheckpoint = await procCheckpointMgr.getCheckpoint(scanId);
      expect(finalCheckpoint).toBeNull();
    });
  });
});

// =============================================================================
// Cache Effectiveness Integration Tests
// =============================================================================

import { CriteriaVerificationCache } from './criteria-verification-cache.js';

describe('Cache Effectiveness Integration Tests', () => {
  let testCacheDir: string;
  let testCheckpointDir: string;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let processor: CriteriaBatchProcessor;

  beforeEach(async () => {
    // Create unique temporary directories for each test
    testCacheDir = await mkdtemp(join(tmpdir(), 'cache-effectiveness-cache-'));
    testCheckpointDir = await mkdtemp(join(tmpdir(), 'cache-effectiveness-checkpoint-'));
    mockLogger = createMockLogger();

    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Restore all mocks
    vi.restoreAllMocks();

    // Clear the verification instructions cache between tests
    promptGenerator.clearVerificationInstructionsCache();

    // Clean up test directories
    try {
      await rm(testCacheDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    try {
      await rm(testCheckpointDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /**
   * Helper to create a processor for cache effectiveness tests
   */
  async function createProcessorForCacheTests(): Promise<CriteriaBatchProcessor> {
    const proc = new CriteriaBatchProcessor(mockLogger, {
      batchSize: 10,
      delayBetweenBatches: 0, // No delay for faster tests
      timeout: 5000,
    });

    await proc.initialize();

    // Clear cache to ensure fresh state for each test
    await proc.getCache().clearAll();

    return proc;
  }

  describe('Cache hit on second processing of identical content', () => {
    it('should use cache on second run with zero AI calls', async () => {
      processor = await createProcessorForCacheTests();

      const downloadedSite = createDownloadedSite(accessiblePage, {
        scanId: 'cache-hit-test-001',
        url: 'https://example.com/cache-hit-test',
        wcagLevel: 'AA',
        pageTitle: 'Cache Hit Test Page',
      });

      const existingIssues = createMockExistingIssues();
      const batches = processor.createBatches('AA');

      // Set up mock AI responses for first run (5 batches)
      const firstRunMockResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          3000
        );
      });

      mockAiResponseSequence(firstRunMockResponses);

      // FIRST RUN: Should call AI 5 times
      const results1 = await processor.processCriteriaBatches(
        downloadedSite,
        existingIssues,
        'AA'
      );

      expect(results1).toHaveLength(5);
      expect(invokeClaudeCode).toHaveBeenCalledTimes(5);

      // Verify tokens were used (non-zero)
      const firstRunTokens = results1.reduce((sum, r) => sum + r.tokensUsed, 0);
      expect(firstRunTokens).toBeGreaterThan(0);

      // Reset mock call count for second run
      vi.mocked(invokeClaudeCode).mockClear();

      // Create new site with IDENTICAL content but different scan ID
      const downloadedSite2 = createDownloadedSite(accessiblePage, {
        scanId: 'cache-hit-test-002',
        url: 'https://example.com/cache-hit-test',
        wcagLevel: 'AA',
        pageTitle: 'Cache Hit Test Page',
      });

      // SECOND RUN: Should use cache with 0 AI calls
      const results2 = await processor.processCriteriaBatches(
        downloadedSite2,
        existingIssues,
        'AA'
      );

      expect(results2).toHaveLength(5);

      // CRITICAL: Verify NO AI calls were made
      expect(invokeClaudeCode).toHaveBeenCalledTimes(0);

      // Verify all 50 criteria were returned from cache
      const totalVerified = results2.reduce((sum, r) => sum + r.criteriaVerified, 0);
      expect(totalVerified).toBe(50);

      // Verify tokens used is 0 for all cached results
      results2.forEach((result) => {
        expect(result.tokensUsed).toBe(0);
      });

      // Verify results are consistent between runs
      expect(results2.map(r => r.verifications.length)).toEqual(
        results1.map(r => r.verifications.length)
      );
    });

    it('should log cache hits for each batch on second run', async () => {
      processor = await createProcessorForCacheTests();

      const downloadedSite = createDownloadedSite(minimalPage, {
        scanId: 'cache-log-test-001',
        url: 'https://example.com/cache-log-test',
        wcagLevel: 'A', // Level A = 30 criteria = 3 batches
        pageTitle: 'Cache Log Test Page',
      });

      const existingIssues: ExistingIssue[] = [];
      const batches = processor.createBatches('A');

      // Set up mock AI responses for first run (3 batches for Level A)
      const firstRunMockResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          2000
        );
      });

      mockAiResponseSequence(firstRunMockResponses);

      // First run
      await processor.processCriteriaBatches(downloadedSite, existingIssues, 'A');

      // Clear logger messages for second run
      mockLogger.messages.length = 0;
      vi.mocked(invokeClaudeCode).mockClear();

      // Second run - should produce cache hit logs
      const downloadedSite2 = createDownloadedSite(minimalPage, {
        scanId: 'cache-log-test-002',
        url: 'https://example.com/cache-log-test',
        wcagLevel: 'A',
        pageTitle: 'Cache Log Test Page',
      });

      await processor.processCriteriaBatches(downloadedSite2, existingIssues, 'A');

      // Verify cache hit was logged for each batch
      const cacheHitLogs = mockLogger.messages.filter(
        (m) => m.level === 'info' && m.message.includes('Cache hit for batch')
      );
      expect(cacheHitLogs).toHaveLength(3); // 3 batches for Level A

      // Verify no AI calls
      expect(invokeClaudeCode).not.toHaveBeenCalled();
    });
  });

  describe('Token savings tracking in cache stats', () => {
    it('should correctly track tokens saved from cache hits', async () => {
      processor = await createProcessorForCacheTests();
      const cache = processor.getCache();

      const downloadedSite = createDownloadedSite(accessiblePage, {
        scanId: 'token-stats-test-001',
        url: 'https://example.com/token-stats-test',
        wcagLevel: 'AA',
        pageTitle: 'Token Stats Test Page',
      });

      const existingIssues = createMockExistingIssues();
      const batches = processor.createBatches('AA');

      // Set up mock AI responses
      const mockResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          2500
        );
      });

      mockAiResponseSequence(mockResponses);

      // Initial stats (after clearAll)
      const initialStats = cache.getStats();
      expect(initialStats.hits).toBe(0);
      expect(initialStats.misses).toBe(0);
      expect(initialStats.totalSavedTokens).toBe(0);

      // First run - should have cache misses
      const results1 = await processor.processCriteriaBatches(
        downloadedSite,
        existingIssues,
        'AA'
      );

      // Check stats after first run (all misses)
      const statsAfterFirstRun = cache.getStats();
      expect(statsAfterFirstRun.misses).toBe(5); // 5 batches = 5 misses
      expect(statsAfterFirstRun.hits).toBe(0);
      expect(statsAfterFirstRun.hitRate).toBe(0);

      // Calculate tokens used in first run
      const firstRunTokens = results1.reduce((sum, r) => sum + r.tokensUsed, 0);
      expect(firstRunTokens).toBeGreaterThan(0);

      // Second run with same content
      const downloadedSite2 = createDownloadedSite(accessiblePage, {
        scanId: 'token-stats-test-002',
        url: 'https://example.com/token-stats-test',
        wcagLevel: 'AA',
        pageTitle: 'Token Stats Test Page',
      });

      vi.mocked(invokeClaudeCode).mockClear();

      await processor.processCriteriaBatches(downloadedSite2, existingIssues, 'AA');

      // Check stats after second run (all hits)
      const statsAfterSecondRun = cache.getStats();
      expect(statsAfterSecondRun.hits).toBe(5); // 5 batches = 5 hits
      expect(statsAfterSecondRun.misses).toBe(5); // From first run
      expect(statsAfterSecondRun.hitRate).toBe(0.5); // 5 hits / 10 total

      // Verify tokens saved is reported correctly
      // totalSavedTokens should be > 0 because cache hits return tokensUsed from cached entry
      expect(statsAfterSecondRun.totalSavedTokens).toBeGreaterThan(0);
    });

    it('should report accurate hit rate after multiple runs', async () => {
      processor = await createProcessorForCacheTests();
      const cache = processor.getCache();

      // Use Level A (30 criteria = 3 batches) for simpler calculations
      const downloadedSite = createDownloadedSite(minimalPage, {
        scanId: 'hit-rate-test-001',
        url: 'https://example.com/hit-rate-test',
        wcagLevel: 'A',
        pageTitle: 'Hit Rate Test Page',
      });

      const existingIssues: ExistingIssue[] = [];
      const batches = processor.createBatches('A');

      // Set up mock responses for 3 batches
      const mockResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          1500
        );
      });

      mockAiResponseSequence(mockResponses);

      // First run: 3 misses
      await processor.processCriteriaBatches(downloadedSite, existingIssues, 'A');
      expect(cache.getStats().misses).toBe(3);
      expect(cache.getStats().hits).toBe(0);
      expect(cache.getStats().hitRate).toBe(0);

      // Second run: 3 hits
      const downloadedSite2 = createDownloadedSite(minimalPage, {
        scanId: 'hit-rate-test-002',
        url: 'https://example.com/hit-rate-test',
        wcagLevel: 'A',
        pageTitle: 'Hit Rate Test Page',
      });
      await processor.processCriteriaBatches(downloadedSite2, existingIssues, 'A');
      expect(cache.getStats().misses).toBe(3);
      expect(cache.getStats().hits).toBe(3);
      expect(cache.getStats().hitRate).toBe(0.5); // 3 hits / 6 total

      // Third run: 3 more hits
      const downloadedSite3 = createDownloadedSite(minimalPage, {
        scanId: 'hit-rate-test-003',
        url: 'https://example.com/hit-rate-test',
        wcagLevel: 'A',
        pageTitle: 'Hit Rate Test Page',
      });
      await processor.processCriteriaBatches(downloadedSite3, existingIssues, 'A');
      expect(cache.getStats().misses).toBe(3);
      expect(cache.getStats().hits).toBe(6);

      // Hit rate: 6 hits / 9 total = 0.666...
      const finalStats = cache.getStats();
      expect(finalStats.hitRate).toBeCloseTo(0.667, 2);
    });
  });

  describe('--no-cache flag behavior (cache bypass)', () => {
    it('should bypass cache and always call AI when noCache is simulated', async () => {
      processor = await createProcessorForCacheTests();

      const downloadedSite = createDownloadedSite(accessiblePage, {
        scanId: 'no-cache-test-001',
        url: 'https://example.com/no-cache-test',
        wcagLevel: 'AA',
        pageTitle: 'No Cache Test Page',
      });

      const existingIssues = createMockExistingIssues();
      const batches = processor.createBatches('AA');

      // Set up mock AI responses for first run
      const firstRunResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          2000
        );
      });

      mockAiResponseSequence(firstRunResponses);

      // First run - populates cache
      await processor.processCriteriaBatches(downloadedSite, existingIssues, 'AA');
      expect(invokeClaudeCode).toHaveBeenCalledTimes(5);

      vi.mocked(invokeClaudeCode).mockClear();

      // Simulate --no-cache by clearing cache before second run
      // (In actual CLI implementation, --no-cache would skip cache lookup)
      await processor.getCache().clearAll();

      // Set up mock responses for second run
      const secondRunResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          2000
        );
      });

      mockAiResponseSequence(secondRunResponses);

      // Second run with "no-cache" (cache was cleared)
      const downloadedSite2 = createDownloadedSite(accessiblePage, {
        scanId: 'no-cache-test-002',
        url: 'https://example.com/no-cache-test',
        wcagLevel: 'AA',
        pageTitle: 'No Cache Test Page',
      });

      const results = await processor.processCriteriaBatches(
        downloadedSite2,
        existingIssues,
        'AA'
      );

      // CRITICAL: AI should be called again (not using cache)
      expect(invokeClaudeCode).toHaveBeenCalledTimes(5);

      // Verify all batches were processed with tokens
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.tokensUsed).toBeGreaterThan(0);
      });
    });

    it('should show cache misses when noCache is active', async () => {
      processor = await createProcessorForCacheTests();
      const cache = processor.getCache();

      const downloadedSite = createDownloadedSite(minimalPage, {
        scanId: 'no-cache-misses-test-001',
        url: 'https://example.com/no-cache-misses',
        wcagLevel: 'A',
        pageTitle: 'No Cache Misses Test',
      });

      const existingIssues: ExistingIssue[] = [];
      const batches = processor.createBatches('A');

      // Set up mock responses for 2 runs
      const allResponses: InvocationResult[] = [];
      for (let run = 0; run < 2; run++) {
        batches.forEach((batch, index) => {
          const batchCriteriaIds = batch.map((c) => c.criterionId);
          allResponses.push(
            createMockInvocationResult(
              createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
              1500
            )
          );
        });
      }

      mockAiResponseSequence(allResponses);

      // First run
      await processor.processCriteriaBatches(downloadedSite, existingIssues, 'A');

      // Clear cache (simulate --no-cache)
      await cache.clearAll();

      // Second run - should have all misses since cache was cleared
      const downloadedSite2 = createDownloadedSite(minimalPage, {
        scanId: 'no-cache-misses-test-002',
        url: 'https://example.com/no-cache-misses',
        wcagLevel: 'A',
        pageTitle: 'No Cache Misses Test',
      });

      await processor.processCriteriaBatches(downloadedSite2, existingIssues, 'A');

      // After clearAll, stats are reset. So we only see stats from second run.
      const stats = cache.getStats();
      expect(stats.misses).toBe(3); // All 3 batches were misses
      expect(stats.hits).toBe(0);
    });
  });

  describe('--clear-cache flag behavior (clear all entries)', () => {
    it('should clear all cached entries before processing', async () => {
      processor = await createProcessorForCacheTests();
      const cache = processor.getCache();

      const downloadedSite = createDownloadedSite(accessiblePage, {
        scanId: 'clear-cache-test-001',
        url: 'https://example.com/clear-cache-test',
        wcagLevel: 'AA',
        pageTitle: 'Clear Cache Test Page',
      });

      const existingIssues = createMockExistingIssues();
      const batches = processor.createBatches('AA');

      // Set up mock responses for multiple runs
      const allResponses: InvocationResult[] = [];
      for (let run = 0; run < 2; run++) {
        batches.forEach((batch, index) => {
          const batchCriteriaIds = batch.map((c) => c.criterionId);
          allResponses.push(
            createMockInvocationResult(
              createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
              2000
            )
          );
        });
      }

      mockAiResponseSequence(allResponses);

      // First run - populates cache
      await processor.processCriteriaBatches(downloadedSite, existingIssues, 'AA');

      // Verify cache has entries
      const statsBeforeClear = cache.getStats();
      expect(statsBeforeClear.entriesCount).toBe(5);

      // Simulate --clear-cache flag by calling clearAll()
      await cache.clearAll();

      // Verify cache is empty
      const statsAfterClear = cache.getStats();
      expect(statsAfterClear.entriesCount).toBe(0);
      expect(statsAfterClear.hits).toBe(0);
      expect(statsAfterClear.misses).toBe(0);
      expect(statsAfterClear.totalSavedTokens).toBe(0);

      // Second run - should call AI for all batches
      const downloadedSite2 = createDownloadedSite(accessiblePage, {
        scanId: 'clear-cache-test-002',
        url: 'https://example.com/clear-cache-test',
        wcagLevel: 'AA',
        pageTitle: 'Clear Cache Test Page',
      });

      vi.mocked(invokeClaudeCode).mockClear();
      const results = await processor.processCriteriaBatches(
        downloadedSite2,
        existingIssues,
        'AA'
      );

      // All 5 batches should have called AI
      expect(invokeClaudeCode).toHaveBeenCalledTimes(5);

      // All batches should have non-zero tokens (fresh processing)
      results.forEach((result) => {
        expect(result.tokensUsed).toBeGreaterThan(0);
      });

      // Cache should now have entries again
      const statsAfterSecondRun = cache.getStats();
      expect(statsAfterSecondRun.entriesCount).toBe(5);
    });

    it('should reset all statistics after clearAll', async () => {
      processor = await createProcessorForCacheTests();
      const cache = processor.getCache();

      // Manually populate some cache entries
      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      for (let i = 0; i < 3; i++) {
        const key = cache.generateKey(htmlContent, 'AA', i);
        const verifications: AiCriteriaVerification[] = [
          {
            criterionId: '1.1.1',
            status: 'AI_VERIFIED_PASS',
            confidence: 85,
            reasoning: 'Test verification',
          },
        ];
        await cache.set(key, verifications, 1500, 'claude-opus-4');
      }

      // Generate some hits and misses
      await cache.get(cache.generateKey(htmlContent, 'AA', 0)); // Hit
      await cache.get(cache.generateKey(htmlContent, 'AA', 1)); // Hit
      await cache.get(cache.generateKey('<other>', 'AA', 0)); // Miss

      // Verify stats before clear
      const statsBefore = cache.getStats();
      expect(statsBefore.entriesCount).toBe(3);
      expect(statsBefore.hits).toBe(2);
      expect(statsBefore.misses).toBe(1);
      expect(statsBefore.totalSavedTokens).toBe(3000); // 1500 * 2 hits

      // Clear all
      await cache.clearAll();

      // Verify all stats are reset
      const statsAfter = cache.getStats();
      expect(statsAfter.entriesCount).toBe(0);
      expect(statsAfter.hits).toBe(0);
      expect(statsAfter.misses).toBe(0);
      expect(statsAfter.hitRate).toBe(0);
      expect(statsAfter.totalSavedTokens).toBe(0);
    });
  });

  describe('Cache statistics accuracy', () => {
    it('should accurately count entries after batch processing', async () => {
      processor = await createProcessorForCacheTests();
      const cache = processor.getCache();

      const downloadedSite = createDownloadedSite(accessiblePage, {
        scanId: 'entries-count-test-001',
        url: 'https://example.com/entries-count-test',
        wcagLevel: 'AA',
        pageTitle: 'Entries Count Test',
      });

      const existingIssues = createMockExistingIssues();
      const batches = processor.createBatches('AA');

      // Set up mock responses
      const mockResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          2000
        );
      });

      mockAiResponseSequence(mockResponses);

      // Process batches
      await processor.processCriteriaBatches(downloadedSite, existingIssues, 'AA');

      // Verify exact entry count (5 batches = 5 cache entries)
      const stats = cache.getStats();
      expect(stats.entriesCount).toBe(5);
    });

    it('should not double-count entries on multiple runs with same content', async () => {
      processor = await createProcessorForCacheTests();
      const cache = processor.getCache();

      const downloadedSite = createDownloadedSite(minimalPage, {
        scanId: 'double-count-test-001',
        url: 'https://example.com/double-count-test',
        wcagLevel: 'A',
        pageTitle: 'Double Count Test',
      });

      const existingIssues: ExistingIssue[] = [];
      const batches = processor.createBatches('A');

      // Set up mock responses
      const mockResponses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          1500
        );
      });

      mockAiResponseSequence(mockResponses);

      // First run
      await processor.processCriteriaBatches(downloadedSite, existingIssues, 'A');
      expect(cache.getStats().entriesCount).toBe(3);

      // Second run with same content
      const downloadedSite2 = createDownloadedSite(minimalPage, {
        scanId: 'double-count-test-002',
        url: 'https://example.com/double-count-test',
        wcagLevel: 'A',
        pageTitle: 'Double Count Test',
      });

      await processor.processCriteriaBatches(downloadedSite2, existingIssues, 'A');

      // Entry count should still be 3 (no new entries, all cache hits)
      expect(cache.getStats().entriesCount).toBe(3);
    });

    it('should correctly handle mixed content (some cached, some new)', async () => {
      processor = await createProcessorForCacheTests();
      const cache = processor.getCache();

      const existingIssues = createMockExistingIssues();
      const batches = processor.createBatches('A');

      // First: Process page1
      const page1 = createDownloadedSite(minimalPage, {
        scanId: 'mixed-test-001',
        url: 'https://example.com/page1',
        wcagLevel: 'A',
        pageTitle: 'Page 1',
      });

      const page1Responses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          1500
        );
      });

      mockAiResponseSequence(page1Responses);
      await processor.processCriteriaBatches(page1, existingIssues, 'A');

      expect(cache.getStats().entriesCount).toBe(3);
      expect(cache.getStats().misses).toBe(3);
      expect(cache.getStats().hits).toBe(0);

      vi.mocked(invokeClaudeCode).mockClear();

      // Second: Process page2 (different content)
      const page2 = createDownloadedSite(accessiblePage, {
        scanId: 'mixed-test-002',
        url: 'https://example.com/page2',
        wcagLevel: 'A',
        pageTitle: 'Page 2',
      });

      const page2Responses: InvocationResult[] = batches.map((batch, index) => {
        const batchCriteriaIds = batch.map((c) => c.criterionId);
        return createMockInvocationResult(
          createMockBatchResponse(index, batchCriteriaIds, 'AI_VERIFIED_PASS'),
          1500
        );
      });

      mockAiResponseSequence(page2Responses);
      await processor.processCriteriaBatches(page2, existingIssues, 'A');

      expect(cache.getStats().entriesCount).toBe(6); // 3 + 3
      expect(cache.getStats().misses).toBe(6); // 3 + 3 misses (different content)
      expect(invokeClaudeCode).toHaveBeenCalledTimes(3); // AI called for page2

      vi.mocked(invokeClaudeCode).mockClear();

      // Third: Process page1 again (should be all cache hits)
      const page1Again = createDownloadedSite(minimalPage, {
        scanId: 'mixed-test-003',
        url: 'https://example.com/page1',
        wcagLevel: 'A',
        pageTitle: 'Page 1',
      });

      await processor.processCriteriaBatches(page1Again, existingIssues, 'A');

      expect(cache.getStats().entriesCount).toBe(6); // Still 6
      expect(cache.getStats().hits).toBe(3); // 3 hits from page1 re-processing
      expect(cache.getStats().misses).toBe(6); // Still 6 misses
      expect(invokeClaudeCode).not.toHaveBeenCalled(); // No AI calls

      // Hit rate: 3 hits / 9 total = 0.333...
      expect(cache.getStats().hitRate).toBeCloseTo(0.333, 2);
    });
  });
});

// =============================================================================
// Exported Test Utilities (for use in other test files)
// =============================================================================

export {
  // HTML Fixtures
  sampleHtmlPage,
  accessiblePage,
  inaccessiblePage,
  minimalPage,
  // Mock Responses
  mockVerificationResponsePass,
  mockVerificationResponseFail,
  mockVerificationResponseMixed,
  // Helper Functions
  createMockLogger,
  createDownloadedSite,
  createMockExistingIssues,
  mockAiResponse,
  mockAiError,
  mockAiResponseSequence,
  createMockBatchResponse,
  createMockInvocationResult,
};
