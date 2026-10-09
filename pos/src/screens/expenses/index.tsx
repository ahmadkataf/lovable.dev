// /expenses: a period, the total and the split by category, the list grouped by day, and the add / edit sheet.
import './i18n'
import './expenses.css'
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Download, Wallet, Home, Users, Zap, Package, Truck, Wrench, Tag, Trash2, Banknote, type LucideIcon } from 'lucide-react'
import { db } from '../../db'
import type { Expense } from '../../db/types'
import { useT } from '../../i18n'
import { Button, Empty, Field, Input, Modal, Seg, Spinner, SwitchRow, colorFor, useIsMobile } from '../../components/ui'
import { formatMoney, parseNumber, round } from '../../lib/money'
import { formatDay, formatTime, formatDate, periodRange, startOfMonth, toDateInput, fromDateInput } from '../../lib/format'
import { saveCsv } from '../../lib/csv'
import { uid } from '../../lib/ids'
import { toast, confirmDialog, useSettings, useStore, useUser, isAdmin } from '../../state/store'
import { AmountPad } from '../inventory/shared'
import { EXPENSE_CATEGORIES, categoryTotals, fromDateTimeInput, groupByDay, isBuiltinCategory, sumExpenses, toDateTimeInput, type ExpensePeriod } from './logic'

const ICONS: Record<string, LucideIcon> = { rent: Home, salaries: Users, utilities: Zap, goods: Package, transport: Truck, maintenance: Wrench, other: Tag }
const iconFor = (c: string): LucideIcon => ICONS[c] ?? Tag

export default function ExpensesScreen() {
  const t = useT()
  const user = useUser()
  const admin = isAdmin(user)
  const settings = useSettings()
  const c = settings.currency
  const mobile = useIsMobile()
  const [period, setPeriod] = useState<ExpensePeriod>('today')
  const [custom, setCustom] = useState(() => ({ from: startOfMonth(Date.now()), to: Date.now() }))
  const range = periodRange(period, custom)
  const expenses = useLiveQuery(() => db.expenses.where('createdAt').between(range.from, range.to, true, true).reverse().sortBy('createdAt'), [range.from, range.to])
  const users = useLiveQuery(() => db.users.toArray(), [], [])
  const [editor, setEditor] = useState<{ expense?: Expense } | null>(null)
  const catLabel = (cat: string) => (isBuiltinCategory(cat) ? t('expenses.cat.' + cat) : cat)
  const userName = (id: string) => users.find(u => u.id === id)?.name ?? ''

  const openEdit = (e: Expense) => {
    if (!admin && e.userId !== user?.id) { toast(t('expenses.notAllowed'), 'warn'); return }
    setEditor({ expense: e })
  }
  const exportCsv = async () => {
    if (!expenses?.length) return
    const rows: (string | number)[][] = [[t('common.date'), t('common.time'), t('expenses.category'), t('common.note'), t('common.amount'), t('common.user'), t('expenses.fromDrawer')]]
    for (const e of expenses) rows.push([formatDate(e.createdAt), formatTime(e.createdAt), catLabel(e.category), e.note ?? '', e.amount, userName(e.userId), e.shiftId ? t('common.yes') : t('common.no')])
    rows.push([], [t('common.total'), '', '', '', sumExpenses(expenses, c.decimals)])
    if (await saveCsv(`expenses-${toDateInput(range.from)}-${toDateInput(range.to)}.csv`, rows)) toast(t('expenses.exported'), 'success')
  }

  const total = expenses ? sumExpenses(expenses, c.decimals) : 0
  const groups = expenses ? groupByDay(expenses, c.decimals) : []
  const cats = expenses ? categoryTotals(expenses, c.decimals) : []

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t('nav.expenses')}</h1>
        <div className="actions">
          <Button variant="outline" icon={<Download size={18} />} iconOnly={mobile} onClick={() => void exportCsv()} disabled={!expenses?.length} title={t('common.export')}>{t('common.export')}</Button>
          {!mobile && <Button variant="primary" icon={<Plus size={18} />} onClick={() => setEditor({})}>{t('expenses.add')}</Button>}
        </div>
      </div>
      <div className="page-body col">
        <Seg block={mobile} value={period} onChange={setPeriod} options={[
          { value: 'today', label: t('common.today') }, { value: 'week', label: t('common.week') }, { value: 'month', label: t('common.month') }, { value: 'custom', label: t('expenses.custom') },
        ]} />
        {period === 'custom' && (
          <div className="ex-range">
            <Field label={t('common.from')}><Input type="date" ltr value={toDateInput(custom.from)} max={toDateInput(custom.to)} onChange={e => e.target.value && setCustom(r => ({ ...r, from: fromDateInput(e.target.value) }))} /></Field>
            <Field label={t('common.to')}><Input type="date" ltr value={toDateInput(custom.to)} min={toDateInput(custom.from)} onChange={e => e.target.value && setCustom(r => ({ ...r, to: fromDateInput(e.target.value) }))} /></Field>
          </div>
        )}
        <div className="stats ex-stats">
          <div className="stat ex-total"><div className="stat-label"><Wallet size={14} /> {t('expenses.total')}</div><div className="stat-value num">{formatMoney(total, c)}</div><div className="stat-sub">{t('expenses.count', { n: expenses?.length ?? 0 })}</div></div>
          {cats.length > 0 && (
            <div className="stat ex-cats">
              <div className="stat-label">{t('expenses.byCategory')}</div>
              <div className="ex-bars">
                {cats.slice(0, 6).map(ct => {
                  const Icon = iconFor(ct.category)
                  const color = colorFor(ct.category)
                  return (
                    <div key={ct.category} className="ex-bar-row" title={`${catLabel(ct.category)}: ${formatMoney(ct.total, c)} (${ct.pct}%)`}>
                      <span className="ex-bar-label truncate"><Icon size={13} style={{ color }} /> {catLabel(ct.category)}</span>
                      <span className="ex-bar"><span className="ex-bar-fill" style={{ width: `${Math.max(2, ct.pct)}%`, background: color }} /></span>
                      <span className="ex-bar-val num">{formatMoney(ct.total, c)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {!expenses ? <div className="empty"><Spinner /></div> : expenses.length === 0 ? (
          <Empty icon={<Wallet size={32} />} title={t('expenses.empty')} text={t('expenses.emptyText')} action={<Button variant="primary" icon={<Plus size={18} />} onClick={() => setEditor({})}>{t('expenses.add')}</Button>} />
        ) : groups.map(g => (
          <div key={g.day} className="ex-group">
            <div className="ex-day"><span>{formatDay(g.day)}</span><span className="num muted">{formatMoney(g.total, c)}</span></div>
            <div className="card list">
              {g.items.map(e => {
                const Icon = iconFor(e.category)
                return (
                  <button key={e.id} type="button" className="list-row" onClick={() => openEdit(e)}>
                    <span className="ex-ico" style={{ background: colorFor(e.category) }}><Icon size={18} /></span>
                    <span className="grow truncate">
                      <span className="title truncate">{catLabel(e.category)}{e.note ? <span className="muted"> · {e.note}</span> : null}</span>
                      <span className="sub truncate"><span className="num">{formatTime(e.createdAt)}</span>{userName(e.userId) ? ` · ${userName(e.userId)}` : ''}{e.shiftId ? ` · ${t('expenses.drawer')}` : ''}</span>
                    </span>
                    <span className="end num bold">{formatMoney(e.amount, c)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {mobile && <button type="button" className="ex-fab" onClick={() => setEditor({})} aria-label={t('expenses.add')}><Plus size={26} /></button>}
      {editor && <ExpenseModal expense={editor.expense} onClose={() => setEditor(null)} />}
    </div>
  )
}

function ExpenseModal({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const t = useT()
  const user = useUser()
  const admin = isAdmin(user)
  const shift = useStore(s => s.shift)
  const c = useSettings().currency
  const editing = !!expense
  const [v, setV] = useState(expense ? String(round(expense.amount, c.decimals)) : '')
  const [cat, setCat] = useState<string>(expense ? (isBuiltinCategory(expense.category) ? expense.category : 'custom') : '')
  const [customCat, setCustomCat] = useState(expense && !isBuiltinCategory(expense.category) ? expense.category : '')
  const [note, setNote] = useState(expense?.note ?? '')
  const [date, setDate] = useState(toDateTimeInput(expense?.createdAt ?? Date.now()))
  const [drawer, setDrawer] = useState(expense ? !!expense.shiftId : !!shift)
  const [busy, setBusy] = useState(false)
  const closedShift = useLiveQuery(async () => (expense?.shiftId ? ((await db.shifts.get(expense.shiftId))?.status === 'closed') : false), [expense?.shiftId], false)
  const n = parseNumber(v)
  const category = cat === 'custom' ? customCat.trim() : cat
  // a drawer switch only makes sense with an open shift; an expense booked on a closed shift stays as it is
  const drawerLocked = closedShift || (!shift && !expense?.shiftId)
  useEffect(() => { if (!shift && !expense?.shiftId) setDrawer(false) }, [shift, expense?.shiftId])

  const save = async () => {
    if (busy || !user) return
    if (!(n > 0)) { toast(t('expenses.errAmount'), 'error'); return }
    if (!category) { toast(t('expenses.errCategory'), 'error'); return }
    setBusy(true)
    try {
      const shiftId = !drawer ? undefined : closedShift ? expense?.shiftId : shift?.id ?? expense?.shiftId
      const row: Expense = {
        id: expense?.id ?? uid(), amount: round(n, c.decimals), category, note: note.trim() || undefined,
        createdAt: fromDateTimeInput(date, expense?.createdAt ?? Date.now()), userId: expense?.userId ?? user.id, shiftId,
      }
      await db.expenses.put(row)
      toast(editing ? t('common.saved') : t('expenses.saved'), 'success')
      onClose()
    } catch { toast(t('common.error'), 'error'); setBusy(false) }
  }
  const del = async () => {
    if (!expense) return
    if (!(await confirmDialog({ title: t('expenses.deleteTitle'), text: t('common.cannotUndo'), danger: true, okLabel: t('common.delete') }))) return
    await db.expenses.delete(expense.id)
    toast(t('common.deleted'), 'success')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={editing ? t('expenses.edit') : t('expenses.add')} footer={
      <>
        {editing && (admin || expense?.userId === user?.id) && <Button variant="soft-danger" iconOnly icon={<Trash2 size={18} />} onClick={() => void del()} title={t('common.delete')} aria-label={t('common.delete')} style={{ flex: 'none' }} />}
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" loading={busy} disabled={!(n > 0) || !category} onClick={() => void save()}>{t('common.save')}</Button>
      </>
    }>
      <div className="ex-form">
        <AmountPad value={v} onChange={setV} decimals={c.decimals} suffix={c.symbol} onEnter={() => void save()} />
        <div className="col">
          <div className="label">{t('expenses.category')}</div>
          <div className="chips ex-chips">
            {EXPENSE_CATEGORIES.map(k => { const Icon = iconFor(k); return <button key={k} type="button" className={`chip ${cat === k ? 'on' : ''}`} onClick={() => setCat(k)}><Icon size={14} /> {t('expenses.cat.' + k)}</button> })}
            <button type="button" className={`chip ${cat === 'custom' ? 'on' : ''}`} onClick={() => setCat('custom')}><Plus size={14} /> {t('expenses.customCat')}</button>
          </div>
          {cat === 'custom' && <Input value={customCat} onChange={e => setCustomCat(e.target.value)} placeholder={t('expenses.customCatPh')} autoFocus maxLength={40} />}
          <Field label={t('common.note')}><Input value={note} onChange={e => setNote(e.target.value)} placeholder={t('expenses.notePh')} /></Field>
          <Field label={t('expenses.date')}><Input type="datetime-local" ltr value={date} onChange={e => setDate(e.target.value)} max={toDateTimeInput(Date.now() + 60000)} /></Field>
          <SwitchRow label={<span className="row" style={{ gap: 6 }}><Banknote size={16} /> {t('expenses.fromDrawer')}</span>} desc={closedShift ? t('expenses.closedShift') : shift ? t('expenses.fromDrawerDesc') : t('expenses.noShift')} on={drawer} onChange={setDrawer} disabled={drawerLocked} />
        </div>
      </div>
    </Modal>
  )
}
