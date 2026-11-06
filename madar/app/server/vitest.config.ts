// Keeps vitest inside this package (the repository root has an unrelated vite.config.ts).
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
})
