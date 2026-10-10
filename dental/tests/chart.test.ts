import type { ToothCondition, ToothRecord, ToothSurface } from '../src/db/types'
import {
  ADULT_TEETH, CONDITION_META, PRIMARY_TEETH, ROWS, SURFACE_CONDITIONS, WHOLE_CONDITIONS, areNeighbours, isPrimary, isValidTooth, neighbours, normalizeSurfaces,
  toothInfo, toothLabel, toothsOf,
} from '../src/features/chart/teeth'
import {
  activeRecords, applyPlan, bridgeLinks, bridgeSpans, chartSummary, chartView, conditionCounts, dentitionForAge, findingsTable, inDentition, isEmptyPlan,
  planPaint, planRecord, planRestore, supersedes, surfaceCode, timeline, validateDraft, type WritePlan,
} from '../src/features/chart/lib'

import fs from 'node:fs'
import path from 'node:path'
import chartDict from '../src/i18n/modules/chart'

let seq = 0
const rec = (tooth: number, condition: ToothCondition, surfaces: ToothSurface[] = [], p: Partial<ToothRecord> = {}): ToothRecord => ({
  id: `r${String(++seq).padStart(4, '0')}`, patientId: 'p1', tooth, surfaces, condition, active: true, recordedAt: `2026-10-${String(1 + (seq % 28)).padStart(2, '0')}T10:00:00.000Z`, ...p,
})
/** Applies a plan and returns the active conditions of a tooth as "cond:SURF" strings, sorted. */
const apply = (rows: ToothRecord[], plan: WritePlan) => applyPlan(rows, plan, (r, i) => ({ ...r, id: `n${++seq}-${i}`, patientId: 'p1', recordedAt: '2026-10-30T00:00:00.000Z' }))
const state = (rows: ToothRecord[], tooth: number) => activeRecords(rows, tooth).map(r => `${r.condition}${r.surfaces.length ? ':' + r.surfaces.join('') : ''}`).sort()

describe('teeth: numbering and metadata', () => {
  it('knows every FDI tooth and nothing else', () => {
    expect(ADULT_TEETH).toHaveLength(32)
    expect(PRIMARY_TEETH).toHaveLength(20)
    expect(new Set([...ADULT_TEETH, ...PRIMARY_TEETH]).size).toBe(52)
    for (const n of [11, 18, 28, 38, 48, 51, 55, 65, 75, 85]) expect(isValidTooth(n)).toBe(true)
    for (const n of [0, 10, 19, 49, 56, 66, 90, 9, 11.5]) expect(isValidTooth(n)).toBe(false)
    expect(isPrimary(55)).toBe(true); expect(isPrimary(16)).toBe(false); expect(isPrimary(99)).toBe(false)
  })
  it('rows read like a paper chart: patient right on the viewer left', () => {
    expect(ROWS.upperAdult.slice(0, 3)).toEqual([18, 17, 16])
    expect(ROWS.upperAdult.slice(6, 10)).toEqual([12, 11, 21, 22])
    expect(ROWS.lowerAdult.slice(6, 10)).toEqual([42, 41, 31, 32])
    expect(ROWS.upperPrimary).toEqual([55, 54, 53, 52, 51, 61, 62, 63, 64, 65])
    expect(ROWS.lowerPrimary).toEqual([85, 84, 83, 82, 81, 71, 72, 73, 74, 75])
    expect(toothsOf('adult')).toHaveLength(32)
    expect(toothsOf('primary')).toHaveLength(20)
    expect(toothsOf('mixed')).toHaveLength(52)
  })
  it('quadrant, arch, side and type', () => {
    expect(toothInfo(16)).toMatchObject({ quadrant: 1, arch: 'upper', side: 'right', type: 'molar', pos: 6, primary: false })
    expect(toothInfo(23)).toMatchObject({ quadrant: 2, arch: 'upper', side: 'left', type: 'canine' })
    expect(toothInfo(35)).toMatchObject({ quadrant: 3, arch: 'lower', side: 'left', type: 'premolar' })
    expect(toothInfo(41)).toMatchObject({ quadrant: 4, arch: 'lower', side: 'right', type: 'incisor' })
    expect(toothInfo(54)).toMatchObject({ quadrant: 5, arch: 'upper', side: 'right', type: 'molar', primary: true })
    expect(toothInfo(73)).toMatchObject({ arch: 'lower', side: 'left', type: 'canine', primary: true })
    expect(toothInfo(19)).toBeNull()
  })
  it('surfaces per type: anterior teeth have an incisal edge, posterior an occlusal surface, all a root', () => {
    for (const n of [11, 12, 13, 21, 33, 42, 51, 53, 83]) expect(toothInfo(n)!.surfaces).toEqual(['M', 'D', 'I', 'B', 'L', 'R'])
    for (const n of [14, 15, 16, 18, 26, 37, 44, 54, 65, 75]) expect(toothInfo(n)!.surfaces).toEqual(['M', 'D', 'O', 'B', 'L', 'R'])
  })
  it('normalises surfaces: O↔I by tooth type, unknown and duplicate letters dropped, canonical order', () => {
    expect(normalizeSurfaces(11, ['O', 'M'])).toEqual(['M', 'I'])
    expect(normalizeSurfaces(16, ['I', 'D', 'M'])).toEqual(['M', 'O', 'D'])
    expect(normalizeSurfaces(36, ['R', 'B', 'B', 'L'])).toEqual(['B', 'L', 'R'])
    expect(normalizeSurfaces(99, ['M'])).toEqual([])
  })
  it('neighbours stay in the arch and cross the midline (for bridges)', () => {
    expect(neighbours(11).sort()).toEqual([12, 21])
    expect(neighbours(18)).toEqual([17])
    expect(neighbours(38)).toEqual([37])
    expect(neighbours(41).sort()).toEqual([31, 42])
    expect(neighbours(51).sort()).toEqual([52, 61])
    expect(areNeighbours(16, 17)).toBe(true)
    expect(areNeighbours(16, 46)).toBe(false)
  })
  it('names teeth in both languages', () => {
    expect(toothLabel(16, 'en')).toBe('Upper right first molar')
    expect(toothLabel(31, 'en')).toBe('Lower left central incisor')
    expect(toothLabel(16, 'ar')).toBe('الرحى الأولى العلوية اليمنى')
    expect(toothLabel(13, 'ar')).toBe('الناب العلوي الأيمن')
    expect(toothLabel(48, 'ar')).toBe('ضرس العقل السفلي الأيمن')
    expect(toothLabel(64, 'ar')).toBe('الرحى اللبنية الأولى العلوية اليسرى')
  })
  it('condition meta: surface vs whole tooth, every condition has a token colour', () => {
    expect(SURFACE_CONDITIONS.sort()).toEqual(['caries', 'filled', 'fracture', 'sealant'])
    for (const c of ['missing', 'implant', 'crown', 'bridge', 'veneer', 'root_canal', 'to_extract', 'impacted', 'mobile', 'abscess', 'attrition'] as ToothCondition[]) {
      expect(CONDITION_META[c].scope).toBe('tooth'); expect(WHOLE_CONDITIONS).toContain(c)
    }
    expect(CONDITION_META.healthy.scope).toBe('clear')
    for (const m of Object.values(CONDITION_META)) expect(m.color).toMatch(/^var\(--tooth-/)
  })
})

describe('chart: saving rules', () => {
  it('a surface finding replaces only overlapping surface findings', () => {
    const rows = [rec(16, 'caries', ['O']), rec(16, 'filled', ['M']), rec(16, 'sealant', ['B'])]
    const plan = planRecord(rows, { tooth: 16, condition: 'filled', surfaces: ['O', 'D'] })
    expect(plan.deactivate).toEqual([rows[0].id])
    expect(plan.add).toEqual([{ tooth: 16, surfaces: ['O', 'D'], condition: 'filled', active: true, note: undefined, treatmentItemId: undefined }])
    expect(state(apply(rows, plan), 16)).toEqual(['filled:M', 'filled:OD', 'sealant:B'])
  })
  it('a surface finding never splits: the whole overlapping record is superseded', () => {
    const rows = [rec(26, 'caries', ['M', 'O', 'D'])]
    const after = apply(rows, planRecord(rows, { tooth: 26, condition: 'filled', surfaces: ['O'] }))
    expect(state(after, 26)).toEqual(['filled:O'])
    expect(after.find(r => r.id === rows[0].id)!.active).toBe(false)     // kept as history
  })
  it('a whole-tooth finding replaces the tooth state (missing / implant wipe everything)', () => {
    const rows = [rec(36, 'caries', ['O']), rec(36, 'root_canal'), rec(36, 'crown'), rec(36, 'mobile'), rec(37, 'caries', ['O'])]
    const plan = planRecord(rows, { tooth: 36, condition: 'missing', surfaces: ['O'] })
    expect(plan.deactivate.sort()).toEqual(rows.slice(0, 4).map(r => r.id).sort())
    expect(plan.add[0]).toMatchObject({ condition: 'missing', surfaces: [], active: true })     // whole-tooth: surfaces dropped
    const after = apply(rows, plan)
    expect(state(after, 36)).toEqual(['missing'])
    expect(state(after, 37)).toEqual(['caries:O'])                                            // other teeth untouched
    expect(state(apply(after, planRecord(after, { tooth: 36, condition: 'implant' })), 36)).toEqual(['implant'])
  })
  it('states that coexist in the mouth survive each other', () => {
    // root canal then crown: both stay; the crown hides the old fillings
    let rows = [rec(46, 'filled', ['M', 'O']), rec(46, 'root_canal')]
    rows = apply(rows, planRecord(rows, { tooth: 46, condition: 'crown' }))
    expect(state(rows, 46)).toEqual(['crown', 'root_canal'])
    // implant keeps its crown
    let imp = [rec(36, 'implant')]
    imp = apply(imp, planRecord(imp, { tooth: 36, condition: 'crown' }))
    expect(state(imp, 36)).toEqual(['crown', 'implant'])
    // remarks stack with caries, a second identical remark replaces the first
    let fl = [rec(11, 'caries', ['M'])]
    fl = apply(fl, planRecord(fl, { tooth: 11, condition: 'mobile' }))
    fl = apply(fl, planRecord(fl, { tooth: 11, condition: 'mobile', note: 'grade II' }))
    expect(state(fl, 11)).toEqual(['caries:M', 'mobile'])
    expect(activeRecords(fl, 11).find(r => r.condition === 'mobile')!.note).toBe('grade II')
    // restorations replace each other; a veneer only hides the buccal surface
    let v = [rec(21, 'crown'), rec(21, 'caries', ['M'])]
    v = apply(v, planRecord(v, { tooth: 21, condition: 'veneer' }))
    expect(state(v, 21)).toEqual(['caries:M', 'veneer'])
    v = apply(v, planRecord(v, { tooth: 21, condition: 'caries', surfaces: ['B'] }))
    v = apply(v, planRecord(v, { tooth: 21, condition: 'veneer' }))
    expect(state(v, 21)).toEqual(['caries:M', 'veneer'])
  })
  it('a finding on a tooth marked missing brings the tooth back', () => {
    for (const c of ['caries', 'crown', 'root_canal', 'mobile', 'to_extract'] as ToothCondition[]) {
      const rows = [rec(17, 'missing')]
      const plan = planRecord(rows, { tooth: 17, condition: c, surfaces: ['O'] })
      expect(plan.deactivate).toEqual([rows[0].id])
    }
  })
  it('healthy clears what it overlaps and is stored as an inactive history row only', () => {
    const rows = [rec(14, 'caries', ['O']), rec(14, 'filled', ['D']), rec(14, 'crown')]
    const surf = planRecord(rows, { tooth: 14, condition: 'healthy', surfaces: ['O'] })
    expect(surf.deactivate).toEqual([rows[0].id])
    expect(surf.add).toEqual([expect.objectContaining({ condition: 'healthy', surfaces: ['O'], active: false })])
    const whole = planRecord(rows, { tooth: 14, condition: 'healthy' })
    expect(whole.deactivate.sort()).toEqual(rows.map(r => r.id).sort())
    const after = apply(rows, whole)
    expect(state(after, 14)).toEqual([])
    expect(timeline(after, 14)[0]).toMatchObject({ condition: 'healthy', active: false })   // the timeline shows it, newest first
  })
  it('supersedes() never touches healthy rows and ignores other conditions on other surfaces', () => {
    expect(supersedes({ condition: 'missing', surfaces: [] }, { condition: 'healthy', surfaces: [] })).toBe(false)
    expect(supersedes({ condition: 'caries', surfaces: ['M'] }, { condition: 'filled', surfaces: ['D'] })).toBe(false)
    expect(supersedes({ condition: 'caries', surfaces: ['M'] }, { condition: 'crown', surfaces: [] })).toBe(false)
    expect(supersedes({ condition: 'impacted', surfaces: [] }, { condition: 'caries', surfaces: ['O'] })).toBe(false)
  })
  it('validates drafts', () => {
    expect(validateDraft({ tooth: 16 })).toBe('condition')
    expect(validateDraft({ tooth: 16, condition: 'caries', surfaces: [] })).toBe('surfaces')
    expect(validateDraft({ tooth: 16, condition: 'caries', surfaces: ['I'] })).toBeNull()        // mapped to O
    expect(validateDraft({ tooth: 16, condition: 'crown' })).toBeNull()
    expect(validateDraft({ tooth: 16, condition: 'healthy' })).toBeNull()
    expect(validateDraft({ tooth: 99, condition: 'crown' })).toBe('tooth')
  })
})

describe('chart: quick paint and restore', () => {
  it('toggles a surface condition on and off, keeping the rest of a multi-surface record', () => {
    let rows: ToothRecord[] = []
    rows = apply(rows, planPaint(rows, 16, ['O'], 'caries'))
    expect(state(rows, 16)).toEqual(['caries:O'])
    rows = apply(rows, planPaint(rows, 16, ['M'], 'caries'))
    expect(state(rows, 16)).toEqual(['caries:M', 'caries:O'])
    rows = apply(rows, planPaint(rows, 16, ['O'], 'caries'))          // second click removes it
    expect(state(rows, 16)).toEqual(['caries:M'])
    const multi = [rec(26, 'filled', ['M', 'O', 'D'])]
    expect(state(apply(multi, planPaint(multi, 26, ['O'], 'filled')), 26)).toEqual(['filled:MD'])
    // a different condition on a painted surface replaces it
    expect(state(apply(rows, planPaint(rows, 16, ['M'], 'filled')), 16)).toEqual(['filled:M'])
  })
  it('toggles a whole-tooth condition', () => {
    let rows: ToothRecord[] = []
    rows = apply(rows, planPaint(rows, 36, ['O'], 'crown'))
    expect(state(rows, 36)).toEqual(['crown'])
    rows = apply(rows, planPaint(rows, 36, [], 'crown'))
    expect(state(rows, 36)).toEqual([])
  })
  it('the eraser writes nothing on a clean tooth', () => {
    expect(isEmptyPlan(planPaint([], 16, ['O'], 'healthy'))).toBe(true)
    expect(isEmptyPlan(planPaint([rec(16, 'caries', ['M'])], 16, ['O'], 'healthy'))).toBe(true)
    expect(planPaint([rec(16, 'caries', ['O'])], 16, ['O'], 'healthy').add[0]).toMatchObject({ condition: 'healthy', active: false })
    expect(isEmptyPlan(planPaint([], 16, [], 'caries'))).toBe(true)
  })
  it('restores a superseded record and deactivates what conflicts with it now', () => {
    const old = rec(46, 'caries', ['O'], { active: false })
    const cur = rec(46, 'filled', ['O', 'M'])
    const other = rec(46, 'sealant', ['B'])
    const plan = planRestore([old, cur, other], old.id)!
    expect(plan.activate).toEqual([old.id])
    expect(plan.deactivate).toEqual([cur.id])
    expect(planRestore([old, cur], cur.id)).toBeNull()                     // already active
    expect(planRestore([rec(46, 'healthy', [], { active: false })], `r${String(seq).padStart(4, '0')}`)).toBeNull()
  })
})

describe('chart: what the chart shows and the summary', () => {
  const rows = [
    rec(16, 'caries', ['O', 'M']), rec(16, 'filled', ['D']), rec(17, 'filled', ['O']), rec(26, 'crown'), rec(26, 'root_canal'), rec(36, 'missing'),
    rec(46, 'implant'), rec(46, 'crown'), rec(11, 'caries', ['M'], { active: false }), rec(55, 'caries', ['O']), rec(24, 'bridge'), rec(25, 'bridge'), rec(26, 'bridge', [], { active: false }),
  ]
  it('maps surfaces and whole-tooth conditions per tooth', () => {
    const v = chartView(rows)
    expect(v.get(16)!.surfaces).toEqual({ O: 'caries', M: 'caries', D: 'filled' })
    expect(v.get(26)!.whole).toEqual(['crown', 'root_canal'])
    expect(v.get(46)!.whole).toEqual(['crown', 'implant'])
    expect(v.has(11)).toBe(false)                                         // inactive only
  })
  it('the newest surface record wins when two overlap', () => {
    const a = rec(15, 'caries', ['O'], { recordedAt: '2026-01-01T00:00:00.000Z' })
    const b = rec(15, 'filled', ['O'], { recordedAt: '2026-02-01T00:00:00.000Z' })
    expect(chartView([a, b]).get(15)!.surfaces.O).toBe('filled')
  })
  it('counts teeth (not records) per condition and builds a DMFT-like index', () => {
    const c = conditionCounts(rows)
    expect(c.caries).toBe(2)      // 16 and 55 (11 is superseded)
    expect(c.filled).toBe(2)      // 16 and 17
    const s = chartSummary(rows)
    expect(s).toMatchObject({ caries: 2, filled: 2, crown: 2, missing: 1, implant: 1, root_canal: 1 })
    expect(s.dmft).toEqual({ d: 2, m: 2, f: 2, total: 6 })                // D: 16, 55 · M: 36, 46 · F: 17, 26
    expect(s.charted).toBe(8)                                            // 16 17 24 25 26 36 46 55
  })
  it('joins neighbouring bridged teeth', () => {
    expect(bridgeSpans(rows)).toEqual([[24, 25]])
    expect(bridgeSpans([rec(11, 'bridge'), rec(21, 'bridge'), rec(22, 'bridge'), rec(14, 'bridge')])).toEqual([[11, 21, 22]])
    expect(bridgeLinks(ROWS.upperAdult, new Set([12, 11, 21, 23]))).toEqual([[12, 11], [11, 21]])
  })
  it('chooses the dentition by age', () => {
    expect(dentitionForAge(3)).toBe('primary')
    expect(dentitionForAge(5)).toBe('primary')
    expect(dentitionForAge(6)).toBe('mixed')
    expect(dentitionForAge(12)).toBe('mixed')
    expect(dentitionForAge(13)).toBe('adult')
    expect(dentitionForAge(null)).toBe('adult')
    expect(inDentition(55, 'adult')).toBe(false)
    expect(inDentition(55, 'mixed')).toBe(true)
    expect(inDentition(16, 'primary')).toBe(false)
  })
  it('timeline is newest first and the print table is ordered by tooth', () => {
    const tl = timeline(rows)
    for (let i = 1; i < tl.length; i++) expect(tl[i - 1].recordedAt >= tl[i].recordedAt).toBe(true)
    const tbl = findingsTable(rows)
    expect(tbl.every(r => r.active)).toBe(true)
    expect(tbl.map(r => r.tooth)).toEqual([...tbl.map(r => r.tooth)].sort((a, b) => a - b))
  })
  it('writes surfaces the way a dentist does', () => {
    expect(surfaceCode(['M', 'O', 'D'])).toBe('MOD')
    expect(surfaceCode(['B', 'R'])).toBe('B + R')
    expect(surfaceCode(['R'])).toBe('R')
    expect(surfaceCode([])).toBe('')
    expect(surfaceCode(['O', 'M'])).toBe('MO')            // canonical order even for unsorted rows
    expect(surfaceCode(['I', 'M'])).toBe('MI')
    expect(surfaceCode(['L', 'D', 'O', 'M', 'B'])).toBe('MODBL')
  })
})

describe('chart: translations', () => {
  it('Arabic and English have the same keys, none empty', () => {
    expect(Object.keys(chartDict.ar).sort()).toEqual(Object.keys(chartDict.en).sort())
    for (const lang of ['ar', 'en'] as const) for (const [k, v] of Object.entries(chartDict[lang])) expect(v.trim(), `${lang}.${k}`).not.toBe('')
  })
  it('every chart.* key used by the module exists', () => {
    const dir = path.resolve(__dirname, '../src/features/chart')
    const used = new Set<string>()
    for (const f of fs.readdirSync(dir).filter(f => /\.tsx?$/.test(f))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8')
      for (const m of src.matchAll(/'chart\.([A-Za-z0-9_.]+)'/g)) used.add(m[1])
    }
    // dynamic families
    for (const k of ['caries', 'filled', 'crown', 'missing', 'implant', 'root_canal']) used.add(`stat.${k}`)
    for (const d of ['adult', 'mixed', 'primary']) used.add(`dent.${d}`)
    for (const ty of ['incisor', 'canine', 'premolar', 'molar']) used.add(`type.${ty}`)
    for (const q of ['UR', 'UL', 'LR', 'LL']) { used.add(`quad.${q}`); used.add(`qpos.${q}.f`); used.add(`qpos.${q}.m`) }
    const missing = [...used].filter(k => !(k in chartDict.ar))
    expect(missing).toEqual([])
    expect(used.size).toBeGreaterThan(60)
  })
})
