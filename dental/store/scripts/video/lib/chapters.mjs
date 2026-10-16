// The chapters: the scripts in chapters/<slug>.mjs (what to show and say) and the course's chapter list in
// server/videos/index.ts (order, titles, what comes next), which the website renders from too. The list may not
// exist yet: then the chapter's own title is used and the end card says the chapter ended instead of naming the next.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const CHAPTERS_DIR = path.resolve(HERE, '../chapters')
export const INDEX_TS = path.resolve(HERE, '../../../../server/videos/index.ts')

/** The slugs of every chapter script, in file order; `_sample` and other `_` files are test chapters, left out. */
export function listChapterScripts() {
  if (!fs.existsSync(CHAPTERS_DIR)) return []
  return fs.readdirSync(CHAPTERS_DIR).filter(f => f.endsWith('.mjs') && !f.startsWith('_')).map(f => f.slice(0, -4)).sort()
}

/** Loads and checks chapters/<slug>.mjs: { slug, title?, before?, scenes: [{ id, say: { ar, en }, run }] }. */
export async function loadChapter(slug) {
  const file = path.join(CHAPTERS_DIR, `${slug}.mjs`)
  if (!fs.existsSync(file)) throw new Error(`no chapter script ${path.relative(process.cwd(), file)}`)
  const m = await import(pathToFileURL(file).href)
  const chapter = m.chapter || m.default
  if (!chapter || typeof chapter !== 'object') throw new Error(`${slug}.mjs exports no \`chapter\``)
  if (chapter.slug !== slug) throw new Error(`${slug}.mjs: chapter.slug is "${chapter.slug}", the file name is "${slug}"`)
  if (!Array.isArray(chapter.scenes) || !chapter.scenes.length) throw new Error(`${slug}.mjs: no scenes`)
  const ids = new Set()
  for (const s of chapter.scenes) {
    if (!s.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) throw new Error(`${slug}.mjs: scene id "${s.id}" is not kebab-case`)
    if (ids.has(s.id)) throw new Error(`${slug}.mjs: scene id "${s.id}" twice`)
    ids.add(s.id)
    for (const lang of ['ar', 'en']) if (typeof s.say?.[lang] !== 'string' || !s.say[lang].trim()) throw new Error(`${slug}.mjs: scene "${s.id}" says nothing in ${lang}`)
    if (typeof s.run !== 'function') throw new Error(`${slug}.mjs: scene "${s.id}" has no run()`)
  }
  return chapter
}

/**
 * The course's chapter list from server/videos/index.ts (Node runs .ts files as the server's build script does), or
 * null when it does not exist yet. Accepts an exported array (`CHAPTERS`, `chapters` or the default export) of
 * { slug, order, title: { ar, en } }, sorted by `order`.
 */
export async function loadIndex() {
  if (!fs.existsSync(INDEX_TS)) return null
  let m
  try { m = await import(pathToFileURL(INDEX_TS).href) } catch (e) { throw new Error(`cannot import ${INDEX_TS}: ${e.message}`) }
  const list = [m.CHAPTERS, m.chapters, m.default, m.VIDEOS, m.videos].find(Array.isArray)
  if (!list) throw new Error(`${INDEX_TS} exports no chapter array (CHAPTERS, chapters or default)`)
  const chapters = list.filter(c => c && typeof c.slug === 'string').map(c => ({ ...c, order: typeof c.order === 'number' ? c.order : Infinity }))
  chapters.sort((a, b) => a.order - b.order)
  return chapters
}

const titleOf = (c, lang) => (typeof c?.title === 'string' ? c.title : c?.title?.[lang]) || ''

/**
 * What the cards of chapter `chapter` say in `lang`: its number (position in the list, when listed), its title (the
 * script's own `title` first, then the list's) and the next chapter's title (null when unknown).
 */
export function chapterCards(index, chapter, lang) {
  const at = index ? index.findIndex(c => c.slug === chapter.slug) : -1
  const listed = at >= 0 ? index[at] : null
  const title = titleOf(chapter, lang) || titleOf(listed, lang) || chapter.slug
  const next = at >= 0 && index[at + 1] ? titleOf(index[at + 1], lang) || index[at + 1].slug : null
  return { number: at >= 0 ? at + 1 : (chapter.number ?? null), title, next }
}
