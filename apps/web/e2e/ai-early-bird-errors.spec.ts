import { test, expect } from '@playwright/test';

/**
 * E2E Tests: AI Early Bird Error Scenarios
 *
 * Tests error handling for AI scan functionality:
 * 1. Slot reservation failures
 * 2. Network errors during status fetching
 * 3. Campaign unavailability handling
 * 4. Graceful degradation when AI fails
 * 5. Rate limiting handling
 *
 * Requirements:
 * - REQ-2: Graceful handling when campaign unavailable
 * - REQ-6: Error states for AI processing failures
 *
 * @see .claude/specs/ai-early-bird-scan/requirements.md
 */

test.describe('AI Early Bird - Slot Reservation Errors', () => {
  test('should handle slot reservation failure gracefully', async ({ page }) => {
    // Mock active campaign
    await page.route('**/api/v1/ai-campaign/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            active: true,
            slotsRemaining: 5,
            totalSlots: 1000,
            percentRemaining: 0.5,
            urgencyLevel: 'final',
            message: 'Final slots available!',
          },
        }),
      });
    });

    // Mock scan creation with slot reservation failure
    await page.route('**/api/v1/scans', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'No AI slots available',
          code: 'AI_SLOTS_EXHAUSTED',
        }),
      });
    });

    // Mock recaptcha
    await page.route('**/recaptcha**', async (route) => {
      await route.fulfill({ status: 200 });
    });

    await page.goto('/');

    // Fill in URL and enable AI
    const urlInput = page.getByTestId('url-input');
    await urlInput.fill('https://example.com');

    const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');
    await aiCheckbox.click();

    // Submit form
    const submitButton = page.getByTestId('scan-submit-button');
    await submitButton.click();

    // Verify error message
    await expect(page.getByText(/no ai slots available|slots exhausted/i)).toBeVisible();
  });

  test('should allow scan without AI when slots depleted', async ({ page }) => {
    // Mock depleted campaign
    await page.route('**/api/v1/ai-campaign/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            active: true,
            slotsRemaining: 0,
            totalSlots: 1000,
            percentRemaining: 0,
            urgencyLevel: 'depleted',
            message: 'All slots claimed',
          },
        }),
      });
    });

    // Mock successful scan without AI
    await page.route('**/api/v1/scans', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            scan: {
              id: 'scan-123',
              url: 'https://example.com',
              status: 'PENDING',
              wcagLevel: 'AA',
              aiEnabled: false,
            },
          },
        }),
      });
    });

    // Mock recaptcha
    await page.route('**/recaptcha**', async (route) => {
      await route.fulfill({ status: 200 });
    });

    await page.goto('/');

    // AI checkbox should not be visible when depleted
    const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');
    await expect(aiCheckbox).not.toBeVisible();

    // Should still be able to submit scan
    const urlInput = page.getByTestId('url-input');
    await urlInput.fill('https://example.com');

    const submitButton = page.getByTestId('scan-submit-button');
    await submitButton.click();

    // Should redirect to scan page
    await expect(page).toHaveURL(/\/scan\//);
  });
});

test.describe('AI Early Bird - Network Errors', () => {
  test('should handle campaign status API failure gracefully', async ({ page }) => {
    // Mock network error for campaign status
    await page.route('**/api/v1/ai-campaign/status', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/');

    // Page should still load without AI features
    await expect(page.getByTestId('url-input')).toBeVisible();

    // AI checkbox should not be visible (fallback to no campaign)
    const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');
    await expect(aiCheckbox).not.toBeVisible();
  });

  test('should handle 500 error from campaign status API', async ({ page }) => {
    // Mock 500 error
    await page.route('**/api/v1/ai-campaign/status', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal server error',
        }),
      });
    });

    await page.goto('/');

    // Page should still load without AI features
    await expect(page.getByTestId('url-input')).toBeVisible();

    // AI checkbox should not be visible (fallback)
    const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');
    await expect(aiCheckbox).not.toBeVisible();
  });

  test('should handle AI status polling network failure', async ({ page }) => {
    // Mock successful scan with AI
    await page.route('**/api/v1/scans/scan-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'scan-123',
            url: 'https://example.com',
            status: 'COMPLETED',
            wcagLevel: 'AA',
            aiEnabled: true,
            completedAt: new Date().toISOString(),
          },
        }),
      });
    });

    // Mock AI status network failure
    await page.route('**/api/v1/scans/scan-123/ai-status', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/scan/scan-123');

    // Should show error state for AI status
    const aiStatusIndicator = page.getByTestId('ai-status-indicator');
    await expect(aiStatusIndicator).toBeVisible();
    await expect(aiStatusIndicator).toContainText(/error|failed|unavailable/i);
  });
});

test.describe('AI Early Bird - Campaign Unavailable', () => {
  test('should handle campaign not found (null response)', async ({ page }) => {
    await page.route('**/api/v1/ai-campaign/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: null,
        }),
      });
    });

    await page.goto('/');

    // Banner should not be visible
    const banner = page.getByTestId('ai-campaign-banner');
    await expect(banner).not.toBeVisible();

    // AI checkbox should not be visible
    const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');
    await expect(aiCheckbox).not.toBeVisible();

    // Scan form should still work
    await expect(page.getByTestId('url-input')).toBeVisible();
    await expect(page.getByTestId('scan-submit-button')).toBeEnabled();
  });

  test('should handle paused campaign', async ({ page }) => {
    await page.route('**/api/v1/ai-campaign/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            active: false,
            slotsRemaining: 500,
            totalSlots: 1000,
            percentRemaining: 50,
            urgencyLevel: 'normal',
            message: 'Campaign is currently paused',
          },
        }),
      });
    });

    await page.goto('/');

    // AI checkbox should not be visible for paused campaign
    const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');
    await expect(aiCheckbox).not.toBeVisible();

    // May show a message about campaign being paused
    const pausedMessage = page.getByText(/paused|temporarily unavailable/i);
    // This is optional - depends on implementation
  });

  test('should handle ended campaign', async ({ page }) => {
    await page.route('**/api/v1/ai-campaign/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            active: false,
            slotsRemaining: 0,
            totalSlots: 1000,
            percentRemaining: 0,
            urgencyLevel: 'depleted',
            message: 'Early Bird campaign has ended',
          },
        }),
      });
    });

    await page.goto('/');

    // AI checkbox should not be visible
    const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');
    await expect(aiCheckbox).not.toBeVisible();
  });
});

test.describe('AI Early Bird - AI Processing Failures', () => {
  test('should display AI processing failure message', async ({ page }) => {
    // Mock completed scan with AI
    await page.route('**/api/v1/scans/scan-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'scan-123',
            url: 'https://example.com',
            status: 'COMPLETED',
            wcagLevel: 'AA',
            aiEnabled: true,
            completedAt: new Date().toISOString(),
          },
        }),
      });
    });

    // Mock failed AI status
    await page.route('**/api/v1/scans/scan-123/ai-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            scanId: 'scan-123',
            aiEnabled: true,
            status: 'FAILED',
            summary: null,
            remediationPlan: null,
            processedAt: null,
          },
        }),
      });
    });

    await page.goto('/scan/scan-123');

    // Should show failure message
    const aiStatusIndicator = page.getByTestId('ai-status-indicator');
    await expect(aiStatusIndicator).toBeVisible();
    await expect(aiStatusIndicator).toContainText(/failed|error/i);

    // Should NOT show AI insights section when failed
    const aiInsightsSection = page.getByTestId('ai-insights-section');
    await expect(aiInsightsSection).not.toBeVisible();
  });

  test('should show scan results even when AI fails', async ({ page }) => {
    // Mock completed scan with AI failure
    await page.route('**/api/v1/scans/scan-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'scan-123',
            url: 'https://example.com',
            status: 'COMPLETED',
            wcagLevel: 'AA',
            aiEnabled: true,
            completedAt: new Date().toISOString(),
            totalIssues: 15,
            criticalCount: 3,
            seriousCount: 5,
            moderateCount: 5,
            minorCount: 2,
          },
        }),
      });
    });

    // Mock failed AI status
    await page.route('**/api/v1/scans/scan-123/ai-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            scanId: 'scan-123',
            aiEnabled: true,
            status: 'FAILED',
            summary: null,
            remediationPlan: null,
            processedAt: null,
          },
        }),
      });
    });

    await page.goto('/scan/scan-123');

    // Regular scan results should still be visible
    const scanResults = page.getByTestId('scan-results');
    await expect(scanResults).toBeVisible();

    // Issue counts should be displayed
    await expect(page.getByTestId('total-issues')).toContainText('15');
  });

  test('should handle timeout gracefully with retry message', async ({ page }) => {
    // Mock completed scan with AI
    await page.route('**/api/v1/scans/scan-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'scan-123',
            url: 'https://example.com',
            status: 'COMPLETED',
            wcagLevel: 'AA',
            aiEnabled: true,
            completedAt: new Date().toISOString(),
          },
        }),
      });
    });

    // Mock timeout for AI status (responds after delay)
    let callCount = 0;
    await page.route('**/api/v1/scans/scan-123/ai-status', async (route) => {
      callCount++;
      if (callCount <= 2) {
        await route.fulfill({
          status: 504,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Gateway timeout',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              scanId: 'scan-123',
              aiEnabled: true,
              status: 'PROCESSING',
              summary: null,
              remediationPlan: null,
              processedAt: null,
            },
          }),
        });
      }
    });

    await page.goto('/scan/scan-123');

    // Should show retry message or loading state
    const aiStatusIndicator = page.getByTestId('ai-status-indicator');
    await expect(aiStatusIndicator).toBeVisible();
  });
});

test.describe('AI Early Bird - Rate Limiting', () => {
  test('should handle rate limit on campaign status', async ({ page }) => {
    await page.route('**/api/v1/ai-campaign/status', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Too many requests',
          code: 'RATE_LIMITED',
        }),
      });
    });

    await page.goto('/');

    // Page should still load without AI features
    await expect(page.getByTestId('url-input')).toBeVisible();

    // AI features should gracefully degrade
    const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');
    await expect(aiCheckbox).not.toBeVisible();
  });

  test('should handle rate limit on AI status polling', async ({ page }) => {
    // Mock scan
    await page.route('**/api/v1/scans/scan-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'scan-123',
            url: 'https://example.com',
            status: 'COMPLETED',
            wcagLevel: 'AA',
            aiEnabled: true,
            completedAt: new Date().toISOString(),
          },
        }),
      });
    });

    // Mock rate limit on AI status
    await page.route('**/api/v1/scans/scan-123/ai-status', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Too many requests',
          code: 'RATE_LIMITED',
          retryAfter: 30,
        }),
      });
    });

    await page.goto('/scan/scan-123');

    // Should handle gracefully without crashing
    await expect(page.getByTestId('scan-results')).toBeVisible();
  });
});

test.describe('AI Early Bird - Validation Errors', () => {
  test('should validate email format when AI is enabled', async ({ page }) => {
    // Mock active campaign
    await page.route('**/api/v1/ai-campaign/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            active: true,
            slotsRemaining: 550,
            totalSlots: 1000,
            percentRemaining: 55,
            urgencyLevel: 'normal',
            message: 'AI-powered analysis available',
          },
        }),
      });
    });

    await page.goto('/');

    // Fill in URL
    const urlInput = page.getByTestId('url-input');
    await urlInput.fill('https://example.com');

    // Check AI opt-in
    const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');
    await aiCheckbox.click();

    // Fill in invalid email
    const emailInput = page.getByTestId('ai-email-input');
    await emailInput.fill('invalid-email');

    // Submit form
    const submitButton = page.getByTestId('scan-submit-button');
    await submitButton.click();

    // Should show validation error
    await expect(page.getByText(/invalid email|valid email/i)).toBeVisible();
  });

  test('should require URL when submitting with AI enabled', async ({ page }) => {
    // Mock active campaign
    await page.route('**/api/v1/ai-campaign/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            active: true,
            slotsRemaining: 550,
            totalSlots: 1000,
            percentRemaining: 55,
            urgencyLevel: 'normal',
            message: 'AI-powered analysis available',
          },
        }),
      });
    });

    await page.goto('/');

    // Check AI opt-in without entering URL
    const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');
    await aiCheckbox.click();

    // Submit form without URL
    const submitButton = page.getByTestId('scan-submit-button');
    await submitButton.click();

    // Should show URL required error
    await expect(page.getByText(/url.*required|enter.*url/i)).toBeVisible();
  });
});
