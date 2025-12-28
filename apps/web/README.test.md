# Testing Guide

## Running Tests

### Unit Tests

Run all unit tests:
```bash
pnpm test
```

Watch mode (re-run on changes):
```bash
pnpm test:watch
```

With coverage:
```bash
pnpm test:coverage
```

With UI:
```bash
pnpm test:ui
```

### E2E Tests

Run E2E tests with Playwright:
```bash
pnpm test:e2e
```

## Test Files

- `src/**/*.test.ts` - Unit tests
- `src/**/*.test.tsx` - Component tests
- `e2e/**/*.spec.ts` - E2E tests

## Known Issues

### Memory Issues with Polling Tests

The `useScanEvents.test.ts` file tests a hook that uses polling with timers. If you encounter memory errors:

1. Run with increased memory:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" pnpm test
   ```

2. Run specific test files instead of all tests
3. Consider running tests in smaller batches

### Note on Test Setup

- Tests use Vitest with jsdom environment
- React Testing Library for component testing
- Fake timers are used for polling tests
