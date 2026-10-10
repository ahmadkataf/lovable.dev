/** Alerts: today's remaining appointments, unconfirmed ones for tomorrow, late lab work, overdue invoices, stock, birthdays, recalls. */
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, CalendarX2, Cake, CheckCheck, ChevronRight, Clock, FlaskConical, Hourglass, MessageCircle, PackageMinus, PackageX, Receipt, RotateCcw, UserRoundCheck } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useClinic, useMoney, useUsers } from '@/app/hooks'
import { Badge, Drawer, EmptyState, IconBox, IconButton, Skeleton, type Tone } from '@/ui'
import { openExternal } from '@/platform'
import { whatsappLink } from '@/lib/format'
import { addDays, fmtDate, fmtTime } from '@/lib/dates'
import { markSeen, RECALL_MONTHS, unseenCount, useAlertPerms, useAlerts, useImportantIds, useNow, useSeen, type Alerts } from './alerts'
import { plural } from './lib'
import './search.css'

interface Row {
  key: string
  tone: string
  icon: ReactNode
  title: ReactNode
  desc: ReactNode
  to: string
  end?: ReactNode
  isNew?: boolean
  action?: { label: string; icon: ReactNode; onClick: () => void }
}
interface Group { key: string; title: string; sub?: ReactNode; count: number; tone: Tone; rows: Row[]; more?: { to: string; n: number } }

/** Number of important alerts (overdue invoices, low stock, late lab work, unconfirmed tomorrow) not seen yet. */
export function useNotificationCount(): number {
  const ids = useImportantIds()
  const seen = useSeen()
  return ids ? unseenCount(ids, seen) : 0
}

export default function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return <Panel onClose={onClose} />
}

const Sep = () => <span className="sep" aria-hidden>·</span>

function Panel({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const money = useMoney()
  const clinic = useClinic()
  const users = useUsers(false)
  const perms = useAlertPerms()
  const alerts = useAlerts()
  const ids = useImportantIds()
  const seen = useSeen()
  const now = useNow(30_000)
  // what was already seen when the panel opened: everything else gets a "new" dot
  const [seenAtOpen] = useState<ReadonlySet<string>>(() => seen)
  useEffect(() => { if (ids) markSeen(ids) }, [ids])

  const go = (to: string) => { onClose(); navigate(to) }
  const groups = alerts ? buildGroups(alerts) : null

  function buildGroups(a: Alerts): Group[] {
    const doctors = new Map(users.map(u => [u.id, u.name]))
    const pname = (id: string) => a.patients.get(id)?.name ?? '—'
    const days = (n: number) => plural(t, lang, 'search.days', Math.abs(n))
    const clinicName = (lang === 'en' ? clinic.nameEn || clinic.name : clinic.name) || t('appName')
    const unit = (u?: string) => { if (!u) return ''; const s = t(`inventory.unit.${u}`); return s === `unit.${u}` ? u : s }
    const out: Group[] = []

    if (perms.appointments && a.todayApts.length) {
      const nowIso = now.toISOString()
      out.push({
        key: 'today', title: t('search.g.today'), count: a.todayApts.length, tone: 'info',
        more: a.todayApts.length > 3 ? { to: `/appointments?date=${a.today}`, n: a.todayApts.length } : undefined,
        rows: a.todayApts.slice(0, 3).map(apt => {
          const mins = Math.round((new Date(apt.start).getTime() - now.getTime()) / 60_000)
          const arrived = apt.status === 'arrived'
          const label = arrived ? t('search.today.arrived') : apt.start <= nowIso ? t('search.today.now') : mins <= 60 ? t('search.today.inMin', { n: mins }) : fmtTime(apt.start, lang)
          const doctor = doctors.get(apt.doctorId)
          const chipIsTime = !arrived && apt.start > nowIso && mins > 60
          return {
            key: `today:${apt.id}`, tone: arrived ? 'purple' : 'info', icon: arrived ? <UserRoundCheck /> : <Clock />,
            title: <bdi>{pname(apt.patientId)}</bdi>,
            desc: <>{!chipIsTime && <><bdi>{fmtTime(apt.start, lang)}</bdi><Sep /></>}{t(`aptType.${apt.type}`)}{doctor && <><Sep /><bdi>{doctor}</bdi></>}</>,
            end: <span className={`ntf-time${chipIsTime ? '' : ' soon'}`}><bdi>{label}</bdi></span>,
            to: `/appointments?date=${a.today}`,
          }
        }),
      })
    }
    if (perms.appointments && a.unconfirmed.length) {
      const tomorrow = addDays(a.today, 1)
      out.push({
        key: 'unconfirmed', title: t('search.g.unconfirmed'), sub: t('search.g.unconfirmedSub'), count: a.unconfirmed.length, tone: 'warning',
        more: a.unconfirmed.length > 4 ? { to: `/appointments?date=${tomorrow}`, n: a.unconfirmed.length } : undefined,
        rows: a.unconfirmed.slice(0, 4).map(apt => {
          const p = a.patients.get(apt.patientId)
          const doctor = doctors.get(apt.doctorId)
          const time = fmtTime(apt.start, lang)
          return {
            key: `unconf:${apt.id}`, tone: 'warning', icon: <CalendarClock />, isNew: !seenAtOpen.has(`apt:${apt.id}`),
            title: <bdi>{pname(apt.patientId)}</bdi>,
            desc: <><bdi>{time}</bdi><Sep />{t(`aptType.${apt.type}`)}{doctor && <><Sep /><bdi>{doctor}</bdi></>}</>,
            to: `/appointments?date=${tomorrow}`,
            action: p?.phone ? { label: t('search.remind.send'), icon: <MessageCircle />, onClick: () => openExternal(whatsappLink(p.phone!, t('search.remind.message', { name: p.name, time, clinic: clinicName }))) } : undefined,
          }
        }),
      })
    }
    if (perms.clinical && a.lab.length) {
      out.push({
        key: 'lab', title: t('search.g.lab'), count: a.lab.length, tone: a.lab.some(l => l.kind === 'overdue') ? 'danger' : 'purple',
        more: a.lab.length > 4 ? { to: '/lab', n: a.lab.length } : undefined,
        rows: a.lab.slice(0, 4).map(({ order, kind, days: d }) => ({
          key: `lab:${order.id}`, tone: kind === 'overdue' ? 'danger' : 'purple', icon: <FlaskConical />, isNew: kind === 'overdue' && !seenAtOpen.has(`lab:${order.id}`),
          title: <>{t(`labType.${order.type}`)}<Sep /><bdi>{pname(order.patientId)}</bdi></>,
          desc: <><bdi>{order.labName}</bdi><Sep />{kind === 'today' ? t('search.lab.dueToday') : t('search.lab.late', { d: days(d) })}</>,
          to: '/lab',
        })),
      })
    }
    if (perms.billing && a.overdue.list.length) {
      out.push({
        key: 'overdue', title: t('search.g.overdue'), count: a.overdue.list.length, tone: 'danger',
        sub: <>{t('search.g.overdueSub')} <span className="money">{money(a.overdue.totalDue)}</span></>,
        more: a.overdue.list.length > 4 ? { to: '/invoices', n: a.overdue.list.length } : undefined,
        rows: a.overdue.list.slice(0, 4).map(({ invoice, due, days: d, basis }) => ({
          key: `inv:${invoice.id}`, tone: 'danger', icon: <Receipt />, isNew: !seenAtOpen.has(`inv:${invoice.id}`),
          title: <bdi>{pname(invoice.patientId)}</bdi>,
          desc: <><span className="ltr">{invoice.number}</span><Sep />{t(basis === 'dueDate' ? 'search.overdue.dueAgo' : 'search.overdue.issuedAgo', { d: days(d) })}</>,
          end: <span className="money neg">{money(due)}</span>,
          to: `/invoices/${invoice.id}`,
        })),
      })
    }
    if (perms.inventory && (a.lowStock.length || a.expiry.length)) {
      const rows: Row[] = [
        ...a.lowStock.map(item => {
          const out = item.quantity <= 0
          return {
            key: `stock:${item.id}`, tone: out ? 'danger' : 'warning', icon: out ? <PackageX /> : <PackageMinus />, isNew: !seenAtOpen.has(`stock:${item.id}`),
            title: <bdi>{item.name}</bdi>,
            desc: out ? t('search.stock.out') : t('search.stock.low', { q: `${item.quantity} ${unit(item.unit)}`.trim(), min: item.minQuantity }),
            to: '/inventory',
          }
        }),
        ...a.expiry.map(({ item, kind, days: d }) => ({
          key: `exp:${item.id}`, tone: kind === 'expired' ? 'danger' : 'orange', icon: kind === 'expired' ? <CalendarX2 /> : <Hourglass />,
          title: <bdi>{item.name}</bdi>,
          desc: <>{kind === 'expired' ? t('search.stock.expired', { d: days(d) }) : d === 0 ? t('search.stock.expiresToday') : t('search.stock.expiresIn', { d: days(d) })}{item.expiryDate && <><Sep /><bdi>{fmtDate(item.expiryDate, lang)}</bdi></>}</>,
          to: '/inventory',
        })),
      ]
      out.push({
        key: 'stock', title: t('search.g.stock'), count: rows.length, tone: a.lowStock.some(i => i.quantity <= 0) || a.expiry.some(x => x.kind === 'expired') ? 'danger' : 'warning',
        more: rows.length > 5 ? { to: '/inventory', n: rows.length } : undefined,
        rows: rows.slice(0, 5),
      })
    }
    if (perms.patients && a.birthdays.length) {
      out.push({
        key: 'birthdays', title: t('search.g.birthdays'), count: a.birthdays.length, tone: 'pink',
        rows: a.birthdays.map(({ patient: p, age }) => ({
          key: `bd:${p.id}`, tone: 'pink', icon: <Cake />,
          title: <bdi>{p.name}</bdi>,
          desc: t(p.gender === 'female' ? 'search.birthday.turnsF' : 'search.birthday.turnsM', { n: age }),
          to: `/patients/${p.id}`,
          action: p.phone ? { label: t('search.birthday.send'), icon: <MessageCircle />, onClick: () => openExternal(whatsappLink(p.phone!, t('search.birthday.message', { name: p.name, clinic: clinicName }))) } : undefined,
        })),
      })
    }
    if (perms.patients && a.recall.list.length) {
      out.push({
        key: 'recall', title: t('search.g.recall'), sub: t('search.g.recallSub', { n: RECALL_MONTHS }), count: a.recall.total, tone: 'accent',
        more: a.recall.total > a.recall.list.length ? { to: '/patients', n: a.recall.total } : undefined,
        rows: a.recall.list.map(({ patient: p, lastVisit, months }) => ({
          key: `recall:${p.id}`, tone: 'accent', icon: <RotateCcw />,
          title: <bdi>{p.name}</bdi>,
          desc: <>{t('search.recall.last', { m: months >= 24 ? plural(t, lang, 'search.years', Math.floor(months / 12)) : plural(t, lang, 'search.months', months) })}<Sep /><bdi>{fmtDate(lastVisit, lang)}</bdi></>,
          to: `/patients/${p.id}`,
        })),
      })
    }
    return out
  }

  const important = ids?.length ?? 0
  return (
    <Drawer open onClose={onClose} title={<span className="row gap-2">{t('nav.notifications')}{important > 0 && <Badge tone="danger" size="sm"><span className="num">{important}</span></Badge>}</span>}>
      <div className="ntf-date">{fmtDate(now, lang, 'weekday')}</div>
      {!groups ? <PanelSkeleton />
        : groups.length === 0 ? <div className="ntf-clear"><EmptyState icon={<CheckCheck />} title={t('search.notif.allClear')} description={t('search.notif.allClearDesc')} /></div>
        : groups.map(g => (
          <section key={g.key} className="ntf-group" aria-label={g.title}>
            <div className="ntf-head">
              <div className="grow">
                <div className="ntf-head-title">{g.title}<Badge size="sm" tone={g.tone}><span className="num">{g.count}</span></Badge></div>
                {g.sub && <div className="ntf-head-sub">{g.sub}</div>}
              </div>
            </div>
            <div className="ntf-list">
              {g.rows.map(r => (
                <div key={r.key} className="ntf-row">
                  <button type="button" className="ntf-main" onClick={() => go(r.to)}>
                    <IconBox tone={r.tone}>{r.icon}</IconBox>
                    <span className="ntf-text">
                      <span className="ntf-title"><span className="t">{r.title}</span>{r.isNew && <span className="ntf-new" role="img" aria-label={t('search.notif.new')} title={t('search.notif.new')} />}</span>
                      <span className="ntf-desc">{r.desc}</span>
                    </span>
                    {r.end && <span className="ntf-end">{r.end}</span>}
                  </button>
                  {r.action && <span className="ntf-action"><IconButton variant="ghost" size="sm" label={r.action.label} onClick={r.action.onClick}>{r.action.icon}</IconButton></span>}
                </div>
              ))}
              {g.more && <button type="button" className="ntf-more" onClick={() => go(g.more!.to)}>{t('search.notif.viewAllN', { n: g.more.n })}<ChevronRight /></button>}
            </div>
          </section>
        ))}
    </Drawer>
  )
}

function PanelSkeleton() {
  return (
    <div aria-busy="true">
      {[3, 2].map((n, gi) => (
        <div key={gi} className="ntf-group">
          <div className="ntf-head"><Skeleton w={150} h={16} /></div>
          <div className="ntf-list">
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="ntf-skel"><Skeleton w={40} h={40} r={12} /><div className="grow col" style={{ gap: 6 }}><Skeleton w="60%" h={13} /><Skeleton w="40%" h={11} /></div></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
