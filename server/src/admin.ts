// The seller's control panel, served at /admin. It holds no secrets: it asks for the admin key and
// keeps it in this browser only, then talks to /v1/admin/*.
export const ADMIN_PAGE = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>لوحة التحكم — Emar</title>
<style>
:root{--bg:#f5f6f8;--card:#fff;--text:#1f2328;--muted:#667085;--line:#e3e6ea;--blue:#1899d6;--green:#46a302;--red:#d93025;--amber:#b86e00}
@media (prefers-color-scheme:dark){:root{--bg:#10181c;--card:#18242a;--text:#eef3f6;--muted:#9fb0b8;--line:#2d3b42}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:980px;margin:0 auto;padding:16px}
h1{font-size:20px;margin:6px 0 14px}h2{font-size:16px;margin:0 0 10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
label{display:block;font-size:13px;font-weight:700;margin:10px 0 4px}
input,select{width:100%;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text);font-size:15px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
button{padding:10px 14px;border:0;border-radius:10px;background:var(--blue);color:#fff;font-weight:800;font-size:14px;cursor:pointer}
button.ghost{background:transparent;color:var(--blue);border:1px solid var(--blue)}
button.red{background:var(--red)}button.small{padding:6px 9px;font-size:12px}
.tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}.tabs button{background:var(--card);color:var(--text);border:1px solid var(--line)}.tabs button.on{background:var(--blue);color:#fff}
.mono{font-family:ui-monospace,Menlo,monospace;direction:ltr;unicode-bidi:isolate}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:7px 5px;border-bottom:1px solid var(--line);text-align:right;vertical-align:top}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700}
.b-new{background:#e7f3ff;color:var(--blue)}.b-used{background:#e8f6df;color:var(--green)}.b-rev{background:#fde8e7;color:var(--red)}.b-exp{background:#fff1d6;color:var(--amber)}
.muted{color:var(--muted);font-size:13px}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.stat{font-size:26px;font-weight:900}.hidden{display:none}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.cardcode{border:2px dashed var(--line);border-radius:12px;padding:10px;text-align:center}.cardcode b{font-size:19px;letter-spacing:1px}
@media print{body{background:#fff}.noprint{display:none!important}.card{border:0}.cardcode{break-inside:avoid;border-color:#999}}
</style></head><body><main>
<h1>🔑 لوحة تحكم أكواد Emar</h1>
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
        <div><label>التطبيق</label><select id="book"><option value="g12">البكالوريا العلمي (Emar 12)</option><option value="g11">الحادي عشر (Emar 11)</option><option value="g8">الثامن (Emar 8)</option><option value="g5">الخامس (Emar 5)</option></select></div>
        <div><label>عدد الأكواد</label><input id="count" type="number" min="1" max="500" value="1"></div>
        <div><label>المدة</label><select id="valid"><option value="year">حتى نهاية العام الدراسي</option><option value="life">دائم</option><option value="date">حتى تاريخ…</option></select><input id="date" type="date" class="hidden" style="margin-top:6px"></div>
        <div><label>البائع (أستاذ / مكتبة / مباشر)</label><input id="seller" placeholder="مباشر"></div>
      </div>
      <label>ملاحظة (اسم الطالب، المبلغ، طريقة الدفع…)</label><input id="note">
      <div class="row" style="margin-top:12px"><button id="make">أنشئ الأكواد</button></div>
    </div>
    <div id="made" class="card hidden">
      <div class="row noprint" style="justify-content:space-between"><h2 id="madeTitle"></h2><div class="row"><button class="ghost small" id="copyAll">نسخ الكل</button><button class="ghost small" id="copyMsg">نسخ رسالة لطالب</button><button class="small" onclick="print()">طباعة كبطاقات</button></div></div>
      <div id="cards" class="cards"></div>
    </div>
  </section>

  <section id="t-find" class="hidden">
    <div class="card">
      <div class="grid">
        <div><label>بحث (كود، ملاحظة، بائع)</label><input id="q" placeholder="مثلاً: أحمد أو 7KQ2"></div>
        <div><label>التطبيق</label><select id="fbook"><option value="">الكل</option><option value="g12">البكالوريا</option><option value="g11">الحادي عشر</option><option value="g8">الثامن</option><option value="g5">الخامس</option></select></div>
        <div><label>الحالة</label><select id="fstatus"><option value="">الكل</option><option value="new">غير مستخدم</option><option value="used">مفعّل</option><option value="revoked">ملغى</option></select></div>
      </div>
      <div class="row" style="margin-top:10px"><button id="find">بحث</button></div>
    </div>
    <div class="card" style="overflow-x:auto"><table><thead><tr><th>الكود</th><th>التطبيق</th><th>الحالة</th><th>ينتهي</th><th>البائع / ملاحظة</th><th>آخر استخدام</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>
  </section>

  <section id="t-stats" class="hidden">
    <div id="statCards" class="grid"></div>
    <div class="card" style="margin-top:12px"><h2>آخر الأحداث</h2><table><tbody id="events"></tbody></table></div>
  </section>
</div>
</main>
<script>
const $ = id => document.getElementById(id)
const NAMES = { g12: 'البكالوريا العلمي — Emar 12', g11: 'الحادي عشر — Emar 11', g8: 'الثامن — Emar 8', g5: 'الخامس — Emar 5' }
let KEY = localStorage.getItem('emar.admin') || ''
const api = async (path, opts = {}) => {
  const r = await fetch('/v1/admin/' + path, { ...opts, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || r.status)
  return j
}
const fmt = ms => ms ? new Date(ms).toLocaleDateString('ar-SY', { year: 'numeric', month: 'short', day: 'numeric' }) : 'دائم'
const when = ms => ms ? new Date(ms).toLocaleString('ar-SY', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
function yearEnd() { const d = new Date(); const y = d.getMonth() >= 8 ? d.getFullYear() + 1 : d.getFullYear(); return Date.UTC(y, 7, 31, 23, 59) }
function expiry() { const v = $('valid').value; if (v === 'life') return null; if (v === 'date' && $('date').value) return new Date($('date').value + 'T23:59:00Z').getTime(); return yearEnd() }

async function enter() {
  KEY = $('key').value.trim() || KEY
  try { await api('stats'); localStorage.setItem('emar.admin', KEY); $('login').classList.add('hidden'); $('app').classList.remove('hidden') }
  catch { $('loginErr').textContent = 'المفتاح غير صحيح.' }
}
$('enter').onclick = enter
$('logout').onclick = () => { localStorage.removeItem('emar.admin'); location.reload() }
if (KEY) enter()

document.querySelectorAll('.tabs button[data-t]').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button[data-t]').forEach(x => x.classList.toggle('on', x === b))
  ;['make', 'find', 'stats'].forEach(t => $('t-' + t).classList.toggle('hidden', t !== b.dataset.t))
  if (b.dataset.t === 'stats') stats()
  if (b.dataset.t === 'find') find()
})
$('valid').onchange = () => $('date').classList.toggle('hidden', $('valid').value !== 'date')

let last = null
$('make').onclick = async () => {
  const book = $('book').value
  try {
    last = await api('codes', { method: 'POST', body: JSON.stringify({ book, count: +$('count').value, expiresAt: expiry(), seller: $('seller').value, note: $('note').value }) })
    $('made').classList.remove('hidden')
    $('madeTitle').textContent = last.codes.length + ' كود · ' + NAMES[book] + ' · ' + (last.expiresAt ? 'حتى ' + fmt(last.expiresAt) : 'دائم')
    $('cards').innerHTML = last.codes.map(c => '<div class="cardcode"><div class="muted">' + NAMES[book] + '</div><b class="mono">' + c + '</b><div class="muted">افتح التطبيق ← 🔑 فعّل ← أدخل الكود<br>' + (last.expiresAt ? 'صالح حتى ' + fmt(last.expiresAt) : 'اشتراك دائم') + ' · لجهاز واحد</div></div>').join('')
  } catch (e) { alert('تعذّر الإنشاء: ' + e.message) }
}
const copy = t => navigator.clipboard.writeText(t).then(() => alert('نُسخ ✓'), () => prompt('انسخ:', t))
$('copyAll').onclick = () => last && copy(last.codes.join('\\n'))
$('copyMsg').onclick = () => last && copy('شكراً لاشتراكك في ' + NAMES[last.book] + ' 🌟\\nكود التفعيل: ' + last.codes[0] + '\\nافتح التطبيق وأنت متصل بالإنترنت ← اضغط «🔑 فعّل» ← أدخل الكود ← تفعيل.\\nالكود يعمل على جهاز واحد فقط' + (last.expiresAt ? '، وصالح حتى ' + fmt(last.expiresAt) : '') + '.')

function badge(r) {
  if (r.revoked) return '<span class="badge b-rev">ملغى</span>'
  if (r.expires_at && r.expires_at < Date.now()) return '<span class="badge b-exp">منتهي</span>'
  return r.device ? '<span class="badge b-used">مفعّل</span>' : '<span class="badge b-new">غير مستخدم</span>'
}
async function find() {
  const qs = new URLSearchParams({ q: $('q').value, book: $('fbook').value, status: $('fstatus').value })
  try {
    const { codes } = await api('codes?' + qs)
    $('rows').innerHTML = codes.map(r => '<tr><td class="mono">' + r.code + '</td><td>' + r.book + '</td><td>' + badge(r) + (r.moves ? '<div class="muted">نُقل ' + r.moves + '×</div>' : '') + '</td><td>' + fmt(r.expires_at) + '</td><td>' + esc(r.seller) + '<div class="muted">' + esc(r.note) + '</div></td><td>' + when(r.last_seen) + '</td><td class="row">'
      + (r.revoked ? '<button class="small ghost" data-a="restore" data-c="' + r.code + '">استعادة</button>' : '<button class="small red" data-a="revoke" data-c="' + r.code + '">إلغاء</button>')
      + (r.device ? '<button class="small ghost" data-a="unbind" data-c="' + r.code + '">نقل لجهاز جديد</button>' : '')
      + '<button class="small ghost" data-a="note" data-c="' + r.code + '">ملاحظة</button></td></tr>').join('') || '<tr><td colspan="7" class="muted">لا نتائج</td></tr>'
  } catch (e) { alert(e.message) }
}
$('find').onclick = find
$('rows').onclick = async e => {
  const b = e.target.closest('button[data-a]'); if (!b) return
  const a = b.dataset.a, code = b.dataset.c
  const ask = { revoke: 'إلغاء هذا الكود؟ سيتوقف التطبيق عند صاحبه.', unbind: 'نقل الكود؟ سيتوقف على الجهاز القديم ويمكن تفعيله على جهاز جديد.' }
  if (ask[a] && !confirm(ask[a])) return
  const note = a === 'note' ? prompt('الملاحظة:') : undefined
  if (a === 'note' && note === null) return
  try { await api('code', { method: 'POST', body: JSON.stringify({ code, action: a, note }) }); find() } catch (err) { alert(err.message) }
}
async function stats() {
  try {
    const s = await api('stats')
    $('statCards').innerHTML = s.books.map(b => '<div class="card"><div class="muted">' + (NAMES[b.book] || b.book) + '</div><div class="stat">' + (b.activated || 0) + ' / ' + b.total + '</div><div class="muted">مفعّل / كل الأكواد · نشِط هذا الأسبوع: ' + (b.active7 || 0) + ' · ملغى: ' + (b.revoked || 0) + '</div></div>').join('') || '<div class="card muted">لا أكواد بعد.</div>'
    $('events').innerHTML = s.recent.map(e => '<tr><td>' + when(e.at) + '</td><td>' + esc(e.kind) + '</td><td class="mono">' + esc(e.code || '') + '</td><td>' + esc(e.detail || '') + '</td></tr>').join('')
  } catch (e) { alert(e.message) }
}
</script></body></html>`
