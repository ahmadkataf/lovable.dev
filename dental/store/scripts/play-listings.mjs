#!/usr/bin/env node
// Writes the Google Play listing translations (store/play/<lang>.json: title, short, full, whatsNew) into
// store/LISTING.md, between the markers below, with Play's character counts. Run after editing a JSON file:
//   node store/scripts/play-listings.mjs
// Limits: app name 30, short description 80, full description 4000, what's new 500 (Play counts characters).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const STORE = join(dirname(fileURLToPath(import.meta.url)), '..')
const ORDER = ['fr', 'es', 'pt', 'tr', 'id', 'ur']
const NAMES = { fr: 'Français', es: 'Español', pt: 'Português (Brasil)', tr: 'Türkçe', id: 'Bahasa Indonesia', ur: 'اردو' }
const LIMITS = { title: 30, short: 80, full: 4000, whatsNew: 500 }
const START = '<!-- play-translations:start -->'
const END = '<!-- play-translations:end -->'

const len = (s) => [...s].length
const files = readdirSync(join(STORE, 'play')).filter(f => f.endsWith('.json'))
const listings = ORDER.filter(l => files.includes(`${l}.json`)).map(l => JSON.parse(readFileSync(join(STORE, 'play', `${l}.json`), 'utf8')))

const problems = []
for (const x of listings) {
  for (const [k, max] of Object.entries(LIMITS)) {
    if (typeof x[k] !== 'string' || !x[k].trim()) problems.push(`${x.lang}.${k}: missing`)
    else if (len(x[k]) > max) problems.push(`${x.lang}.${k}: ${len(x[k])} > ${max}`)
  }
  if (!x.title.startsWith('Dentora')) problems.push(`${x.lang}.title: must start with Dentora`)
  if (/\$|€|\d+\s?(USD|dollar)|whatsapp\.com|wa\.me|raqeem\.dev/i.test(x.full + x.short + x.title)) problems.push(`${x.lang}: price or purchase link in the listing`)
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1) }

const block = (title, n, max, text) => `**${title}** (${n.toLocaleString('en-US')}/${max.toLocaleString('en-US')})\n\n\`\`\`\n${text}\n\`\`\`\n`
const section = listings.map(x => `### ${NAMES[x.lang]} — Play language${x.playLocales.length > 1 ? 's' : ''}: ${x.playLocales.map(p => `\`${p}\``).join(', ')}

${block('App name', len(x.title), 30, x.title)}
${block('Short description', len(x.short), 80, x.short)}
${block('Full description', len(x.full), 4000, x.full)}
${block("What's new", len(x.whatsNew), 500, x.whatsNew)}`).join('\n')

const intro = `## 2b. More translations — fr, es, pt-BR, tr, id, ur

Play Console → Main store listing → **Manage translations** → add each language and paste its texts. The app itself is in
Arabic and English, so give these languages the **English** screenshots and feature graphic
(\`framed/<device>/en/\`, \`feature-graphic-1024x500-en.png\`): without their own graphics Play would show the Arabic
ones. Texts are the English listing translated (same facts, no price, no purchase route, the paid-licence and
"not a medical device" notes kept), from \`store/play/<lang>.json\` (\`node store/scripts/play-listings.mjs\` writes them here).

`
const md = readFileSync(join(STORE, 'LISTING.md'), 'utf8')
const out = md.includes(START)
  ? md.replace(new RegExp(`${START}[\\s\\S]*?${END}`), `${START}\n${intro}${section}${END}`)
  : md.replace('\n## 3. Category, contact and policy', `\n${START}\n${intro}${section}${END}\n\n---\n\n## 3. Category, contact and policy`)
writeFileSync(join(STORE, 'LISTING.md'), out)
console.log(`LISTING.md: ${listings.map(x => x.lang).join(', ')}`)
