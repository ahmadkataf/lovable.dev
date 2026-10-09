import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import fs from 'fs'

// Build-time facts the app ships with:
//   POS_API                 the license server, e.g. https://kasher-api.<name>.workers.dev (empty = demo mode, no activation)
//   POS_LICENSE_PUBLIC_KEY  the server's Ed25519 public key (hex); the app refuses licenses signed by anything else
//   POS_BUILD               a build id (the CI run number or the git commit) sent with every license check
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
let build = process.env.POS_BUILD || ''
if (!build) { try { build = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { build = 'dev' } }

export default defineConfig({
  define: {
    __POS_API__: JSON.stringify((process.env.POS_API ?? '').replace(/\/$/, '')),
    __POS_PUBLIC_KEY__: JSON.stringify(process.env.POS_LICENSE_PUBLIC_KEY ?? ''),
    __POS_VERSION__: JSON.stringify(pkg.version),
    __POS_BUILD__: JSON.stringify(build),
  },
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    // fonts go inside the stylesheet so the offline app never fetches them
    assetsInlineLimit: (file: string) => (file.endsWith('.woff2') ? true : undefined),
    rollupOptions: { output: { manualChunks: { zxing: ['@zxing/browser', '@zxing/library'] } } },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'], setupFiles: ['src/test/setup.ts'] },
} as any)
