// Builds the seller's activation-code generator: one HTML file that works offline on a phone or computer.
//   node scripts/build-code-generator.mjs   -> dist/tools/code-generator.html
// Keep that file private: anyone who has it can make codes.
import { build } from 'esbuild'
import fs from 'fs'

const books = ['g8', 'g11', 'g12'].filter(b => fs.existsSync(`src/books/${b}/book.json`))
  .map(b => { const m = JSON.parse(fs.readFileSync(`src/books/${b}/book.json`, 'utf8')); return { id: m.id, name: `${m.appName} — ${m.titleAr}` } })
const js = (await build({ entryPoints: ['src/engine/license.ts'], bundle: true, format: 'iife', globalName: 'License', write: false, minify: true })).outputFiles[0].text

const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>مولّد أكواد التفعيل — Emar</title>
<style>
:root{--bg:#f7f7f7;--card:#fff;--text:#222;--muted:#666;--line:#ddd;--blue:#1cb0f6;--green:#58cc02}
@media (prefers-color-scheme:dark){:root{--bg:#131f24;--card:#1a2a31;--text:#eef;--muted:#9aa;--line:#37464f}}
body{margin:0;background:var(--bg);color:var(--text);font:16px system-ui,sans-serif}
main{max-width:560px;margin:0 auto;padding:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
h1{font-size:20px;margin:4px 0 12px}h2{font-size:16px;margin:0 0 8px}
label{display:block;margin:10px 0 4px;font-weight:700;font-size:14px}
input,select,textarea{width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:16px}
.ltr{direction:ltr;text-align:left;font-family:ui-monospace,monospace}
button{padding:11px 14px;border:0;border-radius:10px;background:var(--blue);color:#fff;font-weight:800;font-size:15px;cursor:pointer}
button.alt{background:transparent;color:var(--blue);border:1px solid var(--blue)}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.code{font:900 21px ui-monospace,monospace;letter-spacing:1px;text-align:center;padding:12px;border:2px dashed var(--green);border-radius:12px;margin:10px 0;direction:ltr}
.muted{color:var(--muted);font-size:13px}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{border-bottom:1px solid var(--line);padding:6px 4px;text-align:right}
.ok{color:#2e7d32}.bad{color:#c62828}
</style></head><body><main>
<h1>🔑 مولّد أكواد التفعيل</h1>
<p class="muted">هذه الصفحة خاصة بك وحدك: من يملكها يستطيع صنع أكواد. تعمل بدون إنترنت، ويُحفظ سجل الأكواد في هذا الجهاز فقط.</p>
<div class="card">
  <label>التطبيق</label><select id="book">${books.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}</select>
  <label>رقم جهاز الطالب (يظهر في شاشة التفعيل)</label><input id="device" class="ltr" placeholder="XXXX-XXXX" autocapitalize="characters">
  <label>المدة</label>
  <select id="valid"><option value="year">حتى نهاية العام الدراسي</option><option value="life">دائم</option><option value="date">حتى تاريخ أختاره</option></select>
  <input id="date" type="date" style="display:none;margin-top:6px">
  <label>اسم الطالب / ملاحظة (للسجل فقط)</label><input id="note" placeholder="مثلاً: أحمد — شام كاش — المبلغ">
  <div class="row"><button id="make">اصنع الكود</button></div>
  <div id="out" style="display:none">
    <div class="code" id="code"></div>
    <div class="muted" id="until"></div>
    <div class="row"><button id="copy">انسخ الكود</button><button class="alt" id="copymsg">انسخ رسالة للطالب</button></div>
  </div>
</div>
<div class="card">
  <h2>🔎 تحقّق من كود</h2>
  <label>رقم الجهاز</label><input id="vdev" class="ltr" placeholder="XXXX-XXXX">
  <label>الكود</label><input id="vcode" class="ltr" placeholder="XXXX-XXXX-XXXX-XXXX">
  <div class="row"><button class="alt" id="verify">تحقّق</button></div><div id="vres" style="margin-top:8px"></div>
</div>
<div class="card">
  <div class="row" style="justify-content:space-between;align-items:center;margin:0"><h2 style="margin:0">📒 سجل الأكواد</h2><button class="alt" id="csv">تصدير CSV</button></div>
  <table><thead><tr><th>التاريخ</th><th>التطبيق</th><th>الجهاز</th><th>الكود</th><th>ملاحظة</th></tr></thead><tbody id="log"></tbody></table>
</div>
</main>
<script>${js}</script>
<script>
const $ = id => document.getElementById(id)
const names = ${JSON.stringify(Object.fromEntries(books.map(b => [b.id, b.name])))}
const LOG = 'emar.codes.log'
const readLog = () => { try { return JSON.parse(localStorage.getItem(LOG) || '[]') } catch { return [] } }
const writeLog = l => { try { localStorage.setItem(LOG, JSON.stringify(l)) } catch {} }
function schoolYearEnd() { const d = new Date(); const y = d.getMonth() >= 8 ? d.getFullYear() + 1 : d.getFullYear(); return new Date(Date.UTC(y, 7, 31)) }
function until() {
  const v = $('valid').value
  if (v === 'life') return null
  if (v === 'date') return $('date').value ? new Date($('date').value + 'T00:00:00Z') : schoolYearEnd()
  return schoolYearEnd()
}
const fmt = d => d ? d.toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' }) : 'دائم'
function render() {
  $('log').innerHTML = readLog().slice().reverse().map(r => '<tr><td>' + r.at.slice(0, 10) + '</td><td>' + r.book + '</td><td class="ltr">' + r.device + '</td><td class="ltr">' + r.code + '</td><td>' + (r.note || '').replace(/</g, '&lt;') + '</td></tr>').join('')
}
$('valid').onchange = () => { $('date').style.display = $('valid').value === 'date' ? 'block' : 'none' }
let last = null
$('make').onclick = async () => {
  const dev = License.cleanDevice($('device').value)
  if (dev.length !== 8) { alert('رقم الجهاز 8 أحرف وأرقام، مثل K7M2-QX9P'); return }
  const u = until(), book = $('book').value
  const code = await License.makeCode(book, dev, u)
  last = { book, code, u }
  $('code').textContent = code; $('until').textContent = names[book] + ' · صالح ' + (u ? 'حتى ' + fmt(u) : 'دائماً') + ' · للجهاز ' + License.formatCode(dev)
  $('out').style.display = 'block'
  const l = readLog(); l.push({ at: new Date().toISOString(), book, device: License.formatCode(dev), code, until: u ? u.toISOString().slice(0, 10) : 'دائم', note: $('note').value }); writeLog(l); render()
}
const copy = t => navigator.clipboard ? navigator.clipboard.writeText(t).then(() => alert('نُسخ ✓')) : prompt('انسخ:', t)
$('copy').onclick = () => last && copy(last.code)
$('copymsg').onclick = () => last && copy('شكراً لاشتراكك في ' + names[last.book] + ' 🌟\\nكود التفعيل: ' + last.code + '\\nافتح التطبيق ← اضغط «🔑 فعّل» في الأعلى ← الصق الكود ← تفعيل.\\nالاشتراك صالح ' + (last.u ? 'حتى ' + fmt(last.u) : 'دائماً') + '.')
$('verify').onclick = async () => {
  const r = await License.checkCode($('book').value, $('vdev').value, $('vcode').value)
  $('vres').innerHTML = r.ok ? '<span class="ok">✓ كود صحيح لـ ' + names[$('book').value] + ' — ' + (r.until ? 'حتى ' + fmt(r.until) : 'دائم') + '</span>' : '<span class="bad">✗ ' + ({ format: 'صيغة الكود خاطئة', device: 'لا يطابق هذا الجهاز أو هذا التطبيق (اختر التطبيق في الأعلى)', expired: 'منتهي الصلاحية' })[r.reason] + '</span>'
}
$('csv').onclick = () => {
  const rows = [['date', 'app', 'device', 'code', 'until', 'note'], ...readLog().map(r => [r.at, r.book, r.device, r.code, r.until, r.note || ''])]
  const csv = '\\ufeff' + rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'emar-codes.csv'; a.click()
}
render()
</script></body></html>`
fs.mkdirSync('dist/tools', { recursive: true })
fs.writeFileSync('dist/tools/code-generator.html', html)
console.log('dist/tools/code-generator.html', (html.length / 1024).toFixed(0), 'KB', books.map(b => b.id).join(','))
