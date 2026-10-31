// HTTP plumbing: JSON responses, typed errors ({error: code}), CORS.

export class HttpError extends Error {
  /** `extra` is merged into the JSON error body next to `error` (e.g. {path, message} for invalid site content). */
  constructor(public status: number, public code: string, public extra?: Record<string, unknown>) { super(code) }
}

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device, X-Webhook-Secret, If-None-Match',
  'Access-Control-Expose-Headers': 'ETag',
  'Access-Control-Max-Age': '86400',
}

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS_HEADERS, ...extra },
  })
}

export const error = (status: number, code: string, extra?: Record<string, unknown>): Response => json({ ...extra, error: code }, status)

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  let body: unknown
  try { body = await req.json() } catch { throw new HttpError(400, 'invalid_json') }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new HttpError(400, 'invalid_json')
  return body as Record<string, unknown>
}

/** Constant-time comparison of two strings (secrets, webhook signatures). */
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a), bb = enc.encode(b)
  let diff = ab.length ^ bb.length
  const n = Math.max(ab.length, bb.length)
  for (let i = 0; i < n; i++) diff |= (ab[i % (ab.length || 1)] ?? 0) ^ (bb[i % (bb.length || 1)] ?? 0)
  return diff === 0
}
