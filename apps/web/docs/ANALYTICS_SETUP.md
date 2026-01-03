# Google Analytics & Tag Manager Setup Guide

This guide covers the complete setup of Google Tag Manager (GTM) and Google Analytics 4 (GA4) for ADAShield.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Google Analytics 4 Setup](#google-analytics-4-setup)
3. [Google Tag Manager Setup](#google-tag-manager-setup)
4. [Environment Configuration](#environment-configuration)
5. [GTM Container Configuration](#gtm-container-configuration)
6. [Testing & Verification](#testing--verification)
7. [Event Reference](#event-reference)

---

## Prerequisites

- Google account with access to Google Analytics and Tag Manager
- Access to ADAShield environment variables
- Basic understanding of GTM concepts (tags, triggers, variables)

---

## Google Analytics 4 Setup

### Step 1: Create GA4 Property

1. Go to [Google Analytics](https://analytics.google.com/)
2. Click **Admin** (gear icon) in the bottom left
3. Click **Create Property**
4. Enter property details:
   - **Property name**: `ADAShield Production` (or appropriate environment name)
   - **Reporting time zone**: Select your timezone
   - **Currency**: Select your currency
5. Click **Next** and complete the business information
6. Click **Create** and accept the terms

### Step 2: Create Data Stream

1. In the property, go to **Admin** → **Data Streams**
2. Click **Add stream** → **Web**
3. Enter your website URL (e.g., `https://adashield.com`)
4. Enter a stream name (e.g., `ADAShield Web`)
5. Click **Create stream**

### Step 3: Get Measurement ID

1. In the data stream details, copy the **Measurement ID** (format: `G-XXXXXXXXXX`)
2. Save this for environment configuration

### Step 4: Configure Data Retention

1. Go to **Admin** → **Data Settings** → **Data Retention**
2. Set **Event data retention** to desired period (14 months recommended)
3. Enable **Reset user data on new activity**
4. Click **Save**

---

## Google Tag Manager Setup

### Step 1: Create GTM Account & Container

1. Go to [Google Tag Manager](https://tagmanager.google.com/)
2. Click **Create Account**
3. Enter account details:
   - **Account Name**: `ADAShield`
   - **Country**: Select your country
4. Enter container details:
   - **Container name**: `ADAShield Web`
   - **Target platform**: **Web**
5. Click **Create** and accept the terms

### Step 2: Get GTM Container ID

1. After creation, you'll see the container ID in the header (format: `GTM-XXXXXXX`)
2. Copy this ID for environment configuration

---

## Environment Configuration

### Required Environment Variables

Add these to your `.env.local` (development) or production environment:

```bash
# Google Tag Manager Container ID
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX

# Google Analytics 4 Measurement ID
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Enable analytics (set to 'true' to enable)
NEXT_PUBLIC_ANALYTICS_ENABLED=true

# Enable debug logging (development only)
NEXT_PUBLIC_ANALYTICS_DEBUG=true
```

### Environment-Specific Configuration

| Environment | GTM_ID | Analytics Enabled | Debug |
|-------------|--------|-------------------|-------|
| Development | Test container | `true` | `true` |
| Staging | Test container | `true` | `true` |
| Production | Production container | `true` | `false` |

### Example `.env.local` for Development

```bash
# Analytics Configuration
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ANALYTICS_ENABLED=true
NEXT_PUBLIC_ANALYTICS_DEBUG=true
```

---

## GTM Container Configuration

### Step 1: Create GA4 Configuration Tag

1. In GTM, go to **Tags** → **New**
2. Click **Tag Configuration** → **Google Analytics: GA4 Configuration**
3. Enter your **Measurement ID** (`G-XXXXXXXXXX`)
4. Click **Triggering** → Select **All Pages**
5. Name the tag: `GA4 - Configuration`
6. Click **Save**

### Step 2: Create Custom Event Tags

For each custom event, create a GA4 Event tag:

#### Scan Initiated Event

1. **Tags** → **New** → **Google Analytics: GA4 Event**
2. Configuration:
   - **Configuration Tag**: Select your GA4 Configuration tag
   - **Event Name**: `scan_initiated`
   - **Event Parameters**:
     | Parameter Name | Value |
     |----------------|-------|
     | `scan_type` | `{{DLV - scan_type}}` |
     | `wcag_level` | `{{DLV - wcag_level}}` |
     | `url_count` | `{{DLV - url_count}}` |
     | `has_email` | `{{DLV - has_email}}` |
3. **Trigger**: Create custom trigger for `scan_initiated` event

#### Report Exported Event

1. **Tags** → **New** → **Google Analytics: GA4 Event**
2. Configuration:
   - **Event Name**: `report_exported`
   - **Event Parameters**:
     | Parameter Name | Value |
     |----------------|-------|
     | `format` | `{{DLV - format}}` |
     | `scan_id` | `{{DLV - scan_id}}` |
     | `issue_count` | `{{DLV - issue_count}}` |
3. **Trigger**: Create custom trigger for `report_exported` event

### Step 3: Create Data Layer Variables

For each event parameter, create a Data Layer Variable:

1. **Variables** → **User-Defined Variables** → **New**
2. **Variable Type**: **Data Layer Variable**
3. **Data Layer Variable Name**: (e.g., `scan_type`, `wcag_level`, etc.)
4. Name the variable with `DLV -` prefix (e.g., `DLV - scan_type`)

Create variables for:
- `scan_type`
- `wcag_level`
- `url_count`
- `has_email`
- `format`
- `scan_id`
- `issue_count`
- `page_path`
- `page_title`
- `timestamp`

### Step 4: Create Custom Triggers

For each custom event:

1. **Triggers** → **New**
2. **Trigger Type**: **Custom Event**
3. **Event name**: (e.g., `scan_initiated`)
4. Name the trigger appropriately

Create triggers for:
- `scan_initiated`
- `scan_completed`
- `report_exported`
- `page_view`
- `funnel_scan_form_viewed`
- `funnel_scan_submitted`
- `funnel_scan_results_viewed`
- `funnel_report_downloaded`
- `error_api`
- `error_js`
- `web_vitals`

### Step 5: Configure Consent Mode

1. **Admin** → **Container Settings**
2. Enable **Consent Mode** if required by regulations
3. The ADAShield app handles consent via the CookieConsent component

---

## Testing & Verification

### Step 1: Enable GTM Preview Mode

1. In GTM, click **Preview** button
2. Enter your website URL
3. A debug window will open with your site

### Step 2: Verify Tag Firing

1. Perform actions on the site (submit scan, export report, etc.)
2. In the GTM debug panel, verify:
   - Tags fire on correct events
   - Variables contain expected values
   - No errors in the console

### Step 3: Verify in GA4 DebugView

1. In GA4, go to **Admin** → **DebugView**
2. Perform actions on the site
3. Verify events appear with correct parameters

### Step 4: Run E2E Tests

With GTM configured, run the analytics E2E tests:

```bash
# Run analytics consent tests
npx playwright test e2e/analytics-consent.spec.ts --project=chromium

# Run analytics events tests (requires GTM configured)
npx playwright test e2e/analytics-events.spec.ts --project=chromium
```

### Step 5: Publish GTM Container

1. Verify all tags work in Preview mode
2. Click **Submit** in GTM
3. Enter version name and description
4. Click **Publish**

---

## Event Reference

### Core Events

| Event Name | Description | Key Parameters |
|------------|-------------|----------------|
| `scan_initiated` | User submits a scan | `scan_type`, `wcag_level`, `url_count`, `has_email` |
| `scan_completed` | Scan processing finished | `scan_id`, `duration_ms`, `issue_count`, `status` |
| `report_exported` | User downloads a report | `format`, `scan_id`, `issue_count` |

### Funnel Events

| Event Name | Description | Key Parameters |
|------------|-------------|----------------|
| `funnel_scan_form_viewed` | User views scan form | `page_path` |
| `funnel_scan_url_entered` | User enters URL | `url_domain` |
| `funnel_scan_submitted` | User submits scan | `wcag_level` |
| `funnel_scan_results_viewed` | User views results | `scan_id`, `issue_count` |
| `funnel_report_downloaded` | User downloads report | `format` |

### Error Events

| Event Name | Description | Key Parameters |
|------------|-------------|----------------|
| `error_api` | API error occurred | `error_code`, `endpoint`, `message` |
| `error_js` | JavaScript error | `error_message`, `error_stack`, `page_path` |

### Performance Events

| Event Name | Description | Key Parameters |
|------------|-------------|----------------|
| `web_vitals` | Core Web Vitals metrics | `metric_name`, `metric_value`, `metric_rating` |

---

## Consent Management

ADAShield implements GDPR-compliant consent management:

### How It Works

1. **First Visit**: Cookie consent banner appears
2. **User Choice**: Accept All, Decline All, or Customize
3. **Consent Storage**: Saved to `localStorage` as `adashield:consent`
4. **GTM Loading**: GTM script only loads after analytics consent

### Consent States

| State | GTM Loads | Analytics Active |
|-------|-----------|------------------|
| No consent yet | No | No |
| Accepted | Yes | Yes |
| Declined | No | No |
| Customized (analytics on) | Yes | Yes |
| Customized (analytics off) | No | No |

### Cookie Clearing

When user declines analytics:
- All `_ga*` cookies are cleared
- All `_gid` cookies are cleared
- All `_gat*` cookies are cleared

---

## Troubleshooting

### GTM Not Loading

1. Verify `NEXT_PUBLIC_GTM_ID` is set correctly
2. Check browser console for CSP errors
3. Ensure user has accepted analytics consent

### Events Not Appearing in GA4

1. Check GTM Preview mode for tag firing
2. Verify trigger conditions match
3. Check data layer variables are populated
4. Wait 24-48 hours for real-time to process

### Consent Banner Not Appearing

1. Clear localStorage: `localStorage.removeItem('adashield:consent')`
2. Refresh the page
3. Check browser console for errors

### Debug Mode

Enable debug logging in development:

```bash
NEXT_PUBLIC_ANALYTICS_DEBUG=true
```

This logs all analytics events to the browser console with `[Analytics]` prefix.

---

## Security Considerations

1. **Never commit** GTM/GA IDs to version control for production
2. **Use environment variables** for all configuration
3. **CSP Headers** are configured in `next.config.js` to allow GTM/GA domains
4. **PII Protection**: Email addresses and URLs are sanitized before tracking

---

## Support

For issues with analytics implementation:
1. Check browser console for errors
2. Use GTM Preview mode for debugging
3. Review GA4 DebugView for event details
4. Check E2E tests for expected behavior
