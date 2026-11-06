// Tiny path router: static segments and ":param" captures, first match wins (register specific paths first).
import type { User } from '../../shared/types'
import type { Env } from './env'
import { HttpError } from './http'

export interface Ctx {
  req: Request; env: Env; exec: ExecutionContext; url: URL
  params: Record<string, string>
  now: Date
  user: User | null       // team account (Authorization: Bearer …), already validated
  device: string | null   // customer device (X-Device UUID), format-validated
}
export type Handler = (c: Ctx) => Promise<Response> | Response
export type Access = 'public' | 'team' | 'admin'
export interface Route { method: string; path: string; access: Access; handler: Handler }

export const route = (method: string, path: string, access: Access, handler: Handler): Route => ({ method, path, access, handler })

/** A malformed escape ("%E0") must not throw outside the handler's try (it would crash the request): keep it raw. */
function safeDecode(s: string): string {
  try { return decodeURIComponent(s) } catch { return s }
}

export function match(routes: Route[], method: string, pathname: string): { route: Route; params: Record<string, string> } | null {
  const segs = pathname.replace(/\/+$/, '').split('/')
  for (const r of routes) {
    if (r.method !== method) continue
    const pat = r.path.split('/')
    if (pat.length !== segs.length) continue
    const params: Record<string, string> = {}
    let ok = true
    for (let i = 0; i < pat.length; i++) {
      const p = pat[i] as string, s = segs[i] as string
      if (p.startsWith(':')) params[p.slice(1)] = safeDecode(s)
      else if (p !== s) { ok = false; break }
    }
    if (ok) return { route: r, params }
  }
  return null
}

export function idParam(c: Ctx, name = 'id'): number {
  const n = Number(c.params[name])
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'invalid_id')
  return n
}

export function requireDevice(c: Ctx): string {
  if (!c.device) throw new HttpError(401, 'device_required')
  return c.device
}

export function requireUser(c: Ctx): User {
  if (!c.user) throw new HttpError(401, 'unauthorized')
  return c.user
}
