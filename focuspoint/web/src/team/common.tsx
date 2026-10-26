// Shared bits for the team panel: page header, confirm dialog, the sync state pill + its sheet.
import { useState, type ReactNode } from 'react'
import { Badge, Button, Icon, Sheet, type IconName } from '../ui'
import { fmtTime } from '../format'
import { store, useStore } from './store'
import { cx, describeError } from './util'

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="tp-pagehead">
      <div>
        <h1 className="h1">{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {children && <div className="tp-actions">{children}</div>}
    </div>
  )
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="tp-section">
      <div className="tp-section-title">
        <h2 className="h2">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export interface ConfirmProps {
  open: boolean
  title: string
  body?: ReactNode
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}
/** Confirmation sheet for destructive actions. */
export function Confirm({ open, title, body, confirmLabel = 'تأكيد', danger, loading, onConfirm, onClose }: ConfirmProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {body && <div className="confirm-body">{body}</div>}
      <div className="sheet-foot">
        <Button variant="ghost" onClick={onClose}>رجوع</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Sheet>
  )
}

/** Header pill: متصل / دون اتصال / N تغييرات بانتظار الإرسال / خطأ — tap for details. */
export function SyncPill() {
  const { sync, queue } = useStore()
  const [open, setOpen] = useState(false)
  let cls = 'is-online', icon: IconName = 'cloud', text = 'متصل'
  if (sync.failed > 0) { cls = 'is-error'; icon = 'cloudOff'; text = `${sync.failed} يحتاج انتباه` }
  else if (!sync.online) { cls = 'is-offline'; icon = 'cloudOff'; text = sync.pending ? `دون اتصال · ${sync.pending}` : 'دون اتصال' }
  else if (sync.syncing) { cls = 'is-pending'; icon = 'sync'; text = 'جارٍ الإرسال…' }
  else if (sync.pending > 0) { cls = 'is-pending'; icon = 'sync'; text = `${sync.pending} بانتظار الإرسال` }
  else if (sync.error) { cls = 'is-error'; icon = 'cloudOff'; text = 'خطأ' }

  return (
    <>
      <button type="button" className={cx('sync-pill', cls)} onClick={() => setOpen(true)} aria-live="polite">
        <Icon name={icon} size={15} className={sync.syncing ? 'spin' : undefined} />
        <span>{text}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="المزامنة مع السحابة">
        <p className="muted small" style={{ marginBottom: 12 }}>
          {sync.online ? 'الجهاز متصل بالإنترنت.' : 'الجهاز دون اتصال — كل تغيير يُحفَظ هنا ويُرسَل تلقائياً عند عودة الإنترنت.'}
          {sync.last_sync && ` آخر مزامنة ${fmtTime(sync.last_sync)}.`}
        </p>
        {sync.error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{sync.error}</div>}
        {queue.length === 0 ? (
          <div className="alert alert-ok">كل التغييرات محفوظة في السحابة.</div>
        ) : (
          <div>
            {queue.map((q) => (
              <div key={q.op.client_id} className="sync-row">
                <div>
                  <div className="strong">{q.label}</div>
                  <div className="muted tiny">{fmtTime(q.created_at)}</div>
                  {q.status === 'failed' && <div className="err">{describeError(q.error ?? 'internal')}</div>}
                </div>
                {q.status === 'failed' ? (
                  <div className="row gap-sm">
                    <Button size="sm" variant="soft" onClick={() => void store.retry(q.op.client_id)}>إعادة</Button>
                    <Button size="sm" variant="ghost" onClick={() => void store.discard(q.op.client_id)}>تجاهل</Button>
                  </div>
                ) : (
                  <Badge tone="gold">بانتظار الإرسال</Badge>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="sheet-foot">
          <Button variant="soft" block loading={sync.syncing} onClick={() => void store.sync()}>مزامنة الآن</Button>
        </div>
      </Sheet>
    </>
  )
}

/** Coloured bar/dot for a room (its colour, or a brand fallback). */
export const roomColor = (color: string | null | undefined): string => color || '#7b1e2e'
