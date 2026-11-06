# Licence keys: selling Dentora without the customer's device number

Until now the seller could only make an activation code after the clinic sent its **device number**
(Settings → Licence), because every code is signed for one device. A **licence key** removes that step: the seller
issues keys from the control panel without any device number (one, or a batch for a reseller), and the clinic turns
its key into an ordinary activation code itself, once, online.

This file is the contract between the parts that implement it: the Worker (`server/`), the control panel
(`server/site/admin/`), the public activation page, the app (`src/`) and the Windows/Android shells.

## How it works

1. The seller sells a key: `XXXX-XXXX-XXXX-XXXX`, 16 characters from the code alphabet
   `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (no 0/O/1/I), 80 random bits (`crypto.getRandomValues`). It carries a plan, a
   validity rule and the sale details (customer, clinic, phone, price, note), like a licence.
2. The clinic enters the key, either
   - in the app (Settings → Licence, the same field as the code; app version 1.1.0 and later): the app sends the key
     and the device number to `https://dentora.raqeem.dev/api/activate`, or
   - on the website `https://dentora.raqeem.dev/activate` (`/en/activate`), typing its device number and the key: for
     app 1.0.0, or a clinic whose app cannot reach the internet but has another device that can.
3. The first time a key is used, the server binds it to that device number and signs an ordinary activation code
   (the existing 112-character ECDSA code) for (device, plan, last day), with the seller's private key, which never
   leaves the Worker. The app checks that code with its own verifier and public key exactly like a code the seller
   sent, and stores it as today: from then on the app works offline as before.
4. One key = one device. The same device entering the same key again (reinstall, cleared data) gets the same code
   back while that code's last day has not passed (after it: `expired`). Another device is refused (`used`). A key the
   seller marked refunded or void before it was used is refused (`void`); a code already issued from a key keeps working offline (codes cannot be revoked offline, as today).

The last day of the code made from a key:
- `lifetime`: none (lifetime code);
- `1y` / `2y`: counted from the day of activation (UTC), with the same arithmetic as `parseUntil` in
  `tools/generator-lib.ts` (`parseUntil(validity, activationDate)`);
- `date`: the fixed day chosen at sale (`until`); a key activated after that day is refused (`expired`).

The device-number flow (seller signs a code for a device) stays exactly as it is, in the panel and the offline seller
tools.

## Server data (D1)

Keys live in the `licences` table, so the list, search, statuses, revenue and CSV cover both kinds of sale.
New columns, added by an idempotent migration in `ensureSchema` (check `PRAGMA table_info(licences)` before each
`ALTER TABLE ... ADD COLUMN`; production already has the table):
- `key TEXT` (NULL for device licences) with `CREATE UNIQUE INDEX IF NOT EXISTS licences_key ON licences (key) WHERE key IS NOT NULL`;
- `validity TEXT NOT NULL DEFAULT ''` (keys: `lifetime` | `1y` | `2y` | `date`);
- `activated_at TEXT` (keys: ISO time of activation, NULL while waiting).

A key that waits for activation has `device = ''` and `code = ''` (the columns are NOT NULL). Its `until` is the
fixed day for `date`, else NULL. Binding is one atomic statement:
`UPDATE licences SET device = ?, code = ?, until = ?, activated_at = ?, search = ? WHERE key = ? AND device = '' AND status = 'active'`;
when it changes no row, re-read the row: same device → answer its stored code; another device → `used`; status not
active → `void`. Two clinics racing for one key: exactly one wins.

Failed public attempts are counted in `activation_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, at INTEGER NOT NULL)`
(+ indexes on `(ip, at)` and `(at)`), the same way as `login_attempts` (IPv4: the address; IPv6: its /64).

## Types (`server/src/types.ts`)

`Licence` gains:
- `key: string | null`: `XXXX-XXXX-XXXX-XXXX` for a licence sold as a key, else null;
- `validity: Validity | null`: for keys, how `until` is set at activation; null for device licences;
- `activatedAt: string | null`: for keys, ISO time of activation; null while waiting, and for device licences.

For a key waiting for activation, `device` and `code` are `''`. `Validity` (`'lifetime' | '1y' | '2y' | 'date'`) is
exported from types.ts. `Stats.licences` gains `pending: number`: active keys not activated yet.
`VerifyResult.kind` gains `'key'` (see `/api/verify`).

## Control panel API (session cookie + `X-Dentora: 1` + Origin check, like the rest of `/api/*`)

| Method & path | Body | Success | Errors |
|---|---|---|---|
| `POST /api/keys` | `{ count?, plan, validity, until?, customer, clinic, phone, price?, note }` | 201 `{ items: { licence: Licence, message: CustomerMessage }[] }` | 400 `count` (not an integer 1–50) \| `plan` \| `validity` \| `until` \| `price` \| `field` |

- `count` defaults to 1; every key gets the same plan, validity, sale details and `price` (per key; default: the
  settings' `priceUsd`). Issuing keys needs no signing key (codes are signed at activation); the panel already warns
  when signing is not ready.
- Audit: `keys.create`, detail like `3 × pro lifetime` (never the keys themselves).
- `GET /api/licences`: keys are listed with the rest; `q` also matches the key (with or without dashes); `status`
  also accepts `pending` (active keys not activated yet).
- `GET /api/licences/:id`: `message` is the key message for a waiting key, the usual code message once activated.
- `PATCH /api/licences/:id`: unchanged; a waiting key that is refunded or void can no longer be activated.
- `GET /api/licences.csv`: adds the columns key, validity, activated_at.
- `POST /api/verify` with a key in `code` (it cleans to 16 alphabet characters; `device` is then ignored and may be
  empty): 200 `{ kind: 'key', ok, status: 'pending' | 'activated' | 'refunded' | 'void' | 'unknown', device?, plan?, until?, activatedAt? }`
  (`ok` = pending or activated, and status active).

The key message (`CustomerMessage`, Arabic and English), written for the clinic: the key on its own line, then:
open Dentora → Settings → Licence, paste the key and press Activate (needs the internet once, the device only), stated
for Dentora 1.1.0 and later, since 1.0.0 takes no key in that field; or, with any version, activate it on
`https://dentora.raqeem.dev/activate` with the device number; one key works on one device; plan and validity
(`1y`/`2y`: "one year / two years from activation"). The wa.me link goes to the customer's phone as today.

## Public activation

`POST /api/activate`: no session, no cookies read or set, no `X-Dentora` or Origin check (it is public and carries
no ambient authority). CORS: every response (including errors) has `Access-Control-Allow-Origin: *`;
`OPTIONS /api/activate` answers 204 with `Access-Control-Allow-Methods: POST, OPTIONS`,
`Access-Control-Allow-Headers: Content-Type`, `Access-Control-Max-Age: 86400`. Other `/api/*` routes stay without
CORS.

Body `{ key, device }`: the key in any case, with or without dashes or spaces, Arabic-Indic digits allowed (clean it
like `cleanCode` in `src/license/core.ts`); the device like `formatDeviceInput`.

| Status | Body |
|---|---|
| 200 | `{ code, device, plan, until }`: `code` grouped in fours with dashes, `device` `XXXX-XXXX`, `until` `YYYY-MM-DD` or null |
| 400 | `{ error: 'key' }` not 16 alphabet characters; `{ error: 'device' }`; `{ error: 'field', field: 'body' }` |
| 404 | `{ error: 'unknown' }` no such key |
| 409 | `{ error: 'used' }` already activated on another device |
| 410 | `{ error: 'void' }` refunded or void; `{ error: 'expired' }` a `date` key after its day, or the device's own code (asked for again) past its last day |
| 429 | `{ error: 'locked', retryAfter: seconds }` |
| 503 | `{ error: 'signing' }` the Worker cannot sign (secret missing or wrong) |

Rate limit: an address with 50 failed attempts (400 key/device, 404, 409, 410) in the last 15 minutes gets 429
(refused attempts are not recorded; successes are not counted; loose on purpose: keys carry 80 random bits, and many
clinics share one IPv4 behind a mobile carrier's NAT). The answer is checked with the app's own verifier
before it is returned. Audit: `key.activate` on success (detail: the key's last 4 characters and the device) and
`key.used` the first time per key and UTC day that another device tries a used key (never per attempt: that would let
whoever holds a used key fill the log from this public route).

`GET /activate` and `GET /en/activate`: a public page (same look, header, footer and `PUBLIC_CSP` as the landing
page, cacheable 5 minutes) with a form: device number (pre-filled from `?device=` when it is a valid device number)
and key, posting to `/api/activate` from `/js/activate.js` (no inline script). On success it shows the code large,
with a copy button and the steps to paste it in Dentora → Settings → Licence; every error code has its own sentence;
a WhatsApp link to the seller for help. The router calls `renderActivate(lang, settings, origin, assets, device)`
from `server/src/pages/activate.ts` (`assets`: the `PageAssets` the legal pages get; `device`: the validated `?device=`
or `''`); the page escapes everything. Linked from the landing page (steps, FAQ, footer) and in the sitemap.

## App (1.1.0)

- `src/license/online.ts`: `ACTIVATION_URL = 'https://dentora.raqeem.dev/api/activate'`,
  `ACTIVATION_PAGE = 'https://dentora.raqeem.dev/activate'` (English: `/en/activate`), `isLicenceKey(input)`,
  `formatKey(input)`, and `redeemKey(key, device)` → `{ ok: true, code } | { ok: false, reason: 'offline' | 'key' | 'device' | 'unknown' | 'used' | 'void' | 'expired' | 'locked' | 'server', retryAfter? }`:
  `fetch` POST JSON, `credentials: 'omit'`, `cache: 'no-store'`, `referrerPolicy: 'no-referrer'`, 20 s timeout.
- Settings → Licence: the code field also takes a key. A key is redeemed online, then the returned code goes through
  `lic.activate(code)` (the app's own check: signature, device, plan, last day); nothing the server says is trusted
  without that check. Offline or a server failure: say so, and offer "activate in the browser", opening
  `ACTIVATION_PAGE?device=<device>` (English page for the English UI) with the platform's `openExternal`; not in a
  copy installed from Google Play, which shows no link to the website (it shows the price), like the seller box
  (`sellerShown()` in `src/features/settings/seller.ts`). Every reason has its own sentence (Arabic and English). The
  device-number + WhatsApp flow stays.
- The app's Content-Security-Policy adds `https://dentora.raqeem.dev` to `connect-src` (index.html, `electron/lib.cjs`
  CSP and `WebFiles.CSP`; a test keeps them identical). The Android shell lets exactly
  `https://dentora.raqeem.dev/api/activate` reach the network (`WebFiles.requestAction` gets the path); every other
  request to another site stays refused. The Windows app needs only the CSP (its page is `file://`, so the request's
  Origin is `null`, which `Access-Control-Allow-Origin: *` allows).

## Privacy (the same facts everywhere)

Dentora never sends clinic or patient data anywhere. The only time it contacts a server is when the clinic activates
it with a licence key: it then sends the key and the device number (a number derived from the device, not the
clinic's data) to dentora.raqeem.dev, once, to receive the activation code. The activation page receives the same
two values. The server keeps the key's device number, the code it issued and the activation time with the sale, for as
long as that sale record is kept (it is the proof the key was used, and refuses the key on a second device), and records
the address of a failed attempt, on its own, to count attempts for 15 minutes and stop guessing (that entry is deleted
with the next activation request after that).
