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

## 7. Review fixes — API re-check (2026-10-25)

Against `wrangler dev --local --port 8798 --test-scheduled` after the booking/offline review fixes (schema re-applied for
`booking_devices`). Script kept out of the repo; the same calls are easy to repeat with `curl`:

- `GET /.well-known/assetlinks.json` → one statement for `com.focuspoint.app` with the fingerprint from `ASSETLINKS_FINGERPRINTS`.
- `GET /v1/team/ping` → `{now, pending, last_change}`; `pending` grows and `last_change` moves after a booking.
- Pay on arrival: `method: 'cash'` → 400 `cash_not_allowed` while off; after `PATCH /v1/admin/settings {allow_pay_on_arrival: true}`
  → 201 `awaiting_verification`, `hold_until: null`, team inbox `payment_submitted` «دفع عند الوصول», dashboard `pending` lists it;
  `method: 'free'` → 400 `invalid_method`.
- Lookup adopts: device B gets 403 on `/v1/bookings/:id`, then `lookup?code=&phone=` → B reads `/:id` (with `payment`), sees it
  in `/mine`, pays; device A still sees it; after a team reject **both** devices have `booking_rejected`.
- Reference reuse: the rejected booking's ref is accepted on a new booking; the same ref on a third booking → 409 `ref_used`.
- Atomic confirm/edit: confirm → 200; confirm again → 409 `illegal_transition`; `PATCH` moving a booking onto a confirmed one →
  409 `slot_taken`; a note-only edit → 200.
- Offline clock: `manual_booking` for yesterday 09:00–10:00 local with `at` = yesterday 09:05 → `ok` (confirmed); the same slot
  with `at` = now → `in_past`.
- Cron: an `awaiting_verification` booking whose end was back-dated 2 h → `expired` with the note «انتهت المهلة دون تحقق من
  الدفع (إغلاق تلقائي)» (`cron {"expired":2,"stale":1,…}`); a hold back-dated 5 min is **not** expired by the cron and its
  reference is accepted (grace); a hold back-dated 15 min → 409 `hold_expired`.

Local D1 now has `allow_pay_on_arrival: true` and the rows these calls created (git-ignored `.wrangler/`).

## 8. Integration re-run after the review fixes (2026-10-25)

Same real stack as §2, rebuilt from scratch: `api/.wrangler/state` deleted, `schema.sql` + `seed.sql` re-applied, `.dev.vars`
with the dev values plus `PUBLIC_URL=http://127.0.0.1:8799` (`ASSETLINKS_FINGERPRINTS` comes from `wrangler.toml [vars]`),
`web/dist` rebuilt, `wrangler dev --local --port 8799 --test-scheduled`.

### 8.1 Static checks

| where | command | result |
|---|---|---|
| `api/` | `npm run check` | green — 36 tests, 3 files (`validate` 6, `bookings` 17, `rules` 13) |
| `web/` | `npm run check` | green — 21 precache entries (484 KiB), `dist/sw.js` emitted |

### 8.2 API smoke — `docs/smoke/api-smoke.mjs` — 118/118 passed

Runs: `DAY_OFFSET=1` on the fresh database → **118 passed, 0 failed**; re-runs `DAY_OFFSET=2` and `DAY_OFFSET=3` on the same
database → 118/118 each (the script is re-run safe; its `pending` checks are relative to the previous ping).

Two expectations of the old script were wrong under the new rules and were fixed in the script, not the API:

- `GET /v1/bookings/:id` from the second device returned 200, not 403 — because the lookup that ran just before it now
  **adopts** the booking for that device. The 403 is now checked *before* the lookup; after it the script asserts the adoption.
- the cron did **not** expire a hold back-dated by 1 minute — correct: holds are expired only after the 10-minute grace.
  The script back-dates by 15 minutes now and checks the grace case separately.

New checks (section 11 of the script, plus the ping/adopt lines in sections 3–4):

- **Lookup adopts** (B): device B → 403 before lookup; `lookup?code=&phone=` → 200; then B reads `/v1/bookings/:id` with
  `payment` info, `/mine` on B lists it, `/mine` on A still lists it; after the team confirm **both** devices have
  `booking_confirmed` in their inbox.
- **`GET /v1/team/ping`**: `{now, pending, last_change}`, `pending` equals the dashboard count, 401 without a team token;
  `pending −1` and `last_change` moved after a confirm; `pending +1` and `last_change` moved after a cash booking; a
  verification whose slot has passed is not counted by ping nor listed by the dashboard.
- **Pay on arrival**: `allow_pay_on_arrival` is `false` by default and visible in public settings; `method: 'cash'` while off →
  400 `cash_not_allowed`; `PATCH /v1/admin/settings {allow_pay_on_arrival: 'yes'}` → 400 `invalid_pay_on_arrival`; `true` →
  200; `method: 'free'` from a customer → 400 `invalid_method`; cash booking → 201 `awaiting_verification`, `method: cash`,
  `hold_until: null`, `payment_ref: null`, `payment: null` on `/:id`; team inbox `payment_submitted` with «دفع عند الوصول»;
  dashboard `pending` lists it; it blocks the slot (409 for another customer); `POST /v1/team/bookings/:id/confirm` → `confirmed`
  with `verified_by`; the customer gets `booking_confirmed`; the setting is switched off again at the end.
- **Hold grace** (D): hold back-dated 5 min → cron leaves it `pending_payment`, the slot is already free in `/availability`,
  the reference is accepted → `awaiting_verification`; hold back-dated 15 min → `POST …/payment` → 409 `hold_expired` and
  the booking is `expired`; the slot can be booked again; a reference held by a live awaiting booking → 409 `ref_used`;
  the reference typed on the expired booking is accepted on the new one (G).
- **Stale verifications** (I): an `awaiting_verification` booking whose `start/end` were back-dated (ended 2 h ago) → cron sets
  `expired` with the note «انتهت المهلة دون تحقق من الدفع (إغلاق تلقائي)» and the customer gets `booking_expired`.
- **Offline clock** (A): `POST /v1/team/sync` with a `manual_booking` for 09:00–10:00 local of the current day when local time
  is past 10:05, else of the previous day (at 04:xx Damascus, when this ran, yesterday), with `at` = 09:05 of that day → `ok`,
  `confirmed`, `updated_at` stamped with the server clock (> `op.at`); the same kind of past slot typed online now → 400
  `in_past`. The room rotates with `DAY_OFFSET` so re-runs do not collide.
- **Asset links**: `GET /.well-known/assetlinks.json` → 200 `application/json`, one statement, `com.focuspoint.app`,
  `delegate_permission/common.handle_all_urls`, and the SHA-256 fingerprint read from `api/wrangler.toml` is in
  `sha256_cert_fingerprints`.

### 8.3 UI smoke — `docs/smoke/ui-smoke-2.mjs` — 24/24 passed, 0 page errors

Run: `UI_DAY=5 node docs/smoke/ui-smoke-2.mjs` (fresh home-day chip per run; needs the admin from the API smoke). Every
context is a phone, 390×844, `isMobile` + touch, `ar-SY`. The script enables `allow_pay_on_arrival` through the admin API for the
run and restores it afterwards. Screenshots in `docs/screens/`, prefix `2x-`:

| file | shows |
|---|---|
| `2x-01-book-cash.png` | book form with «طريقة الدفع» segmented, «الدفع عند الوصول» selected |
| `2x-02-awaiting-cash.png` | «استلمنا حجزك … الدفع عند الوصول», badge «بانتظار تأكيد الفريق», no Sham Cash panel |
| `2x-03-team-live.png` | team panel (phone) with the new card at the top, tab badge 7 — no reload |
| `2x-04-team-push-new.png` | same card highlighted with «جديد» after a push delivered to the service worker |
| `2x-05-confirmed-cash.png` | customer page «حجزك مؤكد» after the desk confirm |
| `2x-06-privacy.png` | `/privacy` static page |
| `2x-07-install-ios.png` | install banner with the Safari share-sheet instructions (iPhone UA) |
| `2x-08-install-android.png` | install banner with «تثبيت» / «لاحقاً» (synthetic `beforeinstallprompt`) |

Verified, in order:

1. Team panel opened first and left visible: logged in, bottom tabs; `GET /v1/team/ping` observed 2× in 11 s, gap 5001 ms
   (a tick is skipped while a sync is in flight).
2. Customer: home → day chip → 16:00 → ساعة → غرفة 1 → `/book/1` → name/phone → segmented control present (2 options),
   «الدفع عند الوصول» selected (`aria-checked`), hint «يؤكد الفريق حجزك، وتدفع عند وصولك إلى المركز.» → «تأكيد الحجز» →
   `/b/:id` shows «استلمنا حجزك»; server: `awaiting_verification` / `cash` / `hold_until: null`.
3. Team panel, **without reload**: the pending card for نور appeared **2.6 s** after the customer tapped (2.1 s in the first
   run); pending list +1; the card says «الدفع عند الوصول» and offers «تأكيد الحجز» (not «تأكيد الدفع»); the bottom-tab
   badge went 6 → 7.
4. Bonus (not counted): a Web Push delivered to the team service worker with the CDP command
   `ServiceWorker.deliverPushMessage` (`{"kind":"payment_submitted","booking_id":…}`) → the card gets `is-fresh` + the «جديد»
   chip (sw `push` → `postMessage` → `store.handlePush`). Real push-service delivery is still not covered (no push service
   reachable from the container).
5. Team taps «تأكيد الحجز» → card gone, pill «متصل» → server `confirmed`; customer `/b/:id` shows «حجزك مؤكد».
6. `/privacy`: the footer link on Home navigates to the static page (title «سياسة الخصوصية — فوكس بوينت | Privacy Policy —
   Focus Point», `h1` + sections).
7. Install banner: with an iPhone Safari UA, Home shows «ثبّت فوكس بوينت على جهازك» with the «إضافة إلى الشاشة الرئيسية»
   instructions; «فهمت» dismisses it. With a synthetic `beforeinstallprompt` (headless Chromium never fires the real one) the
   Android variant shows «تثبيت» + «لاحقاً».

Console: 0 `pageerror`, 0 `console.error`.

### 8.4 Fixed during this pass

- **`web/src/styles.css` — footer links unreachable on phones.** At 390 px the footer sits *after* `.page`, which reserves
  room for the fixed bottom nav, so the footer's own last line (`سياسة الخصوصية · فريق العمل`, y 804–824) lay under the nav
  (y 780–844) and could not be tapped (Playwright: `.bottom-nav … intercepts pointer events`). The footer now carries
  `padding-bottom: calc(20px + var(--nav-h) + env(safe-area-inset-bottom))` on phones and `20px` from 768 px up. Rebuilt,
  restarted, retested: the link clicks through to `/privacy`.
- `docs/smoke/api-smoke.mjs`: the two stale expectations above; `ping` `pending` assertions made relative so re-runs pass.

Nothing in `api/` needed a change. The rows created by these runs (days +2…+6 and the back-dated grace/stale bookings) stay
in the local D1 (`api/.wrangler/`, git-ignored); `allow_pay_on_arrival` is back to `false`.
