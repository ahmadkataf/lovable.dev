// Shared helpers for QA scripts: start a static server on dist/, open Chromium, seed a signed-in clinic.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const PORT = Number(process.env.QA_PORT || 4173)
export const DIST = process.env.QA_DIST || 'dist'          // build with: npx vite build --outDir <QA_DIST>
export const BASE = `http://127.0.0.1:${PORT}`

export async function startServer() {
  const p = spawn('npx', ['vite', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + '/index.html'); if (r.ok) return p } catch { /* not yet */ }
    await new Promise(r => setTimeout(r, 300))
  }
  p.kill(); throw new Error('preview server did not start')
}

export async function openBrowser({ width = 1440, height = 900, mobile = false, lang = 'ar' } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  const ctx = await browser.newContext({ viewport: { width: mobile ? Math.min(width, 430) : width, height }, hasTouch: mobile, locale: lang === 'ar' ? 'ar-SY' : 'en-US' })
  const page = await ctx.newPage()
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message))
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE:', m.text()) })
  return { browser, ctx, page }
}

/** Marks setup as done, creates an admin (PIN 1234) and a doctor, signs the admin in. Call on a loaded page. */
export async function seedAndLogin(page, { lang = 'ar', clinicName = 'عيادة الابتسامة لطب الأسنان' } = {}) {
  await page.goto(BASE + '/index.html#/setup')
  await page.waitForFunction(() => window.__dentora?.db)
  const userId = await page.evaluate(async ({ lang, clinicName }) => {
    const db = window.__dentora.db
    const now = new Date().toISOString()
    const sha = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2, '0')).join('')
    const salt = 'qa-salt'
    const existing = await db.clinic.get('clinic')
    await db.clinic.put({ ...(existing || {}), id: 'clinic', name: clinicName, nameEn: 'Smile Dental Clinic', phone: '0944 123 456', address: 'دمشق — المزة، شارع الجلاء', currency: 'USD', currencySymbol: '$', currencyDecimals: 0, lang, theme: 'light',
      workingDays: [0, 1, 2, 3, 4, 6], workStart: '09:00', workEnd: '18:00', slotMinutes: 30, defaultAppointmentMinutes: 30, taxPercent: 0, invoicePrefix: 'INV-', nextInvoiceNumber: existing?.nextInvoiceNumber || 1, nextFileNumber: existing?.nextFileNumber || 1, setupDone: true, createdAt: existing?.createdAt || now, updatedAt: now })
    const users = await db.users.toArray()
    let admin = users.find(u => u.role === 'admin')
    if (!admin) {
      admin = { id: 'u-admin', name: 'د. أحمد الخطيب', role: 'admin', pinHash: await sha(`${salt}:1234`), pinSalt: salt, color: '#0E8F86', specialty: 'طب الأسنان العام', active: true, createdAt: now, updatedAt: now }
      await db.users.put(admin)
      await db.users.put({ id: 'u-doc2', name: 'د. ليلى حداد', role: 'doctor', pinHash: await sha(`${salt}:1234`), pinSalt: salt, color: '#7C3AED', specialty: 'تقويم الأسنان', active: true, createdAt: now, updatedAt: now })
      await db.users.put({ id: 'u-rec', name: 'سارة يوسف', role: 'receptionist', pinHash: await sha(`${salt}:1234`), pinSalt: salt, color: '#DB2777', active: true, createdAt: now, updatedAt: now })
    }
    localStorage.setItem('dentora.session', admin.id)
    localStorage.setItem('dentora.lang', lang)
    return admin.id
  }, { lang, clinicName })
  await page.goto(BASE + '/index.html#/')
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
  return userId
}

export async function shot(page, name, { dir = process.env.QA_SHOTS || 'qa-shots', full = false } = {}) {
  fs.mkdirSync(path.join(ROOT, dir), { recursive: true })
  const file = path.join(ROOT, dir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: full })
  console.log('shot', path.relative(ROOT, file))
  return file
}
