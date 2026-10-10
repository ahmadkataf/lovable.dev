// The public page at / (kaseb.raqeem.dev): what Kaseb is, the download buttons and the price. Served by index.ts
// after `renderLanding()` fills the {{WHATSAPP}}, {{WA_LINK}}, {{PRICE}} and {{CLOUD_PRICE}} tokens from the seller's settings.
// Self-contained HTML (inline CSS/JS, Google Fonts stylesheet only); images and the APK live in ../public (Workers static assets).
// Arabic (RTL) is the default; the small "EN" switch swaps every element that carries a data-en attribute, with no reload.
// Keep it String.raw with no backticks and no "${" inside, and under 180 KB.
export const LANDING_PAGE = String.raw`<!doctype html>
<html lang="ar" dir="rtl" data-lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title data-en="Kaseb — the point of sale that understands your shop">كاسب — برنامج الكاشير الذي يفهم محلّك</title>
<meta name="description" content="كاسب: برنامج نقطة بيع عربي يعمل بلا إنترنت على أندرويد وويندوز. باركود، فواتير حرارية وضريبية، ديون العملاء، مخزون، ورديات وتقارير بالليرة والدولار. ترخيص دائم بدفعة واحدة.">
<meta name="theme-color" content="#0e9f6e">
<meta property="og:type" content="website">
<meta property="og:title" content="كاسب — برنامج الكاشير الذي يفهم محلّك">
<meta property="og:description" content="نقطة بيع عربية تعمل بلا إنترنت على أندرويد وويندوز. ترخيص دائم بدفعة واحدة، تجربة 7 أيام.">
<meta property="og:image" content="https://kaseb.raqeem.dev/img/desktop-sales.png">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@300..800&display=swap" rel="stylesheet">
<style>
:root{--g:#0e9f6e;--g2:#0b8a5f;--gd:#0b7a55;--gl:#19c08a;--gs:#e1f6ed;--t:#0f172a;--t2:#4b5a73;--t3:#8a97ad;--line:#e3e8f0;--bg:#f3f5f9;--card:#fff;--r:14px;--r2:20px;--r3:28px;--sh:0 1px 2px rgba(15,23,42,.04),0 10px 30px -16px rgba(15,23,42,.16);--shg:0 30px 60px -24px rgba(14,159,110,.45)}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%;scroll-padding-top:84px}
body{margin:0;font-family:Alexandria,"Segoe UI",system-ui,sans-serif;background:var(--bg);color:var(--t);line-height:1.75;font-size:16px;overflow-x:hidden;-webkit-font-smoothing:antialiased}
img,svg{display:block;max-width:100%}
img{height:auto}
a{color:inherit;text-decoration:none}
h1,h2,h3,p{margin:0}
ul{margin:0;padding:0;list-style:none}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
:focus-visible{outline:3px solid #19c08a;outline-offset:3px;border-radius:8px}
.wrap{width:min(1180px,100% - 32px);margin-inline:auto}
.i{width:1.25em;height:1.25em;flex:none}
.rv{opacity:0;transform:translateY(22px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
.rv.on{opacity:1;transform:none}
.rv.d1{transition-delay:.08s}.rv.d2{transition-delay:.16s}.rv.d3{transition-delay:.24s}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.rv{opacity:1;transform:none;transition:none}*{transition-duration:.01ms!important;animation:none!important}}

/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 24px;border-radius:var(--r);font-weight:700;font-size:16px;line-height:1;transition:transform .2s,box-shadow .2s,background .2s,border-color .2s;white-space:nowrap}
.btn:hover{transform:translateY(-2px)}
.btn:active{transform:translateY(0)}
.btn-p{background:var(--g);color:#fff;box-shadow:0 10px 24px -10px rgba(14,159,110,.6)}
.btn-p:hover{background:var(--g2);box-shadow:0 16px 32px -12px rgba(14,159,110,.65)}
.btn-d{background:var(--t);color:#fff;box-shadow:0 10px 24px -12px rgba(15,23,42,.5)}
.btn-d:hover{background:#1e293b}
.btn-o{background:var(--card);color:var(--t);border:1.5px solid var(--line);box-shadow:var(--sh)}
.btn-o:hover{border-color:#cbd3df}
.btn-w{background:#25d366;color:#0b3d22}
.btn-w:hover{background:#1fc45a}
.btn-s{min-height:42px;padding:0 16px;font-size:14px}
.btn .i{width:20px;height:20px}

/* header */
.hd{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.84);backdrop-filter:saturate(1.4) blur(14px);-webkit-backdrop-filter:saturate(1.4) blur(14px);border-bottom:1px solid transparent;transition:border-color .25s,box-shadow .25s}
.hd.s{border-color:var(--line);box-shadow:0 8px 30px -18px rgba(15,23,42,.25)}
.hd .in{display:flex;align-items:center;gap:18px;height:70px}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:22px;letter-spacing:-.01em}
.brand img{width:38px;height:38px;border-radius:11px;box-shadow:0 6px 14px -6px rgba(11,122,85,.55)}
.brand small{font-size:12px;color:var(--t3);font-weight:600;margin-inline-start:2px;align-self:flex-end;margin-bottom:5px}
.nav{display:flex;gap:4px;margin-inline-start:auto}
.nav a{padding:8px 14px;border-radius:10px;font-weight:600;font-size:15px;color:var(--t2);transition:background .2s,color .2s}
.nav a:hover{background:var(--gs);color:var(--gd)}
.hd .acts{display:flex;align-items:center;gap:10px;margin-inline-start:auto}
.nav+.acts{margin-inline-start:0}
.lang{min-height:38px;padding:0 12px;border-radius:10px;border:1.5px solid var(--line);background:#fff;font-weight:700;font-size:13px;letter-spacing:.04em;color:var(--t2);transition:border-color .2s,color .2s}
.lang:hover{border-color:var(--g);color:var(--gd)}
.menu{position:relative;display:none}
.menu summary{list-style:none;display:grid;place-items:center;width:42px;height:42px;border-radius:10px;border:1.5px solid var(--line);background:#fff;cursor:pointer}
.menu summary::-webkit-details-marker{display:none}
.menu nav{position:absolute;inset-inline-end:0;top:50px;width:220px;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 24px 50px -20px rgba(15,23,42,.3);padding:8px;display:grid;gap:2px;z-index:60}
.menu nav a{padding:10px 14px;border-radius:10px;font-weight:600;color:var(--t2)}
.menu nav a:hover{background:var(--gs);color:var(--gd)}
@media(max-width:900px){.nav{display:none}.menu{display:block}.hd .acts{margin-inline-start:auto}.hd .cta-top{display:none}}

/* hero */
.hero{position:relative;padding-block:56px 40px;overflow:hidden;isolation:isolate}
.hero::before{content:"";position:absolute;inset:auto -10% -30% -10%;height:70%;background:radial-gradient(60% 60% at 50% 100%,rgba(25,192,138,.18),transparent 70%);z-index:-1;pointer-events:none}
.hero .in{display:grid;grid-template-columns:1.15fr .85fr;gap:48px;align-items:center}
.pill{display:inline-flex;align-items:center;gap:8px;padding:6px 14px 6px 8px;border-radius:999px;background:#fff;border:1px solid var(--line);box-shadow:var(--sh);font-size:13px;font-weight:600;color:var(--t2);margin-bottom:22px;max-width:100%;line-height:1.45}
.pill b{flex:none}
.pill b{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;background:var(--gs);color:var(--gd);font-size:12px}
.pill b::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--g);box-shadow:0 0 0 3px rgba(14,159,110,.25)}
.h1{font-size:clamp(34px,5.2vw,60px);line-height:1.22;font-weight:800;letter-spacing:-.015em;margin-bottom:18px;text-wrap:balance}
.h1 em{font-style:normal;background:linear-gradient(90deg,var(--gl),var(--gd));-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{font-size:clamp(16px,1.6vw,19px);color:var(--t2);max-width:560px;margin-bottom:30px;font-weight:400}
.dl{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:22px}
.dl .btn{min-height:56px;padding-inline:26px}
.dl .btn .i{width:22px;height:22px}
.btn-v{background:#fff;color:var(--t);border:1.5px solid var(--line);box-shadow:var(--sh)}.btn-v:hover{border-color:#cbd3df}.btn-v .i{color:var(--g)}
.vd{border:0;padding:0;background:#0b1220;border-radius:18px;width:min(960px,94vw);max-width:none;box-shadow:0 40px 100px rgba(2,6,23,.6)}.vd::backdrop{background:rgba(2,6,23,.78);backdrop-filter:blur(4px)}
.vd video{display:block;width:100%;aspect-ratio:16/9;border-radius:18px;background:#0b1220}
.vd .x{position:absolute;top:10px;inset-inline-end:10px;z-index:2;width:40px;height:40px;border-radius:12px;background:rgba(2,6,23,.6);color:#fff;font-size:20px;font-weight:700;display:grid;place-items:center;border:1px solid rgba(255,255,255,.18)}
.vd .x:hover{background:rgba(2,6,23,.85)}
.trust{display:flex;flex-wrap:wrap;gap:8px 20px;color:var(--t2);font-size:14px;font-weight:500}
.trust li{display:flex;align-items:center;gap:7px}
.trust .i{color:var(--g);width:18px;height:18px}
.stage{position:relative;display:grid;place-items:center;min-height:620px}
.glow{position:absolute;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(25,192,138,.35),rgba(25,192,138,0) 70%);filter:blur(10px);pointer-events:none}
.ring{position:absolute;width:520px;height:520px;border-radius:50%;border:1px dashed rgba(14,159,110,.25);animation:spin 60s linear infinite;pointer-events:none}
@keyframes spin{to{transform:rotate(360deg)}}
.ph{position:relative;width:292px;aspect-ratio:390/844;border-radius:46px;background:#0f172a;padding:10px;box-shadow:var(--shg),0 0 0 1px #334155 inset,0 0 0 6px rgba(15,23,42,.06);animation:float 7s ease-in-out infinite}
.ph::before{content:"";position:absolute;top:14px;left:50%;transform:translateX(-50%);width:88px;height:24px;border-radius:14px;background:#0f172a;z-index:2}
.ph::after{content:"";position:absolute;inset-inline-end:-3px;top:120px;width:3px;height:70px;border-radius:2px;background:#1e293b}
.ph img{width:100%;height:100%;object-fit:cover;border-radius:36px;background:#f3f5f9}
@keyframes float{50%{transform:translateY(-10px)}}
.fl{position:absolute;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:16px;background:#fff;border:1px solid var(--line);box-shadow:0 20px 40px -18px rgba(15,23,42,.3);font-size:13px;font-weight:700;white-space:nowrap;z-index:3;animation:float 8s ease-in-out infinite}
.fl small{display:block;font-size:11px;font-weight:500;color:var(--t2)}
.fl .ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--gs);color:var(--gd)}
.fl .ic .i{width:18px;height:18px}
.f1{inset-inline-start:-16px;top:120px;animation-delay:-2s}
.f2{inset-inline-end:-24px;top:300px;animation-delay:-4s}
.f3{inset-inline-start:-8px;bottom:110px;animation-delay:-6s}
@media(max-width:900px){.hero{padding-block:36px 24px}.hero .in{grid-template-columns:1fr;gap:36px}.lead{max-width:none}.stage{min-height:0;padding-block:16px}.ph{width:min(272px,78vw)}.glow{width:300px;height:300px}.ring{width:380px;height:380px}.f1,.f2,.f3{display:none}.dl .btn{flex:1 1 180px}}
@media(max-width:600px){.trust{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}}
@media(max-width:380px){.dl .btn{padding-inline:16px}}

/* sections */
section{padding-block:72px}
@media(max-width:900px){section{padding-block:52px}}
.sh{max-width:720px;margin:0 auto 44px;text-align:center}
.sh .kick{display:inline-block;color:var(--gd);background:var(--gs);padding:4px 12px;border-radius:999px;font-size:13px;font-weight:700;margin-bottom:14px}
.h2{font-size:clamp(26px,3.4vw,40px);line-height:1.3;font-weight:800;letter-spacing:-.015em;text-wrap:balance}
.sh p{color:var(--t2);margin-top:12px;font-size:clamp(15px,1.4vw,18px);text-wrap:pretty}
@media(max-width:900px){.sh{margin-bottom:30px}}

/* market band */
.mk{border-radius:var(--r3);background:linear-gradient(135deg,#0b7a55 0%,#0e9f6e 55%,#19c08a 100%);color:#fff;padding:44px;display:grid;grid-template-columns:1.3fr repeat(4,1fr);gap:28px;align-items:start;position:relative;overflow:hidden;box-shadow:0 30px 60px -30px rgba(11,122,85,.6)}
.mk .lead-cell{align-self:center}
.mk::before{content:"";position:absolute;inset:-40% -20% auto auto;width:60%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.18),transparent 65%);pointer-events:none}
.mk h2{font-size:clamp(22px,2.4vw,30px);font-weight:800;line-height:1.3;margin-bottom:8px}
.mk .lead2{font-size:14px;opacity:.9}
.mk .it .ic{width:46px;height:46px;border-radius:14px;background:rgba(255,255,255,.16);display:grid;place-items:center;margin-bottom:12px;box-shadow:0 0 0 1px rgba(255,255,255,.18) inset}
.mk .it .ic .i{width:24px;height:24px}
.mk .it h3{font-size:16px;font-weight:700;margin-bottom:4px}
.mk .it p{font-size:13.5px;opacity:.9;line-height:1.65}
@media(max-width:1000px){.mk{grid-template-columns:1fr 1fr;padding:32px;gap:26px}.mk>.lead-cell{grid-column:1/-1;margin-bottom:4px}}
@media(max-width:560px){.mk{grid-template-columns:1fr;padding:26px 20px;border-radius:22px;gap:18px}.mk .it{display:grid;grid-template-columns:44px minmax(0,1fr);grid-template-rows:auto auto;column-gap:14px;row-gap:2px;align-items:start}.mk .it .ic{grid-row:1/3;width:44px;height:44px;margin:0;border-radius:12px}.mk .it h3,.mk .it p{grid-column:2}.mk .it .ic .i{width:22px;height:22px}.mk .it h3{font-size:15.5px;margin:0;line-height:1.4;align-self:center}.mk .it p{font-size:13px}.mk>.lead-cell{margin-bottom:8px}}

/* feature grid */
.fg{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.fc{background:var(--card);border:1px solid var(--line);border-radius:var(--r2);padding:26px;box-shadow:var(--sh);transition:transform .25s,box-shadow .25s,border-color .25s;position:relative;overflow:hidden}
.fc::after{content:"";position:absolute;inset-inline-start:0;top:0;width:0;height:3px;background:linear-gradient(90deg,var(--gl),var(--gd));transition:width .35s}
.fc:hover{transform:translateY(-4px);box-shadow:0 24px 44px -24px rgba(15,23,42,.25);border-color:#cfe9dd}
.fc:hover::after{width:100%}
.fc .ic{width:50px;height:50px;border-radius:14px;background:var(--gs);color:var(--gd);display:grid;place-items:center;margin-bottom:16px}
.fc .ic .i{width:26px;height:26px}
.fc h3{font-size:18px;font-weight:700;margin-bottom:8px}
.fc p{color:var(--t2);font-size:14.5px;line-height:1.7}
.fc .tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.fc .tags span{font-size:12px;font-weight:600;color:var(--t2);background:var(--bg);border:1px solid var(--line);padding:3px 9px;border-radius:999px}
@media(max-width:1000px){.fg{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.fg{grid-template-columns:1fr;gap:14px}.fc{padding:22px}}

/* gallery */
.gal{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.shot{background:var(--card);border:1px solid var(--line);border-radius:var(--r2);overflow:hidden;box-shadow:var(--sh);transition:transform .25s,box-shadow .25s}
.shot:hover{transform:translateY(-4px);box-shadow:0 26px 48px -26px rgba(15,23,42,.3)}
.shot .im{position:relative;background:#eef1f6;border-bottom:1px solid var(--line)}
.shot .im::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 70%,rgba(15,23,42,.06));pointer-events:none}
.shot img{width:100%;aspect-ratio:2048/1199;object-fit:cover;object-position:top}
.shot figcaption{padding:14px 18px;display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px}
.shot figcaption .i{color:var(--g);width:20px;height:20px}
.shot figcaption small{font-weight:500;color:var(--t2);font-size:13px;margin-inline-start:auto}
.gp{display:grid;grid-template-columns:repeat(6,1fr);gap:16px;margin-top:22px}
.gp figure{margin:0;text-align:center}
.gp .pf{border-radius:26px;background:#0f172a;padding:6px;box-shadow:var(--sh);transition:transform .25s}
.gp figure:hover .pf{transform:translateY(-4px)}
.gp img{width:100%;aspect-ratio:390/844;object-fit:cover;border-radius:21px;background:#f3f5f9}
.gp figcaption{font-size:13px;font-weight:600;color:var(--t2);margin-top:10px}
.gh{display:flex;align-items:center;gap:10px;font-weight:700;margin:40px 0 0;font-size:15px;color:var(--t2)}
.gh .i{color:var(--g);width:20px;height:20px}
@media(max-width:900px){
.gal,.gp{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:14px;margin-inline:calc(-1 * max(16px,(100vw - 1180px)/2));padding-inline:max(16px,(100vw - 1180px)/2);padding-block-end:10px;scrollbar-width:none}
.gal::-webkit-scrollbar,.gp::-webkit-scrollbar{display:none}
.gal>*{flex:0 0 min(86%,440px);scroll-snap-align:center}
.gp>*{flex:0 0 min(46%,200px);scroll-snap-align:center}
.shot figcaption small{display:none}
}

/* steps */
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;position:relative;counter-reset:st}
.st{background:var(--card);border:1px solid var(--line);border-radius:var(--r2);padding:28px;box-shadow:var(--sh);position:relative;counter-increment:st}
.st .n{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--gl),var(--gd));color:#fff;display:grid;place-items:center;font-weight:800;font-size:18px;margin-bottom:18px;box-shadow:0 10px 20px -10px rgba(14,159,110,.7)}
.st .n::before{content:counter(st)}
.st h3{font-size:18px;font-weight:700;margin-bottom:8px}
.st p{color:var(--t2);font-size:14.5px}
.st .i{position:absolute;inset-inline-end:22px;top:26px;width:30px;height:30px;color:var(--t3)}
@media(max-width:800px){.steps{grid-template-columns:1fr}}

/* pricing */
.pr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;max-width:960px;margin:0 auto}
.pc{background:var(--card);border:1px solid var(--line);border-radius:var(--r3);padding:34px;box-shadow:var(--sh);display:flex;flex-direction:column;position:relative}
.pc.hi{border:2px solid var(--g);box-shadow:0 30px 60px -30px rgba(14,159,110,.5)}
.pc .badge{position:absolute;top:-14px;inset-inline-start:28px;background:var(--g);color:#fff;font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;box-shadow:0 8px 16px -8px rgba(14,159,110,.8)}
.pc h3{font-size:20px;font-weight:800;margin-bottom:4px}
.pc .sub{color:var(--t2);font-size:14px;margin-bottom:18px}
.pc .price{display:flex;align-items:baseline;gap:10px;margin-bottom:6px}
.pc .price b{font-size:52px;font-weight:800;letter-spacing:-.03em;line-height:1;color:var(--t);direction:ltr;unicode-bidi:isolate}
.pc .price span{color:var(--t2);font-weight:600;font-size:15px}
.pc .note{font-size:13px;color:var(--t2);margin-bottom:22px;padding-bottom:22px;border-bottom:1px dashed var(--line)}
.pc ul{display:grid;gap:11px;margin-bottom:26px;flex:1}
.pc li{display:flex;gap:10px;align-items:flex-start;font-size:14.5px;color:var(--t)}
.pc li .i{color:var(--g);width:20px;height:20px;margin-top:3px}
.pc .btn{width:100%}
.pnote{text-align:center;color:var(--t2);font-size:14px;margin-top:22px}
@media(max-width:760px){.pr{grid-template-columns:1fr}.pc{padding:26px;border-radius:22px}.pc .price b{font-size:44px}}

/* comparison */
.cmp{overflow-x:auto;border-radius:var(--r2);border:1px solid var(--line);background:#fff;box-shadow:var(--sh)}
.cmp table{width:100%;border-collapse:collapse;min-width:520px;font-size:14.5px}
.cmp th,.cmp td{padding:14px 16px;text-align:start;border-bottom:1px solid var(--line)}
.cmp tr:last-child td{border-bottom:0}
.cmp th{font-weight:700;font-size:13px;color:var(--t2);background:var(--bg)}
.cmp th.k,.cmp td.k{background:var(--gs);color:var(--gd);font-weight:800}
.cmp td:not(:first-child){text-align:center;width:17%}
.cmp .ok,.cmp .no,.cmp .half{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%}
.cmp .ok{background:var(--g);color:#fff}
.cmp .no{background:#fde8e8;color:#c0392b}
.cmp .half{background:#fff4d6;color:#8a5a00;font-size:11px;font-weight:800;width:auto;padding:0 10px;border-radius:999px}
.cmp .ok .i,.cmp .no .i{width:15px;height:15px}
.cmp .half{white-space:nowrap}
@media(max-width:600px){.cmp table{min-width:0;font-size:13px}.cmp th,.cmp td{padding:11px 8px}.cmp td:not(:first-child),.cmp th:not(:first-child){width:58px;padding-inline:4px}.cmp .half{font-size:10px;padding:0 7px}.cmp .ok,.cmp .no{width:24px;height:24px}}

/* faq */
.faq{max-width:820px;margin:0 auto;display:grid;gap:12px}
.faq details{background:var(--card);border:1px solid var(--line);border-radius:var(--r2);box-shadow:var(--sh);transition:border-color .2s}
.faq details[open]{border-color:#bfe6d4}
.faq summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:14px;padding:18px 22px;font-weight:700;font-size:16px}
.faq summary::-webkit-details-marker{display:none}
.faq summary .pm{margin-inline-start:auto;width:30px;height:30px;border-radius:50%;background:var(--gs);color:var(--gd);display:grid;place-items:center;flex:none;transition:transform .3s,background .2s}
.faq details[open] summary .pm{transform:rotate(45deg);background:var(--g);color:#fff}
.faq .pm .i{width:16px;height:16px}
.faq .a{padding:0 22px 20px;color:var(--t2);font-size:15px;line-height:1.8}

/* cta band */
.cta{border-radius:var(--r3);background:#0f172a;color:#fff;padding:56px 40px;text-align:center;position:relative;overflow:hidden}
.cta::before{content:"";position:absolute;inset:-60% -20% auto -20%;height:140%;background:radial-gradient(50% 50% at 50% 50%,rgba(25,192,138,.35),transparent 70%);pointer-events:none}
.cta>*{position:relative}
.cta h2{font-size:clamp(26px,3.4vw,40px);font-weight:800;line-height:1.3;margin-bottom:10px}
.cta p{color:#cbd5e1;max-width:620px;margin:0 auto 28px;font-size:clamp(15px,1.4vw,18px)}
.cta .row{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
.cta .num{display:inline-flex;align-items:center;gap:8px;color:#cbd5e1;font-size:14px;margin:18px 0 0}
.cta .num b{color:#fff;letter-spacing:.04em;font-weight:700;direction:ltr;unicode-bidi:isolate}
@media(max-width:600px){.cta{padding:40px 22px;border-radius:22px}.cta .row .btn{flex:1 1 100%}}

/* footer */
footer{padding:40px 0 32px;color:var(--t2);font-size:14px}
footer .top{display:flex;flex-wrap:wrap;align-items:center;gap:16px 28px;padding-bottom:24px;border-bottom:1px solid var(--line)}
footer .links{display:flex;flex-wrap:wrap;gap:6px 22px;margin-inline-start:auto}
footer .links a{font-weight:600;color:var(--t2);transition:color .2s}
footer .links a:hover{color:var(--gd)}
footer .links a.dim{font-weight:500;color:var(--t3);font-size:13px}
footer .bot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px 24px;padding-top:18px;font-size:13px}
footer .rule{color:#6b7a93}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* video tutorials */
.tut{display:grid;grid-template-columns:minmax(0,1fr) 370px;gap:22px;align-items:start}
.tv{background:var(--card);border:1px solid var(--line);border-radius:var(--r3);overflow:hidden;box-shadow:var(--sh)}
.tvp{position:relative;background:#0b1220;aspect-ratio:16/9}
.tvp video{position:absolute;inset:0;width:100%;height:100%;display:block;background:#0b1220;object-fit:contain}
.tvb{padding:18px 22px 22px}
.tvk{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:13px;font-weight:700;color:var(--t3)}
.tvk .n{color:var(--gd);background:var(--gs);padding:3px 10px;border-radius:999px}
.tvk #tut-d{direction:ltr;unicode-bidi:isolate}
.tvb h3{font-size:clamp(20px,2.2vw,24px);line-height:1.35;margin:10px 0 6px;font-weight:800}
.tvb p{color:var(--t2);font-size:15px;margin:0 0 14px;line-height:1.7}
.tch{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.tch button{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;border:1.5px solid var(--line);background:#fff;font:inherit;font-size:13.5px;font-weight:600;color:var(--t);cursor:pointer;transition:border-color .15s,background .15s;line-height:1.5}
.tch button:hover{border-color:var(--g);background:#f6fbf9}
.tch button b{color:var(--gd);font-weight:800;direction:ltr;unicode-bidi:isolate}
.tna{display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between}
.tna .btn:disabled{opacity:.45;cursor:default;transform:none}
.tl{background:var(--card);border:1px solid var(--line);border-radius:var(--r3);box-shadow:var(--sh);overflow:hidden;display:flex;flex-direction:column;max-height:640px}
.tlh{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 18px;border-bottom:1px solid var(--line)}
.tlh b{font-size:17px}.tlh span{font-size:13px;color:var(--t3);font-weight:600}
.tl ol{list-style:none;margin:0;padding:8px;overflow:auto;display:grid;gap:4px;position:relative}
.tl button{display:flex;gap:12px;align-items:center;width:100%;padding:8px;border-radius:14px;text-align:start;border:0;background:none;font:inherit;color:inherit;cursor:pointer;transition:background .15s}
.tl button:hover{background:#f4f7fa}
.tl button[aria-current=true]{background:var(--gs);box-shadow:inset 0 0 0 1.5px var(--g)}
.tl .th{position:relative;flex:none;width:112px;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#0b1220}
.tl .th img{width:100%;height:100%;object-fit:cover}
.tl .th .ck{position:absolute;bottom:5px;left:5px;width:22px;height:22px;border-radius:50%;background:var(--g);color:#fff;display:none;place-items:center}
.tl button.seen .th .ck{display:grid}
.tl .tx{display:flex;flex-direction:column;gap:2px;min-width:0}
.tl .tx b{font-size:14.5px;line-height:1.45}
.tl .tx small{font-size:12.5px;color:var(--t3);font-weight:600;align-self:flex-start;direction:ltr;unicode-bidi:isolate}
.tl button[aria-current=true] .tx small{color:var(--gd)}
.tmore{text-align:center;margin-top:22px}
.tmore a{display:inline-flex;align-items:center;gap:8px;font-weight:700;color:var(--gd)}
.tmore a:hover{text-decoration:underline}
@media(max-width:980px){.tut{grid-template-columns:1fr}.tl{max-height:none}.tl ol{max-height:430px}}
@media(max-width:560px){.tvb{padding:16px}.tl .th{width:96px}}
</style>
</head>
<body>

<header class="hd" id="top">
  <div class="wrap in">
    <a class="brand" href="#top" aria-label="كاسب — الصفحة الرئيسية"><img src="/icon.svg" width="38" height="38" alt=""><span data-en="Kaseb">كاسب</span><small aria-hidden="true">POS</small></a>
    <nav class="nav" aria-label="الأقسام">
      <a href="#features" data-en="Features">المزايا</a>
      <a href="#gallery" data-en="Screens">الشاشات</a>
      <a href="#pricing" data-en="Pricing">الأسعار</a>
      <a href="#faq" data-en="FAQ">الأسئلة</a>
      <a href="#learn" data-en="Tutorials">الشرح</a>
      <a href="#download" data-en="Download">تحميل</a>
    </nav>
    <div class="acts">
      <button class="lang" id="lang" type="button" aria-label="Switch to English" title="English">EN</button>
      <a class="btn btn-p btn-s cta-top" href="#download"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg><span data-en="Download the app">تحميل التطبيق</span></a>
      <details class="menu">
        <summary aria-label="القائمة"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></summary>
        <nav aria-label="القائمة">
          <a href="#features" data-en="Features">المزايا</a>
          <a href="#gallery" data-en="Screens">الشاشات</a>
          <a href="#pricing" data-en="Pricing">الأسعار</a>
          <a href="#faq" data-en="FAQ">الأسئلة</a>
      <a href="#learn" data-en="Tutorials">الشرح</a>
          <a href="#download" data-en="Download">تحميل</a>
        </nav>
      </details>
    </div>
  </div>
</header>

<main>

<section class="hero" id="download" aria-labelledby="h1">
  <div class="wrap in">
    <div>
      <div class="pill rv on"><b data-en="New">جديد</b><span data-en="USD pricing with a daily exchange rate">تسعير بالدولار مع سعر صرف يومي</span></div>
      <h1 class="h1 rv on" id="h1" data-en="The cashier software that <em>understands your shop</em>">برنامج الكاشير الذي <em>يفهم محلّك</em></h1>
      <p class="lead rv on d1" data-en="Sales, barcode, receipts, customer debts, inventory, shifts and reports — in Arabic, on your phone or PC, and it keeps working when the internet does not. Pay once, own it for life.">بيع، باركود، فواتير، ديون العملاء، مخزون، ورديات وتقارير — بالعربية، على هاتفك أو حاسوبك، ويشتغل حتى لو انقطع الإنترنت. تدفع مرة واحدة ويبقى لك مدى الحياة.</p>
      <div class="dl rv on d2">
        <a class="btn btn-p" href="/download/android" rel="noopener"><svg class="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 11.5h-11a1 1 0 0 0-1 1V18a1 1 0 0 0 1 1h1v2.5a1.5 1.5 0 0 0 3 0V19h3v2.5a1.5 1.5 0 0 0 3 0V19h1a1 1 0 0 0 1-1v-5.5a1 1 0 0 0-1-1zM3.5 11.5A1.5 1.5 0 0 0 2 13v4a1.5 1.5 0 0 0 3 0v-4a1.5 1.5 0 0 0-1.5-1.5zm17 0A1.5 1.5 0 0 0 19 13v4a1.5 1.5 0 0 0 3 0v-4a1.5 1.5 0 0 0-1.5-1.5zM15.8 3.9l1.3-1.6-.6-.5-1.4 1.7A6.5 6.5 0 0 0 12 3a6.5 6.5 0 0 0-3.1.6L7.5 1.8l-.6.5 1.3 1.6A5.6 5.6 0 0 0 5.5 8v2.5h13V8a5.6 5.6 0 0 0-2.7-4.1zM9 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg><span data-en="Download for Android">تحميل لأندرويد</span></a>
        <a class="btn btn-d" href="/download/windows" rel="noopener"><svg class="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 5.5l7.5-1v7H3zM11.5 4.3L21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.3z"/></svg><span data-en="Download for Windows">تحميل لويندوز</span></a>
        <button class="btn btn-v" type="button" id="play-ad"><svg class="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg><span data-en="Watch the video (1 min)">شاهد الفيديو (دقيقة)</span></button>
      </div>
      <ul class="trust rv on d3" aria-label="مزايا سريعة">
        <li><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg><span data-en="Works offline">يعمل بلا إنترنت</span></li>
        <li><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg><span data-en="7-day free trial">تجربة مجانية 7 أيام</span></li>
        <li><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg><span data-en="Instant activation">تفعيل فوري</span></li>
        <li><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg><span data-en="No monthly fees">بلا رسوم شهرية</span></li>
      </ul>
    </div>
    <div class="stage rv on d2" aria-hidden="false">
      <div class="glow" aria-hidden="true"></div>
      <div class="ring" aria-hidden="true"></div>
      <div class="fl f1" aria-hidden="true"><span class="ic"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 6.5H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/></svg></span><span><bdi dir="ltr">1 $ = 13,000</bdi><small data-en="today's rate · prices follow it">سعر اليوم · الأسعار تتبعه</small></span></div>
      <div class="fl f2" aria-hidden="true"><span class="ic"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h16v18l-2.5-1.5L15 21l-2.5-1.5L10 21l-2.5-1.5L5 21z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span><span data-en="Receipt sent on WhatsApp<small>thermal · A4 with QR</small>">أُرسلت الفاتورة على واتساب<small>حرارية · A4 مع QR</small></span></div>
      <div class="fl f3" aria-hidden="true"><span class="ic"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/></svg></span><span data-en="Today's profit: $92.5<small>real profit in dollars</small>">ربح اليوم: 92.5 $<small>الربح الحقيقي بالدولار</small></span></div>
      <div class="ph"><img src="/img/phone-sales.png" width="390" height="844" alt="شاشة البيع في كاسب على الهاتف: شبكة منتجات بالصور، بحث بالباركود، والسلة" fetchpriority="high" decoding="async"></div>
    </div>
  </div>
</section>

<section aria-label="مصمم لسوقنا">
  <div class="wrap">
    <div class="mk rv">
      <div class="lead-cell">
        <h2 data-en="Built for our market, not translated for it">مبنيّ لسوقنا، لا مترجم عنه</h2>
        <p class="lead2" data-en="Everything that global POS systems forget about shops in Syria and the region comes as standard in Kaseb.">كل ما تنساه أنظمة نقاط البيع العالمية عن محلات سوريا والمنطقة، موجود في كاسب من الأساس.</p>
      </div>
      <div class="it rv d1">
        <div class="ic"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 6.5H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/></svg></div>
        <h3 data-en="Dollar pricing, daily rate">تسعير بالدولار وسعر صرف يومي</h3>
        <p data-en="Set the rate each morning; lira prices update in one tap and your real profit is always in dollars.">حدّث السعر كل صباح، فتتغير أسعار الليرة بضغطة واحدة ويبقى ربحك الحقيقي محسوباً بالدولار.</p>
      </div>
      <div class="it rv d2">
        <div class="ic"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="6"/><path d="M15 9.3a6 6 0 1 1-5.7 5.7"/></svg></div>
        <h3 data-en="Dual-currency cash">صندوق بعملتين</h3>
        <p data-en="Take lira and dollars in the same sale, with change and a shift reconciliation per currency.">اقبض ليرة ودولاراً في الفاتورة نفسها، مع الباقي وتسوية الوردية لكل عملة على حدة.</p>
      </div>
      <div class="it rv d3">
        <div class="ic"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h16v18l-2.5-1.5L15 21l-2.5-1.5L10 21l-2.5-1.5L5 21z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></div>
        <h3 data-en="Arabic receipts">فواتير عربية أنيقة</h3>
        <p data-en="Thermal 58/80 mm receipts, an A4 tax invoice with QR, and a copy on the customer's WhatsApp.">إيصال حراري 58/80 مم، فاتورة ضريبية A4 مع رمز QR، ونسخة على واتساب الزبون.</p>
      </div>
      <div class="it rv d3">
        <div class="ic"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4.3-2.6M12 8a14 14 0 0 1 10 4.5M2 12.5a14 14 0 0 1 2.4-2"/><circle cx="12" cy="20" r="1"/></svg></div>
        <h3 data-en="100% offline">يعمل 100% بلا إنترنت</h3>
        <p data-en="Power cut? Network down? Keep selling. Internet is needed only for activation checks.">انقطع النت أو الكهرباء؟ تابع البيع. الإنترنت مطلوب فقط للتحقق من التفعيل.</p>
      </div>
    </div>
  </div>
</section>

<section id="features" aria-labelledby="h-features">
  <div class="wrap">
    <div class="sh rv">
      <span class="kick" data-en="Features">المزايا</span>
      <h2 class="h2" id="h-features" data-en="Everything a shop needs, in one app">كل ما يحتاجه المحل، في تطبيق واحد</h2>
      <p data-en="For grocery stores, pharmacies, bookshops, clothing stores and spare-parts shops. Fast on a phone, powerful on a PC.">للبقالة والصيدلية والمكتبة ومحل الألبسة وقطع الغيار. سريع على الهاتف وقوي على الحاسوب.</p>
    </div>
    <div class="fg">
      <article class="fc rv">
        <div class="ic"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5V3h2M19 3h2v2M21 19v2h-2M5 21H3v-2M7 8v8M11 8v8M15 8v8M17 8v8"/></svg></div>
        <h3 data-en="Fast selling screen">شاشة بيع سريعة</h3>
        <p data-en="Scan with the phone camera or a USB scanner, favourites, held tickets, discounts and tax in two taps.">امسح بكاميرا الهاتف أو قارئ USB، منتجات مفضلة، فواتير معلّقة، خصم وضريبة بضغطتين.</p>
        <div class="tags"><span data-en="Barcode">باركود</span><span data-en="Held tickets">تعليق الفاتورة</span><span data-en="Discounts">خصومات</span></div>
      </article>
      <article class="fc rv d1">
        <div class="ic"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 8-9-5-9 5 9 5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg></div>
        <h3 data-en="Products, packs and wholesale">منتجات وعبوات وجملة</h3>
        <p data-en="Carton and box packs, a wholesale price tier, scale barcodes, expiry dates, labels and CSV import.">كرتونة وعلبة، سعر جملة، باركود الميزان، تواريخ الانتهاء، ملصقات، واستيراد من CSV.</p>
        <div class="tags"><span data-en="Packs">عبوات</span><span data-en="Expiry">صلاحية</span><span data-en="Labels">ملصقات</span></div>
      </article>
      <article class="fc rv d2">
        <div class="ic"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h16v18l-2.5-1.5L15 21l-2.5-1.5L10 21l-2.5-1.5L5 21z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></div>
        <h3 data-en="Receipts and invoices">فواتير وإيصالات</h3>
        <p data-en="Thermal receipt, A4 tax invoice with QR, and a WhatsApp copy to the customer in one tap.">إيصال حراري، فاتورة ضريبية A4 مع QR، ونسخة إلى واتساب الزبون بضغطة.</p>
        <div class="tags"><span data-en="Thermal">حرارية</span><span>A4 + QR</span><span data-en="WhatsApp">واتساب</span></div>
      </article>
      <article class="fc rv">
        <div class="ic"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4a3.5 3.5 0 0 1 0 7M18.5 14.5a6.5 6.5 0 0 1 3 5.5"/></svg></div>
        <h3 data-en="Customers and debts">العملاء والديون</h3>
        <p data-en="Sell on account, record payments, print a statement, and reward loyal customers with points.">بيع على الحساب، سجّل الدفعات، اطبع كشف حساب، وكافئ الزبائن الدائمين بنقاط ولاء.</p>
        <div class="tags"><span data-en="Statement">كشف حساب</span><span data-en="Loyalty points">نقاط ولاء</span></div>
      </article>
      <article class="fc rv d1">
        <div class="ic"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l9-6 9 6v12"/><path d="M3 21h18M8 21v-6h8v6M8 12h8"/></svg></div>
        <h3 data-en="Inventory that warns you">مخزون ينبّهك</h3>
        <p data-en="Purchases, suppliers, stock-take, and reorder suggestions before a product runs out.">مشتريات، موردون، جرد، واقتراحات إعادة الطلب قبل أن ينفد الصنف.</p>
        <div class="tags"><span data-en="Purchases">مشتريات</span><span data-en="Stock-take">جرد</span><span data-en="Reorder">إعادة طلب</span></div>
      </article>
      <article class="fc rv d2">
        <div class="ic"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>
        <h3 data-en="Shifts and expenses">ورديات ومصاريف</h3>
        <p data-en="Open a shift, count the drawer at close, see the difference per currency, and log daily expenses.">افتح وردية، عدّ الصندوق عند الإغلاق، شاهد الفرق لكل عملة، وسجّل مصاريف اليوم.</p>
        <div class="tags"><span data-en="Cash reconciliation">تسوية الصندوق</span><span data-en="Expenses">مصاريف</span></div>
      </article>
      <article class="fc rv">
        <div class="ic"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15v-4M12 15V8M17 15v-6"/></svg></div>
        <h3 data-en="Reports in lira and dollars">تقارير بالليرة والدولار</h3>
        <p data-en="Sales, real profit, top products and cashier performance — by day, week or month, with a comparison.">المبيعات، الربح الحقيقي، الأصناف الأكثر مبيعاً وأداء الكاشيرين — باليوم والأسبوع والشهر مع مقارنة.</p>
        <div class="tags"><span data-en="Profit">ربح</span><span data-en="Top products">الأكثر مبيعاً</span><span>CSV</span></div>
      </article>
      <article class="fc rv d1">
        <div class="ic"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/></svg></div>
        <h3 data-en="Cashiers and permissions">كاشيرون وصلاحيات</h3>
        <p data-en="A PIN for each cashier, fine-grained permissions, and an audit log of every change — who did what and when.">رمز PIN لكل كاشير، صلاحيات دقيقة، وسجل تدقيق لكل تغيير: من فعل ماذا ومتى.</p>
        <div class="tags"><span>PIN</span><span data-en="Permissions">صلاحيات</span><span data-en="Audit log">سجل تدقيق</span></div>
      </article>
      <article class="fc rv d2">
        <div class="ic"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.5 4 4 0 0 1 17.5 18z"/><path d="M12 12v7m0-7-3 3m3-3 3 3"/></svg></div>
        <h3 data-en="Backup and restore">نسخ احتياطي واستعادة</h3>
        <p data-en="Your data stays on your device. One-tap backup to a file, and an optional daily cloud backup.">بياناتك على جهازك. نسخة احتياطية بضغطة إلى ملف، ونسخة سحابية يومية اختيارية.</p>
        <div class="tags"><span data-en="Local file">ملف محلي</span><span data-en="Cloud">سحابة</span><span data-en="Dark mode">وضع داكن</span></div>
      </article>
    </div>
  </div>
</section>

<section id="gallery" aria-labelledby="h-gallery">
  <div class="wrap">
    <div class="sh rv">
      <span class="kick" data-en="Screens">الشاشات</span>
      <h2 class="h2" id="h-gallery" data-en="See Kaseb on your device">شاهد كاسب على جهازك</h2>
      <p data-en="Real screenshots, not mockups. One app on Android and Windows, one set of data.">لقطات حقيقية من التطبيق، لا تصاميم. تطبيق واحد على أندرويد وويندوز، وبيانات واحدة.</p>
    </div>
    <div class="gal">
      <figure class="shot rv"><div class="im"><img src="/img/desktop-sales.png" width="2048" height="1199" loading="lazy" decoding="async" alt="شاشة البيع على الحاسوب: شبكة منتجات، سلة، والدفع"></div><figcaption><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h3l2.6 11.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.5L22 7H6"/></svg><span data-en="Sales">البيع</span><small data-en="Windows">ويندوز</small></figcaption></figure>
      <figure class="shot rv d1"><div class="im"><img src="/img/desktop-products.png" width="2048" height="1199" loading="lazy" decoding="async" alt="قائمة المنتجات على الحاسوب مع السعر والتكلفة والكمية"></div><figcaption><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 8-9-5-9 5 9 5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg><span data-en="Products">المنتجات</span><small data-en="Windows">ويندوز</small></figcaption></figure>
      <figure class="shot rv d2"><div class="im"><img src="/img/desktop-reports.png" width="2048" height="1199" loading="lazy" decoding="async" alt="التقارير على الحاسوب: المبيعات والربح والمبيعات حسب الساعة"></div><figcaption><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15v-4M12 15V8M17 15v-6"/></svg><span data-en="Reports">التقارير</span><small data-en="Windows">ويندوز</small></figcaption></figure>
      <figure class="shot rv"><div class="im"><img src="/img/desktop-customers.png" width="2048" height="1199" loading="lazy" decoding="async" alt="العملاء على الحاسوب: إجمالي الديون وقائمة العملاء"></div><figcaption><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4a3.5 3.5 0 0 1 0 7M18.5 14.5a6.5 6.5 0 0 1 3 5.5"/></svg><span data-en="Customers">العملاء</span><small data-en="Windows">ويندوز</small></figcaption></figure>
      <figure class="shot rv d1"><div class="im"><img src="/img/desktop-inventory.png" width="2048" height="1199" loading="lazy" decoding="async" alt="المخزون على الحاسوب: الكميات والمشتريات والموردون"></div><figcaption><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l9-6 9 6v12"/><path d="M3 21h18M8 21v-6h8v6M8 12h8"/></svg><span data-en="Inventory">المخزون</span><small data-en="Windows">ويندوز</small></figcaption></figure>
      <figure class="shot rv d2"><div class="im"><img src="/img/desktop-settings.png" width="2048" height="1199" loading="lazy" decoding="async" alt="الإعدادات على الحاسوب: المتجر، العملة، الفاتورة والنسخ الاحتياطي"></div><figcaption><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg><span data-en="Settings">الإعدادات</span><small data-en="Windows">ويندوز</small></figcaption></figure>
    </div>
    <p class="gh rv"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg><span data-en="The same app on Android — the whole shop in your pocket">التطبيق نفسه على أندرويد — المحل كله في جيبك</span></p>
    <div class="gp">
      <figure class="rv"><div class="pf"><img src="/img/phone-sales.png" width="390" height="844" loading="lazy" decoding="async" alt="شاشة البيع على الهاتف"></div><figcaption data-en="Sales">البيع</figcaption></figure>
      <figure class="rv d1"><div class="pf"><img src="/img/phone-products.png" width="390" height="844" loading="lazy" decoding="async" alt="المنتجات على الهاتف"></div><figcaption data-en="Products">المنتجات</figcaption></figure>
      <figure class="rv d2"><div class="pf"><img src="/img/phone-customers.png" width="390" height="844" loading="lazy" decoding="async" alt="العملاء والديون على الهاتف"></div><figcaption data-en="Customers">العملاء</figcaption></figure>
      <figure class="rv"><div class="pf"><img src="/img/phone-inventory.png" width="390" height="844" loading="lazy" decoding="async" alt="المخزون على الهاتف"></div><figcaption data-en="Inventory">المخزون</figcaption></figure>
      <figure class="rv d1"><div class="pf"><img src="/img/phone-reports.png" width="390" height="844" loading="lazy" decoding="async" alt="التقارير على الهاتف"></div><figcaption data-en="Reports">التقارير</figcaption></figure>
      <figure class="rv d2"><div class="pf"><img src="/img/phone-settings.png" width="390" height="844" loading="lazy" decoding="async" alt="الإعدادات على الهاتف"></div><figcaption data-en="Settings">الإعدادات</figcaption></figure>
    </div>
  </div>
</section>

<section id="how" aria-labelledby="h-how">
  <div class="wrap">
    <div class="sh rv">
      <span class="kick" data-en="How it works">كيف يعمل</span>
      <h2 class="h2" id="h-how" data-en="Up and running in three steps">تبدأ البيع في ثلاث خطوات</h2>
      <p data-en="No account, no card, no setup visit. Download, try for a week, then activate with a code.">بلا حساب ولا بطاقة ولا زيارة تركيب. حمّل، جرّب أسبوعاً، ثم فعّل بكود.</p>
    </div>
    <div class="steps">
      <div class="st rv">
        <div class="n" aria-hidden="true"></div>
        <svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
        <h3 data-en="Download">حمّل التطبيق</h3>
        <p data-en="Android APK or the Windows installer. Install it and add your first products — or import them from a CSV file.">ملف APK لأندرويد أو المثبّت لويندوز. ثبّته وأضف أول منتجاتك، أو استوردها من ملف CSV.</p>
      </div>
      <div class="st rv d1">
        <div class="n" aria-hidden="true"></div>
        <svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>
        <h3 data-en="Try it free for 7 days">جرّب 7 أيام مجاناً</h3>
        <p data-en="Every feature is open during the trial. Sell for real, print receipts, and see your profit at the end of the day.">كل المزايا مفتوحة خلال التجربة. بِع فعلياً، اطبع الفواتير، وشاهد ربحك آخر اليوم.</p>
      </div>
      <div class="st rv d2">
        <div class="n" aria-hidden="true"></div>
        <svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 7.5v-2a1.5 1.5 0 0 0-1.5-1.5h-15A1.5 1.5 0 0 0 3 5.5v2a2.5 2.5 0 0 1 0 5v2A1.5 1.5 0 0 0 4.5 16h15a1.5 1.5 0 0 0 1.5-1.5v-2a2.5 2.5 0 0 1 0-5z"/><path d="M9 10h6"/></svg>
        <h3 data-en="Activate with a code">فعّل بكود</h3>
        <p data-en="Message us on WhatsApp with the device code shown in the app; you get an activation code and the app is yours for life.">راسلنا على واتساب برمز الجهاز الظاهر في التطبيق، تستلم كود التفعيل ويصبح التطبيق لك مدى الحياة.</p>
      </div>
    </div>
  </div>
</section>

<section id="learn" aria-labelledby="h-learn">
  <div class="wrap">
    <div class="sh rv">
      <span class="kick" data-en="Video tutorials">الشرح بالفيديو</span>
      <h2 class="h2" id="h-learn" data-en="Learn Kaseb in a few minutes">تعلّم كاسب خلال دقائق</h2>
      <p data-en="14 short lessons recorded inside the app, with the explanation written on screen — from installing it to returns, printing and every setting. Watch them right here.">14 درساً قصيراً مصوّراً من داخل البرنامج، والشرح مكتوب على الشاشة: من التثبيت والتفعيل حتى المرتجعات والطباعة وكل الإعدادات. شاهدها هنا مباشرة.</p>
    </div>
    <div class="tut rv">
      <div class="tv" id="tut-box">
        <div class="tvp"><video id="tut-v" controls playsinline preload="none" poster="/videos/thumbs/01-install-activate-lg.webp" src="/videos/01-install-activate.mp4" aria-label="فيديو الدرس"></video></div>
        <div class="tvb">
          <div class="tvk"><span class="n" id="tut-n">الدرس 1 من 14</span><span id="tut-d">1:13</span></div>
          <h3 id="tut-t">التثبيت والتفعيل</h3>
          <p id="tut-s">في هذه الحلقة نثبّت تطبيق كاسب ونفعّله خطوة بخطوة: رمز الجهاز، التجربة المجانية 7 أيام، إدخال كود التفعيل من البائع، ثم إعداد المتجر (الاسم، الهاتف، العملة) حتى تصل إلى شاشة البيع.</p>
          <div class="tch" id="tut-ch" aria-label="أقسام الدرس"><button type="button" data-t="0"><b>0:00</b>المقدمة</button><button type="button" data-t="4"><b>0:04</b>شاشة التفعيل ورمز الجهاز</button><button type="button" data-t="18"><b>0:18</b>إدخال كود التفعيل</button><button type="button" data-t="26"><b>0:26</b>الترحيب وإعداد المتجر: الاسم والهاتف</button><button type="button" data-t="41"><b>0:41</b>اختيار العملة</button><button type="button" data-t="51"><b>0:51</b>أول منتج (اختياري)</button><button type="button" data-t="56"><b>0:56</b>شاشة البيع</button><button type="button" data-t="61"><b>1:01</b>حالة الترخيص والعمل بلا إنترنت</button></div>
          <div class="tna"><button class="btn btn-o btn-s" type="button" id="tut-prev" data-en="Previous lesson" disabled>الدرس السابق</button><button class="btn btn-p btn-s" type="button" id="tut-next" data-en="Next lesson">الدرس التالي</button></div>
        </div>
      </div>
      <div class="tl">
        <div class="tlh"><b data-en="Lessons">الدروس</b><span data-en="14 lessons · 30 min">14 درساً · 30 دقيقة</span></div>
        <ol id="tut-l"><li><button type="button" data-k="0" aria-current="true"><span class="th"><img src="/videos/thumbs/01-install-activate.webp" width="480" height="270" loading="lazy" decoding="async" alt=""><span class="ck"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></span></span><span class="tx"><b>1. التثبيت والتفعيل</b><small>1:13</small></span></button></li><li><button type="button" data-k="1" aria-current="false"><span class="th"><img src="/videos/thumbs/02-store-setup.webp" width="480" height="270" loading="lazy" decoding="async" alt=""><span class="ck"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></span></span><span class="tx"><b>2. إعداد المحل والعملة</b><small>2:19</small></span></button></li><li><button type="button" data-k="2" aria-current="false"><span class="th"><img src="/videos/thumbs/03-products.webp" width="480" height="270" loading="lazy" decoding="async" alt=""><span class="ck"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></span></span><span class="tx"><b>3. إضافة المنتجات</b><small>2:35</small></span></button></li><li><button type="button" data-k="3" aria-current="false"><span class="th"><img src="/videos/thumbs/04-selling.webp" width="480" height="270" loading="lazy" decoding="async" alt=""><span class="ck"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></span></span><span class="tx"><b>4. شاشة البيع والدفع</b><small>1:50</small></span></button></li><li><button type="button" data-k="4" aria-current="false"><span class="th"><img src="/videos/thumbs/05-customers-debts.webp" width="480" height="270" loading="lazy" decoding="async" alt=""><span class="ck"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></span></span><span class="tx"><b>5. العملاء والديون</b><small>2:08</small></span></button></li><li><button type="button" data-k="5" aria-current="false"><span class="th"><img src="/videos/thumbs/06-inventory.webp" width="480" height="270" loading="lazy" decoding="async" alt=""><span class="ck"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></span></span><span class="tx"><b>6. المخزون والمشتريات</b><small>2:57</small></span></button></li><li><button type="button" data-k="6" aria-current="false"><span class="th"><img src="/videos/thumbs/07-shifts-expenses.webp" width="480" height="270" loading="lazy" decoding="async" alt=""><span class="ck"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></span></span><span class="tx"><b>7. الورديات والمصاريف</b><small>2:42</small></span></button></li><li><button type="button" data-k="7" aria-current="false"><span class="th"><img src="/videos/thumbs/08-rate-reports.webp" width="480" height="270" loading="lazy" decoding="async" alt=""><span class="ck"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></span></span><span class="tx"><b>8. سعر الصرف اليومي والتقارير</b><small>1:33</small></span></button></li><li><button type="button" data-k="8" aria-current="false"><span class="th"><img src="/videos/thumbs/09-users-permissions.webp" width="480" height="270" loading="lazy" decoding="async" alt=""><span class="ck"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></span></span><span class="tx"><b>9. الكاشير والصلاحيات</b><small>1:56</small></span></button></li><li><button type="button" data-k="9" aria-current="false"><span class="th"><img src="/videos/thumbs/10-backup-cloud-help.webp" width="480" height="270" loading="lazy" decoding="async" alt=""><span class="ck"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></span></span><span class="tx"><b>10. النسخ الاحتياطي والمساعدة</b><small>1:35</small></span></button></li><li><button type="button" data-k="10" aria-current="false"><span class="th"><img src="/videos/thumbs/11-phone-tour.webp" width="480" height="270" loading="lazy" decoding="async" alt=""><span class="ck"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></span></span><span class="tx"><b>11. التطبيق على الهاتف</b><small>1:24</small></span></button></li><li><button type="button" data-k="11" aria-current="false"><span class="th"><img src="/videos/thumbs/12-invoices-returns.webp" width="480" height="270" loading="lazy" decoding="async" alt=""><span class="ck"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></span></span><span class="tx"><b>12. الفواتير والمرتجعات</b><small>2:19</small></span></button></li><li><button type="button" data-k="12" aria-current="false"><span class="th"><img src="/videos/thumbs/13-printer-setup.webp" width="480" height="270" loading="lazy" decoding="async" alt=""><span class="ck"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></span></span><span class="tx"><b>13. إعداد الطابعة والطباعة</b><small>2:28</small></span></button></li><li><button type="button" data-k="13" aria-current="false"><span class="th"><img src="/videos/thumbs/14-settings-extras.webp" width="480" height="270" loading="lazy" decoding="async" alt=""><span class="ck"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></span></span><span class="tx"><b>14. الإعدادات والمزايا الإضافية</b><small>3:13</small></span></button></li></ol>
      </div>
    </div>
    <p class="tmore rv"><a href="/learn" data-en="Open the full tutorials page">افتح صفحة الشرح الكاملة</a></p>
  </div>
</section>

<section id="pricing" aria-labelledby="h-pricing">
  <div class="wrap">
    <div class="sh rv">
      <span class="kick" data-en="Pricing">الأسعار</span>
      <h2 class="h2" id="h-pricing" data-en="One price. No surprises.">سعر واحد. بلا مفاجآت.</h2>
      <p data-en="Pay once per device and keep it for life. No monthly fees, no commission on your sales.">تدفع مرة واحدة لكل جهاز ويبقى لك مدى الحياة. بلا اشتراك شهري وبلا عمولة على مبيعاتك.</p>
    </div>
    <div class="pr">
      <div class="pc hi rv">
        <span class="badge" data-en="Most popular">الأكثر طلباً</span>
        <h3 data-en="Lifetime license">الترخيص الدائم</h3>
        <p class="sub" data-en="Per device — phone or PC">لكل جهاز، هاتف أو حاسوب</p>
        <div class="price"><b>{{PRICE}}</b><span data-en="one-time">مرة واحدة</span></div>
        <p class="note" data-en="Free updates. Your data lives on your device and never leaves it.">تحديثات مجانية. بياناتك على جهازك ولا تغادره أبداً.</p>
        <ul>
          <li><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg><span data-en="All features, no exceptions">كل المزايا بلا استثناء</span></li>
          <li><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg><span data-en="Unlimited products, invoices and customers">منتجات وفواتير وعملاء بلا حدود</span></li>
          <li><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg><span data-en="Multiple cashiers with permissions">عدة كاشيرين بصلاحيات</span></li>
          <li><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg><span data-en="Works offline, forever">يعمل بلا إنترنت، للأبد</span></li>
          <li><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg><span data-en="Move the license to a new device">نقل الترخيص إلى جهاز جديد</span></li>
          <li><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg><span data-en="Support on WhatsApp">دعم عبر واتساب</span></li>
        </ul>
        <a class="btn btn-p" href="#download"><span data-en="Start the free trial">ابدأ التجربة المجانية</span></a>
      </div>
      <div class="pc rv d1">
        <h3 data-en="Cloud backup">النسخ السحابي</h3>
        <p class="sub" data-en="Optional add-on for peace of mind">إضافة اختيارية للاطمئنان</p>
        <div class="price"><b>{{CLOUD_PRICE}}</b><span data-en="per year">سنوياً</span></div>
        <p class="note" data-en="A compressed copy of all your shop data is uploaded every day. Restore it on any new device.">تُرفع نسخة مضغوطة من كل بيانات المحل يومياً. استعدها على أي جهاز جديد.</p>
        <ul>
          <li><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg><span data-en="Automatic daily backup">نسخة تلقائية كل يوم</span></li>
          <li><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg><span data-en="The last 3 copies are kept">آخر 3 نسخ محفوظة</span></li>
          <li><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg><span data-en="Restore on a new phone or PC in minutes">استعادة على هاتف أو حاسوب جديد خلال دقائق</span></li>
          <li><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg><span data-en="Add it any time, from the app or over WhatsApp">أضفها في أي وقت، من التطبيق أو عبر واتساب</span></li>
        </ul>
        <a class="btn btn-o" href="{{WA_LINK}}" target="_blank" rel="noopener"><span data-en="Ask about cloud backup">اسأل عن النسخ السحابي</span></a>
      </div>
    </div>
    <p class="pnote rv" data-en="Prices are in US dollars. Payment and activation go through the seller on WhatsApp.">الأسعار بالدولار الأمريكي. الدفع والتفعيل عبر البائع على واتساب.</p>
  </div>
</section>

<section id="compare" aria-labelledby="h-compare">
  <div class="wrap">
    <div class="sh rv">
      <span class="kick" data-en="Compare">المقارنة</span>
      <h2 class="h2" id="h-compare" data-en="The notebook and Excel got you here. Kaseb takes you further.">الدفتر وExcel أوصلوك إلى هنا. كاسب يأخذك أبعد.</h2>
    </div>
    <div class="cmp rv">
      <table>
        <thead><tr><th data-en="Daily need">ما تحتاجه يومياً</th><th data-en="Notebook">الدفتر</th><th>Excel</th><th class="k" data-en="Kaseb">كاسب</th></tr></thead>
        <tbody>
          <tr><td data-en="Sell with a barcode in a second">البيع بالباركود في ثانية</td><td><span class="no"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></span></td><td><span class="no"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></span></td><td class="k"><span class="ok"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg></span></td></tr>
          <tr><td data-en="Real profit in dollars, every day">الربح الحقيقي بالدولار كل يوم</td><td><span class="no"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></span></td><td><span class="half" data-en="manual">يدوي</span></td><td class="k"><span class="ok"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg></span></td></tr>
          <tr><td data-en="Customer debts with a statement">ديون العملاء مع كشف حساب</td><td><span class="half" data-en="manual">يدوي</span></td><td><span class="half" data-en="manual">يدوي</span></td><td class="k"><span class="ok"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg></span></td></tr>
          <tr><td data-en="Warns you before a product runs out">ينبّهك قبل نفاد الصنف</td><td><span class="no"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></span></td><td><span class="no"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></span></td><td class="k"><span class="ok"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg></span></td></tr>
          <tr><td data-en="Printed receipt and WhatsApp copy">فاتورة مطبوعة ونسخة واتساب</td><td><span class="half" data-en="by hand">بخط اليد</span></td><td><span class="no"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></span></td><td class="k"><span class="ok"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg></span></td></tr>
          <tr><td data-en="Several cashiers, each with a PIN and permissions">عدة كاشيرين، لكل واحد PIN وصلاحيات</td><td><span class="no"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></span></td><td><span class="no"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></span></td><td class="k"><span class="ok"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg></span></td></tr>
          <tr><td data-en="A backup that survives a lost phone">نسخة احتياطية تنجو من ضياع الهاتف</td><td><span class="no"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></span></td><td><span class="half" data-en="manual">يدوي</span></td><td class="k"><span class="ok"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg></span></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</section>

<section id="faq" aria-labelledby="h-faq">
  <div class="wrap">
    <div class="sh rv">
      <span class="kick" data-en="FAQ">الأسئلة الشائعة</span>
      <h2 class="h2" id="h-faq" data-en="Questions shop owners ask us">أسئلة يسألها أصحاب المحلات</h2>
    </div>
    <div class="faq">
      <details class="rv" name="faq" open>
        <summary><span data-en="Does it really work without internet?">هل يعمل فعلاً بلا إنترنت؟</span><span class="pm" aria-hidden="true"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span></summary>
        <div class="a" data-en="Yes, 100%. All your data is stored on the device itself, and selling, printing and reports work with no connection at all. The internet is used only once to activate, then for a quick license check every few days.">نعم، 100%. كل بياناتك مخزّنة على الجهاز نفسه، والبيع والطباعة والتقارير تعمل بلا أي اتصال. يُستخدم الإنترنت مرة واحدة للتفعيل، ثم لتحقق سريع من الترخيص كل بضعة أيام.</div>
      </details>
      <details class="rv" name="faq">
        <summary><span data-en="Which devices does it run on?">على أي أجهزة يعمل؟</span><span class="pm" aria-hidden="true"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span></summary>
        <div class="a" data-en="Any Android phone or tablet (Android 8 and up) and any Windows 10 or 11 PC. The same app, the same features; the screen simply adapts to the device.">أي هاتف أو لوحي أندرويد (الإصدار 8 فما فوق) وأي حاسوب ويندوز 10 أو 11. التطبيق نفسه والمزايا نفسها، والشاشة تتكيف مع الجهاز.</div>
      </details>
      <details class="rv" name="faq">
        <summary><span data-en="Can more than one cashier use it?">هل يستخدمه أكثر من كاشير؟</span><span class="pm" aria-hidden="true"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span></summary>
        <div class="a" data-en="Yes. Add a cashier account for each employee with their own PIN, decide exactly what each can do (discounts, refunds, reports, settings), and every action is written to the audit log with the name and time.">نعم. أضف حساباً لكل موظف مع رمز PIN خاص، وحدد بدقة ما يستطيع فعله (خصم، إرجاع، تقارير، إعدادات)، ويُسجَّل كل إجراء في سجل التدقيق مع الاسم والوقت.</div>
      </details>
      <details class="rv" name="faq">
        <summary><span data-en="Which printers and scanners work?">ما الطابعات والقارئات التي تعمل معه؟</span><span class="pm" aria-hidden="true"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span></summary>
        <div class="a" data-en="Thermal receipt printers (58 and 80 mm) over USB or Bluetooth, and any A4 printer for the tax invoice. Barcodes are read by the phone camera or any USB/Bluetooth scanner, and scale barcodes with the weight are supported.">طابعات الإيصالات الحرارية (58 و80 مم) عبر USB أو بلوتوث، وأي طابعة A4 للفاتورة الضريبية. الباركود يُقرأ بكاميرا الهاتف أو أي قارئ USB/بلوتوث، مع دعم باركود الميزان بالوزن.</div>
      </details>
      <details class="rv" name="faq">
        <summary><span data-en="Is my data safe? What about backups?">هل بياناتي آمنة؟ وماذا عن النسخ الاحتياطي؟</span><span class="pm" aria-hidden="true"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span></summary>
        <div class="a" data-en="Your data never leaves your device unless you choose to. You can export a backup file at any time and restore it on any device. With the optional cloud plan, a compressed encrypted copy is uploaded daily and the last three copies are kept.">بياناتك لا تغادر جهازك إلا إذا اخترت أنت. تستطيع تصدير ملف نسخة احتياطية في أي وقت واستعادته على أي جهاز. ومع الخطة السحابية الاختيارية تُرفع نسخة مضغوطة ومشفّرة يومياً وتُحفظ آخر ثلاث نسخ.</div>
      </details>
      <details class="rv" name="faq">
        <summary><span data-en="How do I pay and activate?">كيف أدفع وأفعّل؟</span><span class="pm" aria-hidden="true"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span></summary>
        <div class="a" data-en="Message us on WhatsApp with the device code shown on the activation screen. After payment (cash transfer or any method we agree on) you receive a 12-character activation code; type it once while online and you are done. The license is per device and can be moved to a new device.">راسلنا على واتساب برمز الجهاز الظاهر في شاشة التفعيل. بعد الدفع (حوالة أو أي طريقة نتفق عليها) تستلم كود تفعيل من 12 حرفاً؛ أدخله مرة واحدة وأنت متصل بالإنترنت وانتهى الأمر. الترخيص لكل جهاز ويمكن نقله إلى جهاز جديد.</div>
      </details>
    </div>
  </div>
</section>

<section aria-label="تواصل معنا">
  <div class="wrap">
    <div class="cta rv">
      <h2 data-en="Ready to run your shop with confidence?">جاهز تدير محلّك براحة بال؟</h2>
      <p data-en="Download Kaseb now and try every feature free for 7 days. Have a question first? We answer on WhatsApp.">حمّل كاسب الآن وجرّب كل المزايا مجاناً 7 أيام. عندك سؤال قبلها؟ نجيبك على واتساب.</p>
      <div class="row">
        <a class="btn btn-w" href="{{WA_LINK}}" target="_blank" rel="noopener"><svg class="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 1 1-4.2 15.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3.3 4.4c-.2 0-.5 0-.8.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 5 4.4 2.5 1 3 .8 3.5.7.5 0 1.7-.7 2-1.4.2-.7.2-1.3.1-1.4l-.5-.3-1.9-.9c-.3-.1-.4-.1-.6.1l-.9 1.1c-.2.2-.3.2-.6.1a7 7 0 0 1-2-1.3 7.7 7.7 0 0 1-1.4-1.8c-.2-.3 0-.4.1-.5l.4-.5.3-.5v-.5l-.9-2.1c-.2-.5-.4-.5-.6-.5z"/></svg><span data-en="Chat on WhatsApp">راسلنا على واتساب</span></a>
        <a class="btn btn-o" href="#download"><span data-en="Download the app">تحميل التطبيق</span></a>
      </div>
      <p class="num"><span data-en="WhatsApp:">واتساب:</span> <b>{{WHATSAPP}}</b></p>
    </div>
  </div>
</section>

</main>

<footer>
  <div class="wrap">
    <div class="top">
      <a class="brand" href="#top"><img src="/icon.svg" width="38" height="38" alt="" loading="lazy"><span data-en="Kaseb">كاسب</span></a>
      <nav class="links" aria-label="روابط">
        <a href="#features" data-en="Features">المزايا</a>
        <a href="#pricing" data-en="Pricing">الأسعار</a>
        <a href="#faq" data-en="FAQ">الأسئلة</a>
      <a href="/learn" data-en="Tutorials">الشرح</a>
        <a href="/privacy" data-en="Privacy policy">سياسة الخصوصية</a>
        <a href="{{WA_LINK}}" target="_blank" rel="noopener" data-en="WhatsApp">واتساب</a>
        <a class="dim" href="/admin" data-en="Seller panel">لوحة البائع</a>
      </nav>
    </div>
    <div class="bot">
      <span class="rule" data-en="Tobacco and alcohol products cannot be added to Kaseb; selling them is haram.">لا يمكن إضافة منتجات التبغ أو الكحول في كاسب، فبيعها حرام.</span>
      <span>&copy; <span data-en="Kaseb">كاسب</span> · <span data-en="Point of sale for Arab shops">نقطة بيع للمحلات العربية</span></span>
    </div>
  </div>
</footer>

<dialog class="vd" id="ad-dlg" aria-label="فيديو تعريفي بكاسب"><button class="x" type="button" id="ad-x" aria-label="إغلاق">✕</button><video id="ad-v" src="/videos/kaseb-ad.mp4" poster="/videos/kaseb-ad.jpg" controls playsinline preload="none"></video></dialog>
<script>
(function(){  if(dlg&&pv&&pb){pb.addEventListener("click",function(){if(dlg.showModal){dlg.showModal();pv.play().catch(function(){})}else{window.open("/videos/kaseb-ad.mp4")}});d.getElementById("ad-x").addEventListener("click",function(){dlg.close()});dlg.addEventListener("close",function(){pv.pause()});dlg.addEventListener("click",function(e){if(e.target===dlg)dlg.close()})}
  var d=document,h=d.documentElement,hd=d.querySelector('.hd'),btn=d.getElementById('lang');
  function setLang(en){
    h.setAttribute('data-lang',en?'en':'ar');h.lang=en?'en':'ar';h.dir=en?'ltr':'rtl';
    var els=d.querySelectorAll('[data-en]');
    for(var i=0;i<els.length;i++){var el=els[i];if(!el.hasAttribute('data-ar'))el.setAttribute('data-ar',el.innerHTML);el.innerHTML=en?el.getAttribute('data-en'):el.getAttribute('data-ar')}
    btn.textContent=en?'عربي':'EN';btn.setAttribute('aria-label',en?'التبديل إلى العربية':'Switch to English');btn.title=en?'العربية':'English';
    try{localStorage.setItem('kaseb-lang',en?'en':'ar')}catch(e){}
  }
  btn.addEventListener('click',function(){setLang(h.getAttribute('data-lang')!=='en')});
  try{if(localStorage.getItem('kaseb-lang')==='en')setLang(true)}catch(e){}
  var onScroll=function(){hd.classList.toggle('s',(window.scrollY||0)>8)};
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();
  var menu=d.querySelector('.menu');
  if(menu){menu.addEventListener('click',function(e){if(e.target.closest('a'))menu.removeAttribute('open')});d.addEventListener('click',function(e){if(!menu.contains(e.target))menu.removeAttribute('open')})}
  var rv=d.querySelectorAll('.rv');
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('on');io.unobserve(x.target)}})},{rootMargin:'0px 0px -8% 0px',threshold:.08});
    for(var j=0;j<rv.length;j++)io.observe(rv[j]);
  }else{for(var k=0;k<rv.length;k++)rv[k].classList.add('on')}
  var dlg=d.getElementById("ad-dlg"),pv=d.getElementById("ad-v"),pb=d.getElementById("play-ad");
  if(dlg&&pv&&pb){pb.addEventListener("click",function(){if(dlg.showModal){dlg.showModal();pv.play().catch(function(){})}else{window.open("/videos/kaseb-ad.mp4")}});d.getElementById("ad-x").addEventListener("click",function(){dlg.close()});dlg.addEventListener("close",function(){pv.pause()});dlg.addEventListener("click",function(e){if(e.target===dlg)dlg.close()})}
})();
</script>
<script type="application/json" id="tut-data">[{"slug": "01-install-activate", "title": "التثبيت والتفعيل", "seconds": 73, "summary": "في هذه الحلقة نثبّت تطبيق كاسب ونفعّله خطوة بخطوة: رمز الجهاز، التجربة المجانية 7 أيام، إدخال كود التفعيل من البائع، ثم إعداد المتجر (الاسم، الهاتف، العملة) حتى تصل إلى شاشة البيع.", "chapters": [[0, "المقدمة"], [4, "شاشة التفعيل ورمز الجهاز"], [18, "إدخال كود التفعيل"], [26, "الترحيب وإعداد المتجر: الاسم والهاتف"], [41, "اختيار العملة"], [51, "أول منتج (اختياري)"], [56, "شاشة البيع"], [61, "حالة الترخيص والعمل بلا إنترنت"]], "portrait": false}, {"slug": "02-store-setup", "title": "إعداد المحل والعملة", "seconds": 139, "summary": "في هذه الحلقة نجهّز محلّك في كاسب: اسم المتجر وهاتفه وعنوانه وشعاره، والعملة الأساسية مع الدولار كعملة ثانية بسعر صرف يومي تحدّثه بنفسك وتقريب مريح للأسعار، ثم الضريبة ونصّ الفاتورة والطباعة التلقائية وشريط الحفظ.", "chapters": [[0, "المقدمة"], [5, "فتح الإعدادات"], [15, "بيانات المتجر والشعار"], [32, "العملة الأساسية والدولار وسعر الصرف"], [87, "الضريبة"], [98, "نصّ الفاتورة والمعاينة والطباعة التلقائية"], [125, "حفظ التغييرات"]], "portrait": false}, {"slug": "03-products", "title": "إضافة المنتجات", "seconds": 155, "summary": "في هذه الحلقة نضيف منتجاً جديداً في كاسب خطوة بخطوة: الاسم، الباركود الداخلي، الفئة، سعر البيع والتكلفة وسعر الجملة، تتبّع المخزون، ووحدات البيع بالكرتونة.", "chapters": [[0, "المقدمة"], [7, "قائمة المنتجات"], [17, "منتج جديد: الاسم والباركود والفئة"], [38, "سعر البيع والتكلفة وسعر الجملة"], [56, "تتبّع المخزون والكمية"], [70, "وحدات البيع (الكرتونة)"], [88, "حفظ المنتج"], [98, "الاستيراد من ملف CSV"], [120, "طباعة ملصقات الأسعار"], [136, "التعديل السريع"]], "portrait": false}, {"slug": "04-selling", "title": "شاشة البيع والدفع", "seconds": 110, "summary": "في هذه الحلقة نتعلّم شاشة البيع في كاسب من أولها لآخرها: البحث بالاسم، الإضافة بالضغط أو بقارئ الباركود، تعديل الكميات، الخصم على الصنف أو على الفاتورة، اختيار العميل، تعليق الفاتورة واسترجاعها، ثم الدفع نقداً أو بالدولار مع حساب الباقي تلقائياً، وطباعة الفاتورة أو إرسالها عبر واتساب.", "chapters": [[0, "المقدمة"], [7, "شاشة البيع والبحث بالاسم"], [17, "المسح بالباركود"], [21, "تعديل الكمية"], [27, "خصم على الصنف"], [37, "خصم على الفاتورة"], [47, "اختيار العميل"], [52, "تعليق الفاتورة واسترجاعها"], [64, "اختصارات لوحة المفاتيح"], [70, "الدفع نقداً والباقي"], [83, "الدفع بالدولار"], [89, "إتمام البيع والفاتورة"]], "portrait": false}, {"slug": "05-customers-debts", "title": "العملاء والديون", "seconds": 128, "summary": "في هذه الحلقة نتعلّم كيف تسجّل عملاءك في كاسب، وتبيع لهم بالآجل (دين)، ثم تتابع رصيد كل عميل وكشف حسابه وتسجّل الدفعات، مع تذكير واتساب ونقاط الولاء.", "chapters": [[0, "مقدمة"], [6, "صفحة العملاء"], [13, "إضافة عميل جديد (الاسم، الهاتف، مفرّق أو جملة)"], [38, "بيع بالآجل: اختيار العميل والدفع «دين (آجل)»"], [74, "رصيد العميل وكشف الحساب"], [85, "تسديد دفعة جزئية"], [111, "تذكير بالرصيد عبر واتساب"], [115, "نقاط الولاء واستبدالها"]], "portrait": false}, {"slug": "06-inventory", "title": "المخزون والمشتريات", "seconds": 177, "summary": "في هذه الحلقة من سلسلة كاسب نتعلّم إدارة المخزون والمشتريات: كميات المنتجات والفلاتر، تعديل كمية منتج مع السبب، الجرد الشامل وتطبيقه، تسجيل فاتورة شراء بالدولار مع سعر الصرف، متابعة رصيد المورّد وسداده، واقتراح طلبية تلقائية للنواقص.", "chapters": [[0, "المقدمة"], [5, "تبويب المخزون: القيمة، الناقص والنافد، والفلاتر"], [18, "تعديل كمية منتج (إضافة / سحب) مع السبب"], [40, "الجرد الشامل وتطبيقه"], [79, "إضافة مورّد جديد"], [94, "فاتورة شراء بالدولار: سعر الصرف، الأصناف، المدفوع الآن"], [137, "حفظ الفاتورة وزيادة المخزون تلقائياً"], [144, "سداد المورّد"], [159, "اقتراح طلبية للنواقص"]], "portrait": false}, {"slug": "07-shifts-expenses", "title": "الورديات والمصاريف", "seconds": 162, "summary": "في هذه الحلقة نتعلّم كيف تتابع نقد الدرج في كاسب: الوردية المفتوحة والنقد المتوقع، إدخال وإخراج النقد، تسجيل مصروف من الدرج مع فئته، ثم إغلاق الوردية بعدّ النقد ومعرفة الفرق، وتقرير الوردية وفتح وردية جديدة.", "chapters": [[0, "المقدمة"], [5, "الوردية المفتوحة والنقد المتوقع"], [28, "إدخال نقد إلى الدرج (وإخراج النقد)"], [57, "تسجيل مصروف من درج الكاشير"], [95, "إغلاق الوردية: المتوقع مقابل المعدود"], [130, "تقرير الوردية (طباعة ومشاركة)"], [143, "فتح وردية جديدة"]], "portrait": false}, {"slug": "08-rate-reports", "title": "سعر الصرف اليومي والتقارير", "seconds": 93, "summary": "تغيّر سعر الدولار اليوم؟ في هذه الحلقة تتعلّم كيف تحدّث سعر الصرف في كاسب بثوانٍ من شريحة أعلى الشاشة، فتُعاد تسعير كل المنتجات بالليرة فوراً مع معاينة للأسعار الجديدة وتأكيد إضافي عند التغييرات الكبيرة.", "chapters": [[0, "المقدمة"], [7, "شريحة سعر الصرف في أعلى الشاشة"], [18, "نافذة تحديث السعر ولوحة الأرقام"], [24, "التحذير عند التغيير الكبير"], [33, "معاينة الأسعار الجديدة والحفظ"], [40, "المنتجات بعد التحديث"], [48, "شاشة التقارير"], [57, "اختيار الفترة: اليوم، الأسبوع، الشهر"], [64, "عرض الأرقام بالدولار"], [71, "أفضل المنتجات وحسب الكاشير"], [80, "تصدير التقارير كملف CSV"], [87, "الخلاصة"]], "portrait": false}, {"slug": "09-users-permissions", "title": "الكاشير والصلاحيات", "seconds": 116, "summary": "في هذه الحلقة تتعلّم كيف تضيف حساباً لكل موظف في محلّك برمز PIN، وتقرّر ما يستطيع الكاشير فعله (خصم، إرجاع، تعديل سعر، رؤية التكلفة…)، ثم تقفل الشاشة وتدخل كاشيراً لترى ما يختفي عنه، وتراجع سجل النشاط الذي يحفظ من فعل ماذا ومتى.", "chapters": [[0, "مقدمة"], [6, "قائمة المستخدمين"], [15, "إضافة كاشير برمز PIN"], [39, "بطاقة صلاحيات الكاشير"], [58, "قفل الشاشة والدخول بالرمز"], [70, "ماذا يرى الكاشير وما يختفي عنه"], [80, "العودة كمدير"], [87, "سجل النشاط: من فعل ماذا ومتى"]], "portrait": false}, {"slug": "10-backup-cloud-help", "title": "النسخ الاحتياطي والمساعدة", "seconds": 95, "summary": "في هذه الحلقة من سلسلة كاسب: كيف تحمي بيانات محلّك بملف نسخة احتياطية واحد، وكيف تستعيده على جهاز جديد، وما الذي يقدّمه التخزين السحابي للمشتركين.", "chapters": [[0, "المقدمة"], [7, "تذكير النسخة الاحتياطية"], [14, "تصدير نسخة احتياطية"], [31, "استعادة نسخة (والتحذير)"], [52, "التخزين السحابي"], [65, "صفحة المساعدة والدعم"], [92, "الخاتمة"]], "portrait": false}, {"slug": "11-phone-tour", "title": "التطبيق على الهاتف", "seconds": 84, "summary": "كاسب يعمل على هاتفك بنفس بيانات محلّك: بيع بالضغط على المنتج أو بمسح الباركود بالكاميرا، سلة وخصم وعميل، دفع سريع وإيصال عبر واتساب.", "chapters": [[0, "المقدمة"], [6, "الشريط السفلي والأقسام"], [16, "البيع بالضغط على المنتج"], [22, "ماسح الباركود بالكاميرا"], [27, "إدخال الباركود يدوياً"], [42, "السلة وتعديل الكميات"], [53, "الدفع والمبلغ السريع"], [64, "إنهاء البيع والإيصال"], [69, "قائمة «المزيد»"]], "portrait": true}, {"slug": "12-invoices-returns", "title": "الفواتير والمرتجعات", "seconds": 139, "summary": "في هذه الحلقة تتعلّم كيف تجد أي فاتورة في كاسب: اختر الفترة، صفِّ حسب الكاشير أو طريقة الدفع أو الحالة أو العميل، أو اكتب رقمها. وأسرع طريقة أن تمسح الباركود المطبوع على الإيصال.", "chapters": [[0, "المقدمة"], [5, "فتح شاشة الفواتير"], [14, "الفترة والملخص"], [23, "التصفية: الكاشير، طريقة الدفع، الحالة، العميل"], [34, "البحث برقم الفاتورة ومسح باركود الإيصال"], [45, "تفاصيل الفاتورة: الأصناف والدفع والكاشير"], [58, "إعادة الطباعة والمشاركة وفاتورة A4"], [68, "الإرجاع الجزئي: الصنف والكمية والمبلغ"], [97, "بعد الإرجاع: شارة «جزئي» وسجل الإرجاع"], [116, "إيجاد الفواتير التي فيها إرجاع"], [130, "صلاحية الإرجاع للكاشير"]], "portrait": false}, {"slug": "13-printer-setup", "title": "إعداد الطابعة والطباعة", "seconds": 148, "summary": "في هذه الحلقة نجهّز الطباعة في كاسب: عرض ورق الطابعة الحرارية (58 أو 80 مم) مع المعاينة الحيّة، الشعار وباركود رقم الفاتورة، ونصّ أعلى الفاتورة وأسفلها.", "chapters": [[0, "المقدمة"], [6, "فتح إعدادات الفاتورة"], [11, "عرض الورق والمعاينة"], [25, "الشعار وباركود الفاتورة"], [36, "نصّ أعلى وأسفل الفاتورة"], [50, "الطباعة التلقائية وعدد النسخ والطابعة"], [67, "طباعة فاتورة تجريبية"], [74, "الطباعة على أندرويد (البلوتوث)"], [87, "حفظ الإعدادات"], [93, "السؤال عن الطباعة بعد البيع"], [102, "بيع قصير: طباعة، فاتورة A4، واتساب"]], "portrait": false}, {"slug": "14-settings-extras", "title": "الإعدادات والمزايا الإضافية", "seconds": 193, "summary": "في هذه الحلقة نضبط كاسب على مقاس محلّك: إعدادات نقطة البيع (طريقة الدفع، مبالغ الدفع السريع، البيع عند نفاد المخزون، حجم البطاقات، الأصوات، رمز PIN والقفل التلقائي)، ثم باركود الميزان من الإعداد حتى مسح ملصق موز في شاشة البيع.", "chapters": [[0, "المقدمة"], [5, "إعدادات نقطة البيع"], [47, "باركود الميزان: الإعداد ورقم الصنف ومسح الملصق"], [86, "تاريخ انتهاء الصلاحية و«قريب الانتهاء»"], [112, "شاشة المصاريف: الفترة والفئات والتصدير"], [152, "المظهر واللغة"], [168, "حول التطبيق: الإصدار ورمز الجهاز والترخيص"]], "portrait": false}]</script>
<script>
(function(){
  var d=document,data=JSON.parse(d.getElementById('tut-data').textContent),v=d.getElementById('tut-v'),list=d.getElementById('tut-l')
  if(!v||!list||!data.length)return
  var KEY='kaseb.learn.done',done=[],cur=0
  try{done=JSON.parse(localStorage.getItem(KEY)||'[]')||[]}catch(e){}
  function fmt(s){var m=Math.floor(s/60),x=Math.floor(s%60);return m+':'+(x<10?'0':'')+x}
  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  var btns=list.querySelectorAll('button[data-k]')
  function mark(){for(var i=0;i<btns.length;i++){var k=+btns[i].getAttribute('data-k');btns[i].setAttribute('aria-current',String(k===cur));btns[i].classList.toggle('seen',done.indexOf(data[k].slug)>=0)}}
  function play(){var p=v.play();if(p&&p.catch)p.catch(function(){})}
  function seek(t){
    var go=function(){try{v.currentTime=t}catch(e){}play()}
    if(v.readyState>=1)go();else{v.preload='auto';v.addEventListener('loadedmetadata',function h(){v.removeEventListener('loadedmetadata',h);go()});v.load()}
  }
  function sel(k,autoplay){
    cur=k;var e=data[k],src='/videos/'+e.slug+'.mp4'
    if(v.getAttribute('src')!==src){v.pause();v.setAttribute('poster','/videos/thumbs/'+e.slug+'-lg.webp');v.setAttribute('src',src);v.preload=autoplay?'auto':'none';v.load()}
    d.getElementById('tut-n').textContent='الدرس '+(k+1)+' من '+data.length
    d.getElementById('tut-d').textContent=fmt(e.seconds)
    d.getElementById('tut-t').textContent=e.title
    d.getElementById('tut-s').textContent=e.summary
    d.getElementById('tut-ch').innerHTML=e.chapters.map(function(c){return '<button type="button" data-t="'+c[0]+'"><b>'+fmt(c[0])+'</b>'+esc(c[1])+'</button>'}).join('')
    d.getElementById('tut-prev').disabled=k===0
    d.getElementById('tut-next').disabled=k===data.length-1
    mark()
    var b=btns[k];if(b&&list.scrollHeight>list.clientHeight){var li=b.parentNode;list.scrollTop=li.offsetTop-list.clientHeight/2+li.offsetHeight/2}
    if(autoplay)play()
  }
  list.addEventListener('click',function(ev){var b=ev.target.closest('button[data-k]');if(b)sel(+b.getAttribute('data-k'),true)})
  d.getElementById('tut-ch').addEventListener('click',function(ev){var b=ev.target.closest('button[data-t]');if(b)seek(+b.getAttribute('data-t'))})
  d.getElementById('tut-prev').addEventListener('click',function(){if(cur>0)sel(cur-1,true)})
  d.getElementById('tut-next').addEventListener('click',function(){if(cur<data.length-1)sel(cur+1,true)})
  v.addEventListener('ended',function(){var s=data[cur].slug;if(done.indexOf(s)<0){done.push(s);try{localStorage.setItem(KEY,JSON.stringify(done))}catch(e){}}if(cur<data.length-1)sel(cur+1,false);else mark()})
  // one video at a time: the lesson and the promo dialog pause each other
  var ad=d.getElementById('ad-v');if(ad){ad.addEventListener('play',function(){v.pause()});v.addEventListener('play',function(){ad.pause()})}
  mark()
})();
</script>
</body>
</html>`
