import { z } from 'zod';

/**
 * Zod schema for admin role values
 * Matches the AdminRole enum from Prisma schema
 */
export const AdminRoleSchema = z.enum(['ADMIN', 'SUPER_ADMIN'], {
  errorMap: () => ({ message: 'Role must be ADMIN or SUPER_ADMIN' }),
});

/**
 * Password validation schema with NFR-Security complexity requirements
 *
 * Requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 *
 * @example
 * ```ts
 * passwordSchema.parse('MyP@ssw0rd123'); // Valid
 * passwordSchema.parse('weak'); // Throws validation error
 * ```
 */
export const passwordSchema = z
  .string({
    required_error: 'Password is required',
    invalid_type_error: 'Password must be a string',
  })
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[^A-Za-z0-9]/,
    'Password must contain at least one special character',
  );

/**
 * Schema for admin login request
 *
 * Validates:
 * - Email format and normalization (lowercase, trimmed)
 * - Password presence (complexity not validated on login)
 *
 * @example
 * ```ts
 * const credentials = {
 *   email: 'admin@example.com',
 *   password: 'MyP@ssw0rd123'
 * };
 * loginSchema.parse(credentials);
 * ```
 */
export const loginSchema = z.object({
  /**
   * Admin email address
   * Normalized to lowercase and trimmed
   */
  email: z
    .string({
      required_error: 'Email is required',
      invalid_type_error: 'Email must be a string',
    })
    .transform((email) => {
      // Normalize email by trimming and lowercasing
      return email.trim().toLowerCase();
    })
    .pipe(z.string().email('Invalid email format')),

  /**
   * Admin password
   * Validated for presence only (not complexity) on login
   */
  password: z.string({
    required_error: 'Password is required',
    invalid_type_error: 'Password must be a string',
  }).min(1, 'Password is required'),
});

/**
 * Schema for creating a new admin user
 *
 * Validates:
 * - Email format and normalization
 * - Password complexity (NFR-Security requirements)
 * - Admin role (defaults to ADMIN)
 *
 * @example
 * ```ts
 * const newAdmin = {
 *   email: 'admin@example.com',
 *   password: 'MyP@ssw0rd123',
 *   role: 'ADMIN'
 * };
 * createAdminSchema.parse(newAdmin);
 * ```
 */
export const createAdminSchema = z.object({
  /**
   * Admin email address
   * Must be unique in the system
   * Normalized to lowercase and trimmed
   */
  email: z
    .string({
      required_error: 'Email is required',
      invalid_type_error: 'Email must be a string',
    })
    .transform((email) => {
      // Normalize email by trimming and lowercasing
      return email.trim().toLowerCase();
    })
    .pipe(z.string().email('Invalid email format')),

  /**
   * Admin password
   * Must meet NFR-Security complexity requirements
   * Will be hashed with bcrypt (cost factor 12) before storage
   */
  password: passwordSchema,

  /**
   * Admin role assignment
   * Defaults to ADMIN if not specified
   * SUPER_ADMIN can only be created by existing SUPER_ADMIN
   */
  role: AdminRoleSchema.default('ADMIN'),
});

/**
 * Schema for updating an existing admin user
 *
 * All fields are optional for partial updates
 * Password changes use separate changePasswordSchema
 *
 * @example
 * ```ts
 * const updates = {
 *   role: 'SUPER_ADMIN',
 *   isActive: false
 * };
 * updateAdminSchema.parse(updates);
 * ```
 */
export const updateAdminSchema = z.object({
  /**
   * Update admin email address
   * Optional - normalized to lowercase and trimmed
   */
  email: z
    .string()
    .transform((email) => {
      // Normalize email by trimming and lowercasing
      return email.trim().toLowerCase();
    })
    .pipe(z.string().email('Invalid email format'))
    .optional(),

  /**
   * Update admin role
   * Optional - requires SUPER_ADMIN permission to change
   */
  role: AdminRoleSchema.optional(),

  /**
   * Update admin active status
   * Optional - used for deactivating admins without deletion
   */
  isActive: z.boolean({
    invalid_type_error: 'isActive must be a boolean',
  }).optional(),
});

/**
 * Schema for changing an admin's password
 *
 * Requires current password for verification
 * New password must meet NFR-Security complexity requirements
 *
 * @example
 * ```ts
 * const passwordChange = {
 *   currentPassword: 'OldP@ssw0rd123',
 *   newPassword: 'NewP@ssw0rd456'
 * };
 * changePasswordSchema.parse(passwordChange);
 * ```
 */
export const changePasswordSchema = z.object({
  /**
   * Current password for verification
   * Validated for presence only (complexity not checked)
   */
  currentPassword: z.string({
    required_error: 'Current password is required',
    invalid_type_error: 'Current password must be a string',
  }).min(1, 'Current password is required'),

  /**
   * New password
   * Must meet NFR-Security complexity requirements
   * Will be hashed with bcrypt (cost factor 12) before storage
   */
  newPassword: passwordSchema,
});

/**
 * Schema for validating admin ID route parameters
 *
 * Ensures the admin ID is a valid UUID format
 * Used in route parameter validation for admin management endpoints
 *
 * @example
 * ```ts
 * const params = { id: '550e8400-e29b-41d4-a716-446655440000' };
 * adminIdParamSchema.parse(params);
 * ```
 */
export const adminIdParamSchema = z.object({
  /**
   * Admin user ID from route parameter
   * Must be a valid UUID v4 format
   */
  id: z.string().uuid('Invalid admin ID format'),
});

/**
 * Schema for pagination query parameters
 *
 * Used for list endpoints (e.g., GET /admin/users)
 * Provides reasonable defaults and limits
 *
 * @example
 * ```ts
 * const query = { page: '2', limit: '50' };
 * paginationSchema.parse(query); // { page: 2, limit: 50 }
 * ```
 */
export const paginationSchema = z.object({
  /**
   * Page number (1-indexed)
   * Defaults to 1 if not provided
   * Coerced from string to number for URL query params
   */
  page: z.coerce
    .number({
      invalid_type_error: 'Page must be a number',
    })
    .int('Page must be an integer')
    .positive('Page must be positive')
    .default(1),

  /**
   * Number of items per page
   * Defaults to 20 if not provided
   * Maximum of 100 to prevent excessive data transfer
   * Coerced from string to number for URL query params
   */
  limit: z.coerce
    .number({
      invalid_type_error: 'Limit must be a number',
    })
    .int('Limit must be an integer')
    .positive('Limit must be positive')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
});

/**
 * Schema for scan status enum values
 * Matches the ScanStatus enum from Prisma schema
 */
export const ScanStatusSchema = z.enum(
  ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'],
  {
    errorMap: () => ({
      message: 'Status must be PENDING, RUNNING, COMPLETED, or FAILED',
    }),
  }
);

/**
 * Schema for scan list query parameters
 *
 * Used for filtering and paginating scans in the admin panel
 * All filters are optional and can be combined
 *
 * @example
 * ```ts
 * const query = {
 *   status: 'COMPLETED',
 *   startDate: '2025-01-01',
 *   endDate: '2025-12-31',
 *   email: 'user@example.com',
 *   url: 'example.com',
 *   page: '1',
 *   limit: '20'
 * };
 * scanListQuerySchema.parse(query);
 * ```
 */
export const scanListQuerySchema = z.object({
  /**
   * Filter by scan status
   * Optional - defaults to showing all statuses
   */
  status: ScanStatusSchema.optional(),

  /**
   * Filter by date range - start date (inclusive)
   * Optional - coerced from ISO date string to Date object
   */
  startDate: z.coerce.date({
    invalid_type_error: 'Start date must be a valid date',
  }).optional(),

  /**
   * Filter by date range - end date (inclusive)
   * Optional - coerced from ISO date string to Date object
   */
  endDate: z.coerce.date({
    invalid_type_error: 'End date must be a valid date',
  }).optional(),

  /**
   * Filter by customer email (case-insensitive partial match)
   * Optional - searches within email field
   */
  email: z.string({
    invalid_type_error: 'Email must be a string',
  }).optional(),

  /**
   * Filter by URL (case-insensitive partial match)
   * Optional - searches within URL field
   */
  url: z.string({
    invalid_type_error: 'URL must be a string',
  }).optional(),

  /**
   * Page number (1-indexed)
   * Defaults to 1 if not provided
   */
  page: z.coerce
    .number({
      invalid_type_error: 'Page must be a number',
    })
    .int('Page must be an integer')
    .positive('Page must be positive')
    .default(1),

  /**
   * Number of items per page
   * Defaults to 20 if not provided
   * Maximum of 100 to prevent excessive data transfer
   */
  limit: z.coerce
    .number({
      invalid_type_error: 'Limit must be a number',
    })
    .int('Limit must be an integer')
    .positive('Limit must be positive')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
});

/**
 * Schema for validating scan ID route parameters
 *
 * Ensures the scan ID is a valid UUID format
 * Used in route parameter validation for scan management endpoints
 *
 * @example
 * ```ts
 * const params = { id: '550e8400-e29b-41d4-a716-446655440000' };
 * scanIdParamSchema.parse(params);
 * ```
 */
export const scanIdParamSchema = z.object({
  /**
   * Scan ID from route parameter
   * Must be a valid UUID v4 format
   */
  id: z.string().uuid('Invalid scan ID format'),
});

/**
 * Schema for delete scan query parameters
 *
 * Controls whether to perform soft delete or hard delete
 *
 * @example
 * ```ts
 * const query = { soft: 'true' };
 * deleteScanQuerySchema.parse(query); // { soft: true }
 * ```
 */
export const deleteScanQuerySchema = z.object({
  /**
   * Use soft delete (set deletedAt) instead of hard delete
   * Optional - defaults to false (hard delete)
   * Coerced from string to boolean for URL query params
   */
  soft: z.coerce
    .boolean({
      invalid_type_error: 'Soft must be a boolean',
    })
    .default(false),
});

/**
 * Schema for customer list query parameters
 *
 * Used for filtering and paginating customers in the admin panel
 * All filters are optional and can be combined
 *
 * @example
 * ```ts
 * const query = {
 *   minScans: '5',
 *   maxScans: '100',
 *   startDate: '2025-01-01',
 *   endDate: '2025-12-31',
 *   search: 'example.com',
 *   page: '1',
 *   limit: '20'
 * };
 * customerListQuerySchema.parse(query);
 * ```
 */
export const customerListQuerySchema = z.object({
  /**
   * Filter by minimum number of scans
   * Optional - must be positive integer
   */
  minScans: z.coerce
    .number({
      invalid_type_error: 'Min scans must be a number',
    })
    .int('Min scans must be an integer')
    .positive('Min scans must be positive')
    .optional(),

  /**
   * Filter by maximum number of scans
   * Optional - must be positive integer
   */
  maxScans: z.coerce
    .number({
      invalid_type_error: 'Max scans must be a number',
    })
    .int('Max scans must be an integer')
    .positive('Max scans must be positive')
    .optional(),

  /**
   * Filter by date range - start date (inclusive)
   * Optional - coerced from ISO date string to Date object
   */
  startDate: z.coerce.date({
    invalid_type_error: 'Start date must be a valid date',
  }).optional(),

  /**
   * Filter by date range - end date (inclusive)
   * Optional - coerced from ISO date string to Date object
   */
  endDate: z.coerce.date({
    invalid_type_error: 'End date must be a valid date',
  }).optional(),

  /**
   * Search query for email partial matching (case-insensitive)
   * Optional - searches within email field
   */
  search: z.string({
    invalid_type_error: 'Search must be a string',
  }).optional(),

  /**
   * Page number (1-indexed)
   * Defaults to 1 if not provided
   */
  page: z.coerce
    .number({
      invalid_type_error: 'Page must be a number',
    })
    .int('Page must be an integer')
    .positive('Page must be positive')
    .default(1),

  /**
   * Number of items per page
   * Defaults to 20 if not provided
   * Maximum of 100 to prevent excessive data transfer
   */
  limit: z.coerce
    .number({
      invalid_type_error: 'Limit must be a number',
    })
    .int('Limit must be an integer')
    .positive('Limit must be positive')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
});

/**
 * Schema for validating customer email route parameters
 *
 * Ensures the email parameter is a non-empty string
 * Used in route parameter validation for customer-specific endpoints
 *
 * @example
 * ```ts
 * const params = { email: 'user@example.com' };
 * customerEmailParamSchema.parse(params);
 * ```
 */
export const customerEmailParamSchema = z.object({
  /**
   * Customer email from route parameter
   * Must be a non-empty string
   */
  email: z.string({
    required_error: 'Email is required',
    invalid_type_error: 'Email must be a string',
  }).min(1, 'Email cannot be empty'),
});

/**
 * Schema for customer export query parameters
 *
 * Controls the export format (CSV or JSON)
 *
 * @example
 * ```ts
 * const query = { format: 'csv' };
 * customerExportQuerySchema.parse(query); // { format: 'csv' }
 * ```
 */
export const customerExportQuerySchema = z.object({
  /**
   * Export format: 'csv' or 'json'
   * Defaults to 'csv' if not provided
   */
  format: z.enum(['csv', 'json'], {
    errorMap: () => ({ message: 'Format must be csv or json' }),
  }).default('csv'),

  /**
   * Filter by minimum number of scans (optional)
   */
  minScans: z.coerce
    .number({
      invalid_type_error: 'Min scans must be a number',
    })
    .int('Min scans must be an integer')
    .positive('Min scans must be positive')
    .optional(),

  /**
   * Filter by maximum number of scans (optional)
   */
  maxScans: z.coerce
    .number({
      invalid_type_error: 'Max scans must be a number',
    })
    .int('Max scans must be an integer')
    .positive('Max scans must be positive')
    .optional(),

  /**
   * Filter by date range - start date (inclusive)
   */
  startDate: z.coerce.date({
    invalid_type_error: 'Start date must be a valid date',
  }).optional(),

  /**
   * Filter by date range - end date (inclusive)
   */
  endDate: z.coerce.date({
    invalid_type_error: 'End date must be a valid date',
  }).optional(),
});

/**
 * Schema for dashboard trends query parameters
 *
 * Validates the 'days' query parameter for the trends endpoint.
 *
 * @example
 * ```ts
 * dashboardTrendsQuerySchema.parse({ days: 30 });
 * ```
 */
export const dashboardTrendsQuerySchema = z.object({
  /**
   * Number of days to retrieve trend data for
   * Default: 30 days
   * Range: 1-365 days
   */
  days: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 30))
    .pipe(
      z
        .number()
        .int('Days must be an integer')
        .min(1, 'Days must be at least 1')
        .max(365, 'Days cannot exceed 365'),
    ),
});

/**
 * Schema for dashboard top domains query parameters
 *
 * Validates the 'limit' query parameter for the top domains endpoint.
 *
 * @example
 * ```ts
 * dashboardDomainsQuerySchema.parse({ limit: 10 });
 * ```
 */
export const dashboardDomainsQuerySchema = z.object({
  /**
   * Maximum number of top domains to return
   * Default: 10
   * Range: 1-100
   */
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(
      z
        .number()
        .int('Limit must be an integer')
        .min(1, 'Limit must be at least 1')
        .max(100, 'Limit cannot exceed 100'),
    ),
});

/**
 * Schema for audit action enum values
 * Matches the AuditAction type from admin.types.ts
 */
export const AuditActionSchema = z.enum([
  'LOGIN',
  'LOGOUT',
  'CREATE_ADMIN',
  'UPDATE_ADMIN',
  'DEACTIVATE_ADMIN',
  'RESET_PASSWORD',
  'CHANGE_PASSWORD',
  'DELETE_SCAN',
  'RETRY_SCAN',
  'EXPORT_DATA',
], {
  errorMap: () => ({ message: 'Invalid audit action type' }),
});

/**
 * Schema for audit log query parameters
 *
 * Used for filtering and paginating audit logs in the admin panel
 * All filters are optional and can be combined
 *
 * @example
 * ```ts
 * const query = {
 *   dateFrom: '2025-01-01',
 *   dateTo: '2025-12-31',
 *   adminId: 'admin-uuid',
 *   action: 'UPDATE_ADMIN',
 *   page: '1',
 *   limit: '20'
 * };
 * auditListQuerySchema.parse(query);
 * ```
 */
export const auditListQuerySchema = z.object({
  /**
   * Filter by date range - start date (inclusive)
   * Optional - coerced from ISO date string to Date object
   */
  dateFrom: z.coerce.date({
    invalid_type_error: 'Start date must be a valid date',
  }).optional(),

  /**
   * Filter by date range - end date (inclusive)
   * Optional - coerced from ISO date string to Date object
   */
  dateTo: z.coerce.date({
    invalid_type_error: 'End date must be a valid date',
  }).optional(),

  /**
   * Filter by specific admin user
   * Optional - must be a valid UUID
   */
  adminId: z.string().uuid('Invalid admin ID format').optional(),

  /**
   * Filter by specific audit action type
   * Optional - must be a valid AuditAction enum value
   */
  action: AuditActionSchema.optional(),

  /**
   * Page number (1-indexed)
   * Defaults to 1 if not provided
   */
  page: z.coerce
    .number({
      invalid_type_error: 'Page must be a number',
    })
    .int('Page must be an integer')
    .positive('Page must be positive')
    .default(1),

  /**
   * Number of items per page
   * Defaults to 20 if not provided
   * Maximum of 100 to prevent excessive data transfer
   */
  limit: z.coerce
    .number({
      invalid_type_error: 'Limit must be a number',
    })
    .int('Limit must be an integer')
    .positive('Limit must be positive')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
});

/**
 * Schema for audit log export query parameters
 *
 * Controls the export format and optional filters
 *
 * @example
 * ```ts
 * const query = {
 *   format: 'csv',
 *   dateFrom: '2025-01-01',
 *   dateTo: '2025-12-31'
 * };
 * auditExportQuerySchema.parse(query);
 * ```
 */
export const auditExportQuerySchema = z.object({
  /**
   * Export format: 'csv' or 'json'
   * Defaults to 'csv' if not provided
   */
  format: z.enum(['csv', 'json'], {
    errorMap: () => ({ message: 'Format must be csv or json' }),
  }).default('csv'),

  /**
   * Filter by date range - start date (inclusive)
   * Optional
   */
  dateFrom: z.coerce.date({
    invalid_type_error: 'Start date must be a valid date',
  }).optional(),

  /**
   * Filter by date range - end date (inclusive)
   * Optional
   */
  dateTo: z.coerce.date({
    invalid_type_error: 'End date must be a valid date',
  }).optional(),

  /**
   * Filter by specific admin user
   * Optional - must be a valid UUID
   */
  adminId: z.string().uuid('Invalid admin ID format').optional(),

  /**
   * Filter by specific audit action type
   * Optional
   */
  action: AuditActionSchema.optional(),
});

// Type exports for TypeScript inference
export type AdminRole = z.infer<typeof AdminRoleSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type CreateAdminRequest = z.infer<typeof createAdminSchema>;
export type UpdateAdminRequest = z.infer<typeof updateAdminSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type AdminIdParam = z.infer<typeof adminIdParamSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type ScanListQuery = z.infer<typeof scanListQuerySchema>;
export type ScanIdParam = z.infer<typeof scanIdParamSchema>;
export type DeleteScanQuery = z.infer<typeof deleteScanQuerySchema>;
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
export type CustomerEmailParam = z.infer<typeof customerEmailParamSchema>;
export type CustomerExportQuery = z.infer<typeof customerExportQuerySchema>;
export type DashboardTrendsQuery = z.infer<typeof dashboardTrendsQuerySchema>;
export type DashboardDomainsQuery = z.infer<typeof dashboardDomainsQuerySchema>;
export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
export type AuditExportQuery = z.infer<typeof auditExportQuerySchema>;
