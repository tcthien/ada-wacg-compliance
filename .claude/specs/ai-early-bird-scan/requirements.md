# AI Early Bird Scan - Requirements Document

## Introduction

The AI Early Bird Scan feature enables users to receive AI-enhanced accessibility analysis for their scan results. This is a limited-time campaign offering premium AI features for free until the token budget is depleted, creating urgency and gathering user feedback before a paid launch.

**Key Characteristics:**
- **Local execution model**: AI analysis runs via Claude Code CLI on operator's local machine (no API costs in MVP)
- **Batch processing**: Operator manually processes pending AI requests on a schedule
- **Async delivery**: Users receive combined reports (standard + AI) via email within 24 hours
- **Token-based quota**: Campaign runs until token budget is exhausted

## Alignment with Product Vision

This feature directly supports ADAShield's product goals outlined in `product.md`:

| Product Goal | How This Feature Supports It |
|--------------|------------------------------|
| **Honest Positioning** | AI enhancement provides deeper explanations while maintaining transparency about automation limits |
| **Actionable Results** | AI-generated fix suggestions with code examples and priority rankings |
| **Phase 2 AI Enhancement** | Validates AI value proposition before full subscription implementation |
| **Year 1 Goal: 100 customers** | Early Bird campaign creates acquisition channel and builds email list |
| **Developer-First** | Technical fix suggestions with specific code examples |

---

## Requirements

### REQ-1: AI Scan Request on Main Scan Form

**User Story:** As a website owner, I want to opt into AI-enhanced analysis when submitting my scan, so that I receive both standard results immediately and AI insights via email.

#### Acceptance Criteria

1. WHEN the Early Bird campaign is active AND a user is on the main scan form THEN the system SHALL display an AI enhancement section containing:
   - A checkbox labeled "Enable AI-Powered Analysis" with Early Bird badge
   - Campaign status showing remaining slots (e.g., "234 of 500 slots remaining")
   - Brief description of AI benefits (explanations, fix suggestions, priority ranking)
   - Warning text: "AI results delivered via email within 24 hours"

2. WHEN the user checks the AI checkbox THEN the system SHALL:
   - Make the email field mandatory (display required indicator)
   - Show email input field if not already visible
   - Validate email format before allowing scan submission

3. WHEN the user unchecks the AI checkbox THEN the system SHALL:
   - Make the email field optional again
   - Allow scan submission without email

4. WHEN the user submits a scan WITH AI enhancement enabled THEN the system SHALL:
   - Run the standard axe-core scan immediately (existing flow)
   - Set `aiEnabled: true` and `aiStatus: PENDING` on the Scan record
   - Store the user's email on the existing Scan email field
   - Display progress with AI status integrated into main progress flow:
     - 0-50%: "Scanning website for accessibility issues..."
     - 50-90%: "Analyzing WCAG compliance..."
     - 90-95%: "Generating results..."
     - 95-99%: "Allocating resources for AI analysis..." (shown when `aiStatus=PENDING`)
   - Redirect to results page when standard scan completes

5. WHEN the user submits a scan WITHOUT AI enhancement THEN the system SHALL:
   - Run the standard axe-core scan only (existing flow)
   - Set `aiEnabled: false` on the Scan record (default)
   - Display results page as normal

6. IF the Early Bird campaign quota is depleted (0% remaining) THEN the system SHALL:
   - Hide the AI enhancement checkbox and section entirely OR
   - Display disabled checkbox with "Campaign ended - join waitlist" message
   - Allow standard scan submission without AI option

7. IF the Early Bird campaign is paused or inactive THEN the system SHALL:
   - Not display the AI enhancement section on the scan form

---

### REQ-2: Early Bird Landing Page

**User Story:** As a potential user, I want to learn about the AI Early Bird campaign on a dedicated landing page, so that I can understand the value proposition and start a scan.

#### Acceptance Criteria

1. WHEN a user visits `/early-bird` THEN the system SHALL display a promotional landing page with:
   - Campaign hero section with value proposition
   - "How it works" section (Scan → AI Analysis → Email)
   - Feature benefits list (explanations, fix suggestions, priority, roadmap)
   - Campaign status showing remaining slots
   - CTA button linking to scan form

2. WHEN the campaign is active THEN the landing page SHALL display the current quota status:
   - Visual progress bar (e.g., "234 of 500 slots remaining")
   - Urgency messaging based on quota level

3. IF the campaign quota is depleted THEN the landing page SHALL:
   - Display "Campaign Ended" message
   - Offer email signup for future AI features
   - Redirect CTA to standard scan form

4. WHEN a user clicks the main CTA THEN the system SHALL navigate to the main scan form with:
   - AI Early Bird checkbox pre-selected
   - Email field displayed and focused
   - Query parameter to indicate Early Bird source (e.g., `?ai=1`)

---

### REQ-3: Campaign Quota Management

**User Story:** As an administrator, I want to manage the Early Bird campaign quota, so that I can control costs and track AI usage.

#### Acceptance Criteria

1. WHEN the system initializes THEN it SHALL load the active Early Bird campaign configuration including:
   - Campaign name/identifier
   - Total token budget
   - Used tokens count
   - Campaign status (ACTIVE, PAUSED, DEPLETED, ENDED)
   - Start date and optional end date

2. WHEN an AI scan request is completed THEN the system SHALL:
   - Deduct the tokens used from the campaign budget
   - Update the remaining quota
   - Recalculate estimated remaining slots

3. IF remaining quota drops below threshold levels THEN the system SHALL update display messaging:
   - \> 20%: "X slots remaining"
   - 10-20%: "Limited slots! X remaining" (urgency styling)
   - 5-10%: "Almost gone! Only X left"
   - < 5%: "Final slots available!"
   - 0%: Hide AI option, show "Campaign ended"

4. WHEN an admin accesses the campaign dashboard THEN the system SHALL display:
   - Total budget vs used tokens
   - Number of completed/pending AI scans
   - Average tokens per scan
   - Estimated remaining scans

---

### REQ-4: AI Scan Queue Management (Admin/Operator)

**User Story:** As an operator, I want to download pending AI scans and upload processed results, so that I can run AI analysis locally using Claude Code CLI.

#### Acceptance Criteria

1. WHEN an operator requests pending AI scans THEN the system SHALL provide a CSV export of Scans where `aiEnabled=true` AND `aiStatus=PENDING`, containing:
   - scan_id
   - url
   - email
   - issues_json (all issues from the scan result)
   - created_at timestamp
   - wcag_level
   - Standard scan result data needed for AI context

2. WHEN a CSV is exported THEN the system SHALL update `aiStatus` from `PENDING` to `DOWNLOADED` on the exported Scan records.

3. WHEN an operator uploads AI results CSV THEN the system SHALL:
   - Parse the results (scan_id, ai_summary, ai_issues_json, tokens_used, processed_at)
   - Validate scan_id matches existing Scans with `aiEnabled=true`
   - Update the Scan record with AI enhancements
   - Deduct tokens from campaign quota
   - Update `aiStatus` to `COMPLETED`
   - Trigger email notification to user

4. IF a result upload fails validation THEN the system SHALL:
   - Return specific error messages for each failed row
   - Not partially commit the batch (atomic operation)
   - Keep `aiStatus` as `DOWNLOADED`

5. WHEN viewing the admin AI queue THEN the operator SHALL see:
   - List of all Scans with `aiEnabled=true`
   - Filter by `aiStatus` (PENDING, DOWNLOADED, PROCESSING, COMPLETED, FAILED)
   - Token usage statistics
   - Export and import buttons

---

### REQ-5: AI Enhancement Storage (Extend Existing Models)

**User Story:** As a system, I want to store AI-generated enhancements alongside standard scan results using extended fields on existing models, so that users can view combined reports.

#### Acceptance Criteria

1. WHEN AI results are imported THEN the system SHALL store on the existing **Scan** model:
   - `aiEnabled`: Boolean flag indicating AI was requested (set at scan creation)
   - `aiStatus`: Enum (PENDING, DOWNLOADED, PROCESSING, COMPLETED, FAILED)
   - `aiSummary`: Executive summary (2-3 paragraphs)
   - `aiRemediationPlan`: Prioritized fix roadmap with time estimates
   - `aiProcessedAt`: Timestamp of AI processing
   - `aiInputTokens`: Tokens used for the prompt
   - `aiOutputTokens`: Tokens used for AI response
   - `aiTotalTokens`: Sum of input + output
   - `aiModel`: AI model identifier used
   - `aiProcessingTime`: Seconds to complete

2. WHEN AI results are imported THEN the system SHALL store on the existing **Issue** model:
   - `aiExplanation`: Plain-language description of the issue
   - `aiFixSuggestion`: Code example or step-by-step fix instructions
   - `aiPriority`: 1-10 business impact score

3. The system SHALL maintain a separate **AiCampaign** model for campaign management:
   - `id`: Campaign identifier
   - `name`: Campaign name (e.g., "early-bird-jan-2025")
   - `totalTokenBudget`: Total tokens allocated
   - `usedTokens`: Tokens consumed so far
   - `status`: ACTIVE, PAUSED, DEPLETED, ENDED
   - `startsAt`: Campaign start date
   - `endsAt`: Optional campaign end date

4. NOTE: No new scan model is created. The existing Scan and BatchScan models are extended with AI-related fields.

---

### REQ-6: Results Page with Integrated AI Progress

**User Story:** As a user who submitted a scan with AI enhancement, I want to see my standard results with integrated AI status, so that I understand the complete scan progress.

#### Acceptance Criteria

1. WHEN a scan completes AND `aiEnabled=true` THEN the results page SHALL display:
   - All standard scan results (issues, severity, WCAG criteria)
   - An integrated progress/status section at the top showing:
     - Standard scan: ✅ Complete
     - AI Analysis: Current status based on `aiStatus`
   - Overall scan status reflecting both standard and AI components

2. The AI status display SHALL show progress messages based on `aiStatus`:
   - `PENDING`: "Allocating resources for AI analysis..." with spinner
   - `DOWNLOADED`: "AI analysis queued for processing..."
   - `PROCESSING`: "AI analyzing your accessibility issues..."
   - `COMPLETED`: "AI analysis complete" with checkmark
   - `FAILED`: "AI analysis unavailable" with option to retry

3. WHEN `aiStatus` is PENDING, DOWNLOADED, or PROCESSING THEN each issue SHALL display:
   - Standard issue details (existing)
   - Placeholder section: "AI insights loading..." or skeleton loader

4. WHEN `aiStatus=COMPLETED` THEN the results page SHALL:
   - Display AI enhancements inline with each issue (aiExplanation, aiFixSuggestion, aiPriority)
   - Show AI summary section at the top (aiSummary)
   - Display AI badges/icons next to AI-generated content
   - Update progress section to show both components complete

5. WHEN `aiStatus` changes (e.g., after operator processes batch) THEN the results page SHALL:
   - Auto-refresh or show "New AI results available" prompt
   - Allow user to load AI enhancements without page reload

6. The results page SHALL always show:
   - Email confirmation: "AI results will also be sent to {email}"
   - Expected timeframe: "within 24 hours" for pending/downloaded status

---

### REQ-7: Combined Report Email Delivery

**User Story:** As a user who requested AI enhancement, I want to receive a single comprehensive email with the combined report, so that I have all information in one place.

#### Acceptance Criteria

1. WHEN a Scan's `aiStatus` changes to COMPLETED THEN the system SHALL generate a combined report containing:
   - **Header**: URL, scan date, WCAG level
   - **Executive Summary** (AI): Overview for stakeholders
   - **Statistics**: Issue counts by severity (standard)
   - **Issue List** (Combined): Each issue with standard details + AI explanation + AI fix suggestion
   - **Remediation Roadmap** (AI): Prioritized action plan with time estimates
   - **Passed Checks**: Compliant items (standard)

2. WHEN the combined report is ready THEN the system SHALL send an email notification including:
   - Subject: "Your AI Accessibility Analysis is Ready!"
   - Quick summary (issue count, critical issues, estimated fix time)
   - Top 3 priority fixes
   - Link to view full report
   - Campaign attribution text

3. WHEN a user clicks the report link THEN the system SHALL display the web-based combined report with:
   - Visual distinction between standard and AI-enhanced content
   - AI badges/icons to highlight AI-generated sections
   - Export options (PDF, JSON)

---

### REQ-8: Admin Dashboard - AI Campaign Monitoring

**User Story:** As an administrator, I want to monitor the Early Bird campaign performance, so that I can track usage and make operational decisions.

#### Acceptance Criteria

1. WHEN an admin accesses the AI campaign dashboard THEN the system SHALL display:
   - Campaign overview (name, status, dates)
   - Token usage chart (used vs remaining)
   - Scan count metrics (completed, pending, failed)
   - Average tokens per scan
   - Estimated remaining capacity

2. WHEN viewing the AI scan list THEN the admin SHALL see:
   - Sortable/filterable table of all AI scan requests
   - Columns: Scan ID, URL, Email, Status, Tokens Used, Requested At, Processed At
   - Status filter (PENDING, DOWNLOADED, COMPLETED, FAILED)
   - Date range filter
   - Export to CSV option

3. WHEN an admin needs to manage the campaign THEN the system SHALL provide:
   - Pause/Resume campaign toggle
   - Adjust total budget (add tokens)
   - View audit log of campaign changes

---

## Non-Functional Requirements

### Performance

| Requirement | Target |
|-------------|--------|
| Campaign status API response | < 100ms |
| AI request submission | < 500ms |
| CSV export (100 scans) | < 5 seconds |
| CSV import (100 results) | < 30 seconds |
| Combined report page load | < 2 seconds |

### Security

- Email addresses stored with encryption at rest
- CSV export requires admin authentication
- CSV import validates data integrity before processing
- Rate limiting on AI request submission (1 per scan)
- Audit logging for all campaign modifications

### Reliability

- AI request queue persists across server restarts (database-backed)
- Failed imports can be retried without duplicate processing
- Email delivery failures logged with retry mechanism
- Campaign quota updates are atomic (no race conditions)

### Usability

- Mobile-responsive landing page and results page
- Clear visual hierarchy distinguishing AI content from standard content
- Progress indicators during submission
- Accessible UI components (WCAG 2.2 AA compliant - dogfooding!)
- Clear error messages for validation failures

### Scalability

- Support up to 10,000 AI scan requests per campaign
- CSV export/import handles batches of 500+ scans
- Token tracking accurate to individual scan level

---

## Out of Scope (MVP)

The following are explicitly NOT included in this MVP:

- Real-time AI processing via API (future Phase 2)
- User accounts and authentication (guest sessions only)
- Subscription billing integration
- Automated script scheduling (manual operator execution)
- AI analysis of batch scans (single URL scans only for MVP)
- PDF report with AI sections (web-based report only for MVP)

---

## Dependencies

| Dependency | Description |
|------------|-------------|
| Existing Scan Model | Extends with AI fields (`aiEnabled`, `aiStatus`, `aiSummary`, etc.) - NO new scan model |
| Existing Issue Model | Extends with AI fields (`aiExplanation`, `aiFixSuggestion`, `aiPriority`) |
| Existing Scan Module | Leverages `scan.service.ts`, `scan.repository.ts` patterns |
| Email System | Reuses `email-templates.ts`, `email-router.ts` for notifications |
| Admin Authentication | Requires existing admin auth for queue management |
| Database | Extends Prisma schema - adds AiCampaign model and AI fields to existing models |
| Redis | Uses existing Redis for campaign quota caching |

---

## Glossary

| Term | Definition |
|------|------------|
| **AI-Enabled Scan** | A Scan with `aiEnabled=true`, indicating the user requested AI enhancement |
| **aiStatus** | Field on Scan model tracking AI processing state (PENDING, DOWNLOADED, PROCESSING, COMPLETED, FAILED) |
| **Token** | Unit of AI model usage (input + output tokens) |
| **Quota** | Total token budget for the Early Bird campaign |
| **Slot** | Estimated number of AI scans remaining (quota / avg tokens per scan) |
| **Combined Report** | Single report merging standard scan results with AI enhancements |
| **Operator** | Admin user who runs the local Claude Code processing script |
| **AiCampaign** | Database model managing campaign settings and token budget (separate from Scan) |
