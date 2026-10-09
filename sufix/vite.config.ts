import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// ARTIFACT=1 builds the single-file preview (hash routes, one chunk) that scripts/make-preview.mjs inlines into one HTML page
const artifact = process.env.ARTIFACT === '1'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': path.resolve(__dirname, 'shared') } },
  server: { proxy: { '/api': 'http://localhost:8787' } },
  base: artifact ? './' : '/',
  define: artifact ? { 'import.meta.env.VITE_HASH_ROUTER': '"1"' } : {},
  build: artifact
    ? { outDir: 'dist-preview', emptyOutDir: true, rollupOptions: { output: { inlineDynamicImports: true } } }
    : { outDir: 'dist', emptyOutDir: true },
})
