// The offline seller page: make a code, check a code, keep a local log of what was issued.
import {
  LOG_KEY, checkCode, checkResetCode, clinicMessage, formatDeviceInput, importSigningKey, isDeviceNumber, isPlan, issueCode, issueResetCode, ltr, parseLog, parsePrivateKey,
  parseUntil, resetClinicMessage, toCSV, waLink, type Issued, type IssuedReset, type LogEntry, type Plan,
} from './generator-lib.ts'
import { CODE_CHARS, cleanCode, formatCode } from '../src/license/core.ts'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const PLAN_AR: Record<Plan, string> = { standard: 'الأساسية', pro: 'الاحترافية' }
const REASON_AR = { format: 'الرمز غير مكتمل أو فيه خطأ في الكتابة', device: 'الرمز لا يخص هذا الجهاز', expired: 'انتهت صلاحية الرمز', kind: '' } as const

let last: (Issued & { note: string }) | null = null
let lastReset: (IssuedReset & { note: string }) | null = null

// ---- the seller's private key ----------------------------------------------------------------------
// Never written to localStorage: a page opened from file:// shares that storage with every other local HTML
// file, so any downloaded page could read the key. It lives in memory (imported as a non-extractable key) and,
// only if asked, in this tab's sessionStorage until the tab is closed.
const LEGACY_KEY_STORE = 'dentora.generator.key'
const SESSION_KEY_STORE = 'dentora.generator.session-key'
let signingKey: CryptoKey | null = null
let keptForTab = false
async function useKeyText(text: string, keepForTab: boolean): Promise<boolean> {
  const parsed = parsePrivateKey(text)
  if (!parsed.ok) {
    $('key-err').textContent = parsed.reason === 'mismatch' ? 'هذا المفتاح لا يطابق المفتاح المبني في نسخة التطبيق الحالية.' : 'هذا الملف ليس مفتاح Dentora خاصاً (license-private.jwk).'
    return false
  }
  signingKey = await importSigningKey(parsed.jwk)
  keptForTab = false
  try {
    if (keepForTab) { sessionStorage.setItem(SESSION_KEY_STORE, text); keptForTab = true }
    else sessionStorage.removeItem(SESSION_KEY_STORE)
  } catch { /* storage blocked: memory only */ }
  $('key-err').textContent = ''
  renderKey()
  return true
}
function forgetKey() {
  signingKey = null; keptForTab = false
  try { sessionStorage.removeItem(SESSION_KEY_STORE) } catch { /* ignore */ }
  renderKey()
}
function renderKey() {
  const ok = !!signingKey
  const box = $('keybox')
  box.classList.toggle('ok', ok); box.classList.toggle('missing', !ok)
  $('key-title').textContent = ok ? 'المفتاح الخاص محمّل' : 'حمّل مفتاحك الخاص أولاً'
  $('key-sub').textContent = ok
    ? (keptForTab
      ? 'يمكنك الآن إنشاء الرموز. المفتاح محفوظ حتى إغلاق هذا التبويب فقط؛ أغلقه حين تنتهي.'
      : 'يمكنك الآن إنشاء الرموز. المفتاح في ذاكرة هذه الصفحة فقط، ويُنسى عند إغلاقها أو تحديثها.')
    : 'الملف license-private.jwk الذي استلمته مع البرنامج. يبقى في ذاكرة هذه الصفحة فقط ويُنسى عند إغلاقها، ولا يُرسل إلى أي مكان. بدونه لا يمكن إنشاء رموز، ولا يستطيع أحد صنعها من التطبيق نفسه.'
  $('key-load').classList.toggle('hidden', ok)
  $('key-remove').classList.toggle('hidden', !ok)
  $('key-session-wrap').classList.toggle('hidden', ok)
  $('make').setAttribute('aria-disabled', ok ? 'false' : 'true')
  $('reset').setAttribute('aria-disabled', ok ? 'false' : 'true')
}

function toast(msg: string) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show')
  window.clearTimeout((toast as any).timer); (toast as any).timer = window.setTimeout(() => t.classList.remove('show'), 2200)
}
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast('تم النسخ') }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select()
    const ok = document.execCommand('copy'); ta.remove(); toast(ok ? 'تم النسخ' : 'تعذّر النسخ')
  }
}
function readLog(): LogEntry[] { try { return parseLog(localStorage.getItem(LOG_KEY)) } catch { return [] } }
function writeLog(rows: LogEntry[]) { try { localStorage.setItem(LOG_KEY, JSON.stringify(rows)) } catch { toast('تعذّر حفظ السجل في هذا المتصفح') } }

function cell(text: string, cls = '') { const td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; return td }
function renderLog() {
  const rows = readLog()
  const body = $('rows'); body.textContent = ''
  $('empty').classList.toggle('hidden', rows.length > 0)
  $('count').textContent = rows.length ? `(${rows.length})` : ''
  rows.forEach((r, i) => {
    const tr = document.createElement('tr')
    tr.append(cell(r.at.slice(0, 10), 'ltr'), cell(r.device, 'mono ltr'))
    const reset = r.kind === 'reset'
    const plan = document.createElement('td'); const pill = document.createElement('span')
    pill.className = `pill ${reset ? 'reset' : r.plan ?? ''}`; pill.textContent = reset ? 'إعادة رمز الدخول' : (r.plan && PLAN_AR[r.plan]) ?? r.plan ?? ''; plan.append(pill)
    tr.append(plan, cell(r.until ?? 'دائم', r.until ? 'ltr' : ''), cell(r.code, 'mono ltr'), cell(r.note || '—'))
    const act = document.createElement('td'); act.style.whiteSpace = 'nowrap'
    const cp = document.createElement('button'); cp.type = 'button'; cp.className = 'secondary small'; cp.textContent = 'نسخ'; cp.onclick = () => void copy(r.code)
    const del = document.createElement('button'); del.type = 'button'; del.className = 'danger small'; del.textContent = 'حذف'; del.style.marginInlineStart = '6px'
    del.onclick = () => { if (confirm('حذف هذا السطر من السجل؟')) { const all = readLog(); all.splice(i, 1); writeLog(all); renderLog() } }
    act.append(cp, del); tr.append(act)
    body.append(tr)
  })
}

function bindDeviceInput(input: HTMLInputElement) {
  input.addEventListener('input', () => { input.value = formatDeviceInput(input.value) })
}
function bindCodeInput(input: HTMLTextAreaElement) {
  input.addEventListener('input', () => { input.value = formatCode(cleanCode(input.value).slice(0, CODE_CHARS)) })
}

function refreshMessage() {
  if (!last) return
  const lang = ($('lang') as HTMLSelectElement).value === 'en' ? 'en' : 'ar'
  const msg = clinicMessage(last, lang, last.note)
  $<HTMLTextAreaElement>('message').value = msg
  const phone = $<HTMLInputElement>('phone').value.trim()
  const wa = $<HTMLAnchorElement>('wa')
  wa.href = phone ? waLink(phone, msg) : `https://wa.me/?text=${encodeURIComponent(msg)}`
}

async function make(e: Event) {
  e.preventDefault()
  const device = $<HTMLInputElement>('device').value
  const plan = $<HTMLSelectElement>('plan').value
  const validity = $<HTMLSelectElement>('validity').value
  const note = $<HTMLInputElement>('note').value.trim()
  $('device-err').textContent = ''; $('date-err').textContent = ''
  if (!isDeviceNumber(device)) { $('device-err').textContent = 'رقم الجهاز 8 خانات كما يظهر في شاشة الترخيص، مثل 7KQ4-M2XD'; $('device').focus(); return }
  const until = parseUntil(validity === 'date' ? $<HTMLInputElement>('date').value : validity)
  if (until === undefined) { $('date-err').textContent = 'اختر تاريخاً صحيحاً اليوم أو بعده'; return }
  if (!isPlan(plan)) return
  if (!signingKey) { toast('حمّل مفتاحك الخاص أولاً'); return }
  const issued = await issueCode(device, plan, until, signingKey)
  last = { ...issued, note }
  $('code').textContent = issued.code
  $('meta').textContent = `الباقة ${PLAN_AR[issued.plan]} · ${issued.until ? `صالح حتى ${ltr(issued.until)}` : 'ترخيص دائم'} · الجهاز ${ltr(issued.device)}`
  $('result').classList.remove('hidden')
  refreshMessage()
  writeLog([{ ...issued, note, at: new Date().toISOString() }, ...readLog()])
  renderLog()
  $<HTMLInputElement>('v-device').value = issued.device
  $<HTMLTextAreaElement>('v-code').value = issued.code
}

function refreshResetMessage() {
  if (!lastReset) return
  const lang = ($('lang') as HTMLSelectElement).value === 'en' ? 'en' : 'ar'
  const msg = resetClinicMessage(lastReset, lang, lastReset.note)
  $<HTMLTextAreaElement>('r-message').value = msg
  $<HTMLAnchorElement>('r-wa').href = `https://wa.me/?text=${encodeURIComponent(msg)}`
}

async function makeReset(e: Event) {
  e.preventDefault()
  const device = $<HTMLInputElement>('r-device').value
  const note = $<HTMLInputElement>('r-note').value.trim()
  $('r-device-err').textContent = ''
  if (!isDeviceNumber(device)) { $('r-device-err').textContent = 'رقم الجهاز 8 خانات كما يظهر في شاشة الدخول، مثل 7KQ4-M2XD'; $('r-device').focus(); return }
  if (!signingKey) { toast('حمّل مفتاحك الخاص أولاً'); return }
  const issued = await issueResetCode(device, signingKey)
  lastReset = { ...issued, note }
  $('r-code').textContent = issued.code
  $('r-meta').textContent = `الجهاز ${ltr(issued.device)} · صالح حتى ${ltr(issued.lastDay)} ولمرة واحدة`
  $('r-result').classList.remove('hidden')
  refreshResetMessage()
  writeLog([{ code: issued.code, device: issued.device, until: issued.lastDay, kind: 'reset', note, at: new Date().toISOString() }, ...readLog()])
  renderLog()
}

async function verify(e: Event) {
  e.preventDefault()
  const device = $<HTMLInputElement>('v-device').value
  const code = $<HTMLTextAreaElement>('v-code').value
  const v = $('verdict'); v.classList.remove('hidden', 'ok', 'bad')
  if (!isDeviceNumber(device)) { v.classList.add('bad'); v.textContent = 'رقم الجهاز غير صحيح'; return }
  const r = await checkCode(formatDeviceInput(device), code)
  if (r.ok) { v.classList.add('ok'); v.textContent = `رمز صالح · الباقة ${PLAN_AR[r.plan]} · ${r.until ? `حتى ${ltr(r.until.toISOString().slice(0, 10))}` : 'ترخيص دائم'}`; return }
  if (r.reason === 'kind') {
    const reset = await checkResetCode(formatDeviceInput(device), code)
    v.classList.add(reset.ok ? 'ok' : 'bad')
    v.textContent = reset.ok ? 'رمز إعادة تعيين رمز الدخول صالح لهذا الجهاز اليوم' : `رمز إعادة تعيين غير صالح: ${REASON_AR[reset.reason === 'kind' ? 'format' : reset.reason]}`
    return
  }
  v.classList.add('bad'); v.textContent = `رمز غير صالح: ${REASON_AR[r.reason]}${r.reason === 'expired' ? ` (${ltr(r.until.toISOString().slice(0, 10))})` : ''}`
}

function exportCSV() {
  const rows = readLog()
  if (!rows.length) { toast('السجل فارغ'); return }
  const url = URL.createObjectURL(new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = `dentora-codes-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000)
}

bindDeviceInput($('device')); bindDeviceInput($('v-device')); bindDeviceInput($('r-device')); bindCodeInput($('v-code') as HTMLTextAreaElement)
$('key-load').addEventListener('click', () => $<HTMLInputElement>('key-file').click())
$('key-file').addEventListener('change', async () => {
  const f = $<HTMLInputElement>('key-file').files?.[0]
  if (f && await useKeyText(await f.text(), $<HTMLInputElement>('key-session').checked)) toast('تم تحميل المفتاح')
  $<HTMLInputElement>('key-file').value = ''
})
$('key-remove').addEventListener('click', () => {
  if (!confirm('إزالة المفتاح من هذه الصفحة؟ ستحتاج إلى تحميل الملف مجدداً لإنشاء رموز.')) return
  forgetKey()
})
renderKey()
// an older version kept the key in localStorage, readable by any local HTML file: remove it and say so
try {
  if (localStorage.getItem(LEGACY_KEY_STORE) !== null) { localStorage.removeItem(LEGACY_KEY_STORE); $('key-legacy').classList.remove('hidden') }
} catch { /* ignore */ }
try { const kept = sessionStorage.getItem(SESSION_KEY_STORE); if (kept) { $<HTMLInputElement>('key-session').checked = true; void useKeyText(kept, true) } } catch { /* ignore */ }
$('validity').addEventListener('change', () => $('date-wrap').classList.toggle('hidden', $<HTMLSelectElement>('validity').value !== 'date'))
$('make').addEventListener('submit', e => void make(e))
$('verify').addEventListener('submit', e => void verify(e))
$('reset').addEventListener('submit', e => void makeReset(e))
$('lang').addEventListener('change', () => { refreshMessage(); refreshResetMessage() })
$('r-copy-code').addEventListener('click', () => lastReset && void copy(lastReset.code))
$('r-copy-msg').addEventListener('click', () => void copy($<HTMLTextAreaElement>('r-message').value))
$('phone').addEventListener('input', refreshMessage)
$('copy-code').addEventListener('click', () => last && void copy(last.code))
$('copy-msg').addEventListener('click', () => void copy($<HTMLTextAreaElement>('message').value))
$('csv').addEventListener('click', exportCSV)
$('clear').addEventListener('click', () => { if (readLog().length && confirm('مسح كل السجل؟ صدّره إلى CSV أولاً إن كنت تحتاجه.')) { writeLog([]); renderLog() } })
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
$<HTMLInputElement>('date').min = new Date().toISOString().slice(0, 10)
$<HTMLInputElement>('date').value = tomorrow
renderLog()
;(window as any).__generatorReady = true
