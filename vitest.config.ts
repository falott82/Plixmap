import { defineConfig } from 'vitest/config';

// Unit tests for pure frontend helpers (no DOM needed → node environment, fast).
// Server tests stay on `node --test` (npm run test); these run via `npm run test:unit`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    clearMocks: true
  }
});
