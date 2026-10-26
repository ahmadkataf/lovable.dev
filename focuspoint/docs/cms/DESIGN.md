# Site editor ("الموقع") — design

Goal: the admin edits every customer-visible text, image, link and business option of the website and the Android
app (a TWA showing the same site) from the team panel, live, with no deploy. Nothing changes visually until something
is edited: every default is the current hard-coded value, verbatim. Inventory of what exists today:
`docs/cms/inventory.json` (areas: landing, pages, booking-app, admin-and-rules, plus `missing`).

Constraints: Cloudflare Worker + D1 only (no R2/KV, no new bills); portable to another account (everything lives in
the one D1 database + code); Arabic RTL; white flat theme (no beige); works on a phone; the team panel is
offline-first, but the site editor may require a connection (say so clearly when offline).

## 1. Shared contract — `shared/content.ts` (imported by api and web; no DOM / Node APIs)

```ts
export interface Photo { src: string; alt: string; w: number; h: number; small?: string }
export interface SiteContent {
  brand: …        // name_latin, eyebrow ("المشروع الأول من نوعه بدرعا"), slogan, whatsapp (phone, default the centre
                  // phone), email, maps_url, facebook_url, tiktok_url, play_url  (optional links: '' = hidden)
  announcement: … // enabled, text, link_label, link_url, tone: 'info' | 'success' | 'warning'
  home: …         // sections [{id, visible}] (order + visibility of the landing sections), hero, facts, features,
                  // spaces (head), how, gallery, visit, faq, cta — every text/list/photo from the inventory
  spaces: …       // /spaces page head + groups {private, meeting, open}: title, blurb, cap, photo
  about: …        // /about page: head, story paragraphs, values/list items, photos …
  contact: …      // /contact page texts and cards
  footer: …       // tagline, copyright …
  booking: …      // /book + booking flow texts that carry business facts (intro, notes/terms, success, cancellation
                  // note, the "booking paused" title) — NOT generic ui labels or error codes
  messages: …     // notification templates (customer + team) with placeholders {name} {room} {when} {price} {code} …
  seo: …          // site title/description, og image + alt, per-page titles (home, spaces, about, contact, book)
  theme: …        // brand: '#7b1e2e' (one colour; hover/tints are derived)
}
export const DEFAULT_CONTENT: SiteContent          // = today's values, verbatim (copy from the source files)
export const CONTENT_SECTIONS: SectionSpec[]       // the editor's schema, Arabic labels, drives UI + validation
export function mergeContent(stored: unknown): SiteContent   // defaults ⊕ stored overrides, type-checked per field
export function validateSection(id: SectionId, value: unknown): { ok: true; value } | { ok: false; error; path }
export function fillTemplate(t: string, vars: Record<string, string | number>): string   // {x} → value; unknown kept
export const TEMPLATE_VARS: Record<string, string>   // placeholder → Arabic description, for the editor's chips
```

- Field kinds: `text` (≤200), `longtext` (≤2000), `link` (https:// , / , tel:, mailto:, https://wa.me; ≤500),
  `image` (Photo; src must start with `/img/` or `/media/`; alt ≤200), `images` (Photo[] ≤12), `list` (items of
  sub-fields, ≤20), `toggle`, `number` (min/max), `select` (options), `icon` (one of the site icon names),
  `color` (#RRGGBB).
- Live data stays live: texts that show settings/room data use placeholders: {name} {phone} {address} {hours}
  {hoursPerDay} {open} {close} {privateCount} {meetingCapacity} … Where today's code switches wording on
  `allow_pay_on_arrival`, keep both variants as two fields (e.g. `…_cash` and `…_shamcash_only`).
- Merge rules: objects merge per key; arrays (lists, images) replace as a whole; a stored value of the wrong type falls
  back to the default; unknown stored keys are dropped. New fields added later appear with their defaults.

## 2. Storage (D1, all `CREATE TABLE IF NOT EXISTS` in `api/schema.sql`, so `deploy.mjs` applies them)

- `site_content (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, updated_at TEXT, updated_by INTEGER)` —
  JSON `{ [section]: value }`, only sections the admin saved (overrides).
- `media (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, w INTEGER, h INTEGER, bytes INTEGER,
  created_at TEXT, created_by INTEGER)` — images uploaded from the editor, ≤ 1,000,000 bytes each (the browser
  compresses to WebP ≤1600 px first). D1 rows are ≤ 2 MB, free tier 5 GB.
- `room_photos (room_id INTEGER NOT NULL, sort INTEGER NOT NULL, src TEXT NOT NULL, alt TEXT NOT NULL DEFAULT '',
  w INTEGER, h INTEGER, PRIMARY KEY (room_id, sort))`.

## 3. API

- `GET /v1/content` (public) → `{ content: SiteContent, updated_at }`, `Cache-Control: no-cache`, ETag.
- `GET /v1/admin/content` (admin) → `{ content, overridden: SectionId[], updated_at }`.
- `PUT /v1/admin/content/:section` (admin) body = the full section value → validated with `validateSection` →
  stored → returns the merged section. `DELETE /v1/admin/content/:section` → back to default.
- `POST /v1/admin/media` (admin) raw body (`image/webp|jpeg|png`), `?w=&h=` → `{ id, src: '/media/<id>.webp', w, h,
  bytes }`. `GET /v1/admin/media` list (+ `used` flag). `DELETE /v1/admin/media/:id` (409 `media_in_use` when
  referenced by content or room photos).
- `GET /media/:file` (public, outside /v1) → the bytes, `Cache-Control: public, max-age=31536000, immutable`.
- Rooms: `Room.photos: Photo[]` in every room response; `photos` accepted by create/patch room (admin, ≤8) and by
  the team sync room ops.
- Settings — new capability fields (StoredSettings defaults keep today's behaviour):
  `booking_enabled: true`, `booking_closed_message: ''`, `shamcash_enabled: true` (at least one of shamcash /
  pay-on-arrival must stay on), `booking_horizon_days: 14` (1–365), `reminder_minutes: 60` (0 = off; 15–1440),
  `max_open_holds_per_phone: 3` (1–20), `customer_can_cancel: true`. Enforced on the server
  (`booking_closed`, `shamcash_disabled`, `too_far_ahead`, hold limit, reminder window, cancel) and exposed in
  `PublicSettings`.
- HTML: when the Worker serves the SPA `index.html`, an `HTMLRewriter` sets `<title>`, meta description, OG/Twitter
  tags, the JSON-LD (name, phone, address, hours) from settings + content, adds
  `<style>:root{--brand:…}</style>` when the brand colour changed, and
  `<script>window.__FP_BOOT__ = {content, settings}</script>` (JSON with `<` escaped) so the first paint already has
  the edited content. `/manifest.webmanifest`: name / short_name / description follow the content. Content is cached
  in the isolate for ≤30 s and dropped on save.

## 4. Website + app wiring (web, everything except `web/src/team/**`)

- `web/src/lib/content.ts`: `useContent()` → `SiteContent` (boot JSON → `DEFAULT_CONTENT`, then `/v1/content` via
  `useCached`), `useTemplateVars()` (live {name} {hours} …), `photoSrc()` helpers.
- Every hard-coded customer-visible text, image and link in the inventory reads from content (pure UI chrome like
  "التالي" stays in code). The landing renders `home.sections` in the stored order and skips hidden ones.
- Announcement bar on the site and booking pages when enabled. Brand colour applied as CSS variables.
- Booking paused (`booking_enabled = false`): the booking pages show the closed message instead of the form; CTAs
  still lead there. `shamcash_enabled = false` → cash only. Horizon from settings.
- Room photos: Spaces / home spaces preview / room sheet / booking page use `room.photos` when present, else today's
  group photos.

## 5. Admin editor (web/src/team/**, admin only)

- New nav item "الموقع" → `/team/site`: a list of section cards → one section editor generated from
  `CONTENT_SECTIONS`. Field widgets: text (counter + placeholder chips), longtext, link, toggle, number, select,
  icon picker, colour (picker + presets + contrast warning), image (preview, upload from phone/computer: resize to
  ≤1600 px, WebP q≈0.82, JPEG fallback → `POST /v1/admin/media`; alt text; restore default), images (gallery),
  list (add / remove / move up-down, max items).
- Per section: Save (PUT), "استعادة الأصل" (DELETE, with confirm), "عرض في الموقع" (opens the page), unsaved-changes
  guard. Saved → toast, and the public content cache is dropped so the site shows it at once.
- First section "الهوية والتواصل" also edits the settings identity fields (name, phone, address, instagram, hours)
  next to the content brand fields, so the admin has one place in a meeting.
- Booking & payment options (the new capability settings) live in Settings › المركز / الدفع next to the existing
  ones, and are linked from the site editor.
- Rooms: the room sheet gets a "الصور" field (same image widget, ≤8).
- Online required: offline → a clear notice, nothing is lost (the form keeps its values).
