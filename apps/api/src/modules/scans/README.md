# Scan Module

This module provides Zod schemas and TypeScript types for scan API validation.

## Files

- `scan.schema.ts` - Zod validation schemas
- `scan.types.ts` - TypeScript type definitions and type guards
- `index.ts` - Module exports
- `scan.schema.test.ts` - Schema validation tests
- `scan.types.test.ts` - Type guard tests

## Usage

### Importing Schemas

```typescript
import {
  CreateScanRequestSchema,
  ScanResponseSchema,
  ScanStatusResponseSchema,
  ScanIdParamSchema,
} from '@/modules/scans/index.js';
```

### Importing Types

```typescript
import type {
  CreateScanRequest,
  ScanResponse,
  ScanStatusResponse,
  ScanIdParam,
} from '@/modules/scans/index.js';
```

### Using with Fastify Routes

```typescript
import { FastifyPluginAsync } from 'fastify';
import { CreateScanRequestSchema, ScanResponseSchema } from '@/modules/scans/index.js';

const scansRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/scans', {
    schema: {
      body: CreateScanRequestSchema,
      response: {
        201: ScanResponseSchema,
      },
    },
    handler: async (request, reply) => {
      // Request body is automatically validated and typed
      const { url, email, wcagLevel, recaptchaToken } = request.body;

      // Create scan...
      const scan = await scanService.create({
        url,
        email,
        wcagLevel,
        recaptchaToken,
      });

      reply.code(201).send(scan);
    },
  });
};
```

### Manual Validation

```typescript
import { CreateScanRequestSchema } from '@/modules/scans/index.js';

// Parse and validate
const result = CreateScanRequestSchema.parse({
  url: 'https://example.com',
  email: 'user@example.com',
  wcagLevel: 'AA',
  recaptchaToken: 'token123',
});

// Safe parse (returns { success: boolean, data?, error? })
const safeResult = CreateScanRequestSchema.safeParse(input);
if (safeResult.success) {
  console.log(safeResult.data);
} else {
  console.error(safeResult.error);
}
```

### Using Type Guards

```typescript
import { isWcagLevel, isScanStatus } from '@/modules/scans/index.js';

const level = getUserInput();
if (isWcagLevel(level)) {
  // TypeScript knows level is 'A' | 'AA' | 'AAA'
  console.log(`Valid WCAG level: ${level}`);
}

const status = getDatabaseValue();
if (isScanStatus(status)) {
  // TypeScript knows status is ScanStatus
  console.log(`Valid status: ${status}`);
}
```

## Schemas

### CreateScanRequestSchema

Validates scan creation requests with:
- URL validation (HTTP/HTTPS only)
- Email validation (optional, normalized)
- WCAG level validation (defaults to AA)
- reCAPTCHA token validation

```typescript
{
  url: string;              // Required, HTTP/HTTPS only
  email?: string;           // Optional, normalized
  wcagLevel?: 'A' | 'AA' | 'AAA';  // Optional, defaults to 'AA'
  recaptchaToken: string;   // Required
}
```

### ScanResponseSchema

Validates complete scan entity responses:

```typescript
{
  id: string;
  guestSessionId: string | null;
  userId: string | null;
  url: string;
  email: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  wcagLevel: 'A' | 'AA' | 'AAA';
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}
```

### ScanStatusResponseSchema

Validates lightweight status check responses:

```typescript
{
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress?: number;        // 0-100, optional
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
  resultsUrl?: string;      // Optional, for completed scans
}
```

### ScanIdParamSchema

Validates scan ID route parameters:

```typescript
{
  id: string;  // Must match: /^scan_[a-zA-Z0-9]+$/
}
```

## Type Guards

- `isWcagLevel(value: unknown): value is WcagLevel`
- `isScanStatus(value: unknown): value is ScanStatus`
- `isIssueImpact(value: unknown): value is IssueImpact`

## Normalization

The schemas automatically normalize input data:

- **URLs**: Trimmed of whitespace
- **Emails**: Trimmed and lowercased

## Testing

Run tests with:

```bash
pnpm test src/modules/scans
```

All schemas have comprehensive test coverage including:
- Valid input validation
- Invalid input rejection
- Data normalization
- Type guard functionality
