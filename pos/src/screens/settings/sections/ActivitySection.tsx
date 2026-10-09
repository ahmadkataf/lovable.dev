// The activity log: discounts, price changes, refunds, deletions, stock adjustments, user changes…
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardList, Download } from 'lucide-react'
import { useT } from '../../../i18n'
import { useStore } from '../../../state/store'
import { Button, Select, Empty } from '../../../components/ui'
import { recentAudit } from '../../../lib/audit'
import { formatDateTime } from '../../../lib/format'
import { formatMoney } from '../../../lib/money'
import { saveCsv } from '../../../lib/csv'
import type { AuditKind } from '../../../db/types'
import { SectionCard } from '../shared'

const KINDS: AuditKind[] = ['sale.discount', 'sale.priceOverride', 'refund', 'product.delete', 'product.price', 'stock.adjust', 'user.add', 'user.change', 'user.remove', 'backup.restore', 'data.reset', 'shift.close', 'customer.adjust']
const MONEY_KINDS: AuditKind[] = ['sale.discount', 'refund', 'product.price', 'shift.close', 'customer.adjust']

export default function ActivitySection() {
  const t = useT()
  const c = useStore(s => s.settings.currency)
  const rows = useLiveQuery(() => recentAudit(500), [])
  const [kind, setKind] = useState<AuditKind | 'all'>('all')
  const [who, setWho] = useState('all')
  const users = useMemo(() => Array.from(new Set((rows ?? []).map(r => r.userName).filter((x): x is string => !!x))), [rows])
  const list = useMemo(() => (rows ?? []).filter(r => (kind === 'all' || r.kind === kind) && (who === 'all' || r.userName === who)), [rows, kind, who])
  const exportCsv = () => saveCsv('kaseb-activity.csv', [[t('common.date'), t('common.user'), t('settings.activity.kind'), t('settings.activity.detail'), t('common.amount')], ...list.map(r => [formatDateTime(r.createdAt), r.userName ?? '', t(`settings.activity.k.${r.kind}`), r.detail, r.amount ?? ''])])
  return (
    <SectionCard title={t('settings.sec.activity')} icon={<ClipboardList size={16} />}>
      <p className="small muted">{t('settings.activity.desc')}</p>
      <div className="row wrap">
        <Select value={kind} onChange={e => setKind(e.target.value as AuditKind | 'all')} style={{ maxWidth: 240 }}>
          <option value="all">{t('common.all')}</option>
          {KINDS.map(k => <option key={k} value={k}>{t(`settings.activity.k.${k}`)}</option>)}
        </Select>
        <Select value={who} onChange={e => setWho(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="all">{t('common.user')}: {t('common.all')}</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </Select>
        <span className="grow" />
        <Button size="sm" icon={<Download size={16} />} disabled={!list.length} onClick={() => void exportCsv()}>{t('common.export')}</Button>
      </div>
      {rows && list.length === 0 ? <Empty title={t('settings.activity.empty')} /> : (
        <div className="list card flat" style={{ marginTop: 10 }}>
          {list.slice(0, 300).map(r => (
            <div key={r.id} className="list-row">
              <div className="grow">
                <div className="title">{t(`settings.activity.k.${r.kind}`)}{r.detail ? <span className="muted"> · {r.detail}</span> : null}</div>
                <div className="sub">{formatDateTime(r.createdAt)}{r.userName ? ` · ${r.userName}` : ''}</div>
              </div>
              {typeof r.amount === 'number' && MONEY_KINDS.includes(r.kind) && <div className="end num bold">{formatMoney(r.amount, c)}</div>}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}
