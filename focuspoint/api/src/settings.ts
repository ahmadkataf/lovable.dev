// Centre settings: defaults (centre facts, hours, slot rules, the default floor plan) merged over the single
// settings row. The VAPID public key is never stored — it comes from the environment.
import type { Plan, PublicSettings, Settings } from '../../shared/types'
import type { Env } from './env'
import { HttpError } from './http'
import { isPlainObject, requireInt, requireString } from './validate'
import { isTimeString, isValidTimeZone, timeToMinutes } from './tz'

export type StoredSettings = Omit<Settings, 'vapid_public_key'>

/** Default plan, 1200 × 800 units: four private rooms above a corridor, the meeting room and open space below. */
export const DEFAULT_PLAN: Plan = {
  width: 1200,
  height: 800,
  walls: [
    { x: 0, y: 340, w: 1200, h: 120 },      // corridor
    { x: 1080, y: 40, w: 80, h: 260 },      // reception
  ],
  labels: [
    { x: 600, y: 400, text: 'الممر' },
    { x: 1120, y: 170, text: 'الاستقبال' },
    { x: 1120, y: 630, text: 'المدخل' },
  ],
}

export const DEFAULT_SETTINGS: StoredSettings = {
  centre_name: 'فوكس بوينت',
  phone: '0985258963',
  address: 'درعا، شارع المجمع الحكومي – بناء العايش',
  instagram: 'its_focus_point',
  timezone: 'Asia/Damascus',
  open: '09:00',
  close: '23:00',
  slot_minutes: 30,
  min_minutes: 60,
  max_minutes: 720,
  hold_minutes: 30,
  shamcash_number: '0985258963',
  shamcash_name: 'Focus Point',
  shamcash_qr: null,
  payment_instructions: 'حوّل المبلغ عبر شام كاش إلى الرقم أدناه، واكتب رمز الحجز في ملاحظة التحويل، ثم أدخل رقم العملية هنا.',
  plan: DEFAULT_PLAN,
}

export async function loadStoredSettings(db: D1Database): Promise<StoredSettings> {
  const row = await db.prepare('SELECT data FROM settings WHERE id = 1').first<{ data: string }>()
  if (!row) return { ...DEFAULT_SETTINGS }
  try {
    const stored = JSON.parse(row.data) as Partial<StoredSettings>
    return { ...DEFAULT_SETTINGS, ...stored, plan: stored.plan ?? DEFAULT_PLAN }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function loadSettings(db: D1Database, env: Env): Promise<Settings> {
  return { ...(await loadStoredSettings(db)), vapid_public_key: env.VAPID_PUBLIC_KEY ?? '' }
}

export function publicSettings(s: Settings): PublicSettings {
  const { centre_name, phone, address, instagram, timezone, open, close, slot_minutes, min_minutes, max_minutes, hold_minutes, plan, vapid_public_key } = s
  return { centre_name, phone, address, instagram, timezone, open, close, slot_minutes, min_minutes, max_minutes, hold_minutes, plan, vapid_public_key }
}

const MAX_QR_BYTES = 300 * 1024
const QR_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/

export function validatePlan(v: unknown): Plan {
  if (!isPlainObject(v)) throw new HttpError(400, 'invalid_plan')
  const width = requireInt(v.width, 'invalid_plan', 200, 5000), height = requireInt(v.height, 'invalid_plan', 200, 5000)
  const rect = (r: unknown) => {
    if (!isPlainObject(r)) throw new HttpError(400, 'invalid_plan')
    return {
      x: requireInt(r.x, 'invalid_plan', 0, 5000), y: requireInt(r.y, 'invalid_plan', 0, 5000),
      w: requireInt(r.w, 'invalid_plan', 1, 5000), h: requireInt(r.h, 'invalid_plan', 1, 5000),
    }
  }
  if (!Array.isArray(v.walls) || v.walls.length > 200 || !Array.isArray(v.labels) || v.labels.length > 200) throw new HttpError(400, 'invalid_plan')
  const labels = v.labels.map((l: unknown) => {
    if (!isPlainObject(l)) throw new HttpError(400, 'invalid_plan')
    return { x: requireInt(l.x, 'invalid_plan', 0, 5000), y: requireInt(l.y, 'invalid_plan', 0, 5000), text: requireString(l.text, 'invalid_plan', 1, 40) }
  })
  return { width, height, walls: v.walls.map(rect), labels }
}

/** Validates a partial Settings patch (only known, writable fields) and returns the cleaned patch. */
export function validateSettingsPatch(body: Record<string, unknown>, current: StoredSettings): Partial<StoredSettings> {
  const p: Partial<StoredSettings> = {}
  if ('centre_name' in body) p.centre_name = requireString(body.centre_name, 'invalid_centre_name', 2, 60)
  if ('phone' in body) p.phone = requireString(body.phone, 'invalid_phone', 6, 20)
  if ('address' in body) p.address = requireString(body.address, 'invalid_address', 0, 160)
  if ('instagram' in body) p.instagram = requireString(body.instagram, 'invalid_instagram', 0, 40).replace(/^@/, '')
  if ('timezone' in body) {
    const tz = requireString(body.timezone, 'invalid_timezone', 1, 60)
    if (!isValidTimeZone(tz)) throw new HttpError(400, 'invalid_timezone')
    p.timezone = tz
  }
  if ('open' in body) { if (!isTimeString(body.open)) throw new HttpError(400, 'invalid_hours'); p.open = body.open }
  if ('close' in body) { if (!isTimeString(body.close)) throw new HttpError(400, 'invalid_hours'); p.close = body.close }
  if ('slot_minutes' in body) {
    if (body.slot_minutes !== 30 && body.slot_minutes !== 60) throw new HttpError(400, 'invalid_slot_minutes')
    p.slot_minutes = body.slot_minutes
  }
  if ('min_minutes' in body) p.min_minutes = requireInt(body.min_minutes, 'invalid_duration', 30, 1440)
  if ('max_minutes' in body) p.max_minutes = requireInt(body.max_minutes, 'invalid_duration', 30, 1440)
  if ('hold_minutes' in body) p.hold_minutes = requireInt(body.hold_minutes, 'invalid_hold', 5, 180)
  if ('shamcash_number' in body) p.shamcash_number = requireString(body.shamcash_number, 'invalid_shamcash_number', 0, 40)
  if ('shamcash_name' in body) p.shamcash_name = requireString(body.shamcash_name, 'invalid_shamcash_name', 0, 60)
  if ('shamcash_qr' in body) {
    if (body.shamcash_qr === null || body.shamcash_qr === '') p.shamcash_qr = null
    else {
      if (typeof body.shamcash_qr !== 'string' || body.shamcash_qr.length > MAX_QR_BYTES || !QR_RE.test(body.shamcash_qr)) throw new HttpError(400, 'invalid_qr')
      p.shamcash_qr = body.shamcash_qr
    }
  }
  if ('payment_instructions' in body) p.payment_instructions = requireString(body.payment_instructions, 'invalid_instructions', 0, 500)
  if ('plan' in body) p.plan = validatePlan(body.plan)

  // Cross-field rules on the merged result.
  const merged = { ...current, ...p }
  if (timeToMinutes(merged.open) >= timeToMinutes(merged.close)) throw new HttpError(400, 'invalid_hours')
  if (merged.min_minutes > merged.max_minutes) throw new HttpError(400, 'invalid_duration')
  if (merged.min_minutes % merged.slot_minutes !== 0 || merged.max_minutes % merged.slot_minutes !== 0) throw new HttpError(400, 'invalid_duration')
  return p
}

export async function saveSettings(db: D1Database, patch: Partial<StoredSettings>): Promise<StoredSettings> {
  const next = { ...(await loadStoredSettings(db)), ...patch }
  await db.prepare('INSERT INTO settings (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data')
    .bind(JSON.stringify(next)).run()
  return next
}
