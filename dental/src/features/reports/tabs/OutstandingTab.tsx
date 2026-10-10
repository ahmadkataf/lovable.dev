import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { HandCoins, MessageCircle, PartyPopper, Receipt, Scale, TrendingUp, Users } from 'lucide-react'
import { Avatar, Button, Card, CardHeader, DataTable, EmptyState, Pagination, usePagination, type Column } from '@/ui'
import { useI18n } from '@/i18n'
import { useClinic, useMoney } from '@/app/hooks'
import { fmtDate, today } from '@/lib/dates'
import { formatNumber, formatPhone, round2, whatsappLink } from '@/lib/format'
import { openExternal, platform } from '@/platform'
import { KpiCard, usePlural } from '../parts'
import { outstandingByPatient, type OutstandingRow } from '../queries'
import { useAllBalances } from '../useReportData'
import { useExport, type TabProps } from './common'

type Row = OutstandingRow & { name: string; fileNo?: number; phone?: string; photo?: string }

export default function OutstandingTab({ data, setExport }: TabProps) {
  const { t, lang } = useI18n()
  const money = useMoney()
  const clinic = useClinic()
  const plural = usePlural()
  const all = useAllBalances(true)

  const rows: Row[] | undefined = useMemo(() => {
    if (!all || !data) return undefined
    return outstandingByPatient(all.invoices, all.payments).map(r => {
      const p = data.patientMap.get(r.patientId)
      return { ...r, name: p?.name ?? t('unknown'), fileNo: p?.fileNo, phone: p?.phone, photo: p?.photo }
    })
  }, [all, data, t])
  const pg = usePagination(rows ?? [], 25)
  const total = rows ? round2(rows.reduce((a, r) => a + r.due, 0)) : 0
  const clinicName = (lang === 'en' && clinic.nameEn) || clinic.name || t('appName')

  useExport(setExport, rows && rows.length ? {
    name: `outstanding_${today()}.csv`,
    rows: [[t('fileNo'), t('patient'), t('phone'), t('reports.out.invoiced'), t('reports.out.paid'), t('reports.out.due'), t('reports.out.lastPayment')],
      ...rows.map(r => [r.fileNo ?? '', r.name, r.phone ?? '', r.invoiced, r.paid, r.due, r.lastPayment ?? '']),
      ['', t('reports.out.totalRow'), '', '', '', total, '']],
  } : null)

  const remind = (r: Row) => {
    if (!r.phone) return
    const url = whatsappLink(r.phone, t('reports.out.message', { name: r.name, clinic: clinicName, amount: money(r.due) }))
    if (platform() !== 'web') openExternal(url); else window.open(url, '_blank', 'noopener')
  }

  if (rows && !rows.length) {
    return (
      <Card data-testid="rp-empty">
        <EmptyState icon={<PartyPopper />} title={t('reports.out.emptyTitle')} description={t('reports.out.emptyDesc')}
          actions={<Button variant="primary" to="/invoices" icon={<Receipt />}>{t('reports.out.goInvoices')}</Button>} />
      </Card>
    )
  }
  const loading = !rows
  const cols: Column<Row>[] = [
    { key: 'p', header: t('patient'), render: r => (
      <div className="row gap-3" style={{ minWidth: 0 }}>
        <Avatar name={r.name} src={r.photo} size="sm" />
        <div className="grow">
          <Link to={`/patients/${r.patientId}`} className="cell-main truncate" style={{ display: 'block', color: 'var(--text)' }}><bdi>{r.name}</bdi></Link>
          <div className="cell-sub">{r.fileNo !== undefined && <>{t('fileNo')} <span className="num">{r.fileNo}</span></>}{r.phone && <span className="hide-mobile"><span className="subtle"> · </span><span className="ltr">{formatPhone(r.phone)}</span></span>}</div>
        </div>
      </div>) },
    { key: 'i', header: t('reports.out.invoiced'), className: 'num', hideBelow: 'md', render: r => <span className="money" style={{ fontWeight: 500 }}>{money(r.invoiced)}</span> },
    { key: 'pd', header: t('reports.out.paid'), className: 'num', hideBelow: 'md', render: r => <span className="money" style={{ fontWeight: 500 }}>{money(r.paid)}</span> },
    { key: 'd', header: t('reports.out.due'), className: 'num', render: r => <span className="money neg">{money(r.due)}</span> },
    { key: 'l', header: t('reports.out.lastPayment'), hideBelow: 'lg', render: r => r.lastPayment ? <span className="rp-tnum">{fmtDate(r.lastPayment, lang)}</span> : <span className="subtle">{t('reports.out.never')}</span> },
    { key: 'w', header: '', className: 'actions', render: r => r.phone
      ? <Button size="sm" variant="ghost" className="rp-wa" icon={<MessageCircle />} onClick={e => { e.stopPropagation(); remind(r) }} title={t('reports.out.remindTitle')} aria-label={t('reports.out.remindTitle')}><span className="hide-mobile">{t('reports.out.remind')}</span></Button>
      : <span className="subtle text-xs hide-mobile">{t('reports.out.noPhone')}</span> },
  ]

  return (
    <div className="rp-section" data-testid="rp-outstanding">
      <div className="rp-kpis">
        <KpiCard testId="kpi-out-total" loading={loading} tone="danger" icon={<HandCoins />} label={t('reports.out.total')} value={<span className="money">{money(total)}</span>} />
        <KpiCard loading={loading} tone="orange" icon={<Users />} label={t('reports.out.patients')} value={<span className="num">{formatNumber(rows?.length ?? 0, lang)}</span>} />
        <KpiCard loading={loading} tone="accent" icon={<Scale />} label={t('reports.out.avg')} value={<span className="money">{money(rows?.length ? round2(total / rows.length) : 0)}</span>} />
        <KpiCard loading={loading} tone="purple" icon={<TrendingUp />} label={t('reports.out.max')} value={<span className="money">{money(rows?.[0]?.due ?? 0)}</span>} sub={rows?.[0] ? <bdi>{rows[0].name}</bdi> : undefined} />
      </div>
      <Card className="rp-card" data-testid="table-outstanding">
        <CardHeader icon={<HandCoins />} title={t('reports.out.tableTitle')} subtitle={t('reports.out.tableSub')} actions={rows ? <span className="text-sm muted">{plural('reports.n.patients', rows.length)}</span> : undefined} />
        <div className="card-body">
          <DataTable compact columns={cols} rows={pg.slice} rowKey={r => r.patientId}
            rowClassName={() => undefined}
            footer={<>
              {rows && rows.length > 0 && (
                <div className="table-footer rp-out-total"><span className="strong">{t('reports.out.totalRow')}</span><span className="money neg" data-testid="out-total">{money(total)}</span></div>
              )}
              <Pagination {...pg} />
            </>} />
        </div>
      </Card>
    </div>
  )
}
