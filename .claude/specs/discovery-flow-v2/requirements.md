# Discovery Flow V2 - Requirements

## Overview

### Feature Summary
Redesign the multi-page discovery flow to provide a clearer 3-step process (Input URLs → Select URLs → Preview) with two input methods (Sitemap and Manual), and improve the batch scan display in the main scanner form by showing URLs in a table format instead of a simple textarea.

### Problem Statement
The current discovery flow has 4 steps that can be confusing for users. Additionally, when users return to the main scan form with multiple URLs selected, they are displayed in a simple textarea which doesn't provide good visibility or management capabilities. Users need:
1. A simpler, more intuitive discovery process
2. Two clear input options: sitemap-based discovery or manual URL entry
3. Better visualization and management of selected URLs before scanning

### Success Metrics
- Reduced user drop-off during discovery flow (target: 20% improvement)
- Increased batch scan completion rate
- Reduced time to complete discovery → scan workflow
- Improved user satisfaction with URL management

---

## User Stories

### US-1: Sitemap URL Discovery
**As a** website owner
**I want to** enter my sitemap URL to discover all pages
**So that** I can quickly find all pages on my website without manual entry

**Acceptance Criteria:**
- WHEN user selects "Sitemap" option in Step 1
- THEN system displays a single URL input field for sitemap URL
- WHEN user enters a valid sitemap URL (e.g., https://example.com/sitemap.xml)
- AND clicks "Continue"
- THEN system fetches and parses the sitemap
- AND extracts all page URLs from the sitemap
- AND proceeds to Step 2 (Select URLs)

### US-2: Manual URL Entry
**As a** website owner
**I want to** manually enter multiple URLs
**So that** I can scan specific pages I choose without sitemap dependency

**Acceptance Criteria:**
- WHEN user selects "Manual" option in Step 1
- THEN system displays a textarea for URL entry
- WHEN user enters URLs (semicolon-separated OR multi-line format)
- AND clicks "Continue"
- THEN system parses and validates all entered URLs
- AND proceeds to Step 2 (Select URLs)

**URL Input Formats Supported:**
```
# Semicolon-separated (single line)
https://example.com;https://example.com/about;https://example.com/contact

# Multi-line (one URL per line)
https://example.com
https://example.com/about
https://example.com/contact
```

### US-3: URL Selection Step
**As a** user
**I want to** review and select which discovered URLs to scan
**So that** I can exclude irrelevant pages and focus on important ones

**Acceptance Criteria:**
- WHEN user reaches Step 2 (Select URLs)
- THEN system displays all discovered/entered URLs in a selectable list
- AND provides "Select All" / "Deselect All" controls
- AND shows URL count (selected/total)
- WHEN user toggles URL selection
- THEN selection state updates immediately
- AND selected count updates in real-time
- WHEN user clicks "Continue"
- THEN system proceeds to Step 3 (Preview)

### US-4: Preview Step
**As a** user
**I want to** preview my final selection before starting the scan
**So that** I can confirm everything is correct before proceeding

**Acceptance Criteria:**
- WHEN user reaches Step 3 (Preview)
- THEN system displays a summary table of selected URLs
- AND shows total URL count
- AND displays estimated scan time (based on URL count)
- AND provides "Back" button to modify selection
- AND provides "Start Scan" button to proceed
- WHEN user clicks "Start Scan"
- THEN system saves selection and returns to main scanner form

### US-5: Batch URL Table Display
**As a** user
**I want to** see my batch URLs in a compact table format on the main scanner form
**So that** I can easily review URLs while keeping the UI clean and focused

**Acceptance Criteria:**
- WHEN user returns to main scanner form with multiple URLs selected
- THEN system displays URLs in a table format (not textarea)
- AND table shows: URL, Title (if available), Remove action
- AND provides "Clear All" option
- AND shows total URL count (e.g., "5 URLs selected")
- IF batch contains more than 3 URLs
- THEN system displays only the first 3 URLs initially
- AND shows "Show more (+N more)" link below the table
- WHEN user clicks "Show more"
- THEN table expands to show all URLs
- AND "Show more" changes to "Show less"
- WHEN user clicks "Show less"
- THEN table collapses back to first 3 URLs
- WHEN user clicks remove on a URL
- THEN URL is removed from the batch
- AND table updates immediately
- AND URL count updates
- IF all URLs are removed
- THEN UI reverts to single URL input mode

### US-6: Step Navigation
**As a** user
**I want to** navigate between steps freely
**So that** I can modify my inputs at any point

**Acceptance Criteria:**
- WHEN user is on any step after Step 1
- THEN "Back" button is visible and enabled
- WHEN user clicks "Back"
- THEN system returns to previous step
- AND preserves user's previous inputs
- WHEN user is on Step 1
- THEN "Back" button is hidden or disabled

---

## Functional Requirements

### FR-1: Step 1 - Input URLs
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | System SHALL display two input method options: "Sitemap" and "Manual" | Must |
| FR-1.2 | Sitemap option SHALL accept a single URL input for sitemap location | Must |
| FR-1.3 | Manual option SHALL accept multiple URLs via textarea | Must |
| FR-1.4 | Manual input SHALL support semicolon-separated format | Must |
| FR-1.5 | Manual input SHALL support multi-line format (one URL per line) | Must |
| FR-1.6 | System SHALL validate URL format before proceeding | Must |
| FR-1.7 | System SHALL display validation errors inline | Must |
| FR-1.8 | System SHALL limit maximum URLs to 50 per batch | Must |

### FR-2: Step 2 - Select URLs
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | System SHALL display all URLs in a selectable list/table | Must |
| FR-2.2 | Each URL row SHALL have a checkbox for selection | Must |
| FR-2.3 | System SHALL provide "Select All" functionality | Must |
| FR-2.4 | System SHALL provide "Deselect All" functionality | Must |
| FR-2.5 | System SHALL display selected count / total count | Must |
| FR-2.6 | System SHALL pre-select all URLs by default | Should |
| FR-2.7 | System SHALL allow search/filter within URL list | Could |

### FR-3: Step 3 - Preview
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | System SHALL display final URL selection in table format | Must |
| FR-3.2 | System SHALL show estimated scan duration | Should |
| FR-3.3 | System SHALL provide confirmation before proceeding | Must |
| FR-3.4 | System SHALL allow navigation back to previous steps | Must |

### FR-4: Main Scanner Form - Batch URL Display
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | System SHALL display batch URLs in table format | Must |
| FR-4.2 | Table SHALL show columns: URL, Title, Actions | Must |
| FR-4.3 | Each row SHALL have a remove/delete action | Must |
| FR-4.4 | System SHALL provide "Clear All" functionality | Must |
| FR-4.5 | System SHALL display total URL count | Must |
| FR-4.6 | Table SHALL initially show maximum 3 URLs when batch > 3 URLs | Must |
| FR-4.7 | System SHALL provide "Show more (+N more)" toggle when URLs > 3 | Must |
| FR-4.8 | "Show more" toggle SHALL expand to show all URLs | Must |
| FR-4.9 | "Show less" toggle SHALL collapse back to first 3 URLs | Must |
| FR-4.10 | System SHALL revert to single URL mode if all batch URLs removed | Must |

### FR-5: Data Persistence
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | System SHALL persist discovery state in sessionStorage | Must |
| FR-5.2 | System SHALL preserve selection state across step navigation | Must |
| FR-5.3 | System SHALL clear discovery data after successful scan submission | Must |

---

## Non-Functional Requirements

### NFR-1: Performance
| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1.1 | Sitemap parsing SHALL complete within 10 seconds | Must |
| NFR-1.2 | URL list rendering SHALL handle 50 URLs without lag | Must |
| NFR-1.3 | Selection state changes SHALL reflect within 100ms | Must |

### NFR-2: Usability
| ID | Requirement | Target |
|----|-------------|--------|
| NFR-2.1 | Discovery flow SHALL be completable in under 2 minutes | Should |
| NFR-2.2 | All steps SHALL be accessible via keyboard navigation | Must |
| NFR-2.3 | Error messages SHALL be clear and actionable | Must |

### NFR-3: Compatibility
| ID | Requirement | Target |
|----|-------------|--------|
| NFR-3.1 | Feature SHALL work on Chrome, Firefox, Safari, Edge (latest 2 versions) | Must |
| NFR-3.2 | Feature SHALL be responsive for mobile devices (min 375px width) | Should |

---

## Constraints

### Technical Constraints
- Must integrate with existing discovery API (`/api/v1/discoveries`)
- Must use existing batch API (`/api/v1/batches`) for scan submission
- Maximum 50 URLs per batch (existing API limitation)
- Must maintain backward compatibility with existing sessionStorage format

### Business Constraints
- Feature must work for free tier users (no authentication required)
- Must not increase server load significantly (reuse existing endpoints)

---

## Out of Scope
- Sitemap generation functionality
- Recursive sitemap parsing (sitemap index files)
- URL validation beyond format check (no HEAD requests to verify pages exist)
- Drag-and-drop URL reordering
- URL grouping/categorization
- Saving URL lists for future use (requires authentication)

---

## Dependencies
- Existing Discovery API endpoints
- Existing Batch API endpoints
- sessionStorage browser API
- Current ScanForm component architecture
