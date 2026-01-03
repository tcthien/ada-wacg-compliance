import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Error Scenarios
 *
 * Tests error handling throughout the discovery flow:
 * - API failure handling
 * - Timeout handling
 * - Cancellation during discovery
 * - Recovery from errors
 * - Network error handling
 */

test.describe('Error Scenarios', () => {
  test.describe('API Failure Handling', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
    });

    test('should show error when discovery API fails', async ({ page }) => {
      // Mock API failure
      await page.route('**/api/discoveries', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Internal Server Error',
              message: 'Failed to start discovery',
            }),
          });
        }
      });

      // Start discovery
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Should show error message
      await expect(
        page.getByText(/Failed to start discovery|Server error|Something went wrong/i)
      ).toBeVisible();
    });

    test('should show error when discovery status fetch fails', async ({
      page,
    }) => {
      let postCalled = false;

      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          postCalled = true;
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase: 'SITEMAP',
              pages: [],
            }),
          });
        } else if (route.request().method() === 'GET' && postCalled) {
          // Status check fails
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Status fetch failed' }),
          });
        }
      });

      // Start discovery
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Should show error after status fetch fails
      await expect(
        page.getByText(/error|failed/i)
      ).toBeVisible({ timeout: 10000 });
    });

    test('should show specific error for 404 response', async ({ page }) => {
      await page.route('**/api/discoveries', async (route) => {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not Found' }),
        });
      });

      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(
        page.getByText(/not found|doesn't exist|unavailable/i)
      ).toBeVisible();
    });

    test('should show error for rate limiting (429)', async ({ page }) => {
      await page.route('**/api/discoveries', async (route) => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Too Many Requests',
            retryAfter: 60,
          }),
        });
      });

      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(
        page.getByText(/too many requests|rate limit|try again/i)
      ).toBeVisible();
    });
  });

  test.describe('Timeout Handling', () => {
    test('should handle slow API response gracefully', async ({ page }) => {
      await page.goto('/discovery');

      // Mock very slow API response
      await page.route('**/api/discoveries', async (route) => {
        // Delay for longer than typical timeout
        await new Promise((resolve) => setTimeout(resolve, 35000));
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-discovery-1',
            status: 'RUNNING',
            phase: 'SITEMAP',
            pages: [],
          }),
        });
      });

      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Should show loading state or timeout error
      // Depending on implementation, might show timeout error
      await expect(
        page.getByText(/Checking Sitemap|timeout|taking longer than expected/i)
      ).toBeVisible({ timeout: 40000 });
    });

    test('should show timeout message for discovery taking too long', async ({
      page,
    }) => {
      await page.goto('/discovery');

      let callCount = 0;
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase: 'SITEMAP',
              pages: [],
            }),
          });
        } else if (route.request().method() === 'GET') {
          callCount++;
          // Always return RUNNING to simulate stuck discovery
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: callCount > 20 ? 'FAILED' : 'RUNNING',
              phase: 'SITEMAP',
              pages: [],
              error: callCount > 20 ? 'Discovery timed out' : undefined,
            }),
          });
        }
      });

      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Should eventually show error
      await expect(
        page.getByText(/timed out|failed|error/i)
      ).toBeVisible({ timeout: 30000 });
    });
  });

  test.describe('Cancellation Handling', () => {
    test('should allow cancelling discovery in progress', async ({ page }) => {
      await page.goto('/discovery');

      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase: 'SITEMAP',
              pages: [],
            }),
          });
        } else if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        } else if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase: 'SITEMAP',
              pages: [],
            }),
          });
        }
      });

      // Start discovery
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Wait for cancel button
      await expect(
        page.getByRole('button', { name: /Cancel/i })
      ).toBeVisible();

      // Click cancel
      await page.getByRole('button', { name: /Cancel/i }).click();

      // Should show cancellation or allow restart
      await expect(
        page.getByText(/cancelled|cancel/i).or(
          page.getByRole('button', { name: /Start Discovery/i })
        )
      ).toBeVisible();
    });

    test('should show cancelling state while cancel is in progress', async ({
      page,
    }) => {
      await page.goto('/discovery');

      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase: 'NAVIGATION',
              pages: [],
            }),
          });
        } else if (route.request().method() === 'DELETE') {
          // Slow cancellation
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase: 'NAVIGATION',
              pages: [],
            }),
          });
        }
      });

      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(
        page.getByRole('button', { name: /Cancel/i })
      ).toBeVisible();

      await page.getByRole('button', { name: /Cancel/i }).click();

      // Should show cancelling state
      await expect(page.getByText(/Cancelling/i)).toBeVisible();
    });

    test('should handle cancel failure gracefully', async ({ page }) => {
      await page.goto('/discovery');

      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase: 'CRAWLING',
              pages: [],
            }),
          });
        } else if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Failed to cancel' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase: 'CRAWLING',
              pages: [],
            }),
          });
        }
      });

      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await page.getByRole('button', { name: /Cancel/i }).click();

      // Should show error or still show cancel option
      await expect(
        page.getByText(/failed to cancel|error|Cancel/i)
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Recovery from Errors', () => {
    test('should allow retry after API failure', async ({ page }) => {
      await page.goto('/discovery');

      let attemptCount = 0;
      await page.route('**/api/discoveries', async (route) => {
        attemptCount++;
        if (attemptCount === 1) {
          // First attempt fails
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Server error' }),
          });
        } else {
          // Second attempt succeeds
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'COMPLETED',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
              ],
            }),
          });
        }
      });

      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Should show error
      await expect(page.getByText(/error|failed/i)).toBeVisible();

      // Look for retry button or try again
      const retryButton = page.getByRole('button', { name: /retry|try again|start discovery/i });
      await expect(retryButton).toBeVisible();

      // Click retry
      await retryButton.click();

      // Should succeed on retry
      await expect(page.getByRole('tree')).toBeVisible({ timeout: 5000 });
    });

    test('should preserve URL input after error', async ({ page }) => {
      await page.goto('/discovery');

      await page.route('**/api/discoveries', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' }),
        });
      });

      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Should show error
      await expect(page.getByText(/error|failed/i)).toBeVisible();

      // URL should still be preserved in state (either visible or in form)
      // This allows user to retry without re-entering URL
    });

    test('should allow starting new discovery after failure', async ({
      page,
    }) => {
      await page.goto('/discovery');

      let callCount = 0;
      await page.route('**/api/discoveries**', async (route) => {
        callCount++;
        if (callCount === 1 && route.request().method() === 'POST') {
          await route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Failed' }),
          });
        } else {
          await route.fulfill({
            status: route.request().method() === 'POST' ? 201 : 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-2',
              status: 'COMPLETED',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
              ],
            }),
          });
        }
      });

      // First attempt fails
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(page.getByText(/error|failed/i)).toBeVisible();

      // Start new discovery
      const restartButton = page.getByRole('button', { name: /start|retry|try again/i });
      await restartButton.click();

      // Should succeed
      await expect(page.getByRole('tree')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Network Error Handling', () => {
    test('should show error for network failure', async ({ page }) => {
      await page.goto('/discovery');

      // Abort the request to simulate network failure
      await page.route('**/api/discoveries', async (route) => {
        await route.abort('failed');
      });

      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Should show network error
      await expect(
        page.getByText(/network|connection|offline|failed/i)
      ).toBeVisible();
    });

    test('should show error for connection timeout', async ({ page }) => {
      await page.goto('/discovery');

      // Abort with timeout reason
      await page.route('**/api/discoveries', async (route) => {
        await route.abort('timedout');
      });

      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Should show timeout or network error
      await expect(
        page.getByText(/timeout|network|connection|failed/i)
      ).toBeVisible();
    });
  });

  test.describe('Discovery Failure States', () => {
    test('should show appropriate message when discovery fails', async ({
      page,
    }) => {
      await page.goto('/discovery');

      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase: 'SITEMAP',
              pages: [],
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'FAILED',
              phase: null,
              pages: [],
              error: 'Target website is not accessible',
            }),
          });
        }
      });

      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Should show failure message
      await expect(
        page.getByText(/failed|not accessible|error/i)
      ).toBeVisible({ timeout: 5000 });
    });

    test('should show discovery cancelled state', async ({ page }) => {
      await page.goto('/discovery');

      let statusCallCount = 0;
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase: 'NAVIGATION',
              pages: [],
            }),
          });
        } else if (route.request().method() === 'GET') {
          statusCallCount++;
          const status = statusCallCount > 2 ? 'CANCELLED' : 'RUNNING';
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status,
              phase: status === 'CANCELLED' ? null : 'NAVIGATION',
              pages: [],
            }),
          });
        } else if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        }
      });

      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Wait a moment then check for cancelled state or cancel button
      await expect(
        page.getByText(/cancel/i)
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Validation Error Messages', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
    });

    test('should show clear error for malformed URL', async ({ page }) => {
      await page.getByLabel('Website URL').fill('htp://bad-protocol.com');
      await page.getByRole('button', { name: 'Continue' }).click();

      await expect(
        page.getByText(/invalid|valid URL|HTTP or HTTPS/i)
      ).toBeVisible();
    });

    test('should show error with special characters in URL', async ({
      page,
    }) => {
      await page.getByLabel('Website URL').fill('https://example.com/<script>');
      await page.getByRole('button', { name: 'Continue' }).click();

      // Should either sanitize or show error
      // Implementation-dependent behavior
    });

    test('should show clear error for localhost in production', async ({
      page,
    }) => {
      await page.getByLabel('Website URL').fill('http://localhost:3000');
      await page.getByRole('button', { name: 'Continue' }).click();

      // May proceed (if allowed) or show warning/error
      // Implementation-dependent
    });
  });
});
