import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Ensure DOM is cleaned up between tests to avoid duplicate renders
afterEach(() => {
  cleanup();
});
