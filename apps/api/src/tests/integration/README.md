# Integration Tests

## Overview

These integration tests verify the API endpoints with mocked dependencies.

## Running Tests

```bash
# Run all integration tests
pnpm test:integration

# Run with coverage
pnpm test:coverage
```

## Test Database Setup

For full integration tests with a real database:

```bash
# Create test database
createdb adashield_test

# Run migrations
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/adashield_test pnpm prisma:migrate

# Run tests
pnpm test:integration
```

## Test Structure

- `setup.ts` - Test utilities and database helpers
- `scans.test.ts` - Scan API endpoints
- `sessions.test.ts` - Session management endpoints

## Mocking Strategy

- **Redis**: Fully mocked for rate limiting and caching
- **Database**: Can use real Prisma client with test database or mocks
- **Queue**: Mocked to avoid running real scan jobs
- **reCAPTCHA**: Mocked to skip verification in tests
