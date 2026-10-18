import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// The version shown in the app: a release build may set DENTORA_VERSION (or VERSION_NAME, as the Android build
// does); otherwise package.json, read directly so `npx vite build` (no npm_package_version) gets it right too.
// The Windows and Android shells also report their own version at run time (src/platform appVersion()).
const pkgVersion = (() => { try { return JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).version as string } catch { return '' } })()
const appVersion = process.env.DENTORA_VERSION || process.env.VERSION_NAME || pkgVersion || process.env.npm_package_version || '1.0.0'

/**
 * index.html carries the app's Content-Security-Policy (scripts only from the app itself). The development server
 * needs inline scripts (React Fast Refresh), so `npm run dev` serves the page without it; every build keeps it.
 */
const devWithoutCsp = {
  name: 'dentora-dev-without-csp',
  apply: 'serve' as const,
  transformIndexHtml: (html: string) => html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/i, ''),
}

// Dentora — one build serves the browser, the Windows app (Electron) and the Android app (WebView).
// Relative asset paths keep it working from file:// and from the Android asset server alike.
// QA builds add window.__dentora (the live database) for scripts/qa: VITE_QA=1 npx vite build --outDir /tmp/dist-qa
// (src/main.tsx). Release builds (npm run build, electron-builder, scripts/build-apk.sh) never set VITE_QA.
export default defineConfig({
  plugins: [react(), devWithoutCsp],
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
