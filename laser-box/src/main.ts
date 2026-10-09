import './style.css'
import { TEMPLATES, templateById, ParamDef, CATEGORIES, NEW_IDS } from './templates'
import { generate, Design, Settings, DEFAULT_SETTINGS } from './generate'
import { toSVG, toDXF, toAI } from './export'
import { loopToPath } from './geom'
import { makeZip } from './zip'
import { MATERIAL_INFO } from './materials'
import { scaleDesign, repair, roleOf, Change } from './scale'
import { designCost, projectTotal, sheetsFor, money, fmtUsd, fmtSyp, matches, DEFAULT_PRICING, DEFAULT_SHEET, MAIN, Pricing, Currency, materialLabel, DesignCost } from './cost'

// Inside the claude.ai viewer the page cannot start downloads itself and the link hash carries no state.
type ClaudeUse = (name: string) => Promise<{ save(r: { filename: string; data: string | Blob }): Promise<unknown> } | null>
const claudeUse: ClaudeUse | null = typeof (window as unknown as { claude?: { use?: ClaudeUse } }).claude?.use === 'function' ? (window as unknown as { claude: { use: ClaudeUse } }).claude.use : null
const inViewer = claudeUse !== null
// Inside the Android app the shell saves files through the system file dialog.
type AndroidBridge = { save(filename: string, mime: string, text: string): void }
const android: AndroidBridge | null = (window as unknown as { LaserAndroid?: AndroidBridge }).LaserAndroid ?? null

// ------------------------------------------------------------------ state

/** a design put in the project, with the numbers it was costed at */
interface ProjectItem { id: string; tpl: string; name: string; size: string; params: Record<string, number>; settings: Settings; qty: number }
interface State { tpl: string; params: Record<string, Record<string, number>>; settings: Settings; labels: boolean; pricing: Pricing; project: ProjectItem[]; qty: Record<string, number> }

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
  const base: State = { tpl: TEMPLATES[0].id, params: {}, settings: { ...DEFAULT_SETTINGS }, labels: true, pricing: { ...DEFAULT_PRICING, sheets: { ...DEFAULT_PRICING.sheets } }, project: [], qty: {} }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      Object.assign(base, saved, {
        settings: { ...DEFAULT_SETTINGS, ...saved.settings },
        pricing: { ...DEFAULT_PRICING, ...(saved.pricing ?? {}), sheets: { ...DEFAULT_PRICING.sheets, ...(saved.pricing?.sheets ?? {}) } },
        project: Array.isArray(saved.project) ? saved.project.filter((it: ProjectItem) => TEMPLATES.some(t => t.id === it.tpl)) : [],
        qty: saved.qty ?? {},
      })
    }
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

/** A choice among a few kinds, as a row of buttons (the number field's place for params with option labels). */
function choiceField(def: ParamDef, value: number, onChange: (v: number) => void): HTMLElement {
  const seg = el('div', { class: 'segmented choice', role: 'group', 'aria-label': def.label })
  def.options!.forEach((label, i) => {
    const v = def.min + i
    seg.append(el('button', { type: 'button', class: Math.round(value) === v ? 'on' : '', 'aria-pressed': String(Math.round(value) === v), onclick: () => onChange(v) }, label))
  })
  const wrap = el('div', { class: 'field' }, el('span', { class: 'field-label' }, def.label), seg)
  if (def.hint) wrap.append(el('span', { class: 'hint' }, def.hint))
  return wrap
}

function numberField(def: ParamDef, value: number, onChange: (v: number) => void, idPrefix = 'f'): HTMLElement {
  if (def.options?.length === def.max - def.min + 1) return choiceField(def, value, v => { onChange(v); renderForm() })
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
  el('div', { class: 'brand' }, el('span', { class: 'logo', 'aria-hidden': 'true' }, '▣'), el('div', {}, el('h1', {}, 'صناديق الليزر'), el('p', {}, 'صمّم، سعّر، ونزّل ملفاً جاهزاً للقص'))),
  el('div', { class: 'top-tools' },
    el('button', { type: 'button', class: 'icon-btn', title: 'ابحث عن منتج', 'aria-label': 'بحث', onclick: () => openChooser(true) }, '🔍'),
    el('button', { type: 'button', class: 'icon-btn', title: 'أسعار الألواح وسعر الصرف', 'aria-label': 'الأسعار والعملة', onclick: () => openPricing() }, '💲'),
  ),
)
const gallery = el('nav', { class: 'picker', 'aria-label': 'التصميم المختار' })
const chooser = el('dialog', { class: 'chooser', 'aria-label': 'اختر التصميم' }) as HTMLDialogElement
const quick = el('section', { class: 'quick', 'aria-label': 'القياسات الأساسية' })
const scaler = el('details', { class: 'scaler' }) as HTMLDetailsElement
const form = el('aside', { class: 'form' })
const previewWrap = el('section', { class: 'preview' })
const svgNS = 'http://www.w3.org/2000/svg'
const svg = document.createElementNS(svgNS, 'svg')
svg.setAttribute('class', 'canvas')
const stats = el('div', { class: 'stats' })
const alerts = el('div', { class: 'alerts' })
const notesBox = el('div', { class: 'notes' })
const costBox = el('section', { class: 'cost', 'aria-label': 'التكلفة' })
const priceDlg = el('dialog', { class: 'chooser pricing', 'aria-label': 'الأسعار والعملة' }) as HTMLDialogElement
const actions = el('div', { class: 'actions' })
previewWrap.append(stats, alerts, el('div', { class: 'canvas-wrap' }, svg, el('div', { class: 'canvas-tools' }, el('button', { type: 'button', class: 'tool', onclick: () => fitView(), title: 'ملاءمة' }, '⤢'), el('button', { type: 'button', class: 'tool', onclick: () => { state.labels = !state.labels; persist(); render() }, title: 'الأسماء' }, 'Aa'))), actions)
document.body.append(chooser, priceDlg)
app.append(header, gallery, quick, scaler, el('div', { class: 'work' }, form, previewWrap), costBox, notesBox, el('footer', { class: 'foot' }, 'الملفات بالمليمتر. افتح SVG أو DXF في LightBurn أو RDWorks أو Inkscape، وتأكّد أن القياس 1:1 قبل القص. · الإصدار 1.7'))

// ------------------------------------------------------------------ gallery

const iconSvg = (icon: string) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${icon}</svg>`
let chooserCat = '', chooserQuery = ''

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

function openChooser(focusSearch = false) {
  chooserCat = CATEGORIES.find(c => c.ids.includes(state.tpl))?.id ?? ''
  chooserQuery = ''
  renderChooser()
  chooser.showModal()
  if (focusSearch) chooser.querySelector<HTMLInputElement>('.search')?.focus()
  else {
    chooser.querySelector<HTMLElement>('.card.active')?.scrollIntoView({ block: 'nearest' })
    chooser.querySelector<HTMLElement>('.chip.on')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }
}

const categoryOf = (id: string) => CATEGORIES.find(c => c.ids.includes(id))

/** The sheet of every design: a search box, the groups as chips, and the cards (the search looks across every group). */
function renderChooser() {
  chooser.innerHTML = ''
  const search = el('input', { class: 'search', type: 'search', placeholder: 'ابحث باسم المنتج: مبخرة، درع، كوستر…', 'aria-label': 'بحث', autocomplete: 'off', value: chooserQuery }) as HTMLInputElement
  const head = el('div', { class: 'chooser-head' },
    el('div', { class: 'chooser-title' }, el('h2', {}, 'اختر التصميم'), el('button', { type: 'button', class: 'tool', 'aria-label': 'إغلاق', onclick: () => chooser.close() }, '✕')),
    search)
  const chips = el('div', { class: 'chips', role: 'tablist' })
  const grid = el('div', { class: 'grid' })
  const empty = el('p', { class: 'empty' })
  const fill = () => {
    chips.innerHTML = ''; grid.innerHTML = ''; empty.textContent = ''
    const q = chooserQuery.trim()
    for (const c of [{ id: '', name: 'الكل', ids: TEMPLATES.map(x => x.id) }, ...CATEGORIES]) {
      const on = !q && c.id === chooserCat
      const b = el('button', { type: 'button', role: 'tab', class: 'chip' + (on ? ' on' : ''), 'aria-selected': String(on), onclick: () => { chooserCat = c.id; chooserQuery = ''; search.value = ''; fill() } }, `${c.name} `, el('small', {}, String(c.ids.length)))
      chips.append(b)
    }
    const ids = q ? TEMPLATES.filter(t => matches(q, t.name, t.desc, categoryOf(t.id)?.name ?? '')).map(t => t.id) : chooserCat ? CATEGORIES.find(c => c.id === chooserCat)!.ids : CATEGORIES.flatMap(c => c.ids)
    for (const id of ids) {
      const t = templateById(id)
      const card = el('button', { type: 'button', class: 'card' + (t.id === state.tpl ? ' active' : ''), 'aria-pressed': String(t.id === state.tpl), title: t.desc })
      card.innerHTML = `${iconSvg(t.icon)}<span></span>${NEW_IDS.includes(t.id) ? '<i class="badge">جديد</i>' : ''}`
      card.querySelector('span')!.textContent = t.name
      if (q) card.append(el('small', { class: 'card-cat' }, categoryOf(t.id)?.name ?? ''))
      card.onclick = () => { state.tpl = t.id; lastAction = null; lastEdited = null; persist(); chooser.close(); renderGallery(); renderForm(); update(true) }
      grid.append(card)
    }
    if (q && !ids.length) empty.textContent = `لا يوجد منتج باسم «${q}». جرّب كلمة أقصر، أو تصفّح الأقسام.`
  }
  search.oninput = () => { chooserQuery = search.value; fill() }
  search.onkeydown = e => { if ((e as KeyboardEvent).key === 'Escape') { search.value = ''; chooserQuery = ''; fill(); e.stopPropagation() } }
  fill()
  chooser.append(head, chips, empty, grid)
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
  for (const def of t.params.filter(d => ['W', 'D', 'H', 'Dm', 'S', 'pw', 'ph', 'border'].includes(d.key))) row.append(numberField(def, cur[def.key], v => setParam(def.key, v), 'q'))
  row.append(numberField(SETTING_DEFS[0], state.settings.t, v => { state.settings.t = v; persist(); update() }, 'q'))
  const foot = el('div', { class: 'quick-foot' },
    el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'الخامة', el('small', {}, `kerf ${state.settings.kerf} مم`)), materialPicker()),
    el('button', { type: 'button', class: 'more', onclick: () => form.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, '⚙ كل الإعدادات (الخلوص، المحور، عرض الأصبع…)'),
  )
  // the design's choices (the box's wall, the base, the plaque's shape) where they are seen first
  const choices = t.params.filter(d => d.options?.length === d.max - d.min + 1)
  quick.append(row, ...choices.map(def => el('div', { class: 'quick-choice' }, choiceField(def, cur[def.key], v => { setParam(def.key, v); renderForm() }))), foot)
}

function renderForm() {
  renderQuick()
  renderScaler()
  const t = tpl()
  form.innerHTML = ''
  form.append(el('h2', {}, t.name), el('p', { class: 'desc' }, t.desc))
  const dims = el('details', { class: 'section', open: '' }, el('summary', {}, 'القياسات والخيارات'))
  const seg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'نوع القياسات' })
  for (const [val, label] of [[false, 'خارجية'], [true, 'داخلية']] as const) {
    const b = el('button', { type: 'button', class: state.settings.inner === val ? 'on' : '' }, label)
    b.onclick = () => { state.settings.inner = val; persist(); renderForm(); update() }
    seg.append(b)
  }
  dims.append(el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'القياسات المدخلة'), seg, el('span', { class: 'hint' }, state.settings.inner ? 'الأبعاد هي الفراغ الداخلي؛ تُضاف السماكات تلقائياً' : 'الأبعاد هي الحجم الخارجي للصندوق')))
  const cur = params()
  for (const def of t.params) dims.append(numberField(def, cur[def.key], v => setParam(def.key, v)))
  const mat = el('details', { class: 'section', ...(window.innerWidth > 860 ? { open: '' } : {}) }, el('summary', {}, 'الخامة والقص'))
  mat.append(el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'نوع الخامة'), materialPicker(), el('span', { class: 'hint' }, 'يضبط عرض الشقّ المعتاد؛ اكتب السماكة المقاسة بالقدمة في الخانة أدناه')))
  mat.append(el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'سماكات شائعة (مم)'), thicknessPicker(), el('span', { class: 'hint' }, 'اختر سماكة لوحك، أو اكتب المقاسة بالقدمة في «سماكة الخامة»')))
  for (const def of SETTING_DEFS) mat.append(numberField(def, (state.settings as unknown as Record<string, number>)[def.key], v => { (state.settings as unknown as Record<string, number>)[def.key] = v; persist(); update() }))
  const reset = el('button', { type: 'button', class: 'link' }, 'إعادة القيم الافتراضية')
  reset.onclick = () => { lastAction = null; state.params[state.tpl] = {}; state.settings = { ...DEFAULT_SETTINGS }; persist(); renderForm(); update(true) }
  form.append(dims, mat, reset)
}

// ------------------------------------------------------------------ scale the whole design, and repair errors

/** the field the user set last: the automatic repair leaves it as they typed it */
let lastEdited: string | null = null
/** what the last scale or repair did, shown above the drawing with a way back */
let lastAction: { tpl: string; title: string; ok: boolean; changes: Change[]; clamped: Change[]; kept: string; undo: Record<string, number> } | null = null
let scaleObjects = false

function setParam(key: string, v: number) {
  (state.params[state.tpl] ??= {})[key] = v
  lastEdited = key
  lastAction = null
  persist(); update()
}

/** Run a slow search after the page has had a moment to show that it is busy. */
function busy(msg: string, job: () => void) {
  const b = el('div', { class: 'busy' }, msg)
  document.body.append(b)
  setTimeout(() => { try { job() } finally { b.remove() } }, 40)
}

function renderScaler() {
  const t = tpl(), cur = params()
  const lens = t.params.filter(d => roleOf(t, d) === 'length' && cur[d.key] > 0)
  const objs = t.params.filter(d => roleOf(t, d) === 'object')
  const open = scaler.open
  scaler.innerHTML = ''
  scaler.hidden = !lens.length && !objs.length
  if (scaler.hidden) return
  scaler.append(el('summary', {}, el('b', {}, '📐 تصغير أو تكبير التصميم كاملاً'), el('small', {}, 'كل القياسات معاً، والشقوق تبقى على سماكة اللوح')))
  const presets = el('div', { class: 'scale-presets', role: 'group', 'aria-label': 'نسبة الحجم' })
  for (const pc of [50, 60, 70, 75, 80, 90, 110, 125, 150]) presets.append(el('button', { type: 'button', class: pc < 100 ? 'down' : 'up', onclick: () => doScale(pc / 100, `${pc}% من حجمه`) }, `${pc}%`))
  // a size the customer asked for, on one of the big dimensions
  const biggest = Math.max(1, ...lens.map(d => cur[d.key]))
  const mains = lens.filter(d => cur[d.key] >= 0.4 * biggest)
  const sel = el('select', { 'aria-label': 'القياس' }) as HTMLSelectElement
  for (const d of mains) sel.append(el('option', { value: d.key }, `${d.label} (الآن ${fmt(cur[d.key])})`))
  const target = el('input', { type: 'number', inputmode: 'decimal', placeholder: 'مم', 'aria-label': 'القياس المطلوب بالمليمتر' }) as HTMLInputElement
  const go = () => {
    // the value now, not when the panel was drawn: the field may have been typed in since
    const d = mains.find(m => m.key === sel.value), v = parseFloat(target.value), now = params()[d?.key ?? '']
    if (!d || !(v > 0) || !(now > 0)) { toast('اكتب القياس المطلوب بالمليمتر'); return }
    doScale(v / now, `${d.label} ${fmt(v)} مم`, d.key)
  }
  target.onkeydown = e => { if ((e as KeyboardEvent).key === 'Enter') go() }
  const body = el('div', { class: 'scale-body' },
    el('span', { class: 'field-label' }, 'نسبة من الحجم الحالي'), presets,
  )
  if (mains.length) body.append(el('span', { class: 'field-label' }, 'أو قياس محدّد يطلبه الزبون'), el('div', { class: 'scale-target' }, sel, target, el('button', { type: 'button', class: 'go', onclick: go }, 'طبّق')))
  if (objs.length) {
    const box = el('input', { type: 'checkbox' }) as HTMLInputElement
    box.checked = scaleObjects
    box.onchange = () => { scaleObjects = box.checked }
    body.append(el('label', { class: 'scale-obj' }, box, el('span', {}, `غيّر معها أيضاً: ${objs.map(d => `${d.label} (${fmt(cur[d.key])})`).join('، ')}`, el('small', {}, 'هذه قياسات أشياء حقيقية فتبقى ثابتة عادةً. فعّلها فقط إن كان عندك منها بالمقاس الجديد، ثم صحّح أرقامها بالقدمة.'))))
  }
  body.append(el('span', { class: 'hint' }, 'لا تصغّر ملف القصّ في RDWorks أو غيره: الشقوق والأصابع تصغر معه فتصبح أضيق من سماكة اللوح ولا تدخل القطع. صغّر من هنا، فتتغيّر القياسات وتبقى الشقوق على سماكتك وتُصحَّح التعشيقات.'))
  scaler.append(body)
  scaler.open = open
}

/** Scale the design by f; a size the customer asked for (`keep`) stays as typed unless nothing can be cut that way. */
function doScale(f: number, what: string, keep?: string) {
  const t = tpl(), before = params()
  busy('جارٍ تغيير الحجم…', () => {
    let r = scaleDesign(t, state.settings, before, f, scaleObjects, 2500, keep ? [keep] : [])
    let kept = ''
    if (keep && !r.ok) {
      const r2 = scaleDesign(t, state.settings, before, f, scaleObjects)
      if (r2.ok) { r = r2; kept = `لم يمكن إبقاء ${t.params.find(d => d.key === keep)?.label ?? keep} على ${what.split(' ').pop()} بالضبط مع باقي القياسات؛ هذا أقرب تصميم يصلح للقص.` }
    }
    state.params[state.tpl] = { ...r.params }
    const objs = t.params.filter(d => roleOf(t, d) === 'object')
    lastAction = {
      tpl: t.id, ok: r.ok,
      title: `${f < 1 ? 'صُغّر' : 'كُبّر'} التصميم: ${what}`,
      changes: r.changes, clamped: r.clamped,
      kept: [kept, objs.length && !scaleObjects ? `بقيت كما هي: ${objs.map(d => `${d.label} ${fmt(before[d.key])}`).join('، ')}.` : ''].filter(Boolean).join(' '),
      undo: before,
    }
    persist(); renderForm(); update()
    alerts.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

function doRepair() {
  const t = tpl(), before = params()
  busy('جارٍ البحث عن أقرب قياسات تصلح للقص…', () => {
    const n0 = generate(t, before, state.settings).errors.length
    // keep the field the user set last as typed, unless leaving it free gives a much smaller change (or the only fix)
    let r = repair(t, state.settings, before, { locked: lastEdited ? [lastEdited] : [] })
    if (lastEdited) {
      const r2 = repair(t, state.settings, before)
      if ((r2.ok && !r.ok) || (r2.ok === r.ok && (r2.errors.length < r.errors.length || r2.cost < 0.5 * r.cost))) r = r2
    }
    if (!r.changes.length || r.errors.length >= n0) { toast('لم أجد تصحيحاً تلقائياً لهذا الخطأ: اقرأ الرسالة الحمراء وغيّر القياس المذكور فيها', 6000); return }
    state.params[state.tpl] = { ...r.params }
    lastAction = { tpl: t.id, ok: r.ok, title: r.ok ? 'صُحّح التصميم تلقائياً' : 'صُحّح جزء من الأخطاء تلقائياً', changes: r.changes, clamped: [], kept: '', undo: before }
    persist(); renderForm(); update()
  })
}

function actionBox(a: NonNullable<typeof lastAction>): HTMLElement {
  const box = el('div', { class: a.ok ? 'done' : 'done partial' }, el('b', {}, (a.ok ? '✓ ' : '⚠ ') + a.title), el('div', {}, `القياس الآن: ${sizeLabel(params())}`))
  if (!a.ok) box.append(el('div', {}, 'بقيت أخطاء (في المربّع الأحمر تحت): لا تقصّ قبل أن تصلحها، أو تراجع.'))
  if (a.changes.length) {
    const t = tpl(), ul = el('ul', {})
    for (const c of a.changes) {
      const def = t.params.find(d => d.key === c.key), role = def ? roleOf(t, def) : 'length'
      const what = role === 'toggle' ? (c.to ? `أُضيف: ${c.label}` : `أُلغي: ${c.label}`) : `${c.label}: ${fmt(c.from)} ← ${fmt(c.to)}`
      ul.append(el('li', {}, what, c.why ? el('small', {}, `لأن: ${c.why}`) : ''))
    }
    box.append(el('div', {}, a.title.startsWith('صُحّح') ? 'غيّرتُ:' : 'وعدّلتُ هذه ليبقى التصميم سليماً للقص:'), ul)
  }
  if (a.clamped.length) box.append(el('div', { class: 'hint' }, `وصلت إلى حدّها المسموح: ${a.clamped.map(c => `${c.label} ${fmt(c.to)} بدل ${fmt(c.from)}`).join('، ')}.`))
  if (a.kept) box.append(el('div', { class: 'hint' }, a.kept))
  box.append(el('button', { type: 'button', class: 'link', onclick: () => { state.params[state.tpl] = { ...a.undo }; lastAction = null; persist(); renderForm(); update() } }, '↶ تراجع'))
  return box
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
  const cost = designCost(design.panels, state.settings.spacing, state.pricing)
  stats.innerHTML = ''
  stats.append(
    stat('القطع', String(design.pieceCount)),
    stat('اللوح المطلوب', `${fmt(lay.w)} × ${fmt(lay.h)} مم`),
    stat('طول القصّ', `${fmt(design.cutLength / 1000)} م`),
    stat('القياس', sizeLabel(p)),
    stat('تكلفة القطعة', design.errors.length ? '—' : cost.problems.length ? 'لا تتّسع على اللوح' : twoLines(cost.perSet), 'money'),
  )
  renderCost(cost)
  alerts.innerHTML = ''
  if (lastAction?.tpl === state.tpl) alerts.append(actionBox(lastAction))
  const blocked = design.errors.length > 0
  if (blocked) alerts.append(el('div', { class: 'error' }, el('b', {}, 'لا تقصّ هذا الملف: '), ...design.errors.map(e => el('div', {}, '✕ ' + e)),
    el('button', { type: 'button', class: 'fix', onclick: () => doRepair() }, '🔧 صحّح تلقائياً'),
    el('span', { class: 'hint' }, 'يغيّر أقلّ ما يمكن من القياسات (وإن لم يكفِ ذلك قد يُلغي جزءاً صغيراً)، ويترك السماكة والخلوص وقياسات الأغراض (الصحن، الصورة…) كما هي، ويمكنك التراجع.')))
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
  if (state.tpl.startsWith('trophy')) return `درع ${fmt(p.H)} مم، قاعدة ${fmt(p.W)} × ${fmt(p.D)}`
  if (state.tpl.startsWith('coasterset')) return `${fmt(p.nc)} كوستر ${fmt(p.S)} × ${fmt(p.S)}`
  if (p.pw !== undefined) return `صورة ${fmt(p.pw)} × ${fmt(p.ph)}`
  if (p.Dm !== undefined) return `Ø${fmt(p.Dm)} × ${fmt(p.H)}`
  if (p.Dd !== undefined) return `مرآة Ø${fmt(p.Dd)}، قاعدة ${fmt(p.W)} × ${fmt(p.D)}`
  if (p.Wb !== undefined) return `خواتم ${fmt(p.W)} × ${fmt(p.D)} · كبير ${fmt(p.Wb)} × ${fmt(p.Db)}`
  if (p.S !== undefined && p.rd !== undefined) return `برج ${fmt(p.S)} × ${fmt(p.S)} × ${fmt(p.H)}`
  if (p.S !== undefined && p.H !== undefined) return `سداسي ${fmt(p.S)} × ${fmt(p.H)}`
  if (p.S !== undefined) return `المقاس ${fmt(p.S)}`
  if (p.PW !== undefined) return `لوح ${fmt(p.PW)} × ${fmt(p.PH)}`
  if (p.D1 !== undefined) return `${fmt(p.tiers)} طوابق، قاعدة ${fmt(p.D1)}`
  if (!Number.isFinite(p.W) || !Number.isFinite(p.D) || !Number.isFinite(p.H)) return [p.W, p.D, p.H].filter(Number.isFinite).map(fmt).join(' × ') || '—'
  return `${fmt(p.W)} × ${fmt(p.D)} × ${fmt(p.H)}${state.settings.inner ? ' (داخلي)' : ''}`
}

/** a tile; a value with line breaks is shown line by line (a price in two currencies) */
const stat = (k: string, v: string, cls = '') => el('div', { class: 'stat' + (cls ? ' ' + cls : '') }, el('span', {}, k), el('b', {}, ...v.split('\n').flatMap((line, i) => (i ? [el('br'), line] : [line]))))

// ------------------------------------------------------------------ cost: this design, a quantity, and the project

const qtyOf = () => Math.max(1, Math.round(state.qty[state.tpl] ?? 1))
/** "$3.67 · 40,370 ل.س" from a price in the input currency, each currency kept in its own direction */
const both = (v: number) => { const m = money(state.pricing, v); return el('span', { class: 'money2' }, el('span', { dir: 'ltr' }, fmtUsd(m.usd)), ' · ', el('span', {}, fmtSyp(m.syp))) }
const twoLines = (v: number) => { const m = money(state.pricing, v); return `${fmtUsd(m.usd)}\n${fmtSyp(m.syp)}` }
const costCache = new Map<string, DesignCost | null>()
/** a project item's cost at the numbers it was added with (the sheet prices as they are now) */
function itemCost(it: ProjectItem): DesignCost | null {
  const key = JSON.stringify([it.tpl, it.params, it.settings, state.pricing])
  if (costCache.has(key)) return costCache.get(key)!
  let c: DesignCost | null = null
  try { const d = generate(templateById(it.tpl), it.params, it.settings); c = d.errors.length ? null : designCost(d.panels, it.settings.spacing, state.pricing) } catch { c = null }
  if (costCache.size > 200) costCache.clear()
  costCache.set(key, c)
  return c
}

function renderCost(cost: DesignCost) {
  costBox.innerHTML = ''
  const pr = state.pricing, qty = qtyOf(), ok = !!design && !design.errors.length && !cost.problems.length
  costBox.append(el('div', { class: 'cost-head' }, el('h3', {}, '💲 التكلفة'), el('button', { type: 'button', class: 'link', onclick: () => openPricing() }, '⚙ أسعار الألواح وسعر الصرف')))
  // one set: each material's share of its sheet
  const tbl = el('table', { class: 'cost-table' })
  tbl.append(el('thead', {}, el('tr', {}, el('th', {}, 'الخامة'), el('th', {}, 'اللوح'), el('th', {}, 'يطلع من اللوح'), el('th', {}, 'حصّة القطعة'))))
  const tb = el('tbody', {})
  for (const part of cost.parts) {
    const sh = part.sheet
    tb.append(el('tr', {},
      el('td', {}, el('b', {}, part.label), el('small', {}, `${part.pieces} ${part.pieces === 1 ? 'قطعة' : part.pieces === 2 ? 'قطعتان' : part.pieces <= 10 ? 'قطع' : 'قطعة'}`)),
      el('td', {}, `${fmt(sh.w)} × ${fmt(sh.h)} سم`, el('small', {}, both(sh.price))),
      el('td', {}, part.nest.sets > 0 ? el('b', {}, String(part.nest.sets)) : el('b', { class: 'bad' }, 'لا يتّسع'), part.nest.sets > 0 ? el('small', {}, `استغلال ${Math.round((100 * part.nest.area * part.nest.sets) / part.nest.sheetArea)}٪${part.nest.turned ? '، بالعرض' : ''}`) : ''),
      el('td', {}, part.nest.sets > 0 ? el('b', {}, both(part.perSet)) : '—'),
    ))
  }
  tbl.append(tb)
  costBox.append(tbl)
  for (const pb of cost.problems) costBox.append(el('div', { class: 'warn' }, `⚠ ${pb}: كبّر اللوح في الأسعار أو صغّر التصميم.`))
  if (design?.errors.length) costBox.append(el('div', { class: 'hint' }, 'التصميم فيه أخطاء، فالتكلفة تقريبية حتى تُصلح.'))
  // a quantity
  const q = el('div', { class: 'cost-qty' })
  q.append(numberField({ key: 'qty', label: 'عدد القطع المطلوبة', min: 1, max: 10000, step: 1, int: true }, qty, v => { state.qty[state.tpl] = v; persist(); renderCost(cost) }, 'c'))
  const totals = el('div', { class: 'cost-totals' })
  if (ok) {
    const whole = cost.parts.map(part => ({ part, ...sheetsFor(part, qty) }))
    const wholeCost = whole.reduce((s, w) => s + w.sheets * w.part.sheet.price, 0)
    totals.append(
      stat('القطعة الواحدة', twoLines(cost.perSet)),
      stat(`${qty} ${qty === 1 ? 'قطعة' : qty === 2 ? 'قطعتان' : qty <= 10 ? 'قطع' : 'قطعة'} (حصّتها من الألواح)`, twoLines(cost.perSet * qty)),
      stat('ألواح تشتريها كاملة', `${whole.map(w => `${w.sheets} ${w.part.label}`).join(' + ')}\n${twoLines(wholeCost)}`),
    )
    const left = whole.filter(w => w.leftover > 0).map(w => `يبقى من ${w.part.label} ما يكفي لـ ${w.leftover} أخرى`).join('، ')
    if (left) totals.append(el('div', { class: 'hint' }, left + '.'))
  }
  q.append(totals)
  costBox.append(q)
  const add = el('button', { type: 'button', class: 'add-project', onclick: () => {
    if (!ok) { toast('أصلح التصميم أولاً ثم أضفه'); return }
    state.project.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, tpl: state.tpl, name: tpl().name, size: sizeLabel(params()), params: { ...params() }, settings: { ...state.settings }, qty })
    persist(); renderCost(cost); toast('أُضيف إلى المشروع')
  } }, '＋ أضف هذه القطعة إلى المشروع')
  costBox.append(add)
  // the project: every design added, on the sheets they share
  costBox.append(renderProject())
  costBox.append(el('p', { class: 'hint' }, `التكلفة هي حصّة القطعة من اللوح بحسب الرصّ (${fmt(state.settings.spacing)} مم بين القطع)، بلا وقت القص والكهرباء والتغليف. سعر الصرف ${fmtSyp(pr.rate)} للدولار؛ غيّره من ⚙.`))
}

function renderProject(): HTMLElement {
  const box = el('div', { class: 'project' })
  const items = state.project
  box.append(el('h3', {}, `🧾 المشروع`, el('small', {}, items.length ? ` ${items.length} ${items.length === 1 ? 'قطعة' : items.length === 2 ? 'قطعتان' : items.length <= 10 ? 'قطع' : 'قطعة'}` : ' فارغ')))
  if (!items.length) { box.append(el('p', { class: 'hint' }, 'أضف القطع التي يطلبها الزبون واحدة بعد الأخرى (من أي تصميم)، فتُحسب تكلفة المشروع كلّه وكم لوحاً من كل خامة تحتاج.')); return box }
  const tbl = el('table', { class: 'cost-table' })
  tbl.append(el('thead', {}, el('tr', {}, el('th', {}, 'القطعة'), el('th', {}, 'العدد'), el('th', {}, 'الواحدة'), el('th', {}, 'المجموع'), el('th', {}, ''))))
  const tb = el('tbody', {})
  const lines: { name: string; qty: number; cost: DesignCost }[] = []
  for (const it of items) {
    const c = itemCost(it)
    if (c && !c.problems.length) lines.push({ name: it.name, qty: it.qty, cost: c })
    const setQty = (v: number) => { it.qty = Math.max(1, Math.round(v)); persist(); design && renderCost(designCost(design.panels, state.settings.spacing, state.pricing)) }
    tb.append(el('tr', {},
      el('td', {}, el('button', { type: 'button', class: 'linkish', title: 'افتح هذه القطعة', onclick: () => { state.tpl = it.tpl; state.params[it.tpl] = { ...it.params }; state.settings = { ...it.settings }; lastAction = null; lastEdited = null; persist(); renderGallery(); renderForm(); update(true); window.scrollTo({ top: 0, behavior: 'smooth' }) } }, it.name), el('small', {}, `${it.size} · ${it.settings.t} مم`)),
      el('td', { class: 'qty' }, el('button', { type: 'button', class: 'bump', onclick: () => setQty(it.qty - 1) }, '−'), el('b', {}, String(it.qty)), el('button', { type: 'button', class: 'bump', onclick: () => setQty(it.qty + 1) }, '+')),
      el('td', {}, c ? (c.problems.length ? el('span', { class: 'bad' }, 'لا يتّسع') : both(c.perSet)) : el('span', { class: 'bad' }, 'فيها خطأ')),
      el('td', {}, c && !c.problems.length ? el('b', {}, both(c.perSet * it.qty)) : '—'),
      el('td', {}, el('button', { type: 'button', class: 'tool small', 'aria-label': 'احذف', onclick: () => { state.project = state.project.filter(x => x.id !== it.id); persist(); design && renderCost(designCost(design.panels, state.settings.spacing, state.pricing)) } }, '✕')),
    ))
  }
  tbl.append(tb)
  box.append(tbl)
  const t = projectTotal(lines, state.pricing)
  const totals = el('div', { class: 'cost-totals' },
    stat('تكلفة المشروع (حصّة من الألواح)', twoLines(t.cost)),
    stat('ألواح تشتريها كاملة', t.materials.length ? `${t.materials.map(m => `${m.sheets} ${m.label}`).join(' + ')}\n${twoLines(t.whole)}` : '—'),
  )
  box.append(totals)
  if (t.materials.length) box.append(el('div', { class: 'hint' }, t.materials.map(m => `${m.label}: ${(Math.round(m.fraction * 100) / 100).toLocaleString('en-US')} لوح من ${fmt(m.sheet.w)} × ${fmt(m.sheet.h)} سم`).join('، ') + '.'))
  box.append(el('button', { type: 'button', class: 'link', onclick: () => { if (confirm('تفريغ المشروع كلّه؟')) { state.project = []; persist(); design && renderCost(designCost(design.panels, state.settings.spacing, state.pricing)) } } }, 'تفريغ المشروع'))
  return box
}

// ------------------------------------------------------------------ prices and the exchange rate, for the whole app

function openPricing() { renderPricing(); priceDlg.showModal() }

function renderPricing() {
  priceDlg.innerHTML = ''
  const pr = state.pricing
  const rerender = () => { persist(); if (design) render() }
  const head = el('div', { class: 'chooser-head' }, el('div', { class: 'chooser-title' }, el('h2', {}, 'الأسعار والعملة'), el('button', { type: 'button', class: 'tool', 'aria-label': 'إغلاق', onclick: () => priceDlg.close() }, '✕')))
  const body = el('div', { class: 'pricing-body' })
  // the exchange rate, used everywhere
  body.append(el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'سعر صرف الدولار اليوم', el('small', {}, 'ليرة سورية لكل دولار')),
    el('div', { class: 'field-ctl' }, el('input', { type: 'number', inputmode: 'decimal', min: '1', step: '1', value: String(pr.rate), onchange: (e: Event) => { const v = parseFloat((e.target as HTMLInputElement).value); if (v > 0) { pr.rate = v; rerender(); renderPricing() } } })),
    el('span', { class: 'hint' }, `كل الأسعار تُعرض بالدولار وبالليرة معاً على هذا السعر. الآن: $1 = ${fmtSyp(pr.rate)}.`)))
  // the currency the sheet prices are typed in
  const seg = el('div', { class: 'segmented', role: 'group' })
  for (const [cur, label] of [['USD', 'بالدولار $'], ['SYP', 'بالليرة ل.س']] as [Currency, string][]) {
    seg.append(el('button', { type: 'button', class: pr.currency === cur ? 'on' : '', onclick: () => {
      if (pr.currency === cur) return
      // the prices keep their worth: converted to the new currency
      for (const sh of Object.values(pr.sheets)) sh.price = Math.round((cur === 'SYP' ? sh.price * pr.rate : sh.price / pr.rate) * 100) / 100
      pr.currency = cur; rerender(); renderPricing()
    } }, label))
  }
  body.append(el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'أسعار الألواح مكتوبة'), seg))
  // every sheet: the main one and one per other material
  const used = new Set(design?.panels.map(p => p.material ?? MAIN) ?? [])
  const tbl = el('table', { class: 'pr-table' })
  tbl.append(el('thead', {}, el('tr', {}, el('th', {}, 'اللوح'), el('th', {}, 'عرض سم'), el('th', {}, 'طول سم'), el('th', {}, `السعر ${pr.currency === 'USD' ? '$' : 'ل.س'}`))))
  const tb = el('tbody', {})
  const cell = (v: number, min: number, step: number, set: (v: number) => void) => el('td', {}, el('input', { type: 'number', inputmode: 'decimal', min: String(min), step: String(step), value: String(v), onchange: (e: Event) => { const n = parseFloat((e.target as HTMLInputElement).value); if (Number.isFinite(n) && n >= min) { set(n); rerender() } else (e.target as HTMLInputElement).value = String(v) } }))
  for (const m of [MAIN, ...Object.keys(MATERIAL_INFO)]) {
    const sh = (pr.sheets[m] ??= { ...DEFAULT_SHEET, price: pr.currency === 'USD' ? DEFAULT_SHEET.price : Math.round(DEFAULT_SHEET.price * pr.rate) })
    tb.append(el('tr', { class: used.has(m) ? 'used' : '' },
      el('td', {}, el('b', {}, materialLabel(m)), used.has(m) ? el('small', {}, 'في هذا التصميم') : ''),
      cell(sh.w, 5, 1, v => { sh.w = v }), cell(sh.h, 5, 1, v => { sh.h = v }), cell(sh.price, 0, pr.currency === 'USD' ? 0.5 : 100, v => { sh.price = v }),
    ))
  }
  tbl.append(tb)
  body.append(el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'الألواح وأسعارها'), tbl,
    el('span', { class: 'hint' }, 'اللوح الشائع 122 × 244 سم. اكتب سعر كل لوح كما تشتريه؛ الأكريليك الذهبي والمرآة والشفّاف لكلٍّ سعره، وهذه الأسعار تُحفظ وتُستعمل في كل التصاميم.')))
  body.append(el('button', { type: 'button', class: 'link', onclick: () => { state.pricing = { ...DEFAULT_PRICING, rate: pr.rate, sheets: { ...DEFAULT_PRICING.sheets } }; rerender(); renderPricing() } }, 'إعادة الأسعار الافتراضية (122 × 244 سم بـ $11)'))
  priceDlg.append(head, body)
}
priceDlg.addEventListener('click', e => { if (e.target === priceDlg) priceDlg.close() })

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
  const keys = p.Wb !== undefined ? ['W', 'D', 'Wb', 'Db'] : p.pw !== undefined ? ['pw', 'ph'] : p.Dm !== undefined ? ['Dm', 'H'] : p.Dd !== undefined ? ['Dd', 'W', 'D'] : p.S !== undefined ? ['S', 'H'] : p.D1 !== undefined ? ['tiers', 'D1'] : p.PW !== undefined ? ['PW', 'PH'] : ['W', 'D', 'H']
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
// the Android shell waits for this before it stops watching for a page that never started
try { (window as unknown as { LaserAndroid?: { ready?: () => void } }).LaserAndroid?.ready?.() } catch { /* not in the app */ }
window.addEventListener('hashchange', () => { const s = loadState(); Object.assign(state, s); lastAction = null; lastEdited = null; renderGallery(); renderForm(); update(true) })

// keep an eye on the real size of the canvas for the first fit
new ResizeObserver(() => applyView()).observe(svg)

