// /inbox — what the centre told you. Opening it marks everything read. Empty state: content.booking.inbox_empty_*.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NotificationKind } from '@shared/types'
import { useNotifications } from '../lib/notifications'
import { fmtDate, fmtTime } from '../format'
import { Icon, Spinner, type IconName } from '../ui'
import { ContentEmpty, useBookingCopy } from '../components/ContentText'

const KIND_ICON: Record<NotificationKind, IconName> = {
  booking_created: 'calendar', payment_submitted: 'send', booking_confirmed: 'check', booking_rejected: 'x',
  booking_cancelled: 'x', booking_expired: 'clock', booking_reminder: 'bell', announcement: 'bell',
}

export function Inbox() {
  const { items, loading, fromCache, markAllRead } = useNotifications()
  const navigate = useNavigate()
  const copy = useBookingCopy()
  useEffect(() => { void markAllRead() }, [markAllRead])

  return (
    <div className="stack">
      <div className="page-head"><h1 className="h1">الإشعارات</h1></div>
      {fromCache && <div className="alert alert-info">تعرض نسخة محفوظة.</div>}
      {loading && items.length === 0 && <div className="center" style={{ padding: 32 }}><Spinner /></div>}
      {!loading && items.length === 0 && <ContentEmpty title={copy.text('inbox_empty_title')} hint={copy.text('inbox_empty_text')} vars={copy.vars} />}
      <div className="stack-sm">
        {items.map((n) => (
          <div
            key={n.id}
            className={`notice${n.read ? '' : ' is-unread'}`}
            role={n.booking_id ? 'button' : undefined}
            tabIndex={n.booking_id ? 0 : undefined}
            style={n.booking_id ? { cursor: 'pointer' } : undefined}
            onClick={n.booking_id ? () => navigate(`/b/${n.booking_id}`) : undefined}
            onKeyDown={n.booking_id ? (e) => { if (e.key === 'Enter') navigate(`/b/${n.booking_id}`) } : undefined}
          >
            <span className="notice-ico"><Icon name={KIND_ICON[n.kind] || 'bell'} size={18} /></span>
            <div className="grow">
              <div className="notice-title">{n.title}</div>
              <div className="notice-body">{n.body}</div>
              <div className="notice-time">{fmtDate(n.created_at)} · {fmtTime(n.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
