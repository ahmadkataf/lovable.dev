import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { ToothCondition, ToothSurface, TreatmentItem } from '@/db/types'
import { logActivity } from '@/db'
import { useI18n } from '@/i18n'
import { useSession } from '@/app/session'
import { ToothIcon } from '@/app/ToothIcon'
import { Button, Field, Modal, Select, useToast } from '@/ui'
import { CHART_CHOICES, chartSurfaces, isSurfaceCondition, listSep, sortTeeth, surfaceCode, tn } from './lib'
import { SurfaceChips, ToothBadge } from './parts'
import { applyChartEntries } from './actions'

export interface ChartPrompt { items: TreatmentItem[]; condition: ToothCondition }

/**
 * After a treatment on a tooth is completed: offers to record what it left on the dental chart
 * (suggested from the procedure category, editable), one finding per tooth.
 */
export default function ChartUpdateModal({ prompt, onClose, patientId }: { prompt: ChartPrompt | null; onClose: () => void; patientId: string }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const { user } = useSession()
  const [condition, setCondition] = useState<ToothCondition>('filled')
  const [surfaces, setSurfaces] = useState<Record<string, ToothSurface[]>>({})
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const items = (prompt?.items ?? []).filter(i => i.tooth)

  useEffect(() => {
    if (!prompt) return
    setCondition(prompt.condition)
    const s: Record<string, ToothSurface[]> = {}
    for (const i of prompt.items) if (i.tooth) s[i.id] = chartSurfaces(prompt.condition, i.tooth, i.surfaces)
    setSurfaces(s)
  }, [prompt])

  /** Switching to a surface condition (e.g. crown → filling) gives teeth without surfaces the usual default. */
  const changeCondition = (c: ToothCondition) => {
    setCondition(c)
    if (!isSurfaceCondition(c)) return
    setSurfaces(m => {
      const n = { ...m }
      for (const i of items) if (!(n[i.id] ?? []).length) n[i.id] = chartSurfaces(c, i.tooth!, i.surfaces)
      return n
    })
  }
  const surfaceCond = isSurfaceCondition(condition)
  const surfOf = (i: TreatmentItem) => (surfaceCond ? (surfaces[i.id]?.length ? surfaces[i.id] : chartSurfaces(condition, i.tooth!, i.surfaces)) : [])
  const missing = surfaceCond && items.some(i => (surfaces[i.id] ?? []).length === 0)

  const apply = async () => {
    if (missing || busy.current) return
    busy.current = true
    setSaving(true)
    try {
      const entries = items.map(i => ({ tooth: i.tooth!, condition, surfaces: surfOf(i), treatmentItemId: i.id }))
      await applyChartEntries(patientId, entries, user?.id)
      const teeth = sortTeeth(items.map(i => i.tooth!))
      void logActivity({ type: 'treatment', action: 'update', patientId, by: user?.id, entityId: items[0]?.id, message: t('treatments.log.chart', { teeth: teeth.join(listSep(lang)), cond: t(`cond.${condition}`) }) })
      toast.success(t('treatments.toast.chartUpdated'), `${t(`cond.${condition}`)} · ${teeth.join(listSep(lang))}`)
      onClose()
    } catch (e) { toast.error(t('error'), String((e as Error)?.message ?? e)) } finally { busy.current = false; setSaving(false) }
  }

  return (
    <Modal open={!!prompt && items.length > 0} onClose={onClose} size="sm" className="tr-modal" icon={<ToothIcon size={20} />} title={t('treatments.chart.title')} subtitle={t('treatments.chart.sub', { name: items.length === 1 ? items[0].procedureName : tn(t, lang, 'treatments.n.items', items.length) })}
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t('treatments.chart.skip')}</Button>
        <Button variant="primary" icon={<Check />} loading={saving} disabled={missing} onClick={() => void apply()}>{t('treatments.chart.apply')}</Button>
      </>}>
      <div className="col gap-4">
        <Select label={t('treatments.chart.condition')} value={condition} onChange={e => changeCondition(e.target.value as ToothCondition)}
          options={[...new Set([prompt?.condition ?? condition, ...CHART_CHOICES])].map(c => ({ value: c, label: t(`cond.${c}`) }))} />
        <div className="tr-chart-list">
          {items.map(i => (
            <div key={i.id} className="tr-chart-row">
              <div className="row gap-2">
                <ToothBadge tooth={i.tooth} />
                <span className="grow truncate text-sm">{i.procedureName}</span>
                {surfaceCond && <span className="ltr text-sm muted">{surfaceCode(surfOf(i))}</span>}
              </div>
              {surfaceCond && (
                <Field className="mt-2" error={(surfaces[i.id] ?? []).length === 0 ? t('treatments.chart.needSurface') : undefined}>
                  <SurfaceChips teeth={[i.tooth!]} value={surfaces[i.id] ?? []} onChange={s => setSurfaces(m => ({ ...m, [i.id]: s }))} />
                </Field>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}
