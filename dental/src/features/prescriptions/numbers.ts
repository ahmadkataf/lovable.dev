// Sequential, human-friendly references for prescriptions ('RX-000123') and lab orders ('LAB-000042'), like the
// invoice numbers: printed on the prescription and on the slip that goes to the lab, so a pharmacist, the lab and the
// clinic can name the same document. Each counter is a row of the settings table ('counter.rx', 'counter.lab'), so it
// travels with backups and restarts with a reset. Records saved before references existed are numbered once, in the
// order they were created, the first time the module needs them.
import { db, getSetting } from '@/db'
import type { LabOrder, Prescription } from '@/db/types'

/** A record that carries its reference (the field is optional: older records get one on first use). */
export type Numbered = { number?: string }
export type NumberedRx = Prescription & Numbered
export type NumberedLab = LabOrder & Numbered

export const RX_PREFIX = 'RX-'
export const LAB_PREFIX = 'LAB-'
export const RX_COUNTER = 'counter.rx'
export const LAB_COUNTER = 'counter.lab'

export const formatRef = (prefix: string, n: number) => `${prefix}${String(Math.max(1, Math.floor(n))).padStart(6, '0')}`
/** 'RX-000123' → 123; anything else → 0. */
export function refSeq(ref: string | undefined, prefix: string): number {
  if (!ref || !ref.startsWith(prefix)) return 0
  const rest = ref.slice(prefix.length)
  return /^\d+$/.test(rest) ? Number(rest) : 0
}
/** The references to give records that have none: after the highest one in use, in creation order. */
export function planNumbers<T extends { id: string; createdAt: string } & Numbered>(rows: T[], prefix: string, counter: number): { updates: { id: string; number: string }[]; next: number } {
  let next = Math.max(counter, ...rows.map(r => refSeq(r.number, prefix) + 1), 1)
  const missing = rows.filter(r => !r.number).sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1))
  const updates = missing.map(r => ({ id: r.id, number: formatRef(prefix, next++) }))
  return { updates, next }
}

/**
 * Takes the next reference of a counter. Call it inside a 'rw' transaction that includes db.settings (and the
 * table being written), so two saves can never get the same number.
 */
export async function takeRef(kind: 'rx' | 'lab'): Promise<string> {
  const [key, prefix] = kind === 'rx' ? [RX_COUNTER, RX_PREFIX] : [LAB_COUNTER, LAB_PREFIX]
  const cur = Number(await getSetting<number>(key, 0)) || 0
  let n = cur
  if (n < 1) {
    // first reference on this database: continue after any number already used (a restored backup, older records)
    const table = kind === 'rx' ? db.prescriptions : db.labOrders
    let max = 0
    await table.each(r => { const s = refSeq((r as Numbered).number, prefix); if (s > max) max = s })
    n = max + 1
  }
  await db.settings.put({ key, value: n + 1 })
  return formatRef(prefix, n)
}

const ensured: Partial<Record<'rx' | 'lab', Promise<void>>> = {}
/**
 * Gives a reference to every record saved before references existed (once per session, in the background).
 * Never call it from inside a live query: it writes.
 */
export function ensureRefs(kind: 'rx' | 'lab'): Promise<void> {
  ensured[kind] ??= (async () => {
    const [table, key, prefix] = kind === 'rx' ? [db.prescriptions, RX_COUNTER, RX_PREFIX] as const : [db.labOrders, LAB_COUNTER, LAB_PREFIX] as const
    // a flag in the settings table: the scan runs once per database (a restored older backup has no flag)
    const flag = `${key}.complete`
    if (await getSetting<boolean>(flag, false)) return
    await db.transaction('rw', table, db.settings, async () => {
      const rows: (Numbered & { id: string; createdAt: string })[] = []
      let anyMissing = false
      await table.each(r => { const x = r as Numbered & { id: string; createdAt: string }; rows.push({ id: x.id, createdAt: x.createdAt, number: x.number }); if (!x.number) anyMissing = true })
      if (anyMissing) {
        const counter = Number(await getSetting<number>(key, 0)) || 0
        const { updates, next } = planNumbers(rows, prefix, counter)
        for (const u of updates) await table.update(u.id, { number: u.number } as never)
        await db.settings.put({ key, value: next })
      }
      await db.settings.put({ key: flag, value: true })
    })
  })().catch(err => { console.warn('refs', err); delete ensured[kind] })
  return ensured[kind]!
}
/** Forgets that the references were checked (after a restore or a reset in the same session). */
export function resetRefsCheck() { delete ensured.rx; delete ensured.lab }
