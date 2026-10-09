import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Banknote, Boxes, Bell, LayoutGrid, Lock, Plus, X } from 'lucide-react'
import { useStore, toast } from '../../../state/store'
import { useT } from '../../../i18n'
import { Button, Field, NumberInput, Seg, SwitchRow } from '../../../components/ui'
import { db } from '../../../db'
import type { PaymentMethod, Settings } from '../../../db/types'
import { formatMoney } from '../../../lib/money'
import { AutosaveHint, SectionCard, Note } from '../shared'
import { addQuickAmount, QUICK_MAX } from '../users'

type Pos = Settings['pos']
const LOCK_OPTIONS = [0, 1, 5, 15, 30] as const

export default function PosSection() {
  const t = useT()
  const pos = useStore(s => s.settings.pos)
  const currency = useStore(s => s.settings.currency)
  const updateSettings = useStore(s => s.updateSettings)
  const set = (p: Partial<Pos>) => void updateSettings({ pos: p }).catch(() => toast(t('settings.saveFailed'), 'error'))
  const usersWithPin = useLiveQuery(() => db.users.filter(u => u.active && !!u.pinHash).count(), [])
  const [quick, setQuick] = useState<number | ''>('')
  const [quickErr, setQuickErr] = useState<string | null>(null)

  const addQuick = () => {
    const r = addQuickAmount(pos.quickAmounts, Number(quick), currency.decimals)
    if (r.error) { setQuickErr(t(r.error === 'dup' ? 'settings.pos.quickDup' : r.error === 'max' ? 'settings.pos.quickMax' : 'settings.pos.quickInvalid', { n: QUICK_MAX })); return }
    set({ quickAmounts: r.list }); setQuick(''); setQuickErr(null)
  }

  return (
    <>
      <AutosaveHint />
      <SectionCard title={t('settings.pos.payment')} icon={<Banknote size={16} />}>
        <Field label={t('settings.pos.defaultMethod')}>
          <Seg<PaymentMethod> block value={pos.defaultMethod} onChange={v => set({ defaultMethod: v })}
            options={[{ value: 'cash', label: t('common.cash') }, { value: 'card', label: t('common.card') }, { value: 'transfer', label: t('common.transfer') }, { value: 'credit', label: t('common.credit') }]} />
        </Field>
        <Field label={t('settings.pos.quick')} hint={t('settings.pos.quickDesc')}>
          <div className="col" style={{ gap: 8 }}>
            {pos.quickAmounts.length > 0 ? (
              <div className="quick-chips">
                {pos.quickAmounts.map(a => (
                  <span key={a} className="quick-chip"><span className="money">{formatMoney(a, currency)}</span>
                    <button type="button" aria-label={t('common.delete')} onClick={() => set({ quickAmounts: pos.quickAmounts.filter(x => x !== a) })}><X size={14} /></button></span>
                ))}
              </div>
            ) : <span className="small faint">{t('settings.pos.quickEmpty')}</span>}
            <div className="quick-add">
              <NumberInput value={quick} onChange={n => { setQuick(n); setQuickErr(null) }} decimals={currency.decimals} placeholder={t('settings.pos.quickPh')} invalid={!!quickErr}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQuick() } }} />
              <Button icon={<Plus size={16} />} onClick={addQuick} disabled={quick === '' || pos.quickAmounts.length >= QUICK_MAX}>{t('common.add')}</Button>
            </div>
            {quickErr && <span className="xs" style={{ color: 'var(--danger)' }}>{quickErr}</span>}
          </div>
        </Field>
      </SectionCard>

      <SectionCard title={t('settings.pos.stock')} icon={<Boxes size={16} />}>
        <SwitchRow label={t('settings.pos.allowNegative')} desc={t('settings.pos.allowNegativeDesc')} on={pos.allowNegativeStock} onChange={v => set({ allowNegativeStock: v })} />
        <SwitchRow label={t('settings.pos.showStock')} desc={t('settings.pos.showStockDesc')} on={pos.showStockOnCards} onChange={v => set({ showStockOnCards: v })} />
      </SectionCard>

      <SectionCard title={t('settings.pos.display')} icon={<LayoutGrid size={16} />}>
        <Field label={t('settings.pos.grid')}>
          <Seg<Pos['gridSize']> block value={pos.gridSize} onChange={v => set({ gridSize: v })}
            options={[{ value: 'small', label: t('settings.pos.grid.small') }, { value: 'medium', label: t('settings.pos.grid.medium') }, { value: 'large', label: t('settings.pos.grid.large') }]} />
        </Field>
        <SwitchRow label={t('settings.pos.askPrint')} desc={t('settings.pos.askPrintDesc')} on={pos.askPrintAfterSale} onChange={v => set({ askPrintAfterSale: v })} />
        <SwitchRow label={t('settings.pos.camera')} desc={t('settings.pos.cameraDesc')} on={pos.cameraScanner} onChange={v => set({ cameraScanner: v })} />
      </SectionCard>

      <SectionCard title={t('settings.pos.feedback')} icon={<Bell size={16} />}>
        <SwitchRow label={t('settings.pos.sound')} desc={t('settings.pos.soundDesc')} on={pos.soundOn} onChange={v => set({ soundOn: v })} />
        <SwitchRow label={t('settings.pos.vibrate')} desc={t('settings.pos.vibrateDesc')} on={pos.vibrate} onChange={v => set({ vibrate: v })} />
      </SectionCard>

      <SectionCard title={t('settings.pos.security')} icon={<Lock size={16} />}>
        <SwitchRow label={t('settings.pos.requirePin')} desc={t('settings.pos.requirePinDesc')} on={pos.requirePin} onChange={v => set({ requirePin: v })} />
        {pos.requirePin && usersWithPin === 0 && (
          <Note kind="warn">{t('settings.pos.requirePinNoPins')} <Link to="/settings/users">{t('settings.pos.requirePinUsers')}</Link></Note>
        )}
        <Field label={t('settings.pos.lockAfter')} hint={t('settings.pos.lockAfterDesc')}>
          <div style={{ opacity: pos.requirePin ? 1 : 0.5, pointerEvents: pos.requirePin ? 'auto' : 'none' }}>
            <Seg<string> block value={String(LOCK_OPTIONS.includes(pos.lockAfterMinutes as typeof LOCK_OPTIONS[number]) ? pos.lockAfterMinutes : 0)} onChange={v => set({ lockAfterMinutes: Number(v) })}
              options={LOCK_OPTIONS.map(m => ({ value: String(m), label: t(`settings.pos.lock.${m}`) }))} />
          </div>
        </Field>
      </SectionCard>
    </>
  )
}
