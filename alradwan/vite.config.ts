import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The same build runs as the website, inside the Windows app (Electron) and inside the Android app (WebView):
// relative paths and a hash router, so it works from any folder and any address.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // the font goes inside the stylesheet so the offline apps carry it
    assetsInlineLimit: (file: string) => (file.endsWith('.woff2') ? true : undefined),
  },
  server: { port: 5180 },
})
