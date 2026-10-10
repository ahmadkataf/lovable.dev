// The control panel's stylesheet (see admin.ts). Design tokens on :root; the dark set is written once and applied
// both to the system preference (unless the person chose light) and to the explicit choice (data-theme="dark").
// 8px spacing grid, 44px touch targets, phone first with the sidebar layout from 1024px.

const DARK = String.raw`--bg:#0b1220;--surface:#111a2c;--surface-2:#182338;--surface-3:#1f2c45;--border:#223049;--border-2:#2f3f5c;
--text:#e9eef7;--text-2:#a9b5c9;--text-3:#73819a;--brand:#22c48c;--brand-2:#5ddcac;--brand-soft:rgba(34,196,140,.15);--brand-ink:#7fe6c0;
--info:#6b9cff;--info-soft:rgba(107,156,255,.16);--ok:#34c98a;--ok-soft:rgba(52,201,138,.16);--warn:#f2b43a;--warn-soft:rgba(242,180,58,.16);
--danger:#ff6b70;--danger-soft:rgba(255,107,112,.16);--violet:#b48cff;--violet-soft:rgba(180,140,255,.16);
--shadow-1:0 1px 2px rgba(0,0,0,.4);--shadow-2:0 12px 32px rgba(0,0,0,.45);--ring:rgba(34,196,140,.35);--scrim:rgba(3,7,18,.7);--on-brand:#06281c`

const CSS = String.raw`
:root{--bg:#f4f6fa;--surface:#fff;--surface-2:#f6f8fb;--surface-3:#eceff5;--border:#e4e8ef;--border-2:#cfd6e2;
--text:#0f172a;--text-2:#4b5970;--text-3:#8792a6;--brand:#0f9f6e;--brand-2:#0a7d56;--brand-soft:#e2f6ee;--brand-ink:#0a6a4b;
--info:#2f6fed;--info-soft:#e6eeff;--ok:#15955f;--ok-soft:#e1f5ea;--warn:#b26a00;--warn-soft:#fff2d9;--danger:#d93a3f;--danger-soft:#fde8e9;--violet:#6d4fd8;--violet-soft:#eee9fd;
--shadow-1:0 1px 2px rgba(15,23,42,.05),0 1px 3px rgba(15,23,42,.08);--shadow-2:0 12px 32px rgba(15,23,42,.14);--ring:rgba(15,159,110,.28);--scrim:rgba(15,23,42,.45);--on-brand:#fff;
--font:"IBM Plex Sans Arabic",system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;--mono:ui-monospace,"Cascadia Mono","Roboto Mono",Menlo,Consolas,monospace;
--side:248px;--top:60px;--nav:60px;--sat:env(safe-area-inset-top,0px);--sab:env(safe-area-inset-bottom,0px);--r-sm:8px;--r:12px;--r-lg:16px;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){` + DARK + `;color-scheme:dark}}
:root[data-theme=dark]{` + DARK + `;color-scheme:dark}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{height:100%;scroll-behavior:smooth}
body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font:14px/1.55 var(--font);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer}a{color:var(--brand-ink)}
h1,h2,h3{margin:0;line-height:1.3;font-weight:700}h1{font-size:20px}h2{font-size:16px}h3{font-size:13px;color:var(--text-2);font-weight:600}
:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.hidden{display:none!important}.muted{color:var(--text-2);font-size:13px}.faint{color:var(--text-3);font-size:12px}.b{font-weight:700}.sb{font-weight:600}
.mono{font-family:var(--mono);direction:ltr;unicode-bidi:isolate;letter-spacing:.4px}.num{direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums}.ltr{direction:ltr;unicode-bidi:isolate}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.spread{justify-content:space-between}.grow{flex:1;min-width:0}.col{display:flex;flex-direction:column;gap:8px}.nowrap{white-space:nowrap}
.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stack>*+*{margin-top:12px}.stack-lg>*+*{margin-top:16px}.mt{margin-top:16px}.mt-s{margin-top:8px}
svg{flex:none}.ic{display:inline-flex;align-items:center;justify-content:center}
/* ---- login ---- */
#login{min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:radial-gradient(900px 500px at 90% -10%,var(--brand-soft) 0,transparent 60%),radial-gradient(700px 400px at -5% 105%,var(--info-soft) 0,transparent 55%),var(--bg)}
.login-card{width:100%;max-width:400px;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:28px 24px;box-shadow:var(--shadow-2)}
.logo{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,var(--brand),#28cf96);color:#fff;display:grid;place-items:center;font-weight:800;font-size:20px;flex:none;letter-spacing:-.5px}
.field{position:relative}.field .in{padding-left:46px}.field .eye{position:absolute;left:4px;top:50%;transform:translateY(-50%);background:none;border:0;padding:0;color:var(--text-3);width:40px;height:40px;border-radius:8px;display:grid;place-items:center}
.field .eye:hover{color:var(--text);background:var(--surface-3)}
.err{color:var(--danger);font-size:13px;min-height:20px;margin-top:8px;display:flex;align-items:center;gap:6px}
.check{display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer;user-select:none}.check input{width:18px;height:18px;accent-color:var(--brand);margin:0}
/* ---- shell ---- */
#app{min-height:100vh}
.side{display:none}
.top{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--surface) 88%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--border);padding:calc(8px + var(--sat)) 16px 8px;display:flex;align-items:center;gap:8px;min-height:calc(var(--top) + var(--sat))}
.top .logo{width:34px;height:34px;border-radius:10px;font-size:16px}
.top h1{font-size:17px}.top .gs{display:none}
.content{padding:16px;padding-bottom:calc(var(--nav) + 24px + var(--sab));max-width:1240px;width:100%;margin:0 auto}
.nav{position:fixed;bottom:0;right:0;left:0;z-index:30;display:flex;background:color-mix(in srgb,var(--surface) 94%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--border);padding-bottom:var(--sab);height:calc(var(--nav) + var(--sab))}
.nav button{flex:1;background:none;border:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px 2px;color:var(--text-3);font-size:11px;font-weight:600;min-height:44px}
.nav button.on{color:var(--brand)}.nav button svg{width:22px;height:22px}
.view{display:none}.view.on{display:block;animation:fade .18s ease}
@keyframes fade{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
.menu{position:absolute;z-index:40;top:calc(100% + 6px);left:0;min-width:240px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--shadow-2);padding:6px}
.menu .item{display:flex;align-items:center;gap:10px;width:100%;border:0;background:none;padding:10px 12px;border-radius:8px;text-align:start;min-height:44px;color:var(--text)}
.menu .item:hover{background:var(--surface-2)}.menu .item.danger{color:var(--danger)}.menu hr{border:0;border-top:1px solid var(--border);margin:6px 0}
.menu .head{padding:8px 12px 4px;font-size:12px;color:var(--text-3)}
.side .menu{top:auto;bottom:calc(100% + 6px);left:0;right:0;min-width:0}
@media (min-width:1024px){
  #app{display:grid;grid-template-columns:var(--side) 1fr}
  .side{display:flex;flex-direction:column;position:sticky;top:0;height:100vh;background:var(--surface);border-inline-end:1px solid var(--border);padding:16px 12px}
  .side .brand{display:flex;align-items:center;gap:10px;padding:4px 8px 16px}.side .brand .t{font-weight:700;font-size:16px}.side .brand .s{font-size:12px;color:var(--text-3)}
  .side nav{display:flex;flex-direction:column;gap:2px}
  .side nav button{display:flex;align-items:center;gap:12px;border:0;background:none;padding:0 12px;min-height:42px;border-radius:10px;color:var(--text-2);font-weight:600;font-size:14px;text-align:start;width:100%}
  .side nav button svg{width:20px;height:20px}
  .side nav button:hover{background:var(--surface-2);color:var(--text)}.side nav button.on{background:var(--brand-soft);color:var(--brand-ink)}
  .side nav button .cnt{margin-inline-start:auto;font-size:11px;background:var(--surface-3);color:var(--text-2);border-radius:999px;padding:1px 8px;font-variant-numeric:tabular-nums}
  .side .foot{margin-top:auto;border-top:1px solid var(--border);padding-top:12px;display:flex;flex-direction:column;gap:2px}
  .top{padding:10px 24px}.top .logo,.top #mTitle{display:none}.top h1{display:block}
  .top .gs{display:flex;flex:1;max-width:460px;margin-inline-start:8px}
  .nav{display:none}.content{padding:24px 28px 48px}
}
/* ---- search box ---- */
.search{position:relative;display:flex;align-items:center;flex:1;min-width:0}.search svg{position:absolute;right:12px;color:var(--text-3);pointer-events:none}
.search .in{padding-right:40px;padding-left:40px}.search kbd{position:absolute;left:10px;font:11px var(--mono);color:var(--text-3);border:1px solid var(--border-2);border-radius:5px;padding:1px 6px;background:var(--surface-2);display:none}
@media (min-width:1024px){.search kbd{display:block}}
.search .clr{position:absolute;left:4px;width:36px;height:36px;border:0;background:none;color:var(--text-3);display:grid;place-items:center;border-radius:8px}
/* ---- controls ---- */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;box-shadow:var(--shadow-1)}
.card.pad-0{padding:0;overflow:hidden}.card-h{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 16px;border-bottom:1px solid var(--border)}
.card-h h2{font-size:15px}.card-b{padding:16px}
.l{display:block;font-size:13px;font-weight:600;margin:0 0 6px;color:var(--text-2)}.hint{font-size:12px;color:var(--text-3);margin-top:6px}
.in{width:100%;min-width:0;min-height:44px;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface);font-size:15px;outline:0;transition:border-color .15s,box-shadow .15s;appearance:none;-webkit-appearance:none}
.in::placeholder{color:var(--text-3)}.in:focus{border-color:var(--brand);box-shadow:0 0 0 3px var(--ring)}.in.bad{border-color:var(--danger)}.in.bad:focus{box-shadow:0 0 0 3px var(--danger-soft)}
textarea.in{min-height:84px;resize:vertical;line-height:1.5}.in.sm{min-height:38px;padding:6px 10px;font-size:14px}
select.in{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238792a6' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:left 12px center;padding-left:36px}
input[type=date].in{min-width:0}.ferr{color:var(--danger);font-size:12px;margin-top:6px;display:none}.bad+.ferr,.bad~.ferr{display:block}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 16px;border:1px solid transparent;border-radius:10px;background:var(--surface-3);color:var(--text);font-weight:600;font-size:14px;cursor:pointer;transition:transform .08s,filter .15s,background .15s;white-space:nowrap;user-select:none}
.btn:hover{filter:brightness(.97)}.btn:active{transform:translateY(1px)}.btn:disabled{opacity:.5;cursor:default;pointer-events:none}
.btn.primary{background:var(--brand);color:var(--on-brand)}.btn.danger{background:var(--danger);color:#fff}.btn.soft{background:var(--brand-soft);color:var(--brand-ink)}.btn.soft-danger{background:var(--danger-soft);color:var(--danger)}
.btn.ghost{background:transparent;color:var(--text-2)}.btn.ghost:hover{background:var(--surface-3);color:var(--text)}.btn.outline{background:var(--surface);border-color:var(--border-2)}
.btn.sm{min-height:36px;padding:0 12px;font-size:13px;border-radius:8px}.btn.lg{min-height:50px;font-size:16px;border-radius:12px}.btn.block{width:100%}.btn.icon{width:44px;padding:0}.btn.icon.sm{width:36px}
.btn .spin{width:16px;height:16px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.seg{display:flex;background:var(--surface-3);border-radius:10px;padding:3px;gap:2px}
.seg button{flex:1;border:0;background:none;min-height:38px;padding:0 10px;border-radius:8px;font-weight:600;font-size:13px;white-space:nowrap;color:var(--text-2);cursor:pointer}.seg button.on{background:var(--surface);color:var(--text);box-shadow:var(--shadow-1)}
.stepper{display:flex;align-items:center;border:1.5px solid var(--border);border-radius:10px;background:var(--surface);overflow:hidden}
.stepper button{width:46px;height:44px;border:0;background:none;font-size:22px;font-weight:600;color:var(--brand);cursor:pointer}.stepper button:hover{background:var(--surface-2)}
.stepper input{flex:1;border:0;background:none;text-align:center;font-size:18px;font-weight:700;width:60px;outline:0;min-width:0;font-variant-numeric:tabular-nums}
.chips{display:flex;gap:8px;overflow-x:auto;padding:2px;scrollbar-width:none;-webkit-overflow-scrolling:touch}.chips::-webkit-scrollbar{display:none}
.chip{flex:none;min-height:36px;padding:0 14px;border-radius:999px;border:1.5px solid var(--border);background:var(--surface);font-size:13px;font-weight:600;color:var(--text-2);cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.chip:hover{border-color:var(--border-2);color:var(--text)}.chip.on{background:var(--text);color:var(--bg);border-color:var(--text)}
.chip .n{font-size:11px;opacity:.75;font-variant-numeric:tabular-nums}
.toolbar{display:flex;flex-direction:column;gap:10px}.toolbar .r1{display:flex;gap:8px}.toolbar .r2{display:flex;gap:8px;align-items:center}
.toolbar .r2 .chips{flex:1}.toolbar select.in{width:auto;min-width:140px}
@media (min-width:1024px){.toolbar{flex-direction:row;flex-wrap:wrap;align-items:center}.toolbar .r1{flex:1;min-width:320px}.toolbar .r2{flex:2}}
.meta{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;color:var(--text-2);padding:4px 2px}
.pager{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 0}.pager .pg{font-variant-numeric:tabular-nums;color:var(--text-2);font-size:13px;min-width:90px;text-align:center}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.grid3{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.grid2>*,.grid3>*,.split>*,.kpis>*{min-width:0}
@media (min-width:720px){.grid3{grid-template-columns:repeat(3,1fr)}}@media (max-width:419px){#v-settings .grid2{grid-template-columns:1fr}}
.split{display:grid;gap:16px}@media (min-width:1024px){.split{grid-template-columns:1fr 1fr}.split.w{grid-template-columns:3fr 2fr}}
.kv{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13px}.kv dt{color:var(--text-3);margin:0}.kv dd{margin:0;min-width:0;overflow-wrap:anywhere}
.badge{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap;background:var(--surface-3);color:var(--text-2);line-height:1.6}
.badge::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.badge.ok{background:var(--ok-soft);color:var(--ok)}.badge.warn{background:var(--warn-soft);color:var(--warn)}.badge.bad{background:var(--danger-soft);color:var(--danger)}.badge.info{background:var(--info-soft);color:var(--info)}.badge.violet{background:var(--violet-soft);color:var(--violet)}.badge.plain::before{display:none}
.tag{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--text-2);background:var(--surface-2);border:1px solid var(--border);border-radius:6px;padding:1px 7px;white-space:nowrap}.tag svg{width:13px;height:13px}
.tag.warn{color:var(--warn);border-color:transparent;background:var(--warn-soft)}.tag.ok{color:var(--ok);border-color:transparent;background:var(--ok-soft)}.tag.bad{color:var(--danger);border-color:transparent;background:var(--danger-soft)}
/* ---- KPI ---- */
.kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}@media (min-width:720px){.kpis{grid-template-columns:repeat(4,1fr);gap:12px}}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:14px 16px;box-shadow:var(--shadow-1);display:flex;flex-direction:column;gap:4px;min-height:96px;cursor:pointer;text-align:start;transition:transform .12s,box-shadow .12s}
.kpi:hover{transform:translateY(-1px);box-shadow:var(--shadow-2)}
.kpi .k{font-size:12px;color:var(--text-2);font-weight:600;display:flex;align-items:center;gap:6px}.kpi .k svg{width:16px;height:16px;color:var(--text-3)}
.kpi .v{font-size:28px;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums;letter-spacing:-.5px}.kpi .s{font-size:12px;color:var(--text-3)}
.kpi.warn .v{color:var(--warn)}.kpi.bad .v{color:var(--danger)}.kpi.brand .v{color:var(--brand-ink)}
/* ---- charts ---- */
.chart{position:relative}.chart svg{width:100%;height:auto;display:block;overflow:visible}
.chart .gl{stroke:var(--border);stroke-width:1}.chart .ax{fill:var(--text-3);font-size:10px;font-family:var(--font)}.chart .bar{fill:var(--brand);transition:opacity .12s}.chart .bar.dim{opacity:.35}
.chart .ln{fill:none;stroke:var(--info);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}.chart .ar{fill:var(--brand);opacity:.12}.chart .ln2{fill:none;stroke:var(--brand);stroke-width:2;stroke-linejoin:round}
.chart .dot{fill:var(--brand);stroke:var(--surface);stroke-width:2}.chart .dot2{fill:var(--info);stroke:var(--surface);stroke-width:2}.chart .lbl{fill:var(--text);font-size:11px;font-weight:600;font-family:var(--font)}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--text-2);margin-top:8px}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-inline-end:6px;vertical-align:-1px}
#tip{position:fixed;z-index:60;pointer-events:none;background:var(--text);color:var(--bg);font-size:12px;padding:6px 10px;border-radius:8px;box-shadow:var(--shadow-2);display:none;max-width:240px;line-height:1.5}
.hbar{display:flex;height:14px;border-radius:7px;overflow:hidden;gap:2px;background:var(--surface-3)}.hbar i{display:block;min-width:2px}
.plat{display:grid;gap:10px;margin-top:12px}.plat .p{display:flex;align-items:center;gap:10px;font-size:13px}.plat .p i{width:10px;height:10px;border-radius:3px;flex:none}.plat .p .n{margin-inline-start:auto;font-variant-numeric:tabular-nums;color:var(--text-2)}
/* ---- events ---- */
.ev{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);align-items:flex-start}.ev:last-child{border-bottom:0}
.ev .i{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;flex:none;background:var(--surface-3);color:var(--text-2)}.ev .i svg{width:16px;height:16px}
.ev.good .i{background:var(--ok-soft);color:var(--ok)}.ev.bad .i{background:var(--danger-soft);color:var(--danger)}.ev.info .i{background:var(--info-soft);color:var(--info)}.ev.warn .i{background:var(--warn-soft);color:var(--warn)}
.ev .t{font-weight:600;font-size:13px}.ev .s{font-size:12px;color:var(--text-3);margin-top:2px;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center}
.ev .s .lnk{color:var(--brand-ink);cursor:pointer;font-weight:600}
/* ---- tables (cards on a phone) ---- */
.tbl{width:100%;border-collapse:collapse}.tbl th{text-align:start;font-size:12px;color:var(--text-3);font-weight:600;padding:10px 12px;border-bottom:1px solid var(--border);white-space:nowrap;background:var(--surface-2)}
.tbl th.sort{cursor:pointer;user-select:none}.tbl th.sort:hover{color:var(--text)}.tbl th.sort.on{color:var(--brand-ink)}
.tbl td{padding:11px 12px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:middle}.tbl tr.r{cursor:pointer}@media (hover:hover){.tbl tr.r:hover td{background:var(--surface-2)}}
.tbl tr:last-child td{border-bottom:0}.tbl .end{text-align:end}.tbl td.act{white-space:nowrap}.tbl .sub{display:block;font-size:12px;color:var(--text-3);margin-top:2px}
.tbl tr.hl td:first-child{box-shadow:inset -3px 0 0 var(--warn)}
@media (max-width:1023px){
  .tbl,.tbl tbody{display:block}.tbl thead{display:none}
  .tbl tr{display:grid;grid-template-columns:1fr auto;gap:4px 8px;padding:12px 14px;border-bottom:1px solid var(--border);align-items:center}
  .tbl td{display:block;padding:0;border:0;font-size:13px}.tbl td.p{grid-column:1;font-size:15px;min-width:0}.tbl td.p .truncate{min-width:0}.tbl td.st{grid-column:2;grid-row:1;justify-self:end;text-align:end}
  .tbl td.m{grid-column:1/-1;display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}.tbl td.m::before{content:attr(data-l);color:var(--text-3);font-size:12px;flex:none}
  .tbl td.act{grid-column:1/-1;margin-top:6px}.tbl td.x{display:none}.tbl td.p .sub{display:inline;margin-inline-start:8px;white-space:nowrap}.tbl td.st .mono{white-space:nowrap}
  .tbl tr.hl td:first-child{box-shadow:none}.tbl tr.hl{box-shadow:inset -3px 0 0 var(--warn)}
}
/* ---- timeline ---- */
.tl{position:relative;padding-inline-start:22px}.tl::before{content:"";position:absolute;right:7px;top:8px;bottom:8px;width:2px;background:var(--border)}
.tl .s{position:relative;padding:4px 0 10px}.tl .s::before{content:"";position:absolute;right:-19px;top:9px;width:10px;height:10px;border-radius:50%;background:var(--border-2);border:2px solid var(--surface)}
.tl .s.done::before{background:var(--brand)}.tl .s.bad::before{background:var(--danger)}.tl .s.warn::before{background:var(--warn)}.tl .s .t{font-weight:600;font-size:13px}.tl .s .d{font-size:12px;color:var(--text-3)}
/* ---- sheets, dialogs, toasts ---- */
.sheet-bg{position:fixed;inset:0;z-index:50;background:var(--scrim);display:flex;align-items:flex-end;justify-content:center;animation:fadein .15s}
@keyframes fadein{from{opacity:0}to{opacity:1}}@keyframes up{from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}}
.sheet{width:100%;max-height:calc(100vh - 32px - var(--sat));background:var(--surface);border-radius:20px 20px 0 0;display:flex;flex-direction:column;animation:up .2s ease;box-shadow:var(--shadow-2)}
.sheet .grab{width:40px;height:4px;border-radius:2px;background:var(--border-2);margin:8px auto 0;flex:none}
.sheet .sh{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--border);flex:none}.sheet .sh h2{flex:1;min-width:0;font-size:16px}
.sheet .sb{padding:16px;overflow:auto;padding-bottom:calc(16px + var(--sab));overscroll-behavior:contain}.sheet .sf{padding:12px 16px calc(12px + var(--sab));border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end;flex:none;flex-wrap:wrap}
@media (min-width:1024px){.sheet-bg{align-items:center;padding:24px}.sheet{max-width:600px;border-radius:var(--r-lg);max-height:calc(100vh - 48px)}.sheet.wide{max-width:800px}.sheet .grab{display:none}.sheet .sb{padding:20px}}
.acts{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}@media (min-width:600px){.acts{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}}
.act{display:flex;align-items:center;gap:10px;min-height:48px;padding:0 12px;border:1px solid var(--border);background:var(--surface);border-radius:10px;font-weight:600;font-size:13px;text-align:start;color:var(--text)}
.act svg{width:18px;height:18px;color:var(--text-2)}.act:hover{background:var(--surface-2)}.act.danger{color:var(--danger)}.act.danger svg{color:var(--danger)}.act.brand{color:var(--brand-ink)}.act.brand svg{color:var(--brand)}
.toasts{position:fixed;z-index:70;left:0;right:0;bottom:calc(var(--nav) + 12px + var(--sab));display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;padding:0 16px}
@media (min-width:1024px){.toasts{bottom:24px;align-items:flex-start;left:auto;right:auto;inset-inline-start:calc(var(--side) + 24px)}}
.toast{background:var(--text);color:var(--bg);padding:10px 16px;border-radius:12px;font-size:14px;font-weight:600;box-shadow:var(--shadow-2);animation:up .2s;display:flex;gap:8px;align-items:center;max-width:420px;pointer-events:auto}
.toast.ok{background:var(--ok);color:#fff}.toast.bad{background:var(--danger);color:#fff}
/* ---- skeleton, empty ---- */
.skel{background:linear-gradient(90deg,var(--surface-3) 25%,var(--surface-2) 50%,var(--surface-3) 75%);background-size:200% 100%;animation:sh 1.2s infinite;border-radius:8px;height:14px}
@keyframes sh{to{background-position:-200% 0}}.skel.t{width:60%}.skel.v{height:28px;width:40%;margin-top:6px}.skel.row{height:52px;border-radius:12px}
.empty{text-align:center;padding:40px 16px;color:var(--text-2)}.empty .ico{width:56px;height:56px;border-radius:16px;background:var(--surface-3);display:grid;place-items:center;margin:0 auto 12px;color:var(--text-3)}.empty .ico svg{width:26px;height:26px}
.empty h3{color:var(--text);font-size:15px;margin-bottom:4px}.empty p{margin:0 0 14px;font-size:13px}
/* ---- codes result, print ---- */
.codes-out{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.codes-out .c{font-family:var(--mono);direction:ltr;font-size:15px;font-weight:600;padding:10px;background:var(--surface-2);border:1px dashed var(--border-2);border-radius:8px;text-align:center;letter-spacing:.5px}
.savebar{position:fixed;left:0;right:0;bottom:calc(var(--nav) + var(--sab));z-index:35;background:var(--surface);border-top:1px solid var(--border);padding:10px 16px;display:flex;align-items:center;gap:8px;justify-content:space-between;box-shadow:0 -6px 20px rgba(0,0,0,.08);animation:up .2s}
@media (min-width:1024px){.savebar{bottom:0;inset-inline-start:var(--side);inset-inline-end:0;left:auto;right:auto}}
.mono::placeholder,.in.mono::placeholder{font-family:var(--font);letter-spacing:0}
.copybox{display:flex;gap:6px;align-items:center;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:6px 6px 6px 10px}.copybox code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:12px var(--mono);direction:ltr;text-align:left}
pre.cmd{font:12px/1.6 var(--mono);direction:ltr;text-align:left;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px;margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.print-only{display:none}
@media print{body{background:#fff;color:#000}#app,#login,.toasts,.sheet-bg,#tip,.savebar{display:none!important}.print-only{display:block!important}
  .pcards{display:grid;grid-template-columns:repeat(2,1fr);gap:10mm}.pcard{break-inside:avoid;border:1px solid #999;border-radius:4mm;padding:6mm;text-align:center}
  .pcard .b1{font-size:11pt;color:#444}.pcard .code{font:bold 18pt var(--mono);direction:ltr;letter-spacing:1px;margin:3mm 0;white-space:nowrap}.pcard .b2{font-size:9pt;color:#333;line-height:1.6}}
`

export const ADMIN_CSS = CSS
