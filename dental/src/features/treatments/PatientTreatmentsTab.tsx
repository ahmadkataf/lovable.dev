import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarClock, CheckCircle2, ClipboardList, Plus, ReceiptText, Timer, Wallet, Zap } from 'lucide-react'
import { db, logActivity } from '@/db'
import type { Procedure, TreatmentItem, TreatmentPlan, TreatmentStatus } from '@/db/types'
import { useI18n } from '@/i18n'
import { useMoney, useUsers } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { Alert, Button, Card, CardHeader, EmptyState, Skeleton, StatCard, useConfirm, useConfirmDelete, useToast } from '@/ui'
import { chartConditionFor, isValidTooth, itemDate, parseTooth, sortTeeth, summarize, tn, unbilledItems } from './lib'
import { ItemsTable, PlanCard, type ItemHandlers, type PlanHandlers } from './PlanBoard'
import ItemFormModal, { NEW_PLAN, NO_PLAN, type ItemMode } from './ItemFormModal'
import PlanFormModal from './PlanFormModal'
import ChartUpdateModal, { type ChartPrompt } from './ChartUpdateModal'
import BillModal from './BillModal'
import PlanPrintModal from './PlanPrintModal'
import { approvePlan, cancelPlan, deleteItem, deletePlan, reopenPlan, setItemStatus } from './actions'
import './treatments.css'

const OPEN: TreatmentPlan['status'][] = ['draft', 'approved', 'in_progress']
const PLAN_RANK: Record<TreatmentPlan['status'], number> = { in_progress: 0, approved: 1, draft: 2, completed: 3, cancelled: 4 }

interface ItemFormState { open: boolean; mode: ItemMode; item?: TreatmentItem; target?: string; teeth?: number[] }

/** A tab of the patient profile: the treatment plan board. */
export default function PatientTreatmentsTab({ patientId }: { patientId: string }) {
  const { t, lang } = useI18n()
  const money = useMoney()
  const toast = useToast()
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()
  const { user, can } = useSession()
  const { readOnly } = useLicense()
  const users = useUsers(false)
  const [params, setParams] = useSearchParams()

  const data = useLiveQuery(async () => {
    const [plans, items, patient] = await Promise.all([
      db.plans.where('patientId').equals(patientId).toArray(),
      db.treatments.where('patientId').equals(patientId).toArray(),
      db.patients.get(patientId),
    ])
    return { plans, items, patient }
  }, [patientId])
  const procedures = useLiveQuery(() => db.procedures.toArray(), [])
  const procMap = useMemo(() => new Map((procedures ?? []).map(p => [p.id, p])), [procedures])

  const [planForm, setPlanForm] = useState<{ open: boolean; plan?: TreatmentPlan }>({ open: false })
  const [itemForm, setItemForm] = useState<ItemFormState>({ open: false, mode: 'add' })
  const [chart, setChart] = useState<ChartPrompt | null>(null)
  const [billing, setBilling] = useState(false)
  const [printId, setPrintId] = useState<string | null>(null)

  const plans = useMemo(() => [...(data?.plans ?? [])].sort((a, b) => PLAN_RANK[a.status] - PLAN_RANK[b.status] || (a.createdAt < b.createdAt ? 1 : -1)), [data?.plans])
  const openPlans = plans.filter(p => OPEN.includes(p.status))
  const allItems = data?.items ?? []
  const planIds = useMemo(() => new Set(plans.map(p => p.id)), [plans])
  const byPlan = useMemo(() => {
    const order = sortTeeth(allItems.map(i => i.tooth).filter(isValidTooth))
    const rank = (i: TreatmentItem) => (i.tooth ? order.indexOf(i.tooth) : -1)
    const m = new Map<string, TreatmentItem[]>()
    for (const i of allItems) if (i.planId && planIds.has(i.planId)) { const l = m.get(i.planId); if (l) l.push(i); else m.set(i.planId, [i]) }
    const gone = (i: TreatmentItem) => (i.status === 'cancelled' ? 1 : 0)
    for (const l of m.values()) l.sort((a, b) => gone(a) - gone(b) || (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : rank(a) - rank(b)))
    return m
  }, [allItems, planIds])
  const loose = useMemo(() => allItems.filter(i => !i.planId || !planIds.has(i.planId)).sort((a, b) => (itemDate(a) < itemDate(b) ? 1 : itemDate(a) > itemDate(b) ? -1 : a.createdAt < b.createdAt ? 1 : -1)), [allItems, planIds])
  const summary = useMemo(() => summarize(allItems), [allItems])
  const unbilled = useMemo(() => unbilledItems(allItems).sort((a, b) => ((a.completedAt ?? '') < (b.completedAt ?? '') ? -1 : 1)), [allItems])
  const marked = useMemo(() => new Set(allItems.filter(i => i.status !== 'cancelled' && i.tooth).map(i => i.tooth!)), [allItems])
  const canBill = can('billing')

  // ---- deep link from the dental chart: ?tooth=16 opens "add item" with that tooth, once ----
  const handled = useRef(false)
  useEffect(() => {
    if (handled.current || !data) return
    const n = parseTooth(params.get('tooth'))
    if (n === null) return
    handled.current = true
    setParams(p => { const x = new URLSearchParams(p); x.delete('tooth'); return x }, { replace: true })
    if (readOnly) return
    setItemForm({ open: true, mode: 'add', target: openPlans[0]?.id ?? NEW_PLAN, teeth: [n] })
  }, [data, params]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- actions ----
  const describe = (i: TreatmentItem) => i.tooth ? `${i.procedureName} — ${t('treatments.toothN', { n: i.tooth })}` : i.procedureName
  /** Offers the chart update; true when the prompt opened (it then stands in for the success toast). */
  const askChart = (items: TreatmentItem[], proc?: Procedure): boolean => {
    const withTooth = items.filter(i => i.tooth)
    const cond = chartConditionFor(proc?.category)
    if (!withTooth.length || !cond) return false
    setChart({ items: withTooth, condition: cond })
    return true
  }
  const onStatus = async (i: TreatmentItem, s: TreatmentStatus) => {
    try {
      const next = await setItemStatus(i.id, s)
      if (!next || next.status !== s) return
      void logActivity({ type: 'treatment', action: 'status', entityId: i.id, patientId, by: user?.id, message: t(`treatments.log.status.${s}`, { name: describe(i) }) })
      if (s === 'completed') {
        const plan = i.planId ? await db.plans.get(i.planId) : undefined
        const prompted = askChart([next], i.procedureId ? procMap.get(i.procedureId) : undefined)
        if (plan?.status === 'completed') toast.success(t('treatments.toast.planDone'), plan.title)
        else if (!prompted) toast.success(t('treatments.toast.completed'), describe(i))
      } else toast.success(t(`treatments.toast.status.${s}`), describe(i))
    } catch (e) { toast.error(t('error'), String((e as Error)?.message ?? e)) }
  }
  const onDeleteItem = async (i: TreatmentItem) => {
    if (!(await confirmDelete(t('treatments.item.deleteDesc', { name: describe(i) })))) return
    if (await deleteItem(i.id)) {
      void logActivity({ type: 'treatment', action: 'delete', entityId: i.id, patientId, by: user?.id, message: t('treatments.log.itemDeleted', { name: describe(i) }) })
      toast.success(t('treatments.toast.itemDeleted'), describe(i))
    }
  }
  const h: ItemHandlers = {
    readOnly, users,
    onStatus: (i, s) => void onStatus(i, s),
    onEdit: i => setItemForm({ open: true, mode: 'edit', item: i }),
    onDelete: i => void onDeleteItem(i),
  }
  const ph: PlanHandlers = {
    onAddItem: p => setItemForm({ open: true, mode: 'add', target: p.id }),
    onApprove: async p => {
      const r = await approvePlan(p.id)
      void logActivity({ type: 'treatment', action: 'status', entityId: p.id, patientId, by: user?.id, message: t('treatments.log.planApproved', { title: p.title }) })
      toast.success(t('treatments.toast.planApproved'), r.status !== 'approved' ? t(`plan.${r.status}`) : p.title)
    },
    onPrint: p => setPrintId(p.id),
    onEdit: p => setPlanForm({ open: true, plan: p }),
    onCancel: async p => {
      const ok = await confirm({ title: t('treatments.plan.cancelTitle'), description: t('treatments.plan.cancelDesc'), confirmLabel: t('treatments.plan.cancel'), cancelLabel: t('treatments.keep'), danger: true })
      if (!ok) return
      const n = await cancelPlan(p.id)
      void logActivity({ type: 'treatment', action: 'status', entityId: p.id, patientId, by: user?.id, message: t('treatments.log.planCancelled', { title: p.title }) })
      toast.success(t('treatments.toast.planCancelled'), n ? tn(t, lang, 'treatments.n.items', n) : undefined)
    },
    onReopen: async p => {
      await reopenPlan(p.id)
      toast.success(t('treatments.toast.planReopened'), p.title)
    },
    onDelete: async p => {
      const items = byPlan.get(p.id) ?? []
      const keep = items.filter(i => i.status === 'completed' || i.invoiceId).length
      const ok = await confirmDelete(keep ? t('treatments.plan.deleteKeep', { n: keep }) : t('treatments.plan.deleteDesc'))
      if (!ok) return
      await deletePlan(p.id)
      void logActivity({ type: 'treatment', action: 'delete', entityId: p.id, patientId, by: user?.id, message: t('treatments.log.planDeleted', { title: p.title }) })
      toast.success(t('treatments.toast.planDeleted'), p.title)
    },
  }

  const loading = data === undefined
  const nothing = !loading && plans.length === 0 && allItems.length === 0
  const printPlan = plans.find(p => p.id === printId)

  const actions = (
    <div className="tr-tab-actions">
      <Button variant="primary" icon={<Plus />} disabled={readOnly} onClick={() => setPlanForm({ open: true })}>{t('treatments.plan.new')}</Button>
      <Button variant="secondary" icon={<Zap />} disabled={readOnly} onClick={() => setItemForm({ open: true, mode: 'quick' })}>{t('treatments.quick')}</Button>
      {canBill && (
        <Button variant={unbilled.length ? 'success' : 'secondary'} icon={<ReceiptText />} disabled={readOnly || !unbilled.length} onClick={() => setBilling(true)}>
          {t('treatments.bill.button')}{unbilled.length > 0 && <span className="tr-btn-count num">{unbilled.length}</span>}
        </Button>
      )}
    </div>
  )

  return (
    <div className="tr-tab">
      {readOnly && <Alert tone="warning">{t('trial.readonly')}</Alert>}

      {loading ? (
        <>
          <div className="tr-stats">{[0, 1, 2, 3].map(i => <div key={i} className="card stat-card"><Skeleton w={46} h={46} r={14} /><div className="grow col gap-2"><Skeleton w="50%" /><Skeleton w="70%" h={22} /></div></div>)}</div>
          <Card><div className="card-body col gap-3"><Skeleton w="40%" h={20} /><Skeleton h={14} /><Skeleton h={44} /><Skeleton h={44} /></div></Card>
        </>
      ) : nothing ? (
        <Card>
          <EmptyState icon={<ClipboardList />} title={t('treatments.tab.emptyTitle')} description={t('treatments.tab.emptyDesc')}
            actions={!readOnly && <>
              <Button variant="primary" icon={<Plus />} onClick={() => setPlanForm({ open: true })}>{t('treatments.plan.new')}</Button>
              <Button variant="secondary" icon={<Zap />} onClick={() => setItemForm({ open: true, mode: 'quick' })}>{t('treatments.quick')}</Button>
            </>} />
        </Card>
      ) : (
        <>
          <div className="tr-stats">
            <StatCard tone="info" icon={<CalendarClock />} label={t('treatments.stat.planned')} value={<span className="money">{money(summary.planned.value)}</span>} sub={tn(t, lang, 'treatments.n.items', summary.planned.count)} />
            <StatCard tone="warning" icon={<Timer />} label={t('treatments.stat.inProgress')} value={<span className="money">{money(summary.inProgress.value)}</span>} sub={tn(t, lang, 'treatments.n.items', summary.inProgress.count)} />
            <StatCard tone="success" icon={<CheckCircle2 />} label={t('treatments.stat.completed')} value={<span className="money">{money(summary.completed.value)}</span>} sub={tn(t, lang, 'treatments.n.items', summary.completed.count)} />
            <StatCard tone="orange" icon={<Wallet />} label={t('treatments.stat.unbilled')} value={<span className="money">{money(summary.unbilled.value)}</span>}
              sub={summary.unbilled.count ? tn(t, lang, 'treatments.n.items', summary.unbilled.count) : t('treatments.stat.allBilled')}
              onClick={canBill && !readOnly && unbilled.length ? () => setBilling(true) : undefined} />
          </div>

          <div className="tr-tab-head">
            <div className="grow">
              <h2 className="tr-h2">{t('treatments.tab.plans')}</h2>
              <div className="text-sm muted">{openPlans.length ? tn(t, lang, 'treatments.n.openPlans', openPlans.length) : t('treatments.tab.noOpenPlans')}</div>
            </div>
            {actions}
          </div>

          <div className="col gap-4">
            {plans.map(p => (
              <PlanCard key={p.id} plan={p} items={byPlan.get(p.id) ?? []} h={h} ph={ph} defaultOpen={OPEN.includes(p.status) || plans.length === 1} />
            ))}
            {plans.length === 0 && (
              <Card className="tr-hint-card">
                <EmptyState compact icon={<ClipboardList />} title={t('treatments.tab.noPlansTitle')} description={t('treatments.tab.noPlansDesc')}
                  actions={!readOnly && <Button variant="primary" size="sm" icon={<Plus />} onClick={() => setPlanForm({ open: true })}>{t('treatments.plan.new')}</Button>} />
              </Card>
            )}
            {loose.length > 0 && (
              <Card className="tr-loose">
                <CardHeader icon={<Zap />} title={t('treatments.tab.loose')} subtitle={t('treatments.tab.looseSub')} />
                <ItemsTable items={loose} h={h} />
              </Card>
            )}
          </div>
        </>
      )}

      <PlanFormModal open={planForm.open} plan={planForm.plan} patientId={patientId} patientDoctorId={data?.patient?.doctorId}
        onClose={() => setPlanForm({ open: false })} onCreated={p => setItemForm({ open: true, mode: 'add', target: p.id })} />
      <ItemFormModal open={itemForm.open} mode={itemForm.mode} item={itemForm.item} target={itemForm.target ?? NO_PLAN} initialTeeth={itemForm.teeth}
        plans={openPlans} marked={marked} patientId={patientId} patientDoctorId={data?.patient?.doctorId}
        onClose={() => setItemForm(s => ({ ...s, open: false }))}
        onSaved={(items, mode, proc) => { if (mode === 'quick') askChart(items, proc) }} quiet={(mode, proc) => mode === 'quick' && !!chartConditionFor(proc?.category)} />
      <ChartUpdateModal prompt={chart} onClose={() => setChart(null)} patientId={patientId} />
      {canBill && <BillModal open={billing} onClose={() => setBilling(false)} patientId={patientId} patientName={data?.patient?.name} items={unbilled} />}
      {printPlan && <PlanPrintModal open={!!printPlan} onClose={() => setPrintId(null)} plan={printPlan} items={byPlan.get(printPlan.id) ?? []} patient={data?.patient} users={users} />}
    </div>
  )
}
