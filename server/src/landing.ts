// The public home page, served at /: one link to share, with a button per grade that opens the web app
// or downloads the Android app (the APKs live in downloads/, copied into content/files/ at deploy).
import sales from '../../src/sales.json'

type Grade = { book: string; name: string; icon: string; color: string; web: string; apk: string }
const GRADES: Grade[] = [
  { book: 'g12', name: 'البكالوريا', icon: '12', color: '#a855f7', web: '/app/', apk: 'Emar12.apk' },
  { book: 'g11', name: 'الحادي عشر', icon: '11', color: '#1cb0f6', web: '/app11/', apk: 'Emar11.apk' },
  { book: 'g9', name: 'التاسع', icon: '9', color: '#ff4b4b', web: '/app9/', apk: 'Emar9.apk' },
  { book: 'g8', name: 'الثامن', icon: '8', color: '#58cc02', web: '/app8/', apk: 'Emar8.apk' },
  { book: 'g5', name: 'الخامس', icon: '5', color: '#ff9600', web: '/app5/', apk: 'Emar5.apk' },
]
export const APK_FILES = GRADES.map(g => g.apk)

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export function landingPage(origin: string): string {
  const price = sales.price as Record<string, string>
  const wa = `https://wa.me/${sales.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('مرحباً، عندي سؤال عن تطبيقات إمار للإنجليزي')}`
  const cards = GRADES.map(g => `
    <div class="g" style="--c:${g.color}">
      <div class="gh"><div class="gi">${g.icon}</div><div class="gt"><b>${g.name}</b><span>كتاب الطالب + كتاب الأنشطة${price[g.book] ? ` · <em>${esc(price[g.book])}</em> للعام` : ''}</span></div></div>
      <div class="gb"><a class="b1" href="${g.web}">ابدأ من المتصفح</a><a class="b2" href="/dl/${g.apk}" download>📥 أندرويد</a></div>
    </div>`).join('')
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>إمار للإنجليزي — إنجليزي المنهاج السوري بطريقة اللعبة</title>
<meta name="description" content="تطبيقات لتعلّم إنجليزي المنهاج السوري: الخامس، الثامن، التاسع، الحادي عشر، البكالوريا. الوحدة الأولى مجاناً.">
<meta property="og:title" content="إمار للإنجليزي — المنهاج السوري بطريقة اللعبة 🎮">
<meta property="og:description" content="الخامس · الثامن · التاسع · الحادي عشر · البكالوريا. الوحدة الأولى مجاناً 🎁">
<meta property="og:image" content="${origin}/files/og.png"><meta property="og:type" content="website"><meta property="og:url" content="${origin}/">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#7c3aed">
<link rel="icon" href="/app/icon.svg"><link rel="apple-touch-icon" href="/app/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;600;800;900&display=swap" rel="stylesheet">
<style>
:root{--ink:#17131f;--mut:#5b546b;--bg:#f3f0fa;--card:#fff;--line:#e9e4f3;--pur:#7c3aed;--grn:#58cc02}
@media (prefers-color-scheme:dark){:root{--ink:#f1eef8;--mut:#b2abc4;--bg:#120f1a;--card:#1d1828;--line:#2c2540}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Alexandria,system-ui,sans-serif;background:var(--bg);color:var(--ink);line-height:1.6;min-height:100vh;
  background-image:radial-gradient(600px 400px at 90% -10%,rgba(206,130,255,.45),transparent 70%),radial-gradient(500px 400px at -10% 110%,rgba(120,230,170,.35),transparent 70%)}
main{max-width:640px;margin:0 auto;padding:28px 16px 40px}
.hero{text-align:center;margin-bottom:22px}
.logo{width:84px;height:84px;border-radius:24px;margin:0 auto 12px;background:linear-gradient(145deg,#e3b3ff,#ce82ff 40%,#7c3aed);color:#fff;display:grid;place-items:center;font-weight:900;font-size:28px;box-shadow:0 16px 36px rgba(124,58,237,.35)}
h1{font-size:30px;font-weight:900;line-height:1.25}h1 span{color:var(--pur)}
.sub{color:var(--mut);font-size:16px;margin-top:6px}
.free{display:inline-block;margin-top:12px;padding:6px 16px;border-radius:999px;background:var(--grn);color:#fff;font-weight:800;font-size:15px}
h2{font-size:18px;font-weight:800;margin:26px 2px 12px}
.g{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:14px;margin-bottom:12px;box-shadow:0 10px 26px -14px rgba(23,19,31,.25);border-inline-start:6px solid var(--c)}
.gh{display:flex;align-items:center;gap:12px}
.gi{width:52px;height:52px;border-radius:16px;background:var(--c);color:#fff;display:grid;place-items:center;font-weight:900;font-size:20px;flex:none;direction:ltr}
.gt{display:flex;flex-direction:column}.gt b{font-size:20px;font-weight:900}.gt span{font-size:13.5px;color:var(--mut)}.gt em{font-style:normal;font-weight:800;color:var(--ink)}
.gb{display:flex;gap:8px;margin-top:12px}
.gb a{flex:1;text-align:center;text-decoration:none;font-weight:800;font-size:15px;padding:12px 8px;border-radius:14px}
.b1{background:var(--c);color:#fff}.b2{background:transparent;color:var(--ink);border:2px solid var(--line)}
.feat{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.feat div{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:12px;font-size:14px;font-weight:600}
.feat b{display:block;font-size:22px}
ol{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px 34px 14px 14px;font-size:15px}
ol li{margin:4px 0}
.wa{display:block;text-align:center;margin-top:20px;padding:14px;border-radius:16px;background:#25d366;color:#fff;font-weight:800;text-decoration:none;font-size:17px}
.note{text-align:center;color:var(--mut);font-size:13px;margin-top:14px}.note a{color:var(--mut)}
</style></head><body><main>
<div class="hero">
  <div class="logo">إمار</div>
  <h1>إنجليزي المنهاج السوري<br><span>بطريقة اللعبة 🎮</span></h1>
  <p class="sub">دروس كتابك خطوة بخطوة، مع صوت طبيعي وتمارين مشروحة بالعربي</p>
  <span class="free">🎁 الوحدة الأولى مجاناً</span>
</div>
<h2>اختار صفّك 👇</h2>
${cards}
<p class="note">«ابدأ من المتصفح» بيشتغل على الآيفون والكمبيوتر. «أندرويد» بينزّل التطبيق: افتح الملف ووافق على التثبيت.</p>
<h2>شو بتلاقي بالتطبيق؟</h2>
<div class="feat">
  <div><b>📘</b>كتاب الطالب وكتاب الأنشطة، درس درس</div>
  <div><b>🔊</b>كل كلمة بصوت طبيعي، ومع ميزة التبطيء</div>
  <div><b>✅</b>تمارين محلولة ومشروحة بالعربي</div>
  <div><b>📝</b>امتحانات بشكل الامتحان الحقيقي</div>
</div>
<h2>كيف بشترك؟</h2>
<ol>
  <li>افتح تطبيق صفّك وجرّب الوحدة الأولى مجاناً.</li>
  <li>اكبس «فعّل»، وادفع بشام كاش من الرمز اللي بيطلعلك.</li>
  <li>اكبس «دفعت» واكتب اسمك ورقمك، وأول ما نتأكد من الدفع بيتفعّل التطبيق لحاله.</li>
</ol>
<a class="wa" href="${wa}">💬 عندك سؤال؟ راسلنا واتساب</a>
<p class="note">${esc(sales.validity || '')} · <a href="/privacy">سياسة الخصوصية</a></p>
</main></body></html>`
}
