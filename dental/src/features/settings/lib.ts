// Pure helpers of the settings module: tabs, form drafts and validation, backup checks, licence-code input.
// No React and no database here, so tests/settings.test.ts can cover all of it.
import type { BackupFile, Clinic } from '@/db/types'
import type { FontKey } from '@/app/theme'
import { normalizeText, round2 } from '@/lib/format'
import {
  CUSTOM_CURRENCY, cleanCurrencyCode, currencyPreset, isEmail, isPhone, isValidCurrencyCode, normalizeDigits, timeToMin,
} from '@/features/auth/lib'

// ---- tabs -------------------------------------------------------------------------------------
export const SETTINGS_TABS = ['clinic', 'preferences', 'billing', 'backup', 'license', 'about'] as const
export type SettingsTab = typeof SETTINGS_TABS[number]
/** Tabs only an administrator sees (they hold destructive actions). */
export const ADMIN_ONLY_TABS: readonly SettingsTab[] = ['backup']

export function visibleTabs(isAdmin: boolean): SettingsTab[] {
  return SETTINGS_TABS.filter(t => isAdmin || !ADMIN_ONLY_TABS.includes(t))
}
/** The tab a URL segment points to; anything unknown or not visible falls back to the first tab. */
export function resolveTab(param: string | undefined, tabs: readonly SettingsTab[]): SettingsTab {
  return (tabs as readonly string[]).includes(param ?? '') ? (param as SettingsTab) : tabs[0]
}

// ---- errors -----------------------------------------------------------------------------------
/** A validation message: an i18n key and its parameters. */
export interface FieldError { key: string; params?: Record<string, string | number> }
export type FieldErrors = Partial<Record<string, FieldError>>
export const hasErrors = (e: FieldErrors) => Object.values(e).some(Boolean)

// ---- fonts ------------------------------------------------------------------------------------
/** The font stacks of src/styles/fonts.css, used only to render each choice in its own face. */
export const FONT_FAMILIES: Record<FontKey, string> = {
  kufi: "'Inter Variable', 'Noto Kufi Arabic Variable', 'Segoe UI', Tahoma, system-ui, sans-serif",
  sans: "'Inter Variable', 'Noto Sans Arabic Variable', 'Segoe UI', Tahoma, system-ui, sans-serif",
  cairo: "'Cairo Variable', 'Inter Variable', 'Segoe UI', Tahoma, system-ui, sans-serif",
  readex: "'Readex Pro Variable', 'Inter Variable', 'Segoe UI', Tahoma, system-ui, sans-serif",
  almarai: "'Inter Variable', 'Almarai', 'Segoe UI', Tahoma, system-ui, sans-serif",
  tajawal: "'Inter Variable', 'Tajawal', 'Segoe UI', Tahoma, system-ui, sans-serif",
  plex: "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, system-ui, sans-serif",
}
export const DEFAULT_FONT: FontKey = 'kufi'
export const FONT_SAMPLE_AMOUNT = '1,250 $'

// ---- auto-lock --------------------------------------------------------------------------------
/** localStorage key the session reads (milliseconds; 0 = never). */
export const LOCK_KEY = 'dentora.lockAfter'
export const LOCK_OPTIONS = [0, 5, 15, 30, 60] as const   // minutes
export const DEFAULT_LOCK_MIN = 15                         // the session's built-in default
export const lockMs = (minutes: number) => Math.max(0, Math.round(minutes)) * 60_000
/** The stored value (ms, as a string) → the closest option in minutes. Missing or unreadable → the default. */
export function lockMinutes(stored: string | null | undefined): number {
  if (stored === null || stored === undefined || stored.trim() === '') return DEFAULT_LOCK_MIN
  const ms = Number(stored)
  if (!Number.isFinite(ms) || ms < 0) return DEFAULT_LOCK_MIN
  if (ms === 0) return 0
  const min = ms / 60_000
  return LOCK_OPTIONS.filter(o => o > 0).reduce((best, o) => (Math.abs(o - min) < Math.abs(best - min) ? o : best), 5)
}

// ---- working hours ----------------------------------------------------------------------------
export const SLOT_CHOICES = [15, 20, 30, 60]
export const DURATION_CHOICES = [15, 20, 30, 45, 60, 90, 120]
export interface HoursDraft { workingDays: number[]; workStart: string; workEnd: string; slotMinutes: number; defaultAppointmentMinutes: number }
export function hoursDraftFrom(c: Clinic): HoursDraft {
  return { workingDays: [...(c.workingDays ?? [])].sort((a, b) => a - b), workStart: c.workStart, workEnd: c.workEnd, slotMinutes: c.slotMinutes, defaultAppointmentMinutes: c.defaultAppointmentMinutes }
}
const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '')
export function validateHours(d: HoursDraft): FieldErrors {
  const e: FieldErrors = {}
  if (!d.workingDays.length) e.workingDays = { key: 'settings.pref.err.days' }
  if (!isTime(d.workStart)) e.workStart = { key: 'v.required' }
  if (!isTime(d.workEnd)) e.workEnd = { key: 'v.required' }
  else if (isTime(d.workStart) && timeToMin(d.workEnd) <= timeToMin(d.workStart)) e.workEnd = { key: 'settings.pref.err.hours' }
  if (!(d.defaultAppointmentMinutes > 0)) e.defaultAppointmentMinutes = { key: 'settings.pref.err.duration' }
  return e
}
/** Hours open per day, rounded to a half hour (0 when the range is invalid). */
export function hoursPerDay(start: string, end: string): number {
  if (!isTime(start) || !isTime(end)) return 0
  const m = timeToMin(end) - timeToMin(start)
  return m > 0 ? Math.round((m / 60) * 2) / 2 : 0
}

// ---- clinic identity --------------------------------------------------------------------------
export interface ClinicDraft { name: string; nameEn: string; tagline: string; phone: string; phone2: string; email: string; address: string; website: string; logo: string }
export function clinicDraftFrom(c: Clinic): ClinicDraft {
  return { name: c.name ?? '', nameEn: c.nameEn ?? '', tagline: c.tagline ?? '', phone: c.phone ?? '', phone2: c.phone2 ?? '', email: c.email ?? '', address: c.address ?? '', website: c.website ?? '', logo: c.logo ?? '' }
}
/** The clinic fields to save: trimmed, empty optional fields removed. */
export function clinicPatch(d: ClinicDraft): Partial<Clinic> {
  const opt = (s: string) => (s.trim() ? s.trim() : undefined)
  return {
    name: d.name.trim(), nameEn: opt(d.nameEn), tagline: opt(d.tagline), phone: opt(normalizeDigits(d.phone)), phone2: opt(normalizeDigits(d.phone2)),
    email: opt(d.email), address: opt(d.address), website: opt(d.website), logo: d.logo || undefined,
  }
}
export function isWebsite(s: string): boolean {
  const v = (s || '').trim()
  return /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v)
}
export function validateClinic(d: ClinicDraft): FieldErrors {
  const e: FieldErrors = {}
  if (!d.name.trim()) e.name = { key: 'v.required' }
  if (d.phone.trim() && !isPhone(d.phone)) e.phone = { key: 'v.phone' }
  if (d.phone2.trim() && !isPhone(d.phone2)) e.phone2 = { key: 'v.phone' }
  if (d.email.trim() && !isEmail(d.email)) e.email = { key: 'v.email' }
  if (d.website.trim() && !isWebsite(d.website)) e.website = { key: 'settings.err.website' }
  return e
}

// ---- billing ----------------------------------------------------------------------------------
export interface BillingDraft {
  currency: string            // preset code or CUSTOM_CURRENCY
  customCode: string
  symbol: string
  decimals: 0 | 2
  taxPercent: number | null
  invoicePrefix: string
  nextInvoiceNumber: number | null
  nextFileNumber: number | null
  invoiceFooter: string
  prescriptionFooter: string
}
export function billingDraftFrom(c: Clinic): BillingDraft {
  const preset = currencyPreset(c.currency)
  return {
    currency: preset ? preset.code : CUSTOM_CURRENCY, customCode: preset ? '' : (c.currency || ''), symbol: c.currencySymbol ?? '',
    decimals: c.currencyDecimals === 0 ? 0 : 2, taxPercent: c.taxPercent ?? 0, invoicePrefix: c.invoicePrefix ?? '',
    nextInvoiceNumber: c.nextInvoiceNumber ?? 1, nextFileNumber: c.nextFileNumber ?? 1, invoiceFooter: c.invoiceFooter ?? '', prescriptionFooter: c.prescriptionFooter ?? '',
  }
}
/** Picking a preset fills its symbol and usual decimals; "custom" keeps what was typed. */
export function withCurrency(d: BillingDraft, code: string): BillingDraft {
  if (code === CUSTOM_CURRENCY) return { ...d, currency: code, symbol: d.currency === CUSTOM_CURRENCY ? d.symbol : '' }
  const p = currencyPreset(code)
  return p ? { ...d, currency: p.code, symbol: p.symbol, decimals: p.decimals } : d
}
export function billingPatch(d: BillingDraft): Partial<Clinic> {
  const currency = d.currency === CUSTOM_CURRENCY ? cleanCurrencyCode(d.customCode) : d.currency
  return {
    currency, currencySymbol: d.symbol.trim() || currency, currencyDecimals: d.decimals, taxPercent: round2(d.taxPercent ?? 0),
    invoicePrefix: d.invoicePrefix.trim(), nextInvoiceNumber: Math.floor(d.nextInvoiceNumber ?? 1), nextFileNumber: Math.floor(d.nextFileNumber ?? 1),
    invoiceFooter: d.invoiceFooter.trim() || undefined, prescriptionFooter: d.prescriptionFooter.trim() || undefined,
  }
}
/** The same format db.nextInvoiceNumber() writes: prefix + 6 digits. */
export function previewInvoiceNumber(prefix: string, n: number): string {
  return `${prefix || ''}${String(Math.max(1, Math.floor(n || 1))).padStart(6, '0')}`
}
/** 'INV-000123' with prefix 'INV-' → 123; numbers with another prefix → null. */
export function invoiceSeq(number: string, prefix: string): number | null {
  const p = prefix || ''
  if (!number || !number.startsWith(p)) return null
  const rest = number.slice(p.length)
  return /^\d+$/.test(rest) ? Number(rest) : null
}
/** The highest sequence already used with this prefix (0 when none). */
export function lastInvoiceSeq(numbers: string[], prefix: string): number {
  let max = 0
  for (const n of numbers) { const s = invoiceSeq(n, prefix); if (s !== null && s > max) max = s }
  return max
}
export const PREFIX_RE = /^[A-Za-z0-9\-/_.#]{0,10}$/
const isWhole = (n: number | null): n is number => n !== null && Number.isInteger(n) && n >= 1
export function validateBilling(d: BillingDraft, used: { lastInvoiceSeq: number; lastFileNo: number }): FieldErrors {
  const e: FieldErrors = {}
  if (d.currency === CUSTOM_CURRENCY && !isValidCurrencyCode(cleanCurrencyCode(d.customCode))) e.customCode = { key: 'settings.bill.err.code' }
  if (!d.symbol.trim()) e.symbol = { key: 'settings.bill.err.symbol' }
  if (d.taxPercent === null || !Number.isFinite(d.taxPercent) || d.taxPercent < 0 || d.taxPercent > 100) e.taxPercent = { key: 'settings.bill.err.tax' }
  if (!PREFIX_RE.test(d.invoicePrefix.trim())) e.invoicePrefix = { key: 'settings.bill.err.prefix' }
  if (!isWhole(d.nextInvoiceNumber)) e.nextInvoiceNumber = { key: 'settings.bill.err.whole' }
  else if (d.nextInvoiceNumber <= used.lastInvoiceSeq) e.nextInvoiceNumber = { key: 'settings.bill.err.nextInvoice', params: { n: used.lastInvoiceSeq } }
  if (!isWhole(d.nextFileNumber)) e.nextFileNumber = { key: 'settings.bill.err.whole' }
  else if (d.nextFileNumber <= used.lastFileNo) e.nextFileNumber = { key: 'settings.bill.err.nextFile', params: { n: used.lastFileNo } }
  return e
}
/** A two-line invoice for the live preview, taxed at the draft rate. */
export const SAMPLE_LINES = [650, 350]
export function sampleTotals(taxPercent: number | null): { subtotal: number; tax: number; total: number } {
  const subtotal = SAMPLE_LINES.reduce((a, b) => a + b, 0)
  const rate = taxPercent && taxPercent > 0 && taxPercent <= 100 ? taxPercent : 0
  const tax = round2((subtotal * rate) / 100)
  return { subtotal, tax, total: round2(subtotal + tax) }
}

// ---- backup -----------------------------------------------------------------------------------
export const BACKUP_REMIND_DAYS = 7
/** Settings rows that belong to this installation (its activation and trial start): kept through restore and reset. */
export const DEVICE_SETTING_KEYS = ['license', 'installedAt'] as const
/** Tables a backup must contain to be restorable. */
export const REQUIRED_TABLES = ['clinic', 'users', 'patients'] as const

export function backupFileName(d: Date = new Date()): string {
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `dentora-backup-${iso}.json`
}
export interface BackupSummary { exportedAt?: string; version: number; clinicName?: string; patients: number; appointments: number; invoices: number; rows: number; tables: number }
export type BackupCheck = { ok: true; data: BackupFile; summary: BackupSummary } | { ok: false; reason: 'json' | 'app' | 'tables' | 'newer' }

export function summarizeBackup(data: BackupFile): BackupSummary {
  const tables = data.tables ?? {}
  const n = (k: string) => (Array.isArray(tables[k]) ? tables[k].length : 0)
  const clinic = (Array.isArray(tables.clinic) ? tables.clinic[0] : undefined) as Partial<Clinic> | undefined
  const lists = Object.values(tables).filter(Array.isArray)
  return {
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : undefined, version: Number(data.version) || 1,
    clinicName: clinic?.name || clinic?.nameEn || undefined,
    patients: n('patients'), appointments: n('appointments'), invoices: n('invoices'),
    rows: lists.reduce((a, l) => a + l.length, 0), tables: lists.length,
  }
}
/** Reads a backup file's text: is it JSON, is it ours, is it complete, can this version read it? */
export function parseBackup(text: string, schemaVersion = 1): BackupCheck {
  let data: unknown
  try { data = JSON.parse(text.replace(/^﻿/, '')) } catch { return { ok: false, reason: 'json' } }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'json' }
  const b = data as Partial<BackupFile>
  if (b.app !== 'dentora') return { ok: false, reason: 'app' }
  const tables = b.tables as Record<string, unknown> | undefined
  if (!tables || typeof tables !== 'object' || Array.isArray(tables)) return { ok: false, reason: 'tables' }
  if (REQUIRED_TABLES.some(k => !Array.isArray(tables[k]))) return { ok: false, reason: 'tables' }
  if (Object.values(tables).some(v => !Array.isArray(v))) return { ok: false, reason: 'tables' }
  if (Number(b.version) > schemaVersion) return { ok: false, reason: 'newer' }
  const file = b as BackupFile
  return { ok: true, data: file, summary: summarizeBackup(file) }
}
/** Whole days since the last backup (null = never). */
export function backupAgeDays(lastISO: string | null | undefined, now: Date = new Date()): number | null {
  if (!lastISO) return null
  const t = new Date(lastISO).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000))
}
export type BackupHealth = 'never' | 'old' | 'ok'
export function backupHealth(lastISO: string | null | undefined, now: Date = new Date(), days = BACKUP_REMIND_DAYS): BackupHealth {
  const age = backupAgeDays(lastISO, now)
  if (age === null) return 'never'
  return age >= days ? 'old' : 'ok'
}
/** Type-to-confirm: case, spacing, tashkeel and hamza forms do not matter. */
export function typedConfirm(input: string, word: string): boolean {
  const a = normalizeText(input).replace(/\s+/g, ''), b = normalizeText(word).replace(/\s+/g, '')
  return a.length > 0 && a === b
}

// ---- licence ----------------------------------------------------------------------------------
export const CODE_CHARS = 16
/** What the activation field shows while typing: upper case, digits normalised, grouped XXXX-XXXX-XXXX-XXXX. */
export function formatCodeInput(raw: string): string {
  const clean = normalizeDigits(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, CODE_CHARS)
  return (clean.match(/.{1,4}/g) || []).join('-')
}
export const codeChars = (s: string) => (s || '').replace(/[^0-9A-Z]/gi, '').length
export const isCodeComplete = (s: string) => codeChars(s) === CODE_CHARS
/** Share of the trial already used, 0–100. */
export function trialUsedPercent(daysLeft: number, total: number): number {
  if (total <= 0) return 100
  return Math.round((Math.min(total, Math.max(0, total - daysLeft)) / total) * 100)
}
/** When the trial ends: the install instant plus the trial length, the same instant useLicense() counts down to. */
export function trialEndsAt(installedAt: string | null | undefined, days: number): Date | null {
  if (!installedAt) return null
  const t = new Date(installedAt).getTime()
  return Number.isNaN(t) ? null : new Date(t + days * 86_400_000)
}
/** A code's last valid day ('YYYY-MM-DD'). Codes store UTC days, so read the UTC date, not the local one. */
export const codeDay = (until: Date): string => until.toISOString().slice(0, 10)
/** True when an active subscription ends within `days` (lifetime never does). */
export function renewSoon(until: Date | null, now: Date = new Date(), days = 30): boolean {
  if (!until) return false
  return until.getTime() - now.getTime() <= days * 86_400_000
}
export function mailtoLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
