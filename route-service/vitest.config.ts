import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@saferide/firebase-admin': path.resolve(__dirname, '../packages/firebase-admin/src/index.ts'),
      '@saferide/logger':        path.resolve(__dirname, '../packages/logger/src/index.ts'),
      '@saferide/types':         path.resolve(__dirname, '../packages/types/src/index.ts'),
      '@saferide/middleware':    path.resolve(__dirname, '../packages/middleware/src/index.ts'),
    },
  },
  test: {
    globals:    true,
    environment: 'node',
    setupFiles:  ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/config.ts'],
      thresholds: {
        lines:      80,
        functions:  80,
        branches:   70,
        statements: 80,
      },
    },
  },
});
