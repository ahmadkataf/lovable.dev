# License spec — online activation with periodic verification

Goal: a copy of Kaseb works only after it was activated **online** with a code the seller made, keeps working offline for a
grace period, and must reach the server again before that period ends. The seller can revoke a code or move it to another
device at any time from the control panel (the "codes page"). The app cannot be talked into a valid license without the
server's private key, and modified builds are refused.

## Parties
- **Server** (`pos/server/`): Cloudflare Worker + D1, same shape as the Emar server in `/server` of this repository
  (wrangler, `schema.sql`, `src/index.ts` API, `src/admin.ts` panel). Deployed by `.github/workflows/deploy-pos-server.yml`.
- **App client** (`pos/src/license/index.ts` + `pos/src/screens/activation/`): activation screen, token storage, periodic checks.
- **Shells**: Electron stores the token encrypted (`safeStorage`) outside the page; Android stores it in SharedPreferences
  and exposes the APK signing-certificate hash; the browser uses localStorage (web is for demos only).

## Keys
- Secret `LICENSE_SECRET` (any long random text, never changed). Private key seed = SHA-256(LICENSE_SECRET), Ed25519 via
  `@noble/ed25519`. The public key (hex) is served at `GET /api/public-key` and embedded in the app at build time as
  `__POS_PUBLIC_KEY__` (the build workflow fetches it from the deployed server; `POS_LICENSE_PUBLIC_KEY` env).
- Secret `ADMIN_KEY`: the panel password. Sent as `Authorization: Bearer <key>` to `/admin/api/*`.
- If the app is built with an empty `__POS_API__`, the client runs in `demo` state (development only).

## Identity
- `deviceId` (raw, from `platform.deviceId()`): Windows MachineGuid / Android ANDROID_ID / a stored UUID on the web.
- `device` = hex SHA-256 of `kaseb:<platform>:<deviceId>`. Sent to the server; stored there.
- `deviceCode` = the first 8 characters of base32 (alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`) of that hash, shown as
  `XXXX-XXXX`. The seller sees it in the panel next to the code; support uses it.
- `sig` = `platform.appSignature()`: SHA-256 of the Android signing cert, `electron`, or `web`. The panel setting
  `android_signature` (comma-separated allowed hashes, empty = not checked) lets the seller refuse re-signed APKs
  (`error: tampered`).

## Codes
- Format: 12 characters from the base32 alphabet above, shown as `XXXX-XXXX-XXXX` (like Emar). Case-insensitive, dashes/spaces
  ignored.
- Row: `code, plan ('full'), created_at, expires_at (NULL = lifetime), max_devices (default 1), note, seller, revoked, moves`.
- A code binds to a device on activation. With `max_devices` devices bound, another device gets `device_limit`.

## Token
`token = base64url(payloadJson) + '.' + base64url(ed25519Signature(payloadBytes))`

payload:
```json
{ "v": 1, "code": "ABCD...", "d": "<device hash hex>", "p": "full" | "trial", "iat": 1760000000000,
  "exp": null | 1790000000000, "gr": 1760864000000, "n": "<nonce the client sent>", "srv": "kaseb" }
```
- `gr` (grace until) = server time + `grace_days` (panel setting, default 10). The client must complete a successful
  `/api/check` before `gr`; otherwise state becomes `locked` until it does.
- `exp`: license expiry (trial end, or the code's expiry); `null` = lifetime.
- The client verifies: signature with the embedded public key, `d` equals its own device hash, `n` equals the nonce it sent
  (on fresh responses), `srv === 'kaseb'`. A token that fails any of these is discarded.

## Endpoints (JSON; CORS `*`; every error is `{ "error": "<key>", "message"?: "<Arabic text>" }` with status 400/403/429)
- `GET /api/info` → `{ price, whatsapp, trialDays, message, minVersion, graceDays }` from panel settings
  (defaults: price "35$", whatsapp "", trialDays 7, graceDays 10).
- `GET /api/public-key` → `{ publicKey }`.
- `POST /api/activate` `{ code, device, deviceCode, name, platform, version, build, sig, nonce }`
  → `{ token, status: { plan, expiresAt, graceUntil, serverTime } }`.
  Errors: `invalid_code`, `revoked`, `expired`, `device_limit`, `tampered`, `rate_limited`, `min_version`.
  Re-activating on an already-bound device just refreshes. A device that already has a trial keeps the trial row but the code
  binding wins.
- `POST /api/trial` `{ device, deviceCode, name, platform, version, build, sig, nonce }` → same shape, `plan: 'trial'`.
  One trial per device, ever (the `devices` row remembers `trial_started`). Errors: `no_trial` (trialDays = 0 or already used),
  `tampered`, `rate_limited`.
- `POST /api/check` `{ token, device, platform, version, build, sig, nonce }` → fresh `{ token, status }`.
  Verifies the old token's signature, that `d` matches, that the code is still bound to this device and not revoked/expired
  (for a trial: that the trial has not ended). Errors: `invalid_token`, `revoked`, `expired`, `device_mismatch`, `tampered`,
  `min_version`. Updates `devices.last_seen`, `version`, `build`.
- `POST /api/release` `{ token, device }` → `{ ok: true }`: unbinds this device so the code can be used on another one;
  `codes.moves` += 1; refused with `move_limit` after 3 self-moves (the seller can always move it from the panel).
- Rate limit: 30 requests / 10 minutes / IP on `/api/activate` and `/api/trial` (events table), `rate_limited` beyond.
- Every call writes an `events` row (`kind`: activate, activate-fail, trial, check, check-fail, release, admin).

## Admin panel — the "codes page" (`GET /admin`, Arabic, RTL, phone-friendly, single HTML string from `admin.ts`)
Login with ADMIN_KEY (kept in localStorage). Tabs:
1. **لوحة** stats: codes made / activated / active devices (seen in 7 days) / trials running / activations this week; latest events.
2. **أكواد** create codes: count (1–100), validity (lifetime / 1 year / until date), devices per code (1–5), seller, note →
   list to copy (one per line) or print as cards; search box (code, note, seller, device code); each code opens a sheet:
   its devices (name, platform, version, last seen, device code), events, and actions: **إلغاء/إعادة** (revoke/unrevoke),
   **تحرير جهاز** (unbind one device so it can move), **تمديد** (change expiry), **ملاحظة** (edit note).
3. **الأجهزة** every device (trial or licensed) with search; see which code, when seen, version; "منح كود" shortcut.
4. **إعدادات** price text, WhatsApp number, trial days, grace days, min version, android signature allow-list, a message shown
   on the activation screen.
Admin API under `/admin/api/*` (Bearer ADMIN_KEY): `GET stats`, `POST codes` (create), `GET codes?q=`, `GET codes/:code`,
`POST codes/:code/revoke|unrevoke|extend|note`, `POST devices/:device/release`, `GET devices?q=`, `GET settings`, `POST settings`,
`GET events?code=|device=`.
Also `GET /privacy` (short privacy text) and `GET /` (one line naming the service).

## Client behaviour (`license/index.ts`)
- `init()`: read the stored token; if none → `none` (or `demo` without `__POS_API__`). Verify it; derive state:
  `trial`/`active` when valid and `now < gr`; `expired` when `exp` passed; `locked` when `gr` passed. Then, in the background,
  run `check()` if online and (`lastCheck` older than 6 hours or state is `locked`). Schedule `check()` every 6 hours while the
  app runs and on `online` events. Returns the status at once (never waits for the network).
- Clock rollback: keep `maxSeenTime` in storage next to the token; if `Date.now() < maxSeenTime - 1h`, treat as `locked`
  until a successful check. Server time from `status.serverTime` updates `maxSeenTime`.
- `activate(code)`, `startTrial()`, `check()`, `release()` call the endpoints, store the new token (with `lastCheck`,
  `maxSeenTime`), and publish the status to subscribers. Network failures leave the state as it was and set `online: false`
  with `error: 'license.err.network'`. Server errors map to states: `revoked` → `revoked`, `expired` → `expired`,
  `device_mismatch` → `revoked`, `tampered` → `tampered`, `invalid_token` → `none`.
- `fetchInfo()` caches `/api/info` in storage so the activation screen shows the price/WhatsApp even offline.
- Stored blob (via `platform.license`): JSON `{ token, lastCheck, maxSeenTime, info }`.
- Tests: token verification (good, bad signature, wrong device, expired grace), state derivation, clock rollback, error mapping,
  with a key pair generated in the test (`@noble/ed25519`).

## Activation screen (`screens/activation/index.tsx`, `ActivationScreen({ embedded })`)
Full-screen (not embedded) when the app is blocked; embedded as a normal page (`/activation`) otherwise. Shows: app logo + name;
the device code (big, copy button); the state with a clear sentence (never activated / trial with days left / active (lifetime or
until date) / expired / revoked / locked offline — connect to the internet / tampered); a code input (`XXXX-XXXX-XXXX`, auto-formats,
paste works) with **تفعيل**; **ابدأ التجربة المجانية ({n} أيام)** when `none` and trialDays > 0; price line
("السعر: 35$ — ترخيص دائم لجهاز واحد") and a **اشترِ عبر واتساب** button opening
`https://wa.me/<whatsapp>?text=<Arabic message with the device code>`; **تحقّق الآن** (check) and **نقل الترخيص لجهاز آخر**
(release, after confirm) when active; last check time; the seller's message; version + build. Works offline (shows cached
info and a "no internet" hint). Errors are shown in Arabic under the input.
