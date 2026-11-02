import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * DB-gated tests (`src/test/db`): real Postgres with every migration applied.
 * They skip unless DATABASE_URL points at a local server (see db-test-utils.ts).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/test/db/**/*.db.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
