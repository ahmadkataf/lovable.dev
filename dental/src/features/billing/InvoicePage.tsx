// /invoices/:id — one invoice as a printable sheet, with payment, edit, print, WhatsApp, cancel and delete actions.
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ArrowRight, Ban, FileX2, MessageCircle, MoreVertical, Pencil, Printer, Receipt, Send, Trash2, Wallet } from 'lucide-react'
import { db, logActivity } from '@/db'
import { useI18n } from '@/i18n'
import { useClinic, useMoney } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { fmtDate } from '@/lib/dates'
import { whatsappLink } from '@/lib/format'
import { openExternal, print } from '@/platform'
import { Button, EmptyState, IconButton, Menu, PageHeader, ProgressBar, Skeleton, useConfirm, useConfirmDelete, useToast, type MenuItemDef } from '@/ui'
import { cancelInvoice, deleteDraftInvoice } from './actions'
import { invoiceBalance, isDraftNumber, isOpen } from './lib'
import { InvoiceSheet } from './InvoiceSheet'
import { Money, StatusBadge, ltr } from './shared'
import InvoiceFormModal from './InvoiceFormModal'
import './billing.css'

const PaymentFormModal = lazy(() => import('./PaymentFormModal'))

export default function InvoicePage() {
  const { id = '' } = useParams()
  const { t, lang, isRTL } = useI18n()
  const money = useMoney()
  const clinic = useClinic()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const session = useSession()
  const license = useLicense()
  const toast = useToast()
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState(false)

  const data = useLiveQuery(async () => {
    const invoice = await db.invoices.get(id)
    if (!invoice) return { invoice: null } as const
    const [patient, payments, doctor] = await Promise.all([
      db.patients.get(invoice.patientId),
      db.payments.where('invoiceId').equals(id).toArray(),
      invoice.doctorId ? db.users.get(invoice.doctorId) : Promise.resolve(undefined),
    ])
    payments.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    return { invoice, patient, payments, doctor }
  }, [id])

  // /invoices/:id?print=1 prints as soon as the sheet is on screen (used by "print" in the list)
  const printed = useRef(false)
  useEffect(() => {
    if (!data?.invoice || printed.current || params.get('print') !== '1') return
    printed.current = true
    setParams({}, { replace: true })
    const tm = window.setTimeout(() => print(), 350)
    return () => window.clearTimeout(tm)
  }, [data, params, setParams])

  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/invoices'))
  const BackIcon = isRTL ? ArrowRight : ArrowLeft

  if (data === undefined) {
    return (
      <div className="page bl-invoice-page">
        <div className="row gap-3 mb-6"><Skeleton w={220} h={30} /><div className="grow" /><Skeleton w={120} h={40} r={12} /></div>
        <div className="bl-desk"><div className="bl-sheet col gap-4"><Skeleton w="40%" h={28} /><Skeleton w="60%" /><Skeleton h={90} /><Skeleton h={160} /><Skeleton w="35%" h={60} style={{ alignSelf: 'flex-end' }} /></div></div>
      </div>
    )
  }
  if (!data.invoice) {
    return (
      <div className="page">
        <div className="card"><EmptyState icon={<FileX2 />} title={t('billing.notFound')} description={t('billing.notFoundDesc')} actions={<Button variant="primary" to="/invoices" icon={<Receipt />}>{t('billing.backToInvoices')}</Button>} /></div>
      </div>
    )
  }

  const { invoice, patient, payments, doctor } = data
  const ro = license.readOnly
  const balance = invoiceBalance(invoice)
  const draft = invoice.status === 'draft'
  const cancelled = invoice.status === 'cancelled'
  const canEdit = !ro && !cancelled && payments.length === 0 && invoice.paid === 0
  const number = isDraftNumber(invoice.number) ? t('billing.draftNumber') : invoice.number
  const clinicName = (lang === 'en' ? clinic.nameEn || clinic.name : clinic.name || clinic.nameEn) || t('appName')

  const share = () => {
    if (!patient?.phone) { toast.warning(t('billing.noPhone')); return }
    const text = t('billing.share.text', { number: ltr(invoice.number), clinic: clinicName, total: ltr(money(invoice.total)), due: ltr(money(balance)) })
    openExternal(whatsappLink(patient.phone, text))
  }
  const doCancel = async () => {
    const desc = invoice.paid > 0 ? `${t('billing.cancelInvoiceDesc')} ${t('billing.cancelWithPayments', { amount: ltr(money(invoice.paid)) })}` : t('billing.cancelInvoiceDesc')
    if (!(await confirm({ title: `${t('billing.cancelInvoice')} ${invoice.number}`, description: desc, danger: true, confirmLabel: t('billing.cancelInvoice'), cancelLabel: t('billing.keepInvoice') }))) return
    await cancelInvoice(invoice.id)
    void logActivity({ type: 'invoice', action: 'status', entityId: invoice.id, patientId: invoice.patientId, message: t('billing.act.invoiceCancelled', { number: ltr(invoice.number), patient: patient?.name ?? '' }), by: session.user?.id })
    toast.success(t('billing.invoiceCancelled'))
  }
  const doDelete = async () => {
    if (!(await confirmDelete(t('billing.deleteDraftDesc')))) return
    await deleteDraftInvoice(invoice.id)
    void logActivity({ type: 'invoice', action: 'delete', entityId: invoice.id, patientId: invoice.patientId, message: t('billing.act.invoiceDeleted', { patient: patient?.name ?? '' }), by: session.user?.id })
    toast.success(t('billing.invoiceDeleted'))
    navigate('/invoices', { replace: true })
  }

  const more: MenuItemDef[] = [
    { label: t('edit'), icon: <Pencil />, disabled: !canEdit, onClick: () => setEditing(true) },
    { label: t('billing.shareWhatsapp'), icon: <MessageCircle />, disabled: !patient?.phone || draft || cancelled, onClick: share },
    ...(!cancelled && !draft ? [{ sep: true }, { label: t('billing.cancelInvoice'), icon: <Ban />, danger: true, disabled: ro, onClick: () => void doCancel() }] : []),
    ...(draft ? [{ sep: true }, { label: t('billing.deleteDraft'), icon: <Trash2 />, danger: true, disabled: ro, onClick: () => void doDelete() }] : []),
  ]

  const actions = (
    <>
      {draft ? (
        <Button variant="primary" icon={<Send />} disabled={ro} onClick={() => setEditing(true)}>{t('billing.reviewAndIssue')}</Button>
      ) : isOpen(invoice) && (
        <Button variant="primary" icon={<Wallet />} disabled={ro} onClick={() => setPaying(true)}>{t('billing.recordPayment')}</Button>
      )}
      <Button variant="secondary" icon={<Printer />} onClick={() => print()} className="hide-mobile">{t('print')}</Button>
      <IconButton label={t('print')} variant="secondary" className="show-mobile" onClick={() => print()}><Printer /></IconButton>
      {!draft && !cancelled && <Button variant="secondary" icon={<MessageCircle />} onClick={share} disabled={!patient?.phone} title={!patient?.phone ? t('billing.noPhone') : undefined} className="hide-mobile">{t('whatsapp')}</Button>}
      <Menu items={more} trigger={() => <IconButton label={t('more')} variant="secondary"><MoreVertical /></IconButton>} />
    </>
  )

  return (
    <div className="page bl-invoice-page">
      <div className="no-print">
        <PageHeader
          crumbs={[{ label: t('billing.title'), to: '/invoices' }, { label: <span className={draft ? '' : 'num'}>{number}</span> }]}
          title={<span className="bl-title-row"><IconButton label={t('back')} variant="ghost" size="sm" onClick={goBack}><BackIcon /></IconButton><span className={draft ? '' : 'num'}>{number}</span><StatusBadge status={invoice.status} size="lg" /></span>}
          subtitle={
            <span className="bl-head-sub">
              {patient ? <Link className="bl-link" to={`/patients/${patient.id}`}>{patient.name}</Link> : t('unknown')}
              <span>·</span><span className="bl-date">{fmtDate(invoice.date, lang)}</span>
            </span>
          }
          actions={actions} />

        {!draft && !cancelled && (
          <div className="bl-summary">
            <div className="bl-summary-item"><span className="bl-acct-label">{t('total')}</span><Money value={invoice.total} /></div>
            <div className="bl-summary-item"><span className="bl-acct-label">{t('paid')}</span><Money value={invoice.paid} /></div>
            <ProgressBar value={invoice.paid} max={invoice.total || 1} tone={balance > 0 ? undefined : 'var(--success)'} />
            <div className="bl-summary-item"><span className="bl-acct-label">{t('billing.sheet.balanceDue')}</span><Money value={balance} kind="due" /></div>
          </div>
        )}
      </div>

      <div className="bl-desk">
        <InvoiceSheet invoice={invoice} patient={patient} doctor={doctor} payments={payments} clinic={clinic} />
      </div>

      {editing && <InvoiceFormModal open invoiceId={invoice.id} onClose={() => setEditing(false)} />}
      <Suspense fallback={null}>
        {paying && <PaymentFormModal open patientId={invoice.patientId} invoiceId={invoice.id} onClose={() => setPaying(false)} />}
      </Suspense>
    </div>
  )
}
