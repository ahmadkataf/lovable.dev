// What cashiers may do. Admins always may do everything.
import { ShieldCheck } from 'lucide-react'
import { useT } from '../../../i18n'
import { useStore } from '../../../state/store'
import { SwitchRow } from '../../../components/ui'
import type { Permissions } from '../../../db/types'
import { SectionCard, AutosaveHint } from '../shared'

const KEYS: (keyof Permissions)[] = ['cashierDiscount', 'cashierPriceOverride', 'cashierRefund', 'cashierSeeCost', 'cashierEditProducts', 'cashierAdjustStock', 'cashierSeeHistory', 'cashierChangeRate']

export default function PermissionsCard() {
  const t = useT()
  const perms = useStore(s => s.settings.permissions)
  const update = useStore(s => s.updateSettings)
  return (
    <SectionCard title={t('settings.perm.title')} icon={<ShieldCheck size={16} />}>
      <p className="small muted">{t('settings.perm.desc')}</p>
      {KEYS.map(k => <SwitchRow key={k} label={t(`settings.perm.${k}`)} desc={t(`settings.perm.${k}.desc`)} on={perms[k]} onChange={v => void update({ permissions: { [k]: v } })} />)}
      <AutosaveHint />
    </SectionCard>
  )
}
