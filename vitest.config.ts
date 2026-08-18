import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {alias: {'@': import.meta.dirname}},
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
