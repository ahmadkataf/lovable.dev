// Worker bindings and secrets (see wrangler.toml for how each is set).
export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  TOKEN_SECRET: string
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
  WEBHOOK_SECRET: string
  ADMIN_SETUP_KEY: string
}
