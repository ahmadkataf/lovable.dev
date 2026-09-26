import type { Module, ModuleReview, Unit } from '../../../engine/types'

/** The Activity Book pages, writing tasks and translation sentences of each unit, kept apart from the
 *  Student's Book data they extend. */
export interface ModuleExtras {
  units: Record<string, Pick<Unit, 'workbook' | 'compositions' | 'translations'>>
  progressTest?: ModuleReview
}

export function withExtras(m: Module, x: ModuleExtras): Module {
  return {
    ...m,
    units: m.units.map(u => ({ ...u, ...(x.units[u.id] || {}) })),
    ...(x.progressTest ? { progressTest: x.progressTest } : {}),
  }
}
