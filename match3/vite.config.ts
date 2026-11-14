import { defineConfig } from 'vitest/config';

// The game is served from a relative base so the same build works from a dev server,
// from `vite preview`, and from inside the Android WebView (https://appassets.androidplatform.net/assets/www/).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome80',
    cssTarget: 'chrome80',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
