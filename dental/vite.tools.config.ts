// Builds the seller's private code generator into ONE offline HTML file: dist-tools/code-generator.html
//   npx vite build --config vite.tools.config.ts
// It is never part of the app build (vite.config.ts) and must never be shipped to clinics.
import { defineConfig, type Plugin } from 'vite'
import path from 'node:path'

/** Moves every emitted JS chunk (and CSS) into the HTML, so the page is a single self-contained file. */
function inlineIntoHtml(): Plugin {
  return {
    name: 'dentora-inline-into-html',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const html of Object.values(bundle)) {
        if (html.type !== 'asset' || !html.fileName.endsWith('.html')) continue
        let src = String(html.source)
        for (const [name, item] of Object.entries(bundle)) {
          const file = item.fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          if (item.type === 'chunk') {
            const tag = new RegExp(`<script[^>]*src="[^"]*${file}"[^>]*></script>`)
            const code = item.code.replace(/<\/script/gi, '<\\/script')
            src = src.replace(tag, () => `<script type="module">\n${code}</script>`)
            delete bundle[name]
          } else if (item.fileName.endsWith('.css')) {
            const tag = new RegExp(`<link[^>]*href="[^"]*${file}"[^>]*>`)
            src = src.replace(tag, () => `<style>${String(item.source)}</style>`)
            delete bundle[name]
          }
        }
        src = src.replace(/<link rel="modulepreload"[^>]*>/g, '')
        html.source = src
      }
    },
  }
}

export default defineConfig({
  root: path.resolve(__dirname, 'tools'),
  base: './',
  publicDir: false,
  plugins: [inlineIntoHtml()],
  build: {
    outDir: path.resolve(__dirname, 'dist-tools'),
    emptyOutDir: true,
    target: 'es2020',
    modulePreload: false,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'tools/code-generator.html'),
      output: { inlineDynamicImports: true },
    },
  },
})
