// The offline seller page: make a code, check a code, keep a local log of what was issued.
import {
  LOG_KEY, checkCode, clinicMessage, formatDeviceInput, importSigningKey, isDeviceNumber, isPlan, issueCode, ltr, parseLog, parsePrivateKey, parseUntil, toCSV, waLink,
  type Issued, type LogEntry, type Plan,
} from './generator-lib.ts'
import { CODE_CHARS, cleanCode, formatCode } from '../src/license/core.ts'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const PLAN_AR: Record<Plan, string> = { standard: 'الأساسية', pro: 'الاحترافية' }
const REASON_AR = { format: 'الرمز غير مكتمل أو فيه خطأ في الكتابة', device: 'الرمز لا يخص هذا الجهاز', expired: 'انتهت صلاحية الرمز' } as const

let last: (Issued & { note: string }) | null = null

// ---- the seller's private key: loaded once from license-private.jwk, kept in this browser only ----
const KEY_STORE = 'dentora.generator.key'
let signingKey: CryptoKey | null = null
async function useKeyText(text: string, save: boolean): Promise<boolean> {
  const parsed = parsePrivateKey(text)
  if (!parsed.ok) {
    $('key-err').textContent = parsed.reason === 'mismatch' ? 'هذا المفتاح لا يطابق المفتاح المبني في نسخة التطبيق الحالية.' : 'هذا الملف ليس مفتاح Dentora خاصاً (license-private.jwk).'
    return false
  }
  signingKey = await importSigningKey(parsed.jwk)
  if (save) { try { localStorage.setItem(KEY_STORE, text) } catch { /* private mode: the key stays for this visit only */ } }
  $('key-err').textContent = ''
  renderKey()
  return true
}
function renderKey() {
  const ok = !!signingKey
  const box = $('keybox')
  box.classList.toggle('ok', ok); box.classList.toggle('missing', !ok)
  $('key-title').textContent = ok ? 'المفتاح الخاص محمّل' : 'حمّل مفتاحك الخاص أولاً'
  $('key-sub').textContent = ok
    ? 'يمكنك الآن إنشاء الرموز. المفتاح محفوظ في هذا المتصفح فقط؛ لا تستخدم هذه الصفحة على جهاز غير جهازك.'
    : 'الملف license-private.jwk الذي استلمته مع البرنامج. يُحفظ في هذا المتصفح فقط ولا يُرسل إلى أي مكان. بدونه لا يمكن إنشاء رموز، ولا يستطيع أحد صنعها من التطبيق نفسه.'
  $('key-load').classList.toggle('hidden', ok)
  $('key-remove').classList.toggle('hidden', !ok)
  $('make').setAttribute('aria-disabled', ok ? 'false' : 'true')
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
    const plan = document.createElement('td'); const pill = document.createElement('span'); pill.className = `pill ${r.plan}`; pill.textContent = PLAN_AR[r.plan] ?? r.plan; plan.append(pill)
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

async function verify(e: Event) {
  e.preventDefault()
  const device = $<HTMLInputElement>('v-device').value
  const code = $<HTMLTextAreaElement>('v-code').value
  const v = $('verdict'); v.classList.remove('hidden', 'ok', 'bad')
  if (!isDeviceNumber(device)) { v.classList.add('bad'); v.textContent = 'رقم الجهاز غير صحيح'; return }
  const r = await checkCode(formatDeviceInput(device), code)
  if (r.ok) { v.classList.add('ok'); v.textContent = `رمز صالح · الباقة ${PLAN_AR[r.plan]} · ${r.until ? `حتى ${ltr(r.until.toISOString().slice(0, 10))}` : 'ترخيص دائم'}` }
  else { v.classList.add('bad'); v.textContent = `رمز غير صالح: ${REASON_AR[r.reason]}` }
}

function exportCSV() {
  const rows = readLog()
  if (!rows.length) { toast('السجل فارغ'); return }
  const url = URL.createObjectURL(new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = `dentora-codes-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000)
}

bindDeviceInput($('device')); bindDeviceInput($('v-device')); bindCodeInput($('v-code') as HTMLTextAreaElement)
$('key-load').addEventListener('click', () => $<HTMLInputElement>('key-file').click())
$('key-file').addEventListener('change', async () => {
  const f = $<HTMLInputElement>('key-file').files?.[0]
  if (f && await useKeyText(await f.text(), true)) toast('تم تحميل المفتاح')
  $<HTMLInputElement>('key-file').value = ''
})
$('key-remove').addEventListener('click', () => {
  if (!confirm('إزالة المفتاح من هذا المتصفح؟ ستحتاج إلى تحميل الملف مجدداً لإنشاء رموز.')) return
  try { localStorage.removeItem(KEY_STORE) } catch { /* ignore */ }
  signingKey = null; renderKey()
})
renderKey()
try { const saved = localStorage.getItem(KEY_STORE); if (saved) void useKeyText(saved, false) } catch { /* ignore */ }
$('validity').addEventListener('change', () => $('date-wrap').classList.toggle('hidden', $<HTMLSelectElement>('validity').value !== 'date'))
$('make').addEventListener('submit', e => void make(e))
$('verify').addEventListener('submit', e => void verify(e))
$('lang').addEventListener('change', refreshMessage)
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
