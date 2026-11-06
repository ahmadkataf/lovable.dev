// A sample chapter for testing the recorder, not a chapter of the course (files starting with _ are left out of a
// default run): six short scenes over the demo clinic that exercise every ui helper of lib/ui.mjs — highlight, click,
// type, scrollTo, moveTo and callout — from the dashboard to a patient's file.
//   QA_DIST=/tmp/dist-video QA_PORT=4861 VIDEO_OUT=/tmp/video-sample node store/scripts/video/make.mjs --chapters=_sample
export const chapter = {
  slug: '_sample',
  title: { ar: 'عينة للتجربة', en: 'Test sample' },
  scenes: [
    {
      id: 'dashboard',
      say: { ar: 'هذه الشاشة الرئيسية لعيادة الابتسامة: أرقام اليوم ومواعيده في مكان واحد.', en: 'This is the dashboard of Smile Dental Clinic: today\'s numbers and appointments in one place.' },
      run: async ({ page, ui }) => { await ui.highlight(page.locator('.rp-dash-kpis'), 1800) },
    },
    {
      id: 'patients',
      say: { ar: 'نفتح قائمة المرضى من الشريط الجانبي.', en: 'Open Patients from the sidebar.' },
      run: async ({ page, ui }) => { await ui.click(page.locator('.app-sidebar').getByRole('link', { name: /^(المرضى|Patients)$/ })) },
    },
    {
      id: 'search',
      say: { ar: 'في حقل البحث نكتب جزءاً من الاسم، فتظهر النتائج فوراً.', en: 'Type part of a name in the search box and the results appear at once.' },
      run: async ({ page, ui }) => {
        // the first name of a demo patient (the demo clinic writes English names in Latin letters)
        const name = await page.evaluate(async () => (await window.__dentora.db.patients.toArray()).map(p => p.name).sort()[5])
        await ui.type(page.locator('input[type="search"]').first(), name.split(' ')[0])
      },
    },
    {
      id: 'open',
      say: { ar: 'نضغط على المريض لفتح ملفه.', en: 'Click the patient to open the file.' },
      // the name cell, not the whole row: the row's centre is the phone column with its call button
      run: async ({ page, ui }) => { await ui.click(page.locator('.pt-table tbody tr.clickable .cell-main').first()) },
    },
    {
      id: 'hero',
      say: { ar: 'في أعلى الملف بطاقة المريض: الاسم والهاتف وأزرار الاتصال.', en: 'At the top of the file sits the patient card: name, phone and the contact buttons.' },
      run: async ({ page, ui }) => { await ui.highlight(page.locator('.pt-hero'), 2000) },
    },
    {
      id: 'tabs',
      say: { ar: 'والتبويبات تنقلنا بين المخطط والعلاجات والفواتير.', en: 'The tabs take us to the chart, the treatments and the invoices.' },
      run: async ({ page, ui, lang }) => {
        await ui.scrollTo(page.locator('.pt-tabs'))
        await ui.moveTo(page.locator('.pt-tabs'))
        await ui.callout(lang === 'ar' ? 'التبويبات' : 'The tabs', { ms: 1800 })
      },
    },
  ],
}
