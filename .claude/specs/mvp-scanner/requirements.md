# MVP Scanner - Requirements Document

## Document Information

| Field | Value |
|-------|-------|
| **Feature Name** | MVP Scanner |
| **Spec ID** | mvp-scanner |
| **Version** | 1.1 |
| **Status** | Draft |
| **Created** | 2024-12-25 |
| **Author** | Claude Code |

---

## 1. Overview

### 1.1 Purpose

The MVP Scanner is the core feature of ADAShield that enables users to perform single-page accessibility scans using axe-core. It provides the foundation for automated WCAG 2.2 A/AA compliance testing with actionable, prioritized results.

### 1.2 Problem Statement

Small and medium businesses face significant ADA lawsuit risks (77% of accessibility lawsuits target SMBs/e-commerce), but lack affordable, honest accessibility testing tools. Existing solutions either:
- Overpromise (overlay widgets claiming "100% compliance")
- Are too expensive ($5,000-50,000/year enterprise tools)
- Lack actionable guidance (free tools with raw technical output)

### 1.3 Goals

| Goal | Success Metric |
|------|----------------|
| Enable quick accessibility checks | Time to first scan < 2 minutes |
| Provide actionable results | 80%+ users understand how to fix issues |
| Deliver honest coverage claims | Clear communication of 57% automated detection |
| Generate shareable reports | PDF/JSON export for legal documentation |

### 1.4 Scope

**In Scope (MVP)**:
- Single page URL scanning
- WCAG 2.2 Level A and AA testing
- axe-core automated rule engine
- Issue prioritization (Critical/Serious/Moderate/Minor)
- Basic PDF and JSON report export
- Scan history (last 10 scans)

**Out of Scope (Future)**:
- Multi-page scanning
- AI-enhanced analysis
- CI/CD integration
- Scheduled monitoring
- Site download & agentic analysis
- Authentication-protected page scanning

---

## 2. User Stories

### 2.1 Primary User Stories

#### US-001: Quick Accessibility Check
**As a** small business owner
**I want to** scan my website URL for accessibility issues
**So that** I can identify problems before receiving an ADA lawsuit

**Priority**: P0 (Must Have)

**Acceptance Criteria**:
- [ ] WHEN user enters a valid URL and clicks "Scan", THEN the system initiates an accessibility scan
- [ ] IF the URL is invalid or unreachable, THEN display a clear error message with guidance
- [ ] WHEN scan completes, THEN display results within 30 seconds for typical pages
- [ ] IF scan takes longer than 30 seconds, THEN show progress indicator with estimated time

---

#### US-002: View Scan Results
**As a** website owner
**I want to** see a clear summary of accessibility issues found
**So that** I understand my compliance status at a glance

**Priority**: P0 (Must Have)

**Acceptance Criteria**:
- [ ] WHEN scan completes, THEN display total issue count grouped by severity
- [ ] WHEN viewing results, THEN show WCAG criteria violated (e.g., "1.4.3 Contrast")
- [ ] WHEN viewing an issue, THEN display affected element, issue description, and fix suggestion
- [ ] IF zero issues found, THEN show success message with note about 57% detection limitation

---

#### US-003: Understand Issue Priority
**As a** developer
**I want to** see issues prioritized by severity
**So that** I can fix the most critical problems first

**Priority**: P0 (Must Have)

**Acceptance Criteria**:
- [ ] WHEN results display, THEN group issues by severity: Critical, Serious, Moderate, Minor
- [ ] WHEN viewing severity, THEN show visual indicator (color/icon) matching severity level
- [ ] WHEN issue affects multiple elements, THEN show count of affected instances
- [ ] IF Critical issues exist, THEN highlight them prominently with urgent styling

---

#### US-004: Export Compliance Report
**As a** business owner
**I want to** export scan results as a PDF report
**So that** I have documentation for legal compliance records

**Priority**: P0 (Must Have)

**Acceptance Criteria**:
- [ ] WHEN user clicks "Export PDF", THEN generate downloadable PDF report
- [ ] WHEN PDF generates, THEN include: scan date, URL, summary, all issues with details
- [ ] WHEN PDF generates, THEN include WCAG reference for each issue
- [ ] IF user prefers JSON, THEN provide JSON export option with complete scan data

---

#### US-005: View Scan History
**As a** returning user
**I want to** see my previous scan results
**So that** I can track progress over time

**Priority**: P1 (Should Have)

**Acceptance Criteria**:
- [ ] WHEN user visits dashboard, THEN display last 10 scans with URL, date, issue count
- [ ] WHEN user clicks previous scan, THEN show full results from that scan
- [ ] IF scan is older than 30 days, THEN mark as "outdated" with re-scan suggestion
- [ ] WHEN comparing scans, THEN highlight new issues vs. fixed issues (basic comparison)

---

#### US-006: Learn How to Fix Issues
**As a** developer
**I want to** understand how to fix each accessibility issue
**So that** I can remediate problems efficiently

**Priority**: P0 (Must Have)

**Acceptance Criteria**:
- [ ] WHEN viewing issue details, THEN show code snippet of affected element
- [ ] WHEN viewing issue details, THEN display fix recommendation with code example
- [ ] WHEN issue relates to WCAG, THEN provide link to WCAG success criteria documentation
- [ ] IF issue is common (top 5), THEN show additional "best practices" tip

---

### 2.2 Secondary User Stories

#### US-007: Honest Coverage Communication
**As a** user
**I want to** understand what automated testing can and cannot detect
**So that** I have realistic expectations about compliance

**Priority**: P1 (Should Have)

**Acceptance Criteria**:
- [ ] WHEN viewing results, THEN display note: "Automated testing detects ~57% of issues"
- [ ] WHEN viewing results, THEN list categories requiring manual review
- [ ] IF user has zero issues, THEN clearly state this doesn't guarantee full compliance
- [ ] WHEN prompted, THEN provide educational link about testing limitations

---

#### US-008: Responsive Dashboard Access
**As a** user on mobile device
**I want to** view my scan results on any device
**So that** I can check status while away from my desk

**Priority**: P2 (Nice to Have)

**Acceptance Criteria**:
- [ ] WHEN accessing on mobile, THEN display responsive layout optimized for small screens
- [ ] WHEN viewing results on mobile, THEN maintain readability of all critical information
- [ ] IF starting new scan on mobile, THEN provide same functionality as desktop

---

## 3. Functional Requirements

### 3.1 URL Scanning

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | System SHALL accept HTTP/HTTPS URLs for scanning | P0 |
| FR-002 | System SHALL validate URL format before initiating scan | P0 |
| FR-003 | System SHALL check URL reachability before full scan | P0 |
| FR-004 | System SHALL use Playwright + Chromium for page rendering | P0 |
| FR-005 | System SHALL execute axe-core analysis on rendered page | P0 |
| FR-006 | System SHALL timeout scan after 60 seconds maximum | P0 |
| FR-007 | System SHALL handle JavaScript-rendered content (SPAs) | P1 |
| FR-008 | System SHALL respect robots.txt (optional, can be overridden) | P2 |

### 3.2 Accessibility Testing

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-010 | System SHALL test against WCAG 2.2 Level A criteria | P0 |
| FR-011 | System SHALL test against WCAG 2.2 Level AA criteria | P0 |
| FR-012 | System SHALL use axe-core latest stable version | P0 |
| FR-013 | System SHALL include all axe-core standard rules | P0 |
| FR-014 | System SHALL exclude experimental/beta rules by default | P1 |
| FR-015 | System SHALL categorize issues by axe-core impact levels | P0 |

### 3.3 Results Display

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-020 | System SHALL display issue count by severity category | P0 |
| FR-021 | System SHALL show affected HTML element for each issue | P0 |
| FR-022 | System SHALL display axe-core rule description | P0 |
| FR-023 | System SHALL provide fix recommendation per issue | P0 |
| FR-024 | System SHALL link issues to WCAG success criteria | P0 |
| FR-025 | System SHALL display CSS selector for affected elements | P1 |
| FR-026 | System SHALL highlight element location on page preview | P2 |

### 3.4 Report Export

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-030 | System SHALL generate PDF reports on demand | P0 |
| FR-031 | System SHALL include executive summary in PDF | P0 |
| FR-032 | System SHALL include detailed issue list in PDF | P0 |
| FR-033 | System SHALL provide JSON export with full scan data | P0 |
| FR-034 | System SHALL include timestamp and URL in exports | P0 |
| FR-035 | System SHALL include WCAG version tested in exports | P1 |

### 3.5 Data Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-040 | System SHALL store last 10 scans per session (guest) or per user (registered) | P0 |
| FR-041 | System SHALL store scan URL, timestamp, and results | P0 |
| FR-042 | System SHALL allow viewing historical scan results | P0 |
| FR-043 | System SHALL allow re-scanning same URL | P0 |
| FR-044 | System SHALL auto-delete scans older than 90 days (free tier) | P1 |

### 3.6 Guest Mode & Email Notification

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-050 | System SHALL allow scanning without registration (guest mode) | P0 |
| FR-051 | System SHALL offer optional email input for async result delivery | P0 |
| FR-052 | System SHALL send scan results via email when scan takes > 30s and email provided | P0 |
| FR-053 | System SHALL store guest scans in browser session (cookie-based) | P0 |
| FR-054 | System SHALL allow guest users to create account and claim scan history | P1 |
| FR-055 | System SHALL clearly indicate email is optional and explain its purpose | P0 |

### 3.7 Rate Limiting & Bot Prevention

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-060 | System SHALL implement Google reCAPTCHA v3 (invisible) on scan form | P0 |
| FR-061 | System SHALL limit scans to 10/hour per URL for guest users | P0 |
| FR-062 | System SHALL track rate limits using cookie + browser fingerprint | P0 |
| FR-063 | System SHALL display clear message when rate limit exceeded | P0 |
| FR-064 | System SHALL block requests with reCAPTCHA score < 0.3 | P0 |
| FR-065 | System SHALL log suspicious activity for security review | P1 |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-001 | Single page scan completion time | < 30 seconds (p95) |
| NFR-002 | Results page load time | < 2 seconds |
| NFR-003 | PDF generation time | < 10 seconds |
| NFR-004 | API response time (non-scan) | < 200ms (p95) |
| NFR-005 | Concurrent scan capacity | 100+ simultaneous |

### 4.2 Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-010 | Scan completion success rate | > 95% |
| NFR-011 | System uptime | 99.9% |
| NFR-012 | Data durability (scan results) | 99.99% |
| NFR-013 | Graceful degradation on failure | Display user-friendly error |

### 4.3 Security

| ID | Requirement | Description |
|----|-------------|-------------|
| NFR-020 | Input validation | Validate/sanitize all user inputs |
| NFR-021 | URL validation | Prevent SSRF attacks via URL validation |
| NFR-022 | Rate limiting | Max 10 scans/hour (free tier) |
| NFR-023 | Data encryption | TLS 1.3 in transit, AES-256 at rest |
| NFR-024 | No credentials stored | Never store user's website passwords |

### 4.4 Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-030 | Pages scanned per month | 100,000+ |
| NFR-031 | Concurrent users | 1,000+ |
| NFR-032 | Report storage | 10TB+ |
| NFR-033 | Horizontal worker scaling | Auto-scale based on queue depth |

### 4.5 Usability

| ID | Requirement | Description |
|----|-------------|-------------|
| NFR-040 | Time to first scan | < 2 minutes from landing |
| NFR-041 | Mobile responsive | Full functionality on mobile |
| NFR-042 | Accessibility | Our own product must be WCAG 2.2 AA compliant |
| NFR-043 | Error messages | Clear, actionable, non-technical |

### 4.6 Compliance & Privacy

| ID | Requirement | Description |
|----|-------------|-------------|
| NFR-050 | GDPR compliance | Comply with EU General Data Protection Regulation |
| NFR-051 | Data minimization | Collect only essential data for service operation |
| NFR-052 | User consent | Obtain explicit consent before storing email addresses |
| NFR-053 | Right to erasure | Allow users to delete their scan data on request |
| NFR-054 | Privacy policy | Maintain clear, accessible privacy policy |
| NFR-055 | Cookie consent | Display cookie consent banner for EU users |
| NFR-056 | Data retention disclosure | Clearly state 90-day retention for free tier |

---

## 5. Technical Constraints

### 5.1 Technology Stack (per tech.md)

| Component | Technology |
|-----------|------------|
| Backend Runtime | Node.js 20 LTS |
| Backend Framework | Fastify + TypeScript |
| Browser Automation | Playwright + Chromium |
| Accessibility Engine | axe-core (latest) |
| Queue System | BullMQ + Redis |
| Database | PostgreSQL + Prisma |
| Frontend | Next.js 14 + React 18 |

### 5.2 Integration Points

| Integration | Purpose |
|-------------|---------|
| axe-core | Accessibility testing engine |
| Playwright | Browser automation for rendering |
| BullMQ | Job queue for background scanning |
| S3 | Report storage (PDF, JSON) |

### 5.3 Constraints

| Constraint | Rationale |
|------------|-----------|
| Headless browser required | Page rendering for JavaScript content |
| Queue-based architecture | Scans are long-running (10-60s) |
| No authenticated pages (MVP) | Complexity of credential handling |
| Public URLs only (MVP) | Internal/localhost URLs rejected |

---

## 6. Dependencies

### 6.1 External Dependencies

| Dependency | Type | Risk |
|------------|------|------|
| axe-core | NPM package | Low - stable, Deque-maintained |
| Playwright | NPM package | Low - stable, Microsoft-maintained |
| Chromium | Browser binary | Low - bundled with Playwright |

### 6.2 Internal Dependencies

| Dependency | Status | Blocker |
|------------|--------|---------|
| User authentication | Optional | No - guest mode supported, auth enables persistent history |
| Database schema | Required | Yes - need to store scan results |
| Queue infrastructure | Required | Yes - background job processing |
| Email service (SendGrid/SES) | Required | Yes - async result delivery |
| Google reCAPTCHA | Required | Yes - bot prevention |

---

## 7. Assumptions

| ID | Assumption | Risk if Wrong |
|----|------------|---------------|
| A-001 | Users have publicly accessible URLs | Feature won't work for internal sites |
| A-002 | Target websites allow automated access | Some sites may block/rate-limit |
| A-003 | axe-core rules are sufficient for MVP | May need custom rules later |
| A-004 | 30-second timeout is acceptable | Complex SPAs may need longer |
| A-005 | Users understand accessibility basics | May need more education |

---

## 8. Resolved Questions

| ID | Question | Decision | Rationale |
|----|----------|----------|-----------|
| Q-001 | Should we require user registration for scans? | **No registration required**. Optional email for async results. | Lower friction for first scan. Email allows results delivery if scan takes long. |
| Q-002 | What's the free tier scan limit? | **10 scans/hour per URL** (tracked via cookie + fingerprint) | Control abuse without requiring login. Per-URL prevents same site abuse. |
| Q-003 | Should we show competitor comparison? | **No** (MVP). Focus on our value proposition. | Legal risk, maintenance burden, may appear unprofessional. Future: consider neutral "industry comparison" section. |
| Q-004 | How to handle sites that block bots? | **Google reCAPTCHA v3** (invisible) for bot prevention | Protects our service from abuse. For sites blocking us: show clear error with explanation. |

---

## 9. Success Criteria

### 9.1 MVP Launch Criteria

| Criteria | Measurement | Target |
|----------|-------------|--------|
| Scan reliability | Success rate | > 95% |
| User activation | Time to first scan | < 2 min |
| Result accuracy | axe-core rule coverage | 100% standard rules |
| Performance | Scan completion time | < 30s (p95) |
| Export functionality | PDF/JSON generation | 100% success |

### 9.2 Business Metrics (30 days post-launch)

| Metric | Target |
|--------|--------|
| Free users | 500+ |
| Scans completed | 5,000+ |
| Conversion to paid | > 3% |
| User satisfaction (NPS) | > 30 |

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **axe-core** | Open-source accessibility testing engine by Deque Systems |
| **WCAG** | Web Content Accessibility Guidelines - W3C standard |
| **Level A/AA/AAA** | WCAG conformance levels (A=minimum, AAA=maximum) |
| **Success Criteria** | Individual WCAG requirements (e.g., 1.4.3 Contrast) |
| **Impact** | axe-core severity: critical, serious, moderate, minor |
| **SPA** | Single Page Application - JavaScript-heavy website |
| **GDPR** | General Data Protection Regulation - EU privacy law |
| **SSRF** | Server-Side Request Forgery - security vulnerability |
| **reCAPTCHA** | Google's bot detection service (v3 = invisible scoring) |
| **Guest Mode** | Scanning without account registration |
| **Browser Fingerprint** | Device/browser characteristics used for rate limiting |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-25 | Claude Code | Initial draft |
| 1.1 | 2024-12-25 | Claude Code | Added GDPR compliance (NFR-050-056), guest mode (FR-050-055), rate limiting with reCAPTCHA (FR-060-065), resolved open questions |

---

*Aligned with: product.md, tech.md, structure.md*
