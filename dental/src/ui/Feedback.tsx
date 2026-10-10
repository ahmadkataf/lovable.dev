import type { ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'

export type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'pink' | 'orange' | 'accent' | 'outline'
export function Badge({ tone = 'default', size, dot, icon, children, className, style }: { tone?: Tone; size?: 'sm' | 'lg'; dot?: boolean; icon?: ReactNode; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <span className={['badge', tone !== 'default' && `badge-${tone}`, size && `badge-${size}`, className].filter(Boolean).join(' ')} style={style}>{dot && <span className="dot" />}{icon}{children}</span>
}

/** Tones for every status family in the data model, so lists look the same everywhere. */
export const STATUS_TONE: Record<string, Tone> = {
  scheduled: 'info', confirmed: 'accent', arrived: 'purple', in_progress: 'warning', completed: 'success', cancelled: 'default', no_show: 'danger',
  planned: 'info', draft: 'default', unpaid: 'danger', partial: 'warning', paid: 'success', approved: 'accent',
  sent: 'info', received: 'purple', fitted: 'success', remake: 'danger',
  active: 'success', inactive: 'default', archived: 'default',
}
export function toneFor(status: string): Tone { return STATUS_TONE[status] ?? 'default' }

export function Alert({ tone = 'info', title, children, icon, className, action }: { tone?: 'info' | 'success' | 'warning' | 'danger'; title?: ReactNode; children?: ReactNode; icon?: ReactNode; className?: string; action?: ReactNode }) {
  const I = tone === 'success' ? CheckCircle2 : tone === 'warning' ? AlertTriangle : tone === 'danger' ? AlertCircle : Info
  return (
    <div className={['alert', `alert-${tone}`, className].filter(Boolean).join(' ')} role={tone === 'danger' ? 'alert' : 'status'}>
      {icon ?? <I />}
      <div className="grow">{title && <div className="alert-title">{title}</div>}{children && <div className="alert-desc">{children}</div>}</div>
      {action}
    </div>
  )
}

export function Spinner({ size = 'md', className }: { size?: 'md' | 'lg'; className?: string }) {
  return <span className={['spinner', size === 'lg' && 'spinner-lg', className].filter(Boolean).join(' ')} role="progressbar" />
}
export function Loading({ label }: { label?: string }) {
  return <div className="empty" style={{ padding: 40 }}><Spinner size="lg" />{label && <div className="muted mt-2">{label}</div>}</div>
}
export function Skeleton({ w, h = 14, r, className, style }: { w?: number | string; h?: number | string; r?: number; className?: string; style?: React.CSSProperties }) {
  return <div className={['skeleton', className].filter(Boolean).join(' ')} style={{ width: w ?? '100%', height: h, borderRadius: r, ...style }} />
}

export function EmptyState({ icon, title, description, actions, compact }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; compact?: boolean }) {
  return (
    <div className="empty" style={compact ? { padding: '24px 16px' } : undefined}>
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="empty-title">{title}</div>
      {description && <div className="empty-desc">{description}</div>}
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  )
}

export function ProgressBar({ value, max = 100, tone, className }: { value: number; max?: number; tone?: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return <div className={['progress', className].filter(Boolean).join(' ')}><span style={{ width: `${pct}%`, background: tone }} /></div>
}
