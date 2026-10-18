// The title card (chapter number and title on the brand gradient, with the logo) and the end card ("next: …"), drawn
// inside the overlay of lib/ui.mjs with the app's own fonts, so they are part of the screencast like everything else.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
// the mark of public/icon.svg (the tooth and its spark), drawn white on the gradient like the store pictures
const ICON = fs.readFileSync(path.join(ROOT, 'public/icon.svg'), 'utf8')
const TOOTH_PATH = ICON.match(/<path d="([^"]+)"/)[1]
const SPARK = ICON.match(/<circle cx="(\d+)" cy="(\d+)" r="(\d+)"/).slice(1).map(Number)
/** The brand gradient of public/icon.svg. */
export const GRADIENT = 'linear-gradient(135deg, #14B8A6 0%, #0E8F86 100%)'

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const logo = size => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}" style="display:block;filter:drop-shadow(0 8px 24px rgba(0,0,0,.25))">
  <rect width="256" height="256" rx="60" fill="rgba(255,255,255,.16)" stroke="rgba(255,255,255,.45)" stroke-width="3"/>
  <g transform="translate(3 8)"><path d="${TOOTH_PATH}" fill="#fff" opacity=".97"/><circle cx="${SPARK[0]}" cy="${SPARK[1]}" r="${SPARK[2]}" fill="#fff" opacity=".9"/></g></svg>`

const WORDS = {
  ar: { course: 'الدليل المرئي', chapter: n => `الفصل ${n}`, next: 'الفصل التالي', end: 'انتهى هذا الفصل', thanks: 'شكراً للمشاهدة' },
  en: { course: 'Video course', chapter: n => `Chapter ${n}`, next: 'Next chapter', end: 'End of this chapter', thanks: 'Thanks for watching' },
}

const frame = (lang, inner) => `<div style="position:absolute;inset:0;background:${GRADIENT};color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;direction:${lang === 'ar' ? 'rtl' : 'ltr'}">
  <div style="display:flex;flex-direction:column;align-items:center;gap:22px;padding:0 120px;max-width:1100px">${inner}</div></div>`

/** The title card: the logo, "Dentora · Video course", the chapter number (when known) and the title. */
export function titleCardHtml({ lang, number, title }) {
  const w = WORDS[lang]
  return frame(lang, `
  ${logo(116)}
  <div style="font-size:20px;font-weight:600;letter-spacing:.02em;opacity:.85">Dentora · ${w.course}</div>
  ${number ? `<div style="font-size:26px;font-weight:600;opacity:.92;margin-top:6px">${w.chapter(number)}</div>` : ''}
  <h1 style="margin:0;font-size:${title.length > 36 ? 48 : 58}px;line-height:1.3;font-weight:800;text-shadow:0 4px 18px rgba(0,0,0,.18)">${esc(title)}</h1>`)
}

/** The end card: "next chapter: …", or "end of this chapter" when the next one is not known. */
export function endCardHtml({ lang, next }) {
  const w = WORDS[lang]
  return frame(lang, `
  ${logo(84)}
  <div style="font-size:24px;font-weight:600;opacity:.88;margin-top:8px">${next ? w.next : w.end}</div>
  <div style="font-size:${(next || w.thanks).length > 36 ? 40 : 50}px;line-height:1.3;font-weight:800;text-shadow:0 4px 18px rgba(0,0,0,.18)">${esc(next || w.thanks)}</div>`)
}

/** Shows a card at once (no fade in: the recording starts with the title card already there). */
export async function showCard(page, html) {
  await page.evaluate(h => window.__dv.card(h), html)
  await page.evaluate(() => document.fonts.ready)
}
/** Fades the card out over `ms` and waits for it. */
export async function hideCard(page, ms = 350) {
  await page.evaluate(ms => window.__dv.uncard(ms), ms)
  await page.waitForTimeout(ms + 80)
}
