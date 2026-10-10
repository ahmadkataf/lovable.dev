# Dentora — architecture and conventions (read before changing code)

Dentora is a dental-clinic management system: one React web app that ships as a Windows desktop app (Electron),
an Android app (WebView wrapper) and a plain web app. All data lives on the device in IndexedDB (Dexie); a backup
is a JSON file of every table. There is no server.

## Stack
- Vite 7 · React 19 · TypeScript (strict) · react-router-dom 7 (HashRouter: works from file:// and the Android asset server)
- Dexie 4 + dexie-react-hooks (`useLiveQuery`) for all data; `lucide-react` icons; no other runtime libraries. **Do not add npm packages.**
- Plain CSS with design tokens (`src/styles/tokens.css`), the UI kit (`src/styles/components.css`) and the shell (`src/styles/shell.css`).
- Fonts: Inter (Latin, digits) + Noto Kufi Arabic (Arabic) by default, bundled offline; other Arabic fonts selectable via data-font (src/app/theme.ts). Digits are Latin in both languages.

## Folders
```
src/db/types.ts        every entity type + the string unions (statuses, categories…)   ← shared, do not edit
src/db/index.ts        the Dexie database `db`, getClinic/updateClinic, settings, logActivity, nextInvoiceNumber,
                       nextFileNumber, exportBackup/importBackup/resetDatabase            ← shared, do not edit
src/db/ids.ts          newId(), nowISO(), todayISO()
src/lib/format.ts      formatMoney/number/phone, whatsappLink, initials, colorFor, normalizeText, matches (Arabic-aware search), round2, sum
src/lib/dates.ts       ISO date helpers: today, addDays, startOfWeek (Saturday), combine(date,'HH:MM'), timeOf, ageFrom, fmtDate/fmtTime/fmtDateTime/fmtMonth, weekdayName, relativeDay, timeAgo, dateRange
src/lib/crypto.ts      hashPin / verifyPin / isValidPin / randomHex
src/i18n/              useI18n() → { t, lang, dir, isRTL, setLang, pick }; common.ts (shared words); modules/<module>.ts (one per feature)
src/ui/                the UI kit (see below)
src/app/               Shell (sidebar/topbar/bottom nav), session (auth), hooks, nav
src/platform/          saveFile(name, blob), saveText, pickFile(accept), print(), openExternal(url), rawDeviceId(), imageToDataUrl(file, maxSide), platform()
src/license/           core.ts (codes), useLicense() → { status: 'trial'|'active'|'expired', daysLeft, device, readOnly, activate(code) }
src/features/<module>/ one folder per feature; pages are default exports, tabs take { patientId }
scripts/qa/            Playwright helpers for screenshots and flows (see "Verifying")
tests/                 vitest unit tests (fake-indexeddb is set up in tests/setup.ts)
```

## Data access rules
- Read with `useLiveQuery(() => db.table..., [deps])` — the UI updates itself after every write. **Never write inside a live query.**
- Write with `db.table.add/put/update/delete`; multi-table writes go in `db.transaction('rw', db.a, db.b, async () => …)`.
- Always set `id: newId()`, `createdAt`, `updatedAt` (ISO instants). Calendar dates are `'YYYY-MM-DD'` strings.
- After a meaningful write call `logActivity({ type, action, entityId, patientId, message })` (fire-and-forget; feeds the dashboard).
- Invoices cache `paid` and `status`; after any payment change recompute them (`paid = sum(payments where invoiceId)`, status paid/partial/unpaid). Patient balance = sum(invoice.total where status ≠ cancelled/draft) − sum(payments.amount of that patient).
- Booleans are not indexable in IndexedDB: use `.filter(x => x.active)`, not `.where('active')`.
- Respect `useLicense().readOnly`: when true, hide or disable create/edit/delete actions (show `t('trial.readonly')`).

## UI kit (`import { … } from '@/ui'`)
Button (variant primary|secondary|soft|ghost|danger|danger-soft|success; size xs|sm|md|lg; icon, iconEnd, loading, block, to), IconButton,
Field, Input (label/hint/error/iconStart/iconEnd/clearable), Textarea, Select (options/placeholder), Checkbox, Radio, Switch, Segmented, Chip, NumberInput (value number|null, addon),
Badge (tone + `toneFor(status)`), Alert, Spinner, Loading, Skeleton, EmptyState, ProgressBar,
Card/CardHeader/CardBody/CardFooter, StatCard, PageHeader (title/subtitle/actions/crumbs), Tabs, Avatar, Kbd, Divider, IconBox,
Modal (size sm|md|lg|xl|full, footer), Drawer, Menu (dropdown items), ConfirmProvider → useConfirm()/useConfirmDelete(), DataTable (+ usePagination, Pagination), ToastProvider → useToast().
CSS classes you can use directly: `.page .page-narrow .toolbar .grid .grid-2/3/4 .grid-stats .form-grid .span-2 .form-section .form-section-title .kv .list .list-item .money .num .muted .row .col .spread .grow .truncate .hide-mobile .show-mobile .no-print .print-area`.
Status colours: appointment statuses `var(--st-<status>)`, tooth conditions `var(--tooth-<condition>)`, semantic `--success --warning --danger --info` with `-soft` and `-text` variants.

## Hooks (`@/app/hooks`, `@/app/session`)
`useClinic()` (settings record, live), `useDoctors()`, `useUsers()`, `useMoney()` → money(n), `useIsMobile()`, `useIsDesktop()`, `useDebounced(v)`,
`useSession()` → { user, users, login, logout, lock, role, isAdmin, can(perm) } with perms manage|clinical|billing|reports|inventory|patients|appointments|settings|staff.

## i18n rules
- Every visible string goes through `t()`. Module strings live in `src/i18n/modules/<module>.ts` as `{ ar: {...}, en: {...} }` and are read as `t('<module>.<key>')`. Shared words (save, cancel, statuses, categories, roles…) are already in `common.ts`: `t('save')`, `t('apt.scheduled')`, `t('cat.restorative')`, `t('cond.caries')`, `t('pay.cash')`, `t('exp.rent')`, `t('role.doctor')`, `t('inv.paid')`, `t('lab.sent')`, `t('labType.crown')`, `t('surf.M')`, `t('fileKind.xray')`, `t('v.required')`. Check common.ts before adding duplicates.
- Arabic is the default and the reference: write natural, professional clinic Arabic (not literal translations). Keep ar and en keys identical.
- Layout must work in RTL and LTR: use logical CSS (`inset-inline-start`, `margin-inline-end`, `text-align: start`), never `left/right` for layout. Numbers, phone numbers, codes: wrap in `.num` or `.ltr`.
- Dates/times: `fmtDate(d, lang)`, `fmtTime(iso, lang)`; money: `useMoney()`.

## Design rules (the product sells on looks)
- Light theme first: white cards on `var(--bg)`, soft borders, generous spacing (16–24px), 12–20px radii, subtle shadows, teal primary. Every screen opens with `PageHeader`, then content in `Card`s or a `DataTable`. Use `EmptyState` (with an icon and a primary action) for empty lists, `Skeleton`/`Loading` while loading.
- Mobile (≤767px): single column, full-width buttons in headers, tables hide secondary columns (`hideBelow`) or switch to card lists, modals slide up from the bottom (already handled by `Modal`). Touch targets ≥ 40px.
- Forms: `.form-grid` with labelled fields, inline validation messages (`error=` on Input), the primary action on the end side of the footer, Enter submits.
- Lists: search box + filter chips/segments in a `.toolbar`, counts in tab badges, status `Badge`s, row click opens details.
- Never leave English developer strings ("Loading", "Error") or placeholders in the UI. No emoji as icons; use lucide icons.

## Verifying your work (required)
1. `npx tsc --noEmit -p tsconfig.json 2>&1 | grep '<your folder>'` — zero errors in files you own (other agents' files may be mid-edit; ignore those).
2. Build to **your own** folder and preview on **your own** port so parallel agents do not collide:
   `npx vite build --outDir /tmp/dist-<module>` then run a Playwright script using `scripts/qa/lib.mjs` with
   `QA_DIST=/tmp/dist-<module> QA_PORT=<unique port> QA_SHOTS=qa-shots/<module>`.
   `seedAndLogin(page)` marks setup done and signs in an admin (PIN 1234); `shot(page, name)` saves a PNG. Then **look at the PNGs with the Read tool** and fix what looks wrong (overflow, misalignment, LTR leaks, unreadable contrast). Check desktop RTL (1440×900), desktop EN and phone (390×844).
3. Exercise the real flows in Playwright (create → edit → delete, validation errors, empty states) and assert on the DB through `window.__dentora.db`.
4. Add a vitest file under `tests/` for any pure logic you wrote (totals, status derivation, date math).
