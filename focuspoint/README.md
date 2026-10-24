# Focus Point — booking system (app + website + management)

One codebase, two parts, one deployment:

- `api/` — Cloudflare Worker + D1 (SQLite): accounts, rooms, floor plan, bookings with slot holds, Sham Cash
  payment flow, Web Push notifications (VAPID), cron jobs (expire holds, reminders, completion), admin API.
  It also serves the built web app (`[assets]`), so the whole system is one Worker URL.
- `web/` — Vite + React + TypeScript PWA (installable on Android/iOS as an app, works as the website).
  RTL Arabic, light mode, the Focus Point brand (burgundy / plum / cream / gold, Alexandria + Poppins).
  Customer side: floor plan → room → date/time → booking → Sham Cash payment → confirmation + notifications.
  Admin side (`/admin`): dashboard, pending payment verifications, bookings calendar, manual bookings,
  rooms and their contents, the floor plan editor, users, settings (hours, Sham Cash wallet/QR), announcements, reports.
- `shared/types.ts` — the domain model and the HTTP API contract both sides compile against.

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

## Notifications
Web Push (works in Chrome/Android and in the installed PWA on iOS 16.4+). Staff are notified of new bookings and
submitted payments; customers of confirmation, rejection, expiry, and a reminder one hour before the booking.
Every notification is also stored in the in-app inbox.

See `api/README.md` and `web/README.md` for setup, secrets, local development and deployment.
