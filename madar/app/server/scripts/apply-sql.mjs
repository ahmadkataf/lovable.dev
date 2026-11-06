// Apply an SQL script (schema.sql / seed.sql) to a running Madar worker through the admin endpoint.
//   ADMIN_KEY=... node scripts/apply-sql.mjs https://app.madar.raqeem.dev schema.sql seed.sql
import { readFileSync } from 'node:fs'
const [base, ...files] = process.argv.slice(2)
const key = process.env.ADMIN_KEY
if (!base || !files.length || !key) { console.error('usage: ADMIN_KEY=… node scripts/apply-sql.mjs <base-url> <file.sql>…'); process.exit(2) }
for (const f of files) {
  const res = await fetch(`${base.replace(/\/$/, '')}/api/admin/sql`, { method: 'POST', headers: { 'x-admin-key': key, 'content-type': 'text/plain; charset=utf-8' }, body: readFileSync(f, 'utf8') })
  const body = await res.text()
  console.log(f, res.status, body.slice(0, 200))
  if (!res.ok) process.exit(1)
}
const h = await fetch(`${base.replace(/\/$/, '')}/api/admin/health`, { headers: { 'x-admin-key': key } })
console.log('health', h.status, await h.text())
