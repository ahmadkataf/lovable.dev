import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// One build carries one book: BOOK=bac npm run build
const BOOK = process.env.BOOK || 'g8'
const bookDir = path.resolve(__dirname, 'src/books', BOOK)
if (!fs.existsSync(bookDir)) throw new Error(`Unknown book "${BOOK}"`)
const meta = JSON.parse(fs.readFileSync(path.join(bookDir, 'book.json'), 'utf8'))

export default defineConfig({
  plugins: [
    react(),
    { name: 'book-html', transformIndexHtml: html => html.replaceAll('%BOOK_TITLE%', `${meta.title} — تعلّم الإنجليزية`).replaceAll('%BOOK_COLOR%', meta.color) },
  ],
  base: './',
  publicDir: path.resolve(__dirname, 'public', BOOK),
  resolve: { alias: { '@book-meta': path.join(bookDir, 'book.json'), '@book': path.join(bookDir, 'index.ts') } },
  build: { outDir: `dist/${BOOK}`, emptyOutDir: true },
})
