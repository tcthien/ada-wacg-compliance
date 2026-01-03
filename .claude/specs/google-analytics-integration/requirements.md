# Requirements Document: Google Analytics Integration

## Introduction

This feature integrates Google Tag Manager (GTM) and Google Analytics 4 (GA4) into ADAShield to track user analytics, measure engagement, and understand user behavior. The integration will provide actionable insights into user journeys, feature adoption, and conversion funnels while maintaining GDPR compliance and respecting user privacy preferences.

## Alignment with Product Vision

This feature directly supports ADAShield's business objectives outlined in product.md:

| Product Goal | How This Feature Supports It |
|--------------|------------------------------|
| **100 Paying Customers (Year 1)** | Track conversion funnel from free scan → paid subscription |
| **Free to Paid Conversion > 5%** | Measure and optimize conversion touchpoints |
| **Monthly Churn < 5%** | Identify engagement drop-off patterns |
| **NPS > 40** | Correlate feature usage with satisfaction |
| **Time to First Scan < 2 min** | Measure actual user onboarding time |

### Privacy-First Principle Alignment

Per product.md's "Privacy-Conscious" principle:
- Minimal data collection (anonymized by default)
- GDPR compliant with explicit consent
- No selling of customer data
- Transparent about what is tracked

## Requirements

### Requirement 1: GTM Container Integration

**User Story:** As a product owner, I want Google Tag Manager integrated into the web application, so that I can manage analytics tags without code deployments.

#### Acceptance Criteria

1. WHEN the application loads THEN the system SHALL load the GTM container script in the document head
2. WHEN GTM script loads THEN the system SHALL initialize the dataLayer array before GTM executes
3. IF the GTM container ID is not configured THEN the system SHALL skip GTM initialization without errors
4. WHEN GTM loads THEN the system SHALL not block the main thread or delay First Contentful Paint by more than 100ms
5. IF user has declined analytics cookies THEN the system SHALL not load the GTM script

### Requirement 2: Google Analytics 4 Configuration

**User Story:** As a product owner, I want GA4 configured through GTM, so that I can track page views and user sessions accurately.

#### Acceptance Criteria

1. WHEN a user navigates to any page THEN the system SHALL send a page_view event to GA4
2. WHEN using Next.js client-side navigation THEN the system SHALL track virtual page views correctly
3. IF GA4 measurement ID is not configured THEN the system SHALL not attempt to send events
4. WHEN tracking users THEN the system SHALL use anonymized IP addresses by default
5. WHEN the user is in the EU THEN the system SHALL wait for explicit consent before tracking

### Requirement 3: Cookie Consent Integration

**User Story:** As a user, I want to control whether my usage is tracked, so that my privacy preferences are respected.

#### Acceptance Criteria

1. WHEN a new user visits the site THEN the system SHALL display the cookie consent banner
2. IF user accepts analytics cookies THEN the system SHALL enable GTM/GA4 tracking
3. IF user declines analytics cookies THEN the system SHALL disable all analytics tracking
4. WHEN user changes consent preference THEN the system SHALL update tracking state immediately
5. WHEN consent is declined THEN the system SHALL clear any existing analytics cookies
6. IF user has previously consented THEN the system SHALL remember preference on return visits

### Requirement 4: Core Event Tracking

**User Story:** As a product analyst, I want key user actions tracked as events, so that I can analyze user behavior and optimize the product.

#### Acceptance Criteria

1. WHEN a user submits a scan form THEN the system SHALL track a `scan_initiated` event with:
   - WCAG level selected (A, AA, AAA)
   - Scan type (single, batch)
   - Number of URLs (for batch)

2. WHEN a scan completes successfully THEN the system SHALL track a `scan_completed` event with:
   - Scan duration
   - Issue count by severity
   - WCAG level

3. WHEN a user exports a report THEN the system SHALL track a `report_exported` event with:
   - Export format (PDF, JSON)
   - Report type (single, batch)

4. WHEN a user signs up THEN the system SHALL track a `sign_up` event with:
   - Registration method
   - Referral source (if available)

5. WHEN a user logs in THEN the system SHALL track a `login` event with:
   - Login method
   - Return vs new session

### Requirement 5: Conversion Funnel Tracking

**User Story:** As a growth manager, I want to track conversion funnels, so that I can identify drop-off points and optimize user journeys.

#### Acceptance Criteria

1. WHEN tracking the scan funnel THEN the system SHALL capture these stages:
   - `funnel_scan_form_viewed` - User sees scan form
   - `funnel_scan_url_entered` - User enters URL
   - `funnel_scan_submitted` - User submits scan
   - `funnel_scan_results_viewed` - User views results
   - `funnel_report_downloaded` - User downloads report

2. WHEN tracking the signup funnel THEN the system SHALL capture these stages:
   - `funnel_signup_started` - User clicks signup
   - `funnel_signup_completed` - User completes registration
   - `funnel_first_scan` - User completes first scan

3. WHEN a funnel event occurs THEN the system SHALL include a `funnel_session_id` for journey correlation

### Requirement 6: Error and Performance Tracking

**User Story:** As a developer, I want errors and performance issues tracked, so that I can identify and fix problems quickly.

#### Acceptance Criteria

1. WHEN an API error occurs THEN the system SHALL track an `error_api` event with:
   - Error code
   - Error message (sanitized)
   - Endpoint (path only, no PII)

2. WHEN a JavaScript error occurs THEN the system SHALL track an `error_js` event with:
   - Error type
   - Error message (sanitized)
   - Component/page context

3. WHEN Core Web Vitals are measured THEN the system SHALL send metrics to GA4:
   - Largest Contentful Paint (LCP)
   - First Input Delay (FID)
   - Cumulative Layout Shift (CLS)

### Requirement 7: Admin Analytics Dashboard Access

**User Story:** As an admin, I want to see key analytics metrics in the admin dashboard, so that I can monitor product health without leaving the application.

#### Acceptance Criteria

1. WHEN an admin views the dashboard THEN the system SHALL display:
   - Total scans (today, week, month)
   - Active users (daily, weekly, monthly)
   - Conversion rate trends

2. IF GA4 API access is configured THEN the system SHALL fetch real-time data from GA4
3. IF GA4 API is not configured THEN the system SHALL display a link to Google Analytics dashboard
4. WHEN displaying metrics THEN the system SHALL cache data for 5 minutes to reduce API calls

### Requirement 8: Environment Configuration

**User Story:** As a developer, I want analytics configuration managed through environment variables, so that I can use different tracking IDs for development/staging/production.

#### Acceptance Criteria

1. WHEN configuring GTM THEN the system SHALL read `NEXT_PUBLIC_GTM_ID` from environment
2. WHEN configuring GA4 THEN the system SHALL read `NEXT_PUBLIC_GA_MEASUREMENT_ID` from environment
3. IF `NEXT_PUBLIC_ANALYTICS_ENABLED` is false THEN the system SHALL disable all analytics
4. WHEN in development mode THEN the system SHALL log analytics events to console instead of sending
5. WHEN in test mode THEN the system SHALL mock all analytics calls

## Non-Functional Requirements

### Performance

| Metric | Requirement |
|--------|-------------|
| GTM Script Load Impact | < 100ms increase to FCP |
| Event Sending Latency | Non-blocking, async |
| Bundle Size Increase | < 5KB gzipped for analytics wrapper |
| Memory Footprint | < 2MB for analytics runtime |

### Security

| Requirement | Implementation |
|-------------|----------------|
| No PII in Events | Sanitize all event data before sending |
| No URL Params Tracking | Strip query parameters from page URLs |
| No User IDs | Use anonymous client IDs only |
| CSP Compatibility | GTM domains added to Content Security Policy |
| XSS Prevention | No dynamic script injection from user input |

### Reliability

| Requirement | Implementation |
|-------------|----------------|
| Graceful Degradation | App functions normally if analytics fails |
| Offline Handling | Queue events when offline, send when online |
| Error Isolation | Analytics errors don't affect main app |
| Retry Logic | Failed events retried up to 3 times |

### Usability

| Requirement | Implementation |
|-------------|----------------|
| Consent UX | Clear, non-intrusive consent banner |
| Preference Access | Easy way to change consent in settings |
| Transparency | Link to privacy policy explaining tracking |
| No Dark Patterns | Equal visual weight for accept/decline options |

### Compliance

| Standard | Requirement |
|----------|-------------|
| GDPR | Explicit consent before tracking EU users |
| CCPA | Honor "Do Not Sell" preferences |
| ePrivacy | Cookie consent before non-essential cookies |
| WCAG 2.2 AA | Consent banner must be accessible |

## Out of Scope

The following are explicitly NOT part of this feature:

1. **Server-side analytics** - Backend event tracking (future enhancement)
2. **A/B testing infrastructure** - Will be separate feature
3. **Heatmaps/Session recording** - Requires separate tool (Hotjar, etc.)
4. **Marketing automation** - Email sequences, retargeting
5. **Custom GA4 reports** - Users configure in GA4 dashboard
6. **Data warehouse integration** - BigQuery export (future)

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| CookieConsent component | Internal | Existing, needs enhancement |
| Next.js App Router | Internal | Already implemented |
| Environment configuration | Internal | Existing pattern in env.ts |
| Google Tag Manager account | External | Team must create |
| Google Analytics 4 property | External | Team must create |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Analytics Coverage | 100% of pages tracked | GA4 page view count |
| Consent Rate | > 60% opt-in | Consent events / total visitors |
| Event Accuracy | < 1% event loss | Compare client events to GA4 received |
| Performance Impact | < 50ms LCP increase | Lighthouse scores before/after |
| Implementation Time | < 2 weeks | Sprint tracking |

---

*Created: December 2024*
*Version: 1.0*
*Status: Draft - Pending Review*
