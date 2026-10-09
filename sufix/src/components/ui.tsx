import React, { useEffect, useState } from 'react'
import type { OrderStatus, TicketStatus } from '@shared/types'
import { ORDER_STATUS, TICKET_STATUS } from '@shared/types'
import { useStore } from '../lib/store'
import { fmtMoney, fmtSecondary } from '../lib/format'
import { Icon } from './Icons'

export function Price({ value, old, big, secondary = true }: { value: number; old?: number; big?: boolean; secondary?: boolean }) {
  const { settings } = useStore()
  const sec = secondary ? fmtSecondary(value, settings) : null
  return (
    <span className={big ? 'big-price price' : 'price'}>
      {fmtMoney(value, settings)}
      {old && old > value ? <span className="old">{fmtMoney(old, settings)}</span> : null}
      {sec && <span className="sec">{sec}</span>}
    </span>
  )
}

export function StatusBadge({ status, kind }: { status: OrderStatus | TicketStatus; kind: 'order' | 'ticket' }) {
  const meta = kind === 'order' ? ORDER_STATUS[status as OrderStatus] : TICKET_STATUS[status as TicketStatus]
  if (!meta) return <span className="status" style={{ background: '#6b7280' }}>{status}</span>
  return <span className="status" style={{ background: meta.color }}>{meta.label}</span>
}

export function Toasts() {
  const { toasts } = useStore()
  if (!toasts.length) return null
  return <div className="toasts">{toasts.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div>
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="إغلاق"><Icon.X /></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Confirm({ title, text, confirmLabel = 'تأكيد', danger, onConfirm, onClose }: { title: string; text: React.ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => Promise<void> | void; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
      <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); onClose() } finally { setBusy(false) } }}>{busy ? '...' : confirmLabel}</button>
    </>}>
      <div className="muted" style={{ lineHeight: 1.8 }}>{text}</div>
    </Modal>
  )
}

export function Field({ label, hint, children, span2 }: { label: string; hint?: string; children: React.ReactNode; span2?: boolean }) {
  return <div className={`field ${span2 ? 'span-2' : ''}`}><label>{label}</label>{children}{hint && <span className="hint">{hint}</span>}</div>
}

export function Empty({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return <div className="empty">{icon}<h3 style={{ marginBottom: 6 }}>{title}</h3>{text && <p>{text}</p>}{action && <div style={{ marginTop: 16 }}>{action}</div>}</div>
}

export function Spinner() {
  return <div className="center muted" style={{ padding: 40 }}>جارٍ التحميل…</div>
}

export function Stars({ n }: { n: number }) {
  return <div className="stars">{Array.from({ length: 5 }, (_, i) => <Icon.Star key={i} style={{ opacity: i < n ? 1 : .25 }} />)}</div>
}
