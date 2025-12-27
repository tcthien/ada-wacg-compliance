# ADAShield - Project Structure

## Directory Organization

```
adashield/
├── .claude/                    # Claude Code configuration
│   ├── steering/               # Steering documents (this file's home)
│   ├── commands/               # Custom slash commands
│   ├── templates/              # Spec templates
│   └── agents/                 # Agent configurations
│
├── apps/                       # Application packages
│   ├── api/                    # Backend API (Fastify)
│   │   ├── src/
│   │   │   ├── config/         # Configuration (env, constants)
│   │   │   ├── modules/        # Feature modules
│   │   │   │   ├── auth/       # Authentication
│   │   │   │   ├── scans/      # Scanning functionality
│   │   │   │   ├── reports/    # Report generation
│   │   │   │   ├── users/      # User management
│   │   │   │   └── billing/    # Subscription & billing
│   │   │   ├── shared/         # Shared utilities
│   │   │   │   ├── database/   # Prisma client, migrations
│   │   │   │   ├── queue/      # BullMQ setup
│   │   │   │   ├── ai/         # AI provider abstraction
│   │   │   │   └── utils/      # Helper functions
│   │   │   └── index.ts        # App entry point
│   │   ├── tests/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── package.json
│   │
│   ├── web/                    # Frontend (Next.js)
│   │   ├── src/
│   │   │   ├── app/            # Next.js App Router
│   │   │   ├── components/     # React components
│   │   │   │   ├── ui/         # Base UI (shadcn)
│   │   │   │   ├── features/   # Feature-specific
│   │   │   │   └── layouts/    # Layout components
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── lib/            # Utilities, API client
│   │   │   ├── stores/         # Zustand stores
│   │   │   └── styles/         # Global styles
│   │   ├── public/
│   │   └── package.json
│   │
│   └── worker/                 # Background job workers
│       ├── src/
│       │   ├── jobs/           # Job handlers
│       │   │   ├── scan-page.ts
│       │   │   ├── generate-report.ts
│       │   │   ├── ai-analysis.ts
│       │   │   └── download-site.ts
│       │   ├── processors/     # Business logic
│       │   └── index.ts
│       └── package.json
│
├── packages/                   # Shared packages
│   ├── core/                   # Core business logic
│   │   ├── src/
│   │   │   ├── scanner/        # axe-core wrapper
│   │   │   ├── analyzer/       # AI analysis logic
│   │   │   ├── reporter/       # Report generation
│   │   │   └── types/          # Shared types
│   │   └── package.json
│   │
│   ├── config/                 # Shared configuration
│   │   ├── eslint/
│   │   ├── typescript/
│   │   └── package.json
│   │
│   └── ui/                     # Shared UI components (if needed)
│       └── package.json
│
├── docs/                       # Documentation
│   ├── analysis/               # Research & analysis
│   ├── blueprints/             # Technical designs
│   ├── requirements/           # Product requirements
│   └── api/                    # API documentation
│
├── scripts/                    # Build & utility scripts
│   ├── setup.sh
│   ├── deploy.sh
│   └── seed-data.ts
│
├── docker/                     # Docker configurations
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   ├── Dockerfile.worker
│   └── docker-compose.yml
│
├── .github/                    # GitHub configurations
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── deploy.yml
│   │   └── release.yml
│   └── PULL_REQUEST_TEMPLATE.md
│
├── package.json                # Root package.json (workspaces)
├── pnpm-workspace.yaml
├── turbo.json                  # Turborepo config (optional)
├── tsconfig.json               # Base TypeScript config
├── .env.example
├── .gitignore
├── README.md
└── CLAUDE.md
```

## Naming Conventions

### Files & Directories

| Type | Convention | Example |
|------|------------|---------|
| **Directories** | kebab-case | `user-management/`, `ai-analysis/` |
| **TypeScript files** | kebab-case.ts | `scan-page.ts`, `user-service.ts` |
| **React components** | PascalCase.tsx | `ScanButton.tsx`, `ReportCard.tsx` |
| **Test files** | *.test.ts, *.spec.ts | `scan-page.test.ts` |
| **Type definitions** | *.types.ts | `scan.types.ts` |
| **Constants** | *.constants.ts | `wcag.constants.ts` |
| **Hooks** | use*.ts | `useScanStatus.ts` |

### Code Conventions

| Type | Convention | Example |
|------|------------|---------|
| **Classes** | PascalCase | `ScannerService`, `ReportGenerator` |
| **Interfaces** | PascalCase (no I prefix) | `ScanResult`, `UserProfile` |
| **Types** | PascalCase | `ScanStatus`, `WcagLevel` |
| **Functions** | camelCase | `runScan()`, `generateReport()` |
| **Variables** | camelCase | `scanResult`, `pageUrl` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_PAGES`, `WCAG_LEVELS` |
| **Enums** | PascalCase (values UPPER_SNAKE_CASE) | `enum ScanStatus { PENDING, RUNNING }` |

### Database Conventions

| Type | Convention | Example |
|------|------------|---------|
| **Tables** | snake_case, plural | `users`, `scan_results` |
| **Columns** | snake_case | `created_at`, `user_id` |
| **Primary keys** | id | `id` (UUID) |
| **Foreign keys** | {table}_id | `user_id`, `scan_id` |
| **Indexes** | idx_{table}_{columns} | `idx_scans_user_id` |
| **Timestamps** | created_at, updated_at | Standard for all tables |

### API Conventions

| Type | Convention | Example |
|------|------------|---------|
| **Endpoints** | kebab-case, plural nouns | `/api/v1/scan-results` |
| **HTTP Methods** | RESTful | GET, POST, PUT, PATCH, DELETE |
| **Query params** | camelCase | `?pageSize=10&sortBy=createdAt` |
| **Request body** | camelCase | `{ "pageUrl": "...", "wcagLevel": "AA" }` |
| **Response** | camelCase, wrapped | `{ "data": {...}, "meta": {...} }` |

## Import Patterns

### Import Order

```typescript
// 1. Node.js built-in modules
import path from 'path';
import fs from 'fs/promises';

// 2. External dependencies (npm packages)
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

// 3. Internal packages (monorepo)
import { ScanResult } from '@adashield/core';
import { logger } from '@adashield/config';

// 4. Relative imports (same package)
import { validateUrl } from '../utils/validation';
import { ScanService } from './scan-service';

// 5. Type imports (if separate)
import type { ScanOptions } from './scan.types';
```

### Path Aliases

```json
// tsconfig.json paths
{
    "paths": {
        "@/*": ["./src/*"],
        "@adashield/core": ["../../packages/core/src"],
        "@adashield/config": ["../../packages/config/src"]
    }
}
```

## Code Structure Patterns

### Module Structure (Feature-Based)

```
modules/scans/
├── scan.controller.ts      # HTTP handlers (routes)
├── scan.service.ts         # Business logic
├── scan.repository.ts      # Database operations
├── scan.schema.ts          # Zod validation schemas
├── scan.types.ts           # TypeScript types
├── scan.constants.ts       # Module constants
├── scan.test.ts            # Unit tests
└── index.ts                # Public exports
```

### Service Class Pattern

```typescript
// scan.service.ts
import { Injectable } from '@fastify/awilix';
import type { ScanRepository } from './scan.repository';
import type { QueueService } from '@/shared/queue';

@Injectable()
export class ScanService {
    constructor(
        private readonly scanRepository: ScanRepository,
        private readonly queueService: QueueService,
    ) {}

    async createScan(input: CreateScanInput): Promise<Scan> {
        // 1. Validate input
        const validated = createScanSchema.parse(input);

        // 2. Create database record
        const scan = await this.scanRepository.create(validated);

        // 3. Queue background job
        await this.queueService.add('scan-page', { scanId: scan.id });

        // 4. Return result
        return scan;
    }
}
```

### React Component Pattern

```typescript
// ScanButton.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useScanMutation } from '@/hooks/use-scan';
import type { ScanButtonProps } from './scan-button.types';

export function ScanButton({ url, onComplete }: ScanButtonProps) {
    const [isScanning, setIsScanning] = useState(false);
    const scanMutation = useScanMutation();

    const handleScan = async () => {
        setIsScanning(true);
        try {
            const result = await scanMutation.mutateAsync({ url });
            onComplete?.(result);
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <Button
            onClick={handleScan}
            disabled={isScanning}
            loading={isScanning}
        >
            {isScanning ? 'Scanning...' : 'Start Scan'}
        </Button>
    );
}
```

## Code Style Rules

### Formatting (Prettier)

```json
{
    "semi": true,
    "singleQuote": true,
    "tabWidth": 4,
    "useTabs": false,
    "trailingComma": "all",
    "printWidth": 140,
    "bracketSpacing": true,
    "arrowParens": "always",
    "endOfLine": "lf"
}
```

### TypeScript (tsconfig)

```json
{
    "compilerOptions": {
        "strict": true,
        "noImplicitAny": true,
        "strictNullChecks": true,
        "noUncheckedIndexedAccess": true,
        "noImplicitReturns": true,
        "noFallthroughCasesInSwitch": true,
        "forceConsistentCasingInFileNames": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext"
    }
}
```

### ESLint Rules

```javascript
// Key rules enforced
{
    rules: {
        // TypeScript
        '@typescript-eslint/explicit-function-return-type': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unused-vars': 'error',

        // Import organization
        'import/order': ['error', {
            'groups': ['builtin', 'external', 'internal', 'parent', 'sibling'],
            'newlines-between': 'always',
            'alphabetize': { 'order': 'asc' }
        }],

        // Code quality
        'no-console': ['error', { allow: ['warn', 'error'] }],
        'prefer-const': 'error',
        'no-var': 'error',
    }
}
```

## Code Size Guidelines

| Metric | Limit | Rationale |
|--------|-------|-----------|
| **File size** | 500 lines max | Maintainability |
| **Function size** | 50 lines max | Single responsibility |
| **Line length** | 140 characters | Readability |
| **Nesting depth** | 4 levels max | Complexity control |
| **Function parameters** | 5 max | Use options object for more |
| **Cyclomatic complexity** | 10 max | Testability |

## Module Boundaries

### Dependency Rules

```
apps/api     → packages/core, packages/config
apps/web     → packages/core (types only), packages/ui
apps/worker  → packages/core, packages/config

packages/core   → No app dependencies (pure library)
packages/config → No app dependencies (shared config)
packages/ui     → No app dependencies (shared components)
```

### Feature Module Independence

Each feature module should be self-contained:
- Own routes, services, repositories
- Own types and validation schemas
- Minimal cross-module dependencies
- Communicate via events when possible

## Error Handling Pattern

```typescript
// Custom error classes
export class AppError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly statusCode: number = 500,
        public readonly details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'VALIDATION_ERROR', 400, details);
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string, id: string) {
        super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
    }
}

// Usage
throw new NotFoundError('Scan', scanId);
throw new ValidationError('Invalid URL format', { url });
```

## Logging Pattern

```typescript
import { logger } from '@adashield/config';

// Structured logging
logger.info('Scan started', {
    scanId: scan.id,
    url: scan.url,
    userId: user.id,
});

logger.error('Scan failed', {
    scanId: scan.id,
    error: error.message,
    stack: error.stack,
});
```

## Testing Patterns

### Unit Test Structure

```typescript
// scan-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScanService } from './scan.service';

describe('ScanService', () => {
    let service: ScanService;
    let mockRepository: MockScanRepository;

    beforeEach(() => {
        mockRepository = createMockRepository();
        service = new ScanService(mockRepository);
    });

    describe('createScan', () => {
        it('should create a scan and queue job', async () => {
            // Arrange
            const input = { url: 'https://example.com' };

            // Act
            const result = await service.createScan(input);

            // Assert
            expect(result.id).toBeDefined();
            expect(mockRepository.create).toHaveBeenCalledWith(input);
        });

        it('should throw ValidationError for invalid URL', async () => {
            // Arrange
            const input = { url: 'not-a-url' };

            // Act & Assert
            await expect(service.createScan(input)).rejects.toThrow(ValidationError);
        });
    });
});
```

## Documentation Standards

### Code Comments

```typescript
/**
 * Runs accessibility scan on a webpage using axe-core.
 *
 * @param url - The URL to scan
 * @param options - Scan configuration options
 * @returns Scan results with violations and passes
 *
 * @example
 * const results = await runScan('https://example.com', {
 *     wcagLevel: 'AA',
 *     timeout: 30000,
 * });
 */
export async function runScan(url: string, options: ScanOptions): Promise<ScanResult> {
    // Implementation
}
```

### README in Major Modules

Each major module should have a README.md explaining:
- Purpose and responsibilities
- Key files and their roles
- How to extend/modify
- Example usage

---

*Last Updated: December 2024*
*Version: 1.0*
