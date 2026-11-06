// Worker bindings, vars and secrets (see wrangler.toml for how each is set).
export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  // [vars] in wrangler.toml
  PUBLIC_URL: string                 // the app's public origin, e.g. https://focuspoint.raqeem.dev — every absolute link is built from it
  ASSETLINKS_FINGERPRINTS: string    // comma-separated SHA-256 fingerprints of the Android signing keys (Digital Asset Links)
  // secrets
  TOKEN_SECRET: string
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
  WEBHOOK_SECRET: string
  ADMIN_SETUP_KEY: string
}

/** The public origin without a trailing slash (falls back to the request origin when PUBLIC_URL is unset, e.g. local dev). */
export function publicUrl(env: Pick<Env, 'PUBLIC_URL'>, fallbackOrigin = ''): string {
  const v = (env.PUBLIC_URL || fallbackOrigin || '').trim().replace(/\/+$/, '')
  return v
}

/** Absolute link into the app for notifications and push payloads. `path` starts with "/". */
export const absoluteUrl = (env: Pick<Env, 'PUBLIC_URL'>, path: string): string => `${publicUrl(env)}${path}`
