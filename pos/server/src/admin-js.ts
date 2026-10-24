// The control panel's JavaScript, part 1 (see admin.ts): helpers, icons, the API client, auth, the shell
// (navigation, theme, menus, sheets, dialogs, toasts) and the dashboard. Part 2 (admin-js2.ts) has the lists.
// No backticks and no "${" anywhere in here: the page is a String.raw template.
import { ADMIN_JS2 } from './admin-js2'

const JS1 = String.raw`
'use strict'
const $ = id => document.getElementById(id)
const DAY = 86400000
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const P = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  key: '<path d="M2.6 17.4A2 2 0 0 0 2 18.8V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.2a2 2 0 0 0 1.4-.6l.8-.8a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".6" fill="currentColor"/>',
  phone: '<rect width="12" height="20" x="6" y="2" rx="2"/><path d="M12 18h.01"/>',
  pc: '<rect width="20" height="13" x="2" y="3" rx="2"/><path d="M8 21h8M12 16v5"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  cloud: '<path d="M17.5 19a4.5 4.5 0 0 0 .5-9 7 7 0 0 0-13.3 2A4 4 0 0 0 6 19z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="m5 12 5 5L20 7"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  copy: '<rect width="13" height="13" x="9" y="9" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  print: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3h12v6M6 14h12v8H6z"/>',
  download: '<path d="M12 3v12M6 11l6 6 6-6M4 21h16"/>', msg: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', eyeOff: '<path d="M2 12s3.5-7 10-7c1.6 0 3 .4 4.3 1M22 12s-3.5 7-10 7c-1.6 0-3-.4-4.3-1M3 3l18 18"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>', chevL: '<path d="m15 6-6 6 6 6"/>', chevR: '<path d="m9 6 6 6-6 6"/>', more: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  move: '<path d="M5 12h14M13 6l6 6-6 6"/>', tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-7 7a2.1 2.1 0 0 1-3-3l7-7a6 6 0 0 1 7.9-7.9z"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>', refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', cal: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  dot: '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>', gift: '<rect x="3" y="8" width="18" height="4"/><path d="M12 8v13M5 12v9h14v-9M12 8a3 3 0 1 1 3-3c0 2-3 3-3 3zm0 0a3 3 0 1 0-3-3c0 2 3 3 3 3z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-5 4 3 5-7"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 4a3.5 3.5 0 0 1 0 7M22 20a7 7 0 0 0-5-6.7"/>',
  sort: '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>', sheet: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h8"/>',
}
const I = (name, size) => '<svg width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || P.dot) + '</svg>'

// ---- formatting
const DF = new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' })
const DTF = new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmt = ms => ms ? DF.format(new Date(ms)) : '—'
const fmtT = ms => ms ? DTF.format(new Date(ms)) : '—'
const N = x => Number(x || 0).toLocaleString('en-US')
const kb = n => !n ? '0' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB'
const plural = (n, one, two, many, many2) => n === 1 ? one : n === 2 ? two : n <= 10 ? n + ' ' + many : n + ' ' + (many2 || many)
const daysWord = n => plural(n, 'يوم واحد', 'يومان', 'أيام', 'يوماً')
const devicesWord = n => plural(n, 'جهاز واحد', 'جهازان', 'أجهزة', 'جهازاً')
const daysLeft = ms => Math.ceil((ms - Date.now()) / DAY)
function rel(ms) {
  if (!ms) return 'لم يُر بعد'
  const d = Date.now() - ms, m = Math.round(d / 60000), hh = Math.round(d / 3600000), dd = Math.round(d / DAY)
  if (m < 1) return 'الآن'
  if (m < 60) return 'قبل ' + plural(m, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة')
  if (hh < 24) return 'قبل ' + plural(hh, 'ساعة', 'ساعتين', 'ساعات', 'ساعة')
  if (dd < 30) return 'قبل ' + plural(dd, 'يوم', 'يومين', 'أيام', 'يوماً')
  return fmt(ms)
}
const inDays = ms => { const n = daysLeft(ms); return n <= 0 ? 'انتهى ' + rel(ms) : n === 1 ? 'ينتهي غداً' : 'بعد ' + daysWord(n) }
const platIcon = p => I(p === 'android' ? 'phone' : p === 'electron' ? 'pc' : 'web', 16)
const platName = p => p === 'android' ? 'أندرويد' : p === 'electron' ? 'ويندوز' : 'متصفح'
const dateMs = (v, endOfDay) => { if (!v) return ''; const t = Date.parse(v + 'T00:00:00'); return Number.isFinite(t) ? String(endOfDay ? t + DAY - 1 : t) : '' }
const isoDate = ms => new Date(ms).toISOString().slice(0, 10)
const ynum = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi }

// ---- toasts, dialogs, sheets
function toast(msg, kind) {
  const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.innerHTML = (kind === 'ok' ? I('check', 16) : kind === 'bad' ? I('alert', 16) : '') + '<span>' + esc(msg) + '</span>'
  $('toasts').appendChild(el); setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320) }, kind === 'bad' ? 4200 : 2400)
}
function ask(title, text, opts) {
  opts = opts || {}
  return new Promise(resolve => {
    const host = $('askHost')
    host.innerHTML = '<div class="sheet-bg" style="z-index:55"><div class="sheet" role="dialog" aria-modal="true" style="max-width:440px"><div class="grab"></div><div class="sb"><h2 style="margin-bottom:6px">' + esc(title) + '</h2><div class="muted">' + (opts.html || esc(text || '')) + '</div></div><div class="sf"><button class="btn" data-r="0" type="button">' + esc(opts.cancel || 'إلغاء') + '</button><button class="btn ' + (opts.danger ? 'danger' : 'primary') + '" data-r="1" type="button">' + esc(opts.ok || 'تأكيد') + '</button></div></div></div>'
    const done = r => { host.innerHTML = ''; resolve(r) }
    host.querySelectorAll('[data-r]').forEach(b => b.onclick = () => done(b.dataset.r === '1'))
    host.querySelector('.sheet-bg').onclick = e => { if (e.target.classList.contains('sheet-bg')) done(false) }
    host.querySelector('[data-r="1"]').focus()
  })
}
/** A small form dialog: resolves with the dialog element (read its inputs) or null. validate(el) may return an error text. */
function dialog(title, bodyHtml, opts) {
  opts = opts || {}
  return new Promise(resolve => {
    const host = $('askHost')
    host.innerHTML = '<div class="sheet-bg" style="z-index:55"><form class="sheet" role="dialog" aria-modal="true" style="max-width:480px"><div class="grab"></div><div class="sh"><h2>' + esc(title) + '</h2><button class="btn ghost icon sm" type="button" data-r="0" aria-label="إغلاق">' + I('x', 18) + '</button></div><div class="sb stack">' + bodyHtml + '<div class="err" data-err></div></div><div class="sf"><button class="btn" data-r="0" type="button">إلغاء</button><button class="btn ' + (opts.danger ? 'danger' : 'primary') + '" type="submit">' + esc(opts.ok || 'حفظ') + '</button></div></form></div>'
    const form = host.querySelector('form')
    const done = r => { host.innerHTML = ''; resolve(r) }
    host.querySelectorAll('[data-r="0"]').forEach(b => b.onclick = () => done(null))
    host.querySelector('.sheet-bg').onclick = e => { if (e.target.classList.contains('sheet-bg')) done(null) }
    form.onsubmit = e => { e.preventDefault(); const err = opts.validate ? opts.validate(form) : ''; if (err) { form.querySelector('[data-err]').textContent = err; return } done(form) }
    const first = form.querySelector('input,select,textarea'); if (first) first.focus()
  })
}
const sheetHost = $('sheetHost')
function openSheet(title, inner, opts) {
  opts = opts || {}
  const bg = document.createElement('div'); bg.className = 'sheet-bg'
  bg.innerHTML = '<div class="sheet' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true"><div class="grab"></div><div class="sh">' + (opts.head || '<h2>' + esc(title) + '</h2>') + '<button class="btn ghost icon sm" type="button" data-close aria-label="إغلاق">' + I('x', 18) + '</button></div><div class="sb">' + inner + '</div>' + (opts.foot ? '<div class="sf">' + opts.foot + '</div>' : '') + '</div>'
  sheetHost.appendChild(bg)
  bg.onclick = e => { if (e.target === bg) closeSheet() }
  bg.querySelector('[data-close]').onclick = closeSheet
  document.body.style.overflow = 'hidden'
  return bg.querySelector('.sheet')
}
function closeSheet() { const last = sheetHost.lastElementChild; if (last) last.remove(); if (!sheetHost.children.length) document.body.style.overflow = '' }
function closeAllSheets() { sheetHost.innerHTML = ''; document.body.style.overflow = '' }
const act = (icon, label, data, cls) => '<button class="act ' + (cls || '') + '" data-a="' + data + '" type="button">' + I(icon) + '<span>' + label + '</span></button>'
const copy = t => (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t).then(() => toast('تم النسخ', 'ok'), () => fallbackCopy(t)) : fallbackCopy(t))
function fallbackCopy(t) { const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('تم النسخ', 'ok') } catch (e) { prompt('انسخ:', t) } ta.remove() }
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000) }
const skel = n => '<div class="stack" style="padding:16px">' + Array.from({ length: n || 5 }, () => '<div class="skel row"></div>').join('') + '</div>'
const empty = (icon, title, text, btn) => '<div class="empty"><div class="ico">' + I(icon) + '</div><h3>' + esc(title) + '</h3><p>' + esc(text || '') + '</p>' + (btn || '') + '</div>'
function pager(host, total, page, limit, onPage) {
  const pages = Math.max(1, Math.ceil(total / limit))
  if (pages <= 1) { host.innerHTML = ''; return }
  host.innerHTML = '<button class="btn outline icon sm" data-p="' + (page - 1) + '" ' + (page <= 1 ? 'disabled' : '') + ' aria-label="السابق">' + I('chevR', 18) + '</button><span class="pg" dir="ltr">' + N(page) + ' / ' + N(pages) + '</span><button class="btn outline icon sm" data-p="' + (page + 1) + '" ' + (page >= pages ? 'disabled' : '') + ' aria-label="التالي">' + I('chevL', 18) + '</button>'
  host.querySelectorAll('[data-p]').forEach(b => b.onclick = () => onPage(+b.dataset.p))
}
const chips = (host, items, cur, onPick) => {
  host.innerHTML = items.map(c => '<button class="chip' + (c[0] === cur ? ' on' : '') + '" data-v="' + c[0] + '" type="button">' + esc(c[1]) + (c[2] != null ? '<span class="n">' + N(c[2]) + '</span>' : '') + '</button>').join('')
  host.querySelectorAll('.chip').forEach(b => b.onclick = () => onPick(b.dataset.v))
}
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) } }

// ---- API client
let KEY = ''
try { KEY = localStorage.getItem('kaseb.admin') || sessionStorage.getItem('kaseb.admin') || '' } catch (e) {}
async function api(path, opts) {
  opts = opts || {}
  const r = await fetch('/admin/api/' + path, { method: opts.method || 'GET', headers: Object.assign({ authorization: 'Bearer ' + KEY }, opts.body ? { 'content-type': 'application/json' } : {}), body: opts.body ? JSON.stringify(opts.body) : undefined })
  if (opts.raw) { if (!r.ok) throw new Error('HTTP ' + r.status); return r }
  let d = null; try { d = await r.json() } catch (e) {}
  if (r.status === 401) { if (!opts.login) logout('انتهت الجلسة أو تغيّر المفتاح. أدخله من جديد.'); throw new Error(d && d.message || 'المفتاح غير صحيح') }
  if (!r.ok) throw new Error(d && d.message || d && d.error || ('خطأ ' + r.status))
  return d
}
const q = o => { const u = new URLSearchParams(); Object.keys(o).forEach(k => { if (o[k] !== '' && o[k] != null) u.set(k, o[k]) }); const s = u.toString(); return s ? '?' + s : '' }
const get = (path, params) => api(path + q(params || {}))
const post = (path, body) => api(path, { method: 'POST', body: body || {} })
async function busy(btn, fn) { const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>' + old; try { return await fn() } catch (e) { toast(e.message || String(e), 'bad'); throw e } finally { btn.disabled = false; btn.innerHTML = old } }

// ---- settings cache (price, WhatsApp… used by messages and cards)
let SET = { price: '35$', whatsapp: '', trial_days: 7, grace_days: 10, min_version: '', android_signature: '', message: '', cloud_price: '35$', cloud_days: 365, cloud_keep: 3, web_trial: 0, cloudAvailable: true }
const customerMsg = (code, exp, maxDev, cloud) => 'شكراً لشرائك كاسب 🌟\n'
  + 'كود التفعيل: ' + code + '\n'
  + 'افتح التطبيق وأنت متصل بالإنترنت ← شاشة التفعيل ← أدخل الكود ← تفعيل.\n'
  + 'الكود يعمل على ' + devicesWord(maxDev) + (exp ? '، وصالح حتى ' + fmt(exp) : '، ترخيص دائم (' + SET.price + ')') + '.'
  + (cloud ? '\nالتخزين السحابي مفعّل حتى ' + fmt(cloud) + ': من الإعدادات ← النسخ الاحتياطي ← السحابة.' : '')
  + (SET.whatsapp ? '\nللدعم: واتساب ' + SET.whatsapp : '')
const whatsappBatch = codes => 'أكواد تفعيل كاسب (' + codes.length + '):\n' + codes.map(c => '• ' + c).join('\n') + '\n\n' + 'سعر الترخيص: ' + SET.price + (SET.cloud_price ? ' · السحابة سنوياً: ' + SET.cloud_price : '') + '\n' + 'افتح التطبيق ← شاشة التفعيل ← أدخل الكود.' + (SET.whatsapp ? '\nالدعم: واتساب ' + SET.whatsapp : '')
function printCards(codes, exp, maxDev) {
  $('printArea').innerHTML = '<div class="pcards">' + codes.map(c => '<div class="pcard"><div class="b1">كاسب — كود التفعيل</div><div class="code">' + esc(c) + '</div><div class="b2">افتح كاسب ← شاشة التفعيل ← أدخل الكود<br>' + (exp ? 'صالح حتى ' + fmt(exp) : 'ترخيص دائم') + ' · ' + devicesWord(maxDev) + (SET.whatsapp ? '<br>واتساب: <span class="num">' + esc(SET.whatsapp) + '</span>' : '') + '</div></div>').join('') + '</div>'
  window.print()
}
const codesCsv = (codes, exp, maxDev, cloud, note, seller) => '﻿code,plan,expires,max_devices,cloud_until,note,seller\r\n' + codes.map(c => [c, exp ? 'subscription' : 'lifetime', exp ? isoDate(exp) : '', maxDev, cloud ? isoDate(cloud) : '', note || '', seller || ''].map(v => { v = String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v }).join(',')).join('\r\n')

// ---- status helpers
function codeStatus(c) {
  if (c.revoked) return ['bad', 'ملغى']
  if (c.expires_at && c.expires_at <= Date.now()) return ['warn', 'منتهٍ']
  if (c.devices > 0 || c.status === 'active') return ['ok', 'مفعّل']
  return ['info', 'غير مستخدم']
}
const badge = (cls, text) => '<span class="badge ' + cls + '">' + esc(text) + '</span>'
function deviceState(d) {
  if (d.blocked) return ['bad', 'موقوف']
  if (d.code) { if (d.code_revoked) return ['bad', 'كود ملغى']; if (d.code_expires && d.code_expires <= Date.now()) return ['warn', 'ترخيص منتهٍ']; return ['ok', 'مرخّص'] }
  if (d.trial_started) { const n = daysLeft(d.trial_ends || 0); return n > 0 ? ['info', 'تجربة · ' + daysWord(n)] : ['warn', 'تجربة منتهية'] }
  return ['', 'بلا ترخيص']
}
const WHY = { invalid_code: 'كود غير صحيح', revoked: 'الكود ملغى', expired: 'الترخيص منتهٍ', device_limit: 'الكود مستخدم على جهاز آخر', tampered: 'نسخة معدّلة (توقيع مختلف)', min_version: 'إصدار قديم', disabled: 'التجربة موقوفة', used: 'استُخدمت التجربة من قبل', web: 'تجربة من المتصفح (غير مسموحة)', device_mismatch: 'الكود مربوط بجهاز آخر الآن', no_trial: 'لا تجربة لهذا الجهاز', move_limit: 'استُنفدت مرات النقل الذاتي', inactive: 'السحابة غير مفعّلة', blocked: 'الجهاز موقوف من البائع' }
const ACT = { revoke: 'إلغاء الكود', unrevoke: 'إعادة الكود', extend: 'تغيير تاريخ الانتهاء', note: 'تعديل بيانات الكود', devices: 'تغيير عدد الأجهزة', release: 'تحرير جهاز من الكود', settings: 'تعديل الإعدادات', grant: 'منح كود لجهاز', cloud: 'تعديل اشتراك السحابة', 'backups-delete': 'حذف النسخ السحابية', block: 'إيقاف جهاز', unblock: 'إعادة تشغيل جهاز' }
function describe(e) {
  const d = String(e.detail || '')
  if (e.kind === 'activate') return ['good', 'check', d === 'refresh' ? 'إعادة تفعيل على الجهاز نفسه' : 'تفعيل جديد', '']
  if (e.kind === 'activate-fail') return ['bad', 'x', 'محاولة تفعيل فاشلة', WHY[d] || d]
  if (e.kind === 'trial') { const m = d.match(/^(\d+)d$/); return ['info', 'clock', 'بدء تجربة مجانية', m ? daysWord(+m[1]) : d === 'start' ? '' : d] }
  if (e.kind === 'trial-fail') return ['bad', 'x', 'طلب تجربة مرفوض', WHY[d] || d]
  if (e.kind === 'check') return ['', 'dot', d === 'upgrade' ? 'ترقية من التجربة إلى ترخيص' : d === 'trial' ? 'تحقق دوري (تجربة)' : 'تحقق دوري', '']
  if (e.kind === 'check-fail') return ['bad', 'alert', 'تحقق مرفوض', WHY[d] || d]
  if (e.kind === 'release') return ['warn', 'move', d === 'move_limit' ? 'طلب نقل مرفوض' : 'العميل حرّر جهازه لنقل الترخيص', d === 'move_limit' ? WHY.move_limit : '']
  if (e.kind === 'backup') return ['info', 'cloud', 'نسخة سحابية مرفوعة', d ? kb(+d) : '']
  if (e.kind === 'backup-fail') return ['bad', 'cloud', 'رفع نسخة مرفوض', WHY[d] || d]
  if (e.kind === 'restore') return ['info', 'download', 'استعادة نسخة سحابية', '']
  if (e.kind === 'admin') { const m = d.match(/^created (\d+)$/); if (m) return ['', 'tool', 'إنشاء ' + m[1] + ' كود', '']; return ['', 'tool', ACT[d] || 'إجراء إداري', ACT[d] ? '' : d] }
  return ['', 'dot', e.kind, d]
}
function eventHtml(e, opts) {
  opts = opts || {}
  const [cls, ic, t, d] = describe(e)
  const who = e.device_code ? '<span class="lnk mono" data-dev="' + esc(e.device_code) + '">' + esc(e.device_code) + '</span>' + (e.name ? ' <span>' + esc(e.name) + '</span>' : '') : ''
  return '<div class="ev ' + cls + '"><div class="i">' + I(ic) + '</div><div class="grow"><div class="t">' + esc(t) + (e.code && !opts.noCode ? ' <span class="lnk mono" data-code="' + esc(e.code) + '">' + esc(e.code) + '</span>' : '') + '</div><div class="s"><span title="' + esc(fmtT(e.at)) + '">' + rel(e.at) + '</span>' + (d ? '<span>· ' + esc(d) + '</span>' : '') + (who && !opts.noDevice ? '<span>· ' + who + '</span>' : '') + '</div></div></div>'
}
function wireLinks(host) {
  host.querySelectorAll('[data-code]').forEach(el => el.onclick = ev => { ev.stopPropagation(); openCode(el.dataset.code) })
  host.querySelectorAll('[data-dev]').forEach(el => el.onclick = ev => { ev.stopPropagation(); openDeviceByShort(el.dataset.dev) })
}

// ---- auth
function showLogin(err) { $('app').classList.add('hidden'); $('login').classList.remove('hidden'); $('loginErr').innerHTML = err ? I('alert', 14) + '<span>' + esc(err) + '</span>' : ''; setTimeout(() => $('key').focus(), 50) }
function logout(msg) { KEY = ''; try { localStorage.removeItem('kaseb.admin'); sessionStorage.removeItem('kaseb.admin') } catch (e) {} closeAllSheets(); $('askHost').innerHTML = ''; showLogin(msg || '') }
$('eye').innerHTML = I('eye', 18)
$('eye').onclick = () => { const i = $('key'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; $('eye').innerHTML = I(show ? 'eyeOff' : 'eye', 18) }
$('loginForm').onsubmit = async e => {
  e.preventDefault()
  const k = $('key').value.trim(); if (!k) { $('key').focus(); return }
  KEY = k; $('enter').disabled = true; $('enter').innerHTML = '<span class="spin"></span> جارٍ الدخول…'
  try {
    SET = await api('settings', { login: true })
    try { (($('remember').checked ? localStorage : sessionStorage)).setItem('kaseb.admin', KEY) } catch (e2) {}
    $('key').value = ''; $('loginErr').textContent = ''
    enterApp()
  } catch (e2) { KEY = ''; $('loginErr').innerHTML = I('alert', 14) + '<span>' + esc(/غير صحيح/.test(e2.message) ? 'المفتاح غير صحيح. تأكد من نسخه كاملاً.' : 'تعذّر الاتصال بالخادم: ' + e2.message) + '</span>'; $('key').focus() }
  $('enter').disabled = false; $('enter').textContent = 'دخول'
}

// ---- shell
const VIEWS = [['home', 'الرئيسية', 'home'], ['codes', 'الأكواد', 'key'], ['devices', 'الأجهزة', 'phone'], ['cloud', 'السحابة', 'cloud'], ['log', 'السجل', 'list'], ['settings', 'الإعدادات', 'settings']]
const TITLES = Object.fromEntries(VIEWS.map(v => [v[0], v[1]]))
let VIEW = ''
const loaded = {}
$('sideNav').innerHTML = VIEWS.map(v => '<button data-v="' + v[0] + '" type="button">' + I(v[2]) + '<span>' + v[1] + '</span><span class="cnt hidden" id="cnt-' + v[0] + '"></span></button>').join('')
$('nav').innerHTML = VIEWS.slice(0, 4).map(v => '<button data-v="' + v[0] + '" type="button">' + I(v[2], 22) + v[1] + '</button>').join('') + '<button data-v="more" type="button">' + I('more', 22) + 'المزيد</button>'
document.querySelectorAll('#sideNav [data-v], #nav [data-v]').forEach(b => b.onclick = () => b.dataset.v === 'more' ? moreSheet() : go(b.dataset.v))
$('qNew').innerHTML = I('plus', 16) + '<span>أكواد جديدة</span>'; $('cNew').innerHTML = I('plus', 16) + '<span>إنشاء أكواد</span>'
$('qNew').onclick = () => generateSheet(); $('cNew').onclick = () => generateSheet()
$('gsIcon').innerHTML = I('search', 16); $('cqIcon').innerHTML = I('search', 16); $('dqIcon').innerHTML = I('search', 16); $('clqIcon').innerHTML = I('search', 16)
$('cqClr').innerHTML = I('x', 16); $('dqClr').innerHTML = I('x', 16); $('cFilter').innerHTML = I('filter', 18); $('userBtnTop').innerHTML = I('user', 18)
$('sideHost').textContent = location.host
function go(v, keep) {
  if (!TITLES[v]) v = 'home'
  VIEW = v
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v))
  document.querySelectorAll('#sideNav [data-v], #nav [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v))
  $('pageTitle').textContent = TITLES[v]; document.title = TITLES[v] + ' — لوحة كاسب'
  if (!keep && location.hash !== '#' + v) history.replaceState(null, '', '#' + v)
  window.scrollTo({ top: 0 })
  if (v === 'home') loadHome(); else if (v === 'codes') { if (!loaded.codes) loadCodes() } else if (v === 'devices') { if (!loaded.devices) loadDevices() }
  else if (v === 'cloud') loadCloud(); else if (v === 'log') { if (!loaded.log) loadLog() } else if (v === 'settings') loadSettings()
}
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h.startsWith('code/')) openCode(h.slice(5)); else if (h.startsWith('device/')) openDeviceByShort(h.slice(7)); else if (TITLES[h] && h !== VIEW) go(h, true) })
function moreSheet() {
  const s = openSheet('المزيد', '<div class="col" style="gap:4px">' + VIEWS.slice(4).map(v => '<button class="act" data-v="' + v[0] + '" type="button" style="border:0">' + I(v[2]) + '<span>' + v[1] + '</span></button>').join('')
    + '<button class="act" data-a="theme" type="button" style="border:0">' + I(themeIcon()) + '<span>المظهر: ' + themeName() + '</span></button>'
    + '<button class="act" data-a="reload" type="button" style="border:0">' + I('refresh') + '<span>تحديث البيانات</span></button>'
    + '<hr style="border:0;border-top:1px solid var(--border);margin:6px 0"><div class="faint" style="padding:0 12px">' + esc(location.host) + '</div>'
    + '<button class="act danger" data-a="logout" type="button" style="border:0">' + I('logout') + '<span>تسجيل الخروج</span></button></div>')
  s.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { closeSheet(); go(b.dataset.v) })
  s.querySelector('[data-a=theme]').onclick = () => { cycleTheme(); closeSheet(); moreSheet() }
  s.querySelector('[data-a=reload]').onclick = () => { closeSheet(); reloadAll() }
  s.querySelector('[data-a=logout]').onclick = () => { closeSheet(); logout() }
}
function reloadAll() { loaded.codes = loaded.devices = loaded.log = false; go(VIEW); toast('تم التحديث', 'ok') }
// theme: '' = system, 'light', 'dark'
let THEME = ''
try { THEME = localStorage.getItem('kaseb.theme') || '' } catch (e) {}
const themeIcon = () => THEME === 'dark' ? 'moon' : THEME === 'light' ? 'sun' : 'auto'
const themeName = () => THEME === 'dark' ? 'داكن' : THEME === 'light' ? 'فاتح' : 'حسب النظام'
function applyTheme() {
  if (THEME) document.documentElement.setAttribute('data-theme', THEME); else document.documentElement.removeAttribute('data-theme')
  try { if (THEME) localStorage.setItem('kaseb.theme', THEME); else localStorage.removeItem('kaseb.theme') } catch (e) {}
  $('themeBtnTop').innerHTML = I(themeIcon(), 18); $('themeBtnTop').title = 'المظهر: ' + themeName()
  $('themeBtnSide').innerHTML = I(themeIcon()) + '<span>المظهر: ' + themeName() + '</span>'
}
function cycleTheme() { THEME = THEME === '' ? 'dark' : THEME === 'dark' ? 'light' : ''; applyTheme(); toast('المظهر: ' + themeName()) }
$('themeBtnTop').onclick = cycleTheme; $('themeBtnSide').onclick = cycleTheme
applyTheme()
$('userBtn').innerHTML = I('user') + '<span class="truncate">المالك</span>'
const menuHtml = '<div class="head">متصل بـ <span class="mono">' + esc(location.host) + '</span></div><button class="item" data-a="reload" type="button">' + I('refresh', 18) + 'تحديث البيانات</button><button class="item" data-a="pk" type="button">' + I('shield', 18) + 'المفتاح العام للخادم</button><hr><button class="item danger" data-a="logout" type="button">' + I('logout', 18) + 'تسجيل الخروج</button>'
function wireMenu(btn, menu) {
  menu.innerHTML = menuHtml
  btn.onclick = e => { e.stopPropagation(); menu.classList.toggle('hidden') }
  menu.querySelector('[data-a=reload]').onclick = () => { menu.classList.add('hidden'); reloadAll() }
  menu.querySelector('[data-a=pk]').onclick = () => { menu.classList.add('hidden'); go('settings'); setTimeout(() => $('integ').scrollIntoView({ behavior: 'smooth' }), 100) }
  menu.querySelector('[data-a=logout]').onclick = () => logout()
}
wireMenu($('userBtn'), $('userMenu')); wireMenu($('userBtnTop'), $('userMenuTop'))
document.addEventListener('click', () => document.querySelectorAll('.menu').forEach(m => m.classList.add('hidden')))
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('askHost').innerHTML) $('askHost').innerHTML = ''; else if (sheetHost.children.length) closeSheet(); else document.querySelectorAll('.menu').forEach(m => m.classList.add('hidden')); return }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName)
  if (typing || e.ctrlKey || e.metaKey || e.altKey || $('app').classList.contains('hidden') || sheetHost.children.length || $('askHost').innerHTML) return
  if (e.key === '/') { e.preventDefault(); const box = VIEW === 'devices' ? $('dq') : VIEW === 'cloud' ? $('clq') : VIEW === 'codes' ? $('cq') : window.innerWidth >= 1024 ? $('gs') : null; if (box) box.focus(); else { go('codes'); setTimeout(() => $('cq').focus(), 50) } }
  else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); generateSheet() }
  else if (e.key >= '1' && e.key <= '6') go(VIEWS[+e.key - 1][0])
})
$('gs').addEventListener('keydown', e => { if (e.key === 'Enter') { const v = $('gs').value.trim(); $('gs').value = ''; globalSearch(v) } })
function globalSearch(v) {
  if (!v) return
  if (/^[0-9A-Za-z]{4}-?[0-9A-Za-z]{4}$/.test(v)) { openDeviceByShort(v); return }
  if (/^[0-9A-Za-z]{4}-?[0-9A-Za-z]{4}-?[0-9A-Za-z]{4}$/.test(v)) { openCode(v); return }
  CQ.q = v; CQ.page = 1; $('cq').value = v; go('codes'); loadCodes()
}

// ---- dashboard
const tipEl = $('tip')
function showTip(html, x, y) { tipEl.innerHTML = html; tipEl.style.display = 'block'; const w = tipEl.offsetWidth, hh = tipEl.offsetHeight; tipEl.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px'; tipEl.style.top = Math.max(8, y - hh - 12) + 'px' }
const hideTip = () => { tipEl.style.display = 'none' }
function kpi(k, v, s, cls, icon, view) { return '<button class="kpi ' + (cls || '') + '" data-go="' + (view || '') + '" type="button"><span class="k">' + I(icon || 'chart', 16) + esc(k) + '</span><span class="v num">' + v + '</span><span class="s">' + esc(s || '') + '</span></button>' }
function barChart(days) {
  const W = 600, H = 170, padB = 22, padT = 14, padL = 24, n = days.length, max = Math.max(1, ...days.map(d => Math.max(d.binds, d.trials)))
  const bw = (W - padL) / n, inner = H - padB - padT, y = v => padT + inner - (v / max) * inner
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max]
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="التفعيلات يومياً">'
  ticks.forEach(t => { s += '<line class="gl" x1="' + padL + '" x2="' + W + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text class="ax" x="' + (padL - 6) + '" y="' + (y(t) + 3) + '" text-anchor="end">' + t + '</text>' })
  const pts = []
  days.forEach((d, i) => {
    const x0 = padL + i * bw, w = Math.max(3, bw * .55), x = x0 + (bw - w) / 2, hb = Math.max(d.binds ? 3 : 0, (d.binds / max) * inner), r = Math.min(3, w / 2)
    if (d.binds) s += '<path class="bar" data-i="' + i + '" d="M' + x + ' ' + (padT + inner) + 'v' + (-(hb - r)) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' -' + r + 'h' + (w - 2 * r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r + 'v' + (hb - r) + 'z"/>'
    pts.push([x0 + bw / 2, y(d.trials)])
    if (i % 5 === 0 || i === n - 1) s += '<text class="ax" x="' + (x0 + bw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + new Date(d.day).getUTCDate() + '/' + (new Date(d.day).getUTCMonth() + 1) + '</text>'
  })
  s += '<path class="ln" d="' + pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('') + '"/>'
  pts.forEach((p, i) => { if (days[i].trials) s += '<circle class="dot2" r="3" cx="' + p[0] + '" cy="' + p[1] + '"/>' })
  s += '<rect x="' + padL + '" y="0" width="' + (W - padL) + '" height="' + H + '" fill="transparent" data-hover/></svg>'
  return [s, i => '<b>' + fmt(days[i].day) + '</b><br>تفعيلات: ' + days[i].binds + ' · تجارب: ' + days[i].trials, n, padL, W]
}
function lineChart(weeks) {
  const W = 600, H = 170, padB = 22, padT = 16, padL = 24, n = weeks.length, max = Math.max(1, ...weeks.map(w => Math.max(w.binds, w.trials)))
  const inner = H - padB - padT, step = (W - padL - 10) / (n - 1), x = i => padL + 5 + i * step, y = v => padT + inner - (v / max) * inner
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max]
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="الاتجاه الأسبوعي">'
  ticks.forEach(t => { s += '<line class="gl" x1="' + padL + '" x2="' + W + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text class="ax" x="' + (padL - 6) + '" y="' + (y(t) + 3) + '" text-anchor="end">' + t + '</text>' })
  const path = key => weeks.map((w, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(w[key]).toFixed(1)).join('')
  s += '<path class="ar" d="' + path('binds') + 'L' + x(n - 1) + ' ' + y(0) + 'L' + x(0) + ' ' + y(0) + 'z"/>'
  s += '<path class="ln" d="' + path('trials') + '"/><path class="ln2" d="' + path('binds') + '"/>'
  weeks.forEach((w, i) => { s += '<circle class="dot" r="3.5" cx="' + x(i) + '" cy="' + y(w.binds) + '"/>'; if (i % 3 === 0 || i === n - 1) s += '<text class="ax" x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + new Date(w.from).getUTCDate() + '/' + (new Date(w.from).getUTCMonth() + 1) + '</text>' })
  const last = weeks[n - 1]; s += '<text class="lbl" x="' + (x(n - 1) - 6) + '" y="' + (y(last.binds) - 8) + '" text-anchor="end">' + last.binds + '</text>'
  s += '<rect x="' + padL + '" y="0" width="' + (W - padL) + '" height="' + H + '" fill="transparent" data-hover/></svg>'
  return [s, i => '<b>أسبوع ' + fmt(weeks[i].from) + '</b><br>تفعيلات: ' + weeks[i].binds + ' · تجارب: ' + weeks[i].trials, n, padL, W]
}
function mountChart(host, built) {
  const [svg, tip, n, padL, W] = built
  host.innerHTML = svg
  const el = host.querySelector('svg'), hov = host.querySelector('[data-hover]')
  const at = e => { const r = el.getBoundingClientRect(); const px = (W - padL) * (1 - (e.clientX - r.left) / r.width); return Math.max(0, Math.min(n - 1, Math.floor((px) / ((W - padL) / n)))) }
  const move = e => { const i = at(e); el.querySelectorAll('.bar').forEach(b => b.classList.toggle('dim', +b.dataset.i !== i)); showTip(tip(i), e.clientX, e.clientY) }
  let touchAt = 0   // a tap also fires synthetic mouse events (and a mouseleave) right after: those must not hide the tip
  hov.addEventListener('mousemove', move); hov.addEventListener('touchstart', e => { touchAt = Date.now(); move(e.touches[0]) }, { passive: true }); hov.addEventListener('touchmove', e => move(e.touches[0]), { passive: true })
  const leave = () => { hideTip(); el.querySelectorAll('.bar').forEach(b => b.classList.remove('dim')) }
  hov.addEventListener('mouseleave', () => { if (Date.now() - touchAt > 2000) leave() }); hov.addEventListener('touchend', () => setTimeout(leave, 1800))
}
async function loadHome() {
  $('kpis').innerHTML = Array.from({ length: 8 }, () => '<div class="kpi"><div class="skel t"></div><div class="skel v"></div></div>').join('')
  $('feed').innerHTML = skel(4); $('plat').innerHTML = skel(2)
  let d
  try { d = await get('dashboard') } catch (e) { $('kpis').innerHTML = empty('alert', 'تعذّر تحميل اللوحة', e.message, '<button class="btn soft sm" onclick="loadHome()">إعادة المحاولة</button>'); return }
  const k = d.kpis
  $('kpis').innerHTML = kpi('تراخيص فعّالة', N(k.active), N(k.unused) + ' غير مستخدم · ' + N(k.revoked) + ' ملغى', 'brand', 'key', 'codes:active')
    + kpi('مُفعّل هذا الشهر', N(k.soldMonth), 'كود جديد رُبط بجهاز', '', 'chart', 'codes:active')
    + kpi('تجارب جارية', N(k.trials), N(k.trialTotal) + ' تجربة منذ البداية', '', 'clock', 'devices:trial')
    + kpi('تحوّل التجربة إلى شراء', k.conversion == null ? '—' : k.conversion + '%', N(k.converted) + ' من ' + N(k.trialTotal) + ' اشتروا', '', 'users', 'devices:licensed')
    + kpi('أجهزة نشطة (24 ساعة)', N(k.seen24), N(k.seen7) + ' خلال أسبوع · ' + N(k.devices) + ' إجمالاً', '', 'phone', 'devices')
    + kpi('مشتركو السحابة', N(k.cloud), kb(k.bytes) + ' في ' + N(k.backups) + ' نسخة', '', 'cloud', 'cloud')
    + kpi('سحابة تنتهي خلال 30 يوماً', N(k.cloudSoon), k.cloudSoon ? 'تواصل معهم للتجديد' : 'لا شيء قريب', k.cloudSoon ? 'warn' : '', 'alert', 'cloud:expiring')
    + kpi('محاولات فاشلة (24 ساعة)', N(k.fails24), k.blocked ? N(k.blocked) + ' جهاز موقوف' : 'تفعيل، تجربة أو تحقق مرفوض', k.fails24 > 20 ? 'bad' : '', 'shield', 'log:fail')
  $('kpis').querySelectorAll('[data-go]').forEach(b => b.onclick = () => jump(b.dataset.go))
  const sum30 = d.days.reduce((s, x) => s + x.binds, 0), sumW = d.weeks.reduce((s, x) => s + x.binds, 0)
  $('c30Sum').textContent = N(sum30) + ' تفعيل'; $('c12Sum').textContent = N(sumW) + ' تفعيل'
  if (sum30 || d.days.some(x => x.trials)) mountChart($('chart30'), barChart(d.days)); else $('chart30').innerHTML = empty('chart', 'لا تفعيلات بعد', 'ستظهر هنا التفعيلات والتجارب يوماً بيوم.')
  if (sumW || d.weeks.some(x => x.trials)) mountChart($('chart12'), lineChart(d.weeks)); else $('chart12').innerHTML = empty('chart', 'لا بيانات بعد', '')
  const COLORS = { android: 'var(--brand)', electron: 'var(--info)', web: 'var(--violet)' }
  const total = d.platforms.reduce((s, p) => s + p.n, 0)
  $('platSum').textContent = N(total) + ' جهاز'
  $('plat').innerHTML = total ? '<div class="hbar">' + d.platforms.map(p => '<i style="width:' + (100 * p.n / total).toFixed(1) + '%;background:' + (COLORS[p.platform] || 'var(--text-3)') + '" title="' + esc(platName(p.platform)) + '"></i>').join('') + '</div><div class="plat">'
    + d.platforms.map(p => '<div class="p"><i style="background:' + (COLORS[p.platform] || 'var(--text-3)') + '"></i>' + platIcon(p.platform) + '<span>' + esc(platName(p.platform)) + '</span><span class="faint">' + N(p.licensed) + ' مرخّص · ' + N(p.trials) + ' تجربة</span><span class="n b">' + N(p.n) + '</span></div>').join('') + '</div>'
    : empty('phone', 'لا أجهزة بعد', 'يظهر هنا كل جهاز يتصل بالخادم.')
  $('quick').innerHTML = act('plus', 'إنشاء أكواد', 'new', 'brand') + act('search', 'بحث برمز الجهاز', 'find') + act('settings', 'الإعدادات', 'settings') + act('list', 'المحاولات الفاشلة', 'fails') + act('cloud', 'السحابة', 'cloud') + act('download', 'تصدير السجل CSV', 'csv')
  $('quick').querySelector('[data-a=new]').onclick = () => generateSheet()
  $('quick').querySelector('[data-a=find]').onclick = findDeviceDialog
  $('quick').querySelector('[data-a=settings]').onclick = () => go('settings')
  $('quick').querySelector('[data-a=fails]').onclick = () => jump('log:fail')
  $('quick').querySelector('[data-a=cloud]').onclick = () => go('cloud')
  $('quick').querySelector('[data-a=csv]').onclick = () => exportCsv({ kind: 'nocheck' })
  $('cloudSoonBox').innerHTML = d.cloudSoon.length ? '<h3 style="margin-bottom:8px">سحابة تنتهي قريباً</h3>' + d.cloudSoon.map(c => '<div class="row spread" style="padding:6px 0;border-top:1px solid var(--border)"><span class="lnk mono sb" data-code="' + esc(c.code) + '" style="cursor:pointer;color:var(--brand-ink)">' + esc(c.code) + '</span><span class="truncate muted grow">' + esc(c.note) + '</span><span class="tag warn">' + inDays(c.cloud_until) + '</span></div>').join('') : ''
  wireLinks($('cloudSoonBox'))
  $('feed').innerHTML = d.recent.length ? d.recent.map(e => eventHtml(e)).join('') : empty('list', 'لا أحداث بعد', 'أول تفعيل أو تجربة سيظهر هنا.')
  wireLinks($('feed'))
  $('feedMore').onclick = () => go('log')
}
function jump(spec) {
  const [v, f] = spec.split(':')
  if (v === 'codes') { CQ.status = f || ''; CQ.page = 1; go('codes'); loadCodes() }
  else if (v === 'devices') { DQ.state = f || ''; DQ.page = 1; go('devices'); loadDevices() }
  else if (v === 'cloud') { CLQ.status = f || 'active'; CLQ.page = 1; go('cloud') }
  else if (v === 'log') { $('lKind').value = f || 'nocheck'; LQ.page = 1; go('log'); loadLog() }
  else go(v)
}
async function findDeviceDialog() {
  const f = await dialog('بحث برمز الجهاز', '<div><label class="l">رمز الجهاز كما يقرؤه العميل من شاشة التفعيل</label><input class="in mono" name="v" placeholder="XXXX-XXXX" autocomplete="off" maxlength="9" style="font-size:20px;text-align:center"></div>', { ok: 'بحث', validate: fm => /^[0-9A-Za-z]{4}-?[0-9A-Za-z]{4}$/.test(fm.v.value.trim()) ? '' : 'الرمز ثمانية أحرف: XXXX-XXXX' })
  if (f) openDeviceByShort(f.v.value.trim())
}
`

export const ADMIN_JS = JS1 + ADMIN_JS2
