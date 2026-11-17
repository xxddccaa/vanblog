import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Match the Umi build, which compiles JSX with the automatic runtime.
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    restoreMocks: true,
    setupFiles: ['./tests/setupTests.ts'],
  },
});
