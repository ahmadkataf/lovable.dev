# Kasher POS — architecture and module contracts

Kasher (كاشير) is an offline-first point of sale for small shops. One React + TypeScript + Vite web app is shipped three ways:
Windows (Electron, `electron/`), Android (a WebView shell without Gradle, `android/`), and a plain browser/PWA.
The only network traffic is the license server (`server/`, a Cloudflare Worker + D1).

## Layout
```
pos/
  src/
    main.tsx, App.tsx            boot, routes (HashRouter), lock screen, license gate
    components/Shell.tsx         sidebar + top bar (desktop), bottom tabs (phone)
    components/LockScreen.tsx    user picker + PIN pad
    components/ui/               the UI kit: Button, Input/NumberInput/Select/Textarea/Field/SearchInput, Switch/SwitchRow/Seg,
                                 Modal (centred on desktop, bottom sheet on phones), Badge, Spinner, Empty, Avatar, Money,
                                 NumPad, ToastHost, ConfirmHost, useIsMobile, colorFor
    styles/                      tokens.css (design tokens, light/dark), base.css, ui.css (kit classes), shell.css
    i18n/                        index.ts (addMessages, t, useT, useLang, locale), core.ts (shared words)
    db/types.ts                  the data model (Product, Sale, Customer, Shift, Settings ...)
    db/index.ts                  Dexie schema `db`, loadSettings/saveSettings, nextNumber(key), ensureDefaults, TABLES
    lib/cart.ts                  Cart/CartLine, addToCart, computeTotals (discounts + tax), toSaleItems — pure, tested
    lib/money.ts                 round, parseNumber (Arabic digits), formatMoney, formatQty, quickAmounts
    lib/format.ts                dates/periods: formatDate/Time/DateTime/Day, startOfDay/Week/Month, periodRange, toDateInput
    lib/barcode.ts               EAN-13/8/UPC checks, in-store EAN-13 (prefix 200), barcodeFormat for JsBarcode
    lib/scanner-input.ts         useBarcodeWedge(onScan): USB/Bluetooth scanners typing fast + Enter
    lib/platform.ts              `platform`: kind (electron|android|web), deviceId, saveFile, print, getPrinters, share, copy,
                                 openUrl, license token storage, keepScreenOn, setFullscreen. Never touch window.pos/PosAndroid directly.
    lib/audio.ts                 beep('scan'|'ok'|'error'|'tap'), haptic
    lib/csv.ts                   toCsv, parseCsv, saveCsv, pickFile, readFileText
    lib/hash.ts                  sha256Hex, hashPin, checkPin
    lib/stock.ts                 applyStock(changes[]) / setStock — THE way stock changes (writes StockMove with before/after)
    lib/ledger.ts                applyLedger(change) — THE way customer debt changes (writes LedgerEntry, updates balance)
    lib/receipt.ts               receiptHtml(sale, settings), receiptText, printSale, shareSale (owned by the sales module)
    components/Scanner.tsx       ScannerModal({ open, onClose, onScan, continuous }) camera scanner (owned by the scanner module)
    components/BarcodeImage.tsx  BarcodeImage({ value }) — a barcode as SVG (JsBarcode)
    state/store.ts               Zustand `useStore`: settings, user/users, shift, license, cart actions, toast(), confirm()
    license/types.ts             LicenseStatus, isBlocked
    license/index.ts             the client (activate, startTrial, check, release, subscribe) — see LICENSE-SPEC.md
    screens/<name>/index.tsx     one folder per screen; each default-exports its component and owns its i18n + css
  electron/main.cjs, preload.cjs   the Windows shell
  android/                          the Android shell (MainActivity.java + manifest), scripts/build-apk.sh
  server/                           license server + the seller's code panel (/admin)
```

## Conventions every module follows
- **RTL first.** Arabic is the default; use CSS logical properties (`inset-inline-start`, `margin-inline-end`, `padding-inline`),
  never `left/right` for layout. Numbers and codes get `className="num"` / `ltr` so digits read left-to-right.
- **i18n.** Each screen registers its own messages at module load: `addMessages({ ar: {...}, en: {...} })` with keys prefixed by the
  screen name (`sales.charge`). Read them with `const t = useT()`. Shared words are in `i18n/core.ts` (`common.*`, `nav.*`, `unit.*`).
  Every string a user sees goes through `t()` with both Arabic and English.
- **Money.** `round(n, settings.currency.decimals)` at every arithmetic step; show with `<Money value={n} />` or `formatMoney`.
  Quantities may be fractional when `product.allowFraction`.
- **Data.** Only through `db` (Dexie). Multi-table writes go in `db.transaction('rw', ...)`. Ids from `uid()`. Times are `Date.now()`.
  Stock changes always write a `StockMove` with `before`/`after`. Customer debt changes always write a `LedgerEntry` and update
  `customer.balance`. Receipt numbers from `nextNumber('sale')`, purchases from `nextNumber('purchase')`.
- **Live data in screens.** Use `useLiveQuery` from `dexie-react-hooks` (installed) so lists update by themselves.
- **UI kit.** Build screens from `components/ui` and the classes in `ui.css` (`.card`, `.list-row`, `.stat`, `.chips`, `.table`,
  `.page/.page-head/.page-body`, `.empty`, `.menu`, `.banner`). Touch targets ≥ 44px. Phones (≤ 899px) and desktop both matter:
  use `useIsMobile()` when the layout truly differs. Dark mode works through the tokens — never hard-code colours except the
  product/category colour swatches.
- **Feedback.** `toast(text, 'success'|'error'|'warn'|'info')` after actions, `await confirmDialog({ title, text, danger })` before
  destructive ones, `beep('scan')` on a scan, `beep('ok')` on a sale, `beep('error')` on an unknown barcode.
- **Platform.** Files via `platform.saveFile(name, mime, data)`, printing via `platform.print(html, opts)`, sharing via
  `platform.share(text)`. Guard desktop-only UI with `platform.isDesktop`.
- **Keyboard (desktop).** F1 focus search/scan field, F2 charge, F4 hold, Esc close, Enter confirm. Show hints with `.kbd`.
- **Roles.** `user.role === 'admin'` sees reports and settings; cashiers sell, take payments, see customers and inventory.
- **No new shared files.** A module edits only its own folder (and may add tests). If it needs a change in a shared file, it says
  so in its report instead of editing it.

## Testing
`npm test` runs vitest (node + fake-indexeddb). Pure logic (cart, money, barcode, reports aggregation, license token checks) has
unit tests; keep them next to the code (`*.test.ts`).
