// Bringing a shop's data over from the program it used before: straight from that program's database, not through
// Excel. On Windows, the SQL Server databases on this computer (الأمين keeps its materials in dbo.mt000, and many local
// programs are built on SQL Server); on every device, an Access database file (.mdb / .accdb) that older programs keep.
// Only reads. What comes out goes through the same preview as an Excel import before anything is saved.
import { parsePartyRows, parseProductRows, partyColumn, productColumn, type ImportedParty, type ImportedProduct } from './excel'
import { toNumber } from './format'

export type ImportKind = 'products' | 'customers' | 'suppliers'
export interface SqlLogin { user?: string; password?: string }
export interface SqlDatabase { server: string; database: string; ameen: boolean; products?: number; tables: number; error?: string }
export interface SourceTable { schema?: string; name: string; rows: number; columns: string[] }
export class LoginNeeded extends Error {}

const bridge = () => (typeof window !== 'undefined' ? window.garageDesktop?.sqlPrograms : undefined)
/** The Windows app can read SQL Server databases on its computer. */
export const sqlAvailable = () => !!bridge()

async function call(args: Parameters<NonNullable<ReturnType<typeof bridge>>>[0]): Promise<Record<string, unknown>> {
  const run = bridge()
  if (!run) throw new Error('متاح في نسخة الويندوز فقط')
  const r = await run(args)
  if (r && typeof r.error === 'string') {
    if (r.login) throw new LoginNeeded(r.error)
    throw new Error(r.error)
  }
  return r ?? {}
}
const grid = (v: unknown): unknown[][] => (Array.isArray(v) ? (v as unknown[][]) : [])
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

/** The databases on this computer's SQL Servers. `failed`: servers that refused this Windows user (a SQL login is needed). */
export async function sqlScan(login: SqlLogin & { server?: string } = {}): Promise<{ found: SqlDatabase[]; failed: { server: string; error: string; login: boolean }[]; servers: string[] }> {
  const r = await call({ action: 'scan', ...login })
  return { found: (r.found as SqlDatabase[]) ?? [], failed: (r.failed as { server: string; error: string; login: boolean }[]) ?? [], servers: (r.servers as string[]) ?? [] }
}

/** One database's tables with their rows and column names. */
export async function sqlTables(db: SqlDatabase, login: SqlLogin = {}): Promise<SourceTable[]> {
  const r = await call({ action: 'tables', server: db.server, database: db.database, ...login })
  const [, ...tables] = grid(r.tables)
  const [, ...cols] = grid(r.columns)
  const byTable = new Map<string, string[]>()
  for (const [sch, tbl, col] of cols) { const k = `${str(sch)}.${str(tbl)}`; byTable.set(k, [...(byTable.get(k) ?? []), str(col)]) }
  return tables.map(([sch, tbl, n]) => ({ schema: str(sch), name: str(tbl), rows: Number(n) || 0, columns: byTable.get(`${str(sch)}.${str(tbl)}`) ?? [] }))
}

/** A table's rows as [column names, row, row…]. */
export async function sqlTableRows(db: SqlDatabase, t: SourceTable, login: SqlLogin = {}): Promise<unknown[][]> {
  const r = await call({ action: 'table', server: db.server, database: db.database, schema: t.schema || 'dbo', table: t.name, limit: 100000, ...login })
  return grid(r.grid)
}

// ---------- الأمين ----------
type Grid = unknown[][]
const objects = (g: Grid): Record<string, unknown>[] => {
  const [head, ...rows] = g
  if (!head) return []
  const keys = head.map(h => str(h).toLowerCase())
  return rows.map(r => Object.fromEntries(keys.map((k, i) => [k, r[i]])))
}
const num = (v: unknown) => (typeof v === 'number' ? v : toNumber(str(v)))
const firstPositive = (...v: unknown[]) => { for (const x of v) { const n = num(x); if (n > 0) return n } return 0 }

/** الأمين's materials (mt000) as products: the sale price is the end-user / retail price (or, when the materials carry
 *  no prices, the highest of its price lists), the purchase price the average or last cost, the group the category. */
export function mapAmeen(res: { materials?: Grid; groups?: Grid; priceItems?: Grid }): ImportedProduct[] {
  const groups = new Map(objects(res.groups ?? []).map(g => [str(g.guid).toLowerCase(), str(g.name) || str(g.latinname)]))
  const lists = new Map<string, number[]>()
  for (const p of objects(res.priceItems ?? [])) {
    const n = num(p.unit1price)
    if (n > 0) { const k = str(p.materialguid).toLowerCase(); lists.set(k, [...(lists.get(k) ?? []), n]) }
  }
  const out: ImportedProduct[] = []
  for (const m of objects(res.materials ?? [])) {
    const name = str(m.name) || str(m.latinname)
    if (!name || m.bhide === true || num(m.bhide) === 1) continue
    const guid = str(m.guid).toLowerCase()
    const listed = lists.get(guid) ?? []
    let price = firstPositive(m.enduser, m.retail, m.half, m.whole, m.export, m.vendor)
    let wholesale = num(m.whole) > 0 && num(m.whole) !== price ? num(m.whole) : 0
    if (!price && listed.length) { price = Math.max(...listed); const low = Math.min(...listed); wholesale = low < price ? low : 0 }
    const barcodes = Object.keys(m).filter(k => k.startsWith('barcode')).sort().map(k => str(m[k])).filter(Boolean)
    out.push({
      code: str(m.code), name, barcode: barcodes.length ? [...new Set(barcodes)].join(', ') : undefined,
      category: groups.get(str(m.groupguid).toLowerCase()) || undefined, brand: str(m.company) || undefined, unit: str(m.unity) || undefined,
      cost: firstPositive(m.avgprice, m.lastprice), price, wholesalePrice: wholesale || undefined,
      stock: m.qty === undefined || m.qty === null ? undefined : num(m.qty), minStock: num(m.low) > 0 ? num(m.low) : undefined,
      notes: [str(m.latinname) && str(m.latinname) !== name ? str(m.latinname) : '', str(m.origin), str(m.model)].filter(Boolean).join(' · ') || undefined,
    })
  }
  return out
}

/** الأمين's products, read from its database. */
export async function ameenProducts(db: SqlDatabase, login: SqlLogin = {}): Promise<ImportedProduct[]> {
  const r = await call({ action: 'ameen', server: db.server, database: db.database, ...login })
  return mapAmeen({ materials: grid(r.materials), groups: r.groups ? grid(r.groups) : undefined, priceItems: r.priceItems ? grid(r.priceItems) : undefined })
}

// ---------- any program: which table holds what ----------
const TABLE_HINT: Record<ImportKind, RegExp> = {
  products: /mat|item|product|stock|goods|part|store|inv|مواد|ماد|اصناف|أصناف|صنف|بضاع|منتج|قطع/i,
  customers: /cust|client|buyer|زبائن|زبون|عملاء|عميل/i,
  suppliers: /supp|vendor|provider|مورد|موردين/i,
}
/** How likely a table is the shop's products (or customers, suppliers): its column names, its name, its rows. */
export function scoreTable(t: SourceTable, kind: ImportKind): number {
  if (!t.rows) return 0
  if (kind === 'products') {
    const keys = new Set(t.columns.map(productColumn).filter(Boolean))
    if (!keys.has('name')) return 0
    let s = 1 + (keys.has('price') ? 3 : 0) + (keys.has('cost') ? 1 : 0) + (keys.has('code') ? 1 : 0) + (keys.has('barcode') ? 2 : 0) + (keys.has('stock') ? 1 : 0) + (keys.has('unit') ? 1 : 0)
    if (TABLE_HINT.products.test(t.name)) s += 2
    if (TABLE_HINT.customers.test(t.name) || TABLE_HINT.suppliers.test(t.name)) s -= 3
    return Math.max(0, s)
  }
  const keys = new Set(t.columns.map(partyColumn).filter(Boolean))
  if (!keys.has('name')) return 0
  let s = 1 + (keys.has('phone') ? 2 : 0) + (keys.has('address') ? 1 : 0) + (keys.has('balance') || keys.has('debit') ? 2 : 0)
  if (TABLE_HINT[kind].test(t.name)) s += 4
  else if (TABLE_HINT[kind === 'customers' ? 'suppliers' : 'customers'].test(t.name)) s -= 4
  // a table with sale prices is the goods, not the people
  if (t.columns.some(c => productColumn(c) === 'price')) s -= 2
  return Math.max(0, s)
}
/** The tables most likely to hold what is wanted, best first (tables that cannot be it left out). */
export const rankTables = (tables: SourceTable[], kind: ImportKind) =>
  tables.map(t => ({ t, score: scoreTable(t, kind) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score || b.t.rows - a.t.rows).map(x => x.t)

export type Parsed = { kind: 'products'; rows: ImportedProduct[]; guessed?: string } | { kind: 'customers' | 'suppliers'; rows: ImportedParty[]; guessed?: string; signKnown: boolean }
/** A table's rows read as products or customers/suppliers, through the same column matching as an Excel file. */
export function parseTable(grid: unknown[][], kind: ImportKind): Parsed {
  if (kind === 'products') { const r = parseProductRows(grid); return { kind, rows: r.rows, guessed: r.guessed } }
  const r = parsePartyRows(grid)
  return { kind, rows: r.rows, guessed: r.guessed, signKnown: r.signKnown }
}

// ---------- Access files ----------
export interface AccessFile { tables: SourceTable[]; rows(name: string): unknown[][] }
/** An Access database file (.mdb / .accdb) of another program: its tables, and each table's rows. */
export async function openAccess(file: File, password?: string): Promise<AccessFile> {
  // the reader (and the decryption it brings) expects Node's Buffer and process: they have to exist before it loads.
  // process.versions has no "node", so nothing else takes this page for Node.
  const { Buffer } = await import('buffer')
  const g = globalThis as unknown as { Buffer?: unknown; process?: unknown }
  g.Buffer ??= Buffer
  g.process ??= { browser: true, env: {}, version: '', versions: {}, argv: [], nextTick: (fn: (...a: unknown[]) => void, ...a: unknown[]) => queueMicrotask(() => fn(...a)) }
  const { default: MDBReader } = await import('mdb-reader')
  const reader = new MDBReader(Buffer.from(await file.arrayBuffer()), password ? { password } : undefined)
  const tables = reader.getTableNames().map(name => { const t = reader.getTable(name); return { name, rows: t.rowCount, columns: t.getColumnNames() } })
  return {
    tables,
    rows: name => {
      const t = reader.getTable(name)
      const cols = t.getColumnNames()
      const cell = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v instanceof Uint8Array || (v !== null && typeof v === 'object' && !Array.isArray(v)) ? null : v)
      return [cols, ...t.getData().map(r => cols.map(c => cell((r as Record<string, unknown>)[c])))]
    },
  }
}
