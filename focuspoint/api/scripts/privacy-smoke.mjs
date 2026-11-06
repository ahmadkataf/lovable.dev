// Run against a local `wrangler dev` (fresh D1): B=http://127.0.0.1:8799 KEY=<ADMIN_SETUP_KEY> OFF=<days ahead> node scripts/privacy-smoke.mjs
// Privacy check: one customer's booking must never show for another customer, nor in the customer side of a staff phone.
const B = process.env.B || 'http://127.0.0.1:8799'
const A = crypto.randomUUID(), Bdev = crypto.randomUUID(), STAFF_PHONE = crypto.randomUUID()
const j = async (m, p, body, h = {}) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...h }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, b: await r.json().catch(() => null) } }
let fails = 0
const ok = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + JSON.stringify(extra))); if (!cond) fails++ }

const boot = await j('POST', '/v1/admin/bootstrap', { setup_key: process.env.KEY || 'setup-key', phone: '0985258963', name: 'المدير', password: 'Admin123!' })
const login = boot.s < 300 ? boot : await j('POST', '/v1/team/login', { phone: '0985258963', password: 'Admin123!' })
const auth = { Authorization: `Bearer ${login.b.token}` }
ok('admin signed in', Boolean(login.b?.token), login)

const day = new Date(Date.now() + (3 + Number(process.env.OFF || 0)) * 86400000).toISOString().slice(0, 10)
const made = await j('POST', '/v1/bookings', { room_id: 1, start: `${day}T08:00:00.000Z`, end: `${day}T10:00:00.000Z`, name: 'زبون متخفي', phone: '0944123456' }, { 'X-Device': A })
ok('customer A books (incognito-like fresh device)', made.s === 201, made)
const id = made.b.id

const mineA = await j('GET', '/v1/bookings/mine', null, { 'X-Device': A })
ok('A sees own booking', mineA.b.some((x) => x.id === id), mineA)
const mineB = await j('GET', '/v1/bookings/mine', null, { 'X-Device': Bdev })
ok('another customer B sees no bookings', Array.isArray(mineB.b) && mineB.b.length === 0, mineB)
const openB = await j('GET', `/v1/bookings/${id}`, null, { 'X-Device': Bdev })
ok('B cannot open A\'s booking', openB.s === 403, openB)
const notB = await j('GET', '/v1/notifications', null, { 'X-Device': Bdev })
ok('B notification inbox empty', notB.s === 200 && notB.b.length === 0, notB)
const avail = await fetch(`${B}/v1/availability?date=${day}`, { headers: { 'X-Device': Bdev } }).then((r) => r.text())
ok('availability exposes no name / phone / code', !/زبون متخفي|0944123456|customer_|"code"/.test(avail), avail.slice(0, 300))

// A staff phone: signed in to the team panel AND has its own customer device id (what the app sends)
const staffMine = await j('GET', '/v1/bookings/mine', null, { 'X-Device': STAFF_PHONE, ...auth })
ok('staff phone customer "my bookings" stays empty', staffMine.b.length === 0, staffMine)
const staffInbox = await j('GET', '/v1/notifications', null, { 'X-Device': STAFF_PHONE, ...auth })
ok('staff phone customer inbox has no team alerts', staffInbox.s === 200 && staffInbox.b.length === 0, staffInbox)
const read = await j('POST', '/v1/notifications/read', {}, { 'X-Device': STAFF_PHONE, ...auth })
ok('mark-read still works with a team token', read.s === 200, read)
const inboxA = await j('GET', '/v1/notifications', null, { 'X-Device': A })
ok('A inbox has only A\'s own items', inboxA.b.every((n) => n.device_id === A && n.user_id === null), inboxA)

// The team panel, by design, sees everything
const team = await j('GET', '/v1/team/bookings', null, auth)
const teamList = Array.isArray(team.b) ? team.b : team.b?.bookings ?? []
ok('team panel sees the booking (intended)', team.s === 200 && teamList.some((x) => x.id === id), { s: team.s })
const noAuth = await j('GET', '/v1/team/bookings', null, { 'X-Device': Bdev })
ok('team list refused without login', noAuth.s === 401, noAuth)
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0)
