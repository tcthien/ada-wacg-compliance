# Requirements Document: Admin Module

## Introduction

The Admin Module provides administrative capabilities for ADAShield, enabling authorized administrators to manage all scans in the system and track customers based on the email addresses they provide when triggering scans. This module introduces user authentication, role-based access control, and administrative dashboards for system-wide visibility and management.

## Alignment with Product Vision

This feature directly supports ADAShield's product goals outlined in product.md:

- **Enterprise Features (Phase 3)**: Team collaboration and multi-user accounts with roles
- **Business Objectives**: Supports scaling to 1,000+ customers by Year 2-3
- **Developer-First Principle**: Clean API for admin operations
- **Privacy-Conscious**: Minimal data collection, secure admin access

The admin module enables ADAShield to transition from a guest-only system to one supporting authenticated users with proper access controls - essential for enterprise adoption and agency partnerships.

## Requirements

### Requirement 1: Administrator Authentication

**User Story:** As an administrator, I want to securely log in to the admin panel, so that I can access administrative functions without unauthorized access.

#### Acceptance Criteria

1. WHEN an admin submits valid email and password credentials THEN the system SHALL authenticate the user and return a JWT access token with 24-hour expiration.
2. WHEN an admin submits invalid credentials THEN the system SHALL return a 401 Unauthorized error without revealing which field was incorrect.
3. WHEN an admin's JWT token expires THEN the system SHALL reject all admin API requests with a 401 error until re-authentication.
4. IF an admin account is deactivated THEN the system SHALL reject login attempts with an appropriate error message.
5. WHEN an admin logs out THEN the system SHALL invalidate the current session token.

---

### Requirement 2: Admin User Management

**User Story:** As an administrator, I want to create, view, update, and deactivate other admin accounts, so that I can control who has access to administrative functions.

#### Acceptance Criteria

1. WHEN an admin creates a new admin user with email and password THEN the system SHALL store the user with a securely hashed password and return the created user (excluding password).
2. WHEN an admin views the admin user list THEN the system SHALL return all admin users with pagination support (default 20 per page).
3. WHEN an admin updates another admin's details THEN the system SHALL update only the provided fields (email, role, isActive status).
4. WHEN an admin deactivates another admin account THEN the system SHALL set isActive to false and prevent future logins.
5. IF an admin attempts to create a user with an existing email THEN the system SHALL return a 409 Conflict error.
6. WHEN an admin resets another admin's password THEN the system SHALL generate a secure temporary password and require change on next login.

---

### Requirement 3: System-Wide Scan Management

**User Story:** As an administrator, I want to view and manage all scans in the system, so that I can monitor system usage, troubleshoot issues, and maintain service quality.

#### Acceptance Criteria

1. WHEN an admin requests the scan list THEN the system SHALL return all scans across all sessions with pagination (default 20 per page).
2. WHEN an admin filters scans by status (PENDING, RUNNING, COMPLETED, FAILED) THEN the system SHALL return only scans matching the filter.
3. WHEN an admin filters scans by date range THEN the system SHALL return scans created within the specified range.
4. WHEN an admin filters scans by customer email THEN the system SHALL return scans associated with that email address.
5. WHEN an admin views scan details THEN the system SHALL return the full scan data including results, issues, and associated session/email information.
6. WHEN an admin deletes a scan THEN the system SHALL remove the scan and all associated data (results, issues, reports) with a soft-delete option.
7. WHEN an admin retries a failed scan THEN the system SHALL queue a new scan job with the same parameters.

---

### Requirement 4: Customer Tracking by Email

**User Story:** As an administrator, I want to view all customers who have used the service based on their provided email addresses, so that I can understand customer usage patterns and provide support.

#### Acceptance Criteria

1. WHEN an admin requests the customer list THEN the system SHALL return unique email addresses from all scans with aggregated statistics (total scans, last scan date).
2. WHEN an admin views a customer's profile THEN the system SHALL return all scans associated with that email address, ordered by date.
3. WHEN an admin searches for a customer by email THEN the system SHALL return matching customers using partial email matching (case-insensitive).
4. WHEN an admin filters customers by scan count THEN the system SHALL return customers with scans within the specified range.
5. WHEN an admin filters customers by date range THEN the system SHALL return customers who scanned within that period.
6. WHEN an admin exports customer data THEN the system SHALL generate a CSV/JSON file with customer email and scan summary.

---

### Requirement 5: Admin Dashboard & Analytics

**User Story:** As an administrator, I want to view system-wide analytics and statistics, so that I can monitor service health and business metrics.

#### Acceptance Criteria

1. WHEN an admin views the dashboard THEN the system SHALL display key metrics: total scans (today/week/month), success rate, active sessions, unique customers.
2. WHEN an admin views scan trends THEN the system SHALL display a chart of scans over time (daily for last 30 days).
3. WHEN an admin views issue distribution THEN the system SHALL display breakdown of issues by severity (critical, serious, moderate, minor).
4. WHEN an admin views top scanned domains THEN the system SHALL display the most frequently scanned URLs/domains.
5. WHEN an admin views system status THEN the system SHALL display queue health, worker status, and error rates.

---

### Requirement 6: Admin Audit Logging

**User Story:** As an administrator, I want all administrative actions to be logged, so that I can track changes and maintain accountability.

#### Acceptance Criteria

1. WHEN an admin performs any create/update/delete action THEN the system SHALL log the action with timestamp, admin ID, action type, target entity, and before/after values.
2. WHEN an admin views the audit log THEN the system SHALL return logs with pagination and filtering by date range, admin, and action type.
3. WHEN an admin exports audit logs THEN the system SHALL generate a downloadable file in JSON or CSV format.
4. IF audit log storage exceeds retention period (90 days default) THEN the system SHALL archive old logs to cold storage.

---

### Requirement 7: Admin Frontend Interface

**User Story:** As an administrator, I want a dedicated admin dashboard interface, so that I can efficiently manage the system through a user-friendly UI.

#### Acceptance Criteria

1. WHEN an admin navigates to /admin THEN the system SHALL display a login page if not authenticated, or the dashboard if authenticated.
2. WHEN an admin is authenticated THEN the system SHALL display a sidebar with navigation to: Dashboard, Scans, Customers, Users, Audit Log.
3. WHEN an admin uses any admin page THEN the system SHALL display data in responsive tables with sorting, filtering, and pagination controls.
4. WHEN an admin performs an action THEN the system SHALL display appropriate loading states and success/error notifications.
5. WHEN an admin session expires THEN the system SHALL redirect to login with a session expired message.

---

## Non-Functional Requirements

### Performance

- Admin API endpoints SHALL respond within 500ms for list operations (p95).
- Dashboard metrics SHALL be cached and refresh every 5 minutes.
- Pagination SHALL support up to 10,000 records efficiently.
- Search/filter operations SHALL use database indexes for sub-second response.

### Security

- Passwords SHALL be hashed using bcrypt with a minimum cost factor of 12.
- JWT tokens SHALL use RS256 or HS256 algorithm with secure secret management.
- Admin routes SHALL require valid JWT in Authorization header.
- Failed login attempts SHALL be rate-limited (5 attempts per 15 minutes per IP).
- Admin actions SHALL be logged for audit trail compliance.
- CORS SHALL restrict admin API to authorized origins only.

### Reliability

- Admin module SHALL not affect guest scan functionality if admin services fail.
- Database migrations SHALL be backwards-compatible with zero downtime.
- Audit logs SHALL be written asynchronously to prevent blocking admin operations.

### Usability

- Admin UI SHALL follow the existing ADAShield design system (TailwindCSS, shadcn/ui).
- Admin UI SHALL be accessible and WCAG 2.2 AA compliant (we build accessibility tools!).
- Table columns SHALL be sortable by clicking column headers.
- Filters SHALL be clearable with a single "Reset" action.
- Empty states SHALL provide helpful guidance for next actions.

---

## Out of Scope (Phase 1)

- Two-factor authentication (2FA) - Future enhancement
- Password recovery via email - Future enhancement
- Role hierarchy beyond ADMIN/USER - Future enhancement
- Real-time notifications/websockets - Future enhancement
- Multi-tenant/organization support - Future enhancement

---

## Technical Constraints

- Must integrate with existing Prisma schema and PostgreSQL database
- Must follow existing API patterns (Fastify, Zod validation, response wrappers)
- Must use existing frontend stack (Next.js, React Query, Zustand)
- Must not break existing guest session functionality
- JWT secret must be configurable via environment variables

---

## Dependencies

- Existing scan module (`apps/api/src/modules/scans/`)
- Existing session middleware (`apps/api/src/shared/middleware/session.ts`)
- Existing API client pattern (`apps/web/src/lib/api.ts`)
- PostgreSQL database with Prisma ORM
- Redis for token caching (optional, for invalidation)

---

*Document Version: 1.0*
*Created: December 2024*
*Status: Draft - Pending Approval*
