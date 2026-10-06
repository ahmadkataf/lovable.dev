import './style.css'
import { TEMPLATES, templateById, ParamDef, CATEGORIES, NEW_IDS } from './templates'
import { generate, Design, Settings, DEFAULT_SETTINGS } from './generate'
import { toSVG, toDXF, toAI } from './export'
import { loopToPath } from './geom'
import { makeZip } from './zip'
import { MATERIAL_INFO } from './materials'

// Inside the claude.ai viewer the page cannot start downloads itself and the link hash carries no state.
type ClaudeUse = (name: string) => Promise<{ save(r: { filename: string; data: string | Blob }): Promise<unknown> } | null>
const claudeUse: ClaudeUse | null = typeof (window as unknown as { claude?: { use?: ClaudeUse } }).claude?.use === 'function' ? (window as unknown as { claude: { use: ClaudeUse } }).claude.use : null
const inViewer = claudeUse !== null
// Inside the Android app the shell saves files through the system file dialog.
type AndroidBridge = { save(filename: string, mime: string, text: string): void }
const android: AndroidBridge | null = (window as unknown as { LaserAndroid?: AndroidBridge }).LaserAndroid ?? null

// ------------------------------------------------------------------ state

interface State { tpl: string; params: Record<string, Record<string, number>>; settings: Settings; labels: boolean }

const SETTING_DEFS: ParamDef[] = [
  { key: 't', label: 'سماكة الخامة', min: 0.5, max: 30, step: 0.1, unit: 'مم', hint: 'قِس اللوح بالقدمة في أكثر من مكان: لوح «3 مم» كثيراً ما يكون 3.2–3.5 فعلياً (أو 2.7). الشقوق تُقصّ على هذا الرقم، فإن كان أصغر من الحقيقي لا تدخل القطع إلا بالكسر. لا قدمة؟ اقصّ «اختبار التعشيق» من قسم المعايرة' },
  { key: 'kerf', label: 'عرض الشقّ (kerf)', min: 0, max: 1, step: 0.01, unit: 'مم', hint: 'ما يأكله شعاع الليزر؛ عادةً 0.1–0.2 مم. يُعوَّض تلقائياً لتعشيق محكم' },
  { key: 'finger', label: 'عرض الأصبع', min: 0, max: 100, step: 0.5, unit: 'مم', hint: '0 = تلقائي (بين ضعف السماكة وثلاثة أضعافها بحسب حجم الصندوق). يُضبط ليكون العدد فردياً' },
  { key: 'spacing', label: 'المسافة بين القطع', min: 0, max: 50, step: 0.5, unit: 'مم' },
  { key: 'sheetW', label: 'عرض اللوح', min: 50, max: 3000, step: 10, unit: 'مم', hint: 'القطع تُرصّ في صفوف لا تتجاوز هذا العرض' },
]

const MATERIALS: { id: string; label: string; kerf: number }[] = [
  { id: 'plywood', label: 'أبلكاش', kerf: 0.15 },
  { id: 'mdf', label: 'MDF', kerf: 0.2 },
  { id: 'acrylic', label: 'أكريليك', kerf: 0.1 },
]

const LS_KEY = 'laser-box-state-v2'

function loadState(): State {
  const base: State = { tpl: TEMPLATES[0].id, params: {}, settings: { ...DEFAULT_SETTINGS }, labels: true }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) Object.assign(base, JSON.parse(raw), { settings: { ...DEFAULT_SETTINGS, ...JSON.parse(raw).settings } })
  } catch { /* storage may be unavailable */ }
  // a shared link wins over what was saved
  const h = new URLSearchParams(location.hash.replace(/^#/, ''))
  if (h.has('tpl')) {
    base.tpl = templateById(h.get('tpl')!).id
    const p: Record<string, number> = {}
    for (const [k, v] of h) {
      if (k === 'tpl' || k === 'labels') continue
      const n = parseFloat(v)
      if (!Number.isFinite(n)) continue
      if (k in DEFAULT_SETTINGS) (base.settings as unknown as Record<string, number | boolean>)[k] = k === 'inner' ? n === 1 : n
      else p[k] = n
    }
    base.params[base.tpl] = { ...(base.params[base.tpl] ?? {}), ...p }
  }
  return base
}

const state = loadState()
const tpl = () => templateById(state.tpl)
const params = () => ({ ...tpl().defaults, ...(state.params[state.tpl] ?? {}) })

function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch { /* ignore */ }
  const h = new URLSearchParams()
  h.set('tpl', state.tpl)
  for (const [k, v] of Object.entries(params())) h.set(k, String(v))
  for (const [k, v] of Object.entries(state.settings)) h.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v))
  if (!inViewer) history.replaceState(null, '', '#' + h.toString())
}

// ------------------------------------------------------------------ dom helpers

type Attrs = Record<string, string | ((e: Event) => void)>
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string)[]) => {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) { if (typeof v === 'function') e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else e.setAttribute(k, v) }
  for (const c of children) e.append(c)
  return e
}
const fmt = (v: number) => (Math.round(v * 10) / 10).toLocaleString('en-US')

function toast(msg: string, ms = 2200) {
  const t = el('div', { class: 'toast' }, msg)
  document.body.append(t)
  requestAnimationFrame(() => t.classList.add('show'))
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300) }, ms)
}

function numberField(def: ParamDef, value: number, onChange: (v: number) => void, idPrefix = 'f'): HTMLElement {
  const input = el('input', { id: `${idPrefix}-${def.key}`, type: 'number', inputmode: 'decimal', min: String(def.min), max: String(def.max), step: String(def.step ?? 1), value: String(value) }) as HTMLInputElement
  const commit = () => {
    let v = parseFloat(input.value)
    if (!Number.isFinite(v)) return
    v = Math.min(def.max, Math.max(def.min, v))
    if (def.int) v = Math.round(v)
    if (String(v) !== input.value) input.value = String(v)
    onChange(v); mirror(v)
  }
  // the quick strip and the full form show the same number: keep the twin input in step
  const mirror = (v: number) => { const twin = document.getElementById(`${idPrefix === 'f' ? 'q' : 'f'}-${def.key}`) as HTMLInputElement | null; if (twin && twin !== document.activeElement) twin.value = String(v) }
  input.oninput = () => { const v = parseFloat(input.value); if (Number.isFinite(v) && v >= def.min && v <= def.max) { onChange(def.int ? Math.round(v) : v); mirror(v) } }
  input.onchange = commit
  const bump = (d: number) => () => { input.value = String(Math.min(def.max, Math.max(def.min, (parseFloat(input.value) || 0) + d))); commit() }
  const step = def.step ?? 1
  const wrap = el('label', { class: 'field' },
    el('span', { class: 'field-label' }, def.label, def.unit ? el('small', {}, def.unit) : ''),
    el('div', { class: 'field-ctl' }, el('button', { type: 'button', class: 'bump', onclick: bump(-step * (def.int ? 1 : 2)), 'aria-label': 'أقل' }, '−'), input, el('button', { type: 'button', class: 'bump', onclick: bump(step * (def.int ? 1 : 2)), 'aria-label': 'أكثر' }, '+')),
  )
  if (def.hint) wrap.append(el('span', { class: 'hint' }, def.hint))
  return wrap
}

// ------------------------------------------------------------------ layout of the page

const app = document.getElementById('app')!
app.innerHTML = ''

const header = el('header', { class: 'top' },
  el('div', { class: 'brand' }, el('span', { class: 'logo', 'aria-hidden': 'true' }, '▣'), el('div', {}, el('h1', {}, 'مولّد صناديق الليزر'), el('p', {}, 'اختر الشكل، اضبط القياسات والسماكة، ونزّل ملفاً جاهزاً للقص'))),
)
const gallery = el('nav', { class: 'picker', 'aria-label': 'التصميم المختار' })
const chooser = el('dialog', { class: 'chooser', 'aria-label': 'اختر التصميم' }) as HTMLDialogElement
const quick = el('section', { class: 'quick', 'aria-label': 'القياسات الأساسية' })
const form = el('aside', { class: 'form' })
const previewWrap = el('section', { class: 'preview' })
const svgNS = 'http://www.w3.org/2000/svg'
const svg = document.createElementNS(svgNS, 'svg')
svg.setAttribute('class', 'canvas')
const stats = el('div', { class: 'stats' })
const alerts = el('div', { class: 'alerts' })
const notesBox = el('div', { class: 'notes' })
const actions = el('div', { class: 'actions' })
previewWrap.append(stats, alerts, el('div', { class: 'canvas-wrap' }, svg, el('div', { class: 'canvas-tools' }, el('button', { type: 'button', class: 'tool', onclick: () => fitView(), title: 'ملاءمة' }, '⤢'), el('button', { type: 'button', class: 'tool', onclick: () => { state.labels = !state.labels; persist(); render() }, title: 'الأسماء' }, 'Aa'))), actions)
document.body.append(chooser)
app.append(header, gallery, quick, el('div', { class: 'work' }, form, previewWrap), notesBox, el('footer', { class: 'foot' }, 'الملفات بالمليمتر. افتح SVG أو DXF في LightBurn أو RDWorks أو Inkscape، وتأكّد أن القياس 1:1 قبل القص.'))

// ------------------------------------------------------------------ gallery

const iconSvg = (icon: string) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${icon}</svg>`
let chooserCat = ''

/** The page shows only the chosen design; "change" opens a sheet with every design, grouped. */
function renderGallery() {
  const t = tpl()
  gallery.innerHTML = ''
  const cur = el('button', { type: 'button', class: 'picker-cur', onclick: () => openChooser() })
  cur.innerHTML = `${iconSvg(t.icon)}<span class="picker-text"><b></b><small></small></span><span class="picker-btn">كل التصاميم (${TEMPLATES.length}) ▾</span>`
  cur.querySelector('b')!.textContent = t.name
  cur.querySelector('small')!.textContent = t.desc
  gallery.append(cur)
}

function openChooser() {
  chooserCat = CATEGORIES.find(c => c.ids.includes(state.tpl))?.id ?? ''
  renderChooser()
  chooser.showModal()
  chooser.querySelector<HTMLElement>('.card.active')?.scrollIntoView({ block: 'nearest' })
  chooser.querySelector<HTMLElement>('.chip.on')?.scrollIntoView({ block: 'nearest', inline: 'center' })
}

function renderChooser() {
  chooser.innerHTML = ''
  const head = el('div', { class: 'chooser-head' }, el('h2', {}, 'اختر التصميم'), el('button', { type: 'button', class: 'tool', 'aria-label': 'إغلاق', onclick: () => chooser.close() }, '✕'))
  const chips = el('div', { class: 'chips', role: 'tablist' })
  for (const c of [{ id: '', name: 'الكل', ids: TEMPLATES.map(x => x.id) }, ...CATEGORIES]) {
    const b = el('button', { type: 'button', role: 'tab', class: 'chip' + (c.id === chooserCat ? ' on' : ''), 'aria-selected': String(c.id === chooserCat), onclick: () => { chooserCat = c.id; renderChooser() } }, `${c.name} `, el('small', {}, String(c.ids.length)))
    chips.append(b)
  }
  const ids = chooserCat ? CATEGORIES.find(c => c.id === chooserCat)!.ids : CATEGORIES.flatMap(c => c.ids)
  const grid = el('div', { class: 'grid' })
  for (const id of ids) {
    const t = templateById(id)
    const card = el('button', { type: 'button', class: 'card' + (t.id === state.tpl ? ' active' : ''), 'aria-pressed': String(t.id === state.tpl), title: t.desc })
    card.innerHTML = `${iconSvg(t.icon)}<span></span>${NEW_IDS.includes(t.id) ? '<i class="badge">جديد</i>' : ''}`
    card.querySelector('span')!.textContent = t.name
    card.onclick = () => { state.tpl = t.id; persist(); chooser.close(); renderGallery(); renderForm(); update(true) }
    grid.append(card)
  }
  chooser.append(head, chips, grid)
}
chooser.addEventListener('click', e => { if (e.target === chooser) chooser.close() }) // a tap on the backdrop closes it

// ------------------------------------------------------------------ form

function materialPicker(): HTMLElement {
  const seg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'الخامة' })
  for (const m of MATERIALS) {
    const b = el('button', { type: 'button', class: Math.abs(state.settings.kerf - m.kerf) < 1e-9 ? 'on' : '' }, m.label)
    b.onclick = () => { state.settings.kerf = m.kerf; persist(); renderForm(); update() }
    seg.append(b)
  }
  return seg
}

/** One tap for the common sheet thicknesses (the field below still takes any measured value). */
const THICKNESSES = [2.7, 3, 3.2, 4, 5, 6]
function thicknessPicker(): HTMLElement {
  const seg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'السماكة' })
  for (const v of THICKNESSES) {
    const b = el('button', { type: 'button', class: Math.abs(state.settings.t - v) < 1e-9 ? 'on' : '' }, String(v))
    b.onclick = () => { state.settings.t = v; persist(); renderForm(); update() }
    seg.append(b)
  }
  return seg
}

function renderQuick() {
  const t = tpl()
  const cur = params()
  quick.innerHTML = ''
  const row = el('div', { class: 'quick-row' })
  for (const def of t.params.filter(d => ['W', 'D', 'H', 'Dm', 'pw', 'ph', 'border'].includes(d.key))) row.append(numberField(def, cur[def.key], v => { (state.params[state.tpl] ??= {})[def.key] = v; persist(); update() }, 'q'))
  row.append(numberField(SETTING_DEFS[0], state.settings.t, v => { state.settings.t = v; persist(); update() }, 'q'))
  const foot = el('div', { class: 'quick-foot' },
    el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'الخامة', el('small', {}, `kerf ${state.settings.kerf} مم`)), materialPicker()),
    el('button', { type: 'button', class: 'more', onclick: () => form.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, '⚙ كل الإعدادات (الخلوص، المحور، عرض الأصبع…)'),
  )
  quick.append(row, foot)
}

function renderForm() {
  renderQuick()
  const t = tpl()
  form.innerHTML = ''
  form.append(el('h2', {}, t.name), el('p', { class: 'desc' }, t.desc))
  const dims = el('fieldset', {}, el('legend', {}, 'القياسات'))
  const seg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'نوع القياسات' })
  for (const [val, label] of [[false, 'خارجية'], [true, 'داخلية']] as const) {
    const b = el('button', { type: 'button', class: state.settings.inner === val ? 'on' : '' }, label)
    b.onclick = () => { state.settings.inner = val; persist(); renderForm(); update() }
    seg.append(b)
  }
  dims.append(el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'القياسات المدخلة'), seg, el('span', { class: 'hint' }, state.settings.inner ? 'الأبعاد هي الفراغ الداخلي؛ تُضاف السماكات تلقائياً' : 'الأبعاد هي الحجم الخارجي للصندوق')))
  const cur = params()
  for (const def of t.params) dims.append(numberField(def, cur[def.key], v => { (state.params[state.tpl] ??= {})[def.key] = v; persist(); update() }))
  const mat = el('fieldset', {}, el('legend', {}, 'الخامة والقص'))
  mat.append(el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'نوع الخامة'), materialPicker(), el('span', { class: 'hint' }, 'يضبط عرض الشقّ المعتاد؛ اكتب السماكة المقاسة بالقدمة في الخانة أدناه')))
  mat.append(el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'سماكات شائعة (مم)'), thicknessPicker(), el('span', { class: 'hint' }, 'اختر سماكة لوحك، أو اكتب المقاسة بالقدمة في «سماكة الخامة»')))
  for (const def of SETTING_DEFS) mat.append(numberField(def, (state.settings as unknown as Record<string, number>)[def.key], v => { (state.settings as unknown as Record<string, number>)[def.key] = v; persist(); update() }))
  const reset = el('button', { type: 'button', class: 'link' }, 'إعادة القيم الافتراضية')
  reset.onclick = () => { state.params[state.tpl] = {}; state.settings = { ...DEFAULT_SETTINGS }; persist(); renderForm(); update(true) }
  form.append(dims, mat, reset)
}

// ------------------------------------------------------------------ preview

let design: Design | null = null
let view = { x: 0, y: 0, w: 100, h: 100 }
let dirtyFit = true

function update(refit = false) {
  if (refit) dirtyFit = true
  try {
    design = generate(tpl(), params(), state.settings)
  } catch (err) {
    design = null
    stats.innerHTML = ''
    notesBox.innerHTML = ''
    alerts.innerHTML = ''
    alerts.append(el('div', { class: 'error' }, 'تعذّر توليد الشكل بهذه القيم: ' + (err as Error).message))
    actions.querySelectorAll('button.primary').forEach(b => ((b as HTMLButtonElement).disabled = true))
    return
  }
  render()
}

function render() {
  if (!design) return
  const lay = design.layout
  svg.innerHTML = ''
  const sheet = document.createElementNS(svgNS, 'rect')
  sheet.setAttribute('x', '0'); sheet.setAttribute('y', '0'); sheet.setAttribute('width', String(lay.w)); sheet.setAttribute('height', String(lay.h)); sheet.setAttribute('class', 'sheet')
  svg.append(sheet)
  for (const pl of lay.placed) {
    const g = document.createElementNS(svgNS, 'g')
    g.setAttribute('transform', `translate(${pl.x} ${pl.y})`)
    g.setAttribute('class', 'piece')
    const fill = document.createElementNS(svgNS, 'path')
    fill.setAttribute('d', pl.panel.loops.filter(l => l.closed && l.layer !== 'engrave').map(l => loopToPath(l)).join(' '))
    fill.setAttribute('class', 'wood')
    const mat = pl.panel.material ? MATERIAL_INFO[pl.panel.material] : undefined
    if (mat) fill.style.fill = mat.fill
    g.append(fill)
    // grooves filled with many side-by-side engrave lines read as one band: drawn solid and thin, not dashed
    const dense = pl.panel.loops.filter(l => l.layer === 'engrave').length > 20
    for (const l of pl.panel.loops) {
      const p = document.createElementNS(svgNS, 'path')
      p.setAttribute('d', loopToPath(l))
      p.setAttribute('class', l.layer === 'engrave' ? (dense ? 'cut engrave dense' : 'cut engrave') : l.closed ? 'cut' : 'cut score')
      if (mat && l.layer !== 'engrave') p.style.stroke = mat.hex
      g.append(p)
    }
    if (state.labels) {
      const tx = document.createElementNS(svgNS, 'text')
      tx.setAttribute('x', String(pl.panel.w / 2)); tx.setAttribute('y', String(pl.panel.h / 2))
      tx.setAttribute('class', 'label')
      const fs = Math.max(2.5, Math.min(7, pl.panel.h / 5, pl.panel.w / (pl.panel.name.length * 0.7 + 1)))
      tx.setAttribute('font-size', String(fs))
      tx.textContent = pl.panel.name
      const dim = document.createElementNS(svgNS, 'text')
      dim.setAttribute('x', String(pl.panel.w / 2)); dim.setAttribute('y', String(pl.panel.h / 2 + fs * 1.3))
      dim.setAttribute('class', 'label dim'); dim.setAttribute('font-size', String(fs * 0.75))
      dim.textContent = `${fmt(pl.panel.w)} × ${fmt(pl.panel.h)}`
      g.append(tx, dim)
    }
    svg.append(g)
  }
  if (dirtyFit) { fitView(); dirtyFit = false } else applyView()

  const p = params()
  stats.innerHTML = ''
  stats.append(
    stat('القطع', String(design.pieceCount)),
    stat('اللوح المطلوب', `${fmt(lay.w)} × ${fmt(lay.h)} مم`),
    stat('طول القصّ', `${fmt(design.cutLength / 1000)} م`),
    stat('القياس', sizeLabel(p)),
  )
  alerts.innerHTML = ''
  const blocked = design.errors.length > 0
  if (blocked) alerts.append(el('div', { class: 'error' }, el('b', {}, 'لا تقصّ هذا الملف: '), ...design.errors.map(e => el('div', {}, '✕ ' + e))))
  for (const w of design.warnings) alerts.append(el('div', { class: 'warn' }, '⚠ ' + w))
  if (!blocked && state.settings.finger === 0) alerts.append(el('div', { class: 'info' }, `عرض الأصبع التلقائي: ${fmt(design.finger)} مم (السماكة ${state.settings.t} مم)`))
  notesBox.innerHTML = ''
  if (design.notes.length) {
    const ul = el('ul', { class: 'tips' })
    for (const n of design.notes) ul.append(el('li', {}, n))
    notesBox.append(el('h3', {}, 'ملاحظات التجميع'), ul)
  }
  const list = el('ul', { class: 'pieces' })
  for (const pn of design.panels) list.append(el('li', {}, el('b', {}, pn.name), pn.count > 1 ? ` ×${pn.count}` : '', ` — ${fmt(pn.w)} × ${fmt(pn.h)} مم`, pn.note ? el('span', { class: 'hint' }, pn.note) : ''))
  notesBox.append(el('h3', {}, 'القطع'), list)

  actions.innerHTML = ''
  const dl = (kind: Kind, label: string, cls: string) => {
    const b = el('button', { type: 'button', class: cls, onclick: () => download(kind) }, label) as HTMLButtonElement
    if (blocked) { b.disabled = true; b.title = 'أصلح الأخطاء الحمراء أولاً' }
    return b
  }
  actions.append(dl('svg', blocked ? 'أصلح الأخطاء' : '⬇ SVG', 'primary'), dl('dxf', '⬇ DXF', 'primary alt'), dl('ai', '⬇ AI 8 (RDWorks)', 'primary ai'))
  if (!inViewer) actions.append(el('button', { type: 'button', class: 'ghost', onclick: () => share() }, '🔗 نسخ الرابط'))
  else actions.append(el('button', { type: 'button', class: 'ghost', onclick: () => saveApk() }, '📱 تطبيق أندرويد'))
}

/**
 * In the claude.ai viewer: the Android app. It is published beside the page as base64 text (the only kind of file the
 * page may carry), and saved as a .zip holding the .apk (the viewer saves .zip, not .apk).
 */
async function saveApk() {
  const dl = claudeUse ? await claudeUse('downloads').catch(() => null) : null
  if (!dl) { toast('التنزيل غير متاح في هذه النافذة'); return }
  let blob: Blob
  try {
    const r = await fetch('LaserBox-apk.b64.txt')
    if (!r.ok) throw new Error(String(r.status))
    const bin = atob((await r.text()).trim()), bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    blob = new Blob([makeZip([{ name: 'LaserBox.apk', data: bytes }])])
  } catch { toast('تعذّر جلب ملف التطبيق؛ جرّب بعد قليل'); return }
  try {
    await dl.save({ filename: 'LaserBox-apk.zip', data: blob })
    toast('حُفظ التطبيق مضغوطاً: افتح «LaserBox-apk.zip» من الملفات واستخرج منه LaserBox.apk ثم ثبّته', 9000)
  } catch (e) {
    const code = (e as { code?: string })?.code
    if (code !== 'declined') toast('تعذّر الحفظ: ' + (code ?? 'خطأ'))
  }
}

function sizeLabel(p: Record<string, number>) {
  if (p.pw !== undefined) return `صورة ${fmt(p.pw)} × ${fmt(p.ph)}`
  if (p.Dm !== undefined) return `Ø${fmt(p.Dm)} × ${fmt(p.H)}`
  if (p.Dd !== undefined) return `مرآة Ø${fmt(p.Dd)}، قاعدة ${fmt(p.W)} × ${fmt(p.D)}`
  if (p.S !== undefined && p.rd !== undefined) return `برج ${fmt(p.S)} × ${fmt(p.S)} × ${fmt(p.H)}`
  if (p.S !== undefined) return `سداسي ${fmt(p.S)} × ${fmt(p.H)}`
  if (p.PW !== undefined) return `لوح ${fmt(p.PW)} × ${fmt(p.PH)}`
  if (p.D1 !== undefined) return `${fmt(p.tiers)} طوابق، قاعدة ${fmt(p.D1)}`
  if (!Number.isFinite(p.W) || !Number.isFinite(p.D) || !Number.isFinite(p.H)) return [p.W, p.D, p.H].filter(Number.isFinite).map(fmt).join(' × ') || '—'
  return `${fmt(p.W)} × ${fmt(p.D)} × ${fmt(p.H)}${state.settings.inner ? ' (داخلي)' : ''}`
}

const stat = (k: string, v: string) => el('div', { class: 'stat' }, el('span', {}, k), el('b', {}, v))

function fitView() {
  if (!design) return
  const pad = Math.max(design.layout.w, design.layout.h) * 0.04 + 2
  view = { x: -pad, y: -pad, w: design.layout.w + 2 * pad, h: design.layout.h + 2 * pad }
  applyView()
}

function applyView() {
  // keep the aspect ratio of the on-screen box
  const r = svg.getBoundingClientRect()
  const ar = r.width && r.height ? r.width / r.height : 4 / 3
  let { x, y, w, h } = view
  if (w / h < ar) { const nw = h * ar; x -= (nw - w) / 2; w = nw } else { const nh = w / ar; y -= (nh - h) / 2; h = nh }
  svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`)
  const px = w / Math.max(1, r.width) // mm per pixel
  svg.style.setProperty('--px', String(px))
}

// pan & zoom: mouse drag / wheel, touch drag / pinch
{
  const pointers = new Map<number, { x: number; y: number }>()
  let last: { x: number; y: number } | null = null, lastDist = 0
  const toMM = () => { const r = svg.getBoundingClientRect(); return view.w / Math.max(1, r.width) }
  svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); last = { x: e.clientX, y: e.clientY }; lastDist = 0 })
  svg.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.values()]
    if (pts.length === 1 && last) {
      const s = toMM()
      view.x -= (e.clientX - last.x) * s; view.y -= (e.clientY - last.y) * s
      last = { x: e.clientX, y: e.clientY }
      applyView()
    } else if (pts.length === 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      if (lastDist) zoomAt((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2, lastDist / d)
      lastDist = d
    }
  })
  const up = (e: PointerEvent) => { pointers.delete(e.pointerId); last = null; lastDist = 0 }
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up)
  svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1.15 : 1 / 1.15) }, { passive: false })
  svg.addEventListener('dblclick', () => fitView())
  function zoomAt(cx: number, cy: number, f: number) {
    const r = svg.getBoundingClientRect()
    const vb = svg.viewBox.baseVal
    const mx = vb.x + (cx - r.left) / r.width * vb.width, my = vb.y + (cy - r.top) / r.height * vb.height
    view = { x: mx - (mx - vb.x) * f, y: my - (my - vb.y) * f, w: vb.width * f, h: vb.height * f }
    applyView()
  }
  window.addEventListener('resize', applyView)
}

// ------------------------------------------------------------------ export

function fileName(ext: string) {
  const p = params()
  // the template's own size keys, in order, skipping any it does not have
  const keys = p.pw !== undefined ? ['pw', 'ph'] : p.Dm !== undefined ? ['Dm', 'H'] : p.Dd !== undefined ? ['Dd', 'W', 'D'] : p.S !== undefined ? ['S', 'H'] : p.D1 !== undefined ? ['tiers', 'D1'] : p.PW !== undefined ? ['PW', 'PH'] : ['W', 'D', 'H']
  const dims = keys.filter(k => Number.isFinite(p[k])).map(k => fmt(p[k])).join('x') || state.tpl
  return `laser-box-${state.tpl}-${dims}-t${state.settings.t}.${ext}`
}

type Kind = 'svg' | 'dxf' | 'ai'
const MIME: Record<Kind, string> = { svg: 'image/svg+xml', dxf: 'application/dxf', ai: 'application/postscript' }
const KIND_NAME: Record<Kind, string> = { svg: 'SVG', dxf: 'DXF', ai: 'AI 8' }

async function download(kind: Kind) {
  if (!design) return
  const text = kind === 'svg' ? toSVG(design.layout) : kind === 'dxf' ? toDXF(design.layout) : toAI(design.layout, fileName('ai'))
  if (android) {
    // octet-stream keeps the name exactly as given: with a specific type some file pickers swap or add the extension
    android.save(fileName(kind), kind === 'svg' ? MIME.svg : 'application/octet-stream', text)
    toast(`اختر مكان حفظ «${fileName(kind)}»`, 4000)
    return
  }
  if (claudeUse) {
    // the viewer saves files on the page's behalf; it accepts .svg but not .dxf, so the DXF travels inside a .zip
    const dl = await claudeUse('downloads').catch(() => null)
    if (!dl) { toast('التنزيل غير متاح في هذه النافذة'); return }
    try {
      // the viewer accepts .svg but neither .dxf nor .ai, so those travel inside a .zip (with the SVG as a bonus)
      if (kind === 'svg') await dl.save({ filename: fileName('svg'), data: text })
      else await dl.save({ filename: fileName(`${kind}.zip`), data: new Blob([makeZip([{ name: fileName(kind), data: text }, { name: fileName('svg'), data: toSVG(design.layout) }])]) })
      if (kind === 'svg') toast('حُفظ ملف SVG')
      else toast(`حُفظ مضغوطاً باسم «${fileName(`${kind}.zip`)}» لأن هذه النافذة لا تسمح بملفات .${kind} مباشرة. افتحه من الملفات (فكّ الضغط) تجد ملف ${KIND_NAME[kind]} بداخله. تطبيق الـ APK يحفظه مباشرة.`, 9000)
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (code !== 'declined') toast('تعذّر الحفظ: ' + (code ?? 'خطأ'))
    }
    return
  }
  const blob = new Blob([text], { type: MIME[kind] })
  const url = URL.createObjectURL(blob)
  const a = el('a', { href: url, download: fileName(kind) })
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  toast(`نُزّل ملف ${KIND_NAME[kind]}`)
}

async function share() {
  persist()
  try {
    if (navigator.share) { await navigator.share({ title: 'تصميم صندوق ليزر', url: location.href }); return }
    await navigator.clipboard.writeText(location.href)
    toast('نُسخ رابط التصميم')
  } catch { toast('انسخ الرابط من شريط العنوان') }
}

// ------------------------------------------------------------------ go

renderGallery()
renderForm()
update(true)
window.addEventListener('hashchange', () => { const s = loadState(); Object.assign(state, s); renderGallery(); renderForm(); update(true) })

// keep an eye on the real size of the canvas for the first fit
new ResizeObserver(() => applyView()).observe(svg)

