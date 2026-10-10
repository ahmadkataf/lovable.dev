import type { Drug, LabOrder, Patient, Prescription, PrescriptionItem } from '../src/db/types'
import {
  DURATION_DAYS, FREQUENCY_PRESETS, INSTRUCTION_PRESETS, buildRxText, draftsToItems, duplicateItems, durationLabel, durationPresets, emptyItem, filterPrescriptions,
  hasErrors, isBlankItem, itemFromDrug, itemTitle, itemToDraft, itemsSummary, presetRange, regimenLine, searchDrugs, sortPrescriptions, validatePrescription,
} from '../src/features/prescriptions/lib'
import {
  DEFAULT_LAB_DAYS, FDI_LOWER, FDI_UPPER, LAB_FLOW, LAB_MATERIALS, STATUS_FILTERS, VITA_SHADES, archOf, defaultDueDate, filterOrders, isAtLab, isDueThisWeek, isFdiTooth,
  isOpen, isOverdue, isPending, labCostInMonth, labNames, labStats, nextStatus, sortOrders, sortTeeth, statusCounts, statusPatch, teethLabel, toggleTooth, usedValues,
} from '../src/features/lab/lib'
import ar from '../src/i18n/modules/prescriptions'
import labDict from '../src/i18n/modules/lab'

const TODAY = '2026-10-10'

// ---------------------------------------------------------------------------------------------------
// prescriptions
// ---------------------------------------------------------------------------------------------------

const drug = (p: Partial<Drug>): Drug => ({ id: 'd', name: 'أموكسيسيلين', nameEn: 'Amoxicillin', form: 'كبسولات', strength: '500 mg', defaultDose: 'كبسولة واحدة', defaultFrequency: 'كل 8 ساعات', defaultDuration: '5 أيام', defaultInstructions: 'بعد الطعام', active: true, createdAt: '2026-01-01T00:00:00.000Z', ...p })
const item = (p: Partial<PrescriptionItem>): PrescriptionItem => ({ id: 'i', name: 'Ibuprofen', dose: '1 tab', frequency: 'Every 8 hours', duration: '3 days', ...p })
const rx = (p: Partial<Prescription>): Prescription => ({ id: 'r', patientId: 'p1', doctorId: 'u1', date: TODAY, items: [item({})], createdAt: `${TODAY}T08:00:00.000Z`, updatedAt: `${TODAY}T08:00:00.000Z`, ...p })

describe('prescriptions: presets', () => {
  it('offers the common Arabic and English patterns', () => {
    for (const s of ['مرة يومياً', 'مرتين يومياً', 'كل 8 ساعات', 'كل 6 ساعات', 'عند اللزوم']) expect(FREQUENCY_PRESETS.ar).toContain(s)
    expect(FREQUENCY_PRESETS.en).toContain('Twice daily')
    expect(FREQUENCY_PRESETS.ar.length).toBe(FREQUENCY_PRESETS.en.length)
    expect(INSTRUCTION_PRESETS.ar.length).toBe(INSTRUCTION_PRESETS.en.length)
    expect(INSTRUCTION_PRESETS.ar).toContain('بعد الطعام')
  })
  it('durations 3/5/7/10/14 days with correct Arabic number agreement', () => {
    expect([...DURATION_DAYS]).toEqual([3, 5, 7, 10, 14])
    expect(durationLabel(3, 'ar')).toBe('3 أيام')
    expect(durationLabel(10, 'ar')).toBe('10 أيام')
    expect(durationLabel(14, 'ar')).toBe('14 يوماً')
    expect(durationLabel(2, 'ar')).toBe('يومان')
    expect(durationLabel(1, 'en')).toBe('1 day')
    expect(durationLabel(7, 'en')).toBe('7 days')
    expect(durationPresets('ar')).toEqual(['3 أيام', '5 أيام', '7 أيام', '10 أيام', '14 يوماً', 'عند اللزوم'])
    expect(durationPresets('en')[0]).toBe('3 days')
  })
})

describe('prescriptions: items', () => {
  it('fills a row from the catalogue defaults in the working language', () => {
    const d = drug({ id: 'amx' })
    const a = itemFromDrug(d, 'ar')
    expect(a).toMatchObject({ drugId: 'amx', name: 'أموكسيسيلين', strength: '500 mg', dose: 'كبسولة واحدة', frequency: 'كل 8 ساعات', duration: '5 أيام', instructions: 'بعد الطعام' })
    expect(itemFromDrug(d, 'en').name).toBe('Amoxicillin')
    expect(itemFromDrug(drug({ nameEn: undefined }), 'en').name).toBe('أموكسيسيلين')
    expect(itemFromDrug(drug({ defaultDose: undefined }), 'ar').dose).toBe('')
    expect(a.key).toBeTruthy()
    expect(itemFromDrug(d, 'ar').key).not.toBe(a.key)
  })
  it('drops blank rows, trims and omits empty optional fields', () => {
    const rows = [
      { ...emptyItem(), name: '  Paracetamol ', strength: ' 500 mg ', dose: '1', frequency: 'q6h', duration: '', instructions: '  ' },
      emptyItem(),
      { ...emptyItem('Chlorhexidine'), drugId: 'chx' },
    ]
    expect(isBlankItem(rows[1])).toBe(true)
    expect(isBlankItem(rows[0])).toBe(false)
    const out = draftsToItems(rows)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ id: rows[0].key, name: 'Paracetamol', strength: '500 mg', dose: '1', frequency: 'q6h', duration: '' })
    expect(out[1]).toMatchObject({ drugId: 'chx', name: 'Chlorhexidine' })
    expect('instructions' in out[0]).toBe(false)
  })
  it('round-trips items through drafts and duplicates with fresh ids', () => {
    const it0 = item({ id: 'x1', drugId: 'd1', strength: '400 mg', instructions: 'After meals' })
    const back = draftsToItems([itemToDraft(it0)])[0]
    expect({ ...back, id: 'x1' }).toEqual(it0)
    const dup = duplicateItems([it0, item({ id: 'x2' })])
    expect(dup.map(d => d.id)).not.toContain('x1')
    expect(dup[0]).toEqual({ ...it0, id: dup[0].id })
    expect(new Set(dup.map(d => d.id)).size).toBe(2)
  })
  it('validates patient, doctor, date, items and row names', () => {
    const named = { ...emptyItem('Amoxicillin') }
    const nameless = { ...emptyItem(), dose: '1 cap' }
    expect(hasErrors(validatePrescription({ patientId: 'p', doctorId: 'u', date: TODAY, items: [named] }))).toBe(false)
    const e = validatePrescription({ patientId: '', doctorId: '', date: '10/10/2026', items: [emptyItem()] })
    expect(e).toMatchObject({ patient: true, doctor: true, date: true, items: true, names: [] })
    const e2 = validatePrescription({ patientId: 'p', doctorId: 'u', date: TODAY, items: [named, nameless, emptyItem()] })
    expect(e2.items).toBeFalsy()
    expect(e2.names).toEqual([nameless.key])
    expect(hasErrors(e2)).toBe(true)
  })
  it('summarises the first two names with +N', () => {
    expect(itemsSummary([item({ name: 'A' }), item({ name: 'B' }), item({ name: 'C' }), item({ name: 'D' })])).toEqual({ names: ['A', 'B'], more: 2 })
    expect(itemsSummary([item({ name: 'A' })])).toEqual({ names: ['A'], more: 0 })
    expect(itemsSummary([])).toEqual({ names: [], more: 0 })
  })
  it('titles and regimen lines', () => {
    expect(itemTitle({ name: 'Amoxicillin', strength: '500 mg' })).toBe('Amoxicillin 500 mg')
    expect(itemTitle({ name: 'Amoxicillin 500 mg', strength: '500 mg' })).toBe('Amoxicillin 500 mg')
    expect(itemTitle({ name: 'Ibuprofen' })).toBe('Ibuprofen')
    expect(regimenLine({ dose: '1 tab', frequency: '', duration: '3 days' })).toBe('1 tab — 3 days')
    expect(regimenLine({ dose: '', frequency: '', duration: '' })).toBe('')
  })
  it('searches active drugs in both languages, Arabic-aware, prefix matches first', () => {
    const list = [
      drug({ id: 'a', name: 'إيبوبروفين', nameEn: 'Ibuprofen', strength: '400 mg' }),
      drug({ id: 'b', name: 'أموكسيسيلين', nameEn: 'Amoxicillin' }),
      drug({ id: 'c', name: 'ديكلوفيناك', nameEn: 'Diclofenac', active: false }),
      drug({ id: 'd', name: 'كلورهيكسيدين غسول', nameEn: 'Chlorhexidine mouthwash', form: 'غسول فموي', strength: '0.12%' }),
    ]
    expect(searchDrugs(list, 'amox').map(d => d.id)).toEqual(['b'])
    expect(searchDrugs(list, 'اموكسي').map(d => d.id)).toEqual(['b'])   // hamza-insensitive
    expect(searchDrugs(list, 'diclo')).toEqual([])                        // inactive is hidden
    expect(searchDrugs(list, 'غسول').map(d => d.id)).toEqual(['d'])
    expect(searchDrugs(list, 'ibu 400').map(d => d.id)).toEqual(['a'])
    expect(searchDrugs(list, '').length).toBe(3)
    expect(searchDrugs(list, '', 2).length).toBe(2)
  })
})

describe('prescriptions: list filters and text', () => {
  const patients = new Map<string, Patient>([['p1', { id: 'p1', fileNo: 12, name: 'محمد الأحمد', gender: 'male', allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: '', updatedAt: '' }]])
  it('date presets', () => {
    expect(presetRange('all', TODAY)).toBeNull()
    expect(presetRange('today', TODAY)).toEqual({ from: TODAY, to: TODAY })
    expect(presetRange('last7', TODAY)).toEqual({ from: '2026-10-04', to: TODAY })
    expect(presetRange('last30', TODAY)).toEqual({ from: '2026-09-11', to: TODAY })
    expect(presetRange('thisMonth', TODAY)).toEqual({ from: '2026-10-01', to: TODAY })
  })
  it('filters by patient name, file number, drug and date; sorts newest first', () => {
    const list = [rx({ id: 'a', date: '2026-10-09' }), rx({ id: 'b', date: '2026-09-01', patientId: 'p2' }), rx({ id: 'c', date: TODAY, items: [item({ name: 'Amoxicillin' })] })]
    const f = (q: string, preset: Parameters<typeof filterPrescriptions>[1]['preset'] = 'all') => filterPrescriptions(list, { q, preset, today: TODAY, patients }).map(p => p.id)
    expect(f('محمد')).toEqual(['a', 'c'])
    expect(f('#12')).toEqual(['a', 'c'])
    expect(f('amoxi')).toEqual(['c'])
    expect(f('', 'today')).toEqual(['c'])
    expect(f('', 'last7')).toEqual(['a', 'c'])
    expect(sortPrescriptions(list).map(p => p.id)).toEqual(['c', 'a', 'b'])
  })
  it('builds the WhatsApp text with numbered items and skips empty parts', () => {
    const text = buildRxText({
      clinicName: 'عيادة الابتسامة', clinicPhone: '0944 123 456', doctorName: 'د. أحمد', patientName: 'محمد', dateLabel: '10 تشرين الأول 2026', diagnosis: 'التهاب لب حاد',
      notes: '', footer: 'نتمنى لكم الشفاء', labels: { title: 'وصفة طبية', patient: 'المريض', doctor: 'الطبيب', diagnosis: 'التشخيص', notes: 'ملاحظات' },
      items: [item({ name: 'أموكسيسيلين', strength: '500 mg', dose: 'كبسولة', frequency: 'كل 8 ساعات', duration: '5 أيام', instructions: 'بعد الطعام' }), item({ name: 'Ibuprofen', dose: '', frequency: '', duration: '' })],
    })
    const lines = text.split('\n')
    expect(lines[0]).toBe('*عيادة الابتسامة*')
    expect(lines[1]).toBe('وصفة طبية — 10 تشرين الأول 2026')
    expect(text).toContain('المريض: محمد')
    expect(text).toContain('التشخيص: التهاب لب حاد')
    expect(text).toContain('1. *أموكسيسيلين 500 mg*\n   كبسولة — كل 8 ساعات — 5 أيام\n   بعد الطعام')
    expect(text).toContain('2. *Ibuprofen*')
    expect(text).not.toContain('ملاحظات')
    expect(text).not.toMatch(/\n{3,}/)
    expect(text.endsWith('0944 123 456')).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------------
// lab
// ---------------------------------------------------------------------------------------------------

const order = (p: Partial<LabOrder>): LabOrder => ({ id: 'o', patientId: 'p1', labName: 'مخبر الشام', type: 'crown', teeth: [16], status: 'sent', cost: 50, sentDate: '2026-10-01', dueDate: '2026-10-08', createdAt: '2026-10-01T09:00:00.000Z', updatedAt: '2026-10-01T09:00:00.000Z', ...p })

describe('lab: status flow', () => {
  it('advances sent → in_progress → received → fitted', () => {
    expect(nextStatus('draft')).toBe('sent')
    expect(nextStatus('sent')).toBe('in_progress')
    expect(nextStatus('in_progress')).toBe('received')
    expect(nextStatus('received')).toBe('fitted')
    expect(nextStatus('fitted')).toBeNull()
    expect(nextStatus('cancelled')).toBeNull()
    expect(nextStatus('remake')).toBe('received')
    expect(LAB_FLOW).toEqual(['draft', 'sent', 'in_progress', 'received', 'fitted'])
  })
  it('classifies orders', () => {
    expect(isPending(order({ status: 'remake' }))).toBe(true)
    expect(isPending(order({ status: 'received' }))).toBe(false)
    expect(isAtLab(order({ status: 'draft' }))).toBe(false)
    expect(isOpen(order({ status: 'received' }))).toBe(true)
    expect(isOpen(order({ status: 'fitted' }))).toBe(false)
    expect(isOpen(order({ status: 'cancelled' }))).toBe(false)
  })
  it('overdue only when the due date passed and the work is not back', () => {
    expect(isOverdue(order({ dueDate: '2026-10-09' }), TODAY)).toBe(true)
    expect(isOverdue(order({ dueDate: TODAY }), TODAY)).toBe(false)
    expect(isOverdue(order({ dueDate: '2026-10-01', status: 'received' }), TODAY)).toBe(false)
    expect(isOverdue(order({ dueDate: '2026-10-01', status: 'fitted' }), TODAY)).toBe(false)
    expect(isOverdue(order({ dueDate: '2026-10-01', status: 'remake' }), TODAY)).toBe(true)
    expect(isOverdue(order({ dueDate: undefined }), TODAY)).toBe(false)
  })
  it('due this week = today … today+6, pending only', () => {
    expect(isDueThisWeek(order({ dueDate: TODAY }), TODAY)).toBe(true)
    expect(isDueThisWeek(order({ dueDate: '2026-10-16' }), TODAY)).toBe(true)
    expect(isDueThisWeek(order({ dueDate: '2026-10-17' }), TODAY)).toBe(false)
    expect(isDueThisWeek(order({ dueDate: '2026-10-09' }), TODAY)).toBe(false)
    expect(isDueThisWeek(order({ dueDate: '2026-10-12', status: 'received' }), TODAY)).toBe(false)
  })
  it('default due date is sent + 7 days, across month ends', () => {
    expect(DEFAULT_LAB_DAYS).toBe(7)
    expect(defaultDueDate('2026-10-10')).toBe('2026-10-17')
    expect(defaultDueDate('2026-12-28')).toBe('2027-01-04')
    expect(defaultDueDate('2026-10-10', 10)).toBe('2026-10-20')
  })
  it('status changes set and clear the dates', () => {
    expect(statusPatch(order({}), 'received', TODAY)).toEqual({ status: 'received', receivedDate: TODAY })
    expect(statusPatch(order({ receivedDate: '2026-10-05' }), 'fitted', TODAY)).toEqual({ status: 'fitted', receivedDate: '2026-10-05' })
    expect(statusPatch(order({ receivedDate: undefined }), 'fitted', TODAY).receivedDate).toBe(TODAY)
    const remake = statusPatch(order({ receivedDate: '2026-10-05', dueDate: '2026-10-08' }), 'remake', TODAY)
    expect(remake).toMatchObject({ status: 'remake', receivedDate: undefined, dueDate: '2026-10-17' })
    expect('receivedDate' in remake).toBe(true)
    expect(statusPatch(order({ dueDate: '2026-10-20' }), 'remake', TODAY).dueDate).toBeUndefined()
    expect(statusPatch(order({ sentDate: undefined, dueDate: undefined, status: 'draft' }), 'sent', TODAY)).toMatchObject({ status: 'sent', sentDate: TODAY, dueDate: '2026-10-17' })
    expect(statusPatch(order({}), 'cancelled', TODAY)).toEqual({ status: 'cancelled' })
  })
})

describe('lab: board', () => {
  const list = [
    order({ id: 'a', status: 'sent', dueDate: '2026-10-08', labName: 'مخبر الشام', doctorId: 'u1' }),             // overdue
    order({ id: 'b', status: 'in_progress', dueDate: '2026-10-12', labName: 'مخبر الشام ', doctorId: 'u2' }),     // due this week
    order({ id: 'c', status: 'received', dueDate: '2026-10-09', receivedDate: '2026-10-09', labName: 'Digital Lab', cost: 70 }),
    order({ id: 'd', status: 'fitted', dueDate: '2026-09-20', sentDate: '2026-09-12', labName: 'Digital Lab', cost: 100, updatedAt: '2026-09-25T10:00:00.000Z' }),
    order({ id: 'e', status: 'cancelled', labName: 'مخبر النخبة', cost: 400 }),
    order({ id: 'f', status: 'draft', sentDate: undefined, dueDate: '2026-10-25', labName: '', cost: 30, createdAt: '2026-10-09T09:00:00.000Z' }),
  ]
  it('counts per status and the segment list', () => {
    const c = statusCounts(list)
    expect(c).toMatchObject({ all: 6, sent: 1, in_progress: 1, received: 1, fitted: 1, cancelled: 1, draft: 1, remake: 0 })
    expect(STATUS_FILTERS).toEqual(['all', 'sent', 'in_progress', 'received', 'fitted', 'remake', 'cancelled', 'draft'])
  })
  it('lists lab names by use, normalised', () => {
    expect(labNames(list)).toEqual(['Digital Lab', 'مخبر الشام', 'مخبر النخبة'])
    expect(usedValues([{ m: 'Zirconia' }, { m: 'zirconia' }, { m: 'e.max' }, { m: undefined }], r => r.m)).toEqual(['Zirconia', 'e.max'])
  })
  it('stats: open, at lab, ready, due this week, overdue, month cost', () => {
    expect(labStats(list, TODAY)).toEqual({ open: 4, atLab: 2, ready: 1, dueWeek: 1, overdue: 1, monthCost: 50 + 50 + 70 })
    expect(labCostInMonth(list, '2026-09-15')).toBe(100)
  })
  it('filters by status, lab, doctor, due preset and search', () => {
    const f = (x: Partial<Parameters<typeof filterOrders>[1]>) => filterOrders(list, { status: 'all', today: TODAY, patientName: id => (id === 'p1' ? 'سامر حداد' : undefined), ...x }).map(o => o.id)
    expect(f({ status: 'received' })).toEqual(['c'])
    expect(f({ lab: 'مخبر الشام' })).toEqual(['a', 'b'])
    expect(f({ doctorId: 'u2' })).toEqual(['b'])
    expect(f({ due: 'overdue' })).toEqual(['a'])
    expect(f({ due: 'week' })).toEqual(['b'])
    expect(f({ q: 'سامر' }).length).toBe(6)
    expect(f({ q: '16' }).length).toBe(6)
    expect(f({ q: 'digital' })).toEqual(['c', 'd'])
  })
  it('sorts overdue first, then pending by due date, then ready, then the rest', () => {
    expect(sortOrders(list, TODAY).map(o => o.id)).toEqual(['a', 'b', 'f', 'c', 'e', 'd'])
  })
})

describe('lab: teeth, shades, materials', () => {
  it('FDI picker rows', () => {
    expect(FDI_UPPER).toEqual([18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28])
    expect(FDI_LOWER).toEqual([48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38])
    expect(isFdiTooth(11)).toBe(true)
    expect(isFdiTooth(19)).toBe(false)
    expect(isFdiTooth(55)).toBe(true)
    expect(isFdiTooth(56)).toBe(false)
  })
  it('toggles and sorts teeth', () => {
    expect(toggleTooth([21, 11], 12)).toEqual([11, 12, 21])
    expect(toggleTooth([11, 12, 21], 12)).toEqual([11, 21])
    expect(sortTeeth([36, 11, 36, 99])).toEqual([11, 36])
    expect(teethLabel([21, 11], 'en')).toBe('11, 21')
    expect(teethLabel([21, 11], 'ar')).toBe('11، 21')
    expect(archOf([11, 21])).toBe('upper')
    expect(archOf([36])).toBe('lower')
    expect(archOf([16, 46])).toBe('both')
    expect(archOf([])).toBeNull()
  })
  it('VITA shades A1–D4 and BL1–BL4; bilingual materials', () => {
    expect(VITA_SHADES[0]).toBe('A1')
    expect(VITA_SHADES).toContain('A3.5')
    expect(VITA_SHADES).toContain('D4')
    expect(VITA_SHADES.slice(-4)).toEqual(['BL1', 'BL2', 'BL3', 'BL4'])
    expect(LAB_MATERIALS.ar.length).toBe(LAB_MATERIALS.en.length)
    expect(LAB_MATERIALS.en.some(m => /zirconia/i.test(m))).toBe(true)
  })
})

describe('rxlab: dictionaries', () => {
  it('ar and en have the same keys', () => {
    for (const d of [ar, labDict]) {
      expect(Object.keys(d.ar).length).toBeGreaterThan(20)
      expect(Object.keys(d.en).sort()).toEqual(Object.keys(d.ar).sort())
      for (const v of [...Object.values(d.ar), ...Object.values(d.en)]) expect(v.trim()).not.toBe('')
    }
  })
})

describe('rxlab: every key used in the code exists', () => {
  it('finds t("prescriptions.*") and t("lab.*") keys in the dictionaries (lab statuses come from common)', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const common = (await import('../src/i18n/common')).default
    const root = path.resolve(__dirname, '../src/features')
    const files = ['prescriptions', 'lab'].flatMap(d => fs.readdirSync(path.join(root, d)).filter((f: string) => f.endsWith('.tsx') || f.endsWith('.ts')).map((f: string) => path.join(root, d, f)))
    const missing: string[] = []
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8')
      for (const m of src.matchAll(/['"](prescriptions|lab)\.([A-Za-z_][A-Za-z_.]*)['"]/g)) {
        const [, ns, key] = m
        const dict = ns === 'lab' ? labDict : ar
        if (!(key in dict.ar) && !(`${ns}.${key}` in common.ar)) missing.push(`${ns}.${key}`)
      }
    }
    for (const s of ['sent', 'in_progress', 'received', 'fitted']) expect(labDict.ar[`advance.${s}`]).toBeTruthy()
    for (const k of ['act.created', 'act.updated', 'toast.created', 'toast.updated']) { expect(labDict.ar[k]).toBeTruthy(); expect(ar.ar[k]).toBeTruthy() }
    expect(missing).toEqual([])
    // the module must not shadow the shared status names
    for (const s of ['draft', 'sent', 'in_progress', 'received', 'fitted', 'remake', 'cancelled']) expect(s in labDict.ar).toBe(false)
  })
})
