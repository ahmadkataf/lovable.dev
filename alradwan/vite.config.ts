import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const pkg = createRequire(import.meta.url)('./package.json') as { version: string }

/** After the build: the service worker learns this build's id and the files that make up the shell. */
function serviceWorker(): Plugin {
  return {
    name: 'alradwan-sw',
    closeBundle() {
      const dist = path.resolve('dist')
      const sw = path.join(dist, 'sw.js')
      if (!fs.existsSync(sw)) return
      const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
      const assets = fs.readdirSync(path.join(dist, 'assets')).filter(f => /\.(js|css|woff2?)$/.test(f)).map(f => './assets/' + f)
      const list = ['./index.html', './manifest.webmanifest', './icon.svg', ...assets]
      const build = `${pkg.version}-${Date.now().toString(36)}`
      fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace('__BUILD__', build).replace('__PRECACHE__', JSON.stringify(list)))
    },
  }
}

// The same build runs as the website, inside the Windows app (Electron) and inside the Android app (WebView):
// relative paths and a hash router, so it works from any folder and any address.
export default defineConfig({
  plugins: [react(), serviceWorker()],
  base: './',
  // ALRADWAN_API: the licensing/sync server the build activates against; empty = no activation (free build)
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_TIME__: JSON.stringify(Date.now()), __ALRADWAN_API__: JSON.stringify((process.env.ALRADWAN_API ?? '').replace(/\/$/, '')) },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // the font goes inside the stylesheet so the offline apps carry it
    assetsInlineLimit: (file: string) => (file.endsWith('.woff2') ? true : undefined),
    rollupOptions: { output: { manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom', 'zustand', 'dexie'] } } },
  },
  server: { port: 5180 },
})
