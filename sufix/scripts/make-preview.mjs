// Turns dist-preview/ into one self-contained HTML page (styles and script inlined) for sharing as a preview.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
const dir = 'dist-preview'
const html = readFileSync(`${dir}/index.html`, 'utf8')
const assets = readdirSync(`${dir}/assets`)
const css = assets.filter(f => f.endsWith('.css')).map(f => readFileSync(`${dir}/assets/${f}`, 'utf8')).join('\n')
const js = assets.filter(f => f.endsWith('.js')).map(f => readFileSync(`${dir}/assets/${f}`, 'utf8')).join('\n').replace(/<\/script/g, '<\\/script')
const title = 'SUFIX'
const fonts = /<link href="https:\/\/fonts.googleapis.com[^>]*>/.exec(html)?.[0] ?? ''
const out = `<title>${title}</title>
<meta name="description" content="معاينة موقع SUFIX لصيانة وبيع الإلكترونيات والدرونات" />
${fonts}
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`
writeFileSync(`${dir}/sufix-preview.html`, out)
console.log(`${dir}/sufix-preview.html  ${(out.length / 1024).toFixed(0)} KB`)
