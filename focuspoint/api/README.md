# Focus Point API — Cloudflare Worker + D1

The whole system is one Worker: `/v1/*` is the JSON API described in `../shared/types.ts` (`ApiContract`), everything
else is the built web app (`../web/dist`) served from `[assets]` with an `index.html` fallback. D1 (SQLite) stores the data,
a cron runs every 5 minutes, Web Push goes out with VAPID.

```
src/index.ts      router, CORS, role guards, SPA fallback, scheduled() entry
src/routes/       public.ts (customers) · team.ts · sync.ts (offline) · admin.ts · payments.ts (webhook)
src/service.ts    booking + room operations shared by the online routes and the offline replay
src/bookings.ts   pure rules: slot validation, price, overlap, codes, status machine   (unit-tested)
src/auth.ts       PBKDF2 passwords, HS256 bearer tokens, login rate limiting
src/settings.ts   defaults + validation of the settings row and the floor plan
src/notify.ts     inbox rows + push (Arabic texts) · src/push.ts Web Push (RFC 8291/8292 via WebCrypto)
src/cron.ts       expire holds · remind 1h before · complete finished bookings
src/tz.ts         Asia/Damascus ↔ UTC helpers · src/validate.ts phone normalisation and input checks
schema.sql        D1 schema · seed.sql six rooms with plan rectangles and SYP prices
```

## 1. Setup

```bash
cd api && npm install
npx wrangler login
npx wrangler d1 create focuspoint          # paste the database_id into wrangler.toml
npm run db:schema                          # applies schema.sql to the remote D1
npm run db:seed                            # six rooms (run once)
```

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
(cd ../web && npm run build) && npm run deploy
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
finds a booking from another phone/device and attaches the device when the booking has none. Reads, payment and cancel on
`/v1/bookings/:id` need the owning device or a team token. Phones in `blocked_customers` get 403 `customer_blocked`.

**Team.** `POST /v1/team/login` → bearer token (30 days). The user row is re-read on every request, so disabling an account
or changing a role takes effect at once. Login is rate limited: 5 failures per phone and 20 per IP in 15 minutes → 429.
Passwords: PBKDF2-SHA256, 100 000 iterations, random salt, min 6 chars. `/v1/admin/*` needs role `admin`.

**Booking flow (Sham Cash).**
1. `POST /v1/bookings` validates the slot (open–close in Asia/Damascus, 30/60-minute grid, min/max duration, same local day,
   not in the past), prices it (hours × `price_hour`, half hours allowed; ≥ 8 h takes `min(price_day, hourly)`), and creates
   `pending_payment` with `hold_until = now + hold_minutes` and a 6-character code (alphabet without 0/O/1/I). Team gets
   `booking_created`.
2. `GET /v1/bookings/:id` returns `payment` (amount, code, Sham Cash number/name/QR, instructions, hold_until). The customer
   transfers and calls `POST /v1/bookings/:id/payment {ref}` (4–40 chars, unique among non-rejected bookings) →
   `awaiting_verification`; team gets `payment_submitted`. A hold that already ran out answers 409 `hold_expired`.
3. Staff: `POST /v1/team/bookings/:id/confirm` or `/reject {reason}`. The customer device gets `booking_confirmed` /
   `booking_rejected` (inbox + push).
4. **Webhook** `POST /v1/payments/shamcash/webhook` (header `X-Webhook-Secret`, constant-time compare) logs every event to
   `payment_events`, then matches a live booking by `ref` (= the reference the customer typed) or by a booking code found in
   `note`; if `amount ≥ price` the booking is confirmed automatically (`verified_by` NULL). Duplicate deliveries answer
   `{matched:true}` without changes.

Status machine (anything else → 409 `illegal_transition`):
`pending_payment → awaiting_verification | confirmed | expired | cancelled | rejected`,
`awaiting_verification → confirmed | rejected | cancelled`, `confirmed → cancelled | completed`; the rest are terminal.
Customers may cancel only before confirmation; the team may cancel anything live (customer gets `booking_cancelled`).

**Double-booking protection.** A slot is blocked by `confirmed`, `awaiting_verification`, and `pending_payment` whose
`hold_until` is in the future. D1 has no row locks, so `service.ts/insertChecked` inserts the booking and then re-reads every
live booking overlapping it: if another one with a *lower id* exists, the new row is deleted and the request answers 409
`slot_taken`. Two racing requests therefore resolve deterministically — the earlier insert keeps the slot, the later one
removes itself. Confirming also re-checks overlaps (a hold may have expired and been re-booked meanwhile).

**Cron (every 5 minutes, `src/cron.ts`).** Expire `pending_payment` past `hold_until` (→ `expired`, customer notified);
remind confirmed bookings starting in 55–65 minutes once (`reminded = 1`); complete confirmed bookings whose end passed.

**Notifications.** Every notification is a row in `notifications` (inbox, `GET /v1/notifications`) and a Web Push to all
subscriptions of the recipient (`push_subscriptions`, tied to a team account or a customer device). Push is best effort in
`ctx.waitUntil`; endpoints answering 404/410 are deleted, other failures are counted and dropped after 8.
Announcements: `to: 'team'` → every enabled account; `to: 'customers'` → every device with a push subscription.

**Settings.** `settings` is a single JSON row merged over the defaults in `settings.ts` (centre facts, 09:00–23:00, slot 30,
min 60, max 720, hold 30, the default 1200×800 plan). `GET /v1/settings` exposes only `PublicSettings`; the Sham Cash details
reach customers only through a booking's `payment` block. PATCH validates `HH:MM` hours (open < close), the plan JSON, the QR
data URL (`image/png|jpeg|webp`, ≤ 300 KB), and that min/max are multiples of the slot.

**Rooms.** `DELETE /v1/admin/rooms/:id` hard-deletes a room only when no booking references it (FK) and records the id in
`deleted_rooms`; otherwise it sets `active = 0`. Public `GET /v1/rooms` returns active rooms; sync returns all rooms.

## 5. Offline sync protocol (team app)

```
GET  /v1/team/sync?since=<iso>   → { now, rooms (all, incl. inactive), bookings, settings (full), deleted_rooms }
POST /v1/team/sync { ops }       → { results: SyncResult[], now }
```

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
`invalid_hours`, `invalid_plan`, `invalid_qr`, `invalid_device`, `invalid_subscription`, `weak_password`, `invalid_date`.
Auth: `device_required` (401), `unauthorized`/`invalid_token`/`account_disabled`/`invalid_credentials` (401), `forbidden` (403),
`customer_blocked` (403), `too_many_attempts` (429), `too_many_pending` (429, more than 3 open holds for one phone).
Conflicts: `slot_taken`, `illegal_transition`, `hold_expired`, `ref_used`, `phone_taken`, `already_bootstrapped` (409).
Missing: `not_found`, `booking_not_found`, `room_not_found`, `user_not_found` (404).

## 7. Checks

```bash
npm run check     # tsc --noEmit && vitest run (pure rules: slots, price, overlap, transitions, phones, codes)
npm test
```
