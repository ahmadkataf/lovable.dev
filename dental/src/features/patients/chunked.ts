// Reading a big table without freezing a phone. One getAll() of 20 000 invoices (or 6 000 patients with their
// photos) is decoded in a single main-thread task that can last a second on a slow device. Reading the same rows in
// primary-key pages lets the browser handle taps and paint between pages; the total time stays about the same.
import type { Table } from 'dexie'

/** Every row of `table`, read in pages of `size` by primary key (works inside a live query or a transaction). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readAllChunked<T, K extends string = string>(table: Table<T, K, any>, size = 1000): Promise<T[]> {
  const pk = table.schema.primKey.keyPath as string
  const out: T[] = []
  let last: K | undefined
  for (;;) {
    const page = await (last === undefined ? table.orderBy(':id') : table.where(':id').above(last)).limit(size).toArray()
    for (const row of page) out.push(row)
    if (page.length < size) return out
    last = (page[page.length - 1] as Record<string, unknown>)[pk] as K
  }
}
