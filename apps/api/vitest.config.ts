import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.turbo'],
    env: loadEnv('test', process.cwd(), ''),
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.config.{ts,js}',
        '**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/tests/**',
      ],
    },
  },
});
