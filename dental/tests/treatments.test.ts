import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase, updateClinic } from '@/db'
import type { Procedure, TreatmentItem } from '@/db/types'
import {
  bulkPrice, chartConditionFor, chartSurfaces, filterRegister, groupByCategory, groupByPatient, inRange, invoiceFromItems, isAnterior, isValidTooth, itemDate, itemTotal,
  mainDoctor, nextStatuses, parseTooth, planStatusFrom, planTotals, rangeFor, sortByDateDesc, sortSurfaces, sortTeeth, statusPatch, summarize, surfaceCode, surfacesForTeeth,
  TEETH_GRID, listSep, tn, toCSV, uniqueCode, uniqueTitle, unbilledItems, validateItem,
} from '@/features/treatments/lib'
import {
  addItems, applyBulkPrice, applyChartEntries, approvePlan, billItems, cancelPlan, createPlan, deleteItem, deletePlan, deleteProcedure, loadDefaultCatalogue, procedureUsage,
  saveProcedure, setItemStatus, updateItem,
} from '@/features/treatments/actions'
import { matches } from '@/lib/format'
import { translate } from '@/i18n'
import ar from '@/i18n/modules/treatments'

const NOW = '2026-10-10T09:00:00.000Z'
let seq = 0
const item = (p: Partial<TreatmentItem> = {}): TreatmentItem => ({
  id: `i${++seq}`, patientId: 'p1', procedureName: 'حشوة', price: 100, discount: 0, status: 'planned', createdAt: NOW, updatedAt: NOW, ...p,
})

describe('money', () => {
  it('itemTotal = price − discount, never negative, rounded', () => {
    expect(itemTotal({ price: 100, discount: 15 })).toBe(85)
    expect(itemTotal({ price: 10, discount: 25 })).toBe(0)
    expect(itemTotal({ price: 0.1 + 0.2, discount: 0 })).toBe(0.3)
  })
  it('planTotals ignores cancelled items and measures progress by value', () => {
    const t = planTotals([
      item({ price: 100, discount: 10, status: 'completed' }), item({ price: 300, status: 'planned' }), item({ price: 999, status: 'cancelled' }),
    ])
    expect(t).toMatchObject({ count: 2, subtotal: 400, discount: 10, total: 390, done: 1, doneValue: 90 })
    expect(t.progress).toBe(23)
    expect(planTotals([]).progress).toBe(0)
    // free work: progress by count
    expect(planTotals([item({ price: 0, status: 'completed' }), item({ price: 0 })]).progress).toBe(50)
  })
  it('summarize buckets per status and finds unbilled work', () => {
    const s = summarize([
      item({ price: 50 }), item({ price: 70, status: 'in_progress' }), item({ price: 120, status: 'completed' }),
      item({ price: 80, status: 'completed', invoiceId: 'inv1' }), item({ price: 40, status: 'cancelled' }),
    ])
    expect(s.planned).toEqual({ count: 1, value: 50 })
    expect(s.inProgress).toEqual({ count: 1, value: 70 })
    expect(s.completed).toEqual({ count: 2, value: 200 })
    expect(s.unbilled).toEqual({ count: 1, value: 120 })
    expect(s.cancelled.count).toBe(1)
  })
})

describe('status workflow', () => {
  it('planStatusFrom', () => {
    expect(planStatusFrom([], 'draft')).toBe('draft')
    expect(planStatusFrom([item()], 'draft')).toBe('draft')
    expect(planStatusFrom([item()], 'approved')).toBe('approved')
    expect(planStatusFrom([item(), item({ status: 'in_progress' })], 'draft')).toBe('in_progress')
    expect(planStatusFrom([item(), item({ status: 'completed' })], 'approved')).toBe('in_progress')
    expect(planStatusFrom([item({ status: 'completed' }), item({ status: 'cancelled' })], 'approved')).toBe('completed')
    expect(planStatusFrom([item({ status: 'completed' })], 'draft')).toBe('completed')
    expect(planStatusFrom([item()], 'completed')).toBe('approved')              // new work on a finished plan
    expect(planStatusFrom([item()], 'in_progress')).toBe('approved')            // work undone
    expect(planStatusFrom([item({ status: 'completed' })], 'cancelled')).toBe('cancelled')
    expect(planStatusFrom([item({ status: 'cancelled' })], 'approved')).toBe('approved')
  })
  it('nextStatuses: billed work cannot be reopened', () => {
    expect(nextStatuses({ status: 'planned' })).toEqual(['in_progress', 'completed', 'cancelled'])
    expect(nextStatuses({ status: 'completed' })).toEqual(['in_progress', 'cancelled'])
    expect(nextStatuses({ status: 'completed', invoiceId: 'x' })).toEqual([])
    expect(nextStatuses({ status: 'cancelled' })).toEqual(['planned'])
  })
  it('statusPatch sets completedAt once and clears it on reopen', () => {
    expect(statusPatch({ status: 'planned' }, 'completed', NOW)).toMatchObject({ status: 'completed', completedAt: NOW })
    expect(statusPatch({ status: 'completed', completedAt: 'old' }, 'completed', NOW).completedAt).toBe('old')
    const back = statusPatch({ status: 'completed', completedAt: 'old' }, 'in_progress', NOW)
    expect('completedAt' in back && back.completedAt === undefined).toBe(true)
  })
})

describe('invoices', () => {
  it('mainDoctor picks the most frequent doctor', () => {
    expect(mainDoctor([item({ doctorId: 'a' }), item({ doctorId: 'b' }), item({ doctorId: 'b' })])).toBe('b')
    expect(mainDoctor([item()])).toBeUndefined()
  })
  it('invoiceFromItems maps lines, totals and tax', () => {
    let n = 0
    const items = [
      item({ id: 't1', procedureId: 'pr1', procedureName: 'حشوة', tooth: 16, price: 60, discount: 10, status: 'completed', doctorId: 'd1' }),
      item({ id: 't2', procedureName: 'تنظيف', price: 40, status: 'completed', doctorId: 'd1' }),
    ]
    const inv = invoiceFromItems(items, { taxPercent: 10 }, { date: '2026-10-10', makeId: () => `l${++n}` })
    expect(inv.items).toEqual([
      { id: 'l1', treatmentItemId: 't1', procedureId: 'pr1', description: 'حشوة', tooth: 16, qty: 1, unitPrice: 60, discount: 10, total: 50 },
      { id: 'l2', treatmentItemId: 't2', description: 'تنظيف', qty: 1, unitPrice: 40, discount: 0, total: 40 },
    ])
    expect(inv).toMatchObject({ patientId: 'p1', doctorId: 'd1', date: '2026-10-10', subtotal: 90, discount: 0, taxPercent: 10, tax: 9, total: 99, paid: 0, status: 'unpaid' })
    expect(invoiceFromItems([item({ price: 0 })], { taxPercent: 0 }, { date: '2026-10-10', makeId: () => 'x' }).status).toBe('paid')
  })
  it('invoiceFromItems rounds tax and total to the currency, as billing does', () => {
    const items = [item({ price: 33, status: 'completed' }), item({ price: 35, discount: 0, status: 'completed' })]
    const inv = invoiceFromItems(items, { taxPercent: 5, currencyDecimals: 0 }, { date: '2026-10-10', makeId: () => 'x' })
    expect(inv).toMatchObject({ subtotal: 68, tax: 3, total: 71 })                 // 3.4 → 3 in a currency without cents
    const cents = invoiceFromItems(items, { taxPercent: 5, currencyDecimals: 2 }, { date: '2026-10-10', makeId: () => 'x' })
    expect(cents).toMatchObject({ subtotal: 68, tax: 3.4, total: 71.4 })
  })
  it('unbilledItems', () => {
    expect(unbilledItems([item({ status: 'completed' }), item({ status: 'completed', invoiceId: 'i' }), item()]).length).toBe(1)
  })
})

describe('dental chart suggestions', () => {
  it('chartConditionFor maps categories', () => {
    expect(chartConditionFor('restorative')).toBe('filled')
    expect(chartConditionFor('endodontic')).toBe('root_canal')
    expect(chartConditionFor('prosthodontic')).toBe('crown')
    expect(chartConditionFor('surgical')).toBe('missing')
    expect(chartConditionFor('implant')).toBe('implant')
    expect(chartConditionFor('preventive')).toBe('sealant')
    expect(chartConditionFor('cosmetic')).toBe('veneer')
    expect(chartConditionFor('diagnostic')).toBeNull()
    expect(chartConditionFor(undefined)).toBeNull()
  })
  it('chartSurfaces: item surfaces, else a default; none for whole-tooth conditions', () => {
    expect(chartSurfaces('filled', 16, ['O', 'M'])).toEqual(['M', 'O'])
    expect(chartSurfaces('filled', 16)).toEqual(['O'])
    expect(chartSurfaces('filled', 11)).toEqual(['B'])
    expect(chartSurfaces('crown', 16, ['O'])).toEqual([])
  })
})

describe('teeth', () => {
  it('grid rows follow the chart (patient right on the viewer left)', () => {
    expect(TEETH_GRID.adult.upper[0]).toEqual([18, 17, 16, 15, 14, 13, 12, 11])
    expect(TEETH_GRID.adult.upper[1]).toEqual([21, 22, 23, 24, 25, 26, 27, 28])
    expect(TEETH_GRID.adult.lower[0]).toEqual([48, 47, 46, 45, 44, 43, 42, 41])
    expect(TEETH_GRID.adult.lower[1]).toEqual([31, 32, 33, 34, 35, 36, 37, 38])
    expect(TEETH_GRID.primary.upper.flat()).toEqual([55, 54, 53, 52, 51, 61, 62, 63, 64, 65])
    expect(TEETH_GRID.primary.lower.flat()).toEqual([85, 84, 83, 82, 81, 71, 72, 73, 74, 75])
  })
  it('validates and parses FDI numbers', () => {
    expect(isValidTooth(11)).toBe(true); expect(isValidTooth(48)).toBe(true); expect(isValidTooth(85)).toBe(true)
    expect(isValidTooth(19)).toBe(false); expect(isValidTooth(56)).toBe(false); expect(isValidTooth(10)).toBe(false); expect(isValidTooth(16.5)).toBe(false)
    expect(parseTooth('16')).toBe(16); expect(parseTooth('99')).toBeNull(); expect(parseTooth(null)).toBeNull()
    expect(isAnterior(13)).toBe(true); expect(isAnterior(14)).toBe(false)
  })
  it('surfaces offered depend on the teeth', () => {
    expect(surfacesForTeeth([])).toEqual(['M', 'D', 'O', 'B', 'L', 'I', 'R'])
    expect(surfacesForTeeth([11])).toEqual(['M', 'D', 'B', 'L', 'I', 'R'])
    expect(surfacesForTeeth([36])).toEqual(['M', 'D', 'O', 'B', 'L', 'R'])
    expect(surfacesForTeeth([11, 36])).toContain('O')
    expect(surfaceCode(['D', 'O', 'M'])).toBe('MOD')
    expect(sortSurfaces(['L', 'B', 'I'])).toEqual(['I', 'B', 'L'])
  })
  it('sortTeeth uses chart order and drops invalid numbers', () => {
    expect(sortTeeth([36, 11, 18, 46, 21, 99, 11])).toEqual([18, 11, 21, 36, 46])
  })
})

describe('forms and price list', () => {
  it('validateItem', () => {
    expect(validateItem({ procedure: null, teeth: [], price: 10, discount: null })).toEqual({ procedure: 'v.procedure' })
    expect(validateItem({ procedure: { toothSpecific: true }, teeth: [], price: 10, discount: null })).toEqual({ teeth: 'v.teeth' })
    expect(validateItem({ procedure: { toothSpecific: false }, teeth: [], price: null, discount: null })).toEqual({ price: 'v.price' })
    expect(validateItem({ procedure: { toothSpecific: false }, teeth: [], price: -1, discount: null })).toEqual({ price: 'v.priceNegative' })
    expect(validateItem({ procedure: { toothSpecific: false }, teeth: [], price: 10, discount: 20 })).toEqual({ discount: 'v.discountTooBig' })
    expect(validateItem({ procedure: { toothSpecific: true }, teeth: [16], price: 10, discount: 5 })).toEqual({})
  })
  it('bulkPrice: percent / fixed, rounding, never negative', () => {
    expect(bulkPrice(100, { mode: 'percent', value: 10, round: 0 })).toBe(110)
    expect(bulkPrice(100, { mode: 'percent', value: -15, round: 0 })).toBe(85)
    expect(bulkPrice(33, { mode: 'percent', value: 10, round: 5 })).toBe(35)
    expect(bulkPrice(50, { mode: 'fixed', value: 7.5, round: 0 })).toBe(57.5)
    expect(bulkPrice(5, { mode: 'fixed', value: -20, round: 0 })).toBe(0)
  })
  it('groupByCategory follows the catalogue order and sorts inside', () => {
    const p = (name: string, category: Procedure['category'], code?: string, sortOrder?: number) => ({ name, category, code, sortOrder })
    const g = groupByCategory([p('ب', 'restorative', 'D2392'), p('أ', 'diagnostic'), p('ج', 'restorative', 'D2391')])
    expect(g.map(x => x.category)).toEqual(['diagnostic', 'restorative'])
    expect(g[1].items.map(x => x.code)).toEqual(['D2391', 'D2392'])
  })
  it('uniqueCode', () => {
    expect(uniqueCode('D1', ['D2'])).toBe('D1')
    expect(uniqueCode('D1', ['d1', 'D1-2'])).toBe('D1-3')
    expect(uniqueCode(undefined, [])).toBeUndefined()
  })
})

describe('register', () => {
  it('itemDate: done date, else planned date, else creation date', () => {
    expect(itemDate(item({ status: 'completed', completedAt: '2026-10-05T10:00:00', plannedDate: '2026-10-01' }))).toBe('2026-10-05')
    expect(itemDate(item({ plannedDate: '2026-11-01' }))).toBe('2026-11-01')
    expect(itemDate(item({ createdAt: '2026-09-03T10:00:00' }))).toBe('2026-09-03')
  })
  it('rangeFor presets (week starts on Saturday)', () => {
    expect(rangeFor('today', '2026-10-10')).toEqual({ from: '2026-10-10', to: '2026-10-10' })
    expect(rangeFor('week', '2026-10-10')).toEqual({ from: '2026-10-10', to: '2026-10-16' })   // 10 Oct 2026 is a Saturday
    expect(rangeFor('week', '2026-10-14')).toEqual({ from: '2026-10-10', to: '2026-10-16' })
    expect(rangeFor('month', '2026-02-14')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(rangeFor('all', '2026-10-10')).toBeNull()
    expect(rangeFor('custom', '2026-10-10', { from: '2026-10-20', to: '2026-10-01' })).toEqual({ from: '2026-10-01', to: '2026-10-20' })
    expect(inRange('2026-10-05', { from: '2026-10-01', to: '2026-10-05' })).toBe(true)
    expect(inRange('2026-10-06', { from: '2026-10-01', to: '2026-10-05' })).toBe(false)
  })
  it('filterRegister, sort and group', () => {
    const rows = [
      item({ id: 'a', patientId: 'p1', procedureName: 'حشوة كومبوزيت', procedureId: 'f', status: 'completed', completedAt: '2026-10-08T10:00:00', doctorId: 'd1', tooth: 16 }),
      item({ id: 'b', patientId: 'p2', procedureName: 'قلع', procedureId: 'x', plannedDate: '2026-10-09', doctorId: 'd2' }),
      item({ id: 'c', patientId: 'p1', procedureName: 'تنظيف', procedureId: 'c', plannedDate: '2026-12-01', doctorId: 'd1' }),
    ]
    const ctx = { categoryOf: (i: TreatmentItem) => (i.procedureId === 'f' ? 'restorative' as const : i.procedureId === 'x' ? 'surgical' as const : 'preventive' as const), patientName: (i: TreatmentItem) => (i.patientId === 'p1' ? 'سامر أحمد' : 'رنا'), match: matches }
    const month = rangeFor('month', '2026-10-10')
    expect(filterRegister(rows, { range: month }, ctx).map(r => r.id)).toEqual(['a', 'b'])
    expect(filterRegister(rows, { doctorId: 'd1' }, ctx).map(r => r.id)).toEqual(['a', 'c'])
    expect(filterRegister(rows, { category: 'surgical' }, ctx).map(r => r.id)).toEqual(['b'])
    expect(filterRegister(rows, { status: 'completed' }, ctx).map(r => r.id)).toEqual(['a'])
    expect(filterRegister(rows, { q: 'سامر' }, ctx).map(r => r.id)).toEqual(['a', 'c'])
    expect(filterRegister(rows, { q: 'حشوه' }, ctx).map(r => r.id)).toEqual(['a'])     // ة/ه insensitive
    expect(filterRegister(rows, { q: '16' }, ctx).map(r => r.id)).toEqual(['a'])
    expect(sortByDateDesc(rows).map(r => r.id)).toEqual(['c', 'b', 'a'])
    expect(groupByPatient(sortByDateDesc(rows)).map(g => [g.patientId, g.items.map(i => i.id)])).toEqual([['p1', ['c', 'a']], ['p2', ['b']]])
  })
  it('toCSV quotes and starts with a BOM', () => {
    const csv = toCSV([['a', 'b,c'], ['"q"', 3]])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.slice(1)).toBe('a,"b,c"\r\n"""q""",3')
  })
  it('toCSV defuses text a spreadsheet would run as a formula (numbers stay numbers)', () => {
    expect(toCSV([['=HYPERLINK("x")', '+1', '@a', -5, 'سامر']]).slice(1)).toBe(`"'=HYPERLINK(""x"")",'+1,'@a,-5,سامر`)
  })
})

describe('plan titles and lists', () => {
  it('uniqueTitle adds (2), (3)… when the title is taken', () => {
    expect(uniqueTitle('خطة علاج — 10 تشرين الأول 2026', [])).toBe('خطة علاج — 10 تشرين الأول 2026')
    expect(uniqueTitle('Plan', ['Plan'])).toBe('Plan (2)')
    expect(uniqueTitle('Plan', ['Plan', 'Plan (2)', 'Other'])).toBe('Plan (3)')
  })
  it('listSep follows the language', () => {
    expect([16, 26].join(listSep('ar'))).toBe('16، 26')
    expect([16, 26].join(listSep('en'))).toBe('16, 26')
  })
})

describe('i18n', () => {
  it('ar and en have the same keys; Arabic plurals resolve', () => {
    const base = (d: Record<string, string>) => [...new Set(Object.keys(d).map(k => k.replace(/_(zero|one|two|few|many|other)$/, '')))].sort()
    expect(base(ar.ar)).toEqual(base(ar.en))
    for (const d of [ar.ar, ar.en]) for (const k of Object.keys(d)) if (/_(zero|one|two|few|many)$/.test(k)) expect(d[k.replace(/_[a-z]+$/, '_other')]).toBeTruthy()
    const t = (k: string, p?: Record<string, string | number>) => translate('ar', k, p)
    expect(tn(t, 'ar', 'treatments.n.items', 1)).toBe('بند واحد')
    expect(tn(t, 'ar', 'treatments.n.items', 2)).toBe('بندان')
    expect(tn(t, 'ar', 'treatments.n.items', 5)).toBe('5 بنود')
    expect(tn(t, 'ar', 'treatments.n.items', 11)).toBe('11 بنداً')
    expect(tn(t, 'ar', 'treatments.n.items', 100)).toBe('100 بند')
    const te = (k: string, p?: Record<string, string | number>) => translate('en', k, p)
    // every counted string stays Arabic for every Arabic plural form (no fallback to the English '_one')
    const counted = [...new Set(Object.keys(ar.en).filter(k => /_(one|other)$/.test(k)).map(k => k.replace(/_(one|other)$/, '')))]
    for (const base of counted) for (const n of [0, 1, 2, 3, 11, 100]) expect(tn(t, 'ar', `treatments.${base}`, n)).not.toMatch(/[A-Za-z]/)
    expect(tn(te, 'en', 'treatments.n.items', 1)).toBe('1 item')
    expect(tn(te, 'en', 'treatments.n.items', 3)).toBe('3 items')
  })
})

// ---- database actions ---------------------------------------------------------------------------
describe('actions (database)', () => {
  const proc = { id: 'pr-fill', name: 'حشوة كومبوزيت', nameEn: 'Composite filling' }
  beforeEach(async () => {
    await resetDatabase()
    await updateClinic({ taxPercent: 0, invoicePrefix: 'INV-', nextInvoiceNumber: 7 })
    await db.procedures.put({ ...proc, category: 'restorative', price: 50, toothSpecific: true, active: true, createdAt: NOW, updatedAt: NOW })
  })

  it('adds one item per tooth into a new plan and derives the plan status', async () => {
    const { items, planId } = await addItems('p1', { procedure: proc, procedureName: proc.name, teeth: [16, 26], surfaces: ['O'], price: 50, discount: 5 }, { create: { title: 'خطة' } })
    expect(items).toHaveLength(2)
    expect(items.map(i => i.tooth)).toEqual([16, 26])
    expect(items.every(i => i.planId === planId && i.status === 'planned' && i.surfaces?.[0] === 'O')).toBe(true)
    expect((await db.plans.get(planId!))?.status).toBe('draft')

    await approvePlan(planId!)
    expect((await db.plans.get(planId!))?.status).toBe('approved')
    await setItemStatus(items[0].id, 'in_progress')
    expect((await db.plans.get(planId!))?.status).toBe('in_progress')
    const done = await setItemStatus(items[0].id, 'completed')
    expect(done?.completedAt).toBeTruthy()
    await setItemStatus(items[1].id, 'completed')
    expect((await db.plans.get(planId!))?.status).toBe('completed')
    await setItemStatus(items[1].id, 'in_progress')
    expect((await db.treatments.get(items[1].id))?.completedAt).toBeUndefined()
    expect((await db.plans.get(planId!))?.status).toBe('in_progress')
  })

  it('bills completed work: invoice number, lines, links, totals with tax', async () => {
    await updateClinic({ taxPercent: 5 })
    const { items } = await addItems('p1', { procedure: proc, procedureName: proc.name, teeth: [36, 46], price: 100, discount: 20, status: 'completed', doctorId: 'u1' })
    const inv = await billItems('p1', items.map(i => i.id), 'u1')
    expect(inv.number).toBe('INV-000007')
    expect(inv).toMatchObject({ patientId: 'p1', doctorId: 'u1', subtotal: 160, tax: 8, total: 168, paid: 0, status: 'unpaid', createdBy: 'u1', taxPercent: 5 })
    expect(inv.items.map(l => [l.tooth, l.unitPrice, l.discount, l.total])).toEqual([[36, 100, 20, 80], [46, 100, 20, 80]])
    expect((await db.invoices.get(inv.id))?.items).toHaveLength(2)
    const linked = await db.treatments.bulkGet(items.map(i => i.id))
    expect(linked.every(i => i?.invoiceId === inv.id)).toBe(true)
    // billed work is locked
    expect(await deleteItem(items[0].id)).toBe(false)
    expect((await setItemStatus(items[0].id, 'in_progress'))?.status).toBe('completed')
    const edited = await updateItem(items[0].id, { price: 1, notes: ' ملاحظة ' })
    expect(edited?.price).toBe(100)
    expect(edited?.notes).toBe('ملاحظة')
    await expect(billItems('p1', items.map(i => i.id))).rejects.toThrow('nothing-to-bill')
  })

  it('cancelling and deleting plans keeps completed work', async () => {
    const plan = await createPlan('p1', { title: 'خطة' })
    const { items } = await addItems('p1', { procedure: proc, procedureName: proc.name, teeth: [11, 12, 13], price: 40, discount: 0 }, { id: plan.id })
    await setItemStatus(items[0].id, 'completed')
    expect(await cancelPlan(plan.id)).toBe(2)
    expect((await db.plans.get(plan.id))?.status).toBe('cancelled')
    expect((await db.treatments.get(items[1].id))?.status).toBe('cancelled')
    const r = await deletePlan(plan.id)
    expect(r).toEqual({ deleted: 2, kept: 1 })
    const kept = await db.treatments.get(items[0].id)
    expect(kept?.planId).toBeUndefined()
    expect(await db.plans.count()).toBe(0)
  })

  it('updates the dental chart: a crown replaces old fillings on that tooth', async () => {
    await db.teeth.bulkPut([
      { id: 'r1', patientId: 'p1', tooth: 16, surfaces: ['O'], condition: 'caries', active: true, recordedAt: NOW },
      { id: 'r2', patientId: 'p1', tooth: 16, surfaces: ['M'], condition: 'filled', active: true, recordedAt: NOW },
      { id: 'r3', patientId: 'p1', tooth: 17, surfaces: ['O'], condition: 'caries', active: true, recordedAt: NOW },
    ])
    expect(await applyChartEntries('p1', [{ tooth: 16, condition: 'crown', surfaces: [], treatmentItemId: 'tx' }], 'u1')).toBe(1)
    const rows = await db.teeth.where('[patientId+tooth]').equals(['p1', 16]).toArray()
    expect(rows.filter(r => r.active).map(r => r.condition)).toEqual(['crown'])
    expect(rows.find(r => r.condition === 'crown')).toMatchObject({ treatmentItemId: 'tx', recordedBy: 'u1', surfaces: [] })
    expect((await db.teeth.get('r3'))?.active).toBe(true)
    // a filling on O replaces the caries on O only
    await applyChartEntries('p1', [{ tooth: 17, condition: 'filled', surfaces: ['O'] }])
    expect((await db.teeth.get('r3'))?.active).toBe(false)
  })

  it('restoring an item of a cancelled plan brings the plan back', async () => {
    const plan = await createPlan('p1', { title: 'خطة' })
    const { items } = await addItems('p1', { procedure: proc, procedureName: proc.name, teeth: [11, 12], price: 40, discount: 0 }, { id: plan.id })
    await approvePlan(plan.id)
    await setItemStatus(items[0].id, 'completed')
    await cancelPlan(plan.id)
    expect((await db.plans.get(plan.id))?.status).toBe('cancelled')
    await setItemStatus(items[1].id, 'planned')
    expect((await db.plans.get(plan.id))?.status).toBe('in_progress')
    // a completed, unbilled item can be cancelled directly; completedAt goes with it
    const c = await setItemStatus(items[0].id, 'cancelled')
    expect(c?.status).toBe('cancelled')
    expect(c?.completedAt).toBeUndefined()
  })

  it('deleting items unlinks lab orders, appointments and chart findings', async () => {
    const plan = await createPlan('p1', { title: 'خطة' })
    const { items } = await addItems('p1', { procedure: proc, procedureName: proc.name, teeth: [16, 26], price: 50, discount: 0 }, { id: plan.id })
    const [a, b] = items
    await db.labOrders.put({ id: 'lab', patientId: 'p1', labName: 'L', type: 'crown', teeth: [16], status: 'draft', cost: 0, treatmentItemId: a.id, createdAt: NOW, updatedAt: NOW } as never)
    await db.appointments.put({ id: 'apt', patientId: 'p1', doctorId: 'u1', date: '2026-10-11', start: '10:00', end: '10:30', type: 'treatment', status: 'scheduled', treatmentItemIds: [a.id, b.id], createdAt: NOW, updatedAt: NOW } as never)
    await db.teeth.put({ id: 'r', patientId: 'p1', tooth: 16, surfaces: ['O'], condition: 'filled', active: true, recordedAt: NOW, treatmentItemId: a.id })
    expect(await deleteItem(a.id)).toBe(true)
    expect((await db.labOrders.get('lab'))?.treatmentItemId).toBeUndefined()
    expect((await db.appointments.get('apt'))?.treatmentItemIds).toEqual([b.id])
    expect((await db.teeth.get('r'))).toMatchObject({ active: true, condition: 'filled' })
    expect((await db.teeth.get('r'))?.treatmentItemId).toBeUndefined()
    await deletePlan(plan.id)
    expect((await db.appointments.get('apt'))?.treatmentItemIds).toBeUndefined()
  })

  it('the default catalogue loads procedures only', async () => {
    await db.procedures.clear()
    const n = await loadDefaultCatalogue()
    expect(n).toBeGreaterThan(30)
    expect(await db.drugs.count()).toBe(0)
    expect(await db.inventory.count()).toBe(0)
    expect(await loadDefaultCatalogue()).toBe(0)                           // idempotent
  })

  it('procedures: save, usage blocks delete, bulk price', async () => {
    const p = await saveProcedure({ name: ' تاج زيركون ', category: 'prosthodontic', price: 300, toothSpecific: true, active: true, code: 'D2740' })
    expect(p.name).toBe('تاج زيركون')
    expect(p.sortOrder).toBeGreaterThan(0)
    await addItems('p1', { procedure: { id: p.id, name: p.name }, procedureName: p.name, teeth: [], price: 300, discount: 0 })
    expect(await procedureUsage(p.id)).toBe(1)
    expect(await deleteProcedure(p.id)).toBe(false)
    expect(await deleteProcedure('pr-fill')).toBe(true)
    expect(await applyBulkPrice([p.id], { mode: 'percent', value: 10, round: 0 })).toBe(1)
    expect((await db.procedures.get(p.id))?.price).toBe(330)
  })
})
