// Focus Point — API smoke test against `wrangler dev --local --port 8799 --test-scheduled` (see docs/SMOKE.md).
// Usage: node docs/smoke/api-smoke.mjs   (DAY_OFFSET=n shifts the booking days so a re-run does not collide)
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')   // focuspoint/
const OFF = Number(process.env.DAY_OFFSET || 0)
const BASE = process.env.BASE || 'http://127.0.0.1:8799'
const SETUP_KEY = process.env.ADMIN_SETUP_KEY || 'dev-setup-key-123', WEBHOOK = process.env.WEBHOOK_SECRET || 'dev-webhook-secret-xyz'   // must match api/.dev.vars
const devA = randomUUID(), devB = randomUUID()
const RUN = Date.now().toString(36).toUpperCase()
let passed = 0, failed = 0
const ok = (cond, label, extra = '') => { if (cond) { passed++; console.log('PASS', label) } else { failed++; console.log('FAIL', label, extra) } }
async function call(method, path, { body, device, token, headers = {} } = {}) {
  const h = { Accept: 'application/json', ...headers }
  if (body !== undefined) h['Content-Type'] = 'application/json'
  if (device) h['X-Device'] = device
  if (token) h.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  let data; try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}
// Local day → UTC (Damascus is UTC+3 all year since 2022)
const tomorrow = new Date(Date.now() + (1 + OFF) * 86400000).toISOString().slice(0, 10)
const dayAfter = new Date(Date.now() + (2 + OFF) * 86400000).toISOString().slice(0, 10)
const at = (date, hhmm) => { const [h, m] = hhmm.split(':').map(Number); return new Date(Date.UTC(...date.split('-').map(Number).map((v, i) => i === 1 ? v - 1 : v), h - 3, m)).toISOString() }

// 1. bootstrap admin
let r = await call('POST', '/v1/admin/bootstrap', { body: { setup_key: SETUP_KEY, phone: '0985258963', name: 'المدير', password: 'Admin123!' } })
ok(r.status === 201 || (r.status === 409 && r.data.error === 'already_bootstrapped'), 'bootstrap admin', JSON.stringify(r))
r = await call('POST', '/v1/admin/bootstrap', { body: { setup_key: 'wrong', phone: '0985258963', name: 'x', password: 'Admin123!' } })
ok(r.status === 403, 'bootstrap wrong key → 403')

// 2. public reads
r = await call('GET', '/v1/settings', { device: devA })
ok(r.status === 200 && r.data.open === '09:00' && r.data.shamcash_number === undefined && r.data.plan?.width === 1200, 'GET settings (public, no shamcash)')
r = await call('GET', '/v1/rooms', { device: devA })
ok(r.status === 200 && r.data.length === 6 && r.data.every((x) => x.plan), 'GET rooms → 6 seeded rooms with plan')
const rooms = r.data
r = await call('GET', `/v1/availability?date=${tomorrow}`, { device: devA })
ok(r.status === 200 && Array.isArray(r.data), 'GET availability')
r = await call('GET', `/v1/availability?date=bad`, { device: devA })
ok(r.status === 400 && r.data.error === 'invalid_date', 'availability bad date → 400')
r = await call('GET', '/v1/rooms', { device: 'not-a-uuid' })
ok(r.status === 400 && r.data.error === 'invalid_device', 'bad X-Device → 400 invalid_device')

// 3. guest booking
const room1 = rooms[0], room2 = rooms[1]
r = await call('POST', '/v1/bookings', { device: devA, body: { room_id: room1.id, start: at(tomorrow, '10:00'), end: at(tomorrow, '12:00'), name: 'أحمد', phone: '+963 944 123 456', people: 2 } })
ok(r.status === 201 && r.data.status === 'pending_payment' && r.data.hold_until && /^[A-Z0-9]{6}$/.test(r.data.code) && r.data.price === room1.price_hour * 2 && r.data.customer_phone === '0944123456', 'create guest booking → pending_payment + hold + code + price', JSON.stringify(r.data))
const b1 = r.data
r = await call('POST', '/v1/bookings', { device: devB, body: { room_id: room1.id, start: at(tomorrow, '11:00'), end: at(tomorrow, '13:00'), name: 'سامر', phone: '0933111222' } })
ok(r.status === 409 && r.data.error === 'slot_taken', 'overlapping booking → 409 slot_taken', JSON.stringify(r))
r = await call('POST', '/v1/bookings', { device: devB, body: { room_id: room1.id, start: at(tomorrow, '10:15'), end: at(tomorrow, '11:15'), name: 'سامر', phone: '0933111222' } })
ok(r.status === 400 && r.data.error === 'off_grid', 'off-grid time → 400 off_grid')
r = await call('POST', '/v1/bookings', { device: devB, body: { room_id: room1.id, start: at(tomorrow, '23:00'), end: at(tomorrow, '24:00'), name: 'سامر', phone: '0933111222' } })
ok(r.status === 400, 'outside hours → 400 ' + r.data.error)
r = await call('POST', '/v1/bookings', { body: { room_id: room1.id, start: at(tomorrow, '14:00'), end: at(tomorrow, '15:00'), name: 'سامر', phone: '0933111222' } })
ok(r.status === 401 && r.data.error === 'device_required', 'no X-Device → 401 device_required')
r = await call('GET', '/v1/bookings/mine', { device: devA })
ok(r.status === 200 && r.data.some((b) => b.id === b1.id) && r.data[0].room_name, 'mine lists the booking (with room_name)')
r = await call('GET', '/v1/bookings/mine', { device: devB })
ok(r.status === 200 && r.data.length === 0, 'mine from another device is empty')
r = await call('GET', `/v1/bookings/lookup?code=${b1.code.toLowerCase()}&phone=0944123456`, { device: devB })
ok(r.status === 200 && r.data.id === b1.id, 'lookup by code+phone from another device')
r = await call('GET', `/v1/bookings/lookup?code=${b1.code}&phone=0999999999`, { device: devB })
ok(r.status === 404, 'lookup wrong phone → 404')
r = await call('GET', `/v1/bookings/${b1.id}`, { device: devB })
ok(r.status === 403, 'GET booking from a foreign device → 403')
r = await call('GET', `/v1/bookings/${b1.id}`, { device: devA })
ok(r.status === 200 && r.data.payment && r.data.payment.shamcash_number === '0985258963' && r.data.payment.amount === b1.price && r.data.payment.code === b1.code, 'GET booking (owner) has payment info')
r = await call('POST', `/v1/bookings/${b1.id}/payment`, { device: devA, body: { ref: '12' } })
ok(r.status === 400 && r.data.error === 'invalid_ref', 'short ref → 400 invalid_ref')
r = await call('POST', `/v1/bookings/${b1.id}/payment`, { device: devA, body: { ref: `SC-${RUN}` } })
ok(r.status === 200 && r.data.status === 'awaiting_verification' && r.data.payment_ref === `SC-${RUN}`, 'submit payment ref → awaiting_verification')

// 4. team
r = await call('POST', '/v1/team/login', { body: { phone: '0985258963', password: 'wrong' } })
ok(r.status === 401 && r.data.error === 'invalid_credentials', 'login wrong password → 401')
r = await call('POST', '/v1/team/login', { body: { phone: '0985258963', password: 'Admin123!' } })
ok(r.status === 200 && r.data.token && r.data.user.role === 'admin', 'team login (admin)')
const admin = r.data.token
r = await call('GET', '/v1/team/me', { token: admin })
ok(r.status === 200 && r.data.phone === '0985258963', 'GET team/me')
r = await call('GET', '/v1/team/me', { token: 'garbage' })
ok(r.status === 401 && r.data.error === 'invalid_token', 'bad token → 401 invalid_token')
r = await call('GET', '/v1/team/dashboard', { token: admin })
ok(r.status === 200 && r.data.pending.some((b) => b.id === b1.id) && r.data.counts.pending >= 1, 'dashboard shows pending verification')
r = await call('GET', '/v1/team/notifications'.replace('/team', ''), { token: admin })
ok(r.status === 200 && r.data.some((n) => n.kind === 'booking_created') && r.data.some((n) => n.kind === 'payment_submitted'), 'team inbox has booking_created + payment_submitted')
r = await call('POST', `/v1/team/bookings/${b1.id}/confirm`, { token: admin })
ok(r.status === 200 && r.data.status === 'confirmed' && r.data.verified_by, 'confirm → confirmed')
r = await call('POST', `/v1/team/bookings/${b1.id}/confirm`, { token: admin })
ok(r.status === 409 && r.data.error === 'illegal_transition', 'confirm twice → 409 illegal_transition')
r = await call('GET', `/v1/bookings/${b1.id}`, { device: devA })
ok(r.status === 200 && r.data.status === 'confirmed', 'customer sees confirmed')
r = await call('GET', '/v1/notifications', { device: devA })
ok(r.status === 200 && r.data.some((n) => n.kind === 'booking_confirmed' && n.booking_id === b1.id), 'customer notifications has booking_confirmed')
r = await call('POST', '/v1/notifications/read', { device: devA, body: {} })
ok(r.status === 200 && r.data.ok === true, 'mark notifications read')

// 5. cancel rules
r = await call('POST', `/v1/bookings/${b1.id}/cancel`, { device: devA })
ok(r.status === 409 && r.data.error === 'illegal_transition', 'customer cannot cancel a confirmed booking → 409')
r = await call('POST', '/v1/bookings', { device: devA, body: { room_id: room2.id, start: at(tomorrow, '10:00'), end: at(tomorrow, '11:00'), name: 'أحمد', phone: '0944123456' } })
const b2 = r.data
ok(r.status === 201, 'second guest booking (room 2)')
r = await call('POST', `/v1/bookings/${b2.id}/cancel`, { device: devA })
ok(r.status === 200 && r.data.status === 'cancelled', 'customer cancels a pending booking → cancelled')
r = await call('POST', `/v1/team/bookings/${b1.id}/cancel`, { token: admin })
ok(r.status === 200 && r.data.status === 'cancelled', 'team cancels a confirmed booking → cancelled')
r = await call('GET', '/v1/notifications', { device: devA })
ok(r.data.some((n) => n.kind === 'booking_cancelled' && n.booking_id === b1.id), 'customer notified of team cancel')

// 6. manual booking idempotent by client_id
const cid = randomUUID()
const manual = { room_id: room1.id, start: at(tomorrow, '13:00'), end: at(tomorrow, '14:00'), phone: '0955000111', name: 'زائر', method: 'cash', client_id: cid }
r = await call('POST', '/v1/team/bookings/manual', { token: admin, body: manual })
ok(r.status === 201 && r.data.status === 'confirmed' && r.data.method === 'cash' && r.data.price === room1.price_hour, 'manual cash booking → confirmed, priced')
const m1 = r.data
r = await call('POST', '/v1/team/bookings/manual', { token: admin, body: manual })
ok(r.status === 201 && r.data.id === m1.id, 'same client_id twice → same booking')
r = await call('PATCH', `/v1/team/bookings/${m1.id}`, { token: admin, body: { start: at(tomorrow, '14:00'), end: at(tomorrow, '15:30'), note: 'moved' } })
ok(r.status === 200 && r.data.note === 'moved' && r.data.end === at(tomorrow, '15:30'), 'edit/move manual booking')

// 7. sync
const sinceBefore = (await call('GET', '/v1/team/sync', { token: admin })).data.now
r = await call('POST', '/v1/bookings', { device: devA, body: { room_id: room2.id, start: at(tomorrow, '16:00'), end: at(tomorrow, '17:00'), name: 'أحمد', phone: '0944123456' } })
const b4 = r.data
await call('POST', `/v1/bookings/${b4.id}/payment`, { device: devA, body: { ref: `SY-${RUN}` } })
const ops = [
  { client_id: randomUUID(), at: new Date().toISOString(), op: 'manual_booking', data: { room_id: room1.id, start: at(dayAfter, '09:00'), end: at(dayAfter, '10:00'), phone: '0966000222', name: 'وليد', method: 'free' } },
  { client_id: randomUUID(), at: new Date().toISOString(), op: 'confirm', booking_id: b4.id },
  { client_id: randomUUID(), at: new Date().toISOString(), op: 'room_upsert', room: { client_room_id: randomUUID(), name: 'غرفة تجريبية', type: 'private', capacity: 2, contents: { chairs: 2, tables: 1 }, price_hour: 9000, price_day: null, color: '#a58d73', plan: null, active: 1, sort: 9, description: null } },
  { client_id: randomUUID(), at: new Date().toISOString(), op: 'settings_patch', data: { plan: { width: 1200, height: 800, walls: [{ x: 0, y: 340, w: 1200, h: 120 }], labels: [{ x: 600, y: 400, text: 'الممر' }] } } },
  { client_id: randomUUID(), at: new Date().toISOString(), op: 'confirm', booking_id: 999999 },
]
r = await call('POST', '/v1/team/sync', { token: admin, body: { ops } })
const res1 = r.data.results
ok(r.status === 200 && res1.length === 5 && res1[0].ok && res1[0].booking?.status === 'confirmed' && res1[0].booking.price === 0, 'sync manual_booking (free) ok')
ok(res1[1].ok && res1[1].booking?.status === 'confirmed', 'sync confirm ok')
ok(res1[2].ok && res1[2].room?.id > 0 && res1[2].room.name === 'غرفة تجريبية', 'sync room_upsert ok (real id)')
ok(res1[3].ok === true, 'sync settings_patch ok')
ok(res1[4].ok === false && res1[4].error === 'booking_not_found', 'sync failing op reports error, others still run')
const newRoom = res1[2].room
r = await call('POST', '/v1/team/sync', { token: admin, body: { ops } })
ok(r.status === 200 && JSON.stringify(r.data.results.slice(0, 4)) === JSON.stringify(res1.slice(0, 4)), 'replaying the same ops → identical stored results (idempotent)')
r = await call('GET', `/v1/team/sync?since=${encodeURIComponent(sinceBefore)}`, { token: admin })
ok(r.status === 200 && r.data.bookings.some((b) => b.id === res1[0].booking.id) && r.data.bookings.some((b) => b.id === b4.id && b.status === 'confirmed') && r.data.rooms.some((x) => x.id === newRoom.id) && r.data.settings.plan.walls.length === 1 && r.data.settings.shamcash_number, 'GET sync?since returns the changes (bookings, room, settings)')
// staff cannot room_upsert via sync
r = await call('POST', '/v1/admin/team', { token: admin, body: { phone: '0911222333', name: 'موظف', password: 'Staff123', role: 'staff' } })
ok((r.status === 201 && r.data.role === 'staff') || (r.status === 409 && r.data.error === 'phone_taken'), 'admin creates staff account')
const staff = (await call('POST', '/v1/team/login', { body: { phone: '0911222333', password: 'Staff123' } })).data.token
r = await call('POST', '/v1/team/sync', { token: staff, body: { ops: [{ client_id: randomUUID(), at: new Date().toISOString(), op: 'room_upsert', room: { id: newRoom.id, name: 'x' } }] } })
ok(r.status === 200 && r.data.results[0].ok === false && r.data.results[0].error === 'forbidden', 'staff room_upsert via sync → forbidden')
r = await call('GET', '/v1/admin/settings', { token: staff })
ok(r.status === 403, 'staff on /v1/admin → 403')
r = await call('DELETE', `/v1/admin/rooms/${newRoom.id}`, { token: admin })
ok(r.status === 200 && r.data.outcome === 'deleted', 'DELETE unused room → deleted')
r = await call('GET', `/v1/team/sync?since=${encodeURIComponent(sinceBefore)}`, { token: admin })
ok(r.data.deleted_rooms.includes(newRoom.id), 'sync reports deleted_rooms')
// restore the default plan so the UI test sees the seeded layout
r = await call('PATCH', '/v1/admin/settings', { token: admin, body: { plan: { width: 1200, height: 800, walls: [{ x: 0, y: 340, w: 1200, h: 120 }, { x: 1080, y: 40, w: 80, h: 260 }], labels: [{ x: 600, y: 400, text: 'الممر' }, { x: 1120, y: 170, text: 'الاستقبال' }, { x: 1120, y: 630, text: 'المدخل' }] } } })
ok(r.status === 200 && r.data.plan.walls.length === 2, 'PATCH admin settings (plan restored)')
r = await call('PATCH', '/v1/admin/settings', { token: admin, body: { open: '23:00', close: '09:00' } })
ok(r.status === 400 && r.data.error === 'invalid_hours', 'invalid hours → 400')

// 8. webhook
r = await call('POST', '/v1/bookings', { device: devA, body: { room_id: room2.id, start: at(tomorrow, '18:00'), end: at(tomorrow, '19:00'), name: 'أحمد', phone: '0944123456' } })
const b5 = r.data
await call('POST', `/v1/bookings/${b5.id}/payment`, { device: devA, body: { ref: `WH-${RUN}` } })
r = await call('POST', '/v1/payments/shamcash/webhook', { headers: { 'X-Webhook-Secret': 'nope' }, body: { ref: `WH-${RUN}`, amount: b5.price } })
ok(r.status === 401 && r.data.error === 'invalid_secret', 'webhook wrong secret → 401')
r = await call('POST', '/v1/payments/shamcash/webhook', { headers: { 'X-Webhook-Secret': WEBHOOK }, body: { ref: `WH-${RUN}`, amount: b5.price } })
ok(r.status === 200 && r.data.matched === true, 'webhook right secret → matched')
r = await call('GET', `/v1/bookings/${b5.id}`, { device: devA })
ok(r.data.status === 'confirmed' && r.data.verified_by === null, 'webhook confirmed the booking (verified_by null)')
r = await call('POST', '/v1/payments/shamcash/webhook', { headers: { 'X-Webhook-Secret': WEBHOOK }, body: { ref: `WH-${RUN}`, amount: b5.price } })
ok(r.status === 200 && r.data.matched === true, 'duplicate webhook delivery → matched, no change')

// 9. scheduled: expire a hold
r = await call('POST', '/v1/bookings', { device: devA, body: { room_id: room2.id, start: at(tomorrow, '20:00'), end: at(tomorrow, '21:00'), name: 'أحمد', phone: '0944123456' } })
const b6 = r.data
ok(r.status === 201, 'booking to expire created')
const past = new Date(Date.now() - 60000).toISOString()
let sqlOut = ''
try {
  sqlOut = execFileSync('npx', ['wrangler', 'd1', 'execute', 'focuspoint', '--local', '--command', `UPDATE bookings SET hold_until = '${past}' WHERE id = ${b6.id}`], { cwd: resolve(ROOT, 'api'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
} catch (e) { sqlOut = String(e.stderr || e.message) }
ok(/"success":\s*true/.test(sqlOut), 'back-dated hold_until via wrangler d1 execute --local', sqlOut.slice(-300))
r = await fetch(`${BASE}/__scheduled?cron=*/5+*+*+*+*`)
ok(r.status === 200, 'GET /__scheduled runs the cron')
await new Promise((res) => setTimeout(res, 1500))
r = await call('GET', `/v1/bookings/${b6.id}`, { device: devA })
ok(r.data.status === 'expired', 'cron expired the booking', r.data.status)
r = await call('GET', '/v1/notifications', { device: devA })
ok(r.data.some((n) => n.kind === 'booking_expired' && n.booking_id === b6.id), 'customer notified booking_expired')
// a free slot again
r = await call('GET', `/v1/availability?date=${tomorrow}`, { device: devA })
ok(!r.data.some((a) => a.room_id === room2.id && a.start === at(tomorrow, '20:00')), 'expired booking no longer blocks availability')

// 10. report, customers, SPA, CORS
r = await call('GET', `/v1/admin/report?from=${tomorrow}&to=${dayAfter}`, { token: admin })
ok(r.status === 200 && typeof r.data.revenue === 'number' && r.data.bookings.length >= 3, 'admin report')
r = await call('GET', '/v1/team/customers?q=0944', { token: admin })
ok(r.status === 200 && r.data.some((c) => c.phone === '0944123456'), 'customers search')
r = await call('POST', '/v1/team/customers/0933111222/block', { token: admin, body: { blocked: 1 } })
ok(r.status === 200 && r.data.blocked === 1, 'block customer')
r = await call('POST', '/v1/bookings', { device: devB, body: { room_id: room2.id, start: at(dayAfter, '12:00'), end: at(dayAfter, '13:00'), name: 'سامر', phone: '0933111222' } })
ok(r.status === 403 && r.data.error === 'customer_blocked', 'blocked customer cannot book → 403')
await call('POST', '/v1/team/customers/0933111222/block', { token: admin, body: { blocked: 0 } })
const spa = await fetch(`${BASE}/team/plan`)
ok(spa.status === 200 && (await spa.text()).includes('<div id="root"'), 'SPA fallback serves index.html for /team/plan')
const sw = await fetch(`${BASE}/sw.js`)
ok(sw.status === 200 && (sw.headers.get('content-type') || '').includes('javascript'), 'sw.js served')
const opt = await fetch(`${BASE}/v1/rooms`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Headers': 'x-device,authorization' } })
ok(opt.status === 204 && (opt.headers.get('access-control-allow-headers') || '').toLowerCase().includes('x-device'), 'CORS preflight allows X-Device')
r = await call('GET', '/v1/nope', { device: devA })
ok(r.status === 404 && r.data.error === 'not_found', 'unknown API route → 404 JSON')

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
