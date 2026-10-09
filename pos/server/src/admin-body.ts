// The control panel's static markup (see admin.ts): the login screen, the shell (sidebar, top bar, bottom tabs)
// and the six views. Lists, charts and sheets are rendered by admin-js.ts into the containers here.
// Icons are inline SVG (no external scripts); the icon set itself lives in admin-js.ts.
export const ADMIN_BODY = String.raw`
<div id="login" class="hidden">
  <form class="login-card" id="loginForm" autocomplete="off">
    <div class="row" style="margin-bottom:18px"><div class="logo">ك</div><div><h1>لوحة كاسب</h1><div class="muted">إدارة التراخيص والأجهزة والسحابة</div></div></div>
    <label class="l" for="key">مفتاح الإدارة</label>
    <div class="field"><input id="key" class="in ltr" type="password" placeholder="KASEB_ADMIN_KEY" autocomplete="current-password" spellcheck="false"><button type="button" class="eye" id="eye" aria-label="إظهار المفتاح"></button></div>
    <label class="check" style="margin-top:4px"><input type="checkbox" id="remember" checked><span>تذكّرني على هذا الجهاز</span></label>
    <button class="btn primary lg block" id="enter" type="submit">دخول</button>
    <div class="err" id="loginErr"></div>
    <div class="faint" style="margin-top:8px">المفتاح هو السر <span class="mono">KASEB_ADMIN_KEY</span> من إعدادات المستودع. يُحفظ في هذا المتصفح فقط.</div>
  </form>
</div>

<div id="app" class="hidden">
  <aside class="side">
    <div class="brand"><div class="logo">ك</div><div><div class="t">كاسب</div><div class="s" id="sideHost"></div></div></div>
    <nav id="sideNav"></nav>
    <div class="foot">
      <button class="act" id="themeBtnSide" type="button" style="border:0"></button>
      <div style="position:relative"><button class="act" id="userBtn" type="button" style="border:0;width:100%"></button><div class="menu hidden" id="userMenu"></div></div>
    </div>
  </aside>
  <div>
    <header class="top">
      <div class="logo">ك</div>
      <h1 id="pageTitle">الرئيسية</h1>
      <div class="search gs"><span class="ic" id="gsIcon"></span><input id="gs" class="in sm" placeholder="ابحث عن كود، ملاحظة، أو رمز جهاز…" autocomplete="off"><kbd>/</kbd></div>
      <div class="grow"></div>
      <button class="btn primary sm" id="qNew" type="button"></button>
      <button class="btn ghost icon sm" id="themeBtnTop" type="button" aria-label="المظهر"></button>
      <div style="position:relative" id="userTopWrap"><button class="btn ghost icon sm" id="userBtnTop" type="button" aria-label="القائمة"></button><div class="menu hidden" id="userMenuTop" style="left:0;right:auto"></div></div>
    </header>
    <main class="content">
      <section class="view" id="v-home">
        <div class="kpis" id="kpis"></div>
        <div class="split w mt">
          <div class="card pad-0"><div class="card-h"><h2>التفعيلات — آخر 30 يوماً</h2><span class="muted" id="c30Sum"></span></div><div class="card-b"><div class="chart" id="chart30"></div><div class="legend"><span><i style="background:var(--brand)"></i>تفعيل كود</span><span><i style="background:var(--info)"></i>بدء تجربة</span></div></div></div>
          <div class="card pad-0"><div class="card-h"><h2>الاتجاه — 12 أسبوعاً</h2><span class="muted" id="c12Sum"></span></div><div class="card-b"><div class="chart" id="chart12"></div><div class="legend"><span><i style="background:var(--brand)"></i>تفعيلات</span><span><i style="background:var(--info)"></i>تجارب</span></div></div></div>
        </div>
        <div class="split mt">
          <div class="card pad-0"><div class="card-h"><h2>الأجهزة حسب المنصة</h2><span class="muted" id="platSum"></span></div><div class="card-b" id="plat"></div></div>
          <div class="card pad-0"><div class="card-h"><h2>إجراءات سريعة</h2></div><div class="card-b"><div class="acts" id="quick"></div><div class="mt" id="cloudSoonBox"></div></div></div>
        </div>
        <div class="card pad-0 mt"><div class="card-h"><h2>آخر الأحداث</h2><button class="btn ghost sm" id="feedMore" type="button">السجل الكامل</button></div><div class="card-b" id="feed" style="padding-top:4px;padding-bottom:4px"></div></div>
      </section>

      <section class="view" id="v-codes">
        <div class="toolbar">
          <div class="r1"><div class="search"><span class="ic" id="cqIcon"></span><input id="cq" class="in" placeholder="كود، ملاحظة، بائع، أو رمز جهاز" autocomplete="off"><button class="clr hidden" id="cqClr" type="button" aria-label="مسح"></button></div><button class="btn outline icon" id="cFilter" type="button" aria-label="تصفية"></button></div>
          <div class="r2"><div class="chips" id="cChips"></div><select class="in sm" id="cSort" aria-label="الترتيب"><option value="created:desc">الأحدث أولاً</option><option value="created:asc">الأقدم أولاً</option><option value="expires:asc">الانتهاء الأقرب</option><option value="cloud:asc">السحابة الأقرب انتهاءً</option><option value="last_seen:desc">آخر ظهور</option><option value="devices:desc">الأكثر أجهزة</option><option value="note:asc">الملاحظة أ-ي</option></select></div>
        </div>
        <div class="row mt-s" id="cActive"></div>
        <div class="meta"><span id="cMeta"></span><button class="btn soft sm" id="cNew" type="button"></button></div>
        <div class="card pad-0" id="cList"></div>
        <div class="pager" id="cPager"></div>
      </section>

      <section class="view" id="v-devices">
        <div class="toolbar">
          <div class="r1"><div class="search"><span class="ic" id="dqIcon"></span><input id="dq" class="in" placeholder="رمز الجهاز، الاسم، أو الكود" autocomplete="off"><button class="clr hidden" id="dqClr" type="button" aria-label="مسح"></button></div></div>
          <div class="r2"><div class="chips" id="dChips"></div><select class="in sm" id="dPlat" aria-label="المنصة"><option value="">كل المنصات</option><option value="android">أندرويد</option><option value="electron">ويندوز</option><option value="web">متصفح</option></select></div>
        </div>
        <div class="meta"><span id="dMeta"></span></div>
        <div class="card pad-0" id="dList"></div>
        <div class="pager" id="dPager"></div>
      </section>

      <section class="view" id="v-cloud">
        <div class="kpis" id="clKpis"></div>
        <div class="toolbar mt">
          <div class="r1"><div class="search"><span class="ic" id="clqIcon"></span><input id="clq" class="in" placeholder="كود، ملاحظة، أو بائع" autocomplete="off"></div></div>
          <div class="r2"><div class="chips" id="clChips"></div></div>
        </div>
        <div class="meta"><span id="clMeta"></span></div>
        <div class="card pad-0" id="clList"></div>
        <div class="pager" id="clPager"></div>
      </section>

      <section class="view" id="v-log">
        <div class="card"><div class="grid3">
          <div><label class="l">النوع</label><select class="in sm" id="lKind"><option value="nocheck">كل شيء عدا التحقق الدوري</option><option value="">كل الأحداث</option><option value="fail">المحاولات الفاشلة</option><option value="activate">تفعيل</option><option value="trial">تجربة</option><option value="check">تحقق دوري</option><option value="release">تحرير جهاز</option><option value="admin">إجراءاتي</option><option value="backup">نسخ سحابي</option><option value="restore">استعادة</option></select></div>
          <div><label class="l">الكود</label><input class="in sm mono" id="lCode" placeholder="XXXX-XXXX-XXXX" autocomplete="off"></div>
          <div><label class="l">رمز الجهاز</label><input class="in sm mono" id="lDevice" placeholder="XXXX-XXXX" autocomplete="off"></div>
          <div><label class="l">من</label><input class="in sm" id="lFrom" type="date"></div>
          <div><label class="l">إلى</label><input class="in sm" id="lTo" type="date"></div>
          <div style="display:flex;align-items:flex-end;gap:8px"><button class="btn primary sm" id="lGo" type="button">عرض</button><button class="btn outline sm" id="lCsv" type="button">تنزيل CSV</button></div>
        </div></div>
        <div class="meta"><span id="lMeta"></span></div>
        <div class="card pad-0" id="lList"></div>
        <div class="pager" id="lPager"></div>
      </section>

      <section class="view" id="v-settings">
        <div class="split">
          <div class="stack-lg">
            <div class="card pad-0"><div class="card-h"><h2>السعر والتواصل</h2></div><div class="card-b stack">
              <div class="grid2"><div><label class="l">سعر الترخيص (نص يظهر للعميل)</label><input class="in" data-k="price" maxlength="40" placeholder="35$"><div class="ferr">اكتب السعر.</div></div>
              <div><label class="l">سعر السحابة سنوياً</label><input class="in" data-k="cloud_price" maxlength="40" placeholder="35$"><div class="ferr">اكتب السعر.</div></div></div>
              <div><label class="l">رقم واتساب (مع رمز الدولة، أرقام فقط)</label><input class="in num" data-k="whatsapp" inputmode="tel" maxlength="20" placeholder="9639xxxxxxxx"><div class="ferr">أرقام فقط، بين 8 و15 رقماً، بلا + ولا مسافات.</div><div class="hint">يظهر زر «اشترِ عبر واتساب» في شاشة التفعيل عند العميل ويُستخدم في رسائل الأكواد.</div></div>
            </div></div>
            <div class="card pad-0"><div class="card-h"><h2>التجربة وأيام السماح</h2></div><div class="card-b stack">
              <div class="grid2"><div><label class="l">أيام التجربة المجانية</label><input class="in num" data-k="trial_days" type="number" min="0" max="365" inputmode="numeric"><div class="ferr">بين 0 و365 (0 يوقف التجربة).</div></div>
              <div><label class="l">أيام السماح بلا إنترنت</label><input class="in num" data-k="grace_days" type="number" min="1" max="365" inputmode="numeric"><div class="ferr">بين 1 و365.</div></div></div>
              <div class="hint">يتحقق التطبيق كل ست ساعات عند توفر الإنترنت. إن بقي بلا تحقق أكثر من أيام السماح يتوقف حتى يتصل مرة. لا تجعلها أقل من أسبوع.</div>
              <label class="check"><input type="checkbox" data-k="web_trial"><span>السماح بالتجربة المجانية من المتصفح <span class="faint">(هوية المتصفح سهلة التغيير: لا تفعّلها في العادة)</span></span></label>
            </div></div>
            <div class="card pad-0"><div class="card-h"><h2>حماية التطبيق</h2></div><div class="card-b stack">
              <div><label class="l">أقل إصدار مسموح</label><input class="in num" data-k="min_version" maxlength="20" placeholder="مثال: 1.2.0 — فارغ = لا شرط"><div class="ferr">أرقام ونقاط فقط، مثل 1.2.0.</div><div class="hint">النسخ الأقدم تُطالَب بالتحديث ولا تجتاز التحقق.</div></div>
              <div><label class="l">بصمة توقيع أندرويد (SHA-256)</label><textarea class="in mono" data-k="android_signature" maxlength="2000" placeholder="64 خانة سداسية عشرية، وعدة بصمات بفواصل"></textarea><div class="ferr">كل بصمة 64 خانة سداسية عشرية (0-9 a-f)، افصل بينها بفاصلة.</div><div class="hint">فارغة = لا تحقق. تجد بصمة أي جهاز أندرويد في بطاقته. انظر «الربط» لطريقة استخراجها من ملف التوقيع.</div></div>
            </div></div>
          </div>
          <div class="stack-lg">
            <div class="card pad-0"><div class="card-h"><h2>الخطة السحابية</h2><span class="badge plain" id="cloudAvail"></span></div><div class="card-b stack">
              <div class="grid2"><div><label class="l">مدة الاشتراك (أيام)</label><input class="in num" data-k="cloud_days" type="number" min="1" max="3650" inputmode="numeric"><div class="ferr">بين 1 و3650.</div></div>
              <div><label class="l">النسخ المحفوظة لكل كود</label><input class="in num" data-k="cloud_keep" type="number" min="1" max="10" inputmode="numeric"><div class="ferr">بين 1 و10.</div></div></div>
              <div class="hint">يرفع التطبيق نسخة مضغوطة يومياً (20 م.ب كحد أقصى) ويحتفظ الخادم بآخر نسخ بهذا العدد.</div>
            </div></div>
            <div class="card pad-0"><div class="card-h"><h2>رسالة للعملاء</h2></div><div class="card-b">
              <textarea class="in" data-k="message" maxlength="400" placeholder="تظهر في شاشة التفعيل. مثال: للشراء أو الدعم راسلنا على واتساب من 9 صباحاً حتى 9 مساءً."></textarea><div class="hint" id="msgCount"></div>
            </div></div>
            <div class="card pad-0"><div class="card-h"><h2>الربط (للمطوّر)</h2></div><div class="card-b stack" id="integ"></div></div>
          </div>
        </div>
        <div style="height:72px"></div>
        <div class="savebar hidden" id="saveBar"><span class="sb" id="saveMsg">لديك تغييرات غير محفوظة</span><div class="row"><button class="btn ghost sm" id="sDiscard" type="button">تراجع</button><button class="btn primary sm" id="sSave" type="button">حفظ الإعدادات</button></div></div>
      </section>
    </main>
  </div>
  <nav class="nav" id="nav"></nav>
</div>
<div id="sheetHost"></div><div id="askHost"></div><div class="toasts" id="toasts"></div><div id="tip"></div>
<div id="printArea" class="print-only"></div>
`
