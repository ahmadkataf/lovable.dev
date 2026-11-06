// Read-only panels under the team grid: what each role may do, and who signed in lately.
import { Fragment } from 'react'
import { Check, History, LogIn, Minus, ShieldCheck } from 'lucide-react'
import { Avatar, Badge, Card, CardHeader, EmptyState, Skeleton } from '@/ui'
import { useI18n } from '@/i18n'
import type { Activity, User } from '@/db/types'
import { dateOf, fmtTime, relativeDay, timeAgo, fmtDateTime } from '@/lib/dates'
import { displayName, plainName } from '@/features/auth/lib'
import { AREAS, ROLES, ROLE_TONE, roleCan } from './lib'

export function PermissionsMatrix() {
  const { t } = useI18n()
  return (
    <Card data-qa="matrix">
      <CardHeader icon={<ShieldCheck />} title={t('staff.matrixTitle')} subtitle={t('staff.matrixSub')} />
      <div className="au-matrix-wrap">
        <table className="au-matrix">
          <thead>
            <tr>
              <th>{t('staff.matrixArea')}</th>
              {ROLES.map(r => <th key={r} className="au-role-col"><Badge tone={ROLE_TONE[r]} size="sm">{t(`role.${r}`)}</Badge></th>)}
            </tr>
          </thead>
          <tbody>
            {AREAS.map(a => (
              <tr key={a}>
                <td><div className="au-area-name">{t(`staff.area.${a}`)}</div><div className="au-area-desc">{t(`staff.areaDesc.${a}`)}</div></td>
                {ROLES.map(r => (
                  <td key={r} className="au-cell">
                    {roleCan(r, a)
                      ? <span className="au-yes" title={t('staff.allowed')} aria-label={t('staff.allowed')}><Check /></span>
                      : <span className="au-no" title={t('staff.notAllowed')} aria-label={t('staff.notAllowed')}><Minus /></span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export function SignInLog({ rows, users }: { rows: Activity[] | undefined; users: User[] }) {
  const { t, lang } = useI18n()
  const byId = new Map(users.map(u => [u.id, u]))
  let lastDay = ''
  return (
    <Card data-qa="signin-log">
      <CardHeader icon={<History />} title={t('staff.logTitle')} subtitle={t('staff.logSub')} />
      {!rows ? (
        <div className="col gap-3" style={{ padding: 20 }}>{[0, 1, 2, 3].map(i => <div key={i} className="row gap-3"><Skeleton w={32} h={32} r={16} /><div className="grow col gap-2"><Skeleton w="50%" h={12} /><Skeleton w="30%" h={10} /></div></div>)}</div>
      ) : rows.length === 0 ? (
        <EmptyState compact icon={<LogIn />} title={t('staff.logEmpty')} />
      ) : (
        <div className="au-log list">
          {rows.map(r => {
            const u = r.by ? byId.get(r.by) : undefined
            const day = dateOf(r.at)
            const header = day !== lastDay ? relativeDay(day, lang) : null
            lastDay = day
            return (
              <Fragment key={r.id}>
                {header && <div className="au-log-day">{header}</div>}
                <div className="list-item" title={fmtDateTime(r.at, lang)}>
                  <Avatar name={plainName(u?.name ?? r.message)} color={u?.color} size="sm" />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="li-main truncate">{u ? displayName(u) : r.message}</div>
                    <div className="li-sub truncate">{u ? t(`role.${u.role}`) : t('staff.logDeleted')}</div>
                  </div>
                  <div className="li-end"><bdi className="au-log-time">{fmtTime(r.at, lang)}</bdi><span>{timeAgo(r.at, lang)}</span></div>
                </div>
              </Fragment>
            )
          })}
        </div>
      )}
    </Card>
  )
}
