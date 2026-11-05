// End-to-end walkthrough of the built app with Playwright against a
// VITE_MOCK=1 build served by `vite preview`:
//   VITE_MOCK=1 npm run build && npm run preview &
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers QA_OUT=/tmp/shots node scripts/qa.mjs
// Logs in as every demo role, exercises every action, screenshots each
// screen at 390×844 (phone, 2x) and 1280×800, and fails on console errors.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}
const { chromium } = loadPlaywright();

const BASE = process.env.QA_BASE || 'http://localhost:4173';
const OUT = process.env.QA_OUT || join(process.cwd(), 'qa-shots');
mkdirSync(OUT, { recursive: true });

const problems = [];
const consoleErrors = [];
const shots = [];

async function makePage(browser, profile) {
  const phone = profile === 'phone';
  const context = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    deviceScaleFactor: phone ? 2 : 1,
    isMobile: phone,
    hasTouch: phone,
    locale: 'ar-SY',
    timezoneId: 'Asia/Damascus',
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[${profile}] ${page.url()} :: ${msg.text()}`);
  });
  page.on('pageerror', (err) => consoleErrors.push(`[${profile}] ${page.url()} :: PAGEERROR ${err.message}`));
  page.on('requestfailed', (req) => {
    if (!req.url().includes('/api/')) consoleErrors.push(`[${profile}] request failed ${req.url()} ${req.failure()?.errorText}`);
  });
  return { context, page, phone };
}

async function openDemoList(page) {
  const details = page.locator('.login details');
  await details.waitFor();
  if (!(await details.evaluate((d) => d.open))) await page.locator('.login summary').click();
}

function mk(page, profile) {
  const shot = async (name) => {
    await page.waitForTimeout(350);
    const file = join(OUT, `${profile}-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    shots.push(file);
    return file;
  };
  const step = async (name, fn) => {
    try {
      await fn();
    } catch (e) {
      problems.push(`[${profile}] ${name}: ${e.message.split('\n')[0]}`);
      try { await shot(`FAIL-${name}`); } catch { /* ignore */ }
    }
  };
  const login = async (code, path) => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await openDemoList(page);
    const btn = page.locator(`button[data-code="${code}"]`);
    await btn.waitFor({ state: 'visible' });
    await btn.click();
    await page.waitForURL(`**${path}`, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
  };
  const logout = async () => {
    const sel = profile === 'phone' ? '.topbar button[aria-label="تسجيل الخروج"]' : '.rail button[aria-label="تسجيل الخروج"]';
    await page.locator(sel).click();
    await page.waitForURL(`${BASE}/`, { timeout: 10000 });
  };
  const toast = async (text) => {
    await page.waitForFunction((needle) => {
      const el = document.querySelector('.toast.show');
      return !!el && (!needle || (el.textContent || '').includes(needle));
    }, text || '', { timeout: 10000 }).catch(async () => {
      const got = await page.locator('.toast').innerText().catch(() => '(no toast)');
      throw new Error(`toast «${got}» does not contain «${text}»`);
    });
    return page.locator('.toast.show').innerText();
  };
  const go = async (path) => {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
  };
  return { shot, step, login, logout, toast, go };
}

async function teacherFlow(page, h) {
  await h.login('T-SAMER', '/teacher');
  await h.shot('teacher-home');
  await h.step('take attendance', async () => {
    await page.locator('button:has-text("تسجيل الحضور")').first().click();
    await page.waitForURL('**/teacher/attendance**');
    await page.locator('.row .seg').first().waitFor();
    const segs = page.locator('.row .seg');
    await segs.nth(1).locator('button.absent').click();
    await segs.nth(3).locator('button.late').click();
    await h.shot('teacher-attendance');
    await page.locator('button:has-text("حفظ الحضور")').click();
    await h.toast('حُفظ حضور');
    await page.waitForURL('**/teacher');
    await h.shot('teacher-home-after-attendance');
  });
  await h.step('offline outbox', async () => {
    try {
      await page.context().setOffline(true);
      await page.waitForTimeout(300);
      await h.go('/teacher/attendance?section=103&period=4').catch(() => null);
      await page.locator('.row .seg').first().waitFor();
      await page.locator('.banner.offline').waitFor();
      await page.locator('button:has-text("حفظ الحضور")').click();
      await h.toast('لا اتصال');
      await page.locator('.banner.outbox').waitFor();
      await h.shot('teacher-offline-outbox');
    } finally {
      await page.context().setOffline(false);
    }
    await h.toast('معلّقة');
    await page.waitForFunction(() => !document.querySelector('.banner.outbox'));
  });
  await h.step('publish homework', async () => {
    await h.go('/teacher/homework/new');
    await page.locator('input[placeholder*="تمارين"]').fill('مسائل الضرب في عدد من رقمين');
    await page.locator('textarea').first().fill('حلّ المسائل من ١ إلى ٤ مع توضيح الخطوات.');
    await page.locator('input[placeholder="مثال: ٤٢"]').fill('٥٠');
    await h.shot('teacher-homework-new');
    await page.locator('button:has-text("نشر الواجب")').click();
    await h.toast('وصل الواجب');
    await page.waitForURL(/\/teacher\/homework\/\d+$/);
    await page.waitForLoadState('networkidle');
    await h.shot('teacher-homework-detail');
  });
  await h.step('homework list', async () => {
    await h.go('/teacher/homework');
    await page.locator('.row').first().waitFor();
    await h.shot('teacher-homework-list');
  });
  await h.step('report absence', async () => {
    await h.go('/teacher/absence');
    await page.locator('.chip:has-text("مرض")').click();
    await h.shot('teacher-absence-form');
    await page.locator('button:has-text("إبلاغ الإدارة")').click();
    await h.toast('غياب');
    await page.locator('.steps').first().waitFor();
    await h.shot('teacher-absence-result');
  });
  await h.step('messages', async () => {
    await h.go('/messages');
    await page.locator('.row').first().waitFor();
    await h.shot('teacher-messages');
    await page.locator('a.row').first().click();
    await page.waitForURL(/\/messages\/\d+/);
    await page.locator('textarea').fill('أهلاً بك، لا مانع من تأجيل التسليم يوماً واحداً.');
    await page.locator('button:has-text("إرسال")').click();
    await h.toast('أُرسلت رسالتك');
    await h.shot('teacher-message-thread');
  });
  await h.step('notifications', async () => {
    await h.go('/notifications');
    await page.locator('.nlist').waitFor();
    await h.shot('teacher-notifications');
    const mark = page.locator('button:has-text("تعليم الكلّ مقروءاً")');
    if (await mark.count()) { await mark.click(); await h.toast('عُلّمت'); }
  });
  await h.logout();
}

async function schoolFlow(page, h) {
  await h.login('SCH-1', '/school');
  await page.locator('.kpis').waitFor();
  await h.shot('school-dashboard');
  await h.step('absences board approve', async () => {
    await h.go('/school/absences');
    await page.locator('[data-sub]').first().waitFor();
    await h.shot('school-absences-board');
    const first = page.locator('[data-sub]').first();
    await first.locator('input[aria-label="ملاحظة الدرس"]').fill('دورة الماء في الطبيعة، ص ٢٧');
    await first.locator('button:has-text("اعتماد")').click();
    await h.toast('اعتُمد');
    await page.waitForTimeout(600);
    const second = page.locator('[data-sub]').nth(1);
    if (await second.locator('button:has-text("تعلّم ذاتي")').count()) {
      await second.locator('input[aria-label="ملاحظة الدرس"]').fill('قراءة الدرس الرابع وحلّ أسئلته');
      await second.locator('button:has-text("تعلّم ذاتي")').click();
      await h.toast('تعلّماً ذاتياً');
    }
    await page.waitForTimeout(600);
    await h.shot('school-absences-after');
  });
  await h.step('record teacher absence', async () => {
    await h.go('/school/absences/new');
    const sel = page.locator('select.input').first();
    await sel.waitFor();
    await page.waitForFunction(() => document.querySelector('select.input')?.options.length > 1);
    await sel.selectOption({ index: 1 });
    await page.locator('input[placeholder="مثال: مرض"]').fill('مهمّة رسمية');
    await h.shot('school-absence-new');
    await page.locator('button:has-text("تسجيل الغياب واقتراح البديل")').click();
    await h.toast('');
    await page.locator('.steps').first().waitFor();
    await h.shot('school-absence-new-result');
  });
  await h.step('attendance entry + confirm', async () => {
    await h.go('/school/attendance');
    await page.locator('.chip').first().waitFor();
    await page.locator('.chip').first().click();
    await page.locator('.chip:has-text("الحصّة الثانية")').click();
    await page.locator('.row .seg').first().waitFor();
    await page.locator('.row .seg').nth(2).locator('button.absent').click();
    await h.shot('school-attendance');
    await page.locator('button:has-text("حفظ الحضور")').click();
    await h.toast('حُفظ حضور');
    await page.locator('button:has-text("تثبيت حضور اليوم")').click();
    await h.toast('ثُبّت');
    await page.waitForTimeout(500);
    await h.shot('school-attendance-confirmed');
  });
  await h.step('announcement', async () => {
    await h.go('/school/announcements');
    await page.locator('input[placeholder*="تعليق الدوام"]').fill('تعليق الدوام يوم الأحد');
    await page.locator('textarea').fill('يُعلَّق الدوام يوم الأحد ٨ تشرين الثاني بسبب الأحوال الجوية، ويُستأنف الاثنين.');
    await page.locator('label.toggle').click();
    await h.shot('school-announcements-form');
    await page.locator('button:has-text("إرسال للجميع")').click();
    await h.toast('أُرسل الإعلان');
    await page.waitForTimeout(400);
    await h.shot('school-announcements');
  });
  await h.step('notifications', async () => {
    await h.go('/notifications');
    await page.locator('.nlist').waitFor();
    await h.shot('school-notifications');
  });
  await h.logout();
}

async function studentFlow(page, h) {
  await h.login('S-LAYAN', '/student');
  await page.locator('.periods').waitFor();
  await h.shot('student-home');
  await h.step('submit homework', async () => {
    const row = page.locator('button.row:not(.done)').first();
    await row.click();
    await h.toast('رائع');
    await page.waitForTimeout(500);
    await h.shot('student-home-submitted');
  });
  await h.step('timetable', async () => {
    await h.go('/student/timetable');
    await page.locator('.periods').first().waitFor();
    await h.shot('student-timetable');
  });
  await h.step('notifications', async () => {
    await h.go('/notifications');
    await page.locator('.nlist').waitFor();
    await h.shot('student-notifications');
  });
  await h.logout();
}

async function parentFlow(page, h) {
  await h.login('P-KHALED', '/parent');
  await page.locator('.kpis').waitFor();
  await h.shot('parent-home');
  await h.step('message teacher', async () => {
    await page.locator('button:has-text("مراسلة المعلّم")').first().click();
    await page.waitForURL('**/messages/new**');
    await page.locator('.chip:has-text("سامر")').waitFor();
    await page.locator('.chip:has-text("سامر")').click();
    await page.locator('textarea').fill('أستاذ سامر، هل يمكن تأجيل تسليم واجب الرياضيات يوماً واحداً لظرف عائلي؟');
    await h.shot('parent-message-new');
    await page.locator('button:has-text("إرسال")').click();
    await h.toast('أُرسلت رسالتك');
    await page.waitForURL(/\/messages\/\d+/);
    await page.waitForTimeout(400);
    await h.shot('parent-message-thread');
    await h.go('/messages');
    await page.locator('.row').first().waitFor();
    await h.shot('parent-messages');
  });
  await h.step('notifications', async () => {
    await h.go('/notifications');
    await page.locator('.nlist').waitFor();
    await h.shot('parent-notifications');
  });
  await h.logout();
}

async function directorateFlow(page, h) {
  await h.login('DIR-DARAA', '/directorate');
  await page.locator('table').waitFor();
  await h.shot('directorate-dashboard');
  await h.step('sort table', async () => {
    await page.locator('th:has-text("الطلاب")').click();
    await page.waitForTimeout(200);
    const first = await page.locator('tbody tr td:first-child').first().innerText();
    await page.locator('th:has-text("الطلاب")').click();
    const after = await page.locator('tbody tr td:first-child').first().innerText();
    if (first === after) throw new Error('sorting did not change the order');
  });
  await h.step('download csv', async () => {
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.locator('button:has-text("تنزيل تقرير اليوم")').click(),
    ]);
    const file = join(OUT, 'report.csv');
    await dl.saveAs(file);
    await h.toast('التقرير');
    shots.push(file);
  });
  await h.step('circular', async () => {
    await h.go('/directorate/circulars');
    await page.locator('input[placeholder*="مواعيد"]').fill('تعميم: الدوام الشتوي');
    await page.locator('textarea').fill('يبدأ الدوام الشتوي الساعة الثامنة صباحاً ابتداءً من الأحد القادم في جميع مدارس المديرية.');
    await page.locator('button:has-text("إرسال إلى كلّ المدارس")').click();
    await h.toast('أُرسل التعميم');
    await page.waitForTimeout(400);
    await h.shot('directorate-circulars');
  });
  await h.step('notifications', async () => {
    await h.go('/notifications');
    await page.locator('.nlist').waitFor();
    await h.shot('directorate-notifications');
  });
  await h.logout();
}

async function run(browser, profile, full) {
  const { context, page } = await makePage(browser, profile);
  const h = mk(page, profile);
  await h.step('login screen', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await openDemoList(page);
    await h.shot('login');
  });
  if (full) {
    await h.step('service worker + offline shell', async () => {
      await page.waitForFunction(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return !!reg && !!reg.active && reg.active.state === 'activated';
      }, null, { timeout: 15000 });
      await page.waitForTimeout(800);
      const cached = await page.evaluate(async () => {
        const keys = await caches.keys();
        let n = 0;
        for (const k of keys) n += (await (await caches.open(k)).keys()).length;
        return { keys, n };
      });
      console.log('service worker caches:', JSON.stringify(cached));
      try {
        await page.context().setOffline(true);
        await page.goto(`${BASE}/teacher/homework`, { waitUntil: 'load' });
        await page.locator('.login-card').waitFor({ timeout: 10000 });
        await h.shot('offline-shell');
      } finally {
        await page.context().setOffline(false);
      }
    });
  }
  if (full) {
    await h.step('teacher flow', () => teacherFlow(page, h));
    await h.step('school flow', () => schoolFlow(page, h));
    await h.step('student flow', () => studentFlow(page, h));
    await h.step('parent flow', () => parentFlow(page, h));
    await h.step('directorate flow', () => directorateFlow(page, h));
  } else {
    const quick = [
      ['T-SAMER', '/teacher', 'teacher-home', ['/teacher/homework', 'teacher-homework-list'], ['/teacher/absence', 'teacher-absence-form']],
      ['SCH-1', '/school', 'school-dashboard', ['/school/absences', 'school-absences-board'], ['/school/attendance', 'school-attendance']],
      ['S-LAYAN', '/student', 'student-home', ['/student/timetable', 'student-timetable']],
      ['P-KHALED', '/parent', 'parent-home', ['/messages/new', 'parent-message-new']],
      ['DIR-DARAA', '/directorate', 'directorate-dashboard', ['/directorate/circulars', 'directorate-circulars'], ['/notifications', 'directorate-notifications']],
    ];
    for (const [code, path, name, ...extra] of quick) {
      await h.step(`desktop ${code}`, async () => {
        await h.login(code, path);
        await page.waitForTimeout(400);
        await h.shot(name);
        for (const [p, n] of extra) { await h.go(p); await page.waitForTimeout(400); await h.shot(n); }
        await h.logout();
      });
    }
  }
  await context.close();
}

const browser = await chromium.launch();
try {
  await run(browser, 'phone', true);
  await run(browser, 'desktop', false);
} finally {
  await browser.close();
}

console.log('\nScreenshots:');
for (const s of shots) console.log('  ' + s);
if (problems.length) {
  console.log('\nSTEP FAILURES:');
  for (const p of problems) console.log('  ' + p);
}
if (consoleErrors.length) {
  console.log('\nCONSOLE ERRORS:');
  for (const e of consoleErrors) console.log('  ' + e);
}
if (!problems.length && !consoleErrors.length) console.log('\nQA OK — no step failures, no console errors.');
process.exit(problems.length || consoleErrors.length ? 1 : 0);
