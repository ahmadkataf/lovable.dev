# Focus Point — web app (`web/`)

Vite + React 18 + TypeScript PWA. Arabic, RTL, light mode only, mobile-first. One build serves both the customer
booking flow and the team panel (`/team/*`, in `src/team/`), and the API Worker serves the built files so the whole
system is one URL.

## Run

```bash
cd web
npm install
VITE_API_BASE=http://127.0.0.1:8799 npm run dev     # dev server on http://localhost:5173, API on the Worker's dev port
npm run check                                        # tsc --noEmit && vite build  (what CI should run)
npm run build                                        # icons + vite build → dist/
npm run preview                                      # serve dist/ locally
```

`VITE_API_BASE` is the API origin. Leave it empty (the default) when the Worker serves the app: requests then go to
`/v1/...` on the same origin. Put it in `.env.local` for local development (see `.env.example`). There are no secrets
in the web app; the VAPID *public* key comes from `GET /v1/settings`.

## Layout

```
src/
  main.tsx, App.tsx          entry + router (customer routes under <Layout/>, /team/* lazy-loads src/team/TeamApp.tsx)
  styles.css                 design tokens (--wine --plum --cream --paper --gold --ink --mute), fonts, base, utilities
  device.ts                  deviceId(): the random id that identifies this install (X-Device header)
  api.ts                     api.get/post/patch/del, ApiError (status, offline), errorMessage()
  offline.ts                 useOnline(), cache (IndexedDB kv), cachedGet() (network first → cache)
  format.ts                  Asia/Damascus date/time formatting, SYP, phone normalisation, status labels
  team.tsx                   TeamProvider / useTeam / RequireTeam (inline login screen)
  ui/                        Button Card Field Input Select Textarea Stepper Toggle Sheet Badge Empty Spinner Tabs Segmented OfflineBar Icon, useToast + ToastHost
  plan/PlanView.tsx          the floor plan (SVG) coloured by availability
  lib/                       booking logic (slots, prices), data hook, push, ics, inbox state, per-device memory
  components/                Layout, RoomSheet, PaymentPanel, BookingSummary, NotifyPrompt, InstallHint
  pages/                     Home (/), Book (/book/:roomId), BookingPage (/b/:id), Mine (/mine), Inbox (/inbox)
  team/                      the team panel (separate module; must `export default` a component for /team/*)
  sw.ts                      service worker (injectManifest, no Workbox runtime)
scripts/icons.mjs            renders public/icons/*.png from ../shared/logo.svg with Playwright (runs before builds)
```

Shared code lives in `../shared` (types, fonts, logo) and is imported as `@shared/...` (Vite alias + tsconfig path).

## Customer flow (no accounts)

1. **Home** — pick day / start time / duration (defaults: today, next free slot, 2 h), see the plan and the room list
   coloured from a single `GET /v1/availability?date=`, tap a room → sheet with contents and price → «احجز هالغرفة».
   After closing time the chosen day auto-advances to the next bookable day (the «اليوم» chip is disabled); the room
   sheet only lets you book a start time that is still offered.
2. **/book/:roomId?date&start&minutes** — name + phone (remembered on the device), people, note; when
   `settings.allow_pay_on_arrival` is on, a «طريقة الدفع» segmented control (تحويل شام كاش / الدفع عند الوصول) →
   `POST /v1/bookings` (`method: 'cash'` for pay-on-arrival) → `/b/:id`. The price shown is the server's formula
   (`lib/booking.ts priceFor`: hourly, and from 8 h the cheaper of the day price and hourly).
3. **/b/:id** — driven by `status`: Sham Cash payment panel with countdown (`pending_payment`; after `hold_until` the
   form is replaced by «انتهت مهلة الحجز» + «احجز من جديد», and a 409 `hold_expired` does the same), «وصلنا، عم نتحقق»
   (`awaiting_verification`), «سيؤكد الفريق حجزك قريباً، والدفع عند الوصول» for cash bookings, success card with .ics
   and address (`confirmed`), or the reason + «احجز من جديد». Polls every 15 s while a payment is in flight, refreshes
   at once when a push about the booking arrives, and the customer can cancel until it is confirmed.
4. **/mine** — bookings from this device (upcoming / history) and lookup by code + phone (the server adopts the booking
   onto this device). **/inbox** — notifications; opening it marks them read; the nav shows the unread count.

## Offline

Two layers, both without external libraries:

- **Service worker** (`src/sw.ts`, built by vite-plugin-pwa in `injectManifest` mode): precaches the app shell
  (`self.__WB_MANIFEST`), serves navigations network-first with the cached `index.html` as fallback, hashed assets
  cache-first, and `/v1/settings`, `/v1/rooms`, `/v1/availability*` network-first with the last good response as
  fallback. It takes over immediately (`skipWaiting` + `clients.claim`); the app reloads once if a stale chunk 404s.
- **App cache** (`src/offline.ts`): `cachedGet()` writes every successful GET to IndexedDB (`focuspoint` / `kv`) and
  returns it when the network fails. The home screen and `/mine` render from it with an `OfflineBar`; booking is
  disabled offline with a clear message (payment needs the network). The team panel builds its offline queue on the
  same `cache` helper.

## Push notifications

- The prompt appears once, after the first booking (and on `/mine` when there are bookings), never on first load.
- `lib/push.ts` subscribes with `settings.vapid_public_key` and sends the subscription to `POST /v1/push/subscribe`
  (tied to the device by `X-Device`). It re-registers silently when permission is already granted but the endpoint
  changed. iOS needs the app installed to the home screen (iOS 16.4+); the install hint explains how.
- `sw.ts` handles `push` → `showNotification(title, { body, data: { url }, icon, badge, dir: 'rtl', lang: 'ar' })`
  **and** forwards the payload to every open window (`postMessage({ type: 'push', payload })`), then
  `notificationclick` → focus the open app and navigate, or open a new window. Payload = `shared/types.ts PushMessage`
  (`kind`, `booking_id`, `url`, `title`, `body`, `tag?`); the target is derived from `kind`: team kinds →
  `/team/bookings?booking=ID`, customer kinds → `/b/:id`, else `/inbox`.
- Open windows react to the forwarded push: the inbox and «حجوزاتي» refresh (`lib/notifications.tsx`), `/b/:id`
  re-reads its booking, and the team panel pulls immediately, plays a short WebAudio chime (`team/sound.ts`, can be
  muted in الإعدادات ← المركز ← هذا الجهاز) and marks the booking «جديد» for 60 s. In between pushes the panel polls
  `GET /v1/team/ping` every 5 s while visible and pulls `GET /v1/team/sync?since=` when `last_change` moves.
- Dates are shown in `settings.timezone` (`format.ts setTimeZone`, remembered in `localStorage`, Asia/Damascus until
  the settings arrive).

## Installable (PWA)

`manifest.webmanifest` (name فوكس بوينت, short_name Focus Point, theme `#7b1e2e`, background `#f6f1ea`, standalone,
`dir: rtl`, `lang: ar`) with 192/512 PNG icons plus a maskable 512 and an Apple touch icon, all rendered from
`shared/logo.svg` by `scripts/icons.mjs`. The script runs before every build, skips when the PNGs are newer than the
logo, and only warns when Playwright is unavailable (the PNGs are committed).

## How the Worker serves the app

`npm run build` writes `dist/`. The Worker's `[assets]` binding points at `../web/dist` with `not_found_handling =
"single-page-application"` so deep links (`/b/123`, `/team/...`) load `index.html`; `/v1/*` is handled by the Worker
itself. Because the app and API share an origin, `VITE_API_BASE` stays empty in production and no CORS is involved.
