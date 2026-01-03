# Requirements Document: Batch Scan Export

## Introduction

This feature enables users to export batch scan results in PDF and JSON formats. Currently, the application only supports exporting individual scan results, leaving batch scan users unable to download comprehensive reports of their multi-URL accessibility audits. This capability is essential for agencies, developers, and organizations who need to document and share accessibility compliance status across multiple pages.

## Alignment with Product Vision

This feature directly supports ADAShield's product goals outlined in product.md:

| Product Goal | How This Feature Supports It |
|--------------|------------------------------|
| **PDF/JSON Export** (MVP Feature) | Extends existing export to batch scans, completing the core export functionality |
| **Actionable Results** | Provides downloadable evidence for legal documentation and compliance records |
| **Agency White-Label Support** | Enables agencies to share comprehensive reports with clients |
| **Developer-First** | JSON export supports CI/CD integration and programmatic analysis |
| **Documentation for Legal** | Critical for businesses defending against ADA lawsuits |

## Requirements

### Requirement 1: Batch PDF Export

**User Story:** As a user who has completed a batch scan, I want to export all scan results as a single PDF document, so that I can share a comprehensive accessibility report with stakeholders.

#### Acceptance Criteria

1. WHEN user clicks export PDF on a completed batch scan THEN system SHALL generate a PDF containing all scanned URLs and their issues
2. WHEN PDF is generated THEN system SHALL include an executive summary with aggregate statistics (total issues by severity across all URLs)
3. WHEN PDF is generated THEN system SHALL include per-URL breakdown showing issue counts and details
4. IF batch scan is still in progress THEN system SHALL disable the export button and show remaining scan count
5. WHEN PDF generation is in progress THEN system SHALL show a loading indicator with option to cancel
6. WHEN PDF is ready THEN system SHALL automatically download the file to user's device
7. WHEN PDF is generated THEN system SHALL include the transparency disclaimer about automated testing limitations

### Requirement 2: Batch JSON Export

**User Story:** As a developer or agency user, I want to export batch scan results as JSON, so that I can integrate the data into my own reporting tools or CI/CD pipelines.

#### Acceptance Criteria

1. WHEN user clicks export JSON on a completed batch scan THEN system SHALL generate a JSON file containing all scan results
2. WHEN JSON is generated THEN system SHALL include metadata (batch ID, homepage URL, WCAG level, timestamps)
3. WHEN JSON is generated THEN system SHALL include aggregate statistics across all URLs
4. WHEN JSON is generated THEN system SHALL include per-URL results with full issue details
5. IF batch scan is still in progress THEN system SHALL disable the export button
6. WHEN JSON is ready THEN system SHALL automatically download the file to user's device
7. WHEN JSON is generated THEN system SHALL follow the same schema structure as single scan exports for consistency

### Requirement 3: Batch Export UI Integration

**User Story:** As a user viewing batch scan results, I want export options readily available in the interface, so that I can easily download reports when needed.

#### Acceptance Criteria

1. WHEN batch scan is completed THEN system SHALL display export buttons (PDF, JSON) in the batch results view
2. WHEN batch scan is displayed in admin panel THEN system SHALL show export options in the batch detail page
3. WHEN user hovers over disabled export button THEN system SHALL show tooltip explaining why export is unavailable
4. WHEN export modal is open THEN system SHALL support keyboard navigation and be accessible (WCAG 2.2 AA)
5. WHEN export is triggered THEN system SHALL show the same modal pattern as single scan exports for consistency

### Requirement 4: Export Status and Error Handling

**User Story:** As a user exporting batch results, I want clear feedback on export status and helpful error messages, so that I can troubleshoot issues or retry if needed.

#### Acceptance Criteria

1. WHEN export generation starts THEN system SHALL show generating status with spinner
2. IF export generation fails THEN system SHALL display error message with retry option
3. WHEN user cancels export THEN system SHALL stop the generation process and return to idle state
4. IF network error occurs during download THEN system SHALL show error and allow retry
5. WHEN export completes successfully THEN system SHALL show success confirmation before auto-closing modal

### Requirement 5: Admin Batch Export

**User Story:** As an admin, I want to export any batch scan results regardless of session ownership, so that I can support users and audit accessibility compliance.

#### Acceptance Criteria

1. WHEN admin views batch detail page THEN system SHALL show export options (PDF, JSON)
2. WHEN admin exports batch THEN system SHALL bypass session ownership checks
3. WHEN admin exports batch THEN system SHALL log the export action for audit purposes
4. IF batch belongs to guest session THEN system SHALL still allow admin to export

## Non-Functional Requirements

### Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| PDF Generation Time | < 30 seconds for 50 URLs | Consistent with single scan report generation target |
| JSON Generation Time | < 10 seconds for 50 URLs | JSON is simpler to generate than PDF |
| File Download Start | < 2 seconds after generation | Quick response for user satisfaction |
| Maximum Batch Size | 100 URLs per batch | Prevents memory/timeout issues |

### Security

- All generated reports SHALL be stored with unique keys to prevent enumeration attacks
- Presigned URLs SHALL expire after 1 hour to limit exposure
- All user-provided content in reports SHALL be sanitized to prevent XSS/injection
- Admin export actions SHALL be logged with user ID and timestamp

### Reliability

- Report generation failures SHALL be retryable without re-running the batch scan
- Partially generated reports SHALL not be served to users (atomic generation)
- S3 upload failures SHALL trigger automatic retry (up to 3 attempts)

### Usability

- Export buttons SHALL be clearly visible in batch results view
- Export format selection SHALL be intuitive (PDF for sharing, JSON for developers)
- Progress indication SHALL accurately reflect generation status
- Error messages SHALL be actionable and user-friendly

---

*Requirements Version: 1.0*
*Created: December 2024*
