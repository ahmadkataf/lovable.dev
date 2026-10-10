import { Link } from 'react-router-dom'
import {
  Activity as ActivityIcon, BellRing, Boxes, CalendarClock, CalendarDays, ChevronRight, FileText, FlaskConical, History, LogIn, PackageMinus, Pill, Receipt,
  ShieldCheck, Stethoscope, UserRound, Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardHeader, EmptyState, Skeleton } from '@/ui'
import { useI18n } from '@/i18n'
import type { Activity, ActivityType, User } from '@/db/types'
import { timeAgo } from '@/lib/dates'
import { formatNumber } from '@/lib/format'

export interface AlertItem { id: string; to: string; icon: LucideIcon; tone: 'danger' | 'warning' | 'info' | 'accent'; title: string; sub: string; count: number }

/** Things to act on today, each linking to its page; an "all clear" state when there is nothing. */
export function AlertsCard({ items, loading, style }: { items: AlertItem[]; loading: boolean; style?: React.CSSProperties }) {
  const { t, lang } = useI18n()
  const live = items.filter(i => i.count > 0)
  return (
    <Card className="rp-alerts" data-testid="dash-alerts" style={style}>
      <CardHeader icon={<BellRing />} title={t('dashboard.alerts.title')} />
      {loading ? (
        <div className="card-body col gap-3">{[0, 1, 2].map(i => <div key={i} className="row gap-3"><Skeleton w={36} h={36} r={10} /><div className="grow col gap-2"><Skeleton w="60%" /><Skeleton w="40%" h={10} /></div></div>)}</div>
      ) : !live.length ? (
        <div className="rp-clear" data-testid="dash-allclear">
          <span className="rp-clear-icon"><ShieldCheck /></span>
          <div><div className="strong">{t('dashboard.alerts.clearTitle')}</div><div className="text-sm muted">{t('dashboard.alerts.clearDesc')}</div></div>
        </div>
      ) : (
        <ul className="rp-alert-list">
          {live.map(a => (
            <li key={a.id}>
              <Link to={a.to} className={`rp-alert rp-alert-${a.tone}`} data-testid={`alert-${a.id}`}>
                <span className="rp-alert-icon"><a.icon /></span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="rp-alert-title">{a.title}</span>
                  <span className="rp-alert-sub truncate">{a.sub}</span>
                </span>
                <span className="rp-alert-count num">{formatNumber(a.count, lang)}</span>
                <ChevronRight className="rp-chev" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const TYPE_ICON: Record<ActivityType, LucideIcon> = {
  patient: UserRound, appointment: CalendarDays, treatment: Stethoscope, invoice: Receipt, payment: Wallet, prescription: Pill,
  lab: FlaskConical, inventory: Boxes, expense: FileText, system: LogIn,
}
const TYPE_TONE: Record<ActivityType, string> = {
  patient: 'primary', appointment: 'info', treatment: 'purple', invoice: 'accent', payment: 'success', prescription: 'pink',
  lab: 'orange', inventory: 'warning', expense: 'orange', system: 'gray',
}

/** The last actions in the clinic, newest first. */
export function ActivityFeed({ items, users, style }: { items: Activity[] | undefined; users: User[]; style?: React.CSSProperties }) {
  const { t, lang } = useI18n()
  const title = (a: Activity) => {
    const k = `dashboard.act.${a.type}.${a.action}`
    const s = t(k)
    return s === k.slice('dashboard.'.length) ? t(`dashboard.type.${a.type}`) : s
  }
  return (
    <Card className="rp-activity" data-testid="dash-activity" style={style}>
      <CardHeader icon={<History />} title={t('dashboard.activity.title')} />
      {!items ? (
        <div className="card-body col gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="row gap-3"><Skeleton w={32} h={32} r={10} /><div className="grow col gap-2"><Skeleton w="55%" /><Skeleton w="35%" h={10} /></div></div>)}</div>
      ) : !items.length ? (
        <EmptyState compact icon={<ActivityIcon />} title={t('dashboard.activity.emptyTitle')} description={t('dashboard.activity.emptyDesc')} />
      ) : (
        <ul className="rp-feed">
          {items.map(a => {
            const I = a.type === 'inventory' && a.action === 'update' ? PackageMinus : a.type === 'appointment' && a.action === 'status' ? CalendarClock : TYPE_ICON[a.type] ?? ActivityIcon
            const tone = TYPE_TONE[a.type] ?? 'gray'
            const by = a.by ? users.find(u => u.id === a.by)?.name : undefined
            const msg = a.type === 'system' && a.action === 'login' ? (by ?? a.message) : a.message
            const body = (
              <>
                <span className={`rp-feed-icon tone-${tone}`}><I /></span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="rp-feed-title">{title(a)}</span>
                  <span className="rp-feed-msg truncate"><bdi>{msg}</bdi>{by && !(a.type === 'system' && a.action === 'login') ? <span className="subtle"> · <bdi>{by}</bdi></span> : null}</span>
                </span>
                <time className="rp-feed-time" dateTime={a.at}>{timeAgo(a.at, lang)}</time>
              </>
            )
            return <li key={a.id}>{a.patientId ? <Link to={`/patients/${a.patientId}`} className="rp-feed-row">{body}</Link> : <div className="rp-feed-row">{body}</div>}</li>
          })}
        </ul>
      )}
    </Card>
  )
}
