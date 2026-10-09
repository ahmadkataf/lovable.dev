// Runs the SUFIX API and site on plain Node (no Cloudflare): `npm run build && npm run server`.
// Data is kept in server/data/sufix.db (SQLite via node:sqlite).
import { DatabaseSync } from 'node:sqlite'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.SUFIX_DATA || path.join(here, 'data')
mkdirSync(dataDir, { recursive: true })
const sqlite = new DatabaseSync(path.join(dataDir, 'sufix.db'))
sqlite.exec('PRAGMA journal_mode = WAL')

// A D1-shaped wrapper around node:sqlite, so worker/index.ts runs unchanged.
class Stmt {
  constructor(sql) { this.sql = sql; this.args = [] }
  bind(...args) { const s = new Stmt(this.sql); s.args = args.map(a => (a === undefined ? null : a)); return s }
  async first() { return sqlite.prepare(this.sql).get(...this.args) ?? null }
  async all() { return { results: sqlite.prepare(this.sql).all(...this.args) } }
  async run() { return sqlite.prepare(this.sql).run(...this.args) }
}
const DB = {
  prepare: sql => new Stmt(sql),
  async batch(stmts) { sqlite.exec('BEGIN'); try { for (const s of stmts) await s.run(); sqlite.exec('COMMIT') } catch (e) { sqlite.exec('ROLLBACK'); throw e } },
}

const { handleApi } = await import('./api.mjs')
const dist = path.join(here, '..', 'dist')
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }

const port = Number(process.env.PORT || 8787)
createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  try {
    if (url.pathname.startsWith('/api/')) {
      const chunks = []
      for await (const c of req) chunks.push(c)
      const body = chunks.length ? Buffer.concat(chunks) : undefined
      const request = new Request(url, { method: req.method, headers: req.headers, body: body && req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined })
      const out = await handleApi(request, DB)
      res.writeHead(out.status, Object.fromEntries(out.headers))
      res.end(Buffer.from(await out.arrayBuffer()))
      return
    }
    let file = path.join(dist, path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''))
    if (!file.startsWith(dist)) file = path.join(dist, 'index.html')
    const isFile = await stat(file).then(s => s.isFile()).catch(() => false)
    if (!isFile) file = path.join(dist, 'index.html')
    const ext = path.extname(file)
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000' })
    res.end(await readFile(file))
  } catch (e) {
    console.error(e)
    res.writeHead(500); res.end('server error')
  }
}).listen(port, () => console.log(`SUFIX running on http://localhost:${port}  (data: ${dataDir})`))
