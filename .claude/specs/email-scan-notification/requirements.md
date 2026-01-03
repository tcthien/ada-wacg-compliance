# Requirements Document: Email Scan Notification

## Introduction

This feature enables users to receive scan results via email notification when accessibility scans complete. When a user provides their email address and opts-in to email notifications during scan submission, the system will automatically send them an email containing a summary of the scan results and a direct link to view the full report.

This feature enhances user engagement by delivering results proactively, supporting users who submit scans and navigate away, and providing a professional deliverable they can forward to stakeholders.

## Alignment with Product Vision

This feature directly supports the ADAShield product vision as outlined in product.md:

| Product Principle | How This Feature Aligns |
|-------------------|------------------------|
| **Actionable Results** | Email delivers issue summary with severity breakdown and direct link to full report |
| **User Activation** | Reduces Time to First Scan friction - users don't have to wait on page |
| **SMB/Agency Focus** | Provides shareable professional notification for client communication |
| **Privacy-Conscious** | GDPR-compliant with opt-in consent and automatic email deletion after sending |

**Success Metrics Alignment:**
- Improves "Time to First Scan" by allowing users to submit and navigate away
- Increases user engagement through proactive result delivery
- Supports "Scan Completion Rate" by notifying users of both successes and failures

## Requirements

### Requirement 1: Email Opt-in During Scan Submission

**User Story:** As a user submitting a scan, I want to optionally provide my email and opt-in to receive results via email, so that I can be notified when my scan completes without staying on the page.

#### Acceptance Criteria

1.1. WHEN the user views the scan form THEN the system SHALL display an optional email input field with a consent checkbox for receiving email notifications.

1.2. IF the user enters an email without checking the consent checkbox THEN the system SHALL NOT store the email or send notifications.

1.3. IF the user checks the consent checkbox without entering a valid email THEN the system SHALL display a validation error requiring a valid email address.

1.4. WHEN the user provides a valid email AND checks the consent checkbox THEN the system SHALL store the email with the scan record.

1.5. WHEN the email and consent are provided THEN the system SHALL display a GDPR-compliant notice explaining that the email will be deleted after the notification is sent.

### Requirement 2: Email Notification on Scan Completion

**User Story:** As a user who opted-in to email notifications, I want to receive an email when my scan completes successfully, so that I can review my accessibility results.

#### Acceptance Criteria

2.1. WHEN a scan completes successfully AND the scan has an associated email THEN the system SHALL queue an email notification job.

2.2. WHEN the email notification is sent THEN it SHALL include:
   - Subject line containing the scanned URL and completion status
   - Summary of total issues found
   - Breakdown by severity (Critical, Serious, Moderate, Minor)
   - Number of passed checks
   - Direct link to view the full scan results
   - ADAShield branding

2.3. IF the scan completes in less than 30 seconds AND the user is still on the results page THEN the system MAY skip the email notification (user already has immediate access).

2.4. WHEN the email is successfully sent THEN the system SHALL nullify (delete) the email address from the scan record for GDPR compliance.

### Requirement 3: Email Notification on Scan Failure

**User Story:** As a user who opted-in to email notifications, I want to be notified if my scan fails, so that I can understand what went wrong and try again.

#### Acceptance Criteria

3.1. WHEN a scan fails AND the scan has an associated email THEN the system SHALL queue a failure notification email.

3.2. WHEN the failure email is sent THEN it SHALL include:
   - Subject line indicating the scan failed
   - The URL that was being scanned
   - Error description (user-friendly, not technical stack traces)
   - Troubleshooting suggestions
   - Link to try scanning again
   - Support contact information

3.3. WHEN the failure email is sent THEN the system SHALL nullify the email address from the scan record.

### Requirement 4: Batch Scan Email Notifications

**User Story:** As a user who submits a batch scan with email notification enabled, I want to receive a single summary email when all URLs in the batch complete, so that I get a consolidated view of results.

#### Acceptance Criteria

4.1. WHEN a batch scan is created with email notification enabled THEN the system SHALL store the email with the batch record (not individual scans).

4.2. WHEN all scans in a batch complete (success or failure) AND the batch has an associated email THEN the system SHALL queue a batch completion email.

4.3. WHEN the batch email is sent THEN it SHALL include:
   - Total URLs scanned
   - Aggregate issue breakdown by severity across all URLs
   - List of top URLs with most critical issues (up to 5)
   - Success/failure count for individual scans
   - Link to view full batch results
   - Link to download PDF/JSON reports

4.4. WHEN the batch email is sent THEN the system SHALL nullify the email address from the batch record.

### Requirement 5: Email Delivery Reliability

**User Story:** As a system administrator, I want email notifications to be reliably delivered with proper retry logic, so that users consistently receive their notifications.

#### Acceptance Criteria

5.1. WHEN an email job is queued THEN the system SHALL attempt delivery with exponential backoff retry (up to 5 attempts).

5.2. IF email delivery fails after all retry attempts THEN the system SHALL log the failure with relevant details for debugging.

5.3. IF email delivery fails THEN the system SHALL still nullify the email address from the record (user should not receive delayed emails).

5.4. WHEN processing email jobs THEN the system SHALL select the appropriate email provider based on configured routing rules (see Requirement 6).

### Requirement 6: Multi-Provider Email Routing

**User Story:** As a system administrator, I want to configure multiple email providers (SendGrid and AWS SES) with routing rules based on recipient email patterns, so that I can optimize deliverability and cost for different email domains.

#### Acceptance Criteria

6.1. WHEN the system sends an email THEN it SHALL support two email providers:
   - **SendGrid** - Primary cloud email service
   - **AWS SES** - Amazon Simple Email Service

6.2. WHEN configuring email routing THEN the system SHALL support configuration via:

   **Option A: Environment Variables (.env)**
   ```bash
   # Default provider when no pattern matches
   EMAIL_DEFAULT_PROVIDER=SES

   # SendGrid routing patterns (comma-separated)
   EMAIL_SENDGRID_PATTERNS=*@microsoft.com,*@outlook.com,*@hotmail.com,*-abc@gmail.com

   # SES routing patterns (comma-separated)
   EMAIL_SES_PATTERNS=*@*.edu,*@company.com
   ```

   **Option B: YAML Configuration (config/email-routing.yml)**
   ```yaml
   email-routing:
     default-provider: SES

     providers:
       - sender: SENDGRID
         patterns:
           - "*@microsoft.com"
           - "*@outlook.com"
           - "*@hotmail.com"
           - "*-abc@gmail.com"

       - sender: SES
         patterns:
           - "*@*.edu"
           - "*@company.com"
   ```

6.3. WHEN defining routing patterns THEN the system SHALL support:
   - Domain match: `*@microsoft.com` (matches all emails from microsoft.com)
   - Subdomain wildcard: `*@*.edu` (matches all .edu domains)
   - Prefix pattern: `*-abc@gmail.com` (matches emails ending with -abc@gmail.com)
   - Exact match: `admin@example.com` (matches specific email)
   - Pattern matching SHALL be case-insensitive

6.4. WHEN the system processes an email job THEN it SHALL:
   1. Extract the recipient email address
   2. Check SendGrid patterns first, then SES patterns (configurable order)
   3. IF a pattern matches THEN use that provider
   4. IF no pattern matches THEN use the default provider

6.5. IF a configured provider is unavailable or returns an error THEN the system SHALL:
   1. Log the failure with provider details
   2. Retry with the same provider (per Requirement 5.1)
   3. NOT automatically fall back to another provider (to maintain routing integrity)

6.6. WHEN the application starts THEN the system SHALL:
   - Load and validate email routing configuration
   - Log the active routing rules for debugging
   - IF configuration is invalid THEN fail fast with clear error message

## Non-Functional Requirements

### Performance

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Email queue processing time | < 5 seconds after scan completion | Timely user notification |
| Email delivery time | < 30 seconds from queue to inbox | User expectation management |
| Email job throughput | 100+ emails/minute | Support concurrent scans |

### Security

| Requirement | Implementation |
|-------------|----------------|
| Email address storage | Encrypted at rest in PostgreSQL |
| Email transmission | TLS required via SendGrid and AWS SES |
| GDPR compliance | Automatic deletion after sending |
| No email logging | Email addresses never logged in plain text |
| Consent tracking | Explicit opt-in required, consent timestamp stored |
| Provider credentials | Stored in AWS Secrets Manager / environment variables |
| Routing config access | Config files protected by file system permissions |

### Reliability

| Requirement | Target | Implementation |
|-------------|--------|----------------|
| Email delivery success rate | > 99% | Multi-provider support, proper DNS (SPF, DKIM, DMARC) |
| Retry mechanism | 5 attempts with exponential backoff | BullMQ job configuration |
| Graceful degradation | No scan impact on email failure | Async job processing |
| Provider health monitoring | Track success/failure rates per provider | Logging and metrics |

### Usability

| Requirement | Implementation |
|-------------|----------------|
| Mobile-responsive emails | HTML templates with mobile-first design |
| Plain text alternative | Fallback for email clients without HTML |
| Clear CTAs | Prominent "View Results" button |
| Professional branding | ADAShield logo and consistent styling |
| Unambiguous subject lines | Include URL and status in subject |

## Out of Scope

The following items are explicitly out of scope for this feature:

1. **User accounts/preferences** - This uses scan-level opt-in, not account-level preferences
2. **Email templates customization** - Fixed templates, no user customization
3. **Scheduled/recurring notifications** - Only completion notifications
4. **Marketing emails** - Strictly transactional scan result notifications
5. **Email analytics/tracking** - No open/click tracking to preserve privacy
6. **Multiple recipients** - Single email per scan submission

## Dependencies

### Existing Infrastructure (Already Available)

| Component | Status | Location |
|-----------|--------|----------|
| Email templates | Complete | `/apps/worker/src/processors/notifier/email-templates.ts` |
| Email sender (SendGrid) | Complete | `/apps/worker/src/processors/notifier/email-sender.ts` |
| Email processor | Complete | `/apps/worker/src/processors/send-email.processor.ts` |
| Email queue definition | Complete | `/apps/api/src/shared/queue/queues.ts` |
| Database email field | Complete | `Scan.email` in Prisma schema |
| ScanForm email input | Complete | `/apps/web/src/components/features/scan/ScanForm.tsx` |

### Implementation Required

| Component | Description |
|-----------|-------------|
| Job queueing | Connect scan completion to email queue |
| Batch email template | Create batch-specific email template |
| Batch email trigger | Detect batch completion and queue email |
| Email field in BatchScan | Add email storage to batch model |
| AWS SES sender | Implement SES email provider alongside SendGrid |
| Email router | Pattern-matching logic to select provider based on config |
| Routing config loader | Load routing rules from .env or YAML config file |
| Provider factory | Factory pattern to instantiate correct email provider |

## Glossary

| Term | Definition |
|------|------------|
| **Opt-in** | Explicit user consent to receive email notifications |
| **GDPR** | General Data Protection Regulation - EU privacy law |
| **Nullify** | Delete/clear the email address from database records |
| **SendGrid** | Third-party cloud email delivery service provider (Twilio) |
| **AWS SES** | Amazon Simple Email Service - AWS-native email sending service |
| **BullMQ** | Redis-based job queue used for async processing |
| **Exponential backoff** | Retry strategy that increases delay between attempts |
| **Email routing** | Process of selecting which email provider to use based on recipient patterns |
| **Routing rule** | Configuration that maps email patterns to specific providers |
| **Wildcard pattern** | Pattern using `*` to match variable portions of email addresses |
| **SPF/DKIM/DMARC** | Email authentication protocols for deliverability and anti-spoofing |

---

*Document Version: 1.2*
*Created: December 30, 2025*
*Updated: December 30, 2025 - Added multi-provider email routing with .env/YAML config (Requirement 6)*
*Feature: email-scan-notification*
