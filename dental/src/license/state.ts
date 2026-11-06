// Pure licence arithmetic: the trial countdown and the status the app shows. No React, no database
// (covered by tests/license-state.test.ts).
import { TRIAL_DAYS, type CodeCheck, type Plan } from './core'

const DAY = 86_400_000

export type LicenseStatus = 'trial' | 'active' | 'expired'
/** Why the app is read-only: the trial ran out, or a paid licence passed its last day. */
export type EndedReason = 'trial' | 'license'

export interface LicenseEval {
  status: LicenseStatus
  ended: EndedReason | null
  plan: Plan | null
  until: Date | null          // active: the licence's last day (null = lifetime); ended licence: the day it ended
  daysLeft: number            // trial days left, or licence days left (9999 for lifetime)
}

/**
 * Trial days left at `now` (the licence clock), from 0 to TRIAL_DAYS. A start in the future (an edited backup,
 * a clock moved back past the start) counts as no trial left: it can never extend the trial.
 */
export function trialDaysLeft(installedAt: string | null | undefined, now: number): number {
  const start = installedAt ? new Date(installedAt).getTime() : NaN
  if (!Number.isFinite(start)) return TRIAL_DAYS
  if (start > now + DAY) return 0
  return Math.min(TRIAL_DAYS, Math.max(0, Math.ceil((start + TRIAL_DAYS * DAY - now) / DAY)))
}

/** The status from the trial start and the check of the stored code (null = no code stored). */
export function evaluateLicense(installedAt: string | null | undefined, stored: CodeCheck | null, now: number): LicenseEval {
  if (stored?.ok) {
    const left = stored.until ? Math.max(0, Math.ceil((stored.until.getTime() + DAY - now) / DAY)) : 9999
    return { status: 'active', ended: null, plan: stored.plan, until: stored.until, daysLeft: left }
  }
  // a code made for this device that has run out: the clinic paid, so say "licence ended", not "trial ended"
  if (stored && stored.reason === 'expired') return { status: 'expired', ended: 'license', plan: stored.plan, until: stored.until, daysLeft: 0 }
  const left = trialDaysLeft(installedAt, now)
  return left > 0
    ? { status: 'trial', ended: null, plan: null, until: null, daysLeft: left }
    : { status: 'expired', ended: 'trial', plan: null, until: null, daysLeft: 0 }
}
