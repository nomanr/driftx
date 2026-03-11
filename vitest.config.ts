import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
      exclude: ['test/**', 'src/types.ts', 'src/bin.ts'],
    },
    include: ['test/unit/**/*.test.ts', 'test/integration/**/*.test.ts'],
  },
});
