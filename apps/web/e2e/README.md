# E2E Tests for ADAShield Web Application

This directory contains end-to-end tests for the ADAShield web application using Playwright Test.

## Test Files

- **scan-flow.spec.ts** - Tests the complete scan workflow
  - Submitting URLs for scanning
  - Viewing scan progress
  - Viewing results
  - Exporting results (PDF/JSON)
  - Error handling for invalid URLs

- **history.spec.ts** - Tests scan history functionality
  - Viewing past scans
  - Navigating to scan details
  - Empty state handling
  - Pagination

- **gdpr.spec.ts** - Tests GDPR compliance features
  - Data deletion flow
  - Privacy policy access
  - Cookie consent
  - Data export

- **export.spec.ts** - Tests user export functionality
  - Viewing scans with existing reports
  - Downloading existing PDF/JSON reports
  - Generating new reports when none exist
  - Modal progress display during generation
  - Error handling and retry mechanisms
  - Report generation cancellation

- **admin-export.spec.ts** - Tests admin export functionality
  - Admin access to export any scan
  - Export button on admin scan detail page
  - Modal progress in admin context
  - No ownership restrictions for admin
  - Disabled state for incomplete scans
  - Error handling in admin context

## Running Tests

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Playwright browsers (first time only):
   ```bash
   npx playwright install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   The app should be running on `http://localhost:3080`

### Run All Tests

```bash
# Headless mode (default)
npm run test:e2e

# With UI mode (interactive)
npm run test:e2e:ui

# Headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug
```

### Run Specific Test Files

```bash
# Run only scan flow tests
npx playwright test scan-flow

# Run only history tests
npx playwright test history

# Run only GDPR tests
npx playwright test gdpr
```

### Run Specific Browsers

```bash
# Run only on Chromium
npx playwright test --project=chromium

# Run only on Firefox
npx playwright test --project=firefox

# Run only on WebKit (Safari)
npx playwright test --project=webkit
```

### View Test Results

```bash
# Open HTML report
npm run test:e2e:report
```

## Test Configuration

Configuration is in `playwright.config.ts`:

- **Base URL**: `http://localhost:3080` (configurable via `PLAYWRIGHT_BASE_URL` env var)
- **Timeout**: 30 seconds per test
- **Retries**: 2 retries on CI, 0 locally
- **Screenshots**: On failure only
- **Videos**: Retained on failure
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari

## CI/CD Integration

For CI/CD pipelines:

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npm run test:e2e
  env:
    CI: true
    PLAYWRIGHT_BASE_URL: http://localhost:3080
```

## Debugging Failed Tests

1. **Screenshots**: Check `test-results/` directory for screenshots
2. **Videos**: Check `test-results/` for video recordings
3. **Traces**: View traces in Playwright trace viewer
4. **Debug Mode**: Run with `npm run test:e2e:debug` to step through tests

## Mocking API Responses

Tests use Playwright's `page.route()` to mock API responses. This allows testing without a backend server:

```typescript
await page.route('**/api/scans', async (route) => {
  await route.fulfill({
    status: 200,
    body: JSON.stringify({ scanId: 'test-123' }),
  });
});
```

## Best Practices

1. **Use Semantic Selectors**: Prefer `getByRole()`, `getByLabel()`, `getByText()` over CSS selectors
2. **Wait for Elements**: Use `expect().toBeVisible()` instead of arbitrary timeouts
3. **Mock External Services**: Mock APIs, reCAPTCHA, and other external dependencies
4. **Test User Journeys**: Test complete workflows, not just individual pages
5. **Handle Loading States**: Test intermediate states (loading, progress, etc.)
6. **Test Error Cases**: Include negative test cases (invalid input, API errors, etc.)

## Writing New Tests

1. Create a new `.spec.ts` file in the `e2e/` directory
2. Follow the existing test structure:
   ```typescript
   import { test, expect } from '@playwright/test';

   test.describe('Feature Name', () => {
     test.beforeEach(async ({ page }) => {
       // Setup code
     });

     test('should do something', async ({ page }) => {
       // Test code
     });
   });
   ```

3. Use descriptive test names that explain the expected behavior
4. Mock API responses for consistent test results
5. Add appropriate assertions to verify behavior

## Accessibility Testing

Consider adding accessibility tests using `@axe-core/playwright`:

```typescript
import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('should not have accessibility violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
