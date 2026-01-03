import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Caching Behavior
 *
 * Tests discovery caching functionality:
 * - Cached results prompt appearance
 * - "Use Cached" choice and behavior
 * - "Refresh" choice and behavior
 * - Cache expiration handling
 * - Cache metadata display
 */

test.describe('Caching Behavior', () => {
  test.describe('Cached Results Prompt', () => {
    test('should show cached results prompt when cache exists', async ({
      page,
    }) => {
      // Mock API to return cached results
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'cached-discovery-1',
              status: 'COMPLETED',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
                { id: '2', url: 'https://example.com/about', title: 'About', source: 'NAVIGATION' },
              ],
              cacheMetadata: {
                cachedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
                expiresAt: new Date(Date.now() + 23.5 * 60 * 60 * 1000).toISOString(), // 23.5 hours from now
                pageCount: 2,
              },
            }),
          });
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Should show cached results prompt
      await expect(
        page.getByText(/Cached results available/i)
      ).toBeVisible({ timeout: 5000 });
    });

    test('should display cache age in prompt', async ({ page }) => {
      const cachedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'cached-discovery-1',
              status: 'COMPLETED',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
              ],
              cacheMetadata: {
                cachedAt: cachedAt.toISOString(),
                expiresAt: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
                pageCount: 1,
              },
            }),
          });
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Should show relative time
      await expect(
        page.getByText(/2 hours ago/i)
      ).toBeVisible({ timeout: 5000 });
    });

    test('should display page count in prompt', async ({ page }) => {
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'cached-discovery-1',
              status: 'COMPLETED',
              pages: Array.from({ length: 15 }, (_, i) => ({
                id: String(i + 1),
                url: `https://example.com/page${i + 1}`,
                title: `Page ${i + 1}`,
                source: 'CRAWLED',
              })),
              cacheMetadata: {
                cachedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
                pageCount: 15,
              },
            }),
          });
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Should show page count
      await expect(
        page.getByText(/15 pages/i)
      ).toBeVisible({ timeout: 5000 });
    });

    test('should show both Use Cached and Refresh buttons', async ({
      page,
    }) => {
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'cached-discovery-1',
              status: 'COMPLETED',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
              ],
              cacheMetadata: {
                cachedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                expiresAt: new Date(Date.now() + 23.5 * 60 * 60 * 1000).toISOString(),
                pageCount: 1,
              },
            }),
          });
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(
        page.getByRole('button', { name: /Use Cached/i })
      ).toBeVisible({ timeout: 5000 });
      await expect(
        page.getByRole('button', { name: /Refresh/i })
      ).toBeVisible();
    });
  });

  test.describe('Use Cached Results', () => {
    test('should display cached pages when Use Cached is clicked', async ({
      page,
    }) => {
      const cachedPages = [
        { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP', depth: 0 },
        { id: '2', url: 'https://example.com/about', title: 'About', source: 'NAVIGATION', depth: 1 },
        { id: '3', url: 'https://example.com/contact', title: 'Contact', source: 'CRAWLED', depth: 1 },
      ];

      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'cached-discovery-1',
              status: 'COMPLETED',
              pages: cachedPages,
              cacheMetadata: {
                cachedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
                pageCount: 3,
              },
            }),
          });
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Click Use Cached
      await page.getByRole('button', { name: /Use Cached/i }).click();

      // Should show cached pages in tree
      await expect(page.getByRole('tree')).toBeVisible();
      await expect(page.getByText(/3 pages/i)).toBeVisible();
    });

    test('should hide cache prompt after using cached results', async ({
      page,
    }) => {
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'cached-discovery-1',
              status: 'COMPLETED',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
              ],
              cacheMetadata: {
                cachedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
                pageCount: 1,
              },
            }),
          });
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await page.getByRole('button', { name: /Use Cached/i }).click();

      // Cache prompt should be hidden or removed
      await expect(
        page.getByText(/Cached results available/i)
      ).not.toBeVisible();
    });
  });

  test.describe('Refresh Cache', () => {
    test('should start fresh discovery when Refresh is clicked', async ({
      page,
    }) => {
      let refreshCalled = false;

      await page.route('**/api/discoveries**', async (route) => {
        const url = new URL(route.request().url());

        if (route.request().method() === 'POST') {
          // Check if refresh param is set
          if (url.searchParams.get('refresh') === 'true') {
            refreshCalled = true;
          }

          // First call returns cached, second returns fresh
          await route.fulfill({
            status: refreshCalled ? 201 : 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: refreshCalled ? 'fresh-discovery-1' : 'cached-discovery-1',
              status: refreshCalled ? 'RUNNING' : 'COMPLETED',
              phase: refreshCalled ? 'SITEMAP' : null,
              pages: refreshCalled ? [] : [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
              ],
              cacheMetadata: refreshCalled ? null : {
                cachedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
                pageCount: 1,
              },
            }),
          });
        } else if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'fresh-discovery-1',
              status: 'COMPLETED',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
                { id: '2', url: 'https://example.com/new-page', title: 'New Page', source: 'CRAWLED' },
              ],
            }),
          });
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Click Refresh
      await page.getByRole('button', { name: /Refresh/i }).click();

      // Should show progress (new discovery started)
      await expect(
        page.getByText(/Checking Sitemap|Refreshing/i)
      ).toBeVisible();
    });

    test('should show loading state on Refresh button while refreshing', async ({
      page,
    }) => {
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          const url = new URL(route.request().url());
          if (url.searchParams.get('refresh') === 'true') {
            // Slow response for refresh
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify({
                id: 'fresh-discovery-1',
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
                id: 'cached-discovery-1',
                status: 'COMPLETED',
                pages: [
                  { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
                ],
                cacheMetadata: {
                  cachedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                  expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
                  pageCount: 1,
                },
              }),
            });
          }
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(
        page.getByRole('button', { name: /Refresh/i })
      ).toBeVisible({ timeout: 5000 });

      await page.getByRole('button', { name: /Refresh/i }).click();

      // Should show loading/refreshing state
      await expect(
        page.getByText(/Refreshing/i)
      ).toBeVisible();
    });

    test('should disable Use Cached while refreshing', async ({ page }) => {
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          const url = new URL(route.request().url());
          if (url.searchParams.get('refresh') === 'true') {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            await route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify({
                id: 'fresh-discovery-1',
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
                id: 'cached-discovery-1',
                status: 'COMPLETED',
                pages: [
                  { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
                ],
                cacheMetadata: {
                  cachedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                  expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
                  pageCount: 1,
                },
              }),
            });
          }
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(
        page.getByRole('button', { name: /Refresh/i })
      ).toBeVisible({ timeout: 5000 });

      await page.getByRole('button', { name: /Refresh/i }).click();

      // Use Cached button should be disabled
      const useCachedButton = page.getByRole('button', { name: /Use Cached/i });
      await expect(useCachedButton).toBeDisabled();
    });
  });

  test.describe('Cache Expiration', () => {
    test('should show expiration warning for soon-to-expire cache', async ({
      page,
    }) => {
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'cached-discovery-1',
              status: 'COMPLETED',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
              ],
              cacheMetadata: {
                cachedAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(), // 23 hours ago
                expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
                pageCount: 1,
              },
            }),
          });
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Should show expiration time
      await expect(
        page.getByText(/expires in|1 hour|60 minutes/i)
      ).toBeVisible({ timeout: 5000 });
    });

    test('should show expired cache warning', async ({ page }) => {
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'cached-discovery-1',
              status: 'COMPLETED',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
              ],
              cacheMetadata: {
                cachedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
                expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago (expired)
                pageCount: 1,
              },
            }),
          });
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Should show expired warning
      await expect(
        page.getByText(/expired|recommend refreshing/i)
      ).toBeVisible({ timeout: 5000 });
    });

    test('should still allow using expired cache', async ({ page }) => {
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'cached-discovery-1',
              status: 'COMPLETED',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
              ],
              cacheMetadata: {
                cachedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
                expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // Expired
                pageCount: 1,
              },
            }),
          });
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Use Cached button should still be available (even if expired)
      const useCachedButton = page.getByRole('button', { name: /Use Cached/i });
      await expect(useCachedButton).toBeVisible({ timeout: 5000 });
      await expect(useCachedButton).toBeEnabled();

      // Should be able to use expired cache
      await useCachedButton.click();
      await expect(page.getByRole('tree')).toBeVisible();
    });
  });

  test.describe('No Cache Scenario', () => {
    test('should not show cache prompt for fresh discovery', async ({
      page,
    }) => {
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'fresh-discovery-1',
              status: 'RUNNING',
              phase: 'SITEMAP',
              pages: [],
              cacheMetadata: null, // No cache
            }),
          });
        } else if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'fresh-discovery-1',
              status: 'COMPLETED',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
              ],
            }),
          });
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Should show progress, not cache prompt
      await expect(
        page.getByText(/Checking Sitemap/i)
      ).toBeVisible();

      // Cache prompt should not appear
      await expect(
        page.getByText(/Cached results available/i)
      ).not.toBeVisible();
    });
  });

  test.describe('Cache Time Display', () => {
    test('should show "just now" for very recent cache', async ({ page }) => {
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'cached-discovery-1',
              status: 'COMPLETED',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
              ],
              cacheMetadata: {
                cachedAt: new Date(Date.now() - 30 * 1000).toISOString(), // 30 seconds ago
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                pageCount: 1,
              },
            }),
          });
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(
        page.getByText(/just now/i)
      ).toBeVisible({ timeout: 5000 });
    });

    test('should show minutes for cache under an hour old', async ({
      page,
    }) => {
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'cached-discovery-1',
              status: 'COMPLETED',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
              ],
              cacheMetadata: {
                cachedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
                expiresAt: new Date(Date.now() + 23.25 * 60 * 60 * 1000).toISOString(),
                pageCount: 1,
              },
            }),
          });
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(
        page.getByText(/45 minutes ago/i)
      ).toBeVisible({ timeout: 5000 });
    });

    test('should show days for old cache', async ({ page }) => {
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'cached-discovery-1',
              status: 'COMPLETED',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
              ],
              cacheMetadata: {
                cachedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
                expiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // Expired
                pageCount: 1,
              },
            }),
          });
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(
        page.getByText(/3 days ago/i)
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible cache prompt region', async ({ page }) => {
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'cached-discovery-1',
              status: 'COMPLETED',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
              ],
              cacheMetadata: {
                cachedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
                pageCount: 1,
              },
            }),
          });
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Cache prompt should have role=region
      const cacheRegion = page.locator('[role="region"]').filter({
        hasText: /Cached results/i,
      });
      await expect(cacheRegion).toBeVisible({ timeout: 5000 });

      // Should have aria-label
      await expect(cacheRegion).toHaveAttribute('aria-label');
    });

    test('should have accessible time elements', async ({ page }) => {
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          const cachedAt = new Date(Date.now() - 60 * 60 * 1000);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'cached-discovery-1',
              status: 'COMPLETED',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
              ],
              cacheMetadata: {
                cachedAt: cachedAt.toISOString(),
                expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
                pageCount: 1,
              },
            }),
          });
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Time element should have datetime attribute
      const timeElement = page.locator('time');
      if (await timeElement.count() > 0) {
        await expect(timeElement.first()).toHaveAttribute('datetime');
      }
    });
  });
});
