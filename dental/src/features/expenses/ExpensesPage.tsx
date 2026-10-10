import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Download, Hash, History, Pencil, Plus, ReceiptText, Search, Trash2, Wallet, X } from 'lucide-react'
import { db, logActivity } from '@/db'
import { todayISO } from '@/db/ids'
import type { Expense, ExpenseCategory } from '@/db/types'
import { EXPENSE_CATEGORIES } from '@/db/types'
import {
  Alert, Button, Card, CardHeader, DataTable, EmptyState, IconButton, Input, PageHeader, Pagination, Segmented, Select, Skeleton, StatCard, useConfirmDelete, usePagination, useToast,
  type Column,
} from '@/ui'
import { useI18n } from '@/i18n'
import { useDebounced, useIsMobile, useMoney, useUsers } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { addDays, fmtDate, fmtMonth, relativeDay, startOfMonth } from '@/lib/dates'
import { matches } from '@/lib/format'
import { saveText } from '@/platform'
import { RowMenu } from '@/features/inventory/RowMenu'
import { tn } from '@/features/inventory/plural'
import {
  CATEGORY_COLOR_VAR, categoryBreakdown, filterExpenses, isFullMonth, isValidPeriod, monthPeriod, periodDays, periodDelta, periodTotal, previousPeriod, shiftMonth, sortExpenses,
  toCSV, topCategory, type Period,
} from './lib'
import { CATEGORY_ICON, ExpenseCategoryBadge } from './parts'
import ExpenseFormModal from './ExpenseFormModal'
import './expenses.css'

type Mode = 'month' | 'custom'

export default function ExpensesPage() {
  const { t, lang } = useI18n()
  const money = useMoney()
  const mobile = useIsMobile()
  const toast = useToast()
  const confirmDelete = useConfirmDelete()
  const { user } = useSession()
  const { readOnly } = useLicense()
  const users = useUsers(false)
  const today = todayISO()

  const [mode, setMode] = useState<Mode>('month')
  const [month, setMonth] = useState<Period>(() => monthPeriod(today))
  const [custom, setCustom] = useState<Period>(() => ({ from: addDays(today, -29), to: today }))
  const lastCustom = useRef<Period>(custom)       // the range keeps its last valid value while a date is being retyped
  const customValid = isValidPeriod(custom)
  if (customValid) lastCustom.current = custom
  const period = mode === 'month' ? month : customValid ? custom : lastCustom.current
  const prev = previousPeriod(period)

  const list = useLiveQuery(() => db.expenses.where('date').between(period.from, period.to, true, true).toArray(), [period.from, period.to])
  const prevList = useLiveQuery(() => db.expenses.where('date').between(prev.from, prev.to, true, true).toArray(), [prev.from, prev.to])
  const everCount = useLiveQuery(() => db.expenses.count(), [])

  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [category, setCategory] = useState<ExpenseCategory | ''>('')
  const [form, setForm] = useState<{ open: boolean; expense?: Expense }>({ open: false })

  const total = useMemo(() => periodTotal(list ?? []), [list])
  const prevTotal = useMemo(() => periodTotal(prevList ?? []), [prevList])
  const delta = list && prevList && (total > 0 || prevTotal > 0) ? periodDelta(total, prevTotal) : null
  const breakdown = useMemo(() => categoryBreakdown(list ?? []), [list])
  const top = topCategory(breakdown)
  const rows = useMemo(() => sortExpenses(filterExpenses(list ?? [], { q: dq, category }, matches)), [list, dq, category])
  const pg = usePagination(rows, mobile ? 15 : 20)
  const filteredTotal = periodTotal(rows)
  const userName = (id?: string) => users.find(u => u.id === id)?.name ?? '—'
  const filtered = !!(dq || category)

  const periodLabel = (p: Period) => (isFullMonth(p) ? fmtMonth(p.from, lang) : `${fmtDate(p.from, lang)} – ${fmtDate(p.to, lang)}`)
  const atCurrentMonth = month.from >= startOfMonth(today)

  const remove = async (e: Expense) => {
    if (!(await confirmDelete(t('expenses.deleteDesc', { desc: e.description })))) return
    await db.expenses.delete(e.id)
    toast.success(t('expenses.toast.deleted'), <><bdi>{e.description}</bdi> · <span className="money">{money(e.amount)}</span></>)
    void logActivity({ type: 'expense', action: 'delete', entityId: e.id, by: user?.id, message: t('expenses.act.deleted', { desc: e.description }) })
  }

  const exportCsv = async () => {
    const data = [[t('expenses.col.date'), t('expenses.col.category'), t('expenses.col.description'), t('expenses.col.vendor'), t('expenses.col.method'), t('expenses.col.amount'), t('expenses.col.by')],
      ...rows.map(e => [e.date, t(`exp.${e.category}`), e.description, e.vendor ?? '', e.method ? t(`pay.${e.method}`) : '', e.amount, e.by ? userName(e.by) : ''])]
    await saveText(`expenses-${period.from}_${period.to}.csv`, toCSV(data), 'text/csv;charset=utf-8')
    toast.success(t('expenses.toast.exported'))
  }

  const pickCategory = (c: ExpenseCategory) => setCategory(cur => (cur === c ? '' : c))

  // ---- table ----
  const actions = (e: Expense) => readOnly ? null : (
    <div className="inv-exp-actions" onClick={ev => ev.stopPropagation()}>
      <IconButton variant="ghost" size="sm" label={t('edit')} onClick={() => setForm({ open: true, expense: e })}><Pencil /></IconButton>
      <IconButton variant="ghost" size="sm" label={t('delete')} className="inv-exp-del" onClick={() => void remove(e)}><Trash2 /></IconButton>
    </div>
  )
  const columns: Column<Expense>[] = [
    { key: 'date', header: t('expenses.col.date'), render: e => <span className="inv-exp-date">{fmtDate(e.date, lang)}</span> },
    { key: 'category', header: t('expenses.col.category'), render: e => <ExpenseCategoryBadge category={e.category} /> },
    { key: 'description', header: t('expenses.col.description'), render: e => <div className="inv-exp-desc"><div className="cell-main truncate"><bdi>{e.description}</bdi></div>{e.vendor && <div className="cell-sub truncate inv-exp-vendor-sub"><bdi>{e.vendor}</bdi></div>}</div> },
    { key: 'vendor', header: t('expenses.col.vendor'), render: e => <span className="truncate inv-exp-vendor">{e.vendor ? <bdi>{e.vendor}</bdi> : <span className="muted">—</span>}</span>, className: 'inv-exp-col-vendor' },
    { key: 'method', header: t('expenses.col.method'), render: e => (e.method ? <span className="inv-exp-method inv-exp-nowrap">{t(`pay.${e.method}`)}</span> : <span className="muted">—</span>), hideBelow: 'lg' },
    { key: 'amount', header: t('expenses.col.amount'), render: e => <span className="money inv-exp-amount">{money(e.amount)}</span>, className: 'num' },
    { key: 'by', header: t('expenses.col.by'), render: e => <span className="muted text-sm inv-exp-nowrap">{userName(e.by)}</span>, hideBelow: 'lg' },
    { key: 'actions', header: <span className="sr-only">{t('actions')}</span>, render: actions, className: 'actions', width: 96 },
  ]

  // phone: grouped by day
  const groups = useMemo(() => {
    const out: { date: string; items: Expense[]; total: number }[] = []
    for (const e of pg.slice) {
      const g = out[out.length - 1]
      if (g && g.date === e.date) { g.items.push(e); g.total += e.amount } else out.push({ date: e.date, items: [e], total: e.amount })
    }
    return out
  }, [pg.slice])

  const loading = list === undefined || prevList === undefined
  const deltaLabel = t('expenses.stat.vsPrev')
  const TopIcon = top ? CATEGORY_ICON[top.category] : ReceiptText

  return (
    <div className="page inv-exp-page">
      <PageHeader title={t('expenses.title')} subtitle={t('expenses.subtitle')} actions={<>
        {mobile
          ? <Button variant="secondary" icon={<Download />} aria-label={t('expenses.exportCsv')} title={t('expenses.exportCsv')} onClick={exportCsv} disabled={!rows.length} />
          : <Button variant="secondary" icon={<Download />} onClick={exportCsv} disabled={!rows.length}>{t('expenses.exportCsv')}</Button>}
        <Button variant="primary" icon={<Plus />} onClick={() => setForm({ open: true })} disabled={readOnly}>{t('expenses.newExpense')}</Button>
      </>} />
      {readOnly && <Alert tone="warning" className="mb-4">{t('trial.readonly')}</Alert>}

      {/* period */}
      <div className="card inv-exp-period">
        <Segmented<Mode> value={mode} onChange={setMode} options={[
          { value: 'month', label: t('expenses.period.month'), icon: <CalendarDays /> },
          { value: 'custom', label: t('expenses.period.custom'), icon: <CalendarRange /> },
        ]} />
        {mode === 'month' ? (
          <div className="inv-exp-nav">
            <IconButton variant="ghost" label={t('expenses.period.prev')} onClick={() => setMonth(m => shiftMonth(m, -1))}><ChevronLeft /></IconButton>
            <div className="inv-exp-month">{fmtMonth(month.from, lang)}</div>
            <IconButton variant="ghost" label={t('expenses.period.next')} onClick={() => setMonth(m => shiftMonth(m, 1))} disabled={atCurrentMonth}><ChevronRight /></IconButton>
            {!atCurrentMonth && <Button variant="soft" size="sm" onClick={() => setMonth(monthPeriod(today))}>{t('thisMonth')}</Button>}
          </div>
        ) : (
          <div className="inv-exp-range">
            <Input type="date" aria-label={t('expenses.period.from')} value={custom.from} max={custom.to || undefined} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} invalid={!customValid} />
            <span className="muted inv-exp-range-sep">{t('to')}</span>
            <Input type="date" aria-label={t('expenses.period.to')} value={custom.to} min={custom.from || undefined} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} invalid={!customValid} />
            {!customValid && <span className="field-error inv-exp-range-err">{t('expenses.period.invalid')}</span>}
          </div>
        )}
        <div className="inv-exp-period-info">
          <span>{tn(t, lang, 'expenses.period.days', periodDays(period))}</span>
        </div>
      </div>

      {/* stats */}
      {everCount !== 0 && <div className="inv-exp-stats">
        {loading ? [0, 1, 2, 3].map(i => <div key={i} className="card stat-card"><Skeleton w={46} h={46} r={14} /><div className="grow col gap-2"><Skeleton w="50%" /><Skeleton w="70%" h={22} /></div></div>) : <>
          <StatCard tone="primary" icon={<Wallet />} label={t('expenses.stat.total')} value={<span className="money">{money(total)}</span>}
            delta={delta} deltaLabel={deltaLabel} sub={delta !== null ? undefined : total > 0 ? t('expenses.stat.noPrev') : t('expenses.stat.noExpenses')} />
          <StatCard tone="purple" icon={<TopIcon />} label={t('expenses.stat.top')} value={top ? t(`exp.${top.category}`) : '—'}
            sub={top ? <><span className="money">{money(top.total)}</span> · {t('expenses.ofTotal', { pct: top.pct })}</> : t('expenses.stat.noExpenses')}
            onClick={top ? () => pickCategory(top.category) : undefined} />
          <StatCard tone="info" icon={<Hash />} label={t('expenses.stat.count')} value={<span className="num">{list!.length}</span>}
            sub={list!.length ? <>{t('expenses.stat.avg')}: <span className="money">{money(total / list!.length)}</span></> : t('expenses.stat.noExpenses')} />
          <StatCard tone="orange" icon={<History />} label={t('expenses.stat.prev')} value={<span className="money">{money(prevTotal)}</span>} sub={periodLabel(prev)} />
        </>}
      </div>}

      {!loading && list!.length === 0 ? (
        <div className="card">
          <EmptyState icon={<ReceiptText />} title={t('expenses.empty.title')} description={everCount ? t('expenses.empty.descPeriod') : t('expenses.empty.desc')}
            actions={!readOnly && <Button variant="primary" icon={<Plus />} onClick={() => setForm({ open: true })}>{everCount ? t('expenses.newExpense') : t('expenses.addFirst')}</Button>} />
        </div>
      ) : (
        <>
          {/* breakdown */}
          <Card className="inv-exp-breakdown">
            <CardHeader title={t('expenses.breakdown.title')} subtitle={t('expenses.breakdown.subtitle')}
              actions={!loading && <span className="money inv-exp-bd-total">{money(total)}</span>} />
            <div className="card-body">
              {loading ? <div className="col gap-3"><Skeleton h={14} r={8} /><Skeleton h={36} /><Skeleton h={36} /><Skeleton h={36} /></div> : <>
                <div className="inv-exp-stack" role="img" aria-label={t('expenses.breakdown.title')}>
                  {breakdown.map(s => <span key={s.category} style={{ width: `${s.pct}%`, background: CATEGORY_COLOR_VAR[s.category] }} title={`${t(`exp.${s.category}`)} · ${s.pct}%`} />)}
                </div>
                <div className="inv-exp-bars">
                  {breakdown.map(s => {
                    const I = CATEGORY_ICON[s.category]
                    return (
                      <button key={s.category} type="button" className={`inv-exp-bar${category === s.category ? ' active' : ''}${category && category !== s.category ? ' dim' : ''}`} onClick={() => pickCategory(s.category)} aria-pressed={category === s.category}>
                        <span className="inv-exp-bar-icon" style={{ color: CATEGORY_COLOR_VAR[s.category] }}><I /></span>
                        <span className="inv-exp-bar-main">
                          <span className="inv-exp-bar-head">
                            <span className="inv-exp-bar-label">{t(`exp.${s.category}`)}<span className="inv-exp-bar-count">{tn(t, lang, 'expenses.entries', s.count)}</span></span>
                            <span className="inv-exp-bar-amount"><span className="money">{money(s.total)}</span><span className="inv-exp-bar-pct num">{s.pct}%</span></span>
                          </span>
                          <span className="inv-exp-track"><span style={{ width: `${Math.max(2, s.pct)}%`, background: CATEGORY_COLOR_VAR[s.category] }} /></span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>}
            </div>
          </Card>

          {/* list */}
          <div className="inv-exp-list-head">
            <div className="inv-exp-list-title">{t('expenses.list.title')}<span className="inv-exp-count num">{rows.length}</span></div>
            <div className="inv-exp-toolbar">
              <div className="inv-exp-search">
                <Input iconStart={<Search />} placeholder={t('expenses.searchPlaceholder')} value={q} onChange={e => setQ(e.target.value)} clearable onClear={() => setQ('')} aria-label={t('search')} />
              </div>
              <Select className="inv-exp-catsel" aria-label={t('expenses.col.category')} value={category} onChange={e => setCategory(e.target.value as ExpenseCategory | '')}
                options={[{ value: '', label: t('expenses.allCategories') }, ...EXPENSE_CATEGORIES.map(c => ({ value: c, label: t(`exp.${c}`) }))]} />
            </div>
          </div>

          {loading ? (
            <div className="card card-pad col gap-3">{[0, 1, 2, 3, 4].map(i => <div key={i} className="row gap-3"><Skeleton w={90} /><Skeleton w={70} h={22} r={11} /><div className="grow"><Skeleton w="60%" /></div><Skeleton w={80} /></div>)}</div>
          ) : rows.length === 0 ? (
            <div className="card">
              <EmptyState compact icon={<Search />} title={t('noResults')} description={t('expenses.noResults.desc')}
                actions={filtered && <Button variant="secondary" icon={<X />} onClick={() => { setQ(''); setCategory('') }}>{t('expenses.clearFilters')}</Button>} />
            </div>
          ) : mobile ? (
            <div className="inv-exp-groups">
              {groups.map(g => (
                <div key={g.date} className="inv-exp-group">
                  <div className="inv-exp-group-head"><span>{relativeDay(g.date, lang)}</span><span className="money">{money(g.total)}</span></div>
                  <div className="card inv-exp-group-card">
                    {g.items.map(e => {
                      const I = CATEGORY_ICON[e.category]
                      return (
                        <div key={e.id} className="inv-exp-item" onClick={() => !readOnly && setForm({ open: true, expense: e })}>
                          <span className={`inv-exp-item-icon cat-${e.category}`} style={{ color: CATEGORY_COLOR_VAR[e.category] }}><I /></span>
                          <div className="grow">
                            <div className="inv-exp-item-desc"><bdi>{e.description}</bdi></div>
                            <div className="inv-exp-item-sub">{t(`exp.${e.category}`)}{e.vendor && <> · <bdi>{e.vendor}</bdi></>}{e.method && ` · ${t(`pay.${e.method}`)}`}</div>
                          </div>
                          <div className="inv-exp-item-end">
                            <span className="money inv-exp-item-amount">{money(e.amount)}</span>
                            {!readOnly && <RowMenu label={t('actions')} size="md" items={[
                              { label: t('edit'), icon: <Pencil />, onClick: () => setForm({ open: true, expense: e }) },
                              { label: t('delete'), icon: <Trash2 />, danger: true, onClick: () => void remove(e) },
                            ]} />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div className="card inv-exp-mtotal"><span>{filtered ? t('expenses.filteredTotal') : t('total')}</span><span className="money">{money(filteredTotal)}</span></div>
              {pg.pages > 1 && <div className="card"><Pagination {...pg} /></div>}
            </div>
          ) : (
            <DataTable columns={columns} rows={pg.slice} rowKey={e => e.id} onRowClick={readOnly ? undefined : e => setForm({ open: true, expense: e })}
              footer={<>
                <div className="inv-exp-tfoot"><span>{filtered ? t('expenses.filteredTotal') : t('total')}</span><span className="money">{money(filteredTotal)}</span></div>
                <Pagination {...pg} />
              </>} />
          )}
        </>
      )}

      <ExpenseFormModal open={form.open} expense={form.expense} onClose={() => setForm({ open: false })} />
    </div>
  )
}
