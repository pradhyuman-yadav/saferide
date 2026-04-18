import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@saferide/logger':        path.resolve(__dirname, '../logger/src/index.ts'),
      '@saferide/firebase-admin': path.resolve(__dirname, '../firebase-admin/src/index.ts'),
      '@saferide/types':         path.resolve(__dirname, '../types/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/config.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
