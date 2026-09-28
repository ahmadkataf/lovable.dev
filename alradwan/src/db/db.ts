import Dexie, { type Table } from 'dexie'
import type { Collections, CollectionName } from './types'

// The local database (IndexedDB): every device keeps the whole shop, so the app works without internet.
// `outbox` remembers which records changed here and still have to reach the sync server.
export class GarageDB extends Dexie {
  products!: Table<Collections['products'], string>
  categories!: Table<Collections['categories'], string>
  customers!: Table<Collections['customers'], string>
  suppliers!: Table<Collections['suppliers'], string>
  sales!: Table<Collections['sales'], string>
  purchases!: Table<Collections['purchases'], string>
  payments!: Table<Collections['payments'], string>
  expenses!: Table<Collections['expenses'], string>
  cash!: Table<Collections['cash'], string>
  movements!: Table<Collections['movements'], string>
  users!: Table<Collections['users'], string>
  settings!: Table<Collections['settings'], string>
  outbox!: Table<{ key: string; collection: CollectionName; id: string }, string>
  meta!: Table<{ key: string; value: unknown }, string>

  constructor() {
    super('alradwan-garage')
    this.version(1).stores({
      products: 'id, code, barcode, name, categoryId, updatedAt',
      categories: 'id, name',
      customers: 'id, name, phone',
      suppliers: 'id, name, phone',
      sales: 'id, number, date, customerId',
      purchases: 'id, number, date, supplierId',
      payments: 'id, date, partyId',
      expenses: 'id, date',
      cash: 'id, date',
      movements: 'id, productId, date, refId',
      users: 'id',
      settings: 'id',
      outbox: 'key',
      meta: 'key',
    })
  }
}

export const db = new GarageDB()
