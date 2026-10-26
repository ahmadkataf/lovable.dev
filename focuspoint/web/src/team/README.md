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
| `/team/settings/*` | `Settings.tsx` | tabs: المركز (info + hours/slot/min/max/hold; الحجز أونلاين: on/off + closed message, days ahead, reminder, customer cancel) · الدفع (طرق الدفع: Sham Cash / pay on arrival, at least one stays on; Sham Cash number/name/QR ≤512 px data URL/instructions/unpaid holds per phone, with a live preview of the customer panel) · الفريق · إعلان · التقارير (revenue, hours by room as SVG bars, CSV) |
| `/team/site/*` | `site/` (lazy) | الموقع (admin): the website + app content editor, see below |

Rooms: the room sheet has «الصور» (≤8, the site editor's gallery widget); photos travel with the `room_upsert` op.

Shared: `BookingSheet.tsx` (details, tel/WhatsApp, confirm/reject/cancel/edit), `ManualBookingSheet.tsx`, `common.tsx`
(PageHead, Section, Confirm, SyncPill), `push.ts` (team Web Push), `util.ts` (ids, Arabic error text, prices, labels,
CSV), `team.css` (panel styles on top of `../styles.css` tokens).

## Site editor (`site/`, docs/cms/DESIGN.md §5–6)

Generated from `CONTENT_SECTIONS` (`@shared/content`) — no section or field is named in the code.

| file | job |
| --- | --- |
| `SiteEditor.tsx` | routes; the section list (معدّل / الأصل, last change, unsaved draft) |
| `SectionEditor.tsx` | one section: folding groups, sticky «حفظ» (validateSection first → the error's field opens and scrolls into view), «تراجع عن آخر حفظ», «استعادة الأصل», «عرض في الموقع», «تجاهل», unsaved-changes guard, offline notice; identity settings (SectionSpec.settings) edited and saved with the same button through `store.patchSettings` |
| `FieldEditor.tsx` / `fields.tsx` / `ImageField.tsx` | a widget per FieldKind: text/longtext (counter, «تمييز»/«رابط» for rich fields, «+ معلومة تلقائية» inserts {placeholders} at the caret, live preview), link, toggle, number, select, icon (SITE_ICONS via `pages/site/SiteIcon`), colour (presets + contrast warning), image, images, list (add / remove / move, max items) |
| `image.ts` | browser-side shrink: ≤1600 px, WebP q 0.82 (JPEG where WebP cannot be encoded), ≤1 MB; HEIC / too-big errors in Arabic |
| `media.ts` / `http.ts` | requests (own fetch/XHR: PUT, raw image body with progress, `path` of invalid_content); Arabic error text |
| `state.ts` | content as the server has it (cached for offline opening), history per section, drafts in IndexedDB (`site:drafts`) |
| `guard.tsx` | link clicks + beforeunload while dirty (BrowserRouter has no useBlocker); a back-swipe is covered by the stored draft |

Every save / undo / reset drops the `/v1/content` memo (`lib/data`) so the site in this tab shows it at once. Browser
check: `web/e2e/site-editor.mjs`.

## Contracts used

Only the documented modules: `../api` (`api`, `ApiError`, `teamToken`), `../device`, `../offline` (`cache`,
`cachedGet`, `useOnline`), `../lib/data` (`dropMemo`), `../team` (`RequireTeam`, `useTeam`), `../format`, `../ui`,
`../pages/site/SiteIcon` (read only), `@shared/types`, `@shared/content`. Outside `src/team/` only `ui/Icon.tsx` gained
icons (globe, image, undo, arrowUp, arrowDown, eye).
