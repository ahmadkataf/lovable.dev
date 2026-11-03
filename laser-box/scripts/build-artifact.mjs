// Bundles dist/ into one self-contained HTML fragment (dist/artifact.html): the claude.ai Artifact
// host wraps it in its own document skeleton, so no <html>/<head>/<body> here.
import fs from 'fs'
import path from 'path'
const dist = path.resolve('dist')
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const js = html.match(/<script type="module"[^>]*src="\.?\/?(assets\/[^"]+\.js)"/)[1]
const css = html.match(/<link rel="stylesheet"[^>]*href="\.?\/?(assets\/[^"]+\.css)"/)[1]
const fonts = html.match(/<link href="(https:\/\/fonts\.googleapis\.com[^"]+)"/)[1]
const out = `<title>مولّد صناديق الليزر</title>
<style>${fs.readFileSync(path.join(dist, css), 'utf8')}</style>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${fonts}" rel="stylesheet" />
<script>document.documentElement.setAttribute('dir','rtl');document.documentElement.setAttribute('lang','ar');</script>
<div id="app"></div>
<script type="module">${fs.readFileSync(path.join(dist, js), 'utf8')}</script>
`
fs.writeFileSync(path.join(dist, 'artifact.html'), out)
console.log('dist/artifact.html', (out.length / 1024).toFixed(0), 'KB')
