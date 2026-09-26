import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// One build carries one book: BOOK=bac npm run build
const BOOK = process.env.BOOK || 'g8'
const bookDir = path.resolve(__dirname, 'src/books', BOOK)
if (!fs.existsSync(bookDir)) throw new Error(`Unknown book "${BOOK}"`)
const meta = JSON.parse(fs.readFileSync(path.join(bookDir, 'book.json'), 'utf8'))

// A book sold online ships only its free part: scripts/split-online.mjs writes it to generated/<book>/.
const online = meta.api !== undefined
const genDir = path.resolve(__dirname, 'generated', BOOK)
if (online && !fs.existsSync(path.join(genDir, 'index.ts'))) throw new Error(`Run "node scripts/split-online.mjs ${BOOK}" first`)
// the server address can be given at build time (EMAR_API=https://…) instead of in book.json
const api = (process.env.EMAR_API ?? meta.api ?? '').replace(/\/$/, '')

export default defineConfig({
  // EMAR_STORE=play builds the Google Play version, which may not point students to outside payment
  define: { __EMAR_API__: JSON.stringify(online ? api : ''), __EMAR_STORE__: JSON.stringify(process.env.EMAR_STORE || 'direct') },
  plugins: [
    react(),
    { name: 'book-html', transformIndexHtml: html => html.replaceAll('%BOOK_TITLE%', `${meta.title} — تعلّم الإنجليزية`).replaceAll('%BOOK_COLOR%', meta.color).replaceAll('%APP_NAME%', meta.appName) },
  ],
  base: './',
  publicDir: online ? path.join(genDir, 'public') : path.resolve(__dirname, 'public', BOOK),
  resolve: { alias: { '@book-meta': path.join(bookDir, 'book.json'), '@book': online ? path.join(genDir, 'index.ts') : path.join(bookDir, 'index.ts') } },
  // the fonts go inside the stylesheet, so the single-file web version and the offline app both have them
  build: { outDir: `dist/${BOOK}`, emptyOutDir: true, assetsInlineLimit: (file: string) => (file.endsWith('.woff2') ? true : undefined) },
})
