import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    globalSetup: ['test/globalSetup.ts'],
    // API tests share one database, so run files one at a time.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/**/*.test.ts'],
      reporter: ['text', 'json-summary', 'html'],
      // TST-1: at least 80% line coverage on the back end.
      thresholds: { lines: 80 },
    },
  },
});
