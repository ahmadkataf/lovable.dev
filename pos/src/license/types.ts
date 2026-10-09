// The license as the rest of the app sees it. The client logic lives in license/index.ts (see docs/LICENSE-SPEC.md).

export type LicenseState =
  | 'demo'      // built without a license server (development): everything open, a "demo" badge is shown
  | 'none'      // never activated on this device
  | 'trial'     // free trial running
  | 'active'    // activated
  | 'expired'   // the trial or a time-limited license ended
  | 'revoked'   // the seller cancelled the code, or it moved to another device
  | 'locked'    // offline for longer than the grace period: must reach the server again
  | 'tampered'  // the server rejected this build (modified app)

export interface SellerInfo {
  price: string          // "35$"
  whatsapp: string       // digits only, with the country code
  trialDays: number
  message?: string       // shown on the activation screen
  minVersion?: string
}

export interface LicenseStatus {
  state: LicenseState
  deviceCode: string     // short code the user reads to the seller, e.g. K7M2-QX9P
  code?: string          // the activation code in use
  plan?: 'trial' | 'full'
  expiresAt?: number | null   // null = lifetime
  graceUntil?: number    // the app must talk to the server again before this time
  lastCheck?: number
  checking: boolean
  online: boolean
  error?: string         // the last error, as a message key ('license.err.invalid_code' ...)
  info?: SellerInfo
}

/** Blocks the whole app (only the activation screen is shown). */
export const isBlocked = (s: LicenseStatus): boolean =>
  s.state === 'none' || s.state === 'expired' || s.state === 'revoked' || s.state === 'locked' || s.state === 'tampered'
