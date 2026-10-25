// Input validation helpers shared by all routes. Every helper either returns a clean value or throws HttpError(400).
import { HttpError } from './http'

/** Normalise a Syrian mobile number to 09XXXXXXXX. Accepts +963…, 00963…, 963…, 9XXXXXXXX, spaces/dashes and Arabic digits. */
export function normalisePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null
  let s = input.trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))   // Arabic-Indic digits
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))   // Extended Arabic-Indic digits
    .replace(/[\s\-().]/g, '')
  if (s.startsWith('00963')) s = '0' + s.slice(5)
  else if (s.startsWith('+963')) s = '0' + s.slice(4)
  else if (s.startsWith('963') && s.length === 12) s = '0' + s.slice(3)
  else if (/^9\d{8}$/.test(s)) s = '0' + s
  return /^09\d{8}$/.test(s) ? s : null
}

export function requirePhone(v: unknown): string {
  const p = normalisePhone(v)
  if (!p) throw new HttpError(400, 'invalid_phone')
  return p
}

export function requireString(v: unknown, code: string, min: number, max: number): string {
  if (typeof v !== 'string') throw new HttpError(400, code)
  const s = v.trim()
  if (s.length < min || s.length > max) throw new HttpError(400, code)
  return s
}

export function optionalString(v: unknown, code: string, max: number): string | null {
  if (v === undefined || v === null || v === '') return null
  return requireString(v, code, 1, max)
}

export function requireInt(v: unknown, code: string, min: number, max: number): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) throw new HttpError(400, code)
  return n
}

export function optionalInt(v: unknown, code: string, min: number, max: number): number | null {
  if (v === undefined || v === null || v === '') return null
  return requireInt(v, code, min, max)
}

/** Parses an ISO-8601 instant and returns it normalised (millisecond UTC form used everywhere in the DB). */
export function requireIso(v: unknown, code: string): string {
  if (typeof v !== 'string' || v.length < 10) throw new HttpError(400, code)
  const t = Date.parse(v)
  if (Number.isNaN(t)) throw new HttpError(400, code)
  return new Date(t).toISOString()
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

export function oneOf<T extends string>(v: unknown, values: readonly T[], code: string): T {
  if (typeof v !== 'string' || !(values as readonly string[]).includes(v)) throw new HttpError(400, code)
  return v as T
}
