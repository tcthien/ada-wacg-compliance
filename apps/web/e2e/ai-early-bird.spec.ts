import { test, expect } from '@playwright/test';

/**
 * E2E Tests: AI Early Bird Scan Flow
 *
 * Tests the AI-powered scan feature including:
 * 1. Campaign status display on landing page
 * 2. AI checkbox visibility when campaign is active
 * 3. AI opt-in flow during scan creation
 * 4. AI status indicator on scan results page
 * 5. AI insights display when processing is complete
 *
 * Requirements:
 * - REQ-2: Campaign status and slot visibility
 * - REQ-3: AI checkbox opt-in on scan form
 * - REQ-6: AI status indicator on results page
 *
 * @see .claude/specs/ai-early-bird-scan/requirements.md
 */

test.describe('AI Early Bird Scan - Campaign Display', () => {
  test.describe('Campaign Status Banner', () => {
    test('should display campaign banner when campaign is active', async ({ page }) => {
      // Mock active campaign status
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

      // Check for campaign banner
      const banner = page.getByTestId('ai-campaign-banner');
      await expect(banner).toBeVisible();

      // Check banner content
      await expect(banner).toContainText('AI-powered');
      await expect(banner).toContainText('550');
    });

    test('should not display campaign banner when no active campaign', async ({ page }) => {
      // Mock no campaign
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
    });

    test('should display urgency styling for limited slots', async ({ page }) => {
      // Mock limited slots campaign
      await page.route('**/api/v1/ai-campaign/status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              active: true,
              slotsRemaining: 80,
              totalSlots: 1000,
              percentRemaining: 8,
              urgencyLevel: 'almost_gone',
              message: 'Limited slots remaining!',
            },
          }),
        });
      });

      await page.goto('/');

      const banner = page.getByTestId('ai-campaign-banner');
      await expect(banner).toBeVisible();
      await expect(banner).toContainText('Limited slots');
    });

    test('should display final urgency for very limited slots', async ({ page }) => {
      // Mock final slots campaign
      await page.route('**/api/v1/ai-campaign/status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              active: true,
              slotsRemaining: 30,
              totalSlots: 1000,
              percentRemaining: 3,
              urgencyLevel: 'final',
              message: 'Final slots available!',
            },
          }),
        });
      });

      await page.goto('/');

      const banner = page.getByTestId('ai-campaign-banner');
      await expect(banner).toBeVisible();
      await expect(banner).toContainText('Final');
    });
  });
});

test.describe('AI Early Bird Scan - Scan Form Integration', () => {
  test.describe('AI Checkbox', () => {
    test('should show AI checkbox when campaign is active', async ({ page }) => {
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

      // AI checkbox should be visible
      const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');
      await expect(aiCheckbox).toBeVisible();
    });

    test('should hide AI checkbox when campaign is inactive', async ({ page }) => {
      // Mock inactive campaign
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

      // AI checkbox should not be visible
      const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');
      await expect(aiCheckbox).not.toBeVisible();
    });

    test('should hide AI checkbox when slots are depleted', async ({ page }) => {
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

      await page.goto('/');

      // AI checkbox should not be visible when depleted
      const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');
      await expect(aiCheckbox).not.toBeVisible();
    });

    test('should allow toggling AI opt-in', async ({ page }) => {
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

      const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');

      // Check default state (unchecked)
      await expect(aiCheckbox).not.toBeChecked();

      // Toggle on
      await aiCheckbox.click();
      await expect(aiCheckbox).toBeChecked();

      // Toggle off
      await aiCheckbox.click();
      await expect(aiCheckbox).not.toBeChecked();
    });
  });

  test.describe('Scan Submission with AI', () => {
    test('should include AI opt-in in scan request when checked', async ({ page }) => {
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

      // Capture scan request
      let capturedRequest: any = null;
      await page.route('**/api/v1/scans', async (route) => {
        capturedRequest = route.request().postDataJSON();
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
                aiEnabled: true,
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

      // Fill in URL
      const urlInput = page.getByTestId('url-input');
      await urlInput.fill('https://example.com');

      // Check AI opt-in
      const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');
      await aiCheckbox.click();

      // Submit form
      const submitButton = page.getByTestId('scan-submit-button');
      await submitButton.click();

      // Verify AI was included in request
      await page.waitForTimeout(500);
      expect(capturedRequest).toBeTruthy();
      expect(capturedRequest.aiEnabled).toBe(true);
    });

    test('should not include AI in request when not checked', async ({ page }) => {
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

      // Capture scan request
      let capturedRequest: any = null;
      await page.route('**/api/v1/scans', async (route) => {
        capturedRequest = route.request().postDataJSON();
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

      // Fill in URL
      const urlInput = page.getByTestId('url-input');
      await urlInput.fill('https://example.com');

      // Don't check AI opt-in (leave unchecked)

      // Submit form
      const submitButton = page.getByTestId('scan-submit-button');
      await submitButton.click();

      // Verify AI was NOT included in request
      await page.waitForTimeout(500);
      expect(capturedRequest).toBeTruthy();
      expect(capturedRequest.aiEnabled).toBeFalsy();
    });
  });
});

test.describe('AI Early Bird Scan - Results Page', () => {
  test.describe('AI Status Indicator', () => {
    test('should show AI processing status on scan results page', async ({ page }) => {
      // Mock scan with AI enabled in PROCESSING state
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

      // Mock AI status in PROCESSING state
      await page.route('**/api/v1/scans/scan-123/ai-status', async (route) => {
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
      });

      await page.goto('/scan/scan-123');

      // Check for AI status indicator
      const aiStatusIndicator = page.getByTestId('ai-status-indicator');
      await expect(aiStatusIndicator).toBeVisible();
      await expect(aiStatusIndicator).toContainText('AI Processing');
    });

    test('should show AI insights when processing is complete', async ({ page }) => {
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

      // Mock completed AI status
      await page.route('**/api/v1/scans/scan-123/ai-status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              scanId: 'scan-123',
              aiEnabled: true,
              status: 'COMPLETED',
              summary: 'Found 15 accessibility issues. 3 critical issues require immediate attention.',
              remediationPlan: '1. Add alt text to images\n2. Fix heading structure\n3. Improve color contrast',
              processedAt: new Date().toISOString(),
              metrics: {
                inputTokens: 2500,
                outputTokens: 500,
                totalTokens: 3000,
                model: 'claude-3-sonnet',
                processingTime: 12500,
              },
            },
          }),
        });
      });

      await page.goto('/scan/scan-123');

      // Check for AI insights section
      const aiInsightsSection = page.getByTestId('ai-insights-section');
      await expect(aiInsightsSection).toBeVisible();

      // Check for summary
      await expect(aiInsightsSection).toContainText('15 accessibility issues');

      // Check for remediation plan
      await expect(aiInsightsSection).toContainText('alt text');
    });

    test('should not show AI section for scans without AI', async ({ page }) => {
      // Mock scan without AI
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
              aiEnabled: false,
              completedAt: new Date().toISOString(),
            },
          }),
        });
      });

      await page.goto('/scan/scan-123');

      // AI sections should not be visible
      const aiStatusIndicator = page.getByTestId('ai-status-indicator');
      await expect(aiStatusIndicator).not.toBeVisible();

      const aiInsightsSection = page.getByTestId('ai-insights-section');
      await expect(aiInsightsSection).not.toBeVisible();
    });

    test('should show AI failed state gracefully', async ({ page }) => {
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

      // Check for AI error state
      const aiStatusIndicator = page.getByTestId('ai-status-indicator');
      await expect(aiStatusIndicator).toBeVisible();
      await expect(aiStatusIndicator).toContainText('AI processing failed');
    });
  });
});

test.describe('AI Early Bird Scan - Email Notification', () => {
  test('should show email input when AI is enabled', async ({ page }) => {
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

    // Check AI opt-in checkbox first
    const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');
    await aiCheckbox.click();

    // Email input should now be visible
    const emailInput = page.getByTestId('ai-email-input');
    await expect(emailInput).toBeVisible();
  });

  test('should hide email input when AI is not enabled', async ({ page }) => {
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

    // Don't check AI opt-in checkbox

    // Email input should not be visible
    const emailInput = page.getByTestId('ai-email-input');
    await expect(emailInput).not.toBeVisible();
  });

  test('should include email in scan request when provided', async ({ page }) => {
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

    // Capture scan request
    let capturedRequest: any = null;
    await page.route('**/api/v1/scans', async (route) => {
      capturedRequest = route.request().postDataJSON();
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
              aiEnabled: true,
              email: 'user@example.com',
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

    // Fill in URL
    const urlInput = page.getByTestId('url-input');
    await urlInput.fill('https://example.com');

    // Check AI opt-in
    const aiCheckbox = page.getByTestId('ai-opt-in-checkbox');
    await aiCheckbox.click();

    // Fill in email
    const emailInput = page.getByTestId('ai-email-input');
    await emailInput.fill('user@example.com');

    // Submit form
    const submitButton = page.getByTestId('scan-submit-button');
    await submitButton.click();

    // Verify email was included in request
    await page.waitForTimeout(500);
    expect(capturedRequest).toBeTruthy();
    expect(capturedRequest.aiEnabled).toBe(true);
    expect(capturedRequest.email).toBe('user@example.com');
  });
});
