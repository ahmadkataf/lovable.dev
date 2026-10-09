// The seller's codes page, served at /admin. It holds no secrets: it asks for the admin key, keeps it in
// this browser only (localStorage) and talks to /admin/api/*. Phone first (bottom tabs, cards, sheets),
// a top bar with the tabs on a computer. Printing shows only the code cards.
// Written with String.raw so the page's own JavaScript keeps its backslashes; it contains no backticks and no "${".
export const ADMIN_PAGE = String.raw`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0e9f6e"><meta name="robots" content="noindex"><link rel="icon" href="data:,">
<title>أكواد كاسب</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#f3f5f9;--card:#fff;--soft:#f7f8fb;--soft2:#eceff5;--text:#0f172a;--muted:#4b5a73;--faint:#8a97ad;--line:#e3e8f0;--line2:#cfd7e3;--brand:#0e9f6e;--brand-d:#097650;--brand-soft:#e1f6ed;--accent:#3b6cf6;--red:#e5484d;--red-soft:#fde8e9;--amber:#b97300;--amber-soft:#fff4d6;--blue:#0369a1;--blue-soft:#e0f4fd;--shadow:0 1px 2px rgba(15,23,42,.05),0 1px 3px rgba(15,23,42,.07);--shadow2:0 6px 20px rgba(15,23,42,.1);--nav:62px;--sat:env(safe-area-inset-top,0px);--sab:env(safe-area-inset-bottom,0px);--r:14px}
@media (prefers-color-scheme:dark){:root{--bg:#0b1220;--card:#121b2d;--soft:#172238;--soft2:#1e2b45;--text:#e8eef8;--muted:#aab6c9;--faint:#6f7d94;--line:#243149;--line2:#31425f;--brand:#1fc38d;--brand-d:#139a6d;--brand-soft:rgba(31,195,141,.14);--accent:#6c8dff;--red:#ff6369;--red-soft:rgba(255,99,105,.16);--amber:#f5b320;--amber-soft:rgba(245,179,32,.16);--blue:#38bdf8;--blue-soft:rgba(56,189,248,.16);--shadow:0 1px 2px rgba(0,0,0,.3);--shadow2:0 6px 20px rgba(0,0,0,.35)}}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{height:100%}body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font:15px/1.5 Alexandria,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer}
h1,h2,h3{margin:0;font-weight:700;line-height:1.3}h1{font-size:20px}h2{font-size:17px}h3{font-size:13px;color:var(--muted);font-weight:700}
.hidden{display:none!important}.muted{color:var(--muted);font-size:13px}.faint{color:var(--faint);font-size:12px}.bold{font-weight:700}
.mono{font-family:ui-monospace,"Cascadia Mono","Roboto Mono",Menlo,monospace;direction:ltr;unicode-bidi:isolate;letter-spacing:.5px}
.num{direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.spread{justify-content:space-between}.grow{flex:1;min-width:0}.col{display:flex;flex-direction:column;gap:10px}
.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
svg{flex:none}
/* login */
#login{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(800px 420px at 85% -10%,rgba(14,159,110,.35) 0,transparent 60%),radial-gradient(600px 380px at 0% 100%,rgba(59,108,246,.3) 0,transparent 55%),var(--bg)}
.login-card{width:100%;max-width:400px;background:var(--card);border:1px solid var(--line);border-radius:22px;padding:28px 24px;box-shadow:var(--shadow2)}
.logo{width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,var(--brand),#2cc48f);color:#fff;display:grid;place-items:center;font-weight:800;font-size:22px;flex:none}
.field{position:relative}.field input{padding-left:46px}.field .eye{position:absolute;left:6px;top:50%;transform:translateY(-50%);background:none;border:0;padding:8px;color:var(--faint);cursor:pointer;min-width:38px;min-height:38px}
.err{color:var(--red);font-size:13px;min-height:20px;margin-top:8px}
/* shell */
.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--card) 90%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--line);padding:calc(8px + var(--sat)) 16px 8px;display:flex;align-items:center;gap:12px;min-height:58px}
.top .logo{width:34px;height:34px;border-radius:10px;font-size:16px}
.top .tabs{display:none}
.content{padding:16px;padding-bottom:calc(var(--nav) + 24px + var(--sab));max-width:1040px;width:100%;margin:0 auto}
.nav{position:fixed;bottom:0;right:0;left:0;z-index:20;display:flex;background:color-mix(in srgb,var(--card) 94%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-top:1px solid var(--line);padding-bottom:var(--sab);height:calc(var(--nav) + var(--sab))}
.nav button{flex:1;background:none;border:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px 4px;color:var(--faint);font-size:11px;font-weight:600;min-height:44px}
.nav button.on{color:var(--brand)}.nav button svg{transition:transform .15s}.nav button.on svg{transform:translateY(-1px)}
@media (min-width:900px){
  .top{padding:10px 28px}.top .tabs{display:flex;gap:4px;margin-inline-start:16px}
  .top .tabs button{display:flex;align-items:center;gap:8px;border:0;background:none;padding:9px 14px;border-radius:10px;font-weight:600;color:var(--muted);min-height:42px}
  .top .tabs button:hover{background:var(--soft2);color:var(--text)}.top .tabs button.on{background:var(--brand-soft);color:var(--brand-d)}
  .nav{display:none}.content{padding:24px 28px 40px}#title{display:none}
}
@media (prefers-color-scheme:dark) and (min-width:900px){.top .tabs button.on{color:var(--brand)}}
/* controls */
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:16px;box-shadow:var(--shadow)}
.stack>*+*{margin-top:12px}
label.l{display:block;font-size:13px;font-weight:600;margin:0 0 6px;color:var(--muted)}
.in{width:100%;min-height:44px;padding:10px 14px;border:1.5px solid var(--line);border-radius:10px;background:var(--card);font-size:15px;outline:0;transition:border-color .15s,box-shadow .15s;appearance:none;-webkit-appearance:none}
.in:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(14,159,110,.25)}textarea.in{min-height:80px;resize:vertical;line-height:1.5}
select.in{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238a97ad' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:left 12px center;padding-left:36px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 16px;border:0;border-radius:10px;background:var(--soft2);color:var(--text);font-weight:600;font-size:14px;cursor:pointer;transition:transform .08s,filter .15s,background .15s;white-space:nowrap;user-select:none}
.btn:hover{filter:brightness(.97)}.btn:active{transform:translateY(1px) scale(.99)}.btn:disabled{opacity:.55;cursor:default;pointer-events:none}
.btn.primary{background:var(--brand);color:#fff}.btn.red{background:var(--red);color:#fff}.btn.soft{background:var(--brand-soft);color:var(--brand-d)}.btn.soft-red{background:var(--red-soft);color:var(--red)}
.btn.ghost{background:transparent;color:var(--muted)}.btn.ghost:hover{background:var(--soft2);color:var(--text)}.btn.outline{background:transparent;border:1.5px solid var(--line2)}
.btn.sm{min-height:34px;padding:0 12px;font-size:13px;border-radius:8px}.btn.lg{min-height:50px;font-size:16px;border-radius:12px}.btn.block{width:100%}.btn.icon{width:42px;padding:0}.btn.icon.sm{width:34px}
@media (prefers-color-scheme:dark){.btn.soft{color:var(--brand)}}
.seg{display:flex;background:var(--soft2);border-radius:10px;padding:3px;gap:2px}
.seg button{flex:1;border:0;background:none;min-height:36px;padding:0 8px;border-radius:8px;font-weight:600;font-size:13px;white-space:nowrap;color:var(--muted);cursor:pointer}.seg button.on{background:var(--card);color:var(--text);box-shadow:var(--shadow)}
.stepper{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:10px;background:var(--card);overflow:hidden}
.stepper button{width:46px;height:44px;border:0;background:none;font-size:22px;font-weight:700;color:var(--brand);cursor:pointer}.stepper input{flex:1;border:0;background:none;text-align:center;font-size:18px;font-weight:700;width:60px;outline:0;min-width:0}
.chips{display:flex;gap:8px;overflow-x:auto;padding:2px;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}
.chip{flex:none;min-height:36px;padding:0 14px;border-radius:999px;border:1.5px solid var(--line);background:var(--card);font-size:13px;font-weight:600;color:var(--muted);cursor:pointer}.chip.on{background:var(--text);color:var(--card);border-color:var(--text)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.grid3{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
@media (min-width:700px){.grid3{grid-template-columns:repeat(3,1fr)}}
.kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}@media (min-width:700px){.kpis{grid-template-columns:repeat(5,1fr)}}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;box-shadow:var(--shadow)}
.kpi .v{font-size:26px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}.kpi .k{font-size:12px;color:var(--faint);font-weight:600;margin-top:6px}.kpi.hero{background:var(--brand);border-color:var(--brand);color:#fff}.kpi.hero .k{color:rgba(255,255,255,.85)}
.badge{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap;background:var(--soft2);color:var(--muted)}
.badge::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.b-new{background:var(--blue-soft);color:var(--blue)}.b-used{background:var(--brand-soft);color:var(--brand-d)}.b-rev{background:var(--red-soft);color:var(--red)}.b-exp{background:var(--amber-soft);color:var(--amber)}.b-trial{background:var(--amber-soft);color:var(--amber)}
@media (prefers-color-scheme:dark){.b-used{color:var(--brand)}}
.list{display:flex;flex-direction:column;gap:8px}
.item{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:12px 14px;box-shadow:var(--shadow);display:flex;gap:12px;align-items:center;cursor:pointer;text-align:start;width:100%;min-height:64px;transition:background .12s}
.item:hover{background:var(--soft)}.item .ico{width:40px;height:40px;border-radius:12px;background:var(--soft2);display:grid;place-items:center;color:var(--muted);flex:none}
.item .t{font-weight:700;font-size:16px}.item .t.mono{white-space:nowrap;letter-spacing:.3px}@media (max-width:400px){.item .t.mono{font-size:14px}}.item .meta{display:flex;gap:4px 10px;flex-wrap:wrap;font-size:12px;color:var(--faint);margin-top:3px}.item .meta span{white-space:nowrap}
.item .end{margin-inline-start:auto;text-align:end;flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.empty{text-align:center;padding:36px 16px;color:var(--faint)}.empty .big{font-size:36px;margin-bottom:8px}
.sheet-bg{position:fixed;inset:0;background:rgba(8,14,28,.5);backdrop-filter:blur(3px);z-index:40;display:flex;align-items:flex-end;justify-content:center;animation:fade .15s}
.sheet{width:100%;max-width:560px;background:var(--card);border-radius:20px 20px 0 0;padding:12px 18px calc(18px + var(--sab));animation:up .2s;max-height:92vh;overflow:auto;display:flex;flex-direction:column;gap:12px}
@media (min-width:700px){.sheet-bg{align-items:center;padding:20px}.sheet{border-radius:20px;max-height:min(92vh,860px)}}
.sheet .grab{width:44px;height:5px;border-radius:3px;background:var(--line2);margin:0 auto 2px}@media (min-width:700px){.sheet .grab{display:none}}
.sheet .act{display:flex;align-items:center;gap:12px;width:100%;text-align:start;background:none;border:0;padding:12px 10px;border-radius:10px;font-weight:600;font-size:15px;cursor:pointer;min-height:48px}.sheet .act:hover{background:var(--soft)}.sheet .act.danger{color:var(--red)}
.sheet .act svg{color:var(--muted)}.sheet .act.danger svg{color:var(--red)}
.kv{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13.5px}.kv .k{color:var(--faint)}.kv .v{min-width:0;overflow-wrap:anywhere}
.dev{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}.dev:last-child{border-bottom:0}
@keyframes up{from{transform:translateY(30px);opacity:0}}@keyframes fade{from{opacity:0}}
.toast{position:fixed;bottom:calc(var(--nav) + 16px + var(--sab));left:50%;transform:translateX(-50%);background:#111827;color:#fff;padding:11px 18px;border-radius:12px;font-weight:600;font-size:14px;z-index:70;box-shadow:var(--shadow2);animation:up .2s;max-width:92vw;text-align:center}
.toast.ok{background:var(--brand-d)}.toast.bad{background:var(--red)}
@media (min-width:900px){.toast{bottom:24px}}
.codecard{border:1.5px dashed var(--line2);border-radius:12px;padding:12px;text-align:center;background:var(--soft)}.codecard b{display:block;font-size:20px;margin:4px 0}.codecard .faint{font-size:11.5px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.chart{display:flex;align-items:flex-end;gap:4px;height:80px}.chart div{flex:1;background:linear-gradient(180deg,#2cc48f,var(--brand));border-radius:4px 4px 2px 2px;min-height:3px;position:relative}
.chart div span{position:absolute;top:-18px;left:0;right:0;text-align:center;font-size:11px;font-weight:700;color:var(--faint)}
.axis{display:flex;gap:4px;margin-top:4px}.axis span{flex:1;text-align:center;font-size:10px;color:var(--faint)}
.ev{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line)}.ev:last-child{border-bottom:0}.ev .ic{width:32px;height:32px;border-radius:10px;background:var(--soft2);display:grid;place-items:center;flex:none;color:var(--muted)}.ev .t{font-size:13.5px;font-weight:600}.ev .s{font-size:12px;color:var(--faint)}
.ev.bad .ic{background:var(--red-soft);color:var(--red)}.ev.good .ic{background:var(--brand-soft);color:var(--brand-d)}
.skeleton{background:linear-gradient(90deg,var(--soft2),var(--soft),var(--soft2));background-size:200% 100%;animation:sk 1.2s infinite;border-radius:8px;height:16px}@keyframes sk{to{background-position:-200% 0}}
.ask{background:var(--card);border-radius:18px;padding:22px 20px;max-width:380px;width:100%;box-shadow:var(--shadow2);animation:up .2s}
.ask-bg{position:fixed;inset:0;background:rgba(8,14,28,.5);z-index:60;display:flex;align-items:center;justify-content:center;padding:20px;animation:fade .15s}
.copybox{display:flex;align-items:center;gap:8px;background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:8px 10px}.copybox .mono{flex:1;min-width:0;overflow-wrap:anywhere;font-size:12px;direction:ltr;text-align:left}
.print-only{display:none}
@media print{body{background:#fff;color:#000}#app,#login,.toast,.sheet-bg,.ask-bg{display:none!important}.print-only{display:block!important}.cards{grid-template-columns:repeat(3,1fr)}.codecard{break-inside:avoid;border-color:#999;background:#fff;color:#000}.codecard .faint{color:#444}}
</style></head><body>

<div id="login">
  <div class="login-card">
    <div class="row" style="gap:12px;margin-bottom:18px"><div class="logo">ك</div><div><h1>أكواد كاسب</h1><div class="muted">لوحة البائع: الأكواد والأجهزة والإعدادات</div></div></div>
    <label class="l" for="key">مفتاح الإدارة</label>
    <div class="field"><input id="key" type="password" class="in mono" placeholder="••••••••••••" autocomplete="current-password"><button class="eye" id="eye" type="button" aria-label="إظهار">👁</button></div>
    <div class="err" id="loginErr"></div>
    <button class="btn primary block lg" id="enter">دخول</button>
    <p class="faint" style="margin:14px 0 0;text-align:center">يُحفظ المفتاح في هذا المتصفح فقط.</p>
  </div>
</div>

<div id="app" class="hidden">
  <header class="top">
    <div class="logo">ك</div>
    <b id="title">لوحة</b>
    <div class="tabs" id="topTabs"></div>
    <span class="grow"></span>
    <button class="btn ghost sm" id="logout">خروج</button>
  </header>
  <main class="content">

    <section id="t-home" class="stack">
      <div class="row spread"><h2>نظرة عامة</h2><button class="btn ghost sm" id="refresh">↻ تحديث</button></div>
      <div class="kpis" id="kpis"><div class="kpi"><div class="skeleton"></div></div><div class="kpi"><div class="skeleton"></div></div><div class="kpi"><div class="skeleton"></div></div><div class="kpi"><div class="skeleton"></div></div><div class="kpi"><div class="skeleton"></div></div></div>
      <div class="card"><h3>التفعيلات في آخر 14 يوماً</h3><div id="chart" style="margin-top:22px"></div></div>
      <div class="card"><h3>آخر الأحداث</h3><div id="events" style="margin-top:6px"></div></div>
    </section>

    <section id="t-codes" class="stack hidden">
      <div class="card stack">
        <div class="row spread"><h2>إنشاء أكواد</h2><span class="faint">كل كود يُباع مرة واحدة</span></div>
        <div class="grid2">
          <div><label class="l">عدد الأكواد</label><div class="stepper"><button id="minus" type="button" aria-label="أقل">−</button><input id="cnt" type="number" min="1" max="100" value="1" inputmode="numeric"><button id="plus" type="button" aria-label="أكثر">+</button></div></div>
          <div><label class="l">أجهزة لكل كود</label><select id="maxDev" class="in"><option value="1">جهاز واحد</option><option value="2">جهازان</option><option value="3">3 أجهزة</option><option value="4">4 أجهزة</option><option value="5">5 أجهزة</option></select></div>
        </div>
        <div><label class="l">مدة الترخيص</label><div class="seg" id="valid"><button data-v="life" class="on" type="button">دائم</button><button data-v="year" type="button">سنة</button><button data-v="date" type="button">حتى تاريخ</button></div><input id="date" type="date" class="in hidden num" style="margin-top:8px"></div>
        <div class="grid2"><div><label class="l">البائع</label><input id="seller" class="in" placeholder="مباشر" list="sellerList" maxlength="80"><datalist id="sellerList"></datalist></div><div><label class="l">ملاحظة</label><input id="note" class="in" placeholder="اسم المحل، المبلغ…" maxlength="200"></div></div>
        <button class="btn primary block lg" id="make">إنشاء الأكواد</button>
      </div>
      <div id="made" class="card stack hidden">
        <div class="row spread"><h2 id="madeTitle"></h2><button class="btn ghost sm" id="madeClose" aria-label="إغلاق">✕</button></div>
        <div class="row"><button class="btn soft sm" id="copyAll">📋 نسخ الكل</button><button class="btn soft sm" id="copyMsg">💬 نسخ رسالة للعميل</button><button class="btn outline sm" id="printCards">🖨 طباعة بطاقات</button></div>
        <div id="cards" class="cards"></div>
      </div>
      <div class="card stack">
        <h2>الأكواد</h2>
        <input id="q" class="in" placeholder="ابحث بالكود أو الملاحظة أو البائع أو رمز الجهاز…" autocomplete="off">
        <div class="chips" id="statusChips"></div>
        <div class="row spread"><div class="faint" id="count"></div><button class="btn ghost sm" id="exportCsv">⬇ تصدير CSV</button></div>
        <div class="list" id="rows"><div class="empty"><div class="skeleton" style="width:60%;margin:0 auto"></div></div></div>
      </div>
    </section>

    <section id="t-devices" class="stack hidden">
      <div class="card stack">
        <h2>الأجهزة</h2>
        <div class="faint">كل جهاز فتح التطبيق: مرخّص أو في فترة تجريبية. رمز الجهاز هو ما يقرؤه العميل لك عند الشراء.</div>
        <input id="dq" class="in" placeholder="ابحث برمز الجهاز أو الاسم أو الكود…" autocomplete="off">
        <div class="chips" id="devChips"></div>
        <div class="faint" id="dcount"></div>
        <div class="list" id="drows"><div class="empty"><div class="skeleton" style="width:60%;margin:0 auto"></div></div></div>
      </div>
    </section>

    <section id="t-settings" class="stack hidden">
      <div class="card stack">
        <h2>ما يراه العميل في شاشة التفعيل</h2>
        <div class="grid2">
          <div><label class="l">السعر (نص)</label><input id="sPrice" class="in" placeholder="35$" maxlength="40"></div>
          <div><label class="l">رقم واتساب (مع رمز الدولة)</label><input id="sWhatsapp" class="in num" placeholder="9639xxxxxxxx" inputmode="tel" maxlength="20"></div>
        </div>
        <div><label class="l">رسالة للعملاء (اختياري)</label><textarea id="sMessage" class="in" maxlength="400" placeholder="مثال: للشراء أو الدعم راسلنا على واتساب من 9 صباحاً حتى 9 مساءً."></textarea></div>
      </div>
      <div class="card stack">
        <h2>قواعد الترخيص</h2>
        <div class="grid2">
          <div><label class="l">أيام التجربة المجانية</label><input id="sTrial" class="in num" type="number" min="0" max="365" inputmode="numeric"><div class="faint" style="margin-top:4px">0 يوقف التجربة. تجربة واحدة لكل جهاز.</div></div>
          <div><label class="l">أيام السماح بلا إنترنت</label><input id="sGrace" class="in num" type="number" min="1" max="365" inputmode="numeric"><div class="faint" style="margin-top:4px">بعدها يتوقف التطبيق حتى يتصل ويتحقق.</div></div>
        </div>
        <div><label class="l">أقل إصدار مسموح (اختياري)</label><input id="sMin" class="in num" placeholder="1.0.0" maxlength="20"><div class="faint" style="margin-top:4px">النسخ الأقدم تُطالَب بالتحديث ولا تُفعَّل.</div></div>
        <div><label class="l">بصمة توقيع أندرويد المسموحة (اختياري)</label><textarea id="sSig" class="in mono" maxlength="2000" placeholder="SHA-256 لشهادة التوقيع، ويمكن أكثر من واحدة مفصولة بفاصلة"></textarea><div class="faint" style="margin-top:4px">فارغة = لا تحقق. مع قيمة، تُرفض نسخ أندرويد المعاد توقيعها (تطبيق معدّل).</div></div>
        <button class="btn primary block lg" id="saveSet">حفظ الإعدادات</button>
      </div>
      <div class="card stack">
        <h2>للمطوّر</h2>
        <div class="faint">يحتاج من يبني التطبيق هذين: عنوان الخادم (متغير المستودع KASEB_API) والمفتاح العام.</div>
        <div><label class="l">عنوان الخادم</label><div class="copybox"><span class="mono" id="apiUrl"></span><button class="btn sm" data-copy="apiUrl">نسخ</button></div></div>
        <div><label class="l">المفتاح العام</label><div class="copybox"><span class="mono" id="pubKey">…</span><button class="btn sm" data-copy="pubKey">نسخ</button></div></div>
        <div class="faint">صفحة الخصوصية: <a id="privacyLink" href="/privacy" target="_blank" rel="noreferrer">/privacy</a></div>
      </div>
    </section>

  </main>
  <nav class="nav" id="bottomTabs"></nav>
</div>
<div id="sheetHost"></div>
<div id="askHost"></div>
<div id="printArea" class="print-only"></div>

<script>
'use strict'
const $ = id => document.getElementById(id)
const ICONS = {
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
  codes: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
  devices: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
  settings: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  phone: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/></svg>',
  pc: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  web: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  key: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/></svg>',
  copy: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  msg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
  note: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  cal: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  move: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5"/></svg>',
  ban: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>',
  undo: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
  print: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3h12v6M6 14h12v8H6z"/></svg>',
  gift: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  dot: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/></svg>',
  tool: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
}
const TABS = [['home', 'لوحة'], ['codes', 'أكواد'], ['devices', 'الأجهزة'], ['settings', 'إعدادات']]
$('topTabs').innerHTML = TABS.map(([k, l]) => '<button data-t="' + k + '" type="button">' + ICONS[k] + l + '</button>').join('')
$('bottomTabs').innerHTML = TABS.map(([k, l]) => '<button data-t="' + k + '" type="button">' + ICONS[k] + '<span>' + l + '</span></button>').join('')
let KEY = localStorage.getItem('kaseb.admin') || ''
const api = async (path, opts) => {
  opts = opts || {}
  const r = await fetch('/admin/api/' + path, Object.assign({}, opts, { headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY } }))
  const j = await r.json().catch(() => ({}))
  if (r.status === 401) { localStorage.removeItem('kaseb.admin'); KEY = ''; $('app').classList.add('hidden'); $('login').classList.remove('hidden'); $('loginErr').textContent = 'انتهت الجلسة، أدخل المفتاح من جديد.' }
  if (!r.ok) throw new Error(j.message || j.error || ('HTTP ' + r.status))
  return j
}
const post = (path, data) => api(path, { method: 'POST', body: JSON.stringify(data || {}) })
const LOC = 'ar-u-nu-latn'
const fmt = ms => ms ? new Date(ms).toLocaleDateString(LOC, { year: 'numeric', month: 'short', day: 'numeric' }) : 'دائم'
const when = ms => ms ? new Date(ms).toLocaleString(LOC, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const plural = (n, one, two, many) => n === 1 ? one : n === 2 ? two : n <= 10 ? n + ' ' + many : n + ' ' + one
const ago = ms => { if (!ms) return 'لم يُستخدم'; const m = Math.round((Date.now() - ms) / 60000); if (m < 1) return 'الآن'; if (m < 60) return 'قبل ' + plural(m, 'دقيقة', 'دقيقتين', 'دقائق'); const h = Math.round(m / 60); if (h < 48) return 'قبل ' + plural(h, 'ساعة', 'ساعتين', 'ساعات'); return 'قبل ' + plural(Math.round(h / 24), 'يوم', 'يومين', 'أيام') }
const daysLeft = ms => Math.max(0, Math.ceil((ms - Date.now()) / 86400000))
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const toast = (t, kind) => { const d = document.createElement('div'); d.className = 'toast ' + (kind || ''); d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), kind === 'bad' ? 3800 : 2200) }
const copy = t => navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t).then(() => toast('تم النسخ ✓', 'ok'), () => fallbackCopy(t)) : fallbackCopy(t)
function fallbackCopy(t) { const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('تم النسخ ✓', 'ok') } catch (e) { prompt('انسخ:', t) } ta.remove() }
const platIcon = p => p === 'android' ? ICONS.phone : p === 'electron' ? ICONS.pc : ICONS.web
const platName = p => p === 'android' ? 'أندرويد' : p === 'electron' ? 'ويندوز' : 'متصفح'
let SET = { price: '35$', whatsapp: '', trial_days: 7, grace_days: 10, min_version: '', android_signature: '', message: '' }
const customerMsg = (code, exp, maxDev) => 'شكراً لشرائك كاسب 🌟' + '\n' + 'كود التفعيل: ' + code + '\n' + 'افتح التطبيق وأنت متصل بالإنترنت ← شاشة التفعيل ← أدخل الكود ← تفعيل.' + '\n' + 'الكود يعمل على ' + (maxDev > 1 ? maxDev + ' أجهزة' : 'جهاز واحد') + (exp ? '، وصالح حتى ' + fmt(exp) : '، ترخيص دائم') + '.'

// ---- confirm dialog (a Promise)
function ask(title, text, opts) {
  opts = opts || {}
  return new Promise(resolve => {
    const host = $('askHost')
    host.innerHTML = '<div class="ask-bg"><div class="ask"><h2 style="margin-bottom:6px">' + esc(title) + '</h2><div class="muted">' + esc(text || '') + '</div><div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn" data-r="0">إلغاء</button><button class="btn ' + (opts.danger ? 'red' : 'primary') + '" data-r="1">' + esc(opts.ok || 'تأكيد') + '</button></div></div></div>'
    const done = r => { host.innerHTML = ''; resolve(r) }
    host.querySelectorAll('[data-r]').forEach(b => b.onclick = () => done(b.dataset.r === '1'))
    host.querySelector('.ask-bg').onclick = e => { if (e.target.classList.contains('ask-bg')) done(false) }
    host.querySelector('[data-r="1"]').focus()
  })
}
const sheetHost = $('sheetHost')
const closeSheet = () => { sheetHost.innerHTML = '' }
function openSheet(inner) {
  sheetHost.innerHTML = '<div class="sheet-bg"><div class="sheet" role="dialog"><div class="grab"></div>' + inner + '</div></div>'
  sheetHost.querySelector('.sheet-bg').onclick = e => { if (e.target.classList.contains('sheet-bg')) closeSheet() }
  return sheetHost.querySelector('.sheet')
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('askHost').innerHTML) $('askHost').innerHTML = ''; else closeSheet() } })
const act = (icon, label, cls, data) => '<button class="act ' + (cls || '') + '" data-a="' + data + '" type="button">' + ICONS[icon] + label + '</button>'

// ---- login
$('eye').onclick = () => { const i = $('key'); i.type = i.type === 'password' ? 'text' : 'password' }
async function enter() {
  KEY = $('key').value.trim() || KEY
  if (!KEY) return
  $('enter').disabled = true
  try { await api('settings'); localStorage.setItem('kaseb.admin', KEY); $('login').classList.add('hidden'); $('app').classList.remove('hidden'); $('loginErr').textContent = ''; go(location.hash.replace('#', '') || 'home') }
  catch (e) { $('loginErr').textContent = 'المفتاح غير صحيح.'; localStorage.removeItem('kaseb.admin'); KEY = '' }
  $('enter').disabled = false
}
$('enter').onclick = enter
$('key').onkeydown = e => { if (e.key === 'Enter') enter() }
$('logout').onclick = async () => { if (await ask('تسجيل الخروج؟', 'سيُحذف المفتاح من هذا المتصفح.', { ok: 'خروج' })) { localStorage.removeItem('kaseb.admin'); location.reload() } }

// ---- navigation
function go(t) {
  if (!TABS.some(x => x[0] === t)) t = 'home'
  closeSheet()
  document.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x.dataset.t === t))
  TABS.forEach(([k]) => $('t-' + k).classList.toggle('hidden', k !== t))
  $('title').textContent = TABS.find(x => x[0] === t)[1]
  location.hash = t
  window.scrollTo(0, 0)
  if (t === 'home') stats()
  if (t === 'codes') find()
  if (t === 'devices') findDevices()
  if (t === 'settings') loadSettings()
}
document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => go(b.dataset.t))
$('refresh').onclick = stats
$('privacyLink').href = location.origin + '/privacy'

// ---- dashboard
async function stats() {
  try {
    const s = await api('stats')
    $('kpis').innerHTML = [
      ['أكواد مُنشأة', s.codes.total, ''],
      ['أكواد مفعّلة', s.codes.activated, 'hero'],
      ['أجهزة نشطة (7 أيام)', s.devices.active7, ''],
      ['تجارب جارية', s.devices.trials, ''],
      ['تفعيلات هذا الأسبوع', s.activationsWeek, ''],
    ].map(([k, v, c]) => '<div class="kpi ' + c + '"><div class="v">' + (v || 0) + '</div><div class="k">' + k + '</div></div>').join('')
    const days = s.days || []
    const max = Math.max(1, ...days.map(d => d.n))
    $('chart').innerHTML = '<div class="chart">' + days.map(d => '<div style="height:' + Math.max(3, d.n / max * 100) + '%"><span>' + (d.n || '') + '</span></div>').join('') + '</div><div class="axis">' + days.map((d, i) => '<span>' + (i % 2 ? '' : new Date(d.day).toLocaleDateString(LOC, { day: 'numeric' })) + '</span>').join('') + '</div>'
    $('events').innerHTML = (s.recent || []).map(eventHtml).join('') || '<div class="empty"><div class="big">📭</div>لا أحداث بعد. أنشئ أول كود من تبويب «أكواد».</div>'
  } catch (e) { toast('تعذّر التحميل: ' + e.message, 'bad') }
}
const WHY = { invalid_code: 'كود غير موجود', revoked: 'الكود ملغى', expired: 'الترخيص منتهٍ', device_limit: 'الكود مستخدم على أجهزة أخرى', tampered: 'نسخة معدّلة من التطبيق', min_version: 'إصدار قديم من التطبيق', disabled: 'التجربة موقوفة', used: 'جرّب من قبل', device_mismatch: 'الكود انتقل إلى جهاز آخر', no_trial: 'لا تجربة', move_limit: 'استُنفدت مرات النقل', invalid_token: 'ترخيص غير صالح' }
const ACT = { revoke: 'إلغاء الكود', unrevoke: 'إعادة الكود', release: 'تحرير جهاز', extend: 'تمديد الترخيص', note: 'تعديل الملاحظة', devices: 'تغيير عدد الأجهزة', settings: 'حفظ الإعدادات', grant: 'منح كود لجهاز' }
function describe(e) {
  const d = String(e.detail || '')
  if (e.kind === 'activate') return ['good', 'check', d === 'refresh' ? 'إعادة تفعيل على الجهاز نفسه' : 'تفعيل جديد', '']
  if (e.kind === 'activate-fail') return ['bad', 'x', 'محاولة تفعيل فاشلة', WHY[d] || d]
  if (e.kind === 'trial') return ['good', 'clock', 'بدء تجربة مجانية', d]
  if (e.kind === 'trial-fail') return ['bad', 'x', 'طلب تجربة مرفوض', WHY[d] || d]
  if (e.kind === 'check') return ['', 'dot', d === 'upgrade' ? 'ترقية من التجربة إلى ترخيص' : 'تحقق دوري', '']
  if (e.kind === 'check-fail') return ['bad', 'x', 'تحقق مرفوض', WHY[d] || d]
  if (e.kind === 'release') return ['', 'move', d === 'move_limit' ? 'طلب نقل مرفوض' : 'العميل حرّر جهازه لنقل الترخيص', d === 'move_limit' ? WHY.move_limit : '']
  if (e.kind === 'admin') { const m = d.match(/^created (\d+)$/); if (m) return ['', 'tool', 'إنشاء ' + m[1] + ' كود', '']; return ['', 'tool', ACT[d] || 'إجراء إداري', ACT[d] ? '' : d] }
  return ['', 'dot', e.kind, d]
}
function eventHtml(e) {
  const [cls, ic, t, d] = describe(e)
  const who = (e.device_code ? '<span class="mono">' + esc(e.device_code) + '</span>' : '') + (e.name ? ' ' + esc(e.name) : '')
  return '<div class="ev ' + cls + '"><div class="ic">' + ICONS[ic] + '</div><div class="grow"><div class="t">' + esc(t) + (e.code ? ' <span class="mono">' + esc(e.code) + '</span>' : '') + '</div><div class="s">' + when(e.at) + (d ? ' · ' + esc(d) : '') + (who ? ' · ' + who : '') + '</div></div></div>'
}

// ---- codes
let fStatus = '', rows = [], timer
const chips = (host, items, cur, set) => { host.innerHTML = items.map(([v, l]) => '<button class="chip' + (v === cur ? ' on' : '') + '" data-v="' + v + '" type="button">' + l + '</button>').join(''); host.querySelectorAll('.chip').forEach(c => c.onclick = () => set(c.dataset.v)) }
function drawChips() { chips($('statusChips'), [['', 'الكل'], ['new', 'غير مستخدم'], ['used', 'مفعّل'], ['revoked', 'ملغى'], ['expired', 'منتهٍ']], fStatus, v => { fStatus = v; drawChips(); find() }) }
drawChips()
$('q').oninput = () => { clearTimeout(timer); timer = setTimeout(find, 300) }
const status = r => r.revoked ? 'rev' : r.expires_at && r.expires_at < Date.now() ? 'exp' : r.devices > 0 ? 'used' : 'new'
const badge = r => ({ rev: '<span class="badge b-rev">ملغى</span>', exp: '<span class="badge b-exp">منتهٍ</span>', used: '<span class="badge b-used">مفعّل' + (r.max_devices > 1 ? ' ' + r.devices + '/' + r.max_devices : '') + '</span>', new: '<span class="badge b-new">غير مستخدم</span>' })[status(r)]
async function find() {
  const qs = new URLSearchParams({ q: $('q').value, status: fStatus })
  try {
    rows = (await api('codes?' + qs)).codes
    $('count').textContent = rows.length ? rows.length + ' كود' + (rows.length >= 300 ? ' (أول 300)' : '') : ''
    $('rows').innerHTML = rows.map((r, i) => '<button class="item" data-i="' + i + '" type="button"><div class="ico">' + ICONS.key + '</div><div class="grow"><div class="t mono">' + r.code + '</div><div class="meta"><span>' + (r.expires_at ? 'حتى ' + fmt(r.expires_at) : 'دائم') + '</span>' + (r.seller ? '<span>🏷 ' + esc(r.seller) + '</span>' : '') + (r.note ? '<span class="truncate" style="max-width:220px">📝 ' + esc(r.note) + '</span>' : '') + (r.devices ? '<span>' + ago(r.last_seen) + '</span>' : '') + (r.moves ? '<span>🔁 نُقل ' + r.moves + '×</span>' : '') + '</div></div><div class="end">' + badge(r) + '</div></button>').join('')
      || '<div class="empty"><div class="big">🔍</div>' + ($('q').value || fStatus ? 'لا نتائج' : 'لا أكواد بعد. أنشئ أول كود من الأعلى.') + '</div>'
  } catch (e) { toast(e.message, 'bad') }
}
$('rows').onclick = e => { const c = e.target.closest('.item'); if (c) openCode(rows[+c.dataset.i].code) }
$('exportCsv').onclick = () => {
  if (!rows.length) return toast('لا شيء للتصدير')
  const csv = ['code,status,expires,devices,max_devices,seller,note,last_seen,created'].concat(rows.map(r => [r.code, status(r), r.expires_at ? new Date(r.expires_at).toISOString().slice(0, 10) : '', r.devices, r.max_devices, '"' + String(r.seller || '').replace(/"/g, '""') + '"', '"' + String(r.note || '').replace(/"/g, '""') + '"', r.last_seen ? new Date(r.last_seen).toISOString() : '', new Date(r.created_at).toISOString().slice(0, 10)].join(','))).join('\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'kaseb-codes.csv'; a.click()
}
function deviceLine(d, withRelease) {
  const trial = d.trial_started ? (d.trial_ends > Date.now() ? '<span class="badge b-trial">تجربة ' + daysLeft(d.trial_ends) + ' يوم</span>' : '<span class="badge">تجربة منتهية</span>') : ''
  return '<div class="dev"><div class="ico" style="width:36px;height:36px;border-radius:10px;background:var(--soft2);display:grid;place-items:center;color:var(--muted)">' + platIcon(d.platform) + '</div><div class="grow"><div class="bold truncate">' + esc(d.name || platName(d.platform)) + ' <span class="mono faint">' + esc(d.device_code) + '</span></div><div class="faint">' + platName(d.platform) + (d.version ? ' · v' + esc(d.version) : '') + ' · ' + ago(d.last_seen) + (d.bound_at ? ' · رُبط ' + fmt(d.bound_at) : '') + '</div></div>' + (withRelease ? '<button class="btn sm soft-red" data-rel="' + d.device + '" type="button">تحرير</button>' : trial) + '</div>'
}
async function openCode(code) {
  let r, devices, events
  try { const j = await api('codes/' + code.replace(/-/g, '')); devices = j.devices; events = j.events; r = Object.assign(j.code, { devices: devices.length, last_seen: Math.max(0, ...devices.map(d => d.last_seen || 0)) }) } catch (e) { return toast(e.message, 'bad') }
  const host = openSheet('<div class="row spread"><div><div class="mono" style="font-size:24px;font-weight:800">' + r.code + '</div><div class="muted">' + (r.expires_at ? 'صالح حتى ' + fmt(r.expires_at) : 'ترخيص دائم') + ' · ' + (r.max_devices > 1 ? r.max_devices + ' أجهزة' : 'جهاز واحد') + '</div></div>' + badge(r) + '</div>'
    + (r.note || r.seller ? '<div class="muted">' + esc([r.seller, r.note].filter(Boolean).join(' · ')) + '</div>' : '')
    + '<div class="card" style="padding:4px 12px"><h3 style="padding:8px 0 2px">الأجهزة (' + devices.length + '/' + r.max_devices + ')</h3>' + (devices.map(d => deviceLine(d, true)).join('') || '<div class="faint" style="padding:8px 0 12px">لم يُفعَّل على أي جهاز بعد.</div>') + '</div>'
    + '<div id="codeForm"></div>'
    + '<div class="col" style="gap:0">' + act('copy', 'نسخ الكود', '', 'copy') + act('msg', 'نسخ رسالة للعميل', '', 'msg') + act('print', 'طباعة بطاقة', '', 'print') + act('note', 'الملاحظة والبائع', '', 'note') + act('cal', 'تمديد / تغيير الانتهاء', '', 'extend') + act('devices', 'عدد الأجهزة المسموح', '', 'devices')
    + (r.revoked ? act('undo', 'إعادة الكود', '', 'unrevoke') : act('ban', 'إلغاء الكود', 'danger', 'revoke')) + '</div>'
    + '<details><summary class="muted" style="cursor:pointer;padding:6px 0">سجل الأحداث (' + events.length + ')</summary><div>' + (events.map(eventHtml).join('') || '<div class="faint">لا أحداث.</div>') + '</div></details>'
    + '<button class="btn block" data-a="close" type="button">إغلاق</button>')
  const form = host.querySelector('#codeForm')
  const refresh = () => { closeSheet(); find(); openCode(r.code) }
  host.querySelectorAll('[data-rel]').forEach(b => b.onclick = async () => {
    if (!(await ask('تحرير هذا الجهاز؟', 'سيتوقف التطبيق على هذا الجهاز ويصبح الكود متاحاً لتفعيل جهاز آخر.', { danger: true, ok: 'تحرير' }))) return
    try { await post('devices/' + b.dataset.rel + '/release'); toast('حُرّر الجهاز ✓', 'ok'); refresh() } catch (e) { toast(e.message, 'bad') }
  })
  host.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a
    try {
      if (a === 'close') return closeSheet()
      if (a === 'copy') return copy(r.code)
      if (a === 'msg') return copy(customerMsg(r.code, r.expires_at, r.max_devices))
      if (a === 'print') return printCards([r.code], r.expires_at, r.max_devices)
      if (a === 'note') {
        form.innerHTML = '<div class="card stack"><div class="grid2"><div><label class="l">البائع</label><input id="fSeller" class="in" value="' + esc(r.seller) + '" maxlength="80"></div><div><label class="l">الملاحظة</label><input id="fNote" class="in" value="' + esc(r.note) + '" maxlength="200"></div></div><div class="row"><button class="btn primary grow" id="fSave" type="button">حفظ</button><button class="btn" id="fCancel" type="button">إلغاء</button></div></div>'
        form.querySelector('#fCancel').onclick = () => { form.innerHTML = '' }
        form.querySelector('#fSave').onclick = async () => { try { await post('codes/' + r.code + '/note', { note: form.querySelector('#fNote').value, seller: form.querySelector('#fSeller').value }); toast('تم الحفظ ✓', 'ok'); refresh() } catch (e) { toast(e.message, 'bad') } }
        form.querySelector('#fNote').focus(); return
      }
      if (a === 'extend') {
        const cur = r.expires_at ? new Date(r.expires_at).toISOString().slice(0, 10) : ''
        form.innerHTML = '<div class="card stack"><label class="l">الانتهاء الجديد</label><div class="seg" id="fSeg"><button data-v="life" type="button"' + (!cur ? ' class="on"' : '') + '>دائم</button><button data-v="year" type="button">+ سنة من اليوم</button><button data-v="date" type="button"' + (cur ? ' class="on"' : '') + '>تاريخ</button></div><input id="fDate" type="date" class="in num' + (cur ? '' : ' hidden') + '" value="' + cur + '"><div class="row"><button class="btn primary grow" id="fSave" type="button">حفظ</button><button class="btn" id="fCancel" type="button">إلغاء</button></div></div>'
        let v = cur ? 'date' : 'life'
        form.querySelectorAll('#fSeg button').forEach(x => x.onclick = () => { v = x.dataset.v; form.querySelectorAll('#fSeg button').forEach(y => y.classList.toggle('on', y === x)); form.querySelector('#fDate').classList.toggle('hidden', v !== 'date') })
        form.querySelector('#fCancel').onclick = () => { form.innerHTML = '' }
        form.querySelector('#fSave').onclick = async () => {
          const d = form.querySelector('#fDate').value
          const exp = v === 'life' ? null : v === 'year' ? Date.now() + 365 * 86400000 : d ? endOfDay(d) : NaN
          if (Number.isNaN(exp)) return toast('اختر التاريخ', 'bad')
          try { await post('codes/' + r.code + '/extend', { expiresAt: exp }); toast('تم التحديث ✓', 'ok'); refresh() } catch (e) { toast(e.message, 'bad') }
        }
        return
      }
      if (a === 'devices') {
        form.innerHTML = '<div class="card stack"><label class="l">أجهزة لكل كود</label><select id="fMax" class="in">' + [1, 2, 3, 4, 5].map(n => '<option value="' + n + '"' + (n === r.max_devices ? ' selected' : '') + '>' + n + '</option>').join('') + '</select><div class="row"><button class="btn primary grow" id="fSave" type="button">حفظ</button><button class="btn" id="fCancel" type="button">إلغاء</button></div></div>'
        form.querySelector('#fCancel').onclick = () => { form.innerHTML = '' }
        form.querySelector('#fSave').onclick = async () => { try { await post('codes/' + r.code + '/devices', { maxDevices: +form.querySelector('#fMax').value }); toast('تم الحفظ ✓', 'ok'); refresh() } catch (e) { toast(e.message, 'bad') } }
        return
      }
      if (a === 'revoke') { if (!(await ask('إلغاء الكود؟', 'سيتوقف التطبيق عند صاحب هذا الكود خلال ساعات (عند أول تحقق). يمكنك إعادته لاحقاً.', { danger: true, ok: 'إلغاء الكود' }))) return; await post('codes/' + r.code + '/revoke') }
      if (a === 'unrevoke') await post('codes/' + r.code + '/unrevoke')
      toast('تم ✓', 'ok'); refresh()
    } catch (e) { toast(e.message, 'bad') }
  })
}
const endOfDay = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd, 23, 59, 0).getTime() }

// ---- make
let valid = 'life'
$('valid').querySelectorAll('button').forEach(b => b.onclick = () => { valid = b.dataset.v; $('valid').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); $('date').classList.toggle('hidden', valid !== 'date'); if (valid === 'date' && !$('date').value) $('date').value = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10) })
$('minus').onclick = () => { $('cnt').value = Math.max(1, +$('cnt').value - 1) }
$('plus').onclick = () => { $('cnt').value = Math.min(100, +$('cnt').value + 1) }
const expiry = () => valid === 'life' ? null : valid === 'year' ? Date.now() + 365 * 86400000 : $('date').value ? endOfDay($('date').value) : NaN
let last = null
$('make').onclick = async () => {
  const count = Math.max(1, Math.min(100, +$('cnt').value || 1))
  const exp = expiry()
  if (Number.isNaN(exp)) return toast('اختر تاريخ الانتهاء', 'bad')
  $('make').disabled = true
  try {
    last = await post('codes', { count, expiresAt: exp, maxDevices: +$('maxDev').value, seller: $('seller').value, note: $('note').value })
    $('made').classList.remove('hidden')
    $('madeTitle').textContent = last.codes.length + ' كود · ' + (last.expiresAt ? 'حتى ' + fmt(last.expiresAt) : 'دائم') + ' · ' + (last.maxDevices > 1 ? last.maxDevices + ' أجهزة' : 'جهاز واحد')
    $('cards').innerHTML = last.codes.map(c => '<div class="codecard"><div class="faint">كاسب — كود التفعيل</div><b class="mono">' + c + '</b><div class="faint">' + (last.expiresAt ? 'صالح حتى ' + fmt(last.expiresAt) : 'ترخيص دائم') + ' · ' + (last.maxDevices > 1 ? last.maxDevices + ' أجهزة' : 'لجهاز واحد') + '</div><button class="btn sm" style="margin-top:8px" data-c="' + c + '" type="button">نسخ</button></div>').join('')
    $('cards').querySelectorAll('[data-c]').forEach(b => b.onclick = () => copy(b.dataset.c))
    $('made').scrollIntoView({ behavior: 'smooth', block: 'start' })
    toast('أُنشئ ' + last.codes.length + ' كود ✓', 'ok')
    find()
  } catch (e) { toast('تعذّر الإنشاء: ' + e.message, 'bad') }
  $('make').disabled = false
}
$('madeClose').onclick = () => $('made').classList.add('hidden')
$('copyAll').onclick = () => last && copy(last.codes.join('\n'))
$('copyMsg').onclick = () => last && copy(customerMsg(last.codes[0], last.expiresAt, last.maxDevices))
$('printCards').onclick = () => last && printCards(last.codes, last.expiresAt, last.maxDevices)
function printCards(codes, exp, maxDev) {
  $('printArea').innerHTML = '<div class="cards">' + codes.map(c => '<div class="codecard"><div class="faint">كاسب — كود التفعيل</div><b class="mono">' + c + '</b><div class="faint">افتح كاسب ← شاشة التفعيل ← أدخل الكود<br>' + (exp ? 'صالح حتى ' + fmt(exp) : 'ترخيص دائم') + ' · ' + (maxDev > 1 ? maxDev + ' أجهزة' : 'لجهاز واحد') + (SET.whatsapp ? '<br>واتساب: <span class="num">' + esc(SET.whatsapp) + '</span>' : '') + '</div></div>').join('') + '</div>'
  window.print()
}

// ---- devices
let fDev = '', devRows = [], dtimer
function drawDevChips() { chips($('devChips'), [['', 'الكل'], ['licensed', 'مرخّص'], ['trial', 'تجربة'], ['free', 'بلا ترخيص']], fDev, v => { fDev = v; drawDevChips(); findDevices() }) }
drawDevChips()
$('dq').oninput = () => { clearTimeout(dtimer); dtimer = setTimeout(findDevices, 300) }
const devState = d => d.code ? (d.code_revoked ? 'rev' : d.code_expires && d.code_expires < Date.now() ? 'exp' : 'lic') : d.trial_started ? (d.trial_ends > Date.now() ? 'trial' : 'trialEnd') : 'free'
const devBadge = d => ({ lic: '<span class="badge b-used">مرخّص</span>', rev: '<span class="badge b-rev">كود ملغى</span>', exp: '<span class="badge b-exp">ترخيص منتهٍ</span>', trial: '<span class="badge b-trial">تجربة · ' + daysLeft(d.trial_ends) + ' يوم</span>', trialEnd: '<span class="badge">تجربة منتهية</span>', free: '<span class="badge b-new">بلا ترخيص</span>' })[devState(d)]
async function findDevices() {
  try {
    const all = (await api('devices?' + new URLSearchParams({ q: $('dq').value }))).devices
    devRows = all.filter(d => { const s = devState(d); return !fDev || (fDev === 'licensed' ? !!d.code : fDev === 'trial' ? s === 'trial' || s === 'trialEnd' : !d.code && s !== 'trial') })
    $('dcount').textContent = devRows.length ? devRows.length + ' جهاز' : ''
    $('drows').innerHTML = devRows.map((d, i) => '<button class="item" data-i="' + i + '" type="button"><div class="ico">' + platIcon(d.platform) + '</div><div class="grow"><div class="t truncate">' + esc(d.name || platName(d.platform)) + '</div><div class="meta"><span class="mono">' + esc(d.device_code) + '</span><span>' + platName(d.platform) + (d.version ? ' v' + esc(d.version) : '') + '</span><span>' + ago(d.last_seen) + '</span>' + (d.code ? '<span class="mono">' + d.code + '</span>' : '') + '</div></div><div class="end">' + devBadge(d) + '</div></button>').join('')
      || '<div class="empty"><div class="big">📱</div>' + ($('dq').value || fDev ? 'لا نتائج' : 'لم يتصل أي جهاز بعد.') + '</div>'
  } catch (e) { toast(e.message, 'bad') }
}
$('drows').onclick = e => { const c = e.target.closest('.item'); if (c) openDevice(devRows[+c.dataset.i]) }
async function openDevice(d) {
  let events = []
  try { events = (await api('events?device=' + d.device)).events } catch (e) { /* the sheet still opens */ }
  const host = openSheet('<div class="row spread"><div class="row" style="gap:10px"><div class="ico" style="width:44px;height:44px;border-radius:12px;background:var(--soft2);display:grid;place-items:center;color:var(--muted)">' + platIcon(d.platform) + '</div><div><div class="bold" style="font-size:17px">' + esc(d.name || platName(d.platform)) + '</div><div class="mono muted">' + esc(d.device_code) + '</div></div></div>' + devBadge(d) + '</div>'
    + '<div class="card kv"><span class="k">النظام</span><span class="v">' + platName(d.platform) + '</span><span class="k">الإصدار</span><span class="v num">' + esc(d.version || '—') + (d.build ? ' (' + esc(d.build) + ')' : '') + '</span><span class="k">الكود</span><span class="v">' + (d.code ? '<button class="btn sm soft" id="dCode" type="button"><span class="mono">' + d.code + '</span></button>' : '<span class="faint">لا يوجد</span>') + '</span><span class="k">التجربة</span><span class="v">' + (d.trial_started ? fmt(d.trial_started) + ' ← ' + fmt(d.trial_ends) : 'لم يجرّب') + '</span><span class="k">أول ظهور</span><span class="v">' + fmt(d.first_seen) + '</span><span class="k">آخر ظهور</span><span class="v">' + when(d.last_seen) + '</span>' + (d.sig && d.platform === 'android' ? '<span class="k">البصمة</span><span class="v mono" style="font-size:11px">' + esc(d.sig) + '</span>' : '') + '</div>'
    + '<div id="devForm"></div>'
    + '<div class="col" style="gap:0">' + act('copy', 'نسخ رمز الجهاز', '', 'copy') + (d.code ? act('move', 'تحرير الجهاز من الكود', 'danger', 'release') : act('gift', 'منح كود لهذا الجهاز', '', 'grant')) + '</div>'
    + '<details><summary class="muted" style="cursor:pointer;padding:6px 0">سجل الأحداث (' + events.length + ')</summary><div>' + (events.map(eventHtml).join('') || '<div class="faint">لا أحداث.</div>') + '</div></details>'
    + '<button class="btn block" data-a="close" type="button">إغلاق</button>')
  const form = host.querySelector('#devForm')
  const dc = host.querySelector('#dCode'); if (dc) dc.onclick = () => openCode(d.code)
  host.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a
    try {
      if (a === 'close') return closeSheet()
      if (a === 'copy') return copy(d.device_code)
      if (a === 'release') {
        if (!(await ask('تحرير هذا الجهاز؟', 'سيتوقف التطبيق عليه ويصبح الكود ' + d.code + ' متاحاً لجهاز آخر.', { danger: true, ok: 'تحرير' }))) return
        await post('devices/' + d.device + '/release'); toast('حُرّر الجهاز ✓', 'ok'); closeSheet(); findDevices(); return
      }
      if (a === 'grant') {
        form.innerHTML = '<div class="card stack"><div class="muted">يُنشأ كود جديد مربوط بهذا الجهاز فوراً: يتحوّل التطبيق من التجربة إلى الترخيص عند أول تحقق (أو عند ضغط «تحقّق الآن»)، وأرسل الكود للعميل ليحتفظ به.</div><label class="l">المدة</label><div class="seg" id="gSeg"><button data-v="life" class="on" type="button">دائم</button><button data-v="year" type="button">سنة</button></div><div class="grid2"><div><label class="l">البائع</label><input id="gSeller" class="in" placeholder="مباشر" maxlength="80"></div><div><label class="l">ملاحظة</label><input id="gNote" class="in" value="' + esc(d.name) + '" maxlength="200"></div></div><div class="row"><button class="btn primary grow" id="gSave" type="button">إنشاء ومنح</button><button class="btn" id="gCancel" type="button">إلغاء</button></div></div>'
        let v = 'life'
        form.querySelectorAll('#gSeg button').forEach(x => x.onclick = () => { v = x.dataset.v; form.querySelectorAll('#gSeg button').forEach(y => y.classList.toggle('on', y === x)) })
        form.querySelector('#gCancel').onclick = () => { form.innerHTML = '' }
        form.querySelector('#gSave').onclick = async () => {
          try {
            const res = await post('codes', { count: 1, device: d.device, expiresAt: v === 'life' ? null : Date.now() + 365 * 86400000, maxDevices: 1, seller: form.querySelector('#gSeller').value, note: form.querySelector('#gNote').value })
            form.innerHTML = '<div class="card stack"><div class="bold">مُنح الكود ✓</div><div class="mono" style="font-size:22px;font-weight:800">' + res.codes[0] + '</div><div class="row"><button class="btn soft grow" id="gCopy" type="button">نسخ الكود</button><button class="btn soft grow" id="gMsg" type="button">نسخ رسالة للعميل</button></div></div>'
            form.querySelector('#gCopy').onclick = () => copy(res.codes[0])
            form.querySelector('#gMsg').onclick = () => copy(customerMsg(res.codes[0], res.expiresAt, 1))
            toast('مُنح الكود ✓', 'ok'); findDevices()
          } catch (e) { toast(e.message, 'bad') }
        }
      }
    } catch (e) { toast(e.message, 'bad') }
  })
}

// ---- settings
async function loadSettings() {
  try {
    const s = await api('settings'); SET = s
    $('sPrice').value = s.price; $('sWhatsapp').value = s.whatsapp; $('sMessage').value = s.message; $('sTrial').value = s.trial_days; $('sGrace').value = s.grace_days; $('sMin').value = s.min_version; $('sSig').value = s.android_signature
  } catch (e) { toast(e.message, 'bad') }
  $('apiUrl').textContent = location.origin
  try { const k = await fetch('/api/public-key').then(r => r.json()); $('pubKey').textContent = k.publicKey || (k.message || 'غير مهيّأ') } catch (e) { $('pubKey').textContent = 'تعذّر الجلب' }
}
$('saveSet').onclick = async () => {
  const grace = +$('sGrace').value
  if (!(grace >= 1)) return toast('أيام السماح يجب أن تكون 1 على الأقل', 'bad')
  $('saveSet').disabled = true
  try {
    SET = await post('settings', { price: $('sPrice').value, whatsapp: $('sWhatsapp').value, message: $('sMessage').value, trial_days: +$('sTrial').value, grace_days: grace, min_version: $('sMin').value, android_signature: $('sSig').value })
    $('sWhatsapp').value = SET.whatsapp; $('sMin').value = SET.min_version; $('sSig').value = SET.android_signature; $('sPrice').value = SET.price
    toast('حُفظت الإعدادات ✓', 'ok')
  } catch (e) { toast('خطأ: ' + e.message, 'bad') }
  $('saveSet').disabled = false
}
document.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copy($(b.dataset.copy).textContent))
window.addEventListener('hashchange', () => { const t = location.hash.replace('#', ''); if (KEY && !$('app').classList.contains('hidden') && t && !document.querySelector('[data-t="' + t + '"].on')) go(t) })

if (KEY) enter(); else $('key').focus()
</script></body></html>`
