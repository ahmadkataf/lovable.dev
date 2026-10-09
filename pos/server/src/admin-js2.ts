// The control panel's JavaScript, part 2 (see admin-js.ts): the codes, devices, cloud, log and settings views,
// their sheets, and the boot sequence. No backticks and no "${" anywhere in here.
export const ADMIN_JS2 = String.raw`
// ---- codes
const CQ = { q: '', status: '', plan: '', cloud: '', from: '', to: '', sort: 'created', dir: 'desc', page: 1, limit: 50 }
const CODE_CHIPS = [['', 'الكل'], ['active', 'مفعّل'], ['unused', 'غير مستخدم'], ['expired', 'منتهٍ'], ['revoked', 'ملغى']]
$('cq').oninput = debounce(() => { CQ.q = $('cq').value.trim(); CQ.page = 1; $('cqClr').classList.toggle('hidden', !CQ.q); loadCodes() }, 300)
$('cqClr').onclick = () => { $('cq').value = ''; CQ.q = ''; CQ.page = 1; $('cqClr').classList.add('hidden'); loadCodes() }
$('cSort').onchange = () => { const [s, d] = $('cSort').value.split(':'); CQ.sort = s; CQ.dir = d; CQ.page = 1; loadCodes() }
$('cFilter').onclick = codeFilters
async function codeFilters() {
  const f = await dialog('تصفية الأكواد', '<div><label class="l">الخطة</label><select class="in" name="plan"><option value="">الكل</option><option value="lifetime">دائم</option><option value="subscription">اشتراك</option></select></div>'
    + '<div><label class="l">السحابة</label><select class="in" name="cloud"><option value="">الكل</option><option value="active">فعّالة</option><option value="expired">منتهية</option><option value="none">بلا سحابة</option></select></div>'
    + '<div class="grid2"><div><label class="l">أُنشئ من</label><input class="in" type="date" name="from"></div><div><label class="l">إلى</label><input class="in" type="date" name="to"></div></div>', { ok: 'تطبيق' })
  if (!f) return
  CQ.plan = f.plan.value; CQ.cloud = f.cloud.value; CQ.from = dateMs(f.from.value); CQ.to = dateMs(f.to.value, true); CQ.page = 1; loadCodes()
}
function activeFilters() {
  const tags = []
  if (CQ.plan) tags.push(['plan', CQ.plan === 'lifetime' ? 'دائم' : 'اشتراك'])
  if (CQ.cloud) tags.push(['cloud', 'السحابة: ' + (CQ.cloud === 'active' ? 'فعّالة' : CQ.cloud === 'expired' ? 'منتهية' : 'بلا')])
  if (CQ.from || CQ.to) tags.push(['date', 'من ' + (CQ.from ? fmt(+CQ.from) : '…') + ' إلى ' + (CQ.to ? fmt(+CQ.to) : '…')])
  $('cActive').innerHTML = tags.map(t => '<button class="chip on" data-k="' + t[0] + '" type="button">' + esc(t[1]) + I('x', 12) + '</button>').join('')
  $('cActive').querySelectorAll('[data-k]').forEach(b => b.onclick = () => { if (b.dataset.k === 'date') CQ.from = CQ.to = ''; else CQ[b.dataset.k] = ''; CQ.page = 1; loadCodes() })
  $('cFilter').classList.toggle('soft', tags.length > 0)
}
async function loadCodes() {
  loaded.codes = true
  chips($('cChips'), CODE_CHIPS, CQ.status, v => { CQ.status = v; CQ.page = 1; loadCodes() })
  activeFilters(); $('cSort').value = CQ.sort + ':' + CQ.dir; $('cq').value = CQ.q; $('cqClr').classList.toggle('hidden', !CQ.q)
  $('cList').innerHTML = skel(6); $('cMeta').textContent = ''
  let d
  try { d = await get('codes', CQ) } catch (e) { $('cList').innerHTML = empty('alert', 'تعذّر التحميل', e.message); return }
  if (d.page !== CQ.page) return
  $('cMeta').textContent = d.total ? N(d.total) + ' كود' : ''
  if (!d.codes.length) { $('cList').innerHTML = CQ.q || CQ.status || CQ.plan || CQ.cloud || CQ.from ? empty('search', 'لا نتائج', 'جرّب كلمة أخرى أو أزل التصفية.') : empty('key', 'لا أكواد بعد', 'أنشئ أول دفعة أكواد لتبيعها لعملائك.', '<button class="btn primary" onclick="generateSheet()">إنشاء أكواد</button>'); $('cPager').innerHTML = ''; return }
  const th = (k, t, cls) => '<th class="' + (cls || '') + (k ? ' sort' + (CQ.sort === k ? ' on' : '') : '') + '" ' + (k ? 'data-s="' + k + '"' : '') + '>' + t + '</th>'
  $('cList').innerHTML = '<table class="tbl"><thead><tr>' + th('code', 'الكود') + th('', 'الحالة') + th('note', 'الملاحظة / البائع') + th('devices', 'الأجهزة', 'end') + th('created', 'أُنشئ') + th('expires', 'ينتهي') + th('cloud', 'السحابة') + '</tr></thead><tbody>'
    + d.codes.map(c => { const [cls, st] = codeStatus(c); return '<tr class="r" data-code="' + esc(c.code) + '"><td class="p"><span class="mono sb">' + esc(c.code) + '</span></td><td class="st">' + badge(cls, st) + '</td>'
      + '<td class="m" data-l="">' + (c.note || c.seller ? '<span class="truncate" style="max-width:260px">' + esc(c.note) + (c.seller ? ' <span class="faint">· ' + esc(c.seller) + '</span>' : '') + '</span>' : '<span class="faint">—</span>') + '</td>'
      + '<td class="m end num" data-l="الأجهزة">' + c.devices + '/' + c.max_devices + (c.last_seen ? '<span class="sub">آخر ظهور ' + rel(c.last_seen) + '</span>' : '') + '</td>'
      + '<td class="m x" data-l="أُنشئ">' + fmt(c.created_at) + '</td><td class="m" data-l="ينتهي">' + (c.expires_at ? '<span class="' + (daysLeft(c.expires_at) <= 30 && daysLeft(c.expires_at) > 0 ? 'tag warn' : '') + '">' + fmt(c.expires_at) + '</span>' : '<span class="faint">دائم</span>') + '</td>'
      + '<td class="m" data-l="السحابة">' + (c.cloud_until ? (c.cloud_until > Date.now() ? '<span class="tag ' + (daysLeft(c.cloud_until) <= 30 ? 'warn' : 'ok') + '">' + I('cloud') + inDays(c.cloud_until) + '</span>' : '<span class="tag">' + I('cloud') + 'منتهية</span>') : '<span class="faint">—</span>') + '</td></tr>' }).join('') + '</tbody></table>'
  $('cList').querySelectorAll('tr.r').forEach(tr => tr.onclick = () => openCode(tr.dataset.code))
  $('cList').querySelectorAll('th.sort').forEach(t => t.onclick = () => { const k = t.dataset.s; CQ.dir = CQ.sort === k && CQ.dir === 'desc' ? 'asc' : 'desc'; CQ.sort = k; CQ.page = 1; loadCodes() })
  pager($('cPager'), d.total, d.page, d.limit, p => { CQ.page = p; loadCodes(); window.scrollTo({ top: 0, behavior: 'smooth' }) })
}

// ---- generate codes
let GEN = { count: 5, plan: 'lifetime', days: 365, maxDevices: 1, cloud: 'none', cloudDays: 365, note: '', seller: '' }
function generateSheet() {
  GEN.cloudDays = GEN.cloudDays || SET.cloud_days || 365
  const stepper = (name, v, min, max) => '<div class="stepper"><button type="button" data-step="-1" data-for="' + name + '">−</button><input name="' + name + '" class="num" type="number" value="' + v + '" min="' + min + '" max="' + max + '" inputmode="numeric"><button type="button" data-step="1" data-for="' + name + '">+</button></div>'
  const s = openSheet('إنشاء أكواد', '<form id="genForm" class="stack">'
    + '<div class="grid2"><div><label class="l">عدد الأكواد (1–200)</label>' + stepper('count', GEN.count, 1, 200) + '</div><div><label class="l">الأجهزة لكل كود (1–5)</label>' + stepper('maxDevices', GEN.maxDevices, 1, 5) + '</div></div>'
    + '<div><label class="l">الخطة</label><div class="seg" data-seg="plan"><button type="button" data-v="lifetime">ترخيص دائم</button><button type="button" data-v="subscription">اشتراك بمدة</button></div><div id="genDays" class="mt-s hidden"><label class="l">مدة الاشتراك بالأيام</label><div class="row"><input class="in num grow" name="days" type="number" min="1" max="3650" value="' + GEN.days + '" inputmode="numeric"><button class="btn sm" type="button" data-days="30">شهر</button><button class="btn sm" type="button" data-days="180">6 أشهر</button><button class="btn sm" type="button" data-days="365">سنة</button></div></div></div>'
    + '<div><label class="l">التخزين السحابي</label><div class="seg" data-seg="cloud"><button type="button" data-v="none">بدون</button><button type="button" data-v="year">' + (SET.cloud_days === 365 ? 'سنة' : SET.cloud_days + ' يوماً') + ' (' + esc(SET.cloud_price) + ')</button><button type="button" data-v="custom">مدة أخرى</button></div><div id="genCloud" class="mt-s hidden"><input class="in num" name="cloudDays" type="number" min="1" max="3650" value="' + GEN.cloudDays + '" placeholder="أيام السحابة" inputmode="numeric"></div></div>'
    + '<div class="grid2"><div><label class="l">ملاحظة (العميل، المحل…)</label><input class="in" name="note" maxlength="200" value="' + esc(GEN.note) + '" placeholder="اختياري"></div><div><label class="l">البائع</label><input class="in" name="seller" maxlength="80" value="' + esc(GEN.seller) + '" placeholder="اختياري"></div></div>'
    + '<div class="err" id="genErr"></div></form>', { foot: '<button class="btn" type="button" data-close2>إلغاء</button><button class="btn primary" type="submit" form="genForm" id="genGo">' + I('plus', 16) + 'إنشاء</button>' })
  const form = s.querySelector('#genForm')
  s.querySelector('[data-close2]').onclick = closeSheet
  const seg = (name, v) => { s.querySelectorAll('[data-seg=' + name + '] button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); GEN[name] = v; s.querySelector('#genDays').classList.toggle('hidden', GEN.plan !== 'subscription'); s.querySelector('#genCloud').classList.toggle('hidden', GEN.cloud !== 'custom') }
  s.querySelectorAll('[data-seg] button').forEach(b => b.onclick = () => seg(b.closest('[data-seg]').dataset.seg, b.dataset.v))
  seg('plan', GEN.plan); seg('cloud', GEN.cloud)
  s.querySelectorAll('[data-step]').forEach(b => b.onclick = () => { const i = form[b.dataset.for]; i.value = Math.max(+i.min, Math.min(+i.max, (+i.value || 0) + +b.dataset.step)) })
  s.querySelectorAll('[data-days]').forEach(b => b.onclick = () => { form.days.value = b.dataset.days })
  form.onsubmit = e => {
    e.preventDefault()
    const count = +form.count.value, maxDevices = +form.maxDevices.value, days = +form.days.value, cloudDays = GEN.cloud === 'none' ? 0 : GEN.cloud === 'year' ? (SET.cloud_days || 365) : +form.cloudDays.value
    const err = s.querySelector('#genErr')
    if (!ynum(count, 1, 200)) return err.textContent = 'عدد الأكواد بين 1 و200.'
    if (!ynum(maxDevices, 1, 5)) return err.textContent = 'عدد الأجهزة بين 1 و5.'
    if (GEN.plan === 'subscription' && !ynum(days, 1, 3650)) return err.textContent = 'مدة الاشتراك بين 1 و3650 يوماً.'
    if (GEN.cloud === 'custom' && !ynum(cloudDays, 1, 3650)) return err.textContent = 'مدة السحابة بين 1 و3650 يوماً.'
    GEN = Object.assign(GEN, { count, maxDevices, days, note: form.note.value.trim(), seller: form.seller.value.trim(), cloudDays: GEN.cloud === 'custom' ? cloudDays : GEN.cloudDays })
    busy(s.querySelector('#genGo'), async () => {
      const r = await post('codes', { count, maxDevices, plan: GEN.plan, days: GEN.plan === 'subscription' ? days : 0, cloudDays, note: GEN.note, seller: GEN.seller })
      closeSheet(); loaded.codes = false; if (VIEW === 'codes') loadCodes()
      resultsSheet(r)
    })
  }
}
function resultsSheet(r) {
  const s = openSheet('', '<div class="row" style="margin-bottom:12px"><span class="badge ok">' + devicesWord(r.maxDevices) + ' لكل كود</span><span class="badge plain">' + (r.expiresAt ? 'اشتراك حتى ' + fmt(r.expiresAt) : 'ترخيص دائم') + '</span>' + (r.cloudUntil ? '<span class="badge info">سحابة حتى ' + fmt(r.cloudUntil) + '</span>' : '') + '</div>'
    + '<div class="codes-out">' + r.codes.map(c => '<div class="c">' + esc(c) + '</div>').join('') + '</div>'
    + '<div class="acts mt">' + act('copy', 'نسخ الكل', 'all') + act('msg', 'رسالة واتساب', 'wa') + act('print', 'طباعة بطاقات', 'print') + act('download', 'تنزيل CSV', 'csv') + '</div>'
    + '<div class="hint">احتفظ بالأكواد في مكان آمن: كل كود يُباع مرة واحدة، وتجده هنا دائماً في تبويب الأكواد.</div>',
    { head: '<h2>' + I('check', 20) + ' تم إنشاء ' + r.codes.length + ' كود</h2>' })
  s.querySelector('[data-a=all]').onclick = () => copy(r.codes.join('\n'))
  s.querySelector('[data-a=wa]').onclick = () => copy(r.codes.length === 1 ? customerMsg(r.codes[0], r.expiresAt, r.maxDevices, r.cloudUntil) : whatsappBatch(r.codes))
  s.querySelector('[data-a=print]').onclick = () => printCards(r.codes, r.expiresAt, r.maxDevices)
  s.querySelector('[data-a=csv]').onclick = () => download('kaseb-codes-' + isoDate(Date.now()) + '.csv', codesCsv(r.codes, r.expiresAt, r.maxDevices, r.cloudUntil, r.note, r.seller), 'text/csv')
}

// ---- code sheet
async function openCode(code) {
  const s = openSheet(code, skel(4), { wide: true, head: '<h2 class="mono">' + esc(code) + '</h2>' })
  let d
  try { d = await get('codes/' + encodeURIComponent(String(code).replace(/[^0-9A-Za-z]/g, ''))) } catch (e) { s.querySelector('.sb').innerHTML = empty('alert', 'تعذّر فتح الكود', e.message); return }
  renderCode(s, d)
}
function renderCode(s, d) {
  const c = d.code, [cls, st] = codeStatus(Object.assign({ devices: d.devices.length }, c)), now = d.now
  const firstBind = d.devices.length ? Math.min(...d.devices.map(x => x.bound_at || now)) : null
  const cloudOn = c.cloud_until && c.cloud_until > now
  const tl = []
  tl.push(['done', 'أُنشئ', fmtT(c.created_at) + (c.seller ? ' · ' + esc(c.seller) : '')])
  tl.push([firstBind ? 'done' : '', firstBind ? 'فُعّل على ' + devicesWord(d.devices.length) : 'لم يُفعّل بعد', firstBind ? fmtT(firstBind) : 'بانتظار أن يُدخله العميل'])
  if (c.cloud_until) tl.push([cloudOn ? 'done' : 'warn', cloudOn ? 'السحابة فعّالة' : 'السحابة منتهية', (cloudOn ? 'حتى ' : 'انتهت ') + fmt(c.cloud_until) + (cloudOn ? ' · ' + inDays(c.cloud_until) : '')])
  if (c.expires_at) tl.push([c.expires_at > now ? '' : 'warn', c.expires_at > now ? 'ينتهي الاشتراك' : 'انتهى الاشتراك', fmt(c.expires_at) + ' · ' + inDays(c.expires_at)])
  else tl.push(['done', 'ترخيص دائم', 'لا تاريخ انتهاء'])
  if (c.revoked) tl.push(['bad', 'ملغى', 'التطبيق يتوقف عند أول تحقق'])
  s.querySelector('.sh').innerHTML = '<h2 class="mono">' + esc(c.code) + '</h2>' + badge(cls, st) + '<button class="btn ghost icon sm" type="button" data-copy aria-label="نسخ">' + I('copy', 18) + '</button><button class="btn ghost icon sm" type="button" data-close aria-label="إغلاق">' + I('x', 18) + '</button>'
  s.querySelector('[data-close]').onclick = closeSheet; s.querySelector('[data-copy]').onclick = () => copy(c.code)
  s.querySelector('.sb').innerHTML = '<div class="split">'
    + '<div class="stack"><div class="tl">' + tl.map(t => '<div class="s ' + t[0] + '"><div class="t">' + t[1] + '</div><div class="d">' + t[2] + '</div></div>').join('') + '</div>'
    + '<dl class="kv"><dt>الخطة</dt><dd>' + (c.expires_at ? 'اشتراك حتى ' + fmt(c.expires_at) : 'دائم') + '</dd><dt>الأجهزة</dt><dd>' + d.devices.length + ' من ' + c.max_devices + ' · نقل ذاتي ' + c.moves + '/3</dd><dt>الملاحظة</dt><dd>' + (c.note ? esc(c.note) : '<span class="faint">—</span>') + '</dd><dt>البائع</dt><dd>' + (c.seller ? esc(c.seller) : '<span class="faint">—</span>') + '</dd>'
    + (c.cloud_until ? '<dt>النسخ السحابية</dt><dd>' + (d.backups.length ? d.backups.length + ' نسخة · آخرها ' + rel(d.backups[0].at) + ' · ' + kb(d.backups.reduce((a, b) => a + b.size, 0)) : 'لا نسخ بعد') + '</dd>' : '') + '</dl></div>'
    + '<div class="stack"><h3>الأجهزة المرتبطة</h3>' + (d.devices.length ? d.devices.map(x => { const [dc, ds] = deviceState(x); return '<div class="row spread" style="padding:8px 0;border-bottom:1px solid var(--border)"><div class="row grow" style="gap:10px;cursor:pointer" data-dev="' + esc(x.device_code) + '">' + platIcon(x.platform) + '<div class="grow"><div class="row" style="gap:6px;flex-wrap:nowrap"><span class="sb truncate" dir="auto">' + (esc(x.name) || platName(x.platform)) + '</span><span class="mono faint nowrap">' + esc(x.device_code) + '</span></div><div class="faint">' + platName(x.platform) + ' ' + esc(x.version) + ' · ' + rel(x.last_seen) + '</div></div>' + badge(dc, ds) + '</div><button class="btn sm outline" type="button" data-release="' + esc(x.device) + '">تحرير</button></div>' }).join('') : '<div class="faint">لا أجهزة مرتبطة: الكود حر ويمكن إدخاله على ' + devicesWord(c.max_devices) + '.</div>') + '</div></div>'
    + '<h3 class="mt">إجراءات</h3><div class="acts mt-s">' + act('msg', 'رسالة للعميل', 'msg') + act('print', 'طباعة بطاقة', 'print') + act('edit', 'تعديل البيانات', 'edit')
    + act('cal', c.expires_at ? 'تمديد الانتهاء' : 'تحويل إلى اشتراك', 'extend') + act('cloud', cloudOn ? 'تمديد السحابة' : 'تفعيل السحابة', 'cloud', cloudOn ? '' : 'brand') + (c.cloud_until ? act('ban', 'إيقاف السحابة', 'cloudStop') : '')
    + (d.backups.length ? act('trash', 'حذف النسخ السحابية', 'bdel', 'danger') : '') + (c.revoked ? act('refresh', 'إعادة الكود', 'unrevoke', 'brand') : act('ban', 'إلغاء الكود', 'revoke', 'danger')) + '</div>'
    + '<h3 class="mt">السجل</h3><div id="codeEv" class="mt-s">' + (d.events.length ? d.events.map(e => eventHtml(e, { noCode: true })).join('') : '<div class="faint">لا أحداث بعد.</div>') + '</div>'
  wireLinks(s)
  const refresh = async () => { const nd = await get('codes/' + c.code.replace(/-/g, '')); renderCode(s, nd); loaded.codes = false; if (VIEW === 'codes') loadCodes() }
  const run = async (fn) => { try { await fn(); await refresh() } catch (e) { toast(e.message, 'bad') } }
  s.querySelectorAll('[data-release]').forEach(b => b.onclick = async () => { if (await ask('تحرير الجهاز من الكود؟', 'يتوقف التطبيق على هذا الجهاز عند أول تحقق، ويصبح الكود قابلاً للإدخال على جهاز آخر.', { ok: 'تحرير', danger: true })) run(async () => { await post('devices/' + b.dataset.release + '/release'); toast('تم تحرير الجهاز', 'ok') }) })
  const on = (a, fn) => { const b = s.querySelector('[data-a=' + a + ']'); if (b) b.onclick = fn }
  on('msg', () => copy(customerMsg(c.code, c.expires_at, c.max_devices, cloudOn ? c.cloud_until : null)))
  on('print', () => printCards([c.code], c.expires_at, c.max_devices))
  on('edit', async () => {
    const f = await dialog('تعديل بيانات الكود', '<div><label class="l">الملاحظة</label><input class="in" name="note" maxlength="200" value="' + esc(c.note) + '"></div><div><label class="l">البائع</label><input class="in" name="seller" maxlength="80" value="' + esc(c.seller) + '"></div><div><label class="l">عدد الأجهزة المسموح (1–5)</label><input class="in num" name="max" type="number" min="1" max="5" value="' + c.max_devices + '"></div>', { validate: fm => ynum(+fm.max.value, 1, 5) ? '' : 'عدد الأجهزة بين 1 و5.' })
    if (f) run(async () => { await post('codes/' + c.code + '/note', { note: f.note.value, seller: f.seller.value, maxDevices: +f.max.value }); toast('تم الحفظ', 'ok') })
  })
  on('extend', async () => {
    const f = await dialog('تاريخ انتهاء الترخيص', '<div class="seg" data-m><button type="button" data-v="add" class="on">إضافة أيام</button><button type="button" data-v="date">تاريخ محدد</button><button type="button" data-v="life">جعله دائماً</button></div>'
      + '<div data-p="add"><label class="l">الأيام المضافة ' + (c.expires_at && c.expires_at > now ? '(من ' + fmt(c.expires_at) + ')' : '(من اليوم)') + '</label><div class="row"><input class="in num grow" name="days" type="number" min="1" max="3650" value="365"><button class="btn sm" type="button" data-d="30">شهر</button><button class="btn sm" type="button" data-d="365">سنة</button></div></div>'
      + '<div data-p="date" class="hidden"><label class="l">ينتهي في</label><input class="in" name="date" type="date" value="' + (c.expires_at ? isoDate(c.expires_at) : '') + '"></div><div data-p="life" class="hidden muted">يصبح الكود ترخيصاً دائماً بلا تاريخ انتهاء.</div><input type="hidden" name="mode" value="add">',
      { ok: 'تطبيق', validate: fm => fm.mode.value === 'add' && !ynum(+fm.days.value, 1, 3650) ? 'الأيام بين 1 و3650.' : fm.mode.value === 'date' && !dateMs(fm.date.value) ? 'اختر تاريخاً.' : '' })
    if (f) run(async () => { const m = f.mode.value; await post('codes/' + c.code + '/extend', m === 'add' ? { addDays: +f.days.value } : m === 'date' ? { expiresAt: +dateMs(f.date.value, true) } : { expiresAt: null }); toast('تم التحديث', 'ok') })
  })
  on('cloud', async () => {
    const f = await dialog(cloudOn ? 'تمديد السحابة' : 'تفعيل السحابة', '<div class="muted">' + (cloudOn ? 'الاشتراك الحالي حتى ' + fmt(c.cloud_until) + '؛ تُضاف المدة بعده.' : 'يبدأ الاشتراك من اليوم. يعرف التطبيق به عند أول تحقق (خلال ساعات) أو فوراً عند ضغط «تحقّق الآن».') + '</div><div><label class="l">المدة بالأيام</label><div class="row"><input class="in num grow" name="days" type="number" min="1" max="3650" value="' + (SET.cloud_days || 365) + '"><button class="btn sm" type="button" data-d="30">شهر</button><button class="btn sm" type="button" data-d="365">سنة</button></div></div><div class="hint">السعر المعلن: ' + esc(SET.cloud_price) + ' سنوياً.</div>', { ok: cloudOn ? 'تمديد' : 'تفعيل', validate: fm => ynum(+fm.days.value, 1, 3650) ? '' : 'الأيام بين 1 و3650.' })
    if (f) run(async () => { await post('codes/' + c.code + '/cloud', { addDays: +f.days.value }); toast('تم تحديث السحابة', 'ok') })
  })
  on('cloudStop', async () => { if (await ask('إيقاف السحابة؟', 'يتوقف النسخ التلقائي. تبقى النسخ المحفوظة قابلة للاستعادة حتى تحذفها.', { ok: 'إيقاف', danger: true })) run(async () => { await post('codes/' + c.code + '/cloud', { until: null }); toast('أوقفت السحابة', 'ok') }) })
  on('bdel', async () => { if (await ask('حذف كل النسخ السحابية لهذا الكود؟', 'لا يمكن التراجع. العميل لن يستطيع استعادتها.', { ok: 'حذف', danger: true })) run(async () => { await post('codes/' + c.code + '/backups-delete'); toast('حُذفت النسخ', 'ok') }) })
  on('revoke', async () => { if (await ask('إلغاء الكود؟', 'يتوقف التطبيق عند العميل عند أول تحقق. يمكنك إعادته لاحقاً.', { ok: 'إلغاء الكود', danger: true })) run(async () => { await post('codes/' + c.code + '/revoke'); toast('أُلغي الكود', 'ok') }) })
  on('unrevoke', () => run(async () => { await post('codes/' + c.code + '/unrevoke'); toast('أُعيد الكود', 'ok') }))
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const i = b.closest('form').days; i.value = b.dataset.d })
}

// ---- devices
const DQ = { q: '', state: '', platform: '', sort: 'last_seen', dir: 'desc', page: 1, limit: 50 }
const DEV_CHIPS = [['', 'الكل'], ['licensed', 'مرخّص'], ['trial', 'تجربة'], ['expired', 'تجربة منتهية'], ['free', 'بلا ترخيص'], ['blocked', 'موقوف']]
$('dq').oninput = debounce(() => { DQ.q = $('dq').value.trim(); DQ.page = 1; $('dqClr').classList.toggle('hidden', !DQ.q); loadDevices() }, 300)
$('dqClr').onclick = () => { $('dq').value = ''; DQ.q = ''; DQ.page = 1; $('dqClr').classList.add('hidden'); loadDevices() }
$('dPlat').onchange = () => { DQ.platform = $('dPlat').value; DQ.page = 1; loadDevices() }
function devStateHtml(d) {
  const [cls, st] = deviceState(d)
  return badge(cls, st) + (d.code ? ' <span class="mono faint">' + esc(d.code) + '</span>' : '')
}
async function loadDevices() {
  loaded.devices = true
  chips($('dChips'), DEV_CHIPS, DQ.state, v => { DQ.state = v; DQ.page = 1; loadDevices() })
  $('dPlat').value = DQ.platform; $('dq').value = DQ.q
  $('dList').innerHTML = skel(6); $('dMeta').textContent = ''
  let d
  try { d = await get('devices', DQ) } catch (e) { $('dList').innerHTML = empty('alert', 'تعذّر التحميل', e.message); return }
  if (d.page !== DQ.page) return
  $('dMeta').textContent = d.total ? N(d.total) + ' جهاز' : ''
  if (!d.devices.length) { $('dList').innerHTML = DQ.q || DQ.state || DQ.platform ? empty('search', 'لا نتائج', 'جرّب رمز الجهاز كما يظهر عند العميل (XXXX-XXXX).') : empty('phone', 'لا أجهزة بعد', 'يظهر هنا كل جهاز يفتح شاشة التفعيل ويتصل بالخادم.'); $('dPager').innerHTML = ''; return }
  $('dList').innerHTML = '<table class="tbl"><thead><tr><th>الجهاز</th><th>الحالة</th><th>الكود</th><th>الإصدار</th><th>آخر ظهور</th><th>أول ظهور</th></tr></thead><tbody>'
    + d.devices.map(x => '<tr class="r' + (x.blocked ? ' hl' : '') + '" data-dev="' + esc(x.device) + '"><td class="p"><span class="row" style="gap:8px;flex-wrap:nowrap">' + platIcon(x.platform) + '<span class="truncate sb" dir="auto">' + (esc(x.name) || '<span class="faint">' + platName(x.platform) + '</span>') + '</span><span class="mono faint sub">' + esc(x.device_code) + '</span></span></td>'
      + '<td class="st">' + badge(...deviceState(x)) + '</td><td class="m' + (x.code ? '' : ' x') + '" data-l="الكود">' + (x.code ? '<span class="mono faint">' + esc(x.code) + '</span>' : '<span class="faint">—</span>') + '</td><td class="m" data-l="الإصدار"><span class="num">' + esc(x.version || '—') + '</span>' + (x.build ? ' <span class="faint num">(' + esc(x.build) + ')</span>' : '') + ' <span class="faint">' + platName(x.platform) + '</span></td>'
      + '<td class="m" data-l="آخر ظهور" title="' + esc(fmtT(x.last_seen)) + '">' + rel(x.last_seen) + '</td><td class="m x" data-l="أول ظهور">' + fmt(x.first_seen) + '</td></tr>').join('') + '</tbody></table>'
  $('dList').querySelectorAll('tr.r').forEach(tr => tr.onclick = () => openDevice(tr.dataset.dev))
  pager($('dPager'), d.total, d.page, d.limit, p => { DQ.page = p; loadDevices(); window.scrollTo({ top: 0, behavior: 'smooth' }) })
}
async function openDeviceByShort(short) {
  const v = String(short).replace(/[^0-9A-Za-z]/g, '').toUpperCase()
  try {
    const d = await get('devices', { q: v, limit: 5 })
    const hit = d.devices.find(x => x.device_code.replace(/-/g, '') === v) || (d.devices.length === 1 ? d.devices[0] : null)
    if (!hit) { toast('لا جهاز بهذا الرمز: ' + short, 'bad'); return }
    openDevice(hit.device)
  } catch (e) { toast(e.message, 'bad') }
}
async function openDevice(hash) {
  const s = openSheet('الجهاز', skel(4), { wide: true })
  let d
  try { d = await get('devices/' + hash) } catch (e) { s.querySelector('.sb').innerHTML = empty('alert', 'تعذّر فتح الجهاز', e.message); return }
  renderDevice(s, d)
}
function renderDevice(s, d) {
  const x = d.device, c = d.code, now = d.now
  const full = Object.assign({ code_revoked: c ? c.revoked : null, code_expires: c ? c.expires_at : null }, x)
  s.querySelector('.sh').innerHTML = '<span class="ic" style="width:36px;height:36px;border-radius:10px;background:var(--surface-3)">' + platIcon(x.platform) + '</span><h2 class="truncate">' + (esc(x.name) || platName(x.platform)) + '</h2>' + devStateHtml(full) + '<button class="btn ghost icon sm" type="button" data-close aria-label="إغلاق">' + I('x', 18) + '</button>'
  s.querySelector('[data-close]').onclick = closeSheet
  const trial = x.trial_started ? (x.trial_ends > now ? 'جارية · تنتهي ' + fmt(x.trial_ends) + ' (' + inDays(x.trial_ends) + ')' : 'انتهت ' + fmt(x.trial_ends)) : 'لم يجرّب'
  s.querySelector('.sb').innerHTML = '<div class="split">'
    + '<dl class="kv"><dt>رمز الجهاز</dt><dd><span class="mono sb" style="font-size:16px">' + esc(x.device_code) + '</span> <button class="btn ghost icon sm" type="button" data-copy="' + esc(x.device_code) + '" aria-label="نسخ">' + I('copy', 16) + '</button></dd><dt>المنصة</dt><dd>' + platName(x.platform) + ' · الإصدار <span class="num">' + esc(x.version || '—') + '</span>' + (x.build ? ' (<span class="num">' + esc(x.build) + '</span>)' : '') + '</dd>'
    + '<dt>الكود</dt><dd>' + (c ? '<span class="lnk mono sb" data-code="' + esc(c.code) + '" style="cursor:pointer;color:var(--brand-ink)">' + esc(c.code) + '</span><div class="faint">' + (c.note ? esc(c.note) + ' · ' : '') + 'منذ ' + fmt(x.bound_at) + '</div>' : '<span class="faint">لا كود مرتبط</span>') + '</dd>'
    + '<dt>التجربة</dt><dd>' + trial + '</dd><dt>أول ظهور</dt><dd>' + fmtT(x.first_seen) + '</dd><dt>آخر ظهور</dt><dd>' + fmtT(x.last_seen) + ' <span class="faint">(' + rel(x.last_seen) + ')</span></dd>'
    + (x.platform === 'android' ? '<dt>بصمة التوقيع</dt><dd>' + (x.sig ? '<div class="copybox"><code>' + esc(x.sig) + '</code><button class="btn ghost icon sm" type="button" data-copy="' + esc(x.sig) + '" aria-label="نسخ">' + I('copy', 16) + '</button></div>' : '<span class="faint">لم تُرسل</span>') + '</dd>' : '')
    + (x.blocked ? '<dt>الحالة</dt><dd><span class="badge bad">موقوف: يُرفض التفعيل والتحقق من هذا الجهاز</span></dd>' : '') + '</dl>'
    + '<div><h3>إجراءات</h3><div class="acts mt-s">' + (c ? act('move', 'تحرير من الكود', 'release') : '') + act('gift', c ? 'ربط بكود آخر' : 'منح كود', 'grant', 'brand') + act('plus', 'كود جديد لهذا الجهاز', 'newcode') + (x.blocked ? act('refresh', 'إعادة تشغيل الجهاز', 'unblock', 'brand') : act('ban', 'إيقاف الجهاز', 'block', 'danger')) + '</div>'
    + '<div class="hint">«منح كود» يربط كوداً غير مستخدم بهذا الجهاز فيتحول التطبيق من التجربة إلى الترخيص عند أول تحقق؛ أرسل الكود للعميل ليحتفظ به.</div></div></div>'
    + '<h3 class="mt">السجل</h3><div class="mt-s">' + (d.events.length ? d.events.map(e => eventHtml(e, { noDevice: true })).join('') : '<div class="faint">لا أحداث بعد.</div>') + '</div>'
  wireLinks(s)
  s.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copy(b.dataset.copy))
  const refresh = async () => { renderDevice(s, await get('devices/' + x.device)); loaded.devices = false; if (VIEW === 'devices') loadDevices() }
  const run = async fn => { try { await fn(); await refresh() } catch (e) { toast(e.message, 'bad') } }
  const on = (a, fn) => { const b = s.querySelector('[data-a=' + a + ']'); if (b) b.onclick = fn }
  on('release', async () => { if (await ask('تحرير الجهاز من الكود؟', 'يتوقف التطبيق على هذا الجهاز عند أول تحقق، ويصبح الكود قابلاً للإدخال على جهاز آخر.', { ok: 'تحرير', danger: true })) run(async () => { await post('devices/' + x.device + '/release'); toast('تم التحرير', 'ok') }) })
  on('grant', () => pickCode(async code => run(async () => { await post('devices/' + x.device + '/grant', { code }); toast('رُبط الكود ' + code, 'ok') })))
  on('newcode', async () => {
    const f = await dialog('كود جديد لهذا الجهاز', '<div class="muted">يُنشأ كود واحد مربوط بهذا الجهاز فوراً.</div><div class="grid2"><div><label class="l">الخطة</label><select class="in" name="plan"><option value="lifetime">دائم</option><option value="subscription">اشتراك سنة</option></select></div><div><label class="l">السحابة</label><select class="in" name="cloud"><option value="0">بدون</option><option value="' + (SET.cloud_days || 365) + '">' + (SET.cloud_days || 365) + ' يوماً</option></select></div></div><div><label class="l">ملاحظة</label><input class="in" name="note" maxlength="200" value="' + esc(x.name) + '"></div>', { ok: 'إنشاء وربط' })
    if (f) run(async () => { const r = await post('codes', { device: x.device, plan: f.plan.value, days: f.plan.value === 'subscription' ? 365 : 0, cloudDays: +f.cloud.value, note: f.note.value }); resultsSheet(r) })
  })
  on('block', async () => { if (await ask('إيقاف هذا الجهاز؟', 'يُرفض التفعيل والتجربة والتحقق منه ويرى العميل رسالة بأن البائع أوقفه. يبقى الكود مرتبطاً به حتى تحرّره.', { ok: 'إيقاف', danger: true })) run(async () => { await post('devices/' + x.device + '/block', { blocked: true }); toast('أُوقف الجهاز', 'ok') }) })
  on('unblock', () => run(async () => { await post('devices/' + x.device + '/block', { blocked: false }); toast('أُعيد تشغيل الجهاز', 'ok') }))
}
function pickCode(onPick) {
  const s = openSheet('اختر كوداً غير مستخدم', '<div class="search"><span class="ic">' + I('search', 16) + '</span><input class="in" id="pkq" placeholder="كود أو ملاحظة" autocomplete="off"></div><div id="pkList" class="mt-s">' + skel(4) + '</div>')
  const load = debounce(async () => {
    const d = await get('codes', { status: 'unused', q: s.querySelector('#pkq').value.trim(), limit: 30 })
    const host = s.querySelector('#pkList')
    host.innerHTML = d.codes.length ? d.codes.map(c => '<button class="act" type="button" data-c="' + esc(c.code) + '" style="width:100%;margin-bottom:6px;min-height:52px">' + I('key') + '<span class="grow"><span class="mono">' + esc(c.code) + '</span>' + (c.note ? '<span class="faint truncate" style="display:block;font-size:12px;font-weight:400">' + esc(c.note) + '</span>' : '') + '</span><span class="tag">' + (c.expires_at ? 'حتى ' + fmt(c.expires_at) : 'دائم') + (c.cloud_until ? ' · سحابة' : '') + '</span></button>').join('') : empty('key', 'لا أكواد غير مستخدمة', 'أنشئ أكواداً جديدة أولاً، أو استخدم «كود جديد لهذا الجهاز».')
    host.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { closeSheet(); onPick(b.dataset.c) })
  }, 200)
  s.querySelector('#pkq').oninput = load; load()
}

// ---- cloud
const CLQ = { q: '', status: 'active', page: 1, limit: 50 }
const CL_CHIPS = [['active', 'فعّالة'], ['expiring', 'تنتهي خلال 30 يوماً'], ['ended', 'منتهية'], ['all', 'الكل']]
$('clq').oninput = debounce(() => { CLQ.q = $('clq').value.trim(); CLQ.page = 1; loadCloud() }, 300)
async function loadCloud() {
  chips($('clChips'), CL_CHIPS, CLQ.status, v => { CLQ.status = v; CLQ.page = 1; loadCloud() })
  $('clList').innerHTML = skel(5); $('clMeta').textContent = ''
  let d
  try { d = await get('cloud', CLQ) } catch (e) { $('clList').innerHTML = empty('alert', 'تعذّر التحميل', e.message); return }
  const s = d.summary
  $('clKpis').innerHTML = kpi('اشتراكات فعّالة', N(s.active), s.available ? 'النسخ تُحفظ في Workers KV' : 'التخزين غير مفعّل على الخادم', s.available ? 'brand' : 'warn', 'cloud')
    + kpi('تنتهي خلال 30 يوماً', N(s.soon), 'فرصة تجديد بسعر ' + SET.cloud_price, s.soon ? 'warn' : '', 'alert') + kpi('منتهية', N(s.ended), 'توقف النسخ التلقائي', '', 'clock') + kpi('المساحة', kb(s.bytes), N(s.backups) + ' نسخة محفوظة', '', 'download')
  $('clMeta').textContent = d.total ? N(d.total) + ' اشتراك' : ''
  if (!d.rows.length) { $('clList').innerHTML = empty('cloud', CLQ.status === 'active' ? 'لا اشتراكات فعّالة' : 'لا شيء هنا', 'فعّل السحابة من بطاقة أي كود، أو اختر «سنة» عند إنشاء الأكواد.'); $('clPager').innerHTML = ''; return }
  $('clList').innerHTML = '<table class="tbl"><thead><tr><th>الكود</th><th>الحالة</th><th>الملاحظة</th><th>ينتهي</th><th>آخر نسخة</th><th class="end">النسخ</th><th></th></tr></thead><tbody>'
    + d.rows.map(r => { const on = r.cloud_until > d.now, dl = daysLeft(r.cloud_until); return '<tr class="r' + (on && dl <= 30 ? ' hl' : '') + '" data-code="' + esc(r.code) + '"><td class="p"><span class="mono sb">' + esc(r.code) + '</span></td><td class="st">' + (on ? badge(dl <= 30 ? 'warn' : 'ok', dl <= 30 ? 'تنتهي ' + inDays(r.cloud_until) : 'فعّالة') : badge('', 'منتهية')) + '</td>'
      + '<td class="m" data-l="">' + (r.note ? '<span class="truncate" style="max-width:220px">' + esc(r.note) + '</span>' : '<span class="faint">—</span>') + '</td><td class="m" data-l="ينتهي">' + fmt(r.cloud_until) + '</td>'
      + '<td class="m" data-l="آخر نسخة">' + (r.last_backup ? rel(r.last_backup) + ' <span class="faint">· ' + kb(r.bytes) + '</span>' : '<span class="faint">لا نسخ بعد</span>') + '</td><td class="m end num" data-l="النسخ">' + r.backups + '</td>'
      + '<td class="act end"><button class="btn sm soft" type="button" data-ext="' + esc(r.code) + '">' + (on ? 'تمديد' : 'تجديد') + ' ' + (SET.cloud_days === 365 ? 'سنة' : SET.cloud_days + ' يوماً') + '</button></td></tr>' }).join('') + '</tbody></table>'
  $('clList').querySelectorAll('tr.r').forEach(tr => tr.onclick = () => openCode(tr.dataset.code))
  $('clList').querySelectorAll('[data-ext]').forEach(b => b.onclick = async e => { e.stopPropagation(); if (await ask('تمديد السحابة للكود ' + b.dataset.ext + '؟', 'تُضاف ' + daysWord(SET.cloud_days || 365) + ' بعد نهاية الاشتراك الحالي (أو من اليوم إن كان منتهياً).', { ok: 'تمديد' })) { try { await post('codes/' + b.dataset.ext.replace(/-/g, '') + '/cloud', { addDays: SET.cloud_days || 365 }); toast('تم التمديد', 'ok'); loadCloud() } catch (e2) { toast(e2.message, 'bad') } } })
  pager($('clPager'), d.total, d.page, d.limit, p => { CLQ.page = p; loadCloud() })
}

// ---- log
const LQ = { page: 1, limit: 50 }
const logParams = () => ({ kind: $('lKind').value, code: $('lCode').value.trim(), device: $('lDevice').value.trim(), from: dateMs($('lFrom').value), to: dateMs($('lTo').value, true), page: LQ.page, limit: LQ.limit })
$('lGo').onclick = () => { LQ.page = 1; loadLog() }
;['lCode', 'lDevice'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') { LQ.page = 1; loadLog() } }))
;['lKind', 'lFrom', 'lTo'].forEach(id => $(id).onchange = () => { LQ.page = 1; loadLog() })
$('lCsv').onclick = () => exportCsv(logParams())
async function exportCsv(params) {
  try {
    toast('جارٍ التحضير…')
    const r = await api('events' + q(Object.assign({}, params, { page: '', limit: '', format: 'csv' })), { raw: true })
    download('kaseb-events-' + isoDate(Date.now()) + '.csv', await r.text(), 'text/csv')
  } catch (e) { toast(e.message, 'bad') }
}
async function loadLog() {
  loaded.log = true
  $('lList').innerHTML = skel(8); $('lMeta').textContent = ''
  let d
  try { d = await get('events', logParams()) } catch (e) { $('lList').innerHTML = empty('alert', 'تعذّر التحميل', e.message); return }
  $('lMeta').textContent = d.total ? N(d.total) + ' حدث' : ''
  if (!d.events.length) { $('lList').innerHTML = empty('list', 'لا أحداث', 'لا شيء يطابق هذه التصفية.'); $('lPager').innerHTML = ''; return }
  $('lList').innerHTML = '<div style="padding:4px 16px">' + d.events.map(e => eventHtml(e)).join('') + '</div>'
  wireLinks($('lList'))
  pager($('lPager'), d.total, d.page, d.limit, p => { LQ.page = p; loadLog(); window.scrollTo({ top: 0, behavior: 'smooth' }) })
}

// ---- settings
const SKEYS = ['price', 'cloud_price', 'whatsapp', 'apk_url', 'win_url', 'trial_days', 'grace_days', 'web_trial', 'min_version', 'android_signature', 'cloud_days', 'cloud_keep', 'message']
const sEl = k => document.querySelector('#v-settings [data-k=' + k + ']')
const VALID = {
  price: v => v.trim() ? '' : 'x', cloud_price: v => v.trim() ? '' : 'x',
  whatsapp: v => v === '' || /^\d{8,15}$/.test(v) ? '' : 'x', trial_days: v => ynum(v, 0, 365) ? '' : 'x', grace_days: v => ynum(v, 1, 365) ? '' : 'x',
  min_version: v => v === '' || /^\d+(\.\d+)*$/.test(v.trim()) ? '' : 'x',
  apk_url: v => v.trim() === '' || /^https:\/\/\S+$/i.test(v.trim()) ? '' : 'x', win_url: v => v.trim() === '' || /^https:\/\/\S+$/i.test(v.trim()) ? '' : 'x',
  android_signature: v => v.trim() === '' || v.split(',').every(s => /^[0-9a-fA-F]{64}$/.test(s.replace(/[\s:]/g, ''))) ? '' : 'x',
  cloud_days: v => ynum(v, 1, 3650) ? '' : 'x', cloud_keep: v => ynum(v, 1, 10) ? '' : 'x',
}
const sVal = k => { const el = sEl(k); return el.type === 'checkbox' ? (el.checked ? 1 : 0) : el.value }
function fillSettings() { SKEYS.forEach(k => { const el = sEl(k); if (el.type === 'checkbox') el.checked = !!SET[k]; else el.value = SET[k] == null ? '' : SET[k]; el.classList.remove('bad') }); dirtyCheck() }
function dirtyCheck() {
  let dirty = false, bad = false
  SKEYS.forEach(k => { const v = sVal(k); if (String(v) !== String(SET[k] == null ? '' : SET[k])) dirty = true; const err = VALID[k] ? VALID[k](String(v)) : ''; sEl(k).classList.toggle('bad', !!err); if (err) bad = true })
  $('saveBar').classList.toggle('hidden', !dirty); $('sSave').disabled = bad; $('saveMsg').textContent = bad ? 'صحّح الحقول المعلّمة بالأحمر' : 'لديك تغييرات غير محفوظة'
  $('msgCount').textContent = sEl('message').value.length + ' / 400'
}
SKEYS.forEach(k => { sEl(k).addEventListener('input', dirtyCheck); sEl(k).addEventListener('change', dirtyCheck) })
$('sDiscard').onclick = fillSettings
$('sSave').onclick = () => busy($('sSave'), async () => {
  const b = {}; SKEYS.forEach(k => { b[k] = sVal(k) })
  SET = await post('settings', b); fillSettings(); toast('حُفظت الإعدادات', 'ok')
})
let PK = ''
async function loadSettings() {
  try { SET = await get('settings') } catch (e) { toast(e.message, 'bad'); return }
  fillSettings()
  $('cloudAvail').textContent = SET.cloudAvailable ? 'التخزين جاهز' : 'التخزين غير مفعّل على الخادم'; $('cloudAvail').className = 'badge ' + (SET.cloudAvailable ? 'ok' : 'warn')
  if (!PK) { try { PK = (await (await fetch('/api/public-key')).json()).publicKey || '' } catch (e) { PK = '' } }
  const origin = location.origin
  $('integ').innerHTML = '<div><label class="l">عنوان الخادم (متغير المستودع KASEB_API)</label><div class="copybox"><code>' + esc(origin) + '</code><button class="btn ghost icon sm" type="button" data-copy="' + esc(origin) + '" aria-label="نسخ">' + I('copy', 16) + '</button></div></div>'
    + '<div><label class="l">المفتاح العام (Ed25519)</label>' + (PK ? '<div class="copybox"><code>' + esc(PK) + '</code><button class="btn ghost icon sm" type="button" data-copy="' + esc(PK) + '" aria-label="نسخ">' + I('copy', 16) + '</button></div><div class="hint">يُبنى التطبيق به؛ لا يقبل تراخيص من خادم آخر.</div>' : '<div class="err">' + I('alert', 14) + ' المفتاح العام غير متاح: السر LICENSE_SECRET غير مضبوط على الخادم.</div>') + '</div>'
    + '<div><label class="l">بصمة توقيع أندرويد (SHA-256)</label><div class="muted" style="margin-bottom:6px">من ملف التوقيع الذي تُبنى به نسخة أندرويد الأصلية:</div><pre class="cmd">keytool -list -v -keystore upload.keystore -alias upload | grep SHA256</pre><div class="hint">انسخ القيمة بعد SHA256: (64 خانة، الفواصل : لا تهم) إلى حقل «بصمة توقيع أندرويد». أو افتح بطاقة أي جهاز أندرويد مثبّت عليه التطبيق الأصلي وانسخ بصمته من هناك.</div></div>'
    + '<div><label class="l">سياسة الخصوصية (لمتجر Google Play)</label><div class="copybox"><code>' + esc(origin + '/privacy') + '</code><button class="btn ghost icon sm" type="button" data-copy="' + esc(origin + '/privacy') + '" aria-label="نسخ">' + I('copy', 16) + '</button></div></div>'
  $('integ').querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copy(b.dataset.copy))
}

// ---- boot
function enterApp() {
  $('login').classList.add('hidden'); $('app').classList.remove('hidden')
  loaded.codes = loaded.devices = loaded.log = false
  const h = location.hash.slice(1)
  if (h.startsWith('code/')) { go('home'); openCode(h.slice(5)) } else if (h.startsWith('device/')) { go('home'); openDeviceByShort(h.slice(7)) } else go(h || 'home')
}
;(async () => {
  if (!KEY) { showLogin(''); return }
  try { SET = await api('settings', { login: true }); enterApp() } catch (e) { if (/غير صحيح/.test(e.message)) logout('انتهت الجلسة أو تغيّر المفتاح. أدخله من جديد.'); else showLogin('تعذّر الاتصال بالخادم: ' + e.message) }
})()
`
