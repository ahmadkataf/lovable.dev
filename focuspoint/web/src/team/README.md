# Team panel (`web/src/team/`)

The staff/admin side of the Focus Point PWA, mounted at `/team/*` (lazy-loaded from `App.tsx`). Arabic, RTL, light
mode, mobile-first. Side nav on desktop (≥ 900 px), bottom tabs on phones. Signed-in team only: `TeamApp` wraps
everything in `<RequireTeam>` (inline login screen from `../team.tsx`).

## Offline-first (`store.ts`)

The panel never talks to the API from a screen for its core data. Everything goes through one store:

| part | what | where |
| --- | --- | --- |
| `base` | rooms, bookings (last 90 days + upcoming), settings, sync cursor — the server's truth as last pulled | IndexedDB `focuspoint/kv` key `team:base` (via `../offline.ts` `cache`) |
| `queue` | `SyncOp[]` made on this device and not yet accepted by the server, each with a UUID `client_id`, a label and a status (`pending` / `failed` + server error code) | key `team:queue` — written **before** the UI updates, so an op is never lost |
| `view` | `base` with every queued op applied on top (pure `applyOp`) — what screens render | derived, memoised in the snapshot |

Mutations (`manualBooking`, `confirm`, `reject`, `cancel`, `editBooking`, `upsertRoom`, `patchSettings`) append an op,
persist the queue, re-derive the view (optimistic UI) and trigger a sync. Entities created offline get a deterministic
negative id (`tempId(client_id)`); ops that reference a temp id wait until the creating op has been accepted, then are
rewritten with the real id (`remap`).

Sync loop (`useSyncLoop`, mounted once in `TeamApp`): on load, on `online`, on tab focus, every 30 s, and ~250 ms after
each new op. One run = `push()` (POST `/v1/team/sync` with the longest prefix of sendable pending ops, apply results:
remove accepted ops, upsert returned bookings/rooms, flag failures) then `pull()` (GET `/v1/team/sync?since=<cursor>`,
merge rooms/bookings/settings, drop deleted rooms, keep 90 days). Failed ops stay in the queue as "يحتاج انتباه" with
the server's reason (e.g. slot taken); the sync sheet (header pill) offers إعادة / تجاهل. `refetch()` forces a full pull.

Header pill states: متصل · دون اتصال (· N) · N بانتظار الإرسال · جارٍ الإرسال · N يحتاج انتباه · خطأ.

A few actions are REST-only and need the network (they are not `SyncOp`s): deleting a room, blocking a customer, team
accounts, announcements, reports, push subscription. Their buttons explain this when offline.

## Screens

| route | file | job |
| --- | --- | --- |
| `/team` | `Today.tsx` | pending payment verifications (confirm / reject), 3 counters, "تفعيل إشعارات الفريق", today's timeline per room, "+ حجز" |
| `/team/bookings` | `Bookings.tsx` | day grid (rooms × hours, tap an empty cell → prefilled walk-in) and a filterable list (date, room, status, name/phone/code) |
| `/team/rooms` | `Rooms.tsx` | room cards; admin: create/edit sheet (type, capacity, contents, prices, colour, active, delete rule) |
| `/team/plan` | `PlanEditor.tsx` | floor plan editor: drag/resize (8 handles)/arrow-key nudge rooms, walls and labels on a 20-unit grid; unplaced rooms list; canvas size; undo/redo; save → `room_upsert` + `settings_patch` ops |
| `/team/customers` | `Customers.tsx` | search by phone/name, bookings count, block toggle |
| `/team/settings/*` | `Settings.tsx` | tabs: المركز (info + hours/slot/min/max/hold) · الدفع (Sham Cash number/name/QR ≤512 px data URL/instructions with live preview of the customer panel) · الفريق · إعلان · التقارير (revenue, hours by room as SVG bars, CSV) |

Shared: `BookingSheet.tsx` (details, tel/WhatsApp, confirm/reject/cancel/edit), `ManualBookingSheet.tsx`, `common.tsx`
(PageHead, Section, Confirm, SyncPill), `push.ts` (team Web Push), `util.ts` (ids, Arabic error text, prices, labels,
CSV), `team.css` (panel styles on top of `../styles.css` tokens).

## Contracts used

Only the documented modules: `../api` (`api`, `ApiError`), `../offline` (`cache`, `cachedGet`), `../team`
(`RequireTeam`, `useTeam`), `../format`, `../ui`, `@shared/types`. Nothing outside `src/team/` is edited.
