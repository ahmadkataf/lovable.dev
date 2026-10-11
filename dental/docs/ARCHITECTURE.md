# Dentora — architecture and conventions (read before changing code)

Dentora is a dental-clinic management system: one React web app that ships as a Windows desktop app (Electron),
an Android app (WebView wrapper) and a plain web app. All data lives on the device in IndexedDB (Dexie); a backup
is one `.dentora` file (a ZIP archive, optionally password-protected) the clinic keeps elsewhere. There is no server.

## Stack
- Vite 7 · React 19 · TypeScript (strict) · react-router-dom 7 (HashRouter: works from file:// and the Android asset server)
- Dexie 4 + dexie-react-hooks (`useLiveQuery`) for all data; `lucide-react` icons; `fflate` (deflate/inflate for the
  backup archive, `src/features/settings/backup/zip.ts`); no other runtime libraries. **Do not add npm packages.**
- Plain CSS with design tokens (`src/styles/tokens.css`), the UI kit (`src/styles/components.css`) and the shell (`src/styles/shell.css`).
- Fonts: Inter (Latin, digits) + Noto Kufi Arabic (Arabic) by default, bundled offline; other Arabic fonts selectable via data-font (src/app/theme.ts). Digits are Latin in both languages.

## Folders
```
src/db/types.ts        every entity type + the string unions (statuses, categories…)   ← shared, do not edit
src/db/index.ts        the Dexie database `db`, getClinic/updateClinic, settings, logActivity, nextInvoiceNumber,
                       nextReceiptNumber, nextFileNumber, importBackup (all-or-nothing; mergeDeviceSettings keeps
                       this device's licence, earliest trial start and latest licence clock), resetDatabase,
                       requestPersistentStorage/storageAvailable/isQuotaError                ← shared, do not edit
src/db/ids.ts          newId(), nowISO(), todayISO()
src/lib/format.ts      formatMoney/number/phone, whatsappLink, initials, colorFor, normalizeText, matches (Arabic-aware search), round2, sum
src/lib/dates.ts       ISO date helpers: today, addDays, startOfWeek (Saturday), combine(date,'HH:MM'), timeOf, ageFrom, fmtDate/fmtTime/fmtDateTime/fmtMonth, weekdayName, relativeDay, timeAgo, dateRange
src/lib/crypto.ts      hashPin / verifyPin (PBKDF2-SHA-256, older SHA-256 hashes upgraded at sign-in) / randomHex
src/i18n/              useI18n() → { t, lang, dir, isRTL, setLang, pick }; common.ts (shared words); modules/<module>.ts (one per feature)
src/ui/                the UI kit (see below)
src/app/               Shell (sidebar/topbar/bottom nav), session (auth), hooks, nav, scroll.ts (useScrollReset: a new
                       screen opens at its top, Back/Forward return to where it was left)
src/platform/          saveStream(name, mime, produce) (chunked, verified saves), saveFile(name, blob), saveText,
                       pickFile(accept), print(jobName?), onBackButton(handler) (Android Back), openExternal(url),
                       rawDeviceId() (the shell's id; cached; DeviceIdError rather than a made-up id),
                       imageToDataUrl(file, maxSide), platform()
src/license/           core.ts (ECDSA codes), clock.ts (licence clock that never runs back), state.ts (trial/status
                       arithmetic), guard.ts (read-only mode in the database), useLicense() → { status:
                       'trial'|'active'|'expired', daysLeft, device, deviceError, readOnly, activate(code) }
src/features/settings/backup/  the .dentora archive: archive.ts (format), zip.ts, crypto.ts (AES-256-GCM)
src/features/legal/    privacy policy, terms of use, open-source notices (LegalDialog, LegalLinks, AcceptTerms)
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
- Money goes through `src/features/billing/actions.ts` (saveInvoice, recordPayment, cancelInvoice, deleteReceipt): every
  write settles the patient's on-account credit on their open invoices (`planReconcile` in billing/lib.ts, applied by
  `reconcilePatient` inside the same transaction; `ensureReconciled()` runs a full pass after a bulk write from outside
  billing, such as a restore or demo data). Every payment carries a sequential `receiptNo` from `nextReceiptNumber()`
  (`R-000123`). Amounts are stored rounded to the clinic's currency (`clinic.currencyDecimals`, 0, 2 or 3 decimals,
  `roundMoney`), so what is stored is what is printed.
- Long periods and big lists (payments and invoices over years, reports) read with `useSnapshot(key, tables, load)` from
  `billing/snapshot.ts`: a non-live read that refreshes shortly after one of its tables changes, instead of a
  `useLiveQuery` that would track every row.
- Read-only mode is enforced below the UI too: while the licence has ended, `src/license/guard.ts` makes Dexie refuse
  writes to the clinical and financial tables (settings, users and whole-database restores still work).
- Booleans are not indexable in IndexedDB: use `.filter(x => x.active)`, not `.where('active')`.
- Respect `useLicense().readOnly`: when true, hide or disable create/edit/delete actions (show `t('trial.readonly')`).

## UI kit (`import { … } from '@/ui'`)
Button (variant primary|secondary|soft|ghost|danger|danger-soft|success; size xs|sm|md|lg; icon, iconEnd, loading, block, to), IconButton,
Field, Input (label/hint/error/iconStart/iconEnd/clearable), Textarea, Select (options/placeholder), Checkbox, Radio, Switch, Segmented, Chip, NumberInput (value number|null, addon),
Badge (tone + `toneFor(status)`), Alert, Spinner, Loading, Skeleton, EmptyState, ProgressBar,
Card/CardHeader/CardBody/CardFooter, StatCard, PageHeader (title/subtitle/actions/crumbs), Tabs, Avatar, Kbd, Divider, IconBox,
Modal (size sm|md|lg|xl|full, footer), Drawer, Menu (dropdown items), ConfirmProvider → useConfirm()/useConfirmDelete(), DataTable (+ usePagination, Pagination), ToastProvider → useToast().
A Modal focuses `[data-autofocus]` when one is marked; otherwise, on a touch screen (`pointer: coarse`) it focuses the
dialog itself so opening it never raises the on-screen keyboard, and with a mouse it focuses the first text field.
Mark a field `data-autofocus` only when typing is the whole point of the dialog.
CSS classes you can use directly: `.page .page-narrow .toolbar .grid .grid-2/3/4 .grid-stats .form-grid .span-2 .form-section .form-section-title .kv .list .list-item .money .num .muted .row .col .spread .grow .truncate .hide-mobile .show-mobile .no-print .print-area`.
Status colours: appointment statuses `var(--st-<status>)`, tooth conditions `var(--tooth-<condition>)`, semantic `--success --warning --danger --info` with `-soft` and `-text` variants.

## Hooks (`@/app/hooks`, `@/app/session`)
`useClinic()` (settings record, live), `useDoctors()`, `useUsers()`, `useMoney()` → money(n), `useIsMobile()`, `useIsDesktop()`, `useDebounced(v)`,
`useSession()` → { user, users, login, logout, lock, role, isAdmin, can(perm) } with perms manage|clinical|billing|reports|inventory|patients|appointments|settings|staff.
- The signed-in user lives in **sessionStorage** (`dentora.session` = `{ id, at }`) for one run of the app: it survives a
  reload, never a new window or app launch, so **the PIN is asked at every launch**. Auto-lock counts wall-clock time
  (sleep included). Five wrong PINs lock that user's pad, each lock longer (30 s … 1 h), kept in the database and in
  localStorage (`features/auth/guardStore.ts`), timed on the device clock.
- A clinic whose only admin forgot the PIN gets a **PIN reset code** from the seller:
  `node scripts/code-generator.mjs reset <device>` (or the reset section of the offline generator page,
  `dist-tools/code-generator.html`). It works on that device, today and tomorrow, once (sign-in → "Forgot your PIN?" →
  "I have a reset code"); it is accepted by the licence clock or the device clock (`features/auth/resetPin.ts`).

## i18n rules
- Every visible string goes through `t()`. Module strings live in `src/i18n/modules/<module>.ts` as `{ ar: {...}, en: {...} }` and are read as `t('<module>.<key>')`. Shared words (save, cancel, statuses, categories, roles…) are already in `common.ts`: `t('save')`, `t('apt.scheduled')`, `t('cat.restorative')`, `t('cond.caries')`, `t('pay.cash')`, `t('exp.rent')`, `t('role.doctor')`, `t('inv.paid')`, `t('lab.sent')`, `t('labType.crown')`, `t('surf.M')`, `t('fileKind.xray')`, `t('v.required')`. Check common.ts before adding duplicates.
- Arabic is the default and the reference: write natural, professional clinic Arabic (not literal translations). Keep ar and en keys identical.
- Layout must work in RTL and LTR: use logical CSS (`inset-inline-start`, `margin-inline-end`, `text-align: start`), never `left/right` for layout. Numbers, phone numbers, codes: wrap in `.num` or `.ltr`.
- Dates/times: `fmtDate(d, lang)`, `fmtTime(iso, lang)`; money: `useMoney()`. Do not force `fmtTime` output LTR (the Arabic ص/م marker would read backwards); use `unicode-bidi: isolate` instead.
- `.num`, `.money` and `.ltr` set `direction: ltr`, so logical margins on that same element resolve to physical left in RTL: put them on an inner span, never on an element that carries logical margins.
- Person names: add `dir="auto"` (or `.name-auto`) so an Arabic name in the English UI (and the reverse) truncates at its own end.
- Formatted dates and times (`fmtDate`, `fmtTime`) go in `<bdi>`, never in `.num` (that would reverse Arabic month names and the ص/م marker). Keep `.num` for digits, phones and codes.
- Quick-add dialogs open from anywhere with `window.dispatchEvent(new CustomEvent('dentora:quick-add', { detail: 'patient' | 'appointment' | 'payment' }))`.
- The kit `Menu` renders in a portal and flips upward near the screen edge, so tables and cards never clip it.
- localStorage keys (per device, never in a backup): `dentora.lang`, `dentora.font`, `dentora.sidebar`, `dentora.lockAfter`,
  `dentora.lastUser`, `dentora.loginGuard`, `dentora.lastSeen` (licence clock copy), `dentora.device` (the web build's
  random id), `dentora.device.shell` (the last id the Windows/Android shell gave), `dentora.search.recent`,
  `dentora.notif.seen`, `dentora.chart.zoom`, `dentora.reports.preset`, `dentora.billing.period.<screen>` (invoices/payments period),
  `dentora.pricesReviewed`, `dentora.backup.protect`.
  sessionStorage (this run only): `dentora.session`, `dentora.patients.view`, `dentora.appointments.view`.
- Screens open at their top and Back/Forward restore the position (`useScrollReset` in `src/app/scroll.ts`, used by the
  route gate): never scroll the window to the top yourself on mount.
- Escape closes only the top-most overlay (`useEscapeLayer(onClose)` for custom overlays). Routes are permission-guarded in App.tsx.

## Design rules (the product sells on looks)
- Light theme first: white cards on `var(--bg)`, soft borders, generous spacing (16–24px), 12–20px radii, subtle shadows, teal primary. Every screen opens with `PageHeader`, then content in `Card`s or a `DataTable`. Use `EmptyState` (with an icon and a primary action) for empty lists, `Skeleton`/`Loading` while loading.
- Mobile (≤767px): single column, full-width buttons in headers, tables hide secondary columns (`hideBelow`) or switch to card lists, modals slide up from the bottom (already handled by `Modal`). Touch targets ≥ 40px.
- Forms: `.form-grid` with labelled fields, inline validation messages (`error=` on Input), the primary action on the end side of the footer, Enter submits.
- Lists: search box + filter chips/segments in a `.toolbar`, counts in tab badges, status `Badge`s, row click opens details.
- Never leave English developer strings ("Loading", "Error") or placeholders in the UI. No emoji as icons; use lucide icons.

## Security of the page
- `index.html` carries a Content-Security-Policy (scripts only from the app, pictures and files from the app or
  `data:`/`blob:`, nothing from the internet, no form posts). The Windows shell (`electron/lib.cjs` CSP) and the Android
  shell (`WebFiles.CSP`) send the same policy; `tests/release-files.test.ts` keeps the three identical. `npm run dev`
  serves the page without it (Vite's development page needs inline scripts). Never add inline scripts or remote URLs.
- `window.__dentora` (the live database) exists only in development and in QA builds (`VITE_QA=1`, `src/main.tsx`).
  Release builds (`npm run build`, the Windows and Android packages) never have it.

## Verifying your work (required)
1. `npx tsc --noEmit -p tsconfig.json 2>&1 | grep '<your folder>'` — zero errors in files you own (other agents' files may be mid-edit; ignore those).
2. Build a **QA build** to **your own** folder and preview on **your own** port so parallel agents do not collide:
   `VITE_QA=1 npx vite build --outDir /tmp/dist-<module>` (only a QA build has `window.__dentora`; the scripts refuse
   any other), then run a Playwright script using `scripts/qa/lib.mjs` with
   `QA_DIST=/tmp/dist-<module> QA_PORT=<unique port> QA_SHOTS=qa-shots/<module>` (an absolute QA_SHOTS such as `/tmp/…` works too).
   `seedAndLogin(page)` marks setup done and signs in an admin (PIN 1234) through sessionStorage, as a PIN would;
   `setSession(page, userId | null)` switches user from the next load; `setTrialStart(page, iso)` moves the trial start
   (later only in a whole-database transaction, as the licence guard requires); `loadDemo(page)` loads the demo clinic
   through Settings; `readArchive(file)` reads a `.dentora` backup; `shot(page, name)` saves a PNG. Then **look at the PNGs with the Read tool** and fix what looks wrong
   (overflow, misalignment, LTR leaks, unreadable contrast). Check desktop RTL (1440×900), desktop EN and phone (390×844).
   The scripts count console errors, Content-Security-Policy violations included.
3. Exercise the real flows in Playwright (create → edit → delete, validation errors, empty states) and assert on the DB through `window.__dentora.db`.
4. Add a vitest file under `tests/` for any pure logic you wrote (totals, status derivation, date math).
