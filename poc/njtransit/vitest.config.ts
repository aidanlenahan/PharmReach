import { defineConfig } from 'vitest/config';

// Offline, deterministic tests only. Live API tests use vitest.live.config.ts.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/live/**', 'node_modules/**'],
  },
});
