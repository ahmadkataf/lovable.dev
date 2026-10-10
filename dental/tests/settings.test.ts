import { db, DEFAULT_CLINIC, exportBackup, nextInvoiceNumber, resetDatabase, setSetting, getSetting, updateClinic } from '../src/db'
import type { BackupFile, Clinic } from '../src/db/types'
import { checkCode, deviceNumber } from '../src/license/core'
import {
  backupAgeDays, backupFileName, backupHealth, billingDraftFrom, billingPatch, clinicDraftFrom, clinicPatch, formatCodeInput, hoursPerDay,
  invoiceSeq, isCodeComplete, isWebsite, lastInvoiceSeq, lockMinutes, lockMs, mailtoLink, parseBackup, previewInvoiceNumber, renewSoon,
  resolveTab, sampleTotals, trialUsedPercent, typedConfirm, validateBilling, validateClinic, validateHours, visibleTabs, withCurrency,
} from '../src/features/settings/lib'
import { eraseEverything, restoreBackup } from '../src/features/settings/backup'
import { clinicMessage, formatDeviceInput, isDeviceNumber, issueCode, parseLog, parseUntil, toCSV, untilISO, waLink } from '../tools/generator-lib'

const clinic = (p: Partial<Clinic> = {}): Clinic => ({ ...DEFAULT_CLINIC, name: 'عيادة الابتسامة', setupDone: true, ...p })

describe('settings tabs', () => {
  it('hides the backup tab from non-admins and falls back to the first tab', () => {
    expect(visibleTabs(true)).toEqual(['clinic', 'preferences', 'billing', 'backup', 'license', 'about'])
    expect(visibleTabs(false)).not.toContain('backup')
    expect(resolveTab('license', visibleTabs(true))).toBe('license')
    expect(resolveTab('backup', visibleTabs(false))).toBe('clinic')
    expect(resolveTab(undefined, visibleTabs(true))).toBe('clinic')
    expect(resolveTab('nope', visibleTabs(true))).toBe('clinic')
  })
})

describe('auto-lock', () => {
  it('maps the stored milliseconds to the closest option', () => {
    expect(lockMinutes(null)).toBe(15)
    expect(lockMinutes('0')).toBe(0)
    expect(lockMinutes(String(lockMs(30)))).toBe(30)
    expect(lockMinutes(String(lockMs(60)))).toBe(60)
    expect(lockMinutes('400000')).toBe(5)        // 6.7 min → 5
    expect(lockMinutes('garbage')).toBe(15)
    expect(lockMs(5)).toBe(300_000)
  })
})

describe('working hours', () => {
  it('needs a day and an end after the start', () => {
    const ok = { workingDays: [0, 1], workStart: '09:00', workEnd: '17:30', slotMinutes: 30, defaultAppointmentMinutes: 30 }
    expect(validateHours(ok)).toEqual({})
    expect(validateHours({ ...ok, workingDays: [] }).workingDays?.key).toBe('settings.pref.err.days')
    expect(validateHours({ ...ok, workEnd: '08:00' }).workEnd?.key).toBe('settings.pref.err.hours')
    expect(validateHours({ ...ok, workEnd: '09:00' }).workEnd?.key).toBe('settings.pref.err.hours')
    expect(hoursPerDay('09:00', '17:30')).toBe(8.5)
    expect(hoursPerDay('18:00', '09:00')).toBe(0)
  })
})

describe('clinic identity', () => {
  it('validates and trims', () => {
    const d = clinicDraftFrom(clinic({ email: 'x@y.com' }))
    expect(validateClinic(d)).toEqual({})
    expect(validateClinic({ ...d, name: '  ' }).name?.key).toBe('v.required')
    expect(validateClinic({ ...d, email: 'nope' }).email?.key).toBe('v.email')
    expect(validateClinic({ ...d, phone: '12' }).phone?.key).toBe('v.phone')
    expect(validateClinic({ ...d, phone: '٠٩٤٤ ١٢٣ ٤٥٦' }).phone).toBeUndefined()
    expect(validateClinic({ ...d, website: 'not a site' }).website?.key).toBe('settings.err.website')
    const p = clinicPatch({ ...d, name: ' عيادة ', tagline: '  ', phone: '٠٩٤٤١٢٣٤٥٦', logo: '' })
    expect(p.name).toBe('عيادة')
    expect(p.tagline).toBeUndefined()
    expect(p.phone).toBe('0944123456')
    expect(p.logo).toBeUndefined()
    expect(isWebsite('www.clinic.com')).toBe(true)
    expect(isWebsite('https://smile.sy/ar')).toBe(true)
    expect(isWebsite('clinic')).toBe(false)
  })
})

describe('billing settings', () => {
  it('round-trips presets and custom currencies', () => {
    const d = billingDraftFrom(clinic({ currency: 'SYP', currencySymbol: 'ل.س', currencyDecimals: 0 }))
    expect(d.currency).toBe('SYP')
    const usd = withCurrency(d, 'USD')
    expect([usd.symbol, usd.decimals]).toEqual(['$', 2])
    const custom = billingDraftFrom(clinic({ currency: 'YER', currencySymbol: 'ر.ي' }))
    expect(custom.currency).toBe('custom')
    expect(custom.customCode).toBe('YER')
    expect(billingPatch(custom).currency).toBe('YER')
    expect(billingPatch({ ...usd, invoiceFooter: '  ' }).invoiceFooter).toBeUndefined()
  })
  it('never lets the counters go back over used numbers', () => {
    const d = billingDraftFrom(clinic())
    const used = { lastInvoiceSeq: 41, lastFileNo: 120 }
    expect(validateBilling({ ...d, nextInvoiceNumber: 42, nextFileNumber: 121 }, used)).toEqual({})
    expect(validateBilling({ ...d, nextInvoiceNumber: 41, nextFileNumber: 121 }, used).nextInvoiceNumber).toEqual({ key: 'settings.bill.err.nextInvoice', params: { n: 41 } })
    expect(validateBilling({ ...d, nextInvoiceNumber: 42, nextFileNumber: 100 }, used).nextFileNumber?.params).toEqual({ n: 120 })
    expect(validateBilling({ ...d, nextInvoiceNumber: 1.5, nextFileNumber: 121 }, used).nextInvoiceNumber?.key).toBe('settings.bill.err.whole')
    expect(validateBilling({ ...d, nextInvoiceNumber: 42, nextFileNumber: 121, taxPercent: 120 }, used).taxPercent?.key).toBe('settings.bill.err.tax')
    expect(validateBilling({ ...d, nextInvoiceNumber: 42, nextFileNumber: 121, invoicePrefix: 'فاتورة' }, used).invoicePrefix?.key).toBe('settings.bill.err.prefix')
    expect(validateBilling({ ...withCurrency(d, 'custom'), customCode: 'Y', symbol: 'x', nextInvoiceNumber: 42, nextFileNumber: 121 }, used).customCode?.key).toBe('settings.bill.err.code')
  })
  it('reads invoice sequences per prefix', () => {
    expect(invoiceSeq('INV-000123', 'INV-')).toBe(123)
    expect(invoiceSeq('A-000123', 'INV-')).toBeNull()
    expect(invoiceSeq('INV-DRAFT', 'INV-')).toBeNull()
    expect(lastInvoiceSeq(['INV-000007', 'INV-000012', 'X-000900', 'INV-ab'], 'INV-')).toBe(12)
    expect(lastInvoiceSeq([], 'INV-')).toBe(0)
  })
  it('previews the number exactly as the database will issue it', async () => {
    await resetDatabase()
    await updateClinic({ invoicePrefix: 'SM-', nextInvoiceNumber: 57 })
    expect(previewInvoiceNumber('SM-', 57)).toBe(await nextInvoiceNumber())
  })
  it('computes the sample invoice with tax', () => {
    expect(sampleTotals(0)).toEqual({ subtotal: 1000, tax: 0, total: 1000 })
    expect(sampleTotals(15)).toEqual({ subtotal: 1000, tax: 150, total: 1150 })
    expect(sampleTotals(null).tax).toBe(0)
  })
})

describe('backup checks', () => {
  const good: BackupFile = { app: 'dentora', version: 1, exportedAt: '2026-10-01T10:00:00.000Z', tables: { clinic: [{ id: 'clinic', name: 'عيادة النور' }], users: [{}], patients: [{}, {}], appointments: [{}], invoices: [] } }
  it('accepts a Dentora backup and summarises it', () => {
    const r = parseBackup(JSON.stringify(good))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.summary).toMatchObject({ clinicName: 'عيادة النور', patients: 2, appointments: 1, invoices: 0, rows: 5, tables: 5, version: 1 })
    expect(parseBackup('﻿' + JSON.stringify(good)).ok).toBe(true)
  })
  it('rejects anything else with a reason', () => {
    expect(parseBackup('{oops')).toEqual({ ok: false, reason: 'json' })
    expect(parseBackup('[1,2]')).toEqual({ ok: false, reason: 'json' })
    expect(parseBackup(JSON.stringify({ ...good, app: 'other' }))).toEqual({ ok: false, reason: 'app' })
    expect(parseBackup(JSON.stringify({ app: 'dentora', version: 1 }))).toEqual({ ok: false, reason: 'tables' })
    expect(parseBackup(JSON.stringify({ ...good, tables: { clinic: [], users: [] } }))).toEqual({ ok: false, reason: 'tables' })
    expect(parseBackup(JSON.stringify({ ...good, tables: { ...good.tables, notes: 'x' } }))).toEqual({ ok: false, reason: 'tables' })
    expect(parseBackup(JSON.stringify({ ...good, version: 9 }), 1)).toEqual({ ok: false, reason: 'newer' })
  })
  it('names files by local date and tracks the backup age', () => {
    expect(backupFileName(new Date(2026, 9, 5, 23, 59))).toBe('dentora-backup-2026-10-05.json')
    const now = new Date('2026-10-10T12:00:00Z')
    expect(backupAgeDays(null, now)).toBeNull()
    expect(backupAgeDays('2026-10-03T12:00:00Z', now)).toBe(7)
    expect(backupHealth(null, now)).toBe('never')
    expect(backupHealth('2026-10-03T12:00:00Z', now)).toBe('old')
    expect(backupHealth('2026-10-04T13:00:00Z', now)).toBe('ok')
  })
  it('type-to-confirm ignores case, spaces and hamza forms', () => {
    expect(typedConfirm('استبدال', 'استبدال')).toBe(true)
    expect(typedConfirm(' إستبدال ', 'استبدال')).toBe(true)
    expect(typedConfirm('replace', 'REPLACE')).toBe(true)
    expect(typedConfirm('استبد', 'استبدال')).toBe(false)
    expect(typedConfirm('', '')).toBe(false)
  })
})

describe('restore and reset keep this device’s activation', () => {
  beforeEach(async () => { await resetDatabase() })
  it('erases the clinic but not the licence or the trial start', async () => {
    await db.clinic.put(clinic())
    await db.patients.put({ id: 'p1', fileNo: 1, name: 'مريض', gender: 'male', allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: '', updatedAt: '' })
    await setSetting('license', { code: 'X', plan: 'pro', until: null })
    await setSetting('installedAt', '2026-10-01T00:00:00.000Z')
    await setSetting('lastBackupAt', '2026-10-02T00:00:00.000Z')
    localStorage.setItem('dentora.session', 'u-admin')
    await eraseEverything()
    expect(await db.patients.count()).toBe(0)
    expect(await db.clinic.count()).toBe(0)
    expect(await getSetting('license', null)).toEqual({ code: 'X', plan: 'pro', until: null })
    expect(await getSetting('installedAt', null)).toBe('2026-10-01T00:00:00.000Z')
    expect(await getSetting('lastBackupAt', null)).toBeNull()
    expect(localStorage.getItem('dentora.session')).toBeNull()
  })
  it('restores another device’s backup without taking over its licence', async () => {
    await db.clinic.put(clinic({ name: 'قديمة' }))
    await setSetting('license', { code: 'OLD', plan: 'standard', until: null })
    const backup = await exportBackup()
    await setSetting('license', { code: 'MINE', plan: 'pro', until: null })
    await db.clinic.put(clinic({ name: 'جديدة' }))
    const r = await restoreBackup(backup)
    expect(r.rows).toBeGreaterThan(0)
    expect((await db.clinic.get('clinic'))?.name).toBe('قديمة')
    expect(await getSetting('license', null)).toEqual({ code: 'MINE', plan: 'pro', until: null })
  })
  it('keeps the date of this device’s last export through a restore', async () => {
    const backup = await exportBackup()
    await setSetting('lastBackupAt', '2026-10-09T08:00:00.000Z')
    await restoreBackup(backup)
    expect(await getSetting('lastBackupAt', null)).toBe('2026-10-09T08:00:00.000Z')
  })
})

describe('licence code input', () => {
  it('formats while typing', () => {
    expect(formatCodeInput('abcd')).toBe('ABCD')
    expect(formatCodeInput('abcde')).toBe('ABCD-E')
    expect(formatCodeInput('ab cd-ef gh--jk lm np qr st')).toBe('ABCD-EFGH-JKLM-NPQR')
    expect(formatCodeInput('٢٣٤٥')).toBe('2345')
    expect(isCodeComplete('ABCD-EFGH-JKLM-NPQR')).toBe(true)
    expect(isCodeComplete('ABCD-EFGH')).toBe(false)
  })
  it('derives the trial bar and the renewal warning', () => {
    expect(trialUsedPercent(7, 7)).toBe(0)
    expect(trialUsedPercent(0, 7)).toBe(100)
    expect(trialUsedPercent(5, 7)).toBe(29)
    const now = new Date('2026-10-10T00:00:00Z')
    expect(renewSoon(null, now)).toBe(false)
    expect(renewSoon(new Date('2026-10-30T00:00:00Z'), now)).toBe(true)
    expect(renewSoon(new Date('2027-10-30T00:00:00Z'), now)).toBe(false)
    expect(mailtoLink('a@b.co', 'طلب', 'x y')).toBe('mailto:a@b.co?subject=%D8%B7%D9%84%D8%A8&body=x%20y')
  })
})

describe('seller code generator', () => {
  const now = new Date('2026-10-10T15:00:00Z')
  it('parses validity', () => {
    expect(parseUntil('lifetime', now)).toBeNull()
    expect(untilISO(parseUntil('1y', now)!)).toBe('2027-10-10')
    expect(untilISO(parseUntil('2y', now)!)).toBe('2028-10-10')
    expect(untilISO(parseUntil('2027-02-28', now)!)).toBe('2027-02-28')
    expect(parseUntil('2027-02-30', now)).toBeUndefined()
    expect(parseUntil('2020-01-01', now)).toBeUndefined()
    expect(parseUntil('soon', now)).toBeUndefined()
  })
  it('validates and formats device numbers', () => {
    expect(formatDeviceInput('7kq4m2xd')).toBe('7KQ4-M2XD')
    expect(isDeviceNumber('7KQ4-M2XD')).toBe(true)
    expect(isDeviceNumber('7KQ4-M2X')).toBe(false)
    expect(isDeviceNumber('7KQ4-M2X0')).toBe(false)          // 0 is not in the alphabet
  })
  it('issues codes the app accepts, for that device only', async () => {
    const device = await deviceNumber('clinic-pc-1')
    const other = await deviceNumber('clinic-pc-2')
    const lifetime = await issueCode(device, 'pro', null)
    expect(await checkCode(device, lifetime.code)).toEqual({ ok: true, plan: 'pro', until: null })
    expect((await checkCode(other, lifetime.code)).ok).toBe(false)
    const yearly = await issueCode(device.toLowerCase().replace('-', ''), 'standard', parseUntil('1y')!)
    const r = await checkCode(device, yearly.code)
    expect(r.ok && r.plan).toBe('standard')
    expect(yearly.device).toBe(device)
    await expect(issueCode('nope', 'pro', null)).rejects.toThrow('device')
  })
  it('writes the clinic message, the WhatsApp link and the CSV log', () => {
    const i = { code: 'ABCD-EFGH-JKLM-NPQR', plan: 'pro' as const, until: '2027-10-10', device: '7KQ4-M2XD' }
    expect(clinicMessage(i, 'ar', 'عيادة النور')).toContain('ABCD-EFGH-JKLM-NPQR')
    expect(clinicMessage(i, 'ar')).toContain('صالح حتى 2027-10-10')
    expect(clinicMessage({ ...i, until: null }, 'en')).toContain('lifetime license')
    expect(waLink('0944 123 456', 'hi')).toBe('https://wa.me/963944123456?text=hi')
    expect(waLink('+966 50 000 0000', 'hi')).toBe('https://wa.me/966500000000?text=hi')
    const csv = toCSV([{ ...i, at: '2026-10-10T10:00:00Z', note: 'عيادة "النور", دمشق' }])
    expect(csv.startsWith('﻿issued_at,device,plan,valid_until,code,note\r\n')).toBe(true)
    expect(csv).toContain('"عيادة ""النور"", دمشق"')
    expect(parseLog('not json')).toEqual([])
    expect(parseLog(JSON.stringify([{ code: 'A', device: 'B' }, { nope: 1 }]))).toHaveLength(1)
  })
})
