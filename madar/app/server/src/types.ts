// Shared types for the Madar worker.
export type Role = 'directorate' | 'school' | 'teacher' | 'student' | 'parent'

export interface Env {
  DB: D1Database               // D1 binding, or (in production) the Durable Object shim installed by index.ts
  MADAR_DO?: DurableObjectNamespace
  ADMIN_KEY?: string           // wrangler secret: unlocks POST /api/admin/sql (schema/seed) and GET /api/admin/health
  ASSETS: Fetcher
  TOKEN_SECRET?: string   // HMAC secret for login tokens (wrangler secret); required when APP_URL is https, 'dev-secret' only in local runs
  WEEKLY_CAP?: string     // substitute engine: max weekly periods + substitutions per teacher (default 28)
  APP_URL?: string
  SUPPORT_PHONE?: string   // shown by GET /api/config (public): the pilot's support line; empty until the team has one
  SUPPORT_HOURS?: string   // e.g. «٧:٣٠–١٤:٠٠»
}

/** The authenticated user, loaded from `users` on every request (phone is deliberately not loaded). */
export interface User {
  id: number
  role: Role
  name: string
  school_id: number | null
  subject_id: number | null
}

export type AppEnv = { Bindings: Env; Variables: { user: User } }

/** An error that becomes `{error: "<Arabic message>"}` with the given HTTP status. */
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
