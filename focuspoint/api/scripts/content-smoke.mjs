// End-to-end check of the site editor API against a local `wrangler dev` (fresh D1 with schema.sql + seed.sql, started
// with --test-scheduled so the cron can be triggered):
//   B=http://127.0.0.1:8797 KEY=<ADMIN_SETUP_KEY> OFF=<0..7, another day block when re-running on the same DB> node scripts/content-smoke.mjs
// Covers: public content + ETag, save / validate / history / undo / reset, media upload + /media/ + in-use protection,
// room photos, every booking capability, notification templates, the HTML head / boot script / theme, the manifest,
// and admin-only access. Node ≥ 22 (imports shared/content.ts directly). Leaves the content and settings at the defaults.
import { deflateSync } from 'node:zlib'
import { DEFAULT_CONTENT, SECTION_IDS, reminderLabel } from '../../shared/content.ts'

const B = process.env.B || 'http://127.0.0.1:8797'
const KEY = process.env.KEY || 'setup-key'
const OFF = Number(process.env.OFF || 0) % 8   // keeps every test day inside the default 14-day horizon
let fails = 0
const ok = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + JSON.stringify(extra)?.slice(0, 600))); if (!cond) fails++ }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const uuid = () => crypto.randomUUID()
const RUN = String(1000 + Math.floor(Math.random() * 9000))
const phone = (i) => `0944${RUN}${String(i).padStart(2, '0')}`     // fresh customer phones every run (holds are per phone)

async function call(method, path, { body, headers = {}, raw } = {}) {
  const h = { ...headers }
  let payload
  if (raw !== undefined) payload = raw
  else if (body !== undefined) { payload = typeof body === 'string' ? body : JSON.stringify(body); h['Content-Type'] ??= 'application/json' }
  const r = await fetch(B + path, { method, headers: h, body: payload, redirect: 'manual' })
  const buf = new Uint8Array(await r.arrayBuffer())
  const text = new TextDecoder().decode(buf)
  let b = null
  try { b = JSON.parse(text) } catch { b = text }
  return { s: r.status, h: r.headers, b, text, buf }
}

// ---------- images ----------
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer)
  dv.setUint32(0, data.length); out.set(new TextEncoder().encode(type), 4); out.set(data, 8)
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}
/** A real RGB PNG (w × h, a burgundy gradient). */
function png(w, h) {
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer)
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr.set([8, 2, 0, 0, 0], 8)
  const rows = new Uint8Array(h * (1 + w * 3))
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rows.set([123, 30 + x * 10, 46 + y * 10], y * (1 + w * 3) + 1 + x * 3)
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', new Uint8Array())]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let i = 0; for (const p of parts) { out.set(p, i); i += p.length }
  return out
}
const WEBP = Uint8Array.from(atob('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='), (c) => c.charCodeAt(0))   // real 1×1 lossless WebP

// ---------- time helpers (the centre's zone) ----------
function tzOffsetMin(date, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(date).map((x) => [x.type, x.value]))
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(date.getTime() / 60000) * 60000) / 60000
}
const localDate = (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const addDays = (s, n) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const at = (day, hhmm, tz) => {
  const [h, m] = hhmm.split(':').map(Number)
  const guess = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), h, m)
  return new Date(guess - tzOffsetMin(new Date(guess), tz) * 60000).toISOString()
}

// ---------- accounts ----------
const ADMIN = { phone: '0985258963', password: 'Admin123!' }
const boot = await call('POST', '/v1/admin/bootstrap', { body: { setup_key: KEY, phone: ADMIN.phone, name: 'المدير', password: ADMIN.password } })
const login = boot.s < 300 ? boot : await call('POST', '/v1/team/login', { body: ADMIN })
ok('admin signed in', Boolean(login.b?.token), login.b)
const admin = { Authorization: `Bearer ${login.b.token}` }
const staffMade = await call('POST', '/v1/admin/team', { headers: admin, body: { phone: '0933111222', name: 'موظف التجربة', password: 'Staff123!', role: 'staff' } })
ok('staff account exists', staffMade.s === 201 || staffMade.b?.error === 'phone_taken', staffMade.b)
const staffLogin = await call('POST', '/v1/team/login', { body: { phone: '0933111222', password: 'Staff123!' } })
const staff = { Authorization: `Bearer ${staffLogin.b?.token}` }
ok('staff signed in', Boolean(staffLogin.b?.token), staffLogin.b)

// Start from the defaults (also when re-running on the same database).
const DEFAULT_CAPS = { booking_enabled: true, booking_closed_message: '', shamcash_enabled: true, booking_horizon_days: 14, reminder_minutes: 60, max_open_holds_per_phone: 3, customer_can_cancel: true, allow_pay_on_arrival: false }
for (const id of SECTION_IDS) await call('DELETE', `/v1/admin/content/${id}`, { headers: admin })
await call('PATCH', '/v1/admin/settings', { headers: admin, body: { ...DEFAULT_CAPS, centre_name: 'فوكس بوينت' } })
const settings0 = (await call('GET', '/v1/settings')).b
const TZ = settings0.timezone

// ---------- 1. public content ----------
const c0 = await call('GET', '/v1/content')
ok('GET /v1/content = DEFAULT_CONTENT', c0.s === 200 && eq(c0.b.content, DEFAULT_CONTENT), { s: c0.s })
ok('GET /v1/content: Cache-Control no-cache + ETag', c0.h.get('cache-control') === 'no-cache' && /^"c-[0-9a-f]+"$/.test(c0.h.get('etag') ?? ''), Object.fromEntries(c0.h))
const etag0 = c0.h.get('etag')
const c304 = await call('GET', '/v1/content', { headers: { 'If-None-Match': etag0 } })
ok('GET /v1/content with If-None-Match → 304', c304.s === 304 && c304.h.get('etag') === etag0, { s: c304.s })
const a0 = await call('GET', '/v1/admin/content', { headers: admin })
ok('GET /v1/admin/content: nothing overridden', a0.s === 200 && eq(a0.b.overridden, []) && eq(a0.b.content, DEFAULT_CONTENT), a0.b?.overridden)

// ---------- 2. save, validate, history, undo, reset ----------
const ann1 = { enabled: true, text: 'افتتاح القاعة الجديدة </script><script>alert(1)</script>', link_label: 'احجز', link_url: '/book', tone: 'success' }
const put1 = await call('PUT', '/v1/admin/content/announcement', { headers: admin, body: ann1 })
ok('PUT valid section → merged section back', put1.s === 200 && put1.b.section === 'announcement' && put1.b.overridden === true && eq(put1.b.value, ann1) && Boolean(put1.b.updated_at), put1.b)
const c1 = await call('GET', '/v1/content')
ok('GET /v1/content shows the saved section', eq(c1.b.content.announcement, ann1) && c1.b.updated_at === put1.b.updated_at, c1.b.content?.announcement)
ok('ETag changed after the save', c1.h.get('etag') !== etag0, c1.h.get('etag'))
const stale = await call('GET', '/v1/content', { headers: { 'If-None-Match': etag0 } })
ok('old ETag → 200 with the new content', stale.s === 200, { s: stale.s })

const bad1 = await call('PUT', '/v1/admin/content/announcement', { headers: admin, body: { ...ann1, link_url: 'javascript:alert(1)' } })
ok('PUT invalid link → 400 invalid_content + path', bad1.s === 400 && bad1.b.error === 'invalid_content' && bad1.b.path === 'link_url' && typeof bad1.b.message === 'string', bad1.b)
const bad2 = await call('PUT', '/v1/admin/content/theme', { headers: admin, body: { brand: 'red' } })
ok('PUT invalid colour → 400 path brand', bad2.s === 400 && bad2.b.error === 'invalid_content' && bad2.b.path === 'brand', bad2.b)
const bad3 = await call('PUT', '/v1/admin/content/home', { headers: admin, body: { hero: { photo: { src: 'https://evil.example/x.png', alt: '', w: 1, h: 1 } } } })
ok('PUT foreign image → 400 path hero.photo.src', bad3.s === 400 && bad3.b.path === 'hero.photo.src', bad3.b)
const bad4 = await call('PUT', '/v1/admin/content/brand', { headers: admin, body: [1, 2] })
ok('PUT non-object → 400 invalid_content', bad4.s === 400 && bad4.b.error === 'invalid_content', bad4.b)
const bad5 = await call('PUT', '/v1/admin/content/brand', { headers: admin, body: '{not json' })
ok('PUT broken JSON → 400 invalid_json', bad5.s === 400 && bad5.b.error === 'invalid_json', bad5.b)
const unk = await call('PUT', '/v1/admin/content/nope', { headers: admin, body: {} })
ok('unknown section → 404 unknown_section', unk.s === 404 && unk.b.error === 'unknown_section', unk.b)
const unk2 = await call('GET', '/v1/admin/content/nope/history', { headers: admin })
ok('unknown section history → 404', unk2.s === 404, unk2.b)
const afterBad = await call('GET', '/v1/content')
ok('a refused save changes nothing', eq(afterBad.b.content.announcement, ann1) && eq(afterBad.b.content.theme, DEFAULT_CONTENT.theme), afterBad.b.content?.theme)

const ann2 = { ...ann1, text: 'نص ثاني', tone: 'warning' }
await call('PUT', '/v1/admin/content/announcement', { headers: admin, body: ann2 })
await call('PUT', '/v1/admin/content/announcement', { headers: admin, body: ann2 })   // same value again: no new history entry
const hist = await call('GET', '/v1/admin/content/announcement/history', { headers: admin })
ok('history: newest first, previous values, saver name', hist.s === 200 && hist.b.length >= 2 && eq(hist.b[0].value, ann1) && hist.b[0].was_default === false
  && hist.b[1].was_default === true && eq(hist.b[1].value, DEFAULT_CONTENT.announcement) && hist.b[0].saved_by_name === 'المدير', hist.b?.slice(0, 2))
const undo1 = await call('POST', '/v1/admin/content/announcement/undo', { headers: admin })
ok('undo → the previous value', undo1.s === 200 && eq(undo1.b.value, ann1) && undo1.b.overridden === true, undo1.b)
const undo2 = await call('POST', '/v1/admin/content/announcement/undo', { headers: admin })
ok('undo again → the default (not overridden)', undo2.s === 200 && eq(undo2.b.value, DEFAULT_CONTENT.announcement) && undo2.b.overridden === false, undo2.b)
let undoEnd = null
for (let i = 0; i < 25 && !undoEnd; i++) { const u = await call('POST', '/v1/admin/content/announcement/undo', { headers: admin }); if (u.s !== 200) undoEnd = u }
ok('undo with an empty history → 409 nothing_to_undo', undoEnd?.s === 409 && undoEnd.b.error === 'nothing_to_undo', undoEnd?.b)

await call('PUT', '/v1/admin/content/announcement', { headers: admin, body: ann1 })
const del = await call('DELETE', '/v1/admin/content/announcement', { headers: admin })
ok('DELETE → back to the default', del.s === 200 && eq(del.b.value, DEFAULT_CONTENT.announcement) && del.b.overridden === false, del.b)
const c2 = await call('GET', '/v1/content')
ok('GET /v1/content shows the default again', eq(c2.b.content.announcement, DEFAULT_CONTENT.announcement), c2.b.content?.announcement)
const undoReset = await call('POST', '/v1/admin/content/announcement/undo', { headers: admin })
ok('a reset can be undone', undoReset.s === 200 && eq(undoReset.b.value, ann1), undoReset.b)
await call('DELETE', '/v1/admin/content/announcement', { headers: admin })

// ---------- 3. media ----------
const webpUp = await call('POST', '/v1/admin/media?w=1&h=1', { headers: { ...admin, 'Content-Type': 'image/webp' }, raw: WEBP })
ok('upload WebP → 201 {id, src, w, h, bytes}', webpUp.s === 201 && /^[0-9a-f]{16}$/.test(webpUp.b.id) && webpUp.b.src === `/media/${webpUp.b.id}.webp`
  && webpUp.b.w === 1 && webpUp.b.h === 1 && webpUp.b.bytes === WEBP.length, webpUp.b)
const PNG = png(4, 3)
const pngUp = await call('POST', '/v1/admin/media', { headers: { ...admin, 'Content-Type': 'image/png' }, raw: PNG })
ok('upload PNG (size read from the file) → 201', pngUp.s === 201 && pngUp.b.src.endsWith('.png') && pngUp.b.w === 4 && pngUp.b.h === 3, pngUp.b)
const got = await call('GET', webpUp.b.src)
ok('GET /media/<id>.webp → the same bytes', got.s === 200 && eq([...got.buf], [...WEBP]), { s: got.s, n: got.buf.length })
ok('GET /media: Content-Type + immutable cache', got.h.get('content-type') === 'image/webp' && got.h.get('cache-control') === 'public, max-age=31536000, immutable'
  && got.h.get('x-content-type-options') === 'nosniff', Object.fromEntries(got.h))
const gotPng = await call('GET', pngUp.b.src)
ok('GET /media/<id>.png → image/png bytes', gotPng.s === 200 && gotPng.h.get('content-type') === 'image/png' && eq([...gotPng.buf], [...PNG]), { s: gotPng.s })
const m304 = await call('GET', webpUp.b.src, { headers: { 'If-None-Match': got.h.get('etag') } })
ok('GET /media with If-None-Match → 304', m304.s === 304, { s: m304.s })
const head = await fetch(B + webpUp.b.src, { method: 'HEAD' })
ok('HEAD /media → 200 with headers', head.status === 200 && head.headers.get('content-type') === 'image/webp', { s: head.status })
ok('GET /media wrong extension → 404', (await call('GET', `/media/${webpUp.b.id}.png`)).s === 404)
ok('GET /media unknown id → 404', (await call('GET', '/media/0000000000000000.webp')).s === 404)
ok('GET /media bad names → 404', (await call('GET', '/media/abc')).s === 404 && (await call('GET', '/media/x.webp')).s === 404 && (await call('GET', '/media/')).s === 404)
const wrongType = await call('POST', '/v1/admin/media', { headers: { ...admin, 'Content-Type': 'image/png' }, raw: WEBP })
ok('upload with a type that does not match the bytes → 415', wrongType.s === 415 && wrongType.b.error === 'unsupported_media_type', wrongType.b)
const gif = await call('POST', '/v1/admin/media', { headers: { ...admin, 'Content-Type': 'image/gif' }, raw: new Uint8Array([71, 73, 70, 56, 57, 97]) })
ok('upload GIF → 415', gif.s === 415, gif.b)
const big = new Uint8Array(1_000_001); big.set(PNG)
const tooBig = await call('POST', '/v1/admin/media', { headers: { ...admin, 'Content-Type': 'image/png' }, raw: big })
ok('upload > 1,000,000 bytes → 413 media_too_large', tooBig.s === 413 && tooBig.b.error === 'media_too_large', tooBig.b)
const list0 = await call('GET', '/v1/admin/media', { headers: admin })
const item = (l, id) => l.b.find((x) => x.id === id)
ok('GET /v1/admin/media lists newest first, used=false', list0.s === 200 && list0.b[0]?.id === pngUp.b.id && item(list0, webpUp.b.id)?.used === false
  && item(list0, webpUp.b.id)?.mime === 'image/webp', list0.b?.slice(0, 2))

// in use by the content → 409 (the share image must be JPG/PNG: WhatsApp shows WebP badly)
const webpOg = await call('PUT', '/v1/admin/content/seo', { headers: admin, body: { ...DEFAULT_CONTENT.seo, og_image: { src: webpUp.b.src, alt: 'x', w: 1, h: 1 } } })
ok('share image as WebP → 400 bad_format', webpOg.s === 400 && webpOg.b.reason === 'bad_format' && webpOg.b.path === 'og_image.src', webpOg.b)
const seo = { ...DEFAULT_CONTENT.seo, og_image: { src: pngUp.b.src, alt: 'صورة المشاركة', w: 4, h: 3 } }
const seoPut = await call('PUT', '/v1/admin/content/seo', { headers: admin, body: seo })
ok('content may use an uploaded image', seoPut.s === 200 && seoPut.b.value.og_image.src === pngUp.b.src, seoPut.b)
ok('media list: used=true', item(await call('GET', '/v1/admin/media', { headers: admin }), pngUp.b.id)?.used === true)
const inUse = await call('DELETE', `/v1/admin/media/${pngUp.b.id}`, { headers: admin })
ok('DELETE media used by the content → 409 media_in_use', inUse.s === 409 && inUse.b.error === 'media_in_use', inUse.b)

// ---------- 4. room photos ----------
const photos = [
  { src: webpUp.b.src, alt: 'غرفة 1 من الداخل', w: 1, h: 1 },
  { src: '/img/room-a.webp', alt: 'قاعة', w: 1105, h: 1400, small: '/img/room-a-720.webp' },
]
const rp = await call('PATCH', '/v1/admin/rooms/1', { headers: admin, body: { photos } })
ok('PATCH room photos → room with photos', rp.s === 200 && eq(rp.b.photos, photos), rp.b)
const rooms = await call('GET', '/v1/rooms')
ok('GET /v1/rooms: photos on every room', rooms.b.every((r) => Array.isArray(r.photos)) && eq(rooms.b.find((r) => r.id === 1)?.photos, photos), rooms.b?.map((r) => r.photos?.length))
const pull = await call('GET', '/v1/team/sync', { headers: staff })
ok('team sync pull: rooms carry photos', pull.s === 200 && eq(pull.b.rooms.find((r) => r.id === 1)?.photos, photos) && pull.b.rooms.every((r) => Array.isArray(r.photos)), { s: pull.s })
const roomInUse = await call('DELETE', `/v1/admin/media/${webpUp.b.id}`, { headers: admin })
ok('DELETE media used by a room photo → 409', roomInUse.s === 409 && roomInUse.b.error === 'media_in_use', roomInUse.b)
const badPhotos = await call('PATCH', '/v1/admin/rooms/1', { headers: admin, body: { photos: [{ src: 'https://evil.example/x.png', alt: '', w: 1, h: 1 }] } })
ok('foreign photo src → 400 invalid_photos', badPhotos.s === 400 && badPhotos.b.error === 'invalid_photos', badPhotos.b)
const nine = await call('PATCH', '/v1/admin/rooms/1', { headers: admin, body: { photos: Array(9).fill(photos[1]) } })
ok('9 photos → 400 invalid_photos', nine.s === 400 && nine.b.error === 'invalid_photos', nine.b)
ok('a refused patch keeps the photos', eq((await call('GET', '/v1/rooms')).b.find((r) => r.id === 1)?.photos, photos))
const created = await call('POST', '/v1/admin/rooms', { headers: admin, body: { name: 'غرفة الصور', type: 'private', capacity: 2, contents: { chairs: 2, tables: 1 }, price_hour: 1000, photos: [photos[0]] } })
ok('POST room with photos → 201 with photos', created.s === 201 && eq(created.b.photos, [photos[0]]), created.b)
const plain = await call('POST', '/v1/admin/rooms', { headers: admin, body: { name: 'غرفة بلا صور', type: 'desk', capacity: 1, price_hour: 1000 } })
ok('POST room without photos → photos []', plain.s === 201 && eq(plain.b.photos, []), plain.b)
const syncOps = await call('POST', '/v1/team/sync', { headers: admin, body: { ops: [
  { client_id: uuid(), at: new Date().toISOString(), op: 'room_upsert', room: { id: plain.b.id, photos: [photos[1]] } },
  { client_id: uuid(), at: new Date().toISOString(), op: 'room_upsert', room: { client_room_id: 'tmp-1', name: 'غرفة أوفلاين', type: 'private', capacity: 3, price_hour: 1000, photos } },
  { client_id: uuid(), at: new Date().toISOString(), op: 'room_upsert', room: { id: plain.b.id, photos: [{ src: '/x.png', alt: '', w: 1, h: 1 }] } },
] } })
const [s1, s2, s3] = syncOps.b?.results ?? []
ok('sync room_upsert (patch) sets photos', s1?.ok && eq(s1.room.photos, [photos[1]]), s1)
ok('sync room_upsert (create) with photos', s2?.ok && eq(s2.room.photos, photos), s2)
ok('sync room_upsert with a bad photo → invalid_photos', s3 && !s3.ok && s3.error === 'invalid_photos', s3)
const staffRoom = await call('POST', '/v1/team/sync', { headers: staff, body: { ops: [{ client_id: uuid(), at: new Date().toISOString(), op: 'room_upsert', room: { id: 1, photos: [] } }] } })
ok('staff cannot change room photos (sync)', staffRoom.b?.results?.[0]?.error === 'forbidden', staffRoom.b)
// delete rooms → their photos go too (the media is free again once no room shows it)
await call('PATCH', '/v1/admin/rooms/1', { headers: admin, body: { photos: [photos[1]] } })
const d1 = await call('DELETE', `/v1/admin/rooms/${created.b.id}`, { headers: admin })
const d2 = await call('DELETE', `/v1/admin/rooms/${s2.room.id}`, { headers: admin })
const d3 = await call('DELETE', `/v1/admin/rooms/${plain.b.id}`, { headers: admin })
ok('rooms without bookings are deleted', [d1, d2, d3].every((d) => d.s === 200 && d.b.outcome === 'deleted'), [d1.b, d2.b, d3.b])
const freed = await call('DELETE', `/v1/admin/media/${webpUp.b.id}`, { headers: admin })
ok('deleting the rooms removed their photos → media deletable', freed.s === 200, freed.b)
ok('deleted media → /media 404', (await call('GET', webpUp.b.src)).s === 404)
const cleared = await call('PATCH', '/v1/admin/rooms/1', { headers: admin, body: { photos: [] } })
ok('photos: [] clears the list', cleared.s === 200 && eq(cleared.b.photos, []), cleared.b)

// ---------- 5. HTML + manifest ----------
const seoEdit = {
  ...seo,
  title: '{name} — عنوان تجريبي',
  description: 'وصف "تجريبي" <b>غامق</b> & {name}\nسطر تاني',
  site_name: 'موقع {name}',
  pages: { ...DEFAULT_CONTENT.seo.pages, home: 'الرئيسية | {name}' },
}
await call('PUT', '/v1/admin/content/seo', { headers: admin, body: seoEdit })
const annHtml = { enabled: true, text: 'عرض </script><!-- خاص', link_label: '', link_url: '', tone: 'info' }
await call('PUT', '/v1/admin/content/announcement', { headers: admin, body: annHtml })
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const meta = (html, attr, key) => { const m = html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`)); return m ? decode(m[1]) : null }
const bootOf = (html) => { const m = html.match(/<script id="fp-boot">window\.__FP_BOOT__=([\s\S]*?)<\/script>/); return m ? JSON.parse(m[1]) : null }
const page = await call('GET', '/book')
const html = page.text
ok('HTML: no-cache, no ETag', page.s === 200 && page.h.get('cache-control') === 'no-cache' && !page.h.get('etag'), Object.fromEntries(page.h))
ok('HTML <title> = edited seo.title (filled)', decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '') === 'فوكس بوينت — عنوان تجريبي', html.match(/<title>[^<]*<\/title>/)?.[0])
ok('HTML meta description escaped + one line', meta(html, 'name', 'description') === 'وصف "تجريبي" <b>غامق</b> & فوكس بوينت سطر تاني', meta(html, 'name', 'description'))
// "<b>" may sit inside a quoted, escaped attribute value (inert text there), never anywhere else in the page
ok('HTML: content markup never escapes into the page', !html.replace(/content="[^"]*"/g, '').includes('<b>غامق</b>') && !html.includes('</script><!-- خاص'))
ok('HTML og:image absolute + twitter:image', meta(html, 'property', 'og:image') === `${B}${pngUp.b.src}` && meta(html, 'name', 'twitter:image') === `${B}${pngUp.b.src}`, meta(html, 'property', 'og:image'))
ok('HTML og:site_name + og:image size/alt', meta(html, 'property', 'og:site_name') === 'موقع فوكس بوينت' && meta(html, 'property', 'og:image:width') === '4'
  && meta(html, 'property', 'og:image:alt') === 'صورة المشاركة', [meta(html, 'property', 'og:site_name'), meta(html, 'property', 'og:image:alt')])
const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? 'null')
ok('HTML JSON-LD follows the content + settings', ld?.name === 'موقع فوكس بوينت' && ld?.image === `${B}${pngUp.b.src}` && ld?.telephone === '+963985258963'
  && ld?.openingHoursSpecification?.[0]?.opens === settings0.open, ld)
const bootData = bootOf(html)
ok('HTML boot script: {content, settings} parse, edited content inside', bootData && bootData.content.seo.title === seoEdit.title && eq(bootData.content.announcement, annHtml)
  && bootData.settings.centre_name === settings0.centre_name && bootData.settings.booking_enabled === true, bootData && Object.keys(bootData))
ok('HTML boot script: one closing tag only, no secrets', (html.match(/<script id="fp-boot">/g) ?? []).length === 1 && !('shamcash_number' in (bootData?.settings ?? {})))
ok('HTML boot content = GET /v1/content', eq(bootData?.content, (await call('GET', '/v1/content')).b.content))
const home = await call('GET', '/')
ok('HTML / uses seo.pages.home', decode(home.text.match(/<title>([^<]*)<\/title>/)?.[1] ?? '') === 'الرئيسية | فوكس بوينت')
ok('HTML: no theme <style> for the default colour', !home.text.includes('fp-theme'))
const deep = await call('GET', '/team/site')
ok('deep link (SPA fallback) is rewritten too', deep.s === 200 && bootOf(deep.text) !== null)
await call('PUT', '/v1/admin/content/theme', { headers: admin, body: { brand: '#1D4ED8' } })
const themed = await call('GET', '/')
ok('theme: <style> with the new brand palette', /<style id="fp-theme">:root\{--brand:#1d4ed8;--brand-hover:#[0-9a-f]{6};--brand-50:#[0-9a-f]{6};--brand-100:#[0-9a-f]{6}/.test(themed.text), themed.text.match(/<style id="fp-theme">[^<]*/)?.[0])
const privacy = await call('GET', '/privacy')        // /privacy.html redirects here (assets html_handling)
ok('privacy.html gets the theme, keeps its own title, no boot', privacy.text.includes('--brand:#1d4ed8') && /<title>سياسة الخصوصية/.test(privacy.text) && !privacy.text.includes('__FP_BOOT__'), privacy.text.slice(0, 200))
await call('DELETE', '/v1/admin/content/theme', { headers: admin })
ok('theme reset → no <style>', !(await call('GET', '/')).text.includes('fp-theme'))
const asset = await call('GET', '/icons/favicon.svg')
ok('static assets are untouched', asset.s === 200 && !asset.text.includes('__FP_BOOT__'), { s: asset.s })

const man0 = await call('GET', '/manifest.webmanifest')
ok('manifest: default name', man0.s === 200 && man0.b.name === 'فوكس بوينت' && man0.b.short_name === 'Focus Point' && Array.isArray(man0.b.icons) && man0.b.icons.length === 3, man0.b)
ok('manifest: JSON content type, no-cache', (man0.h.get('content-type') ?? '').includes('manifest+json') && man0.h.get('cache-control') === 'no-cache', Object.fromEntries(man0.h))
await call('PATCH', '/v1/admin/settings', { headers: admin, body: { centre_name: 'مركز التجربة' } })
const man1 = await call('GET', '/manifest.webmanifest')
ok('manifest name follows the centre name', man1.b.name === 'مركز التجربة' && man1.b.start_url === '/' && man1.b.icons.length === 3, man1.b)
ok('HTML {name} follows the centre name', decode((await call('GET', '/mine')).text.match(/<title>([^<]*)<\/title>/)?.[1] ?? '') === 'مركز التجربة — عنوان تجريبي')
await call('PATCH', '/v1/admin/settings', { headers: admin, body: { centre_name: 'فوكس بوينت' } })
await call('PUT', '/v1/admin/content/seo', { headers: admin, body: { ...DEFAULT_CONTENT.seo, app_name: 'تطبيق {name}', app_short_name: 'FP Test' } })
const man2 = await call('GET', '/manifest.webmanifest')
ok('manifest: an edited app name wins', man2.b.name === 'تطبيق فوكس بوينت' && man2.b.short_name === 'FP Test', man2.b)
await call('DELETE', '/v1/admin/content/seo', { headers: admin })
await call('DELETE', '/v1/admin/content/announcement', { headers: admin })
const lastMedia = await call('DELETE', `/v1/admin/media/${pngUp.b.id}`, { headers: admin })
ok('media free again after the content stopped using it → deleted', lastMedia.s === 200, lastMedia.b)

// ---------- 6. booking capabilities ----------
const today = localDate(new Date(), TZ)
const day = (n) => addDays(today, n + OFF)
const dev = () => ({ 'X-Device': uuid() })
const book = (room, d, from, to, extra = {}, headers = dev()) =>
  call('POST', '/v1/bookings', { headers, body: { room_id: room, start: at(d, from, TZ), end: at(d, to, TZ), name: 'زبون تجربة', phone: phone(1), ...extra } })
const setCaps = (p) => call('PATCH', '/v1/admin/settings', { headers: admin, body: p })

ok('GET /v1/settings exposes the capabilities (defaults)', Object.entries(DEFAULT_CAPS).every(([k, v]) => settings0[k] === v), settings0)
let r = await setCaps({ booking_enabled: false, booking_closed_message: 'مسكّرين للصيانة' })
ok('PATCH booking_enabled=false', r.s === 200 && r.b.booking_enabled === false && r.b.booking_closed_message === 'مسكّرين للصيانة', r.b)
r = await book(1, day(1), '10:00', '11:00')
ok('booking closed → 409 booking_closed', r.s === 409 && r.b.error === 'booking_closed', r.b)
r = await call('POST', '/v1/team/bookings/manual', { headers: staff, body: { room_id: 6, start: at(day(1), '10:00', TZ), end: at(day(1), '11:00', TZ), name: 'زبون حضوري', phone: phone(2), method: 'cash' } })
ok('booking closed: team walk-in still works', r.s === 201 && r.b.status === 'confirmed', r.b)
await setCaps({ booking_enabled: true, booking_closed_message: '' })

r = await setCaps({ shamcash_enabled: false })
ok('Sham Cash off with pay-on-arrival off → 400 no_payment_method', r.s === 400 && r.b.error === 'no_payment_method', r.b)
r = await setCaps({ shamcash_enabled: false, allow_pay_on_arrival: true })
ok('cash only (Sham Cash off, pay on arrival on)', r.s === 200 && r.b.shamcash_enabled === false, r.b)
r = await book(2, day(1), '10:00', '11:00', { method: 'shamcash' })
ok('Sham Cash disabled → 400 shamcash_disabled', r.s === 400 && r.b.error === 'shamcash_disabled', r.b)
r = await book(2, day(1), '10:00', '11:00')
ok('no method (defaults to shamcash) → 400 shamcash_disabled', r.s === 400 && r.b.error === 'shamcash_disabled', r.b)
const cashBooking = await book(2, day(1), '10:00', '11:00', { method: 'cash', phone: phone(3) })
ok('cash booking still works', cashBooking.s === 201 && cashBooking.b.status === 'awaiting_verification', cashBooking.b)
await setCaps({ shamcash_enabled: true, allow_pay_on_arrival: false })

await setCaps({ booking_horizon_days: 2 })
r = await book(3, day(5), '10:00', '11:00', { phone: phone(4) })
ok('beyond booking_horizon_days → 400 too_far_ahead', r.s === 400 && r.b.error === 'too_far_ahead', r.b)
r = await call('POST', '/v1/team/bookings/manual', { headers: staff, body: { room_id: 3, start: at(day(5), '12:00', TZ), end: at(day(5), '13:00', TZ), name: 'زبون حضوري', phone: phone(2), method: 'cash' } })
ok('horizon does not limit team walk-ins', r.s === 201, r.b)
await setCaps({ booking_horizon_days: 14 })
r = await book(3, day(5), '10:00', '11:00', { phone: phone(4) })
ok('same booking within the default horizon → 201', r.s === 201, r.b)

await setCaps({ max_open_holds_per_phone: 1 })
const holdDevice = dev()
const hold1 = await book(4, day(2), '10:00', '11:00', { phone: phone(5) }, holdDevice)
ok('first hold with limit 1 → 201', hold1.s === 201 && hold1.b.status === 'pending_payment', hold1.b)
r = await book(4, day(2), '12:00', '13:00', { phone: phone(5) })
ok('second hold for the same phone → 429 too_many_pending', r.s === 429 && r.b.error === 'too_many_pending', r.b)
await setCaps({ max_open_holds_per_phone: 3 })
r = await book(4, day(2), '12:00', '13:00', { phone: phone(5) })
ok('limit back to 3 → second hold allowed', r.s === 201, r.b)

await setCaps({ customer_can_cancel: false })
r = await call('POST', `/v1/bookings/${hold1.b.id}/cancel`, { headers: holdDevice })
ok('customer cancel while not allowed → 403 cancel_not_allowed', r.s === 403 && r.b.error === 'cancel_not_allowed', r.b)
r = await call('POST', `/v1/team/bookings/${cashBooking.b.id}/cancel`, { headers: staff })
ok('team cancel still works', r.s === 200 && r.b.status === 'cancelled', r.b)
await setCaps({ customer_can_cancel: true })
r = await call('POST', `/v1/bookings/${hold1.b.id}/cancel`, { headers: holdDevice })
ok('customer cancel allowed again → 200', r.s === 200 && r.b.status === 'cancelled', r.b)

r = await setCaps({ reminder_minutes: 10 })
ok('reminder_minutes 10 → 400 invalid_reminder', r.s === 400 && r.b.error === 'invalid_reminder', r.b)
r = await setCaps({ booking_horizon_days: 0 })
ok('booking_horizon_days 0 → 400 invalid_horizon', r.s === 400 && r.b.error === 'invalid_horizon', r.b)

// notification templates + reminders (today, a little ahead, inside opening hours)
const now = Date.now()
const start = Math.ceil((now + 20 * 60000) / (30 * 60000)) * 30 * 60000
const m = Math.round((start - now) / 60000)
const startLocal = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(start))
const endLocal = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(start + 3600000))
const sameDay = localDate(new Date(start), TZ) === today && localDate(new Date(start + 3600000), TZ) === today
if (!sameDay || startLocal < settings0.open || endLocal > settings0.close) {
  console.log(`SKIP reminder checks: ${startLocal}–${endLocal} is outside today's opening hours`)
} else {
  const span = { start: new Date(start).toISOString(), end: new Date(start + 3600000).toISOString(), name: 'زبون التذكير', phone: phone(6) }
  const R1 = dev(), R2 = dev()
  const [ra, rb, rc] = OFF % 2 ? [1, 2, 3] : [4, 5, 6]      // another set of rooms when re-running (OFF odd) within the same half hour
  const b1 = await call('POST', '/v1/bookings', { headers: R1, body: { room_id: ra, ...span } })
  const b2 = await call('POST', '/v1/bookings', { headers: R2, body: { room_id: rb, ...span, phone: phone(7) } })
  ok('two bookings starting soon', b1.s === 201 && b2.s === 201, [b1.b, b2.b])
  await call('POST', `/v1/team/bookings/${b1.b.id}/confirm`, { headers: staff })
  const inbox1 = await call('GET', '/v1/notifications', { headers: R1 })
  const conf1 = inbox1.b.find((n) => n.kind === 'booking_confirmed')
  const roomName = (id) => rooms.b.find((x) => x.id === id)?.name
  ok('confirm notification: default text', conf1?.title === 'تم تأكيد حجزك' && conf1.body.startsWith(`${roomName(ra)} · `) && conf1.body.endsWith(`· الرمز ${b1.b.code}. نراك في فوكس بوينت!`), conf1)
  await call('PUT', '/v1/admin/content/messages', { headers: admin, body: { ...DEFAULT_CONTENT.messages, booking_confirmed: { title: 'تأكيد {room} عند {name}', body: 'الرمز {code}' } } })
  await call('POST', `/v1/team/bookings/${b2.b.id}/confirm`, { headers: staff })
  const conf2 = (await call('GET', '/v1/notifications', { headers: R2 })).b.find((n) => n.kind === 'booking_confirmed')
  ok('confirm notification follows the edited template', conf2?.title === `تأكيد ${roomName(rb)} عند فوكس بوينت` && conf2.body === `الرمز ${b2.b.code}`, conf2)
  await call('DELETE', '/v1/admin/content/messages', { headers: admin })

  const cron = () => fetch(`${B}/__scheduled?cron=${encodeURIComponent('*/5 * * * *')}`)
  await setCaps({ reminder_minutes: 0 })
  await cron()
  const reminded = async (h) => (await call('GET', '/v1/notifications', { headers: h })).b.filter((n) => n.kind === 'booking_reminder')
  ok('reminder_minutes 0 → no reminder', (await reminded(R1)).length === 0 && (await reminded(R2)).length === 0)
  await setCaps({ reminder_minutes: m })
  await cron()
  const rem1 = await reminded(R1), rem2 = await reminded(R2)
  ok(`reminder_minutes ${m} → reminded once, title «حجزك بعد ${reminderLabel(m)}»`, rem1.length === 1 && rem2.length === 1 && rem1[0].title === `حجزك بعد ${reminderLabel(m)}`
    && rem1[0].body.endsWith(`· الرمز ${b1.b.code}. ننتظرك!`), [rem1, rem2])
  await cron()
  ok('no duplicate reminder on the next cron', (await reminded(R1)).length === 1)
  await setCaps({ reminder_minutes: m + 30 })
  const R3 = dev()
  const b3 = await call('POST', '/v1/bookings', { headers: R3, body: { room_id: rc, ...span, phone: phone(8) } })
  await call('POST', `/v1/team/bookings/${b3.b.id}/confirm`, { headers: staff })
  await cron()
  ok('booking outside the ±5 min window → not reminded yet', (await reminded(R3)).length === 0)
  await setCaps({ reminder_minutes: 60 })
}

// ---------- 7. admin only ----------
const adminRoutes = [
  ['GET', '/v1/admin/content'], ['PUT', '/v1/admin/content/brand'], ['DELETE', '/v1/admin/content/brand'],
  ['GET', '/v1/admin/content/brand/history'], ['POST', '/v1/admin/content/brand/undo'],
  ['POST', '/v1/admin/media'], ['GET', '/v1/admin/media'], ['DELETE', '/v1/admin/media/0000000000000000'],
]
for (const [method, path] of adminRoutes) {
  const s = await call(method, path, { headers: staff, body: method === 'PUT' ? DEFAULT_CONTENT.brand : undefined })
  const anon = await call(method, path, { body: method === 'PUT' ? DEFAULT_CONTENT.brand : undefined })
  ok(`${method} ${path}: staff 403, anonymous 401`, s.s === 403 && s.b.error === 'forbidden' && anon.s === 401, [s.s, anon.s])
}
ok('staff can still read the public content', (await call('GET', '/v1/content', { headers: staff })).s === 200)

// ---------- leave everything at the defaults ----------
for (const id of SECTION_IDS) await call('DELETE', `/v1/admin/content/${id}`, { headers: admin })
await setCaps({ ...DEFAULT_CAPS, centre_name: 'فوكس بوينت' })
ok('content back to the defaults', eq((await call('GET', '/v1/content')).b.content, DEFAULT_CONTENT))
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
process.exit(fails ? 1 : 0)
