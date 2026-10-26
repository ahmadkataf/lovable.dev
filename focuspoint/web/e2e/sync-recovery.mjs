// Regression: one failed request must not leave the team panel "offline" forever (a confirm would never be sent).
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const B = 'http://127.0.0.1:8799'
const j = async (m, p, body, h = {}) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...h }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, b: await r.json().catch(() => null) } }
const login = await j('POST', '/v1/team/login', { phone: '0985258963', password: 'Admin123!' })
const auth = { Authorization: `Bearer ${login.b.token}` }
await j('PATCH', '/v1/admin/settings', { allow_pay_on_arrival: true }, auth)
const day = new Date(Date.now() + (30 + Number(process.env.OFF || 0)) * 86400000).toISOString().slice(0, 10)
const made = await j('POST', '/v1/bookings', { room_id: 3, start: `${day}T08:00:00.000Z`, end: `${day}T09:00:00.000Z`, name: 'زبون المزامنة', phone: '0944555666', method: 'cash' }, { 'X-Device': crypto.randomUUID() })
if (made.s !== 201) { console.log('booking failed', made); process.exit(1) }
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript((t) => localStorage.setItem('fp_team_token', t), login.b.token)
const page = await ctx.newPage()
await page.goto(B + '/team', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500)
let aborted = 0
await page.route('**/v1/team/ping', (route) => { if (aborted === 0) { aborted++; return route.abort('internetdisconnected') } return route.continue() })
await page.waitForTimeout(6500)                       // the 5-second ping hits the failure
const chip = (await page.locator('header').innerText()).includes('دون اتصال') ? 'دون اتصال' : 'متصل'
const posts = []
page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/v1/team/sync')) posts.push(r.url()) })
await page.locator('.verify-actions button', { hasText: 'تأكيد الحجز' }).first().click()
await page.waitForTimeout(12000)
const server = await j('GET', `/v1/team/bookings?from=${day}T00:00:00.000Z&to=${day}T23:59:59.000Z`, null, auth)
const list = Array.isArray(server.b) ? server.b : server.b?.bookings ?? []
const status = list.find((x) => x.id === made.b.id)?.status
console.log(`injected failures: ${aborted} | header after failure: ${chip} | sync POSTs after confirm: ${posts.length} | server status: ${status}`)
console.log(posts.length > 0 && status === 'confirmed' ? 'PASS confirm reached the server' : 'FAIL confirm stuck on the phone')
await b.close(); process.exit(posts.length > 0 && status === 'confirmed' ? 0 : 1)
