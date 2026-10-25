import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const shared = path.resolve(here, '../shared')

// Generates public/icons/*.png from ../shared/logo.svg (Playwright) before a production build.
// The script is a no-op when the PNGs are newer than the logo, and only warns when Playwright is unavailable.
function brandIcons(): Plugin {
  return {
    name: 'focuspoint-brand-icons',
    apply: 'build',
    async buildStart() {
      const mod = await import('./scripts/icons.mjs')
      await mod.generateIcons({ log: (m: string) => this.info(m) })
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    brandIcons(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,              // we call registerSW() ourselves in src/main.tsx
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      manifest: {
        id: '/',
        name: 'فوكس بوينت',
        short_name: 'Focus Point',
        description: 'احجز مكانك في فوكس بوينت — درعا',
        theme_color: '#7b1e2e',
        background_color: '#f6f1ea',
        display: 'standalone',
        orientation: 'portrait',
        dir: 'rtl',
        lang: 'ar',
        start_url: '/',
        scope: '/',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@shared': shared },
  },
  server: {
    port: 5173,
    fs: { allow: [here, shared] },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
})
