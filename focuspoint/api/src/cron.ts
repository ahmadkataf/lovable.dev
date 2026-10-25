// Scheduled work (every 5 minutes, see wrangler.toml [triggers]):
//  1. expire pending_payment bookings whose hold ran out → 'expired' + notify the customer device
//  2. remind confirmed bookings starting in 55–65 minutes, once (reminded = 1)
//  3. complete confirmed bookings whose end time has passed
import type { Env } from './env'
import { BOOKING_SELECT, toBooking, type BookingRow } from './db'
import { notifyDevice, texts } from './notify'
import { loadStoredSettings } from './settings'

export async function runCron(env: Env, ctx: ExecutionContext, now = new Date()): Promise<{ expired: number; reminded: number; completed: number }> {
  const iso = now.toISOString()
  const { timezone: tz } = await loadStoredSettings(env.DB)

  // 1. expire holds
  const toExpire = (await env.DB.prepare(`${BOOKING_SELECT} WHERE b.status = 'pending_payment' AND b.hold_until IS NOT NULL AND b.hold_until <= ?`)
    .bind(iso).all<BookingRow>()).results
  for (const row of toExpire) {
    const r = await env.DB.prepare(`UPDATE bookings SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'pending_payment'`).bind(iso, row.id).run()
    if (r.meta.changes > 0) await notifyDevice(env, ctx, row.device_id, texts.booking_expired(toBooking(row), tz))
  }

  // 2. reminders (window wide enough for a 5-minute cron; the flag prevents duplicates)
  const from = new Date(now.getTime() + 55 * 60000).toISOString(), to = new Date(now.getTime() + 65 * 60000).toISOString()
  const toRemind = (await env.DB.prepare(`${BOOKING_SELECT} WHERE b.status = 'confirmed' AND b.reminded = 0 AND b.device_id IS NOT NULL AND b.start >= ? AND b.start < ?`)
    .bind(from, to).all<BookingRow>()).results
  for (const row of toRemind) {
    const r = await env.DB.prepare('UPDATE bookings SET reminded = 1 WHERE id = ? AND reminded = 0').bind(row.id).run()
    if (r.meta.changes > 0) await notifyDevice(env, ctx, row.device_id, texts.booking_reminder(toBooking(row), tz))
  }

  // 3. completion
  const done = await env.DB.prepare(`UPDATE bookings SET status = 'completed', updated_at = ? WHERE status = 'confirmed' AND end <= ?`).bind(iso, iso).run()

  return { expired: toExpire.length, reminded: toRemind.length, completed: done.meta.changes }
}
