# Requirements Document: Website Skeleton Discovery

## Introduction

Website Skeleton Discovery is a feature that extracts website structure (navigation menus, sitemap.xml, internal links) from a homepage URL and presents it to users before accessibility scanning begins. This allows users to:
- See a visual map of their website's pages
- Select specific pages to include in the scan
- Choose crawl depth for comprehensive coverage
- Optimize scan scope for performance and relevance

Currently, users must manually input each URL they want to scan. This feature automates site structure discovery, making the tool more user-friendly and comprehensive.

## Glossary

| Term | Definition |
|------|------------|
| **Discovery** | The process of finding pages on a website |
| **Discovery Job** | A background task that performs discovery |
| **Discovery Result** | The output of a completed discovery job (list of pages) |
| **Page Limit** | Maximum number of pages that can be discovered per job |
| **Crawl Depth** | How many levels of links to follow (1 = homepage only) |
| **Auto Discover** | Automatic discovery using sitemap and navigation |
| **Manual Entry** | User-provided list of URLs to scan |

## MVP Scope

### Monetization Strategy
- **Discovery is FREE** - Does not count toward billing
- **Scans are CHARGED** - Users pay based on number of scans performed
- **AI-Enhanced Discovery** - Premium feature for paid plans (Post-MVP)

### MVP Limits (Free Tier - Hardcoded)
| Setting | Value |
|---------|-------|
| Discoveries per month | 3 |
| Max pages per discovery | 10 |
| Max crawl depth | 1 (homepage only) |
| AI-enhanced discovery | No |

> **Note:** For MVP, these limits are hardcoded in configuration. Post-MVP will introduce database-driven plan limits. See `post-mvp-tier-limits.md` for details.

### Post-MVP Features
- Tiered discovery limits (Starter, Pro, Enterprise)
- AI-enhanced discovery with smart navigation detection
- Batch discovery across multiple domains
- Admin toggle for AI discovery per customer

## Alignment with Product Vision

This feature directly supports the product goals from product.md:

### Target Persona Support

1. **E-commerce Owner (Primary Persona)**: Discovers product pages, category structures, and checkout flows automatically. Reduces manual URL entry for sites with hundreds of product pages.

2. **Freelance Web Developer**: Quickly audits client websites without requesting sitemaps. Demonstrates comprehensive coverage to clients through visual site mapping.

3. **Digital Agency Owner**: Scales auditing across multiple client sites. Batch discovery reduces per-project setup time from hours to minutes.

4. **Government IT Director**: Identifies all public-facing pages for ADA Title II compliance. Ensures no pages are missed during mandatory accessibility audits.

### Product Objective Alignment

- **User Experience Enhancement**: Automates URL discovery, reducing time-to-first-scan from manual input (5+ minutes) to one-click discovery (<2 minutes)
- **Comprehensive Coverage**: Ensures users find pages they didn't know existed, addressing the "unknown unknowns" gap in accessibility testing
- **SMB-Friendly**: Professional-grade site mapping without requiring technical knowledge of sitemaps or crawlers
- **Competitive Advantage**: Differentiates from competitors (WAVE, Axe) requiring manual URL input or flat-file imports

### Success Metrics Impact
- Time to First Scan: Target <2 min (discovery must complete within this window)
- User Activation Rate: Higher completion rate when users see their full site structure
- Page Coverage: 3-5x more pages scanned vs. homepage-only defaults

## Requirements

### Requirement 1: Discovery Mode Selection

**User Story:** As an e-commerce owner with multiple product pages, I want to choose how to add pages for scanning, so that I can either let the tool find pages automatically or manually specify the exact URLs I need to audit for ADA compliance.

#### Acceptance Criteria

1. WHEN user enters a homepage URL THEN the system SHALL display two discovery mode options
2. WHEN displaying options THEN the system SHALL show "Auto Discover" as the first option with description "Automatically find pages from sitemap and navigation"
3. WHEN displaying options THEN the system SHALL show "Manual Entry" as the second option with description "Manually add specific page URLs"
4. IF user selects "Auto Discover" THEN the system SHALL proceed to sitemap and navigation extraction
5. IF user selects "Manual Entry" THEN the system SHALL display the manual URL entry interface
6. WHEN in either mode THEN the system SHALL allow switching to the other mode via toggle button
7. IF user switches from Auto Discover to Manual THEN the system SHALL preserve any discovered pages
8. IF user switches from Manual to Auto Discover THEN the system SHALL preserve any manually added URLs
9. WHEN mode options are displayed THEN the system SHALL support keyboard navigation between options using Arrow keys
10. WHEN user presses Enter on a focused option THEN the system SHALL select that option

### Requirement 2: Auto Discovery - Sitemap Parsing

**User Story:** As a freelance web developer auditing a client site, I want the tool to automatically find and parse the sitemap.xml, so that I can quickly see all indexed pages without requesting documentation from my client.

#### Acceptance Criteria

1. WHEN Auto Discover mode is selected THEN the system SHALL attempt to fetch the sitemap from standard locations
2. IF sitemap is not found at the first location THEN the system SHALL check alternate standard locations
3. IF a valid sitemap is found THEN the system SHALL parse all URL entries as discoverable pages
4. IF a sitemap index is found THEN the system SHALL fetch each referenced sitemap
5. IF a referenced sitemap fails to load THEN the system SHALL skip that sitemap and continue with others
6. WHEN sitemap parsing completes THEN the system SHALL display the count of discovered URLs
7. WHEN sitemap is malformed THEN the system SHALL display warning "Sitemap contains errors, partial results shown"
8. WHEN sitemap is malformed THEN the system SHALL extract any valid URL entries found before the error
9. IF sitemap file exceeds 50MB THEN the system SHALL reject and display error "Sitemap too large, please use navigation discovery"
10. IF no sitemap is found THEN the system SHALL silently proceed to navigation extraction
11. WHEN sitemap request exceeds timeout THEN the system SHALL skip sitemap and proceed to navigation extraction
12. WHEN sitemap returns authentication error THEN the system SHALL display message "Sitemap requires authentication" and proceed to navigation
13. WHEN sitemap parsing begins THEN screen reader users SHALL hear announcement "Checking sitemap"
14. WHEN sitemap parsing completes THEN screen reader users SHALL hear announcement "[N] pages found in sitemap"

### Requirement 3: Auto Discovery - Navigation Extraction

**User Story:** As a government IT director preparing for ADA Title II compliance, I want the tool to extract links from navigation menus, so that I can ensure all public-facing pages are included in my accessibility audit even if our sitemap is incomplete.

#### Acceptance Criteria

1. WHEN analyzing a homepage THEN the system SHALL identify semantic navigation elements in the page structure
2. WHEN analyzing a homepage THEN the system SHALL identify elements with navigation ARIA roles
3. WHEN analyzing a homepage THEN the system SHALL identify header sections containing links
4. IF no semantic navigation elements are found THEN the system SHALL search for common navigation patterns
5. WHEN navigation elements are found THEN the system SHALL extract all internal links within them
6. WHEN extracting links THEN the system SHALL filter out anchor-only links
7. WHEN extracting links THEN the system SHALL filter out JavaScript-based links
8. WHEN extracting links THEN the system SHALL filter out email and phone links
9. WHEN extracting links THEN the system SHALL filter out links pointing to external domains
10. WHEN duplicate URLs are found THEN the system SHALL keep only one instance
11. WHEN navigation contains nested menus THEN the system SHALL extract links from all nesting levels
12. IF the homepage fails to load THEN the system SHALL display user-friendly error with HTTP status description
13. IF no navigation elements or links are found THEN the system SHALL display message "No navigation structure detected"
14. WHEN navigation extraction begins THEN screen reader users SHALL hear announcement "Analyzing navigation"
15. WHEN navigation extraction completes THEN screen reader users SHALL hear announcement "[N] pages found in navigation"

### Requirement 4: Manual URL Entry

**User Story:** As a digital agency owner managing multiple client projects, I want to manually add specific page URLs for scanning, so that I can target the exact pages my client requested without waiting for auto-discovery when I already have a list of priority URLs.

#### Acceptance Criteria

1. WHEN Manual Entry mode is selected THEN the system SHALL display a text input field for entering URLs
2. WHEN user enters a URL THEN the system SHALL validate that it belongs to the same domain as the homepage
3. IF entered URL has a different domain THEN the system SHALL display error "URL must be on the same domain as [homepage domain]"
4. IF entered URL is valid THEN the system SHALL add it to the pages list
5. WHEN adding a URL THEN the system SHALL mark it with a "manual" badge in the tree view
6. WHEN user enters a URL that already exists THEN the system SHALL display warning "URL already in list"
7. WHEN displaying manual entry interface THEN the system SHALL show an "Add URL" button
8. WHEN displaying manual entry interface THEN the system SHALL show option to paste multiple URLs (one per line)
9. IF user pastes multiple URLs THEN the system SHALL validate and add each valid URL
10. IF any pasted URLs are invalid THEN the system SHALL display count of failed URLs with reasons
11. WHEN a manually added URL is in the list THEN user SHALL be able to remove it via delete button
12. WHEN manual URLs are added THEN the system SHALL count them toward the page limit
13. IF adding URLs would exceed page limit THEN the system SHALL display "Page limit reached. Only first [N] URLs added."
14. IF entered URL exceeds 2000 characters THEN the system SHALL display error "URL too long"
15. WHEN URL input field is focused THEN the system SHALL provide clear focus indicator meeting WCAG 2.1 AA contrast requirements
16. WHEN URL is added successfully THEN screen reader users SHALL hear announcement "URL added to list"
17. WHEN URL fails validation THEN screen reader users SHALL hear the specific error message

### Requirement 5: Internal Link Crawling (Post-MVP)

**User Story:** As an e-commerce owner with a large product catalog, I want the tool to discover pages through internal links beyond the homepage, so that I can find product pages not included in the sitemap or main navigation.

> **Note:** This requirement is for paid tiers only (depth > 1). MVP free tier uses depth 1 (homepage only).

#### Acceptance Criteria

1. WHEN user sets crawl depth to 1 THEN the system SHALL extract links only from the homepage
2. WHEN user sets crawl depth to 2 THEN the system SHALL extract links from homepage AND follow each discovered link once
3. WHEN user sets crawl depth to 3 THEN the system SHALL continue to third-level pages
4. WHEN crawling a page THEN the system SHALL only follow links to the same domain as the homepage
5. WHEN a page request fails with client error THEN the system SHALL mark it as "broken link" and continue
6. WHEN a page request fails with server error THEN the system SHALL retry up to 3 times with exponential backoff
7. WHEN a page request exceeds timeout THEN the system SHALL skip that page and continue
8. WHEN a redirect leads to external domain THEN the system SHALL stop following and mark as "external redirect"
9. WHEN total discovered pages reaches the configured limit THEN the system SHALL stop crawling
10. WHEN page limit is reached THEN the system SHALL display message "Page limit reached: [N] pages discovered"
11. WHEN a circular link is detected THEN the system SHALL skip the duplicate URL
12. IF crawl depth is not specified THEN the system SHALL default to depth 1

### Requirement 6: Structure Visualization

**User Story:** As a freelance web developer presenting audit scope to a client, I want to see the website's structure in a visual tree format, so that I can understand the page hierarchy, demonstrate coverage to my client, and select specific pages for accessibility scanning.

#### Acceptance Criteria

1. WHEN discovery completes THEN the system SHALL display pages in a collapsible tree structure
2. WHEN displaying pages THEN the system SHALL organize by URL path hierarchy
3. WHEN a page was found in sitemap THEN the system SHALL display a "sitemap" badge next to it
4. WHEN a page was found in navigation THEN the system SHALL display a "nav" badge next to it
5. WHEN a page was found via crawling THEN the system SHALL display a "crawled" badge with depth level
6. WHEN a page was found via manual entry THEN the system SHALL display a "manual" badge
7. WHEN a page was found in multiple sources THEN the system SHALL display all applicable badges
8. WHEN displaying a page THEN the system SHALL show the page title if available
9. IF page title could not be extracted THEN the system SHALL display the URL path as fallback
10. WHEN the tree has more than 50 items at one level THEN the system SHALL collapse that level by default
11. WHEN user activates expand control THEN the system SHALL reveal child pages
12. WHEN user activates collapse control THEN the system SHALL hide child pages
13. WHEN discovery found 0 pages THEN the system SHALL display "No pages discovered" with troubleshooting suggestions
14. WHEN tree renders more than 100 pages THEN the system SHALL complete rendering within 2 seconds
15. WHEN page titles contain special characters THEN the system SHALL sanitize them to prevent XSS

### Requirement 7: Page Selection

**User Story:** As a government IT director with limited audit budget, I want to select which pages to include in my accessibility scan, so that I can prioritize high-traffic pages and stay within my compliance testing budget.

#### Acceptance Criteria

1. WHEN viewing the tree THEN each page SHALL have a checkbox for selection
2. WHEN user activates a page checkbox THEN the system SHALL toggle that page's selection state
3. WHEN user activates a folder/path group checkbox THEN the system SHALL select all child pages
4. WHEN user activates a selected folder checkbox THEN the system SHALL deselect all child pages
5. WHEN some but not all children are selected THEN the parent checkbox SHALL show indeterminate state
6. WHEN pages are selected THEN the system SHALL display total selected count in the header
7. WHEN pages are selected THEN the system SHALL display estimated scan time
8. WHEN estimated scan time exceeds 30 minutes THEN the system SHALL display warning "Large scan - consider reducing selection"
9. IF no pages are selected THEN the system SHALL disable the "Start Scan" button
10. IF no pages are selected THEN the system SHALL display message "Select at least one page to scan"
11. WHEN selection changes THEN the system SHALL persist selection state in browser session
12. WHEN user returns to the page within the same session THEN the system SHALL restore previous selection state
13. WHEN "Select All" button is activated THEN the system SHALL select all visible pages
14. WHEN "Deselect All" button is activated THEN the system SHALL deselect all pages

### Requirement 8: Discovery Configuration (MVP)

**User Story:** As an e-commerce owner new to accessibility testing, I want to configure discovery settings with clear guidance on limits, so that I understand what's included in the free tier and can complete my first accessibility audit quickly.

#### Acceptance Criteria

1. WHEN starting discovery THEN the system SHALL use depth 1 (homepage links only)
2. WHEN starting discovery THEN the system SHALL enforce the configured page limit
3. WHEN user has exceeded monthly discovery limit THEN the system SHALL display "Monthly discovery limit reached. Upgrade for more."
4. WHEN discovery starts THEN the system SHALL display progress indicator showing current phase
5. WHEN sitemap is being parsed THEN progress SHALL show "Checking sitemap..."
6. WHEN navigation is being extracted THEN progress SHALL show "Analyzing navigation..."
7. WHEN pages are being discovered THEN progress SHALL show "Discovering: [N] pages found"
8. WHEN discovery is running THEN the system SHALL display "Cancel" button
9. WHEN user activates Cancel THEN the system SHALL stop all active operations within 5 seconds
10. WHEN discovery is cancelled THEN the system SHALL display partial results with message "Discovery cancelled - showing partial results"
11. WHEN page limit is reached THEN the system SHALL stop and display "Page limit reached. Upgrade for higher limits."
12. WHEN discovery completes THEN screen reader users SHALL hear announcement "Discovery complete. [N] pages found."
13. WHEN discovery fails THEN screen reader users SHALL hear announcement describing the error

### Requirement 9: Discovery Caching

**User Story:** As a digital agency owner running repeated audits on client sites, I want to reuse previous discovery results, so that I can quickly re-scan sites without waiting for re-discovery when the site structure hasn't changed.

#### Acceptance Criteria

1. WHEN discovery completes successfully THEN the system SHALL store results in cache
2. WHEN user starts discovery for a previously-cached URL THEN the system SHALL prompt "Use cached results from [timestamp]?"
3. IF user selects "Use Cached" THEN the system SHALL load cached results immediately
4. IF user selects "Refresh" THEN the system SHALL perform fresh discovery
5. WHEN displaying cached results THEN the system SHALL show "Cached on [date] at [time]" indicator
6. WHEN cache has expired THEN the system SHALL automatically perform fresh discovery
7. WHEN cached result is loaded THEN the system SHALL verify cache integrity before display
8. IF cache is corrupted THEN the system SHALL discard cache and perform fresh discovery
9. WHEN user modifies discovery settings THEN the system SHALL invalidate cache for that URL

### Requirement 10: Integration with Scan Creation

**User Story:** As a website owner ready to run my first accessibility scan, I want my discovered pages to seamlessly flow into scan creation, so that I can start scanning immediately without re-entering URLs or losing my page selection.

#### Acceptance Criteria

1. WHEN user activates "Start Scan" with selected pages THEN the system SHALL create a scan job with all selected URLs
2. WHEN creating scan job THEN the system SHALL include discovery source metadata
3. WHEN scan is created THEN the system SHALL redirect user to scan progress page
4. IF scan creation fails THEN the system SHALL display error and preserve selection state
5. WHEN discovery results exist THEN the scan creation page SHALL display "Use Discovered Pages" option
6. IF user navigates to scan creation directly THEN the system SHALL offer to run discovery first

### Requirement 11: Usage Tracking (MVP - Simplified)

**User Story:** As a product owner, I want to track discovery usage per customer, so that we can enforce free tier limits and identify customers ready to upgrade to paid plans.

#### Acceptance Criteria

1. WHEN a user starts discovery THEN the system SHALL check their monthly usage count
2. IF monthly discovery count >= configured limit THEN the system SHALL reject with "Monthly limit reached" error
3. WHEN discovery completes successfully THEN the system SHALL increment the user's monthly usage counter
4. WHEN a new calendar month begins THEN the system SHALL reset monthly usage counters to zero
5. WHEN checking usage THEN the system SHALL use the configured limit (3 for MVP free tier)

> **Note:** For MVP, limits are hardcoded. Database-driven plan management is Post-MVP. See `post-mvp-tier-limits.md`.

### Requirement 12: Accessibility Support

**User Story:** As a screen reader user evaluating accessibility tools, I want the discovery interface to be fully accessible, so that I can use the tool to audit my own website's accessibility.

#### Acceptance Criteria

1. WHEN navigating the tree view THEN users SHALL be able to use Arrow keys to move between items
2. WHEN a tree item is focused THEN users SHALL be able to press Enter or Space to toggle selection
3. WHEN a tree folder is focused THEN users SHALL be able to press Arrow Right to expand and Arrow Left to collapse
4. WHEN discovery status changes THEN screen reader users SHALL receive live region announcements
5. WHEN an error occurs THEN screen reader users SHALL receive immediate announcement of the error
6. WHEN progress updates THEN screen reader users SHALL receive periodic announcements (not more than once per 5 seconds)
7. WHEN displaying the tree THEN the system SHALL use proper ARIA tree role and attributes
8. WHEN displaying badges THEN the system SHALL include accessible text alternatives
9. WHEN focus moves to a new element THEN that element SHALL have visible focus indicator with 3:1 contrast ratio
10. WHEN displaying forms THEN all inputs SHALL have associated labels

### Requirement 13: Mobile Responsiveness

**User Story:** As a freelance web developer working remotely, I want to use the discovery feature on my tablet or phone, so that I can quickly set up accessibility audits for clients while away from my desk.

#### Acceptance Criteria

1. WHEN viewing on screens less than 768px wide THEN the tree view SHALL adapt to single-column layout
2. WHEN viewing on mobile devices THEN touch targets SHALL be at least 44x44 pixels
3. WHEN viewing on mobile devices THEN the system SHALL support swipe gestures for tree navigation
4. WHEN viewing on mobile devices THEN the discovery mode toggle SHALL be easily accessible
5. WHEN viewing on tablet devices THEN the interface SHALL make efficient use of available screen space
6. WHEN switching between portrait and landscape THEN the layout SHALL adapt appropriately
7. WHEN on slow mobile connections THEN discovery progress SHALL remain visible and responsive

## Non-Functional Requirements

### Performance
- Sitemap parsing SHALL complete within 10 seconds for sitemaps up to 10,000 URLs
- Navigation extraction SHALL complete within 5 seconds for the homepage
- Discovery of 10 pages (MVP limit) SHALL complete within 30 seconds total
- Tree view rendering SHALL complete within 2 seconds for up to 100 pages
- API response for cached results SHALL return within 200ms
- Memory usage SHALL not exceed 256MB during discovery (MVP scale)

### Security
- Discovery SHALL only fetch pages from the user-specified domain (same-origin enforcement)
- Discovery SHALL respect robots.txt directives when crawling
- Discovery SHALL timeout HTTP requests after 30 seconds
- Discovery SHALL sanitize all URL inputs to prevent injection attacks
- Discovery SHALL sanitize page titles before display to prevent XSS
- Discovery SHALL NOT follow redirects to external domains
- Discovery SHALL NOT store or log page content, only URLs and metadata
- Discovery SHALL rate-limit requests to 10 per second per domain
- Discovery SHALL validate sitemap XML structure to prevent XML bomb attacks

### Reliability
- Discovery SHALL retry failed requests up to 3 times with exponential backoff
- Discovery SHALL handle malformed sitemaps gracefully with partial parsing
- Discovery SHALL recover from individual page failures without stopping the entire operation
- Discovery progress SHALL be preserved if browser tab is refreshed (via session storage)
- Discovery SHALL gracefully handle backend service unavailability with user-friendly error messages
- Discovery worker SHALL restart automatically if process crashes

### Usability
- Discovery progress SHALL show clear status messages for each phase
- Error messages SHALL be user-friendly with actionable guidance
- Discovery SHALL work on target sites rendered server-side (SSR)
- All discovery UI components SHALL meet WCAG 2.1 AA compliance
- Color alone SHALL NOT be used to convey information (badges, status)
- Text SHALL maintain minimum 4.5:1 contrast ratio against backgrounds

### Observability
- Discovery SHALL log all phases with structured JSON logs
- Discovery SHALL emit metrics: duration, pages_found, errors_count, cache_hits
- Discovery SHALL include correlation ID for tracing across services
- Discovery errors SHALL be reported to error tracking service
- Discovery SHALL log when users hit rate limits or usage caps

## Edge Cases

1. **Single Page Applications (SPAs)**: May not have traditional navigation; rely on sitemap or inform user to input URLs manually
2. **Infinite Scroll Sites**: Limit link extraction to initially loaded content; do not simulate scrolling
3. **Password-Protected Pages**: Skip pages returning 401/403, mark as "requires authentication" in results
4. **Large Sites (>10,000 pages)**: Enforce page limit and recommend sitemap-only mode
5. **Subdomains**: Treat as external domains unless explicitly same as homepage domain
6. **Canonical URLs**: Use canonical URL when available to deduplicate
7. **Fragment URLs (#)**: Ignore URLs that differ only by fragment identifier
8. **Query Parameters**: Treat URLs with different query parameters as different pages by default
9. **Non-HTML Resources**: Skip PDFs, images, and other non-HTML content types
10. **Circular Redirects**: Detect and break redirect loops after 5 hops

## Technical Notes

> **Note:** Detailed technical architecture, database schema, and API specifications will be defined in the Design Document (`design.md`). This requirements document focuses on WHAT the system should do, not HOW it should be implemented.

### Key Technical Decisions (for Design Phase)
- Module structure following existing project patterns
- API endpoints for discovery operations
- Database schema for discovery results and usage tracking
- Integration with existing scan module
- BullMQ job queue for background processing
- Redis caching strategy
