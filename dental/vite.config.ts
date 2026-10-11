import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// The version shown in the app: a release build may set DENTORA_VERSION (or VERSION_NAME, as the Android build
// does); otherwise package.json, read directly so `npx vite build` (no npm_package_version) gets it right too.
// The Windows and Android shells also report their own version at run time (src/platform appVersion()).
const pkgVersion = (() => { try { return JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).version as string } catch { return '' } })()
const appVersion = process.env.DENTORA_VERSION || process.env.VERSION_NAME || pkgVersion || process.env.npm_package_version || '1.0.0'

// Dentora — one build serves the browser, the Windows app (Electron) and the Android app (WebView).
// Relative asset paths keep it working from file:// and from the Android asset server alike.
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    // fonts stay separate files (relative URLs work from file:// and the Android asset server); only used faces load
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
} as any)
