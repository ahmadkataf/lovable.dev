// Notifications: recalls from the cached last visit (no past appointments read), the backup reminder, and a red dot
// that stays cleared after a restart however many alerts there are.
import { backupAlert, computeAlerts, importantIds, isSeen, parseSeen, recallPatients, seenHash, unseenCount } from '../src/features/search/alerts'
import { translate } from '../src/i18n'

const TODAY = '2026-10-10'
const NOW = new Date(2026, 9, 10, 10, 0)

describe('recall from the cached last visit', () => {
  it('needs only the bookings from today on', () => {
    const pat = (id: string, lastVisit?: string, archived = false) => ({ id, name: id, archived, lastVisit })
    const patients = [pat('A', '2026-03-01T09:00:00.000Z'), pat('B', '2026-08-01T09:00:00.000Z'), pat('C', '2025-01-01T09:00:00.000Z'), pat('D'), pat('E', '2025-01-01T09:00:00.000Z', true)]
    const upcoming = [{ patientId: 'C', date: '2026-10-20', status: 'scheduled' as const }]
    const r = recallPatients(patients, upcoming, TODAY)
    expect(r.list.map(x => x.patient.id)).toEqual(['A'])
    expect(r.list[0]).toMatchObject({ lastVisit: '2026-03-01', months: 7 })
  })
})

describe('backup reminder', () => {
  it('shows when no backup was ever made (once there is data) or the last one is a week old', () => {
    expect(backupAlert(null, false, NOW)).toBeNull()
    expect(backupAlert(null, true, NOW)).toMatchObject({ kind: 'never', days: null })
    expect(backupAlert(new Date(2026, 9, 5).toISOString(), true, NOW)).toBeNull()
    expect(backupAlert(new Date(2026, 9, 1).toISOString(), true, NOW)).toMatchObject({ kind: 'old', days: 9 })
    // the id changes weekly, so the dot comes back each week until a backup is made
    const a = backupAlert(null, true, NOW)!, b = backupAlert(null, true, new Date(2026, 9, 18))!
    expect(a.id).not.toBe(b.id)
    expect(backupAlert(null, true, new Date(2026, 9, 10, 18))!.id).toBe(a.id)
  })
  it('is part of the panel and of the red dot', () => {
    const a = computeAlerts({ upcoming: [], invoices: [], items: [], labOrders: [], patients: [], backup: { lastAt: null, hasData: true } }, NOW)
    expect(a.backup?.kind).toBe('never')
    expect(a.important).toEqual([a.backup!.id])
    expect(importantIds({ backup: null }, TODAY)).toEqual([])
    expect(translate('ar', 'search.backup.old', { n: 9 })).toBe('آخر نسخة احتياطية قبل 9 أيام')
    expect(translate('en', 'search.backup.old', { n: 1 })).toBe('Last backup 1 day ago')
  })
})

describe('the red dot after a restart', () => {
  it('keeps every seen alert (as short hashes), even thousands', () => {
    const ids = Array.from({ length: 5000 }, (_, i) => `inv:${i.toString(36).padStart(8, '0')}`)
    const stored = JSON.stringify([...new Set(ids.map(seenHash))])
    expect(stored.length).toBeLessThan(5000 * 10)
    const seen = parseSeen(stored)
    expect(unseenCount(ids, seen)).toBe(0)
    expect(unseenCount([...ids, 'inv:new'], seen)).toBe(1)
    expect(isSeen(seen, ids[4999])).toBe(true)
  })
  it('reads the older list of plain ids', () => {
    const seen = parseSeen(JSON.stringify(['inv:a', 'stock:b']))
    expect(unseenCount(['inv:a', 'stock:b', 'lab:c'], seen)).toBe(1)
  })
})
