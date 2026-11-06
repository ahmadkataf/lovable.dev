// Writes build/license.txt, the terms of use the Windows installer shows on its licence page (electron-builder.yml
// nsis.license), from docs/TERMS.md: Arabic first, then English, as plain text. UTF-8 with a byte-order mark and
// Windows line endings, which the installer's text box needs to show Arabic.
//   node scripts/make-license-txt.mjs            (run it after changing docs/TERMS.md; tests/legal-files.test.ts checks it)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const TERMS_MD = path.join(ROOT, 'docs/TERMS.md')
export const LICENSE_TXT = path.join(ROOT, 'build/license.txt')

/** docs/TERMS.md (Markdown with the two languages in <div> blocks) → the installer's plain text (LF line ends). */
export function termsToText(md) {
  const lines = md
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
  const out = []
  for (const raw of lines) {
    let line = raw.trimEnd()
    if (/^\s*<\/?div\b[^>]*>\s*$/i.test(line)) continue                 // the language blocks
    if (/^\s*(\[[^\]]+\]\(#[^)]*\)\s*·?\s*)+$/.test(line)) continue       // "العربية · English" jump links
    if (/^-{3,}$/.test(line.trim())) { out.push('', '────────────────────────────────', ''); continue }
    line = line
      .replace(/\[([^\]]+)\]\((https?:[^)]+|mailto:[^)]+)\)/g, '$1 ($2)')   // web and mail links keep their address
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')                             // other links: the text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(^|\s)\*([^*\s][^*]*)\*(?=\s|$)/g, '$1$2')
      .replace(/`([^`]+)`/g, '$1')
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      const title = h[2].trim()
      // a document title is underlined; a section title stands on its own line
      if (h[1].length === 1) out.push('', title, '═'.repeat(Math.min(48, Math.max(12, title.length))), '')
      else out.push('', title)
      continue
    }
    const li = /^\s*[-*]\s+(.*)$/.exec(line)
    if (li) { out.push(`• ${li[1]}`); continue }
    out.push(line)
  }
  return out.join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '\n')
}

/** The file's exact bytes: a UTF-8 byte-order mark, then the text with CRLF line ends. */
export function licenseFileBytes(md) {
  const text = termsToText(md).replace(/\n/g, '\r\n')
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')])
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bytes = licenseFileBytes(fs.readFileSync(TERMS_MD, 'utf8'))
  fs.writeFileSync(LICENSE_TXT, bytes)
  console.log(`${path.relative(ROOT, LICENSE_TXT)}: ${bytes.length} bytes from ${path.relative(ROOT, TERMS_MD)}`)
}
