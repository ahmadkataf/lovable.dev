# Focus Point — booking system (app + website + management)

One codebase, two parts, one deployment:

- `api/` — Cloudflare Worker + D1 (SQLite): accounts, rooms, floor plan, bookings with slot holds, Sham Cash
  payment flow, Web Push notifications (VAPID), cron jobs (expire holds, reminders, completion), admin API.
  It also serves the built web app (`[assets]`), so the whole system is one Worker URL.
- `web/` — Vite + React + TypeScript PWA (installable on Android/iOS as an app, works as the website).
  RTL Arabic, light mode, white and modern with flat colour: pure white, slate neutrals, burgundy brand (Alexandria + Poppins).
  A public website (landing, spaces, about, contact) sits in front of the booking flow (`/book`).
  Customer side, no accounts: floor plan → room → date/time → name + phone → Sham Cash payment → confirmation + notifications
  (the app remembers its bookings by a device id; a booking can also be found by its code + phone).
  Admin side (`/admin`): dashboard, pending payment verifications, bookings calendar, manual bookings,
  rooms and their contents, the floor plan editor, users, settings (hours, Sham Cash wallet/QR), announcements, reports.
- `shared/types.ts` — the domain model and the HTTP API contract both sides compile against.

## Simple by design
- Customers never sign up: name and phone at booking time, that is all. Only the team logs in.
- Few screens, one job each, lots of white space, a white flat palette (no beige); no dashboards full of numbers.
- The team app works **offline**: rooms, bookings and settings are cached on the device; changes made without internet
  (walk-in bookings, confirmations, room edits) are queued and replayed to the cloud as soon as it is back, idempotently.
  The customer app shows its cached plan and bookings offline; creating a booking needs internet (the payment flow does).

## Payment (Sham Cash)
Sham Cash has no public merchant API we could verify, so the flow is the one every Syrian shop uses, made
tight and automatic around it:
1. The customer picks a room and time → the slot is **held** for `hold_minutes` (default 30) with a 6-character booking code.
2. The payment screen shows the centre's Sham Cash number and QR, the exact amount, and the code to write in the
   transfer note, with a countdown. The customer transfers in the Sham Cash app and enters the **transaction number**.
3. Staff get a push notification, see the pending verification (amount, code, reference, customer) next to their
   Sham Cash app, and confirm or reject with one tap → the customer gets a push + in-app notification immediately.
4. If Sham Cash (or a bank) ever offers callbacks, `POST /v1/payments/shamcash/webhook` matches a reference and
   amount to the booking and confirms it automatically.
5. Optional **pay on arrival** (`allow_pay_on_arrival` in settings, off by default): the customer picks «الدفع عند الوصول»,
   the booking goes straight to the team's verification list (no transfer, no hold) and staff confirm it at the desk.

## Notifications
Web Push (works in Chrome/Android and in the installed PWA on iOS 16.4+). Staff are notified of new bookings and
submitted payments; customers of confirmation, rejection, expiry, and a reminder one hour before the booking.
Every notification is also stored in the in-app inbox.

Deploy everything with one command: `cd focuspoint && node deploy.mjs` (details in `docs/HANDOVER.md`).

See `api/README.md` and `web/README.md` for setup, secrets, local development and deployment, and `docs/HANDOVER.md`
(Arabic) for the first deployment on the Cloudflare account, moving to another account/domain, Google Play notes and cost.
