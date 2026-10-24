import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  // old phone WebViews (Chrome 61+) run the module too: newer syntax is lowered
  build: { outDir: 'dist', emptyOutDir: true, target: ['es2017', 'chrome61', 'safari11'] },
  test: { globals: true, environment: 'node' },
})
