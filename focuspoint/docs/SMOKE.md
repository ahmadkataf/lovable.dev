# Focus Point — integration smoke test (2026-10-24)

Integration pass over the three parts (`api/`, `web/` customer app, `web/src/team/` panel) against the **real stack**:
`wrangler dev --local --port 8799 --test-scheduled` (workerd + local D1, serving `web/dist`), driven by Node `fetch`
and headless Chromium (Playwright). Nothing was mocked.

## 1. Static checks

| where | command | result |
|---|---|---|
| `api/` | `npm run check` (`tsc --noEmit && vitest run`) | green — 23 tests, 2 files |
| `web/` | `npm run check` (`tsc --noEmit && vite build`, covers `src/team/**`) | green — 77 modules, 20 precache entries (461 KiB), `dist/sw.js` emitted |

No contract mismatches between `api`, `web` and `team`: every name in `shared/types.ts` resolves on both sides and the
team panel compiled under `strict + noUnusedLocals/Parameters` without edits.

## 2. Local environment

```bash
cd api
npx wrangler d1 execute focuspoint --local --file=./schema.sql
npx wrangler d1 execute focuspoint --local --file=./seed.sql          # 6 rooms
npm run vapid                                                          # keys pasted into .dev.vars
# .dev.vars (git-ignored): TOKEN_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, WEBHOOK_SECRET, ADMIN_SETUP_KEY
(cd ../web && npm run build)
npx wrangler dev --local --port 8799 --test-scheduled                  # ready in ~3 s; GET /v1/health → {ok:true}
```

workerd starts fine in this container. `wrangler dev` does **not** pick up a rebuilt `web/dist` — restart it after
`npm run build`.

## 3. API smoke — `docs/smoke/api-smoke.mjs` — 71/71 passed

Run: `node docs/smoke/api-smoke.mjs` (re-runs: `DAY_OFFSET=2 node …` so the booking days do not collide).

What it exercises, in order, with a UUID `X-Device` per customer:

- **Bootstrap**: `POST /v1/admin/bootstrap` → 201 admin + token; wrong key → 403; second call → 409 `already_bootstrapped`.
- **Public reads**: `GET /v1/settings` (no Sham Cash fields leak), `GET /v1/rooms` (6 seeded rooms, all with plan rects),
  `GET /v1/availability?date=` (bad date → 400 `invalid_date`), non-UUID `X-Device` → 400 `invalid_device`,
  missing `X-Device` on a write → 401 `device_required`.
- **Guest booking**: `+963 944 123 456` normalised to `0944123456`; 2 h in غرفة 1 → 201 `pending_payment`, `hold_until`
  set, 6-char code, price 30 000; overlapping request from another device → 409 `slot_taken`; 10:15 start → 400
  `off_grid`; 23:00–24:00 → 400 `not_same_day`.
- **Mine / lookup**: `GET /v1/bookings/mine` lists it with `room_name`; another device sees an empty list; lookup by
  lower-case code + phone from another device → the booking; wrong phone → 404; `GET /v1/bookings/:id` from a foreign
  device → 403; owner gets `payment` (number 0985258963, amount, code).
- **Payment**: ref `12` → 400 `invalid_ref`; valid ref → `awaiting_verification`; team inbox has `booking_created`
  and `payment_submitted`.
- **Team**: wrong password → 401 `invalid_credentials`; login → token; `GET /v1/team/me`; garbage token → 401
  `invalid_token`; dashboard `pending` contains the booking; confirm → `confirmed` with `verified_by`; confirm again →
  409 `illegal_transition`; customer `GET` shows `confirmed`; customer inbox has `booking_confirmed`; mark read → ok.
- **Cancel rules**: customer cannot cancel a confirmed booking (409); customer cancels a pending one → `cancelled`;
  team cancels a confirmed one → `cancelled` and the customer gets `booking_cancelled`.
- **Manual booking**: cash → `confirmed`, priced from the room; same `client_id` twice → same booking id;
  `PATCH /v1/team/bookings/:id` moves it and sets the note.
- **Sync**: `POST /v1/team/sync` with `[manual_booking (free), confirm, room_upsert {client_room_id}, settings_patch
  {plan}, confirm 999999]` → first four `ok` (free booking priced 0, new room gets a real id), the fifth
  `ok:false, error:'booking_not_found'` without stopping the batch; replaying the identical ops returns the identical
  stored results; `GET /v1/team/sync?since=` returns the new booking, the confirmed one, the new room and the patched
  plan (settings include Sham Cash fields); staff `room_upsert` via sync → `forbidden`; staff on `/v1/admin/*` → 403;
  `DELETE /v1/admin/rooms/:id` on the unused room → `outcome:'deleted'` and the id appears in `deleted_rooms`.
- **Admin settings**: plan restored via `PATCH /v1/admin/settings`; `open: 23:00, close: 09:00` → 400 `invalid_hours`.
- **Webhook**: wrong `X-Webhook-Secret` → 401 `invalid_secret`; right secret with the typed ref + amount → `matched:true`,
  booking `confirmed` with `verified_by: null`; duplicate delivery → `matched:true`, no change.
- **Cron**: a pending booking's `hold_until` back-dated (`wrangler d1 execute --local`), `GET /__scheduled?cron=*/5+*+*+*+*`
  → booking `expired`, customer gets `booking_expired`, the slot no longer appears in availability.
- **Rest**: admin report (revenue + bookings), customer search, block → booking from that phone 403 `customer_blocked`,
  unblock; SPA fallback (`/team/plan` → `index.html`), `sw.js` served as JavaScript, CORS preflight allows `X-Device`,
  unknown `/v1/*` → 404 JSON.

## 4. UI smoke — `docs/smoke/ui-smoke.mjs` — 33/33 passed, 0 page errors

Run: `UI_DAY=<n> node docs/smoke/ui-smoke.mjs` (n = home-screen day chip, fresh per run; needs the admin created by the
API smoke). Phone context 390×844 (`isMobile`, touch); desktop context 1280×800 for the team panel.
Screenshots in `docs/screens/`:

| customer (phone) | team (desktop) |
|---|---|
| `01-home.png` plan + room cards | `10-team-login.png` |
| `02-room-sheet.png` | `11-team-today.png` pending verification |
| `03-book-form.png` | `12-team-plan.png` after the drag |
| `04-payment.png` Sham Cash panel | `13-team-offline-bookings.png` |
| `05-awaiting.png` | `14-team-offline-queued.png` pill «دون اتصال · 1» |
| `06-mine.png` | `15-team-synced.png` pill «متصل» |
| `07-confirmed.png` | `16-team-bookings.png`, `17-team-rooms.png`, `18-team-settings.png` |
| `08-inbox.png` | `19-team-phone.png` (390 px, bottom tabs) |

Verified:

1. `/` renders the floor plan as SVG (6 `g.plan-room > rect`), 6 room cards, hours «يومياً 9:00 ص – 11:00 م».
2. Day chip → 16:00 → ساعتين → tap غرفة 1 on the plan → sheet with the 2 h price (30 000) → «احجز هالغرفة» →
   `/book/1?date=…&start=16:00&minutes=120`.
3. Name + phone → «تأكيد الحجز» → `/b/:id` with the payment panel: Sham Cash number 0985258963, amount 30 000 ل.س,
   6-char code, 30-minute countdown, QR slot, three steps.
4. Transaction number → «أرسلت المبلغ — تأكيد» → «وصلنا، عم نتحقق». `/mine` lists the booking as «عم نتحقق من الدفع».
5. `/team` → inline login → اليوم shows «بانتظار التحقق من الدفع (1)» with the customer, code and ref; pill «متصل».
   «تأكيد» removes the card optimistically; after sync the server booking is `confirmed`; the customer's `/b/:id`
   shows «حجزك مؤكد» and `/inbox` has the confirmation.
6. `/team/plan`: pointer drag of غرفة 1 moves it (snapped to the 20-unit grid), «حفظ» enables, saving queues a
   `room_upsert` and the server's `GET /v1/rooms` reflects the new rect; «حفظ» disables again.
7. **Offline** (`context.setOffline(true)` + reload): the team shell loads from the service worker, اليوم lists the 6 rooms
   from IndexedDB, pill «دون اتصال», the bookings list shows cached bookings; «+ حجز» (cash, day +1, 11:00) → toast,
   pill «دون اتصال · 1»; the queued op survives a reload. `setOffline(false)` → queue flushed, pill «متصل», the server
   has the walk-in as `confirmed`/`cash`.
8. Team panel at 390 px shows the bottom tab bar.

Console: 0 `pageerror`; 8 `console.error` entries, all `Failed to load resource: net::ERR_INTERNET_DISCONNECTED`
from the deliberate offline phase (expected).

## 5. Fixed during integration

- **`web/src/sw.ts` — offline navigations failed (`net::ERR_FAILED`).** Cloudflare Workers Assets answers
  `/index.html` with a 307 to `/`. The service worker precached that *redirected* response and later served it to a
  navigation request, which browsers reject (a redirected response for a request with redirect mode `manual`). The
  install step now stores a clean copy (`new Response(body, {status: 200, headers})`) when `res.redirected` is true.
  This would have broken the offline shell in production too. Rebuilt `web/dist`; retested: offline reload works.

Nothing else needed a code change. All other failures seen while running were in the test harness itself (fixed
payment references colliding with `ref_used` on re-runs, a selector hitting the `<defs>` pattern rect, `/mine`
listing by room/status rather than code, the Bookings screen opening in day view) and were corrected in the scripts.

## 6. Remains / notes for deployment

- `wrangler.toml` still has `database_id = "REPLACE_ME"`; set it after `wrangler d1 create focuspoint`, set the six
  secrets with `wrangler secret put`, then `(cd web && npm run build) && (cd api && npm run deploy)`.
- Web Push was tested only as far as the API (`/v1/push/subscribe` validation) and the SW handlers compiling; no real
  push service was reachable from the container, so an end-to-end notification on a phone is not covered here.
- The plan-editor drag was tested with mouse-driven pointer events on desktop; touch dragging on a phone was not tested.
- The customer booking at day +N and the walk-ins created by these runs remain in the **local** D1 (`api/.wrangler/`,
  git-ignored); room 1's plan rect was restored to the seed position after the drag tests.
- Local dev admin created by the smoke run: phone `0985258963`, password `Admin123!` — local D1 only.
