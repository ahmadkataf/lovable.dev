// Scheduled work (every 5 minutes, see wrangler.toml [triggers]):
//  1. expire pending_payment bookings whose hold (plus its grace window) ran out → 'expired' + notify the customer device
//  2. expire awaiting_verification bookings nobody checked until 30 min after their end → 'expired' with a system note
//  3. remind confirmed bookings starting settings.reminder_minutes (±5) from now, once (reminded = 1); 0 = no reminders
//  4. complete confirmed bookings whose end time has passed
import type { Env } from './env'
import { STALE_VERIFICATION_NOTE, holdExpiryCutoff, reminderWindow, staleVerificationCutoff, withSystemNote } from './bookings'
import { BOOKING_SELECT, toBooking, type BookingRow } from './db'
import { messageCtx, notifyDevice, texts } from './notify'
import { loadStoredSettings } from './settings'

export interface CronResult { expired: number; stale: number; reminded: number; completed: number }

export async function runCron(env: Env, ctx: ExecutionContext, now = new Date()): Promise<CronResult> {
  const iso = now.toISOString()
  const settings = await loadStoredSettings(env.DB)
  const mc = await messageCtx(env.DB, settings)       // the admin's templates; the defaults if the content cannot be read

  // 1. expire holds — after the grace window, so a reference that arrives just late (see service.submitPayment) still lands
  const toExpire = (await env.DB.prepare(`${BOOKING_SELECT} WHERE b.status = 'pending_payment' AND b.hold_until IS NOT NULL AND b.hold_until <= ?`)
    .bind(holdExpiryCutoff(now)).all<BookingRow>()).results
  for (const row of toExpire) {
    const r = await env.DB.prepare(`UPDATE bookings SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'pending_payment'`).bind(iso, row.id).run()
    if (r.meta.changes > 0) await notifyDevice(env, ctx, row.device_id, texts.booking_expired(toBooking(row), mc))
  }

  // 2. stale verifications: the slot is long over and nobody confirmed or rejected → close them so they do not pile up
  const stale = (await env.DB.prepare(`${BOOKING_SELECT} WHERE b.status = 'awaiting_verification' AND b.end <= ?`)
    .bind(staleVerificationCutoff(now)).all<BookingRow>()).results
  for (const row of stale) {
    const r = await env.DB.prepare(`UPDATE bookings SET status = 'expired', note = ?, updated_at = ? WHERE id = ? AND status = 'awaiting_verification'`)
      .bind(withSystemNote(row.note, STALE_VERIFICATION_NOTE), iso, row.id).run()
    if (r.meta.changes > 0) await notifyDevice(env, ctx, row.device_id, texts.booking_expired(toBooking(row), mc))
  }

  // 3. reminders (window wide enough for a 5-minute cron; the flag prevents duplicates)
  const win = reminderWindow(now, settings.reminder_minutes)
  const toRemind = win
    ? (await env.DB.prepare(`${BOOKING_SELECT} WHERE b.status = 'confirmed' AND b.reminded = 0 AND b.device_id IS NOT NULL AND b.start >= ? AND b.start < ?`)
      .bind(win.from, win.to).all<BookingRow>()).results
    : []
  for (const row of toRemind) {
    const r = await env.DB.prepare('UPDATE bookings SET reminded = 1 WHERE id = ? AND reminded = 0').bind(row.id).run()
    if (r.meta.changes > 0) await notifyDevice(env, ctx, row.device_id, texts.booking_reminder(toBooking(row), mc))
  }

  // 4. completion
  const done = await env.DB.prepare(`UPDATE bookings SET status = 'completed', updated_at = ? WHERE status = 'confirmed' AND end <= ?`).bind(iso, iso).run()

  return { expired: toExpire.length, stale: stale.length, reminded: toRemind.length, completed: done.meta.changes }
}
