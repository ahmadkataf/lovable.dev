// The Worker's unit tests (test/*.test.ts) run in Node: Web Crypto, Request/Response and node:sqlite (test/d1.ts)
// stand in for the Workers runtime. Without this file vitest would pick up the app's ../vite.config.ts.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { root: '.', include: ['test/**/*.test.ts'], environment: 'node' },
})
