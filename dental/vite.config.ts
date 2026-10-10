import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Dentora — one build serves the browser, the Windows app (Electron) and the Android app (WebView).
// Relative asset paths keep it working from file:// and from the Android asset server alike.
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0') },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    // fonts travel inside the stylesheet so the offline apps never miss them
    assetsInlineLimit: (file: string) => (file.endsWith('.woff2') ? true : undefined),
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
} as any)
