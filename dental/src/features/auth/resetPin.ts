// Admin PIN reset with a code from the seller: the way back in when the clinic's only admin forgot the PIN.
// The seller signs "dentora|reset|<device>|<day>" with the licence key (scripts/code-generator.mjs reset <device>);
// the code works on that device, on its day and the next, once. It sets a new PIN for an admin account (turning
// that account back on if it was switched off) and clears its sign-in lock. Patient data is never touched.
import { db, getSetting, logActivity } from '@/db'
import { nowISO } from '@/db/ids'
import { hashPin, randomHex } from '@/lib/crypto'
import { checkResetCode, cleanCode, dayNumber, extractCode, type ResetCheck } from '@/license/core'
import { saveGuard } from './guardStore'
import { pinError } from './lib'

export const RESET_USED_SETTING = 'pinResetUsed'
type Used = { day: number; code: string }
export type ResetResult = ResetCheck | { ok: false; reason: 'used' }

/** The codes already used, as stored (anything unreadable is ignored). */
function parseUsed(v: unknown): Used[] {
  return Array.isArray(v) ? v.filter((u): u is Used => !!u && typeof u.code === 'string' && Number.isFinite(u.day)) : []
}

/**
 * Checks a pasted reset code for this device: signature, dates, and that it was not used before. `now` is the
 * licence clock; the code is also accepted when it is in date by the device clock (`deviceNow`), because the
 * licence clock stands still after a date that was once set too far ahead is corrected, and the locked-out admin
 * must still get in with a code issued today. Reuse is stopped by the used list. `publicKey`: tests only.
 */
export async function checkReset(device: string, pasted: string, now: number, publicKey?: JsonWebKey, deviceNow = Date.now()): Promise<ResetResult> {
  let r = await checkResetCode(device, pasted, new Date(now), publicKey)
  if (!r.ok && r.reason === 'expired' && deviceNow !== now) r = await checkResetCode(device, pasted, new Date(deviceNow), publicKey)
  if (!r.ok) return r
  const code = cleanCode(extractCode(pasted))
  const used = parseUsed(await getSetting<unknown>(RESET_USED_SETTING, []))
  return used.some(u => u.code === code) ? { ok: false, reason: 'used' } : r
}

/**
 * Sets `pin` for the admin `userId` with a valid reset code. The code is checked again here (never trusted from
 * the screen), then marked as used. Returns the reason when it cannot be applied.
 */
export async function applyPinReset(o: {
  device: string; code: string; userId: string; pin: string; now: number; activityMessage: (name: string) => string; publicKey?: JsonWebKey; deviceNow?: number
}): Promise<ResetResult> {
  const r = await checkReset(o.device, o.code, o.now, o.publicKey, o.deviceNow)
  if (!r.ok) return r
  if (pinError(o.pin)) throw new Error('pin')
  const user = await db.users.get(o.userId)
  if (!user || user.role !== 'admin') throw new Error('user')
  const code = cleanCode(extractCode(o.code))
  // the slow hash is worked out before the transaction: awaiting anything but Dexie inside one would end it early
  const salt = randomHex()
  const pinHash = await hashPin(o.pin, salt)
  const today = dayNumber(o.now)
  await db.transaction('rw', db.users, db.settings, async () => {
    await db.users.update(user.id, { pinSalt: salt, pinHash, active: true, updatedAt: nowISO() })
    const used = parseUsed((await db.settings.get(RESET_USED_SETTING))?.value).filter(u => u.day >= today - 7)
    await db.settings.put({ key: RESET_USED_SETTING, value: [...used, { day: r.day, code }] })
  })
  await saveGuard(user.id, null)
  void logActivity({ type: 'system', action: 'update', entityId: user.id, by: user.id, message: o.activityMessage(user.name) })
  return r
}
