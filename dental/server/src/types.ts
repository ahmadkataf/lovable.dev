// The contract between the Worker's parts: the landing page (src/pages/landing.ts), the control panel
// (site/admin/*, talking to /api/*) and the backend (src/index.ts, src/api.ts, src/db.ts, src/auth.ts).
// Change it only together with every side that uses it.

export interface Env {
  DB: D1Database
  /** Static files (public/, assembled by scripts/build-public.mjs): css, images, fonts, the admin page, the APK. */
  ASSETS: Fetcher
  /** Secret: the control panel password (at least 12 characters, or the panel refuses to open). */
  ADMIN_PASSWORD?: string
  /** Secret: the seller's private signing key (the JSON text of license-private.jwk). Without it the panel cannot make codes. */
  LICENSE_PRIVATE_JWK?: string
}

export type Lang = 'ar' | 'en'

/** What the seller edits in the control panel (Settings) and the landing page shows. Stored in D1 `settings`. */
export interface SiteSettings {
  /** The price in US dollars, for the structured data (schema.org Offer) and the panel's default sale price. */
  priceUsd: number
  /** The price line as shown, e.g. "ترخيص مدى الحياة: 59$ فقط" / "Lifetime licence: just $59". */
  priceTextAr: string
  priceTextEn: string
  /** The seller's WhatsApp, international format: "+963 996 489 504". */
  whatsapp: string
  /** Optional contact e-mail shown in the footer ('' = hidden). */
  email: string
  /** Where "Download for Windows" goes (the installer is too large to host on the Worker): '' = ask on WhatsApp. */
  windowsUrl: string
  /** An optional line shown in a bar at the top of the landing page ('' = none). */
  announcementAr: string
  announcementEn: string
}

export const DEFAULT_SETTINGS: SiteSettings = {
  priceUsd: 59,
  priceTextAr: 'ترخيص مدى الحياة: ⁦59$⁩ فقط',
  priceTextEn: 'Lifetime licence: just $59',
  whatsapp: '+963 996 489 504',
  email: '',
  windowsUrl: '',
  announcementAr: '',
  announcementEn: '',
}

/** What the landing page needs besides the settings. */
export interface LandingContext {
  /** The Android APK is published on this Worker (public/files/meta.json exists). */
  apk: { version: string; sizeBytes: number } | null
  /** The canonical origin, e.g. "https://dentora.raqeem.dev" (for canonical/OG/hreflang URLs). */
  origin: string
}

// ---- control panel API (JSON over /api/*; session cookie; see SPEC.md) -----------------------------------------

export type Plan = 'standard' | 'pro'
export type Validity = 'lifetime' | '1y' | '2y' | 'date'
export type LicenceStatus = 'active' | 'refunded' | 'void'

export interface Licence {
  id: string
  /** The device number as the app shows it, "XXXX-XXXX". */
  device: string
  plan: Plan
  /** Last valid day "YYYY-MM-DD", or null for lifetime. */
  until: string | null
  /** The 112-character code, grouped in fours with dashes. */
  code: string
  customer: string
  clinic: string
  /** The customer's WhatsApp/phone as typed. */
  phone: string
  /** What the customer paid, in US dollars. */
  price: number
  note: string
  status: LicenceStatus
  /** ISO timestamp. */
  createdAt: string
}

export interface ResetCode {
  id: string
  device: string
  code: string
  /** First and last valid day, "YYYY-MM-DD" (UTC). */
  day: string
  lastDay: string
  customer: string
  phone: string
  note: string
  createdAt: string
}

export interface AuditEntry { id: number; at: string; action: string; detail: string; ip: string }

export interface Stats {
  licences: { total: number; month: number; revenue: number; revenueMonth: number }
  resets: { total: number }
  downloads: { android: number; windows: number; android30: number; windows30: number }
  /** The last 10 audit entries. */
  recent: AuditEntry[]
}

/** The ready-to-send message for the customer, in both languages, plus a wa.me link to the customer's phone (or null without a phone). */
export interface CustomerMessage { ar: string; en: string; whatsappUrl: string | null }
