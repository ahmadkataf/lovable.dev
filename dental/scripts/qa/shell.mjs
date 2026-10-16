// QA for the shared shell and platform behaviour (needs a QA build: it has window.__dentora):
//   - the page's Content-Security-Policy is in force and nothing violates it: a clinic logo, a patient photo, an x-ray,
//     a PDF (shown in the viewer when the browser has one), the dental chart, an invoice and a printout; the one request
//     it lets out is the licence-key activation;
//   - dialogs on a touch screen focus themselves (no on-screen keyboard), with a mouse the first field;
//   - the licence screen when the Windows/Android shell cannot tell the device id (an error and "Try again");
//   - the phone's bottom bar: labels of 12px or more, never cut, at 360 and 390 px, Arabic and English;
//   - the phone's font size at 130 % (Android's largest setting the app follows): no sideways scrolling;
//   - the collapsed sidebar names its icons with titles and clips nothing, the account menu offers Help (the guide on
//     the website), the dental-chart toolbar fits a 390 px phone in both languages, and the reset-code box's Arabic
//     placeholder keeps the app's font (the pasted code alone is monospace).
//   VITE_QA=1 npx vite build --outDir /tmp/dist-shell
//   QA_DIST=/tmp/dist-shell QA_PORT=4702 QA_SHOTS=qa-shots/shell node scripts/qa/shell.mjs
import { chromium } from 'playwright'
import { BASE, openBrowser, seedAndLogin, setSession, shot, startServer } from './lib.mjs'

let failures = 0
const errors = []
const ok = (cond, msg) => { if (!cond) { failures++; console.error('FAIL:', msg) } else console.log('ok  ', msg) }
const watch = page => {
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error' || /Content Security Policy|CSP violation/i.test(m.text())) errors.push(`console: ${m.text()}`) })
}
const settle = (page, ms = 700) => page.waitForTimeout(ms)
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

// small real files: a PNG x-ray, a JPEG photo and a one-page PDF
function pngBytes(w = 64, h = 48) {
  // a valid PNG drawn by hand: 8-bit grey, no filter, stored (zlib level 0)
  const zlibStore = data => {
    const out = [0x78, 0x01]
    for (let i = 0; i < data.length; i += 65535) {
      const block = data.subarray(i, i + 65535), last = i + 65535 >= data.length
      out.push(last ? 1 : 0, block.length & 255, block.length >> 8, ~block.length & 255, (~block.length >> 8) & 255, ...block)
    }
    let a = 1, b = 0
    for (const x of data) { a = (a + x) % 65521; b = (b + a) % 65521 }
    out.push(b >> 8, b & 255, a >> 8, a & 255)
    return Buffer.from(out)
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = buf => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0
  const raw = Buffer.alloc((w + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = (x * 4 + y * 3) & 255
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlibStore(raw)), chunk('IEND', Buffer.alloc(0))])
}
function pdfBytes() {
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  const stream = 'BT /F1 24 Tf 40 100 Td (Dentora consent) Tj ET'
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  let out = '%PDF-1.4\n'; const offsets = []
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
const FILES = [
  { name: 'xray.png', mimeType: 'image/png', buffer: pngBytes(320, 240) },
  { name: 'photo.png', mimeType: 'image/png', buffer: pngBytes(200, 150) },
  { name: 'consent.pdf', mimeType: 'application/pdf', buffer: pdfBytes() },
]
const LOGO = `data:image/png;base64,${pngBytes(96, 96).toString('base64')}`

async function addPatient(page) {
  return page.evaluate(async () => {
    const d = window.__dentora.db, now = new Date().toISOString()
    await d.patients.put({ id: 'qa-p1', fileNo: 1, name: 'محمد العلي', gender: 'male', phone: '0944555111', allergies: ['البنسلين'], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: now, updatedAt: now })
    await d.teeth.put({ id: 'qa-t1', patientId: 'qa-p1', tooth: 16, condition: 'filled', surfaces: ['O'], active: true, recordedAt: now })
    return 'qa-p1'
  })
}

const server = await startServer()
try {
  // ============ CSP: pictures, a PDF, the chart, an invoice and a printout, with the build's own policy ============
  {
    // the full Chromium (new headless) has the PDF viewer, so the PDF is shown in the page as on Windows
    const browser = await chromium.launch({ channel: 'chromium' }).catch(() => chromium.launch())
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-SY' })
    await ctx.addInitScript(() => document.addEventListener('securitypolicyviolation', e => console.error(`CSP violation: ${e.violatedDirective} blocked ${e.blockedURI || '(inline)'}`)))
    const page = await ctx.newPage()
    watch(page)
    await seedAndLogin(page)
    const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') || '')
    ok(/script-src 'self'/.test(csp) && /object-src 'none'/.test(csp), `the page carries its Content-Security-Policy (${csp.slice(0, 60)}…)`)
    await addPatient(page)
    await page.evaluate(logo => window.__dentora.db.clinic.update('clinic', { logo }), LOGO)
    // a blocked inline script really is blocked (the policy is in force, not just present)
    const inlineRan = await page.evaluate(() => new Promise(res => { const s = document.createElement('script'); s.textContent = 'window.__inlineRan = true'; document.head.appendChild(s); setTimeout(() => res(!!window.__inlineRan), 50) }))
    ok(!inlineRan, 'an inline script is refused by the policy')
    // licence keys: the one request the policy lets out is the activation (answered here, as the server would answer)
    const answer = route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"code":"QA"}' })
    await ctx.route('https://dentora.raqeem.dev/api/activate', answer)
    await ctx.route('https://example.com/api/activate', answer)
    const reach = await page.evaluate(() => Promise.all(['https://dentora.raqeem.dev/api/activate', 'https://example.com/api/activate'].map(url =>
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', credentials: 'omit' }).then(r => r.json()).then(b => b.code, () => 'refused'))))
    ok(reach[0] === 'QA' && reach[1] === 'refused', `the policy lets the activation request out and refuses the same request to another site (${reach.join(', ')})`)
    await ctx.unrouteAll()
    errors.splice(0)       // those refusals are the expected violations; every one after them is a failure

    await page.goto(`${BASE}/index.html#/patients/qa-p1?tab=files`)
    await settle(page)
    for (const f of FILES) {
      const chooser = page.waitForEvent('filechooser')
      await page.locator('.pt-files button:has(svg.lucide-upload)').first().click()
      await (await chooser).setFiles(f)
      await page.waitForSelector('.modal .pt-upload-file')
      await page.locator('.modal-footer .btn-primary').click()
      await page.waitForSelector('.modal .pt-upload-file', { state: 'detached' })
      await settle(page, 400)
    }
    ok(await page.evaluate(() => window.__dentora.db.files.count()) === 3, 'three files uploaded (x-ray, photo, PDF)')
    const thumbs = await page.evaluate(() => [...document.querySelectorAll('.pt-file-thumb img')].map(i => i.complete && i.naturalWidth > 0))
    ok(thumbs.length === 2 && thumbs.every(Boolean), `the picture thumbnails show (data: URLs) ${JSON.stringify(thumbs)}`)
    await shot(page, 'csp-1-files')
    // open each file in the viewer
    for (const [i, f] of FILES.entries()) {
      await page.locator('.pt-file').filter({ hasText: f.name.split('.')[0] }).first().click()
      await page.waitForSelector('.modal .pt-stage')
      await settle(page, 1200)
      if (f.mimeType.startsWith('image/')) {
        const shown = await page.evaluate(() => { const img = document.querySelector('.pt-stage img'); return !!img && img.complete && img.naturalWidth > 0 && img.src.startsWith('blob:') })
        ok(shown, `${f.name}: shown in the viewer from a blob: URL`)
      } else {
        const viewer = await page.evaluate(() => ({ frame: !!document.querySelector('.pt-stage iframe'), pdf: navigator.pdfViewerEnabled }))
        if (viewer.pdf) {
          const frame = page.frames().find(fr => fr.url().startsWith('blob:'))
          ok(viewer.frame && !!frame, `${f.name}: shown in the page's PDF viewer (iframe from a blob: URL)`)
        } else ok(await page.locator('.pt-stage-fallback').count() === 1, `${f.name}: no PDF viewer in this browser, the download button is offered`)
      }
      await shot(page, `csp-2-viewer-${i + 1}`)
      await page.keyboard.press('Escape'); await settle(page, 300)
    }
    // the dental chart, an invoice with the clinic logo, and its printout
    await page.goto(`${BASE}/index.html#/patients/qa-p1?tab=chart`); await settle(page, 1200)
    await shot(page, 'csp-3-chart')
    const invId = await page.evaluate(async () => {
      const d = window.__dentora.db, now = new Date().toISOString()
      await d.invoices.put({ id: 'qa-inv', number: 'INV-000001', patientId: 'qa-p1', date: now.slice(0, 10), items: [{ id: 'l1', description: 'حشوة تجميلية', tooth: 16, qty: 1, unitPrice: 50, discount: 0, total: 50 }], subtotal: 50, discount: 0, taxPercent: 0, tax: 0, total: 50, paid: 0, status: 'unpaid', createdAt: now, updatedAt: now })
      return 'qa-inv'
    })
    await page.goto(`${BASE}/index.html#/invoices/${invId}`); await settle(page, 1200)
    const logoShown = await page.evaluate(() => [...document.querySelectorAll('img')].some(i => i.src.startsWith('data:image/png') && i.complete && i.naturalWidth > 0))
    ok(logoShown, 'the clinic logo (data: URL) shows on the invoice')
    await shot(page, 'csp-4-invoice')
    await page.emulateMedia({ media: 'print' }); await settle(page, 400)
    await shot(page, 'csp-5-invoice-print', { full: true })
    await page.emulateMedia({ media: 'screen' })
    ok(errors.length === 0, `no CSP violation or console error with pictures, a PDF, the chart and an invoice (${errors.slice(0, 3).join(' | ')})`)
    await browser.close()
  }

  // ============ dialogs: no keyboard on a touch screen; the first field with a mouse ============
  for (const [label, opts] of [['desktop', { width: 1440, height: 900 }], ['phone', { mobile: true, width: 390, height: 844 }]]) {
    const { browser, page } = await openBrowser(opts)
    watch(page)
    await seedAndLogin(page)
    await addPatient(page)
    const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
    ok(coarse === (label === 'phone'), `${label}: pointer is ${coarse ? 'coarse' : 'fine'}`)
    await page.goto(`${BASE}/index.html#/patients`); await settle(page)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('dentora:quick-add', { detail: 'patient' })))
    await page.waitForSelector('.modal'); await settle(page, 400)
    const focus = await page.evaluate(() => { const a = document.activeElement; return { tag: a?.tagName, modal: a?.classList.contains('modal') ?? false, type: a?.getAttribute('type') } })
    if (label === 'phone') ok(focus.modal, `phone: the new-patient dialog focuses itself, no field (${JSON.stringify(focus)})`)
    else ok(focus.tag === 'INPUT', `desktop: the new-patient dialog focuses its first field (${JSON.stringify(focus)})`)
    await shot(page, `focus-1-new-patient-${label}`)
    await page.keyboard.press('Escape'); await settle(page, 300)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('dentora:quick-add', { detail: 'appointment' })))
    await page.waitForSelector('.modal'); await settle(page, 500)
    const f2 = await page.evaluate(() => { const a = document.activeElement; return { tag: a?.tagName, modal: a?.classList.contains('modal') ?? false } })
    if (label === 'phone') ok(f2.modal, `phone: the appointment dialog does not focus the patient search (${JSON.stringify(f2)})`)
    else ok(f2.tag === 'INPUT', `desktop: the appointment dialog focuses the patient search (${JSON.stringify(f2)})`)
    await shot(page, `focus-2-appointment-${label}`)
    await page.keyboard.press('Escape'); await settle(page, 300)
    // on a phone the tooth panel is a dialog that marks its first condition [data-autofocus]: that wins over the dialog
    await page.goto(`${BASE}/index.html#/patients/qa-p1?tab=chart`); await settle(page, 1000)
    const tooth = page.locator('[data-tooth="16"]').first()
    if (label === 'phone' && await tooth.count()) {
      await tooth.click(); await page.waitForSelector('.modal'); await settle(page, 400)
      const f3 = await page.evaluate(() => ({ cond: document.activeElement?.classList.contains('ch-cond') ?? false, tag: document.activeElement?.tagName }))
      ok(f3.cond, `${label}: the tooth panel focuses its first condition ([data-autofocus] wins) (${JSON.stringify(f3)})`)
      await shot(page, `focus-3-tooth-${label}`)
      await page.keyboard.press('Escape')
    }
    await browser.close()
  }

  // ============ licence screen when the shell cannot tell the device id ============
  for (const [label, opts] of [['ar', { lang: 'ar' }], ['en', { lang: 'en' }], ['phone', { lang: 'ar', mobile: true, width: 390, height: 844 }], ['phone-en', { lang: 'en', mobile: true, width: 390, height: 844 }]]) {
    const { browser, ctx, page } = await openBrowser(opts)
    watch(page)
    // a Windows bridge whose device id fails until window.__deviceOk is set
    await ctx.addInitScript(() => {
      window.dentora = {
        platform: 'electron', appVersion: async () => '1.0.0', print: async () => undefined, openExternal: async () => undefined,
        deviceId: async () => { if (window.__deviceOk) return 'machine-qa-42'; throw new Error('no answer') },
        saveBegin: async () => null, saveChunk: async () => ({ ok: true }), saveEnd: async () => ({ ok: true }), saveAbort: async () => undefined,
        openBegin: async () => null, openChunk: async () => new Uint8Array(), openEnd: async () => undefined,
      }
    })
    await seedAndLogin(page, { lang: opts.lang })
    await page.goto(`${BASE}/index.html#/settings/license`)
    await page.waitForSelector('[data-qa=device-error]', { timeout: 10000 }).catch(() => {})
    ok(await page.locator('[data-qa=device-error]').count() === 1, `${label}: the licence screen explains that the device number could not be read`)
    ok(await page.locator('[data-qa=activate]').isDisabled(), `${label}: activation waits for the device number`)
    ok(await overflow(page) <= 0, `${label}: no sideways scrolling`)
    await shot(page, `license-1-device-error-${label}`)
    if (label === 'phone') { await page.locator('[data-qa=device-error]').scrollIntoViewIfNeeded(); await shot(page, `license-1-device-error-${label}-card`) }
    await page.evaluate(() => { window.__deviceOk = true })
    await page.click('[data-qa=device-retry]')
    await page.waitForSelector('[data-qa=device-number]', { timeout: 10000 }).catch(() => {})
    const number = (await page.locator('[data-qa=device-number]').textContent().catch(() => '')) || ''
    ok(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(number.trim()), `${label}: "Try again" reads it and shows the device number (${number.trim()})`)
    ok(await page.evaluate(() => localStorage.getItem('dentora.device.shell')) === 'machine-qa-42', `${label}: the id is remembered for a later failure`)
    await shot(page, `license-2-device-back-${label}`)
    await browser.close()
  }

  // ============ the collapsed sidebar and Help in the account menu ============
  for (const lang of ['ar', 'en']) {
    const { browser, page } = await openBrowser({ lang })
    watch(page)
    await seedAndLogin(page, { lang })
    await page.click('.collapse-btn'); await settle(page, 500)
    const rail = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.app-sidebar .nav-item')]
      const shown = [...document.querySelectorAll('.app-sidebar .nav-label')].filter(l => l.getClientRects().length > 0).length
      return { width: Math.round(document.querySelector('.app-sidebar').getBoundingClientRect().width), shown, items: items.length, titled: items.filter(i => i.title).length, cut: items.filter(i => i.scrollWidth > i.clientWidth + 1).length }
    })
    ok(rail.shown === 0 && rail.cut === 0, `${lang}: the collapsed rail (${rail.width}px) shows no label and clips nothing`)
    ok(rail.titled === rail.items, `${lang}: every collapsed item carries its name as a title (${rail.titled}/${rail.items})`)
    await page.hover('.app-sidebar .nav-item >> nth=2'); await settle(page, 300)
    await shot(page, `rail-${lang}-collapsed`)
    await page.click('.collapse-btn'); await settle(page, 400)
    ok(await page.evaluate(() => [...document.querySelectorAll('.app-sidebar .nav-item')].every(i => !i.title)), `${lang}: the expanded sidebar has no titles (the labels are back)`)
    await page.click('.sidebar-user')
    const help = page.locator('.menu[role=menu] [role=menuitem]', { hasText: lang === 'ar' ? 'مساعدة' : 'Help' })
    ok(await help.count() === 1, `${lang}: the account menu offers Help`)
    await shot(page, `menu-${lang}-help`)
    await page.evaluate(() => { window.__qaOpened = []; window.open = u => { window.__qaOpened.push(String(u)); return null } })
    await help.click(); await settle(page, 200)
    const url = await page.evaluate(() => window.__qaOpened.join(' '))
    ok(url === (lang === 'ar' ? 'https://dentora.raqeem.dev/guide' : 'https://dentora.raqeem.dev/en/guide'), `${lang}: Help opens the guide in the app's language (${url})`)
    await browser.close()
  }

  // ============ a 390 px phone: the chart toolbar and the reset-code box ============
  for (const lang of ['ar', 'en']) {
    const { browser, page } = await openBrowser({ lang, mobile: true, width: 390, height: 844 })
    watch(page)
    await seedAndLogin(page, { lang })
    await addPatient(page)
    await page.goto(`${BASE}/index.html#/patients/qa-p1?tab=chart`); await settle(page, 1000)
    const tb = await page.evaluate(() => {
      const g = document.querySelector('.ch-toolbar-group'); const boxes = [...g.querySelectorAll('button')].map(b => b.getBoundingClientRect())
      return { inside: boxes.every(b => b.left >= 0 && b.right <= innerWidth + 0.5), cut: [...g.querySelectorAll('.segmented button')].filter(b => b.scrollWidth > b.clientWidth + 1).length, rows: new Set(boxes.map(b => Math.round(b.top))).size }
    })
    ok(tb.inside && tb.cut === 0, `${lang} 390px: the chart toolbar fits, no button cut (${tb.rows} row(s) in the dentition group)`)
    await shot(page, `chart-toolbar-${lang}-390`)
    // the reset-code box, from the login screen
    await setSession(page, null)
    await page.goto(`${BASE}/index.html#/login`); await page.reload()
    await page.waitForSelector('[data-user=u-admin], [data-qa=forgot]', { timeout: 15000 })
    if (await page.locator('[data-user=u-admin]').count()) await page.click('[data-user=u-admin]')
    await page.click('[data-qa=forgot]')
    await page.click('[data-qa=have-reset-code]')
    await page.waitForSelector('[data-qa=reset-code]'); await settle(page, 400)
    const ph = await page.locator('[data-qa=reset-code]').evaluate(t => {
      const ps = getComputedStyle(t, '::placeholder'), cs = getComputedStyle(t)
      return { spacing: ps.letterSpacing, mono: /mono|Consolas|Menlo/i.test(ps.fontFamily), codeMono: /mono|Consolas|Menlo/i.test(cs.fontFamily) }
    })
    ok((ph.spacing === '0px' || ph.spacing === 'normal') && !ph.mono && ph.codeMono, `${lang} 390px: the reset-code placeholder keeps the app's font and joined letters, the code itself stays monospace (${JSON.stringify(ph)})`)
    await shot(page, `reset-box-${lang}-390`)
    await browser.close()
  }

  // ============ the phone's bottom bar and a 130 % font size ============
  for (const lang of ['ar', 'en']) {
    for (const width of [360, 390]) {
      const { browser, page } = await openBrowser({ lang, mobile: true, width, height: 800 })
      watch(page)
      await seedAndLogin(page, { lang })
      await addPatient(page)
      await page.goto(`${BASE}/index.html#/`); await settle(page, 900)
      const labels = await page.evaluate(() => [...document.querySelectorAll('.app-bottomnav .nav-label')].map(l => ({ text: l.textContent, size: parseFloat(getComputedStyle(l).fontSize), cut: l.scrollWidth > l.clientWidth + 1 })))
      ok(labels.length === 5 && labels.every(l => l.size >= 12), `${lang} ${width}px: bottom bar labels are 12px or more (${labels.map(l => l.size).join(', ')})`)
      ok(labels.every(l => !l.cut), `${lang} ${width}px: no bottom bar label is cut (${labels.filter(l => l.cut).map(l => l.text).join(', ')})`)
      ok(await overflow(page) <= 0, `${lang} ${width}px: no sideways scrolling`)
      await shot(page, `nav-${lang}-${width}`)
      // Android's text zoom at 130 %: every font size grows by 1.3 (measured first, then applied, so nothing grows twice)
      for (const route of ['/', '/patients', '/patients/qa-p1', '/appointments', '/invoices', '/settings', '/settings/license']) {
        await page.goto(`${BASE}/index.html#${route}`); await settle(page, 900)
        await page.evaluate(() => {
          // the shell stays in the page from one route to the next: undo the previous route's zoom before measuring
          for (const e of document.querySelectorAll('[data-qa-zoomed]')) { e.style.removeProperty('font-size'); e.removeAttribute('data-qa-zoomed') }
          const els = [...document.querySelectorAll('body, body *')]
          const sizes = els.map(e => parseFloat(getComputedStyle(e).fontSize))
          els.forEach((e, i) => { if (sizes[i] && !e.style.fontSize) { e.style.setProperty('font-size', `${sizes[i] * 1.3}px`, 'important'); e.setAttribute('data-qa-zoomed', '') } })
        })
        await settle(page, 300)
        const over = await overflow(page)
        ok(over <= 0, `${lang} ${width}px at 130 % text: ${route} does not scroll sideways (${over})`)
        if (width === 360 || route === '/' || route === '/patients/qa-p1') await shot(page, `text130-${lang}-${width}${route.replace(/\//g, '_') || '_home'}`)
      }
      await browser.close()
    }
  }
} finally {
  server.kill()
}
console.log(`\n${failures} failed checks, ${errors.length} console/page errors`)
for (const e of [...new Set(errors)].slice(0, 20)) console.log('  ', e)
process.exit(failures || errors.length ? 1 : 0)
