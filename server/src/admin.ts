// The seller's control panel, served at /admin. It holds no secrets: it asks for the admin key and
// keeps it in this browser only, then talks to /v1/admin/*. Built for the phone first (bottom tab bar,
// code cards, an action sheet per code) and widens into a sidebar layout on a computer.
export const ADMIN_PAGE = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#1b1b3a">
<title>لوحة تحكم Emar</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;700;800;900&display=swap" rel="stylesheet">
<style>
:root{--bg:#f3f4f8;--card:#fff;--text:#17182b;--muted:#6b7085;--line:#e5e7ef;--soft:#f7f7fb;--brand:#5b4fe9;--brand-2:#8b5cf6;--green:#1ea85a;--red:#e5484d;--amber:#d98500;--blue:#2383e2;--shadow:0 1px 2px rgba(20,20,60,.06),0 8px 24px -12px rgba(20,20,60,.18);--nav:64px;--sat:env(safe-area-inset-top);--sab:env(safe-area-inset-bottom)}
@media (prefers-color-scheme:dark){:root{--bg:#0f1017;--card:#181a25;--text:#eceef6;--muted:#9a9fb8;--line:#272a3a;--soft:#1f2230;--shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -12px rgba(0,0,0,.6)}}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{height:100%}body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font:15px/1.5 Alexandria,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
button,input,select,textarea{font:inherit;color:inherit}
h1,h2,h3{margin:0;font-weight:800}h1{font-size:22px}h2{font-size:17px}h3{font-size:14px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.02em}
.hidden{display:none!important}.muted{color:var(--muted);font-size:13px}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;direction:ltr;unicode-bidi:isolate;letter-spacing:.5px}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.spread{justify-content:space-between}.grow{flex:1}

/* ---- login ---- */
#login{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(900px 500px at 80% -10%,#8b5cf6 0,transparent 60%),radial-gradient(700px 400px at 0% 100%,#2383e2 0,transparent 55%),#1b1b3a}
.login-card{width:100%;max-width:400px;background:var(--card);border-radius:24px;padding:28px 24px;box-shadow:0 30px 80px -30px rgba(0,0,0,.6)}
.logo{width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,var(--brand),var(--brand-2));color:#fff;display:grid;place-items:center;font-weight:900;font-size:22px;box-shadow:0 8px 20px -8px var(--brand)}
.field{position:relative}.field input{width:100%;padding:13px 14px;padding-left:46px;border:1.5px solid var(--line);border-radius:14px;background:var(--soft);font-size:16px;outline:0;transition:border-color .15s}
.field input:focus{border-color:var(--brand)}.field .eye{position:absolute;left:8px;top:50%;transform:translateY(-50%);background:none;border:0;padding:8px;color:var(--muted);cursor:pointer}
.err{color:var(--red);font-size:13px;min-height:20px;margin-top:8px}

/* ---- shell ---- */
.shell{display:grid;grid-template-columns:1fr;min-height:100vh}
.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--card) 88%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--line);padding:calc(10px + var(--sat)) 16px 10px}
.top .logo{width:36px;height:36px;border-radius:11px;font-size:15px}
.content{padding:16px;padding-bottom:calc(var(--nav) + 20px + var(--sab));max-width:1100px;width:100%;margin:0 auto}
.nav{position:fixed;bottom:0;right:0;left:0;z-index:20;display:flex;background:color-mix(in srgb,var(--card) 92%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--line);padding-bottom:var(--sab);height:calc(var(--nav) + var(--sab))}
.nav button{flex:1;background:none;border:0;display:flex;flex-direction:column;align-items:center;gap:2px;padding:9px 4px 6px;color:var(--muted);font-size:11.5px;font-weight:700;cursor:pointer}
.nav button .ic{font-size:22px;line-height:1;transition:transform .15s}.nav button.on{color:var(--brand)}.nav button.on .ic{transform:translateY(-2px)}
.side{display:none}
@media (min-width:900px){
  .shell{grid-template-columns:240px 1fr}
  .side{display:flex;flex-direction:column;gap:6px;position:sticky;top:0;height:100vh;padding:22px 16px;border-left:1px solid var(--line);background:var(--card)}
  .side .brand{display:flex;align-items:center;gap:12px;margin-bottom:22px}
  .side button{display:flex;align-items:center;gap:12px;width:100%;text-align:right;background:none;border:0;padding:11px 12px;border-radius:12px;font-weight:700;color:var(--muted);cursor:pointer}
  .side button:hover{background:var(--soft)}.side button.on{background:color-mix(in srgb,var(--brand) 12%,transparent);color:var(--brand)}
  .side .ic{font-size:20px}.side .foot{margin-top:auto}
  .nav,.top{display:none}.content{padding:28px 32px}
}

/* ---- cards & controls ---- */
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:var(--shadow)}
.stack>*+*{margin-top:12px}
label.l{display:block;font-size:13px;font-weight:700;margin:0 0 6px;color:var(--muted)}
.in{width:100%;padding:12px 14px;border:1.5px solid var(--line);border-radius:14px;background:var(--soft);font-size:15px;outline:0;transition:border-color .15s;appearance:none;-webkit-appearance:none}
.in:focus{border-color:var(--brand)}select.in{background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),linear-gradient(135deg,var(--muted) 50%,transparent 50%);background-position:calc(14px) 50%,calc(14px + 5px) 50%;background-size:5px 5px;background-repeat:no-repeat;padding-left:34px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 18px;border:0;border-radius:14px;background:var(--brand);color:#fff;font-weight:800;font-size:15px;cursor:pointer;transition:transform .08s,filter .15s;white-space:nowrap}
.btn:active{transform:scale(.98)}.btn:hover{filter:brightness(1.06)}.btn:disabled{opacity:.55;cursor:default}
.btn.ghost{background:var(--soft);color:var(--text);border:1.5px solid var(--line)}.btn.red{background:var(--red)}.btn.green{background:var(--green)}.btn.sm{padding:8px 12px;font-size:13px;border-radius:11px}.btn.block{width:100%}
.seg{display:flex;background:var(--soft);border:1.5px solid var(--line);border-radius:14px;padding:3px;gap:3px}
.seg button{flex:1;border:0;background:none;padding:9px 4px;border-radius:11px;font-weight:700;font-size:13px;white-space:nowrap;color:var(--muted);cursor:pointer}.seg button.on{background:var(--card);color:var(--text);box-shadow:var(--shadow)}
.stepper{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:14px;background:var(--soft);overflow:hidden}
.stepper button{width:46px;height:46px;border:0;background:none;font-size:22px;font-weight:800;color:var(--brand);cursor:pointer}.stepper input{flex:1;border:0;background:none;text-align:center;font-size:18px;font-weight:800;width:60px;outline:0}
.chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}
.chip{flex:none;padding:7px 13px;border-radius:999px;border:1.5px solid var(--line);background:var(--card);font-size:13px;font-weight:700;color:var(--muted);cursor:pointer}.chip.on{background:var(--text);color:var(--bg);border-color:var(--text)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.grid4{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
@media (min-width:700px){.grid4{grid-template-columns:repeat(4,1fr)}}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px 16px;box-shadow:var(--shadow)}
.kpi .v{font-size:30px;font-weight:900;line-height:1.1;letter-spacing:-.5px}.kpi .k{font-size:12.5px;color:var(--muted);font-weight:700;margin-top:4px}.kpi .d{font-size:12px;margin-top:6px;font-weight:700}
.bar{height:8px;border-radius:999px;background:var(--soft);overflow:hidden}.bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--brand),var(--brand-2))}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:800;white-space:nowrap}
.badge::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.b-new{background:#e8f0fe;color:#1a5fd0}.b-used{background:#e3f7ea;color:#157a3e}.b-rev{background:#fde8e8;color:#b42318}.b-exp{background:#fff3df;color:#9a5b00}
@media (prefers-color-scheme:dark){.b-new{background:#182a4a;color:#8fb6ff}.b-used{background:#12301f;color:#6ad896}.b-rev{background:#3a1717;color:#ff8b8b}.b-exp{background:#3a2a0f;color:#ffc466}}
.app{display:inline-block;padding:2px 9px;border-radius:8px;font-size:12px;font-weight:800;color:#fff}
.list{display:flex;flex-direction:column;gap:10px}
.code{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 14px;box-shadow:var(--shadow);display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center;cursor:pointer}
.code .c{font-size:19px;font-weight:800}.code .meta{grid-column:1/-1;display:flex;gap:6px 12px;flex-wrap:wrap;font-size:12.5px;color:var(--muted);min-width:0}.code .meta span{white-space:nowrap}.code>div:first-child{min-width:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.code .kebab{width:38px;height:38px;border-radius:12px;border:1.5px solid var(--line);background:var(--soft);font-size:18px;cursor:pointer}
.empty{text-align:center;padding:36px 16px;color:var(--muted)}.empty .big{font-size:40px;margin-bottom:8px}
.sheet-bg{position:fixed;inset:0;background:rgba(10,10,30,.45);z-index:40;display:flex;align-items:flex-end;justify-content:center;animation:fade .15s}
.sheet{width:100%;max-width:520px;background:var(--card);border-radius:24px 24px 0 0;padding:14px 16px calc(18px + var(--sab));animation:up .2s;max-height:88vh;overflow:auto}
@media (min-width:700px){.sheet-bg{align-items:center}.sheet{border-radius:24px}}
.sheet .grab{width:40px;height:4px;border-radius:2px;background:var(--line);margin:0 auto 12px}
.sheet .act{display:flex;align-items:center;gap:12px;width:100%;text-align:right;background:none;border:0;padding:13px 8px;border-radius:12px;font-weight:700;font-size:15px;cursor:pointer}.sheet .act:hover{background:var(--soft)}.sheet .act .ic{font-size:20px;width:26px;text-align:center}.sheet .act.danger{color:var(--red)}
@keyframes up{from{transform:translateY(30px);opacity:0}}@keyframes fade{from{opacity:0}}
.toast{position:fixed;bottom:calc(var(--nav) + 16px + var(--sab));left:50%;transform:translateX(-50%);background:var(--text);color:var(--bg);padding:11px 18px;border-radius:999px;font-weight:700;font-size:14px;z-index:60;box-shadow:0 10px 30px -10px rgba(0,0,0,.5);animation:up .2s}
@media (min-width:900px){.toast{bottom:24px}}
.codecard{border:2px dashed var(--line);border-radius:14px;padding:12px;text-align:center;background:var(--soft)}.codecard b{display:block;font-size:20px;margin:4px 0}.codecard .muted{font-size:11.5px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.chart{display:flex;align-items:flex-end;gap:4px;height:90px}.chart div{flex:1;background:linear-gradient(180deg,var(--brand-2),var(--brand));border-radius:4px 4px 2px 2px;min-height:3px;position:relative}
.chart div span{position:absolute;top:-18px;left:0;right:0;text-align:center;font-size:11px;font-weight:800;color:var(--muted)}
.axis{display:flex;gap:4px;margin-top:4px}.axis span{flex:1;text-align:center;font-size:10px;color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:13.5px}th,td{padding:9px 6px;border-bottom:1px solid var(--line);text-align:right;vertical-align:middle}th{color:var(--muted);font-size:12px;font-weight:700}tr:last-child td{border-bottom:0}
.ev{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line)}.ev:last-child{border-bottom:0}.ev .ic{width:32px;height:32px;border-radius:10px;background:var(--soft);display:grid;place-items:center;font-size:15px;flex:none}.ev .t{font-size:13.5px;font-weight:700}.ev .s{font-size:12px;color:var(--muted)}
.skeleton{background:linear-gradient(90deg,var(--soft),var(--line),var(--soft));background-size:200% 100%;animation:sk 1.2s infinite;border-radius:10px;height:16px}@keyframes sk{to{background-position:-200% 0}}
@media print{body{background:#fff}.top,.nav,.side,.noprint{display:none!important}.content{padding:0}.card{border:0;box-shadow:none}.codecard{break-inside:avoid;border-color:#999;background:#fff}}
</style></head><body>

<div id="login">
  <div class="login-card">
    <div class="row" style="gap:12px;margin-bottom:18px"><div class="logo">E</div><div><h1>لوحة تحكم Emar</h1><div class="muted">أكواد التفعيل والإحصاءات</div></div></div>
    <label class="l" for="key">مفتاح الإدارة</label>
    <div class="field"><input id="key" type="password" class="mono" placeholder="••••••••••••" autocomplete="current-password"><button class="eye" id="eye" type="button" aria-label="إظهار">👁</button></div>
    <div class="err" id="loginErr"></div>
    <button class="btn block" id="enter">دخول</button>
    <p class="muted" style="margin:14px 0 0;text-align:center">يُحفظ المفتاح في هذا المتصفح فقط.</p>
  </div>
</div>

<div id="app" class="shell hidden">
  <aside class="side">
    <div class="brand"><div class="logo">E</div><div><b>Emar</b><div class="muted">لوحة التحكم</div></div></div>
    <button data-t="home" class="on"><span class="ic">📊</span>الرئيسية</button>
    <button data-t="codes"><span class="ic">🎟️</span>الأكواد</button>
    <button data-t="make"><span class="ic">➕</span>إنشاء أكواد</button>
    <div class="foot"><button id="logout2"><span class="ic">🚪</span>خروج</button></div>
  </aside>
  <div>
    <header class="top row spread"><div class="row" style="gap:10px"><div class="logo">E</div><b id="title">الرئيسية</b></div><button class="btn ghost sm" id="logout">خروج</button></header>
    <main class="content">

      <section id="t-home" class="stack">
        <div class="row spread"><h2>نظرة عامة</h2><button class="btn ghost sm" id="refresh">↻ تحديث</button></div>
        <div class="grid4" id="kpis"><div class="kpi"><div class="skeleton"></div></div><div class="kpi"><div class="skeleton"></div></div><div class="kpi"><div class="skeleton"></div></div><div class="kpi"><div class="skeleton"></div></div></div>
        <div class="card"><h3>التفعيلات في آخر 14 يوماً</h3><div id="chart" style="margin-top:22px"></div></div>
        <h3>التطبيقات</h3>
        <div class="grid2" id="apps"></div>
        <div class="card"><h3>البائعون</h3><div id="sellers" style="margin-top:8px"></div></div>
        <div class="card"><h3>آخر الأحداث</h3><div id="events" style="margin-top:4px"></div></div>
      </section>

      <section id="t-codes" class="stack hidden">
        <div class="field"><input id="q" class="in" placeholder="ابحث بالكود أو اسم الطالب أو البائع…" style="padding-left:14px"></div>
        <div class="chips" id="bookChips"></div>
        <div class="chips" id="statusChips"></div>
        <div class="row spread"><div class="muted" id="count"></div><button class="btn ghost sm" id="exportCsv">⬇ تصدير CSV</button></div>
        <div class="list" id="rows"></div>
      </section>

      <section id="t-make" class="stack hidden">
        <div class="card stack noprint">
          <div><label class="l">التطبيق</label><select id="book" class="in"></select></div>
          <div><label class="l">عدد الأكواد</label><div class="stepper"><button id="minus" type="button">−</button><input id="cnt" type="number" min="1" max="500" value="1"><button id="plus" type="button">+</button></div></div>
          <div><label class="l">مدة الاشتراك</label><div class="seg" id="valid"><button data-v="year" class="on">نهاية العام</button><button data-v="life">دائم</button><button data-v="date">تاريخ محدد</button></div><input id="date" type="date" class="in hidden" style="margin-top:8px"></div>
          <div class="grid2"><div><label class="l">البائع</label><input id="seller" class="in" placeholder="مباشر" list="sellerList"><datalist id="sellerList"></datalist></div><div><label class="l">ملاحظة</label><input id="note" class="in" placeholder="اسم الطالب، المبلغ…"></div></div>
          <button class="btn block" id="make">إنشاء الأكواد</button>
        </div>
        <div id="made" class="card stack hidden">
          <div class="row spread noprint"><h2 id="madeTitle"></h2></div>
          <div class="row noprint"><button class="btn sm" id="copyMsg">💬 نسخ رسالة للطالب</button><button class="btn ghost sm" id="shareMsg">📤 مشاركة</button><button class="btn ghost sm" id="copyAll">نسخ الكل</button><button class="btn ghost sm" onclick="print()">🖨 طباعة بطاقات</button></div>
          <div id="cards" class="cards"></div>
        </div>
      </section>

    </main>
    <nav class="nav">
      <button data-t="home" class="on"><span class="ic">📊</span>الرئيسية</button>
      <button data-t="codes"><span class="ic">🎟️</span>الأكواد</button>
      <button data-t="make"><span class="ic">➕</span>إنشاء</button>
    </nav>
  </div>
</div>
<div id="sheetHost"></div>

<script>
const $ = id => document.getElementById(id)
const BOOKS = { g12: ['البكالوريا', 'Emar 12', '#8b5cf6'], g11: ['الحادي عشر', 'Emar 11', '#2383e2'], g9: ['التاسع', 'Emar 9', '#e5484d'], g8: ['الثامن', 'Emar 8', '#1ea85a'], g5: ['الخامس', 'Emar 5', '#d98500'] }
const bookName = b => BOOKS[b] ? BOOKS[b][0] + ' — ' + BOOKS[b][1] : b
const appTag = b => '<span class="app" style="background:' + (BOOKS[b] ? BOOKS[b][2] : '#888') + '">' + (BOOKS[b] ? BOOKS[b][0] : b) + '</span>'
const TITLES = { home: 'الرئيسية', codes: 'الأكواد', make: 'إنشاء أكواد' }
let KEY = localStorage.getItem('emar.admin') || ''
const api = async (path, opts = {}) => {
  const r = await fetch('/v1/admin/' + path, { ...opts, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || r.status)
  return j
}
const fmt = ms => ms ? new Date(ms).toLocaleDateString('ar-SY', { year: 'numeric', month: 'short', day: 'numeric' }) : 'دائم'
const when = ms => ms ? new Date(ms).toLocaleString('ar-SY', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const plural = (n, one, two, many) => n === 1 ? one : n === 2 ? two : n <= 10 ? n + ' ' + many : n + ' ' + one
const ago = ms => { if (!ms) return 'لم يُستخدم'; const m = Math.round((Date.now() - ms) / 60000); if (m < 1) return 'الآن'; if (m < 60) return 'قبل ' + plural(m, 'دقيقة', 'دقيقتين', 'دقائق'); const h = Math.round(m / 60); if (h < 48) return 'قبل ' + plural(h, 'ساعة', 'ساعتين', 'ساعات'); return 'قبل ' + plural(Math.round(h / 24), 'يوم', 'يومين', 'أيام') }
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const toast = t => { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2200) }
const copy = t => navigator.clipboard.writeText(t).then(() => toast('نُسخ ✓'), () => prompt('انسخ:', t))
function yearEnd() { const d = new Date(); const y = d.getMonth() >= 8 ? d.getFullYear() + 1 : d.getFullYear(); return Date.UTC(y, 7, 31, 23, 59) }
const studentMsg = (book, code, exp) => 'شكراً لاشتراكك في ' + bookName(book) + ' 🌟\\nكود التفعيل: ' + code + '\\nافتح التطبيق وأنت متصل بالإنترنت ← اضغط «🔑 فعّل» ← أدخل الكود ← تفعيل.\\nالكود يعمل على جهاز واحد فقط' + (exp ? '، وصالح حتى ' + fmt(exp) : '') + '.'

// ---- login
$('eye').onclick = () => { const i = $('key'); i.type = i.type === 'password' ? 'text' : 'password' }
async function enter() {
  KEY = $('key').value.trim() || KEY
  if (!KEY) return
  $('enter').disabled = true
  try { await api('stats'); localStorage.setItem('emar.admin', KEY); $('login').classList.add('hidden'); $('app').classList.remove('hidden'); go('home') }
  catch { $('loginErr').textContent = 'المفتاح غير صحيح.'; localStorage.removeItem('emar.admin') }
  $('enter').disabled = false
}
$('enter').onclick = enter
$('key').onkeydown = e => { if (e.key === 'Enter') enter() }
$('logout').onclick = $('logout2').onclick = () => { localStorage.removeItem('emar.admin'); location.reload() }

// ---- navigation
function go(t) {
  $('sheetHost').innerHTML = ''
  document.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x.dataset.t === t))
  ;['home', 'codes', 'make'].forEach(x => $('t-' + x).classList.toggle('hidden', x !== t))
  $('title').textContent = TITLES[t]
  window.scrollTo(0, 0)
  if (t === 'home') stats()
  if (t === 'codes') find()
}
document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => go(b.dataset.t))
$('refresh').onclick = stats

// ---- dashboard
let sellersKnown = []
async function stats() {
  try {
    const s = await api('stats')
    const sum = k => s.books.reduce((a, b) => a + (b[k] || 0), 0)
    const today = s.today || 0
    $('kpis').innerHTML = [
      ['إجمالي الأكواد', sum('total'), ''],
      ['مفعّلة', sum('activated'), today ? '<span style="color:var(--green)">+' + today + ' اليوم</span>' : ''],
      ['نشِطة هذا الأسبوع', sum('active7'), ''],
      ['ملغاة', sum('revoked'), ''],
    ].map(([k, v, d]) => '<div class="kpi"><div class="v">' + v + '</div><div class="k">' + k + '</div><div class="d">' + d + '</div></div>').join('')
    const days = s.days || []
    const max = Math.max(1, ...days.map(d => d.n))
    $('chart').innerHTML = '<div class="chart">' + days.map(d => '<div style="height:' + Math.max(3, d.n / max * 100) + '%"><span>' + (d.n || '') + '</span></div>').join('') + '</div><div class="axis">' + days.map((d, i) => '<span>' + (i % 2 ? '' : new Date(d.day).toLocaleDateString('ar-SY', { day: 'numeric' })) + '</span>').join('') + '</div>'
    $('apps').innerHTML = s.books.map(b => { const p = b.total ? Math.round((b.activated || 0) / b.total * 100) : 0
      return '<div class="card"><div class="row spread">' + appTag(b.book) + '<span class="muted">' + bookName(b.book).split(' — ')[1] + '</span></div><div style="font-size:26px;font-weight:900;margin:8px 0 2px">' + (b.activated || 0) + ' <span class="muted" style="font-size:14px;font-weight:700">/ ' + b.total + ' مفعّل</span></div><div class="bar"><i style="width:' + p + '%"></i></div><div class="muted" style="margin-top:6px">نشِط هذا الأسبوع ' + (b.active7 || 0) + ' · ملغى ' + (b.revoked || 0) + '</div></div>' }).join('') || '<div class="card empty"><div class="big">🎟️</div>لا أكواد بعد. أنشئ أول كود من تبويب «إنشاء».</div>'
    const sellers = s.sellers || []
    sellersKnown = sellers.map(x => x.seller).filter(Boolean)
    $('sellerList').innerHTML = sellersKnown.map(x => '<option value="' + esc(x) + '">').join('')
    $('sellers').innerHTML = sellers.length ? '<table><thead><tr><th>البائع</th><th>أكواد</th><th>مفعّلة</th><th>النسبة</th></tr></thead><tbody>' + sellers.map(x => '<tr><td><b>' + esc(x.seller || 'مباشر') + '</b></td><td>' + x.total + '</td><td>' + (x.activated || 0) + '</td><td><div class="bar" style="width:80px;display:inline-block;vertical-align:middle"><i style="width:' + (x.total ? Math.round((x.activated || 0) / x.total * 100) : 0) + '%"></i></div></td></tr>').join('') + '</tbody></table>' : '<div class="muted">لا بائعين بعد.</div>'
    $('events').innerHTML = (s.recent || []).slice(0, 25).map(e => { const [ic, t, d] = describe(e); return '<div class="ev"><div class="ic">' + ic + '</div><div class="grow"><div class="t">' + t + (e.code ? ' <span class="mono">' + esc(e.code) + '</span>' : '') + '</div><div class="s">' + when(e.at) + (d ? ' · ' + d : '') + '</div></div></div>' }).join('') || '<div class="muted">لا أحداث بعد.</div>'
  } catch (e) { toast('تعذّر التحميل: ' + e.message) }
}

// what an event means, in Arabic: the server logs them in English
const WHY = { invalid: 'كود غير موجود', book: 'كود لتطبيق آخر', used: 'الكود مفعّل على جهاز آخر', revoked: 'الكود ملغى', expired: 'الكود منتهي', wait: 'محاولات كثيرة', format: 'كود غير مكتمل' }
const ACT = { revoke: 'إلغاء الكود', restore: 'استعادة الكود', unbind: 'نقل الكود إلى جهاز جديد', note: 'تعديل الملاحظة', expiry: 'تغيير تاريخ الانتهاء' }
function describe(e) {
  const d = String(e.detail || '')
  if (e.kind === 'activate') return ['✅', 'تفعيل جديد', '']
  if (e.kind === 'activate-fail') return ['⚠️', 'محاولة تفعيل فاشلة', WHY[d] || esc(d)]
  if (e.kind === 'session') return ['📱', 'فتح التطبيق', '']
  if (e.kind === 'admin') { const m = d.match(/^created (\\d+) (\\w+)$/); if (m) return ['🛠️', 'إنشاء ' + m[1] + ' كود', bookName(m[2])]; return ['🛠️', ACT[d] || 'إجراء إداري', ACT[d] ? '' : esc(d)] }
  return ['•', esc(e.kind), esc(d)]
}

// ---- codes
let fBook = '', fStatus = '', rows = [], timer
const chips = (host, items, cur, set) => { host.innerHTML = items.map(([v, l]) => '<button class="chip' + (v === cur ? ' on' : '') + '" data-v="' + v + '">' + l + '</button>').join(''); host.querySelectorAll('.chip').forEach(c => c.onclick = () => { set(c.dataset.v); drawChips(); find() }) }
function drawChips() {
  chips($('bookChips'), [['', 'كل التطبيقات'], ...Object.keys(BOOKS).map(b => [b, BOOKS[b][0]])], fBook, v => fBook = v)
  chips($('statusChips'), [['', 'كل الحالات'], ['new', 'غير مستخدم'], ['used', 'مفعّل'], ['revoked', 'ملغى']], fStatus, v => fStatus = v)
}
drawChips()
$('q').oninput = () => { clearTimeout(timer); timer = setTimeout(find, 300) }
const status = r => r.revoked ? 'rev' : r.expires_at && r.expires_at < Date.now() ? 'exp' : r.device ? 'used' : 'new'
const badge = r => ({ rev: '<span class="badge b-rev">ملغى</span>', exp: '<span class="badge b-exp">منتهي</span>', used: '<span class="badge b-used">مفعّل</span>', new: '<span class="badge b-new">غير مستخدم</span>' })[status(r)]
async function find() {
  const qs = new URLSearchParams({ q: $('q').value, book: fBook, status: fStatus })
  try {
    rows = (await api('codes?' + qs)).codes
    $('count').textContent = rows.length ? rows.length + ' كود' + (rows.length >= 300 ? ' (أول 300)' : '') : ''
    $('rows').innerHTML = rows.map((r, i) => '<div class="code" data-i="' + i + '"><div><span class="c mono">' + r.code + '</span> ' + appTag(r.book) + '</div><button class="kebab" aria-label="إجراءات">⋯</button><div class="meta">' + badge(r) + '<span>⏳ ' + fmt(r.expires_at) + '</span>' + (r.seller ? '<span>🏷️ ' + esc(r.seller) + '</span>' : '') + (r.note ? '<span>📝 ' + esc(r.note) + '</span>' : '') + (r.device ? '<span>🕒 ' + ago(r.last_seen) + '</span>' : '') + (r.moves ? '<span>🔁 نُقل ' + r.moves + '×</span>' : '') + '</div></div>').join('')
      || '<div class="empty"><div class="big">🔍</div>لا نتائج</div>'
  } catch (e) { toast(e.message) }
}
$('rows').onclick = e => { const c = e.target.closest('.code'); if (c) sheet(rows[+c.dataset.i]) }
$('exportCsv').onclick = () => {
  if (!rows.length) return toast('لا شيء للتصدير')
  const csv = ['code,book,status,expires,seller,note,last_seen'].concat(rows.map(r => [r.code, r.book, status(r), r.expires_at ? new Date(r.expires_at).toISOString().slice(0, 10) : '', r.seller || '', (r.note || '').replace(/,/g, '،'), r.last_seen ? new Date(r.last_seen).toISOString() : ''].join(','))).join('\\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\\ufeff' + csv], { type: 'text/csv' })); a.download = 'emar-codes.csv'; a.click()
}
function sheet(r) {
  const host = $('sheetHost')
  const close = () => { host.innerHTML = '' }
  const act = (ic, label, cls) => '<button class="act ' + (cls || '') + '" data-a="' + label + '"><span class="ic">' + ic + '</span>' + label + '</button>'
  host.innerHTML = '<div class="sheet-bg"><div class="sheet"><div class="grab"></div><div class="row spread" style="margin-bottom:8px"><div><div class="mono" style="font-size:22px;font-weight:800">' + r.code + '</div><div class="muted">' + bookName(r.book) + ' · ' + fmt(r.expires_at) + '</div></div>' + badge(r) + '</div>'
    + (r.note || r.seller ? '<div class="muted" style="margin-bottom:8px">' + esc([r.seller, r.note].filter(Boolean).join(' · ')) + '</div>' : '')
    + act('📋', 'نسخ الكود') + act('💬', 'نسخ رسالة للطالب') + act('📝', 'تعديل الملاحظة') + act('📅', 'تغيير تاريخ الانتهاء')
    + (r.device ? act('🔁', 'نقل إلى جهاز جديد') : '')
    + (r.revoked ? act('♻️', 'استعادة الكود') : act('⛔', 'إلغاء الكود', 'danger'))
    + '<button class="btn ghost block" style="margin-top:8px" data-a="close">إغلاق</button></div></div>'
  host.querySelector('.sheet-bg').onclick = e => { if (e.target.classList.contains('sheet-bg')) close() }
  host.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a
    try {
      if (a === 'close') return close()
      if (a === 'نسخ الكود') { copy(r.code); return close() }
      if (a === 'نسخ رسالة للطالب') { copy(studentMsg(r.book, r.code, r.expires_at)); return close() }
      if (a === 'تعديل الملاحظة') { const note = prompt('الملاحظة:', r.note || ''); if (note === null) return; await api('code', { method: 'POST', body: JSON.stringify({ code: r.code, action: 'note', note }) }) }
      if (a === 'تغيير تاريخ الانتهاء') { const d = prompt('التاريخ الجديد (YYYY-MM-DD)، أو اتركه فارغاً لاشتراك دائم:', r.expires_at ? new Date(r.expires_at).toISOString().slice(0, 10) : ''); if (d === null) return; if (d && !/^\\d{4}-\\d{2}-\\d{2}$/.test(d)) return toast('صيغة التاريخ غير صحيحة'); await api('code', { method: 'POST', body: JSON.stringify({ code: r.code, action: 'expiry', expiresAt: d ? new Date(d + 'T23:59:00Z').getTime() : null }) }) }
      if (a === 'نقل إلى جهاز جديد') { if (!confirm('سيتوقف الكود على الجهاز القديم ويمكن تفعيله على جهاز جديد. متابعة؟')) return; await api('code', { method: 'POST', body: JSON.stringify({ code: r.code, action: 'unbind' }) }) }
      if (a === 'إلغاء الكود') { if (!confirm('سيتوقف التطبيق عند صاحب هذا الكود. متابعة؟')) return; await api('code', { method: 'POST', body: JSON.stringify({ code: r.code, action: 'revoke' }) }) }
      if (a === 'استعادة الكود') await api('code', { method: 'POST', body: JSON.stringify({ code: r.code, action: 'restore' }) })
      toast('تم ✓'); close(); find()
    } catch (e) { toast('خطأ: ' + e.message) }
  })
}

// ---- make
$('book').innerHTML = Object.keys(BOOKS).map(b => '<option value="' + b + '">' + bookName(b) + '</option>').join('')
let valid = 'year'
$('valid').querySelectorAll('button').forEach(b => b.onclick = () => { valid = b.dataset.v; $('valid').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); $('date').classList.toggle('hidden', valid !== 'date') })
$('minus').onclick = () => $('cnt').value = Math.max(1, +$('cnt').value - 1)
$('plus').onclick = () => $('cnt').value = Math.min(500, +$('cnt').value + 1)
const expiry = () => valid === 'life' ? null : valid === 'date' && $('date').value ? new Date($('date').value + 'T23:59:00Z').getTime() : yearEnd()
let last = null
$('make').onclick = async () => {
  const book = $('book').value, count = Math.max(1, Math.min(500, +$('cnt').value || 1))
  $('make').disabled = true
  try {
    last = await api('codes', { method: 'POST', body: JSON.stringify({ book, count, expiresAt: expiry(), seller: $('seller').value, note: $('note').value }) })
    $('made').classList.remove('hidden')
    $('madeTitle').textContent = last.codes.length + ' كود · ' + bookName(book) + ' · ' + (last.expiresAt ? 'حتى ' + fmt(last.expiresAt) : 'دائم')
    $('cards').innerHTML = last.codes.map(c => '<div class="codecard"><div class="muted">' + bookName(book) + '</div><b class="mono">' + c + '</b><div class="muted">افتح التطبيق ← 🔑 فعّل ← أدخل الكود<br>' + (last.expiresAt ? 'صالح حتى ' + fmt(last.expiresAt) : 'اشتراك دائم') + ' · لجهاز واحد</div></div>').join('')
    $('made').scrollIntoView({ behavior: 'smooth', block: 'start' })
    toast('أُنشئ ' + last.codes.length + ' كود ✓')
  } catch (e) { toast('تعذّر الإنشاء: ' + e.message) }
  $('make').disabled = false
}
$('copyAll').onclick = () => last && copy(last.codes.join('\\n'))
$('copyMsg').onclick = () => last && copy(studentMsg(last.book, last.codes[0], last.expiresAt))
$('shareMsg').onclick = () => { if (!last) return; const text = studentMsg(last.book, last.codes[0], last.expiresAt); if (navigator.share) navigator.share({ text }).catch(() => {}); else copy(text) }

if (KEY) enter()
</script></body></html>`
