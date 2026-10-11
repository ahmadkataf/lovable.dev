import type { HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import { colorFor, initials } from '@/lib/format'

export function Card({ className, pad, hover, clickable, children, ...rest }: HTMLAttributes<HTMLDivElement> & { pad?: boolean | 'sm'; hover?: boolean; clickable?: boolean }) {
  return <div className={['card', pad === true && 'card-pad', pad === 'sm' && 'card-sm', hover && 'card-hover', clickable && 'card-clickable', className].filter(Boolean).join(' ')} {...rest}>{children}</div>
}
export function CardHeader({ title, subtitle, icon, actions, className }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={['card-header', className].filter(Boolean).join(' ')}>
      <div className="grow"><div className="card-title">{icon}{title}</div>{subtitle && <div className="card-sub">{subtitle}</div>}</div>
      {actions && <div className="row gap-2">{actions}</div>}
    </div>
  )
}
export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) { return <div className={['card-body', className].filter(Boolean).join(' ')} {...rest}>{children}</div> }
export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) { return <div className={['card-footer', className].filter(Boolean).join(' ')} {...rest}>{children}</div> }

export type StatTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'pink' | 'orange' | 'accent'
export function StatCard({ label, value, icon, tone = 'primary', delta, deltaLabel, to, onClick, sub }: { label: ReactNode; value: ReactNode; icon?: ReactNode; tone?: StatTone; delta?: number | null; deltaLabel?: ReactNode; to?: string; onClick?: () => void; sub?: ReactNode }) {
  const body = (
    <>
      {icon && <div className="stat-icon">{icon}</div>}
      <div className="grow">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="text-sm muted">{sub}</div>}
        {delta !== undefined && delta !== null && (
          <div className={`stat-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}`}>{delta > 0 ? <TrendingUp /> : delta < 0 ? <TrendingDown /> : null}<span className="num">{delta > 0 ? '+' : ''}{Math.round(delta)}%</span>{deltaLabel && <span className="muted" style={{ fontWeight: 500 }}>{deltaLabel}</span>}</div>
        )}
      </div>
    </>
  )
  const cls = `card stat-card tone-${tone}${to || onClick ? ' card-hover card-clickable' : ''}`
  if (to) return <Link to={to} className={cls} style={{ color: 'inherit' }}>{body}</Link>
  return <div className={cls} onClick={onClick}>{body}</div>
}

export interface Crumb { label: ReactNode; to?: string }
export function PageHeader({ title, subtitle, actions, icon, crumbs, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode; crumbs?: Crumb[]; className?: string }) {
  return (
    <div className={['page-header', className].filter(Boolean).join(' ')}>
      <div className="grow">
        {crumbs && crumbs.length > 0 && (
          <nav className="breadcrumbs">{crumbs.map((c, i) => <span key={i} className="row gap-1">{i > 0 && <ChevronRight className="chev" />}{c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}</span>)}</nav>
        )}
        <h1 className="page-title">{icon}{title}</h1>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export interface TabItem<T extends string> { id: T; label: ReactNode; icon?: ReactNode; count?: number }
export function Tabs<T extends string>({ tabs, value, onChange, pills, className }: { tabs: TabItem<T>[]; value: T; onChange: (id: T) => void; pills?: boolean; className?: string }) {
  return (
    <div className={['tabs', pills && 'tabs-pills', className].filter(Boolean).join(' ')} role="tablist">
      {tabs.map(tb => (
        <button key={tb.id} type="button" role="tab" aria-selected={tb.id === value} className={`tab${tb.id === value ? ' active' : ''}`} onClick={() => onChange(tb.id)}>
          {tb.icon}{tb.label}{tb.count !== undefined && <span className="count num">{tb.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Avatar({ name, src, size, color, square, className }: { name: string; src?: string; size?: 'xs' | 'sm' | 'lg' | 'xl'; color?: string; square?: boolean; className?: string }) {
  return (
    <span className={['avatar', size && `avatar-${size}`, square && 'avatar-square', className].filter(Boolean).join(' ')} style={{ background: src ? 'var(--surface-3)' : color || colorFor(name) }} title={name}>
      {src ? <img src={src} alt={name} /> : initials(name)}
    </span>
  )
}
export function Kbd({ children }: { children: ReactNode }) { return <kbd className="kbd">{children}</kbd> }
export function Divider({ className }: { className?: string }) { return <div className={['divider', className].filter(Boolean).join(' ')} /> }
export function IconBox({ children, tone, small, className, style }: { children: ReactNode; tone?: string; small?: boolean; className?: string; style?: React.CSSProperties }) {
  return <span className={['icon-box', small && 'sm', className].filter(Boolean).join(' ')} style={{ ...(tone ? { background: `var(--${tone}-soft)`, color: `var(--${tone})` } : {}), ...style }}>{children}</span>
}
