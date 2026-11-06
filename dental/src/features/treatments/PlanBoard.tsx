// The plan cards of the patient tab and the items table inside them.
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Ban, CalendarDays, Check, CheckCheck, ChevronDown, ClipboardList, EllipsisVertical, Pencil, Play, Plus, Printer, Receipt, RotateCcw, StickyNote, Trash2, Undo2, UserRound,
} from 'lucide-react'
import type { TreatmentItem, TreatmentPlan, TreatmentStatus, User } from '@/db/types'
import { useI18n } from '@/i18n'
import { useIsMobile, useMoney } from '@/app/hooks'
import { Badge, Button, DataTable, EmptyState, IconBox, IconButton, Menu, ProgressBar, type Column, type MenuItemDef } from '@/ui'
import { fmtDate } from '@/lib/dates'
import { itemTotal, nextStatuses, planTotals, tn } from './lib'
import { ItemStatusBadge, nameOf, PlanStatusBadge, ToothBadge } from './parts'

export interface ItemHandlers {
  readOnly: boolean
  users: User[]
  onStatus: (i: TreatmentItem, s: TreatmentStatus) => void
  onEdit: (i: TreatmentItem) => void
  onDelete: (i: TreatmentItem) => void
}

/** The inline workflow buttons and the row menu of one item. */
function ItemActions({ item: i, h, compact }: { item: TreatmentItem; h: ItemHandlers; compact?: boolean }) {
  const { t } = useI18n()
  const next = nextStatuses(i)
  const ro = h.readOnly
  const menu: MenuItemDef[] = [
    { label: t('edit'), icon: <Pencil />, onClick: () => h.onEdit(i), disabled: ro },
    ...(i.status === 'in_progress' ? [{ label: t('treatments.act.backToPlanned'), icon: <Undo2 />, onClick: () => h.onStatus(i, 'planned'), disabled: ro }] : []),
    ...(i.status === 'completed' && next.includes('in_progress') ? [{ label: t('treatments.act.reopen'), icon: <Undo2 />, onClick: () => h.onStatus(i, 'in_progress'), disabled: ro }] : []),
    ...(next.includes('cancelled') ? [{ label: t('treatments.act.cancel'), icon: <Ban />, onClick: () => h.onStatus(i, 'cancelled'), disabled: ro }] : []),
    ...(!i.invoiceId ? [{ sep: true }, { label: t('delete'), icon: <Trash2 />, danger: true, onClick: () => h.onDelete(i), disabled: ro }] : []),
  ]
  return (
    <div className="tr-item-actions" onClick={e => e.stopPropagation()}>
      {i.status === 'planned' && !compact && <Button size="sm" variant="ghost" icon={<Play />} disabled={ro} onClick={() => h.onStatus(i, 'in_progress')}>{t('treatments.act.start')}</Button>}
      {(i.status === 'planned' || i.status === 'in_progress') && (
        <Button size="sm" variant="soft" className="tr-btn-done" icon={<Check />} disabled={ro} onClick={() => h.onStatus(i, 'completed')}>{t('treatments.act.complete')}</Button>
      )}
      {i.status === 'cancelled' && <Button size="sm" variant="ghost" icon={<RotateCcw />} disabled={ro} onClick={() => h.onStatus(i, 'planned')}>{t('treatments.act.restore')}</Button>}
      {i.status === 'completed' && i.invoiceId && (
        <Link to={`/invoices/${i.invoiceId}`} className="tr-billed" title={t('treatments.item.openInvoice')}><Receipt />{t('treatments.item.billed')}</Link>
      )}
      <Menu trigger={() => <IconButton variant="ghost" size="sm" label={t('more')}><EllipsisVertical /></IconButton>} items={compact && i.status === 'planned'
        ? [{ label: t('treatments.act.start'), icon: <Play />, onClick: () => h.onStatus(i, 'in_progress'), disabled: ro }, ...menu] : menu} />
    </div>
  )
}

/** Price − discount = total, the discount shown only when there is one. */
function Amount({ item: i }: { item: TreatmentItem }) {
  const money = useMoney()
  return (
    <span className="tr-amount">
      {i.discount > 0 && <span className="money tr-strike">{money(i.price)}</span>}
      <span className={`money${i.status === 'cancelled' ? ' muted' : ''}`}>{money(itemTotal(i))}</span>
    </span>
  )
}

function ItemSub({ item: i, users, showDoctor }: { item: TreatmentItem; users: User[]; showDoctor?: boolean }) {
  const { lang } = useI18n()
  const parts: ReactNode[] = []
  if (i.status === 'completed' && i.completedAt) parts.push(<span key="d" className="row gap-1"><CheckCheck className="tr-ic" />{fmtDate(i.completedAt, lang)}</span>)
  else if (i.plannedDate) parts.push(<span key="d" className="row gap-1"><CalendarDays className="tr-ic" />{fmtDate(i.plannedDate, lang)}</span>)
  if (showDoctor && i.doctorId) parts.push(<span key="u" className="row gap-1"><UserRound className="tr-ic" />{nameOf(users, i.doctorId)}</span>)
  if (i.notes) parts.push(<span key="n" className="row gap-1 tr-note-sub"><StickyNote className="tr-ic" /><span className="truncate">{i.notes}</span></span>)
  if (!parts.length) return null
  return <div className="cell-sub tr-item-sub">{parts}</div>
}

/** Items of a plan (or of the "outside plans" card): a table on wide screens, stacked rows on phones. */
export function ItemsTable({ items, h, empty }: { items: TreatmentItem[]; h: ItemHandlers; empty?: ReactNode }) {
  const { t } = useI18n()
  const mobile = useIsMobile()
  if (items.length === 0) return <>{empty}</>
  if (mobile) {
    return (
      <div className="tr-mlist">
        {items.map(i => (
          <div key={i.id} className={`tr-mitem st-${i.status}`}>
            <div className="tr-mitem-top">
              <ToothBadge tooth={i.tooth} surfaces={i.surfaces} size="sm" />
              <span className="tr-mitem-name">{i.procedureName}</span>
              <Amount item={i} />
            </div>
            <ItemSub item={i} users={h.users} showDoctor />
            <div className="tr-mitem-bottom">
              <ItemStatusBadge status={i.status} />
              <span className="grow" />
              <ItemActions item={i} h={h} compact />
            </div>
          </div>
        ))}
      </div>
    )
  }
  const cols: Column<TreatmentItem>[] = [
    { key: 'tooth', header: t('tooth'), width: 104, render: i => <ToothBadge tooth={i.tooth} surfaces={i.surfaces} /> },
    { key: 'proc', header: t('treatments.col.procedure'), render: i => <div className="tr-item-cell"><div className="cell-main">{i.procedureName}</div><ItemSub item={i} users={h.users} /></div> },
    { key: 'doctor', header: t('doctor'), hideBelow: 'lg', render: i => <span className="text-sm muted tr-nowrap">{nameOf(h.users, i.doctorId) || '—'}</span> },
    { key: 'amount', header: t('total'), className: 'num', width: 120, render: i => <Amount item={i} /> },
    { key: 'status', header: t('status'), width: 130, render: i => <ItemStatusBadge status={i.status} /> },
    { key: 'actions', header: <span className="sr-only">{t('actions')}</span>, className: 'actions', width: 210, render: i => <ItemActions item={i} h={h} /> },
  ]
  return <DataTable className="tr-flat-table tr-items" compact columns={cols} rows={items} rowKey={i => i.id} rowClassName={i => `st-${i.status}`} onRowClick={h.readOnly ? undefined : h.onEdit} />
}

export interface PlanHandlers {
  onAddItem: (p: TreatmentPlan) => void
  onApprove: (p: TreatmentPlan) => void
  onPrint: (p: TreatmentPlan) => void
  onEdit: (p: TreatmentPlan) => void
  onCancel: (p: TreatmentPlan) => void
  onReopen: (p: TreatmentPlan) => void
  onDelete: (p: TreatmentPlan) => void
}

/** One treatment plan: header with status, doctor and value, progress, the items, totals. */
export function PlanCard({ plan, items, h, ph, defaultOpen = true }: { plan: TreatmentPlan; items: TreatmentItem[]; h: ItemHandlers; ph: PlanHandlers; defaultOpen?: boolean }) {
  const { t, lang } = useI18n()
  const money = useMoney()
  const mobile = useIsMobile()
  const [open, setOpen] = useState(defaultOpen)
  const tot = planTotals(items)
  const ro = h.readOnly
  const closed = plan.status === 'cancelled'
  const doctor = nameOf(h.users, plan.doctorId)
  const menu: MenuItemDef[] = [
    { label: t('treatments.plan.edit'), icon: <Pencil />, onClick: () => ph.onEdit(plan), disabled: ro },
    ...(mobile ? [{ label: t('treatments.plan.print'), icon: <Printer />, onClick: () => ph.onPrint(plan) }] : []),
    closed
      ? { label: t('treatments.plan.reopen'), icon: <RotateCcw />, onClick: () => ph.onReopen(plan), disabled: ro }
      : { label: t('treatments.plan.cancel'), icon: <Ban />, onClick: () => ph.onCancel(plan), disabled: ro || plan.status === 'completed' },
    { sep: true },
    { label: t('treatments.plan.delete'), icon: <Trash2 />, danger: true, onClick: () => ph.onDelete(plan), disabled: ro },
  ]

  return (
    <section className={`card tr-plan st-${plan.status}${open ? '' : ' collapsed'}`} aria-label={plan.title}>
      <header className="tr-plan-head">
        <button type="button" className="tr-plan-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <IconBox className="tr-plan-icon"><ClipboardList /></IconBox>
          <span className="tr-plan-id">
            <span className="tr-plan-title-row">
              <span className="tr-plan-title">{plan.title}</span>
              <PlanStatusBadge status={plan.status} />
            </span>
            <span className="tr-plan-meta">
              {doctor && <span className="row gap-1"><UserRound className="tr-ic" />{doctor}</span>}
              <span className="row gap-1"><CalendarDays className="tr-ic" />{fmtDate(plan.createdAt, lang)}</span>
              <span>{tn(t, lang, 'treatments.n.items', tot.count)}</span>
            </span>
          </span>
          <span className="tr-plan-value">
            <span className="money">{money(tot.total)}</span>
            <span className="tr-plan-value-sub">{tot.discount > 0 ? <>{t('treatments.plan.afterDiscount')} <span className="money">{money(tot.discount)}</span></> : t('treatments.plan.value')}</span>
          </span>
          <ChevronDown className={`tr-chev${open ? ' open' : ''}`} />
        </button>
      </header>

      {tot.count > 0 && (
        <div className="tr-plan-progress">
          <span className="text-sm muted">{t('treatments.plan.progress', { done: tot.done, count: tot.count })}</span>
          <ProgressBar value={tot.progress} tone={tot.progress >= 100 ? 'var(--success)' : undefined} className="grow" />
          <span className="text-sm strong num">{tot.progress}%</span>
        </div>
      )}

      {open && (
        <>
          <div className="tr-plan-bar">
            {!closed && <Button size="sm" variant="soft" icon={<Plus />} disabled={ro} onClick={() => ph.onAddItem(plan)}>{t('treatments.plan.addItem')}</Button>}
            {plan.status === 'draft' && <Button size="sm" variant="success" icon={<Check />} disabled={ro || tot.count === 0} onClick={() => ph.onApprove(plan)}>{t('treatments.plan.approve')}</Button>}
            {!mobile && <Button size="sm" variant="ghost" icon={<Printer />} onClick={() => ph.onPrint(plan)}>{t('treatments.plan.print')}</Button>}
            <span className="grow" />
            <Menu trigger={() => <IconButton variant="ghost" size="sm" label={t('more')}><EllipsisVertical /></IconButton>} items={menu} />
          </div>
          <ItemsTable items={items} h={h} empty={
            <EmptyState compact icon={<ClipboardList />} title={t('treatments.plan.emptyTitle')} description={t('treatments.plan.emptyDesc')}
              actions={!ro && !closed && <Button variant="primary" size="sm" icon={<Plus />} onClick={() => ph.onAddItem(plan)}>{t('treatments.plan.addItem')}</Button>} />
          } />
          {(tot.count > 0 || plan.notes) && (
            <footer className="tr-plan-foot">
              <div className="tr-plan-notes">{plan.notes && <><StickyNote className="tr-ic" /><span>{plan.notes}</span></>}</div>
              {tot.count > 0 && (
                <dl className="tr-plan-totals">
                  <div><dt>{t('subtotal')}</dt><dd><span className="money">{money(tot.subtotal)}</span></dd></div>
                  {tot.discount > 0 && <div><dt>{t('discount')}</dt><dd><span className="money">{money(-tot.discount)}</span></dd></div>}
                  <div><dt>{t('treatments.plan.doneValue')}</dt><dd><span className="money tr-done-val">{money(tot.doneValue)}</span></dd></div>
                  <div className="grand"><dt>{t('total')}</dt><dd><span className="money">{money(tot.total)}</span></dd></div>
                </dl>
              )}
            </footer>
          )}
        </>
      )}
    </section>
  )
}

/** Small badge used in the register for items that belong to no plan. */
export function NoPlanBadge() {
  const { t } = useI18n()
  return <Badge tone="outline" size="sm">{t('treatments.noPlan')}</Badge>
}
