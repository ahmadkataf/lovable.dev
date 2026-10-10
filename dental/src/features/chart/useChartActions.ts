// Writes of the dental chart. Every write re-reads the tooth's rows inside the transaction, asks lib.ts for a plan
// and applies it, so rapid clicks in quick-paint mode never work from a stale list.
import { useCallback } from 'react'
import { db, logActivity } from '@/db'
import { newId, nowISO } from '@/db/ids'
import type { ToothCondition, ToothRecord, ToothSurface } from '@/db/types'
import { useI18n } from '@/i18n'
import { useSession } from '@/app/session'
import { isEmptyPlan, planPaint, planRecord, planRestore, surfaceCode, type NewRecord, type RecordDraft, type WritePlan } from './lib'

export type ChartWrite = { plan: WritePlan; added: NewRecord[] }

export function useChartActions(patientId: string) {
  const { t } = useI18n()
  const { user } = useSession()

  const commit = useCallback(async (tooth: number, build: (rows: ToothRecord[]) => WritePlan | null): Promise<ChartWrite | null> => {
    return db.transaction('rw', db.teeth, async () => {
      const rows = await db.teeth.where('[patientId+tooth]').equals([patientId, tooth]).toArray()
      const plan = build(rows)
      if (!plan || isEmptyPlan(plan)) return null
      for (const id of plan.deactivate) await db.teeth.update(id, { active: false })
      for (const id of plan.activate) await db.teeth.update(id, { active: true })
      const now = nowISO()
      for (const r of plan.add) {
        const row: ToothRecord = { id: newId(), patientId, tooth: r.tooth, surfaces: r.surfaces, condition: r.condition, active: r.active, recordedAt: now }
        if (r.note) row.note = r.note
        if (r.treatmentItemId) row.treatmentItemId = r.treatmentItemId
        if (user?.id) row.recordedBy = user.id
        await db.teeth.add(row)
      }
      return { plan, added: plan.add }
    })
  }, [patientId, user?.id])

  const log = useCallback((action: 'create' | 'update' | 'delete', key: string, tooth: number, cond: ToothCondition, surfaces: ToothSurface[] = [], entityId?: string) => {
    const code = surfaceCode(surfaces)
    void logActivity({ type: 'treatment', action, patientId, entityId, by: user?.id, message: t(key, { n: tooth, cond: t(`cond.${cond}`) + (code ? ` (${code})` : '') }) })
  }, [patientId, t, user?.id])

  /** Records a finding from the tooth panel. */
  const save = useCallback(async (draft: RecordDraft) => {
    const res = await commit(draft.tooth, rows => planRecord(rows, draft))
    if (res) log('create', draft.condition === 'healthy' ? 'chart.log.healthy' : 'chart.log.add', draft.tooth, draft.condition, res.added[0]?.surfaces)
    return res
  }, [commit, log])

  /** Quick-paint click: toggles the condition on the clicked surface / tooth. */
  const paint = useCallback(async (tooth: number, surfaces: ToothSurface[], condition: ToothCondition) => {
    const res = await commit(tooth, rows => planPaint(rows, tooth, surfaces, condition))
    if (!res) return null
    // an addition carries the clicked surfaces; a toggle-off only re-adds what is left of the old record
    const added = res.added.find(r => r.active && r.condition === condition && surfaces.every(s => r.surfaces.includes(s) || r.surfaces.length === 0))
    if (condition === 'healthy') log('update', 'chart.log.healthy', tooth, condition, surfaces)
    else if (added) log('create', 'chart.log.add', tooth, condition, added.surfaces)
    else log('update', 'chart.log.remove', tooth, condition, surfaces)
    return res
  }, [commit, log])

  /** Brings back a superseded finding. */
  const restore = useCallback(async (rec: ToothRecord) => {
    const res = await commit(rec.tooth, rows => planRestore(rows, rec.id))
    if (res) log('update', 'chart.log.restore', rec.tooth, rec.condition, rec.surfaces, rec.id)
    return res
  }, [commit, log])

  /** Deletes a row for good (the caller confirms first). */
  const remove = useCallback(async (rec: ToothRecord) => {
    await db.teeth.delete(rec.id)
    log('delete', 'chart.log.delete', rec.tooth, rec.condition, rec.surfaces, rec.id)
  }, [log])

  return { save, paint, restore, remove }
}
