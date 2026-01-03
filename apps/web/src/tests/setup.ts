/**
 * Test setup file for Vitest
 * Configures global test environment
 */

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// Make React globally available for components that don't import it explicitly
// This is needed for Next.js 14 components with automatic JSX runtime
(global as any).React = React;

// Cleanup after each test case
afterEach(() => {
  cleanup();
});
