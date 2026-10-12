// The contract between the Worker's parts: the landing page (src/pages/landing.ts), the activation page
// (src/pages/activate.ts), the control panel (site/admin/*, talking to /api/*) and the backend (src/index.ts,
// src/api.ts, src/db.ts, src/auth.ts).
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

/**
 * The canonical address (canonical, hreflang, sitemap; the workers.dev copy points search engines here), also the
 * site of the activation page named in key messages.
 */
export const ORIGIN = 'https://dentora.raqeem.dev'

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

/**
 * One sale: a code made for a device (the seller had its device number), or a licence key the clinic turns into
 * that code itself on first use (POST /api/activate, docs/LICENCE-KEYS.md). Both are listed, searched and counted
 * together.
 */
export interface Licence {
  id: string
  /** The device number as the app shows it, "XXXX-XXXX"; '' for a key not activated yet. */
  device: string
  plan: Plan
  /** Last valid day "YYYY-MM-DD", or null for lifetime (and for a 1y/2y key not activated yet: see `validity`). */
  until: string | null
  /** The 112-character code, grouped in fours with dashes; '' for a key not activated yet. */
  code: string
  /** "XXXX-XXXX-XXXX-XXXX" for a sale made as a licence key, else null. */
  key: string | null
  /** A key's rule for `until`, applied on activation (1y/2y count from the activation day); null for a device licence. */
  validity: Validity | null
  /** ISO time a key was activated; null while it waits, and for a device licence. */
  activatedAt: string | null
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
  /** `pending`: active keys not activated yet. */
  licences: { total: number; month: number; revenue: number; revenueMonth: number; pending: number }
  resets: { total: number }
  downloads: { android: number; windows: number; android30: number; windows30: number }
  /** The last 10 audit entries. */
  recent: AuditEntry[]
}

/** The ready-to-send message for the customer, in both languages, plus a wa.me link to the customer's phone (or null without a phone). */
export interface CustomerMessage { ar: string; en: string; whatsappUrl: string | null }

// ---- public key activation (POST /api/activate; no session; see docs/LICENCE-KEYS.md) ---------------------------

/** What POST /api/activate answers: the activation code a licence key made for a device. */
export interface Activation {
  /** The 112-character code, grouped in fours with dashes. */
  code: string
  /** "XXXX-XXXX". */
  device: string
  plan: Plan
  /** Last valid day "YYYY-MM-DD", or null for lifetime. */
  until: string | null
}
/**
 * Its errors: 400 key | device | field (body), 404 unknown, 409 used (another device), 410 void | expired,
 * 429 locked (+ retryAfter seconds), 503 signing, 500 server.
 */
export type ActivateError = 'key' | 'device' | 'field' | 'unknown' | 'used' | 'void' | 'expired' | 'locked' | 'signing' | 'server'

/** Where a licence key stands (POST /api/verify): waiting, activated, or marked refunded/void by the seller. */
export type KeyStatus = 'pending' | 'activated' | 'refunded' | 'void' | 'unknown'

/**
 * What POST /api/verify answers. A code: `until` = an activation code's last day (null = lifetime), a reset code's
 * last day. A key (`kind: 'key'`): its `status`, and what is known of it: `device` and `activatedAt` once activated,
 * `until` once known (a waiting 1y/2y key has none yet; `validity` says how it will be set).
 */
export interface VerifyResult {
  kind: 'activation' | 'reset' | 'key' | null
  ok: boolean
  plan?: Plan
  until?: string | null
  reason?: 'format' | 'device' | 'kind' | 'expired'
  status?: KeyStatus
  device?: string
  validity?: Validity
  activatedAt?: string
}
