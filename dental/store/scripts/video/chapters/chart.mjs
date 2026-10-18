// Chapter 5, "The dental chart" (server/videos/index.ts, guide topic server/guide/topics/chart.ts).
// Follows the guide's order: the chart at a glance (FDI layout, quick figures and DMFT, legend, dentition buttons),
// recording a finding on a tooth (the panel, current state, condition, surfaces, note, save), quick paint, the chart
// history (badges, restore and delete, one tooth's history), printing (the button and what the sheet holds; the
// Windows print dialog itself is not shown) and one sentence on the phone layout.
// The patient is demo file #19 (مريم يوسف البيطار / Mariam Youssef Bitar), the guide's chart patient: tooth 36 carries a
// crown over a root canal with a superseded caries and abscess in its history; teeth 45, 46 and 47 are healthy, so the
// chapter records caries on 46 and paints a filling on 47 and a crown on 45, as the guide's pictures do.
// before() opens her file (set-up that is not shown); the chapter starts by clicking the Dental chart tab.
const rx = (ar, en) => new RegExp(`^(${ar}|${en})$`)
const L = (lang, ar, en) => (lang === 'ar' ? ar : en)
const panel = page => page.locator('.drawer')
const toolbar = page => page.locator('.ch-toolbar')

export const chapter = {
  slug: 'chart',
  poster: 'layout',   // the scene whose last frame is the poster (the chapter's own page)
  before: async ({ page }) => {
    const id = await page.evaluate(async () => (await window.__dentora.db.patients.toArray()).find(p => p.fileNo === 19)?.id)
    if (!id) throw new Error('demo patient #19 not found')
    await page.goto(`${new URL(page.url()).origin}/index.html#/patients/${id}`)
    await page.locator('.pt-hero').waitFor()
    await page.waitForTimeout(600)
  },
  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل ستتعلم كيف تسجّل التسوس والحشوات والتيجان على مخطط الأسنان، وتعبّئه بالرسم السريع، وتراجع سجله، وتطبعه.',
        en: 'In this chapter you will learn to record caries, fillings and crowns on the dental chart, fill it in with quick paint, review its history, and print it.',
      },
      run: async ({ page, ui }) => { await ui.highlight(page.locator('.pt-hero-titlebar'), 2000) },
    },
    {
      id: 'open-tab',
      say: { ar: 'افتح ملف المريض ثم تبويب «مخطط الأسنان».', en: 'Open the patient’s file, then the Dental chart tab.' },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.pt-tabs').getByRole('tab', { name: rx('مخطط الأسنان', 'Dental chart') }))
        await page.locator('[data-testid="ch-stats"]').waitFor()
        await page.locator('.ch-svg').first().waitFor()
      },
    },
    {
      id: 'stats',
      say: {
        ar: 'فوق المخطط أرقام سريعة: تسوس وحشوات وتيجان ومفقودة وزرعات ومعالجة لبية، ثم «مؤشر DMFT» الذي يجمع الأسنان المسوّسة والمفقودة والمرمّمة.',
        en: 'Quick figures sit above the chart: caries, fillings, crowns, missing, implants and root canals, then the DMFT index, which adds up the decayed, missing and filled teeth.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('[data-testid="ch-stats"]'), { block: 'start' })
        await ui.highlight(page.locator('[data-testid="ch-stats"]'), 2800)
      },
    },
    {
      id: 'layout',
      say: {
        ar: 'تظهر الأسنان بترقيم FDI المعتاد: الفك العلوي في الأعلى، وجهة المريض اليمنى على يسارك كما في المخططات الورقية، مع اسم كل ربع ورقمه.',
        en: 'The teeth are drawn in the usual FDI numbering: upper jaw on top, and the patient’s right on your left as on a paper chart, with each quadrant named and numbered.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.ch-canvas'))
        await ui.moveTo(page.locator('[data-tooth="16"]'))
        await ui.highlight(page.locator('.ch-canvas'), 2800)
      },
    },
    {
      id: 'legend',
      say: { ar: 'تحت المخطط «دليل الحالات» بألوانها، وبجانب كل حالة عدد الأسنان التي تحملها.', en: 'Under the chart, the Legend shows every condition’s colour and how many teeth carry it.' },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.ch-palette'))
        await ui.highlight(page.locator('.ch-palette'), 2200)
      },
    },
    {
      id: 'dentition',
      say: {
        ar: 'اختر نوع الإطباق بالأزرار «دائمة» و«مختلطة» و«لبنية». يقترح دنتورا النوع المناسب لعمر المريض ويضع بجانبه نقطة.',
        en: 'Choose the dentition with Permanent, Mixed and Primary. Dentora suggests the one that suits the patient’s age and marks it with a dot.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.ch-card'), { block: 'start' })
        await ui.moveTo(toolbar(page).getByRole('tab', { name: rx('دائمة', 'Permanent') }))
        await ui.highlight(toolbar(page).locator('.ch-toolbar-group .segmented'), 2200)
      },
    },
    {
      id: 'select',
      say: {
        ar: 'في وضع «تحديد» انقر على أي سن، مثل السن 36، لتفتح لوحته: رسم كبير للسن وأسطحه، وحالته الحالية، ونموذج لتشخيص جديد.',
        en: 'In Select mode, click any tooth, say tooth 36, to open its panel: a large drawing of the tooth and its surfaces, its current state, and a form for a new finding.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('[data-tooth="36"]'))
        await panel(page).waitFor()
        await ui.highlight(panel(page).locator('.ch-hero'), 1800)
      },
    },
    {
      id: 'current',
      say: {
        ar: 'راجع «الحالة الحالية»: كل تشخيص قائم على السن مع أسطحه وتاريخه ومن سجّله. هنا تاج فوق معالجة لبية.',
        en: 'Check the Current state: every finding on the tooth with its surfaces, date and who recorded it. Here, a crown over a root canal.',
      },
      run: async ({ page, ui }) => { await ui.highlight(panel(page).locator('[data-testid="ch-active"]'), 2600) },
    },
    {
      id: 'close-open',
      say: {
        ar: 'أغلق اللوحة بزر الإغلاق في أعلاها. ولنسجّل تشخيصاً على سن سليم: انقر على السن 46.',
        en: 'Close the panel with the close button at its top. Now let us record a finding on a healthy tooth: click tooth 46.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.drawer-header').getByRole('button', { name: rx('إغلاق', 'Close') }))
        await panel(page).waitFor({ state: 'hidden' })
        await ui.click(page.locator('[data-tooth="46"]'))
        await panel(page).waitFor()
      },
    },
    {
      id: 'condition',
      say: {
        ar: 'تحت «تسجيل تشخيص» اختر الحالة: من «على الأسطح» مثل تسوس أو حشوة، أو من «على السن كاملاً» مثل تاج أو مفقود.',
        en: 'Under Record a finding, choose the condition: On surfaces, such as caries or a filling, or Whole tooth, such as a crown or missing.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(panel(page).locator('.ch-form'), { block: 'start' })
        await ui.click(panel(page).locator('.ch-cond[data-cond="caries"]'))
      },
    },
    {
      id: 'surfaces',
      say: {
        ar: 'لحالات الأسطح اختر سطحاً واحداً على الأقل: انقر عليه في رسم السن، أو من أزرار «الأسطح»: هنا طاحن ووحشي.',
        en: 'For a surface condition pick at least one surface: click it on the drawing, or use the Surfaces buttons: here occlusal and distal.',
      },
      run: async ({ page, ui }) => {
        await ui.click(panel(page).locator('.ch-surf-chip', { hasText: /\(O\)/ }))
        await ui.click(panel(page).locator('.ch-surf-chip', { hasText: /\(D\)/ }))
      },
    },
    {
      id: 'note',
      say: { ar: 'اكتب «ملاحظة» إن شئت، مثل «تسوس عميق قريب من اللب».', en: 'Add a Note if you like, such as “deep caries close to the pulp”.' },
      run: async ({ page, ui, lang }) => { await ui.type(panel(page).getByLabel(rx('ملاحظة', 'Note')), L(lang, 'تسوس عميق قريب من اللب', 'Deep caries close to the pulp'), { delay: 55 }) },
    },
    {
      id: 'save',
      say: {
        ar: 'انقر على «حفظ التشخيص». يتلوّن السن في المخطط فوراً، وتبقى اللوحة مفتوحة لتشخيص آخر.',
        en: 'Click Save finding. The tooth changes colour on the chart at once, and the panel stays open for the next finding.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('#ch-save-finding'))
        await panel(page).locator('[data-testid="ch-active"] .ch-record').first().waitFor()
        await ui.highlight(panel(page).locator('[data-testid="ch-active"]'), 1500)
        await ui.highlight(page.locator('[data-tooth="46"]'), 1600)
      },
    },
    {
      id: 'reset-treat',
      say: {
        ar: 'لمسح حالة بعد علاجها اختر «سليم» تحت «إعادة التعيين». وزر «علاج هذا السن» ينقلك إلى تبويب العلاجات ببند جديد لهذا السن.',
        en: 'To clear a condition after treatment, choose Healthy under Reset. And Treat this tooth takes you to the Treatments tab with a new item for this tooth.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(panel(page).locator('.ch-cond[data-cond="healthy"]'))
        await ui.highlight(panel(page).locator('.ch-cond[data-cond="healthy"]'), 1600)
        await ui.moveTo(panel(page).getByRole('button', { name: rx('علاج هذا السن', 'Treat this tooth') }))
        await ui.highlight(panel(page).getByRole('button', { name: rx('علاج هذا السن', 'Treat this tooth') }), 1600)
      },
    },
    {
      id: 'paint',
      say: {
        ar: 'لتعبئة مخطط مريض جديد في دقائق، أغلق اللوحة وانقر على «رسم سريع» أعلى المخطط.',
        en: 'To fill in a new patient’s chart in minutes, close the panel and click Quick paint above the chart.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.drawer-header').getByRole('button', { name: rx('إغلاق', 'Close') }))
        await panel(page).waitFor({ state: 'hidden' })
        await ui.click(toolbar(page).getByRole('tab', { name: rx('رسم سريع', 'Quick paint') }))
        await page.locator('[data-testid="ch-paint-hint"]').waitFor()
      },
    },
    {
      id: 'pick',
      say: {
        ar: 'اختر الحالة من «اختر حالة للرسم» تحت المخطط، هنا «حشوة». ويذكّرك شريط فوق المخطط بالحالة التي ترسم بها الآن.',
        en: 'Choose the condition under Pick a condition to paint, below the chart: here, Filling. A bar above the chart reminds you what you are painting with.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.ch-chip[data-cond="filled"]'))
        await ui.scrollTo(page.locator('[data-testid="ch-paint-hint"]'))
        await ui.highlight(page.locator('[data-testid="ch-paint-hint"]'), 1800)
      },
    },
    {
      id: 'paint-surfaces',
      say: {
        ar: 'انقر على السطح المطلوب: حشوة على السطحين الطاحن والأنسي من السن 47. كل نقرة تُحفظ فوراً، فلا حاجة إلى زر حفظ.',
        en: 'Click the surface you want: a filling on the occlusal and mesial surfaces of tooth 47. Every click is saved at once, so there is no Save button.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('[data-tooth="47"] [data-s="O"]'))
        await ui.click(page.locator('[data-tooth="47"] [data-s="M"]'))
        await ui.highlight(page.locator('[data-tooth="47"]'), 1400)
      },
    },
    {
      id: 'paint-whole',
      say: {
        ar: 'وللحالات الكاملة مثل «تاج» انقر على أي مكان في السن: تاج على السن 45. والنقر مرة ثانية على المكان نفسه يزيل الحالة.',
        en: 'For a whole-tooth condition such as Crown, click anywhere on the tooth: a crown on tooth 45. Clicking the same place again removes it.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.ch-chip[data-cond="crown"]'))
        await ui.click(page.locator('[data-tooth="45"]'))
        await ui.highlight(page.locator('[data-tooth="45"]'), 1400)
      },
    },
    {
      id: 'eraser-done',
      say: {
        ar: 'لتصحيح خطأ اختر «ممحاة (سليم)» وانقر على السطح لتمسحه. ثم انقر على «إنهاء الرسم» لتعود إلى وضع «تحديد».',
        en: 'To fix a mistake choose Eraser (healthy) and click the surface to clear it. Then click Done painting to go back to Select mode.',
      },
      run: async ({ page, ui }) => {
        await ui.moveTo(page.locator('.ch-chip[data-cond="healthy"]'))
        await ui.highlight(page.locator('.ch-chip[data-cond="healthy"]'), 1600)
        await ui.click(page.getByRole('button', { name: rx('إنهاء الرسم', 'Done painting') }))
        await page.locator('[data-testid="ch-paint-hint"]').waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'history',
      say: {
        ar: 'انقر على «السجل» أعلى المخطط. تظهر التشخيصات كلها من الأحدث إلى الأقدم، مجمّعة حسب اليوم، مع الوقت واسم من سجّلها.',
        en: 'Click History above the chart. Every finding is listed newest first, grouped by day, with the time and who recorded it.',
      },
      run: async ({ page, ui }) => {
        await ui.click(toolbar(page).getByRole('button', { name: rx('السجل', 'History') }))
        await page.locator('[data-testid="ch-history"]').waitFor()
        await ui.scrollTo(page.locator('[data-testid="ch-history"]'), { block: 'start' })
        await ui.highlight(page.locator('[data-testid="ch-history"] .ch-day').first(), 1800)
      },
    },
    {
      id: 'badges',
      say: {
        ar: 'الشارة «حالي» للتشخيص القائم، و«سابق» لما حلّ محله غيره، و«سُجّل سليماً» حين أُعيد السن سليماً. فلا يضيع أي تشخيص ما لم تحذفه بنفسك.',
        en: 'The badge Current marks a finding in place, Superseded one that a newer finding replaced, and Marked healthy a tooth that was reset. No finding is lost unless you delete it yourself.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('[data-testid="ch-history"] .ch-tl.is-inactive').first())
        await ui.highlight(page.locator('[data-testid="ch-history"] .ch-tl.is-inactive').first(), 2600)
      },
    },
    {
      id: 'restore-delete',
      say: {
        ar: 'لإرجاع تشخيص «سابق» انقر على أيقونة الاستعادة بجانبه، ولحذف سطر نهائياً انقر على سلة المهملات.',
        en: 'To bring back a Superseded finding click the restore icon next to it; to delete a line for good click the bin.',
      },
      run: async ({ page, ui }) => {
        const row = page.locator('[data-testid="ch-history"] .ch-tl.is-inactive').first()
        await ui.moveTo(row.getByRole('button', { name: rx('استعادة هذا التشخيص', 'Restore this finding') }))
        await ui.highlight(row.locator('.ch-tl-actions'), 2200)
      },
    },
    {
      id: 'tooth-history',
      say: {
        ar: 'ولترى سجل سن واحد، انقر على رقمه في السجل لتفتح لوحته، ثم انقر على «سجل السن» في أسفلها.',
        en: 'To see one tooth’s history, click its number in the history to open its panel, then click Tooth history at the bottom of the panel.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('[data-testid="ch-history"] .ch-tl', { has: page.locator('.ch-tl-mark', { hasText: /^36$/ }) }).first().locator('.ch-tl-mark'))
        await panel(page).waitFor()
        await ui.click(panel(page).getByRole('button', { name: /سجل السن|Tooth history/ }))
        await panel(page).locator('section').last().locator('.ch-record').first().waitFor()
        await ui.highlight(panel(page).locator('section').last(), 2000)
      },
    },
    {
      id: 'print',
      say: {
        ar: 'للطباعة انقر على «طباعة» أعلى المخطط. تحمل الورقة ترويسة العيادة وبيانات المريض والمخطط بألوانه و«ملخص الحالات»، وتستطيع حفظها بصيغة PDF.',
        en: 'To print, click Print above the chart. The page carries the clinic’s header, the patient’s details, the chart in colour and a Findings summary, and you can save it as a PDF.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.drawer-header').getByRole('button', { name: rx('إغلاق', 'Close') }))
        await panel(page).waitFor({ state: 'hidden' })
        await ui.scrollTo(page.locator('.ch-card'), { block: 'start' })
        await ui.moveTo(toolbar(page).getByRole('button', { name: rx('طباعة المخطط', 'Print chart') }))
        await ui.highlight(toolbar(page).getByRole('button', { name: rx('طباعة المخطط', 'Print chart') }), 2600)
      },
    },
    {
      id: 'phone',
      say: {
        ar: 'على الهاتف يُفتح المخطط مكبّراً ليسهل النقر على الأسطح، وتسحبه جانباً لتصل إلى بقية الأسنان.',
        en: 'On a phone the chart opens zoomed in so surfaces are easy to tap, and you swipe it sideways to reach the other teeth.',
      },
      run: async ({ page, ui }) => { await ui.moveTo(page.locator('[data-tooth="46"]')); await ui.highlight(page.locator('.ch-canvas'), 2400) },
    },
    {
      id: 'recap',
      say: {
        ar: 'هكذا تسجّل كل حالة بنقرة أو بالرسم السريع، ويبقى سجل كامل لكل تغيير على كل سن. التفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'That is how you record every condition with a click or with quick paint, and keep a full history of every change on every tooth. Every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => { await ui.highlight(page.locator('[data-testid="ch-stats"]'), 2400) },
    },
  ],
}
