import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Percent, Sigma, TrendingDown, TrendingUp } from 'lucide-react'
import type { Procedure, ProcedureCategory } from '@/db/types'
import { logActivity } from '@/db'
import { useI18n } from '@/i18n'
import { useClinic, useMoney } from '@/app/hooks'
import { useSession } from '@/app/session'
import { Alert, Button, Field, Modal, Segmented, Select, useToast } from '@/ui'
import { NumField } from './parts'
import { bulkPrice, sortProcedures, tn, type BulkChange } from './lib'
import { applyBulkPrice } from './actions'

type Dir = 'up' | 'down'

/** Raises or lowers the prices of the procedures in view (the current category filter), with a live preview. */
export default function BulkPriceModal({ open, onClose, procedures, category }: { open: boolean; onClose: () => void; procedures: Procedure[]; category: ProcedureCategory | '' }) {
  const { t, lang, pick, isRTL } = useI18n()
  const money = useMoney()
  const clinic = useClinic()
  const toast = useToast()
  const { user } = useSession()
  const [mode, setMode] = useState<BulkChange['mode']>('percent')
  const [dir, setDir] = useState<Dir>('up')
  const [value, setValue] = useState<number | null>(10)
  const [round, setRound] = useState(0)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (open) { setMode('percent'); setDir('up'); setValue(10); setRound(0) } }, [open])

  const scope = useMemo(() => sortProcedures(procedures), [procedures])
  const change: BulkChange = { mode, value: (dir === 'down' ? -1 : 1) * (value ?? 0), round }
  const preview = useMemo(() => scope.map(p => ({ p, next: bulkPrice(p.price, change) })), [scope, mode, dir, value, round]) // eslint-disable-line react-hooks/exhaustive-deps
  const changed = preview.filter(x => x.next !== x.p.price)
  const error = value === null ? t('v.required') : value <= 0 ? t('v.positive') : mode === 'percent' && dir === 'down' && value >= 100 ? t('treatments.bulk.tooMuch') : undefined
  const Arrow = isRTL ? ArrowLeft : ArrowRight
  const scopeLabel = category ? t(`cat.${category}`) : t('treatments.bulk.allCategories')

  const apply = async () => {
    if (error || !changed.length) return
    setSaving(true)
    try {
      const n = await applyBulkPrice(changed.map(x => x.p.id), change)
      void logActivity({ type: 'system', action: 'update', by: user?.id, message: t('treatments.log.bulk', { n, scope: scopeLabel, change: describe() }) })
      toast.success(t('treatments.toast.bulkDone'), t('treatments.bulk.changedN', { n }))
      onClose()
    } catch (e) { toast.error(t('error'), String((e as Error)?.message ?? e)) } finally { setSaving(false) }
  }
  const describe = () => `${dir === 'down' ? '−' : '+'}${mode === 'percent' ? `${value ?? 0}%` : money(value ?? 0)}`

  return (
    <Modal open={open} onClose={onClose} size="md" icon={<Sigma />} title={t('treatments.bulk.title')} subtitle={t('treatments.bulk.sub', { scope: scopeLabel })}
      footer={<>
        <span className="start text-sm muted">{t('treatments.bulk.affects', { prices: tn(t, lang, 'treatments.n.prices', changed.length) })}</span>
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="primary" loading={saving} disabled={!!error || !changed.length} onClick={() => void apply()}>{t('treatments.bulk.apply')}</Button>
      </>}>
      <div className="col gap-4">
        <div className="form-grid">
          <Field label={t('treatments.bulk.direction')}>
            <Segmented<Dir> block value={dir} onChange={setDir} options={[
              { value: 'up', label: t('treatments.bulk.increase'), icon: <TrendingUp /> },
              { value: 'down', label: t('treatments.bulk.decrease'), icon: <TrendingDown /> },
            ]} />
          </Field>
          <Field label={t('treatments.bulk.mode')}>
            <Segmented<BulkChange['mode']> block value={mode} onChange={setMode} options={[
              { value: 'percent', label: t('treatments.bulk.percent'), icon: <Percent /> },
              { value: 'fixed', label: t('treatments.bulk.fixed'), icon: <Sigma /> },
            ]} />
          </Field>
          <NumField label={t('treatments.bulk.value')} required value={value} onChange={setValue} min={0} decimals={mode === 'percent' ? 1 : clinic.currencyDecimals ?? 2}
            addon={mode === 'percent' ? '%' : clinic.currencySymbol || clinic.currency} error={error} />
          <Select label={t('treatments.bulk.round')} value={String(round)} onChange={e => setRound(Number(e.target.value))} options={[
            { value: '0', label: t('treatments.bulk.roundNone') }, { value: '1', label: t('treatments.bulk.roundTo', { n: 1 }) },
            { value: '5', label: t('treatments.bulk.roundTo', { n: 5 }) }, { value: '10', label: t('treatments.bulk.roundTo', { n: 10 }) },
          ]} />
        </div>
        {scope.length === 0 ? <Alert tone="info">{t('treatments.bulk.empty')}</Alert> : (
          <div className="tr-bulk-preview">
            <div className="tr-bulk-head">
              <span>{t('treatments.bulk.preview')}</span>
              <span className="muted">{tn(t, lang, 'treatments.n.procedures', scope.length)}</span>
            </div>
            <div className="tr-bulk-list">
              {preview.slice(0, 6).map(({ p, next }) => (
                <div key={p.id} className="tr-bulk-row">
                  <span className="truncate grow">{pick(p.name, p.nameEn)}</span>
                  <span className="money muted tr-old">{money(p.price)}</span>
                  <Arrow className="tr-bulk-arrow" />
                  <span className={`money${next > p.price ? ' tr-up' : next < p.price ? ' tr-down' : ''}`}>{money(next)}</span>
                </div>
              ))}
              {preview.length > 6 && <div className="tr-bulk-more muted text-sm">{t('treatments.bulk.andMore', { n: preview.length - 6 })}</div>}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
