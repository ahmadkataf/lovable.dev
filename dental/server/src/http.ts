// Small helpers every part of the Worker uses: responses, headers, escaping, encoding, CSV.
// No imports with runtime effects: scripts/build-public.mjs imports this file directly (Node strips the types) to
// write the same security headers into public/_headers for the static files.

/** Content-Security-Policy of every page: nothing inline, nothing from another origin (SPEC.md → Security). */
export const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self'; font-src 'self'; script-src 'self'; " +
  "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"

/**
 * The public pages (landing, privacy, terms, activation, guide, videos, 404) also allow Cloudflare Web Analytics:
 * when it is on for the zone, Cloudflare injects its beacon into every HTML page. They also name media-src
 * explicitly (the video course plays /videos/<lang>/<slug>.mp4 and its captions from this origin; default-src
 * would cover it, but a reader of the policy should not have to know that). The control panel, the API and the
 * static files keep CSP.
 */
export const PUBLIC_CSP = CSP
  .replace("img-src 'self' data:;", "img-src 'self' data:; media-src 'self';")
  .replace("script-src 'self'", "script-src 'self' https://static.cloudflareinsights.com")
  .replace("connect-src 'self'", "connect-src 'self' https://cloudflareinsights.com")

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': CSP,
}

export const CACHE_PAGE = 'public, max-age=300'
export const NO_STORE = 'no-store'

/** A copy of the response with the security headers set (responses from fetch/ASSETS have immutable headers). */
export function secure(res: Response): Response {
  const out = new Response(res.body, res)
  // a page that set its own policy (PUBLIC_CSP) keeps it; everything else gets the strict one
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!(k === 'Content-Security-Policy' && res.headers.get(k) === PUBLIC_CSP)) out.headers.set(k, v)
  return out
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': NO_STORE, ...headers },
  })
}
/** `{ error: code, ...extra }`, the one error shape of the API. */
export function apiError(code: string, status: number, extra: Record<string, unknown> = {}): Response {
  return json({ error: code, ...extra }, status)
}

/**
 * CORS of the one public API route (POST /api/activate): any origin may call it and read the answer, since it reads
 * no cookies and carries no authority (the key is the proof). Every other /api/* route answers no CORS at all.
 */
export const CORS_HEADERS: Readonly<Record<string, string>> = { 'Access-Control-Allow-Origin': '*' }
export const PREFLIGHT_HEADERS: Readonly<Record<string, string>> = {
  ...CORS_HEADERS,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}
/** A copy of the response with the CORS headers set. */
export function withCors(res: Response): Response {
  const out = new Response(res.body, res)
  for (const [k, v] of Object.entries(CORS_HEADERS)) out.headers.set(k, v)
  return out
}

export function html(body: string, status = 200, cache = CACHE_PAGE, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache, ...headers } })
}
export function text(body: string, status = 200, type = 'text/plain', cache = CACHE_PAGE): Response {
  return new Response(body, { status, headers: { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': cache } })
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
/** For text and attribute values alike (quotes included). */
export function escapeHtml(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, c => ESC[c])
}

/** The JSON body as an object, or null (not JSON, not an object, or larger than `max` bytes). */
export async function readJson(request: Request, max = 16_384): Promise<Record<string, unknown> | null> {
  const raw = await readLimited(request, max)
  if (raw === null) return null
  try {
    const v = JSON.parse(raw || '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
  } catch { return null }
}
/**
 * The body as text, or null past `max` bytes. Read as a stream and stopped at the limit: a chunked upload has no
 * Content-Length to check first, and reading it whole would let a stranger fill the isolate's memory.
 */
export async function readLimited(request: Request, max: number): Promise<string | null> {
  if (Number(request.headers.get('Content-Length') || 0) > max) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const parts: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel().catch(() => {})
      return null
    }
    parts.push(value)
  }
  const all = new Uint8Array(size)
  let at = 0
  for (const p of parts) { all.set(p, at); at += p.byteLength }
  return new TextDecoder().decode(all)
}

/** The visitor's address as Cloudflare reports it ('' locally, where there is no such header). */
export const clientIp = (request: Request) => request.headers.get('CF-Connecting-IP') || ''

// ---- encoding ----------------------------------------------------------------------------------------------------
export function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function fromB64url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
    return Uint8Array.from(bin, c => c.charCodeAt(0))
  } catch { return null }
}
/** Compares in time that depends only on the length (callers compare fixed-length digests). */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// ---- CSV ---------------------------------------------------------------------------------------------------------
/**
 * One CSV cell. A value Excel would read as a formula (=, +, -, @, tab, CR first) gets a leading apostrophe, so a
 * customer name or note can never run as one; quotes, commas and line breaks are quoted the RFC 4180 way.
 */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
/** A whole CSV file: UTF-8 BOM (Excel then reads Arabic correctly) and CRLF line ends. */
export function toCsv(head: string[], rows: unknown[][]): string {
  return '\uFEFF' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
