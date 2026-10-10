import { defineConfig } from 'vitest/config';

// Live tests hit the real NJ Transit servers. Public/no-credential tests always run; the
// credentialed ones skip unless NJT_USERNAME is set (setup.ts loads poc/njtransit/.env).
export default defineConfig({
  test: {
    include: ['test/live/**/*.test.ts'],
    setupFiles: ['test/live/setup.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // One file at a time so the credentialed tests share one cached token per API.
    fileParallelism: false,
  },
});
