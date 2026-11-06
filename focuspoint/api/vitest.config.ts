import { defineConfig } from 'vitest/config'

// Unit tests cover the pure modules (no Workers runtime needed): plain Node environment.
export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})
