import { defineConfig } from 'vitest/config';

/**
 * Acceptance suite against a real Supabase (local: `npm run db:reset` first).
 * Reads credentials from apps/api/.env.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.int.test.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
