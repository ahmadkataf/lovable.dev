# Focus Point API — Cloudflare Worker + D1

The whole system is one Worker: `/v1/*` is the JSON API described in `../shared/types.ts` (`ApiContract`), everything
else is the built web app (`../web/dist`) served from `[assets]` with an `index.html` fallback. D1 (SQLite) stores the data,
a cron runs every 5 minutes, Web Push goes out with VAPID.

```
src/index.ts      router, CORS, role guards, /.well-known/assetlinks.json, /media/*, scheduled() entry · src/assetlinks.ts
src/routes/       public.ts (customers) · team.ts · sync.ts (offline) · admin.ts · content.ts (site editor) · payments.ts (webhook)
src/content.ts    site content: stored overrides ⊕ DEFAULT_CONTENT, isolate cache, save / reset / history / undo
src/media.ts      uploaded images in D1: type + size checks, /media/<id>.<ext> · src/app.ts + src/site.ts the SPA with the
                  content written into index.html (title, meta, JSON-LD, theme, boot data) and the manifest
src/service.ts    booking + room operations shared by the online routes and the offline replay
src/bookings.ts   pure rules: slot validation, price, overlap, codes, status machine   (unit-tested)
src/auth.ts       PBKDF2 passwords, HS256 bearer tokens, login rate limiting
src/settings.ts   defaults + validation of the settings row and the floor plan
src/notify.ts     inbox rows + push (texts from the editable content.messages templates) · src/push.ts Web Push (RFC 8291/8292)
src/cron.ts       expire holds (after a 10-min grace) · close stale verifications · remind reminder_minutes before · complete
src/tz.ts         Asia/Damascus ↔ UTC helpers · src/validate.ts phone normalisation and input checks
schema.sql        D1 schema · seed.sql six rooms with plan rectangles and SYP prices · migrations/ the same changes as files
scripts/          content-smoke.mjs (site editor end to end) · privacy-smoke.mjs · vapid.mjs
```

## 1. Setup

```bash
cd api && npm install
npx wrangler login                         # or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in the environment
npx wrangler d1 create focuspoint          # paste the database_id into wrangler.toml
npm run d1:schema                          # applies schema.sql to the remote D1 (idempotent; db:schema is the same)
npm run d1:seed                            # six rooms (run once)
npm run d1:migrate                         # only for a database created before migrations/0001 (schema.sql already has it)
```

`wrangler.toml` carries the account id, the custom domain route (`focuspoint.raqeem.dev`, with the `workers.dev` preview kept on)
and two plain vars: `PUBLIC_URL` (every absolute link in notifications and push payloads is built from it — no domain is
hard-coded in the code) and `ASSETLINKS_FINGERPRINTS` (the Android signing-key fingerprints served at
`GET /.well-known/assetlinks.json` for the TWA app, package `com.focuspoint.app`). The step-by-step deployment and the
move-to-another-account procedure are in `../docs/HANDOVER.md` (Arabic).

Secrets (never in files — `wrangler secret put NAME`, one by one):

| secret | purpose |
|---|---|
| `TOKEN_SECRET` | ≥ 32 random chars; signs team bearer tokens (HS256, 30 days) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push keys — generate with `npm run vapid` |
| `VAPID_SUBJECT` | `mailto:owner@example.com` |
| `WEBHOOK_SECRET` | shared secret for `POST /v1/payments/shamcash/webhook` |
| `ADMIN_SETUP_KEY` | one-time key for creating the first admin |

`npm run vapid` prints a fresh pair in the base64url format the browser (`applicationServerKey`) and the push services expect.
The public key is also returned to clients in `GET /v1/settings` as `vapid_public_key`.

## 2. Local development

```bash
cp .dev.vars.example .dev.vars           # fill the secrets (any values work locally)
npm run db:schema:local && npm run db:seed:local
(cd ../web && npm run build)             # the Worker serves ../web/dist; wrangler needs the folder to exist
npm run dev                              # http://127.0.0.1:8787  (API + app); --test-scheduled is on:
curl "http://127.0.0.1:8787/__scheduled?cron=*/5+*+*+*+*"   # runs the cron by hand
```

For the web app's own dev server, point it at `http://127.0.0.1:8787` — CORS allows `*` with the `X-Device` and
`Authorization` headers.

## 3. Deploy

```bash
npm run deploy:all        # = build ../web, then wrangler deploy (the Worker ships web/dist as its assets)
```

Then create the first admin (once; refused with 409 as soon as an admin exists):

```bash
curl -X POST https://<worker>/v1/admin/bootstrap -H 'Content-Type: application/json' \
  -d '{"setup_key":"<ADMIN_SETUP_KEY>","phone":"0985258963","name":"المدير","password":"********"}'
```

The response carries a token; the admin then signs in at `/admin`, uploads the Sham Cash QR and adds staff accounts.

## 4. How it works

**Identity.** Customers have no accounts. The app sends `X-Device: <uuid>` (format-checked) on every request; a booking is
tied to that device and to the phone number typed in (normalised to `09XXXXXXXX`; `+963`, `00963`, Arabic digits accepted).
`GET /v1/bookings/mine` lists the device's bookings (future + last 90 days, newest first); `GET /v1/bookings/lookup?code=&phone=`
finds a booking from another device: the phone proves ownership, so the calling device always **adopts** it (a row in
`booking_devices`; a walk-in without a device also gets `device_id` set). Every adopting device keeps access — `/mine`, `/:id`,
payment and cancel work from each of them, and the outcome notifications (inbox + push) go to all of them. Reads, payment
and cancel on `/v1/bookings/:id` need an owning device or a team token. Phones in `blocked_customers` get 403 `customer_blocked`.

**Team.** `POST /v1/team/login` → bearer token (30 days). The user row is re-read on every request, so disabling an account
or changing a role takes effect at once. Login is rate limited: 5 failures per phone and 20 per IP in 15 minutes → 429.
Passwords: PBKDF2-SHA256, 100 000 iterations, random salt, min 6 chars. `/v1/admin/*` needs role `admin`.

**Booking flow (Sham Cash).** `POST /v1/bookings` takes an optional `method`: `shamcash` (default) or `cash` — *pay on arrival*,
accepted only while `settings.allow_pay_on_arrival` is true (else 400 `cash_not_allowed`). A cash booking skips the transfer:
it is created as `awaiting_verification` with `hold_until = null`, and the team gets `booking_created` plus a
`payment_submitted` whose body says «دفع عند الوصول»; staff confirm or reject it like any other.
1. `POST /v1/bookings` validates the slot (open–close in Asia/Damascus, 30/60-minute grid, min/max duration, same local day,
   not in the past), prices it (hours × `price_hour`, half hours allowed; ≥ 8 h takes `min(price_day, hourly)`), and creates
   `pending_payment` with `hold_until = now + hold_minutes` and a 6-character code (alphabet without 0/O/1/I). Team gets
   `booking_created`.
2. `GET /v1/bookings/:id` returns `payment` (amount, code, Sham Cash number/name/QR, instructions, hold_until). The customer
   transfers and calls `POST /v1/bookings/:id/payment {ref}` (4–40 chars, unique among bookings that still count — a reference
   typed on a cancelled/expired/rejected booking may be reused) → `awaiting_verification`; team gets `payment_submitted`.
   After `hold_until` the slot is free for others, but a reference arriving within a **10-minute grace** is still accepted
   when nobody took the slot meanwhile; otherwise the booking is expired and the call answers 409 `hold_expired`. (The UI
   stops offering the form at `hold_until`; the grace covers requests in flight and clock skew.)
3. Staff: `POST /v1/team/bookings/:id/confirm` or `/reject {reason}`. The customer device gets `booking_confirmed` /
   `booking_rejected` (inbox + push).
4. **Webhook** `POST /v1/payments/shamcash/webhook` (header `X-Webhook-Secret`, constant-time compare) logs every event to
   `payment_events`, then matches a live booking by `ref` (= the reference the customer typed) or by a booking code found in
   `note`; if `amount ≥ price` the booking is confirmed automatically (`verified_by` NULL). Duplicate deliveries answer
   `{matched:true}` without changes.

Status machine (anything else → 409 `illegal_transition`):
`pending_payment → awaiting_verification | confirmed | expired | cancelled | rejected`,
`awaiting_verification → confirmed | rejected | cancelled | expired` (expired only by the cron, see below),
`confirmed → cancelled | completed`; the rest are terminal.
Customers may cancel only before confirmation; the team may cancel anything live (customer gets `booking_cancelled`).

**Double-booking protection.** A slot is blocked by `confirmed`, `awaiting_verification`, and `pending_payment` whose
`hold_until` is in the future. D1 has no row locks, so `service.ts/insertChecked` inserts the booking and then re-reads every
live booking overlapping it: if another one with a *lower id* exists, the new row is deleted and the request answers 409
`slot_taken`. Two racing requests therefore resolve deterministically — the earlier insert keeps the slot, the later one
removes itself. **Confirm and edit are atomic**: one conditional `UPDATE … WHERE id = ? AND status = ? AND NOT EXISTS
(overlapping live booking)` (`bookings.ts/NO_CONFLICT_SQL`); when it changes 0 rows the booking is re-read — status moved on →
409 `illegal_transition`, otherwise 409 `slot_taken` (a hold may have expired and been re-booked meanwhile).

**Offline replay clock.** Ops replayed through `POST /v1/team/sync` (`manual_booking`, `edit_booking`) are validated against
`min(op.at, server now)` — the moment the device recorded them — so a walk-in typed at 14:00 and synced at 20:00 is not
refused as `in_past`. Timestamps, holds and conflict checks still use the server clock.

**Cron (every 5 minutes, `src/cron.ts`).** Expire `pending_payment` whose `hold_until` + 10-minute grace passed (→ `expired`,
customer notified); close `awaiting_verification` bookings whose end passed more than 30 minutes ago (→ `expired`, a system
note «انتهت المهلة دون تحقق من الدفع (إغلاق تلقائي)» is appended, customer notified) so stale verifications do not pile up —
the dashboard's `pending` list and `/v1/team/ping` already exclude past ones; remind confirmed bookings starting
`reminder_minutes` ± 5 minutes from now, once (`reminded = 1`; default 60 → 55–65 minutes; 0 = no reminders); complete
confirmed bookings whose end passed.

**Notifications.** Every notification is a row in `notifications` (inbox, `GET /v1/notifications`) and a Web Push to all
subscriptions of the recipient (`push_subscriptions`, tied to a team account or a customer device). The push payload is the
JSON `{kind, booking_id, url, title, body, tag}` (`shared/types.ts` `PushMessage`); `url` is absolute, built from `PUBLIC_URL`
(team → `/team/bookings?id=…`, customer → `/b/:id`), so the service worker can show it and forward it to open clients. Push is best effort in
`ctx.waitUntil`; endpoints answering 404/410 are deleted, other failures are counted and dropped after 8.
Announcements: `to: 'team'` → every enabled account; `to: 'customers'` → every device with a push subscription.

**Settings.** `settings` is a single JSON row merged over the defaults in `settings.ts` (centre facts, 09:00–23:00, slot 30,
min 60, max 720, hold 30, `allow_pay_on_arrival` false, the default 1200×800 plan). `GET /v1/settings` exposes only `PublicSettings`; the Sham Cash details
reach customers only through a booking's `payment` block. PATCH validates `HH:MM` hours (open < close), the plan JSON, the QR
data URL (`image/png|jpeg|webp`, ≤ 300 KB), and that min/max are multiples of the slot.

Booking capabilities (admin; defaults = the behaviour before they existed), enforced for **customer** requests only —
team walk-ins and the offline replay are never limited by them:

| setting | default | rule | refused with |
|---|---|---|---|
| `booking_enabled` | true | false → no new customer bookings (existing holds can still be paid) | 409 `booking_closed` |
| `booking_closed_message` | '' | ≤ 500 chars, shown by the site instead of the form | — |
| `shamcash_enabled` | true | false → cash on arrival only; at least one of it / `allow_pay_on_arrival` stays on (else 400 `no_payment_method`) | 400 `shamcash_disabled` |
| `booking_horizon_days` | 14 | 1–365; start's local date ≤ today + days − 1 | 400 `too_far_ahead` |
| `max_open_holds_per_phone` | 3 | 1–20 unpaid live holds per phone | 429 `too_many_pending` |
| `reminder_minutes` | 60 | 0 (off) or 15–1440, cron window ± 5 min | — |
| `customer_can_cancel` | true | false → only the team cancels | 403 `cancel_not_allowed` |

All seven are in `PublicSettings` (`GET /v1/settings`) so the site adapts its pages.

**Rooms.** `DELETE /v1/admin/rooms/:id` hard-deletes a room only when no booking references it (FK) and records the id in
`deleted_rooms` (its photos go with it); otherwise it sets `active = 0`. Public `GET /v1/rooms` returns active rooms; sync
returns all rooms. Every room carries `photos: Photo[]` (table `room_photos`, in order): create / patch / sync `room_upsert`
accept `photos` (≤ 8; `src` and `small` `/img/…` or `/media/…`, alt ≤ 200, w/h 1–20000 → else 400 `invalid_photos`), which
replaces the whole list; `[]` clears it. If the photos cannot be read the rooms come back with `[]` rather than failing.

**Site editor** (`docs/cms/DESIGN.md`, contract `shared/content.ts`). The admin's saved sections live in one JSON row
(`site_content`); every read is `mergeContent(stored)` over `DEFAULT_CONTENT`, so a missing or malformed value falls back
to the default field by field. The merged content is cached in the isolate for ≤ 30 s and dropped on every save.

```
GET    /v1/content                        public · {content, updated_at} · Cache-Control: no-cache + ETag (304)
GET    /v1/admin/content                  {content, overridden: SectionId[], updated_at}
PUT    /v1/admin/content/:section         body = the full section → validateSection → {section, value, overridden, updated_at}
                                          400 {error:'invalid_content', path, message, reason} · 404 unknown_section · 413 > 256 KB
DELETE /v1/admin/content/:section         back to the default (same response; recorded in the history, so it can be undone)
GET    /v1/admin/content/:section/history [{id, saved_at, saved_by, saved_by_name, was_default, value}] newest first, ≤ 20
POST   /v1/admin/content/:section/undo    restores the newest history entry and removes it · 409 nothing_to_undo
POST   /v1/admin/media?w=&h=              raw body image/webp|jpeg|png, ≤ 1,000,000 bytes, bytes must match the type
                                          → 201 {id, src: '/media/<id>.<ext>', w, h, bytes} (size read from the file header
                                          when possible) · 415 unsupported_media_type · 413 media_too_large · 400 empty_body
GET    /v1/admin/media                    MediaItem[] newest first, with `used` (content or a room photo)
DELETE /v1/admin/media/:id                {ok:true} · 404 media_not_found · 409 media_in_use
GET    /media/<id>.<ext>                  public bytes, Cache-Control: public, max-age=31536000, immutable · ETag · 404
```

Undo: each save or reset first copies the section's previous stored value (NULL = it was the default) into
`site_content_history` in the same D1 batch; saving an identical value adds nothing. Section values are written with
`json_set` / `json_remove`, so saving two sections at once never loses either.

Notifications are built from `content.messages` with `fillTemplate` (`{customer_name} {room} {when} {price} {code} {ref}
{reason} {phone} {name} {reminder}`); with the default content they are word for word the old texts
(`test/notify.test.ts`), and if the content cannot be read they use the defaults.

The SPA shell (`index.html`, every page path) is rewritten with `HTMLRewriter`: `<title>` (`seo.pages[page]` or `seo.title`),
meta description, Open Graph / Twitter tags (absolute `og:image` from `PUBLIC_URL`), the JSON-LD (`buildJsonLd`), a
`<style>` with the brand palette when `theme.brand` changed (also on `privacy.html`), and
`<script>window.__FP_BOOT__={content, settings}</script>` (`<`, `>`, `&`, U+2028/9 escaped) so the first paint has the
edits. `/manifest.webmanifest` gets `name` (`seo.app_name`, or the centre name while that is the default), `short_name`,
`description`. Any error there (D1, content, rewriter) serves the built file untouched: the page never breaks.

Check it end to end against a local `wrangler dev --test-scheduled` with a fresh D1 (schema + seed):
`B=http://127.0.0.1:8787 KEY=<ADMIN_SETUP_KEY> node scripts/content-smoke.mjs` (Node ≥ 22; `OFF=1` for a re-run on the
same database).

## 5. Offline sync protocol (team app)

```
GET  /v1/team/ping               → { now, pending, last_change }      cheap, for a 5-second poll (indexes only)
GET  /v1/team/sync?since=<iso>   → { now, rooms (all, incl. inactive), bookings, settings (full), deleted_rooms }
POST /v1/team/sync { ops }       → { results: SyncResult[], now }
```

- `ping`: `pending` = verifications still to come (`status = awaiting_verification AND end > now`, index `(status, end)`),
  `last_change` = `MAX(updated_at)` over bookings (index `(updated_at)`). Poll it every 5 s and pull `sync?since=` only when
  `last_change` moves (a push arriving in the service worker is forwarded to the page for the same effect).
- Without `since`: bookings of the last 60 days and the future, all deleted room ids. With `since`: bookings with
  `updated_at > since` and rooms deleted after `since`. `now` is taken **before** the reads — store it as the next `since`.
- `ops` (≤ 200) are replayed **in order**. Each op is idempotent by `client_id`: the result is stored in `sync_ops` and
  returned again on a repeat. A failed op returns `{ok:false, error}` and the others still run. Each op uses the same code as
  its online route: `manual_booking` (also idempotent by `bookings.client_id`), `confirm`, `reject`, `cancel`, `edit_booking`,
  `room_upsert` (admin; without `id` it creates the room and the result's `room.id` is the real id for `client_room_id`),
  `settings_patch` (admin). Internal errors (`error: 'internal'`) are not stored so the client can retry them.

## 6. Error codes

All errors are `{ "error": "<code>" }` with a 4xx/5xx status. Validation: `invalid_json`, `invalid_name`, `invalid_phone`,
`invalid_time`, `off_grid`, `not_same_day`, `outside_hours`, `too_short`, `too_long`, `in_past`, `invalid_ref`, `invalid_reason`,
`invalid_hours`, `invalid_plan`, `invalid_qr`, `invalid_device`, `invalid_subscription`, `weak_password`, `invalid_date`,
`invalid_method`, `cash_not_allowed` (pay on arrival is switched off), `invalid_pay_on_arrival`.
Auth: `device_required` (401), `unauthorized`/`invalid_token`/`account_disabled`/`invalid_credentials` (401), `forbidden` (403),
`customer_blocked` (403), `too_many_attempts` (429), `too_many_pending` (429, more than 3 open holds for one phone).
Conflicts: `slot_taken`, `illegal_transition`, `hold_expired`, `ref_used`, `phone_taken`, `already_bootstrapped` (409).
Missing: `not_found`, `booking_not_found`, `room_not_found`, `user_not_found` (404).

## 7. Checks

```bash
npm run check     # tsc --noEmit && vitest run (pure rules: slots, price, overlap, transitions, phones, codes,
                  #   offline replay clock, atomic confirm/edit outcome, reference reuse, stale verifications, hold grace, assetlinks)
npm test
```
