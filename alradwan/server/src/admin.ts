// The seller's control panel, served at /admin. It holds no secrets: it asks for the admin key and
// keeps it in this browser only, then talks to /api/admin/*.
export const ADMIN_PAGE = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>لوحة التحكم — كراج الرضوان</title>
<style>
:root{--bg:#f1f5f9;--card:#fff;--text:#0f172a;--muted:#526174;--line:#e2e8f0;--accent:#cf4a08;--green:#15803d;--red:#dc2626;--amber:#b45309;--blue:#2563eb}
@media (prefers-color-scheme:dark){:root{--bg:#0b1220;--card:#111a2e;--text:#e5ecf7;--muted:#8ea0bd;--line:#243049}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}
main{max-width:1040px;margin:0 auto;padding:16px}
h1{font-size:20px;margin:6px 0 14px}h2{font-size:16px;margin:0 0 10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
label{display:block;font-size:13px;font-weight:700;margin:10px 0 4px}
input,select{width:100%;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text);font-size:15px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
button{padding:10px 14px;border:0;border-radius:10px;background:var(--accent);color:#fff;font-weight:800;font-size:14px;cursor:pointer}
button.ghost{background:transparent;color:var(--accent);border:1px solid var(--accent)}
button.red{background:var(--red)}button.small{padding:6px 9px;font-size:12px}
.tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}.tabs button{background:var(--card);color:var(--text);border:1px solid var(--line)}.tabs button.on{background:var(--accent);color:#fff}
.mono{font-family:ui-monospace,Menlo,monospace;direction:ltr;unicode-bidi:isolate}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:7px 5px;border-bottom:1px solid var(--line);text-align:right;vertical-align:top}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700}
.b-new{background:#dbeafe;color:var(--blue)}.b-used{background:#dcfce7;color:var(--green)}.b-rev{background:#fee2e2;color:var(--red)}.b-exp{background:#fef3c7;color:var(--amber)}
.muted{color:var(--muted);font-size:13px}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.stat{font-size:26px;font-weight:900}.hidden{display:none}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}
.cardcode{border:2px dashed var(--line);border-radius:12px;padding:10px;text-align:center}.cardcode b{font-size:19px;letter-spacing:1px}
@media print{body{background:#fff}.noprint{display:none!important}.card{border:0}.cardcode{break-inside:avoid;border-color:#999}}
</style></head><body><main>
<h1>🔑 لوحة تحكم أكواد كراج الرضوان</h1>
<div id="login" class="card">
  <h2>الدخول</h2>
  <p class="muted">أدخل مفتاح الإدارة (ADMIN_KEY). يُحفظ في هذا المتصفح فقط.</p>
  <input id="key" type="password" class="mono" placeholder="ADMIN_KEY">
  <div class="row" style="margin-top:10px"><button id="enter">دخول</button></div>
  <p id="loginErr" class="muted" style="color:var(--red)"></p>
</div>
<div id="app" class="hidden">
  <div class="tabs noprint"><button data-t="make" class="on">إنشاء أكواد</button><button data-t="find">البحث والإدارة</button><button data-t="stats">الإحصاءات</button><button class="ghost" id="logout">خروج</button></div>

  <section id="t-make">
    <div class="card noprint">
      <div class="grid">
        <div><label>الاشتراك</label><select id="plan"><option value="year">سنة من اليوم</option><option value="month">شهر من اليوم</option><option value="life">دائم</option><option value="date">حتى تاريخ…</option></select><input id="date" type="date" class="hidden" style="margin-top:6px"></div>
        <div><label>عدد الأجهزة لكل كود</label><select id="devices"><option value="1">جهاز واحد</option><option value="2" selected>جهازان (حاسوب + هاتف)</option><option value="3">3 أجهزة</option><option value="5">5 أجهزة</option></select></div>
        <div><label>عدد الأكواد</label><input id="count" type="number" min="1" max="200" value="1"></div>
        <div><label>البائع / الوكيل</label><input id="seller" placeholder="مباشر"></div>
      </div>
      <div class="grid"><div><label>اسم المحل (اختياري)</label><input id="shop" placeholder="مثال: كراج الرضوان — حمص"></div><div><label>ملاحظة (صاحب المحل، المبلغ، طريقة الدفع…)</label><input id="note"></div></div>
      <div class="row" style="margin-top:12px"><button id="make">أنشئ الأكواد</button></div>
    </div>
    <div id="made" class="card hidden">
      <div class="row noprint" style="justify-content:space-between"><h2 id="madeTitle"></h2><div class="row"><button class="ghost small" id="copyAll">نسخ الكل</button><button class="ghost small" id="copyMsg">نسخ رسالة للزبون</button><button class="small" onclick="print()">طباعة كبطاقات</button></div></div>
      <div id="cards" class="cards"></div>
    </div>
  </section>

  <section id="t-find" class="hidden">
    <div class="card">
      <div class="grid">
        <div><label>بحث (كود، اسم المحل، ملاحظة، بائع، رقم جهاز)</label><input id="q" placeholder="مثلاً: الرضوان أو 7KQ2 أو رقم الجهاز 0E8D310E"></div>
        <div><label>الحالة</label><select id="fstatus"><option value="">الكل</option><option value="new">غير مستخدم</option><option value="used">مفعّل</option><option value="expired">منتهي</option><option value="revoked">ملغى</option></select></div>
      </div>
      <div class="row" style="margin-top:10px"><button id="find">بحث</button></div>
    </div>
    <div class="card" style="overflow-x:auto"><table><thead><tr><th>الكود</th><th>المحل</th><th>الحالة</th><th>الأجهزة</th><th>ينتهي</th><th>البائع / ملاحظة</th><th>آخر استخدام</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>
  </section>

  <section id="t-stats" class="hidden">
    <div id="statCards" class="grid"></div>
    <div class="card" style="margin-top:12px"><h2>اشتراكات تنتهي خلال 30 يوماً</h2><table><tbody id="soon"></tbody></table></div>
    <div class="card"><h2>آخر الأحداث</h2><table><tbody id="events"></tbody></table></div>
  </section>
</div>
</main>
<script>
const $ = id => document.getElementById(id)
let KEY = localStorage.getItem('alradwan.admin') || ''
const api = async (path, opts = {}) => {
  const r = await fetch('/api/admin/' + path, { ...opts, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || r.status)
  return j
}
const fmt = ms => ms ? new Date(ms).toLocaleDateString('ar-SY', { year: 'numeric', month: 'short', day: 'numeric' }) : 'دائم'
const when = ms => ms ? new Date(ms).toLocaleString('ar-SY', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const DAY = 86400000
function expiry() { const v = $('plan').value; if (v === 'life') return null; if (v === 'month') return Date.now() + 31 * DAY; if (v === 'date') { const t = new Date($('date').value + 'T23:59:00').getTime(); if (!Number.isFinite(t)) throw new Error('اختر التاريخ'); return t } return Date.now() + 366 * DAY }

async function enter() {
  KEY = $('key').value.trim() || KEY
  try { await api('stats'); localStorage.setItem('alradwan.admin', KEY); $('login').classList.add('hidden'); $('app').classList.remove('hidden') }
  catch (e) { $('loginErr').textContent = e.message === 'not-configured' ? 'لم يُضبط ADMIN_KEY على الخادم بعد.' : e.message === 'wait' ? 'محاولات كثيرة: انتظر ربع ساعة.' : /fetch|network/i.test(e.message) ? 'تعذّر الوصول إلى الخادم.' : 'المفتاح غير صحيح.' }
}
$('enter').onclick = enter
$('key').onkeydown = e => { if (e.key === 'Enter') enter() }
$('logout').onclick = () => { localStorage.removeItem('alradwan.admin'); location.reload() }
if (KEY) enter()

document.querySelectorAll('.tabs button[data-t]').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button[data-t]').forEach(x => x.classList.toggle('on', x === b))
  ;['make', 'find', 'stats'].forEach(t => $('t-' + t).classList.toggle('hidden', t !== b.dataset.t))
  if (b.dataset.t === 'stats') stats()
  if (b.dataset.t === 'find') find()
})
$('plan').onchange = () => $('date').classList.toggle('hidden', $('plan').value !== 'date')

let last = null
$('make').onclick = async () => {
  try {
    const expiresAt = expiry()
    last = await api('codes', { method: 'POST', body: JSON.stringify({ plan: $('plan').value, count: +$('count').value, expiresAt, maxDevices: +$('devices').value, seller: $('seller').value, note: $('note').value, shopName: $('shop').value }) })
    $('made').classList.remove('hidden')
    $('madeTitle').textContent = last.codes.length + ' كود · ' + (last.expiresAt ? 'حتى ' + fmt(last.expiresAt) : 'دائم') + ' · ' + last.maxDevices + ' جهاز'
    $('cards').innerHTML = last.codes.map(c => '<div class="cardcode"><div class="muted">كراج الرضوان — نظام إدارة قطع الغيار</div><b class="mono">' + c + '</b><div class="muted">افتح البرنامج ← تفعيل ← أدخل الكود<br>' + (last.expiresAt ? 'صالح حتى ' + fmt(last.expiresAt) : 'اشتراك دائم') + ' · ' + last.maxDevices + ' جهاز</div></div>').join('')
  } catch (e) { alert('تعذّر الإنشاء: ' + e.message) }
}
const copy = t => navigator.clipboard.writeText(t).then(() => alert('نُسخ ✓'), () => prompt('انسخ:', t))
$('copyAll').onclick = () => last && copy(last.codes.join('\\n'))
$('copyMsg').onclick = () => last && copy('شكراً لاشتراكك في برنامج كراج الرضوان 🌟\\nكود التفعيل: ' + last.codes[0] + '\\nافتح البرنامج وأنت متصل بالإنترنت ← الإعدادات ← حول ← تفعيل ← أدخل الكود.\\nالكود يعمل على ' + last.maxDevices + ' جهاز' + (last.expiresAt ? '، وصالح حتى ' + fmt(last.expiresAt) : '') + '.')

function badge(r) {
  if (r.revoked) return '<span class="badge b-rev">ملغى</span>'
  if (r.expires_at && r.expires_at < Date.now()) return '<span class="badge b-exp">منتهي</span>'
  return r.devices ? '<span class="badge b-used">مفعّل</span>' : '<span class="badge b-new">غير مستخدم</span>'
}
async function find() {
  const qs = new URLSearchParams({ q: $('q').value, status: $('fstatus').value })
  try {
    const { codes } = await api('codes?' + qs)
    $('rows').innerHTML = codes.map(r => '<tr><td class="mono">' + r.code + '</td><td>' + esc(r.shop_name) + '</td><td>' + badge(r) + (r.moves ? '<div class="muted">نُقل ' + r.moves + '×</div>' : '') + '</td><td>' + r.devices + ' / ' + r.max_devices + '</td><td>' + fmt(r.expires_at) + '</td><td>' + esc(r.seller) + '<div class="muted">' + esc(r.note) + '</div></td><td>' + when(r.last_seen) + '</td><td class="row">'
      + (r.revoked ? '<button class="small ghost" data-a="restore" data-c="' + r.code + '">استعادة</button>' : '<button class="small red" data-a="revoke" data-c="' + r.code + '">إلغاء</button>')
      + (r.devices ? '<button class="small ghost" data-a="devices" data-c="' + r.code + '">الأجهزة</button>' : '')
      + '<button class="small ghost" data-a="expiry" data-c="' + r.code + '">تمديد</button>'
      + '<button class="small ghost" data-a="max" data-c="' + r.code + '" data-m="' + r.max_devices + '">عدد الأجهزة</button>'
      + '<button class="small ghost" data-a="note" data-c="' + r.code + '" data-n="' + esc(r.note) + '" data-s="' + esc(r.shop_name) + '">ملاحظة</button></td></tr>').join('') || '<tr><td colspan="8" class="muted">لا نتائج</td></tr>'
  } catch (e) { alert(e.message) }
}
$('find').onclick = find
$('q').onkeydown = e => { if (e.key === 'Enter') find() }
$('rows').onclick = async e => {
  const b = e.target.closest('button[data-a]'); if (!b) return
  const a = b.dataset.a, code = b.dataset.c
  const ask = { revoke: 'إلغاء هذا الكود؟ سيتوقف البرنامج عند صاحبه عند أول اتصال.', unbind: 'فك كل الأجهزة عن هذا الكود؟ سيحتاج الزبون إلى إدخال الكود مرة أخرى على أجهزته.' }
  if (ask[a] && !confirm(ask[a])) return
  const payload = { code, action: a }
  if (a === 'note') { const s = prompt('اسم المحل:', b.dataset.s || ''); if (s === null) return; const n = prompt('الملاحظة:', b.dataset.n || ''); if (n === null) return; payload.shopName = s; payload.note = n }
  if (a === 'expiry') { const d = prompt('التاريخ الجديد بالشكل 2027-12-31، أو اكتب "دائم" لاشتراك بلا نهاية:', ''); if (d === null) return; const t = d.trim(); if (t === 'دائم' || t.toLowerCase() === 'life') payload.expiresAt = null; else { if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || !Number.isFinite(new Date(t + 'T23:59:00').getTime())) { alert('التاريخ غير صحيح. اكتبه هكذا: 2027-12-31'); return } payload.expiresAt = new Date(t + 'T23:59:00').getTime() } }
  if (a === 'max') { const m = prompt('عدد الأجهزة المسموح لهذا الكود (1–10):', b.dataset.m || '2'); if (m === null) return; payload.action = 'devices'; payload.maxDevices = +m }
  if (a === 'devices') { showDevices(code); return }
  try { await api('code', { method: 'POST', body: JSON.stringify(payload) }); find() } catch (err) { alert(err.message) }
}
async function showDevices(code) {
  try {
    const { devices } = await api('devices?code=' + encodeURIComponent(code))
    const list = devices.map(d => '• ' + (d.name || 'جهاز') + ' — ' + d.device.slice(0, 8).toUpperCase() + ' — آخر استخدام ' + when(d.last_seen)).join('\\n') || 'لا أجهزة'
    const which = prompt('أجهزة الكود ' + code + ':\\n' + list + '\\n\\nلفك جهاز واحد اكتب أول 8 أحرف من رقمه، أو اكتب "الكل" لفك الجميع، أو ألغِ:', '')
    if (which === null || !which.trim()) return
    if (which.trim() === 'الكل') { if (!confirm('فك كل الأجهزة عن هذا الكود؟')) return; await api('code', { method: 'POST', body: JSON.stringify({ code, action: 'unbind' }) }) }
    else { const d = devices.find(x => x.device.toLowerCase().startsWith(which.trim().toLowerCase())); if (!d) { alert('لا جهاز بهذا الرقم'); return } await api('code', { method: 'POST', body: JSON.stringify({ code, action: 'unbind', device: d.device }) }) }
    find()
  } catch (e) { alert(e.message) }
}
async function stats() {
  try {
    const s = await api('stats')
    const t = s.stats || {}
    $('statCards').innerHTML = [['الأكواد المباعة', t.total], ['مفعّلة', t.activated], ['أجهزة نشطة', t.devices], ['استُخدمت هذا الأسبوع', t.active7], ['منتهية', t.expired], ['ملغاة', t.revoked]].map(([l, v]) => '<div class="card"><div class="muted">' + l + '</div><div class="stat">' + (v || 0) + '</div></div>').join('')
    $('soon').innerHTML = s.soon.map(r => '<tr><td class="mono">' + r.code + '</td><td>' + esc(r.shop_name) + '</td><td>' + fmt(r.expires_at) + '</td></tr>').join('') || '<tr><td class="muted">لا شيء</td></tr>'
    $('events').innerHTML = s.recent.map(e => '<tr><td>' + when(e.at) + '</td><td>' + esc(e.kind) + '</td><td class="mono">' + esc(e.code || '') + '</td><td>' + esc(e.detail || '') + '</td></tr>').join('')
  } catch (e) { alert(e.message) }
}
</script></body></html>`
