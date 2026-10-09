import { describe, it, expect } from 'vitest'
import { TEMPLATES, templateById } from './templates'
import { generate, DEFAULT_SETTINGS } from './generate'
import { roleOf, scaleParams, scaleDesign, repair } from './scale'
import { signedArea, bbox } from './geom'

const untouchable = ['fixed', 'choice', 'angle']

describe('scaling a whole design, and repairing one with errors', () => {
  it('sorts every parameter: sizes of the design scale, thickness, clearances and real objects do not', () => {
    for (const tpl of TEMPLATES) for (const d of tpl.params) expect(['length', 'object', 'fixed', 'count', 'toggle', 'choice', 'angle'], `${tpl.id} ${d.key}`).toContain(roleOf(tpl, d))
    const role = (id: string, key: string) => roleOf(templateById(id), templateById(id).params.find(d => d.key === key)!)
    expect(role('mabkharatower', 'S')).toBe('length')
    expect(role('mabkharatower', 'rd')).toBe('object')
    expect(role('mabkharatower', 'tm')).toBe('fixed')
    expect(role('mabkharatower', 'fit')).toBe('fixed')
    expect(role('mabkharatower', 'pattern')).toBe('choice')
    expect(role('mabkharatower', 'dome')).toBe('toggle')
    expect(role('displaystand', 'ang')).toBe('angle')
    expect(role('displaystand', 'N')).toBe('count')
    expect(role('sweetstand', 'gap')).toBe('length')
    expect(role('lip', 'gap')).toBe('fixed')
    expect(role('invitebox', 'cw')).toBe('object')
    expect(role('fittest', 'step')).toBe('fixed')
  })

  it('scales the lengths, keeps the rest, and stays inside each range', () => {
    const tpl = templateById('mabkharatower')
    const { params, clamped } = scaleParams(tpl, {}, 0.7)
    expect(params.S).toBe(80.5)
    expect(params.H).toBe(175)
    expect(params.rd).toBe(tpl.defaults.rd)
    expect(params.fit).toBe(tpl.defaults.fit)
    expect(params.dh).toBe(45) // 42 is under the field's minimum
    expect(clamped.map(c => c.key)).toEqual(['dh'])
    expect(scaleParams(tpl, {}, 0.7, true).params.rd).toBe(45.5)
  })

  it('keeps the slots on the sheet thickness when the design shrinks (what scaling the cut file would break)', () => {
    const slotWidths = (id: string, f: number) => {
      const tpl = templateById(id), d = generate(tpl, scaleParams(tpl, {}, f).params, { ...DEFAULT_SETTINGS, t: 3.2, kerf: 0 })
      const ws = new Set<number>()
      for (const pn of d.panels) for (const l of pn.loops) {
        if (!l.closed || l.layer === 'engrave' || signedArea(l) >= 0) continue
        const b = bbox([l]), s = Math.min(b.maxX - b.minX, b.maxY - b.minY), lg = Math.max(b.maxX - b.minX, b.maxY - b.minY)
        if (s > 3 && s < 4 && lg > 1.5 * s) ws.add(Math.round(s * 1000) / 1000)
      }
      return [...ws].sort()
    }
    for (const id of ['mabkharatower', 'displaystand', 'organizer', 'chest']) {
      const full = slotWidths(id, 1), small = slotWidths(id, 0.75)
      expect(full.length, id).toBeGreaterThan(0)
      expect(small, id).toEqual(full)
    }
  })

  it('repairs every design that a common thickness breaks at its own sizes, changing only what it may', () => {
    let cases = 0
    for (const tpl of TEMPLATES) for (const t of [2.7, 3, 3.2, 4, 5, 6]) {
      const s = { ...DEFAULT_SETTINGS, t }
      if (!generate(tpl, {}, s).errors.length) continue
      cases++
      const r = repair(tpl, s, {}, { budgetMs: 8000 })
      expect(r.ok, `${tpl.id} t=${t}: ${r.errors.join(' | ')}`).toBe(true)
      expect(generate(tpl, r.params, s).errors, `${tpl.id} t=${t}`).toEqual([])
      for (const c of r.changes) expect([...untouchable, 'object'], `${tpl.id} t=${t} changed ${c.key}`).not.toContain(roleOf(tpl, tpl.params.find(d => d.key === c.key)!))
    }
    expect(cases).toBeGreaterThan(20)
  })

  it('leaves the field the user just set alone', () => {
    const tpl = templateById('lip'), s = { ...DEFAULT_SETTINGS, t: 5 }
    const r = repair(tpl, s, { W: 100 }, { locked: ['W'] })
    expect(r.ok).toBe(true)
    expect(r.params.W).toBe(100)
    expect(r.changes.map(c => c.key)).toEqual(['lipH'])
    // a locked field that is itself the problem cannot be repaired around
    expect(repair(tpl, s, { lipH: 10 }, { locked: ['lipH'] }).ok).toBe(false)
  })

  it('scales every design up and down to something that can be cut, never touching thickness, clearances or (unless asked) real objects', () => {
    const s = { ...DEFAULT_SETTINGS, t: 3.2 }
    for (const tpl of TEMPLATES) for (const [f, objects] of [[0.7, false], [0.5, false], [0.6, true], [1.5, false]] as const) {
      const r = scaleDesign(tpl, s, {}, f, objects, 8000)
      const label = `${tpl.id} ×${f}${objects ? ' +objects' : ''}`
      expect(r.ok, `${label}: ${r.errors.join(' | ')}`).toBe(true)
      for (const d of tpl.params) {
        const role = roleOf(tpl, d)
        if (untouchable.includes(role) || (role === 'object' && !objects)) expect(r.params[d.key], `${label} ${d.key}`).toBe(tpl.defaults[d.key])
      }
    }
  }, 300_000)

  it('says why it changed what it changed', () => {
    const tpl = templateById('mabkharatower')
    const r = scaleDesign(tpl, { ...DEFAULT_SETTINGS, t: 3.2 }, {}, 0.7)
    const S = r.changes.find(c => c.key === 'S')!
    expect(S.from).toBe(80.5)
    expect(S.to).toBeGreaterThan(100) // the bowl's 65 mm rim and the dome's ring need the width
    expect(S.why).toContain('القبّة')
  })
})
