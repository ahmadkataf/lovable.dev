import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, History } from 'lucide-react'
import { useCollection } from '../db/store'
import type { AuditAction } from '../db/types'
import { addDays, fmtDateTime, matches, toInputDate, rangeStart, rangeEnd, fmtDateExcel } from '../lib/format'
import { DateRange, Empty, SearchInput, Chips } from '../ui/components'
import { exportSheet } from '../lib/excel'

const ACTIONS: Record<AuditAction, { label: string; tone: string }> = {
  create: { label: 'إضافة', tone: 'tone-success' }, update: { label: 'تعديل', tone: 'tone-info' }, delete: { label: 'حذف', tone: 'tone-danger' }, restore: { label: 'استعادة', tone: 'tone-warning' },
  login: { label: 'دخول', tone: 'tone-muted' }, logout: { label: 'خروج', tone: 'tone-muted' }, settings: { label: 'إعدادات', tone: 'tone-accent' }, stock: { label: 'جرد', tone: 'tone-warning' }, backup: { label: 'نسخ احتياطي', tone: 'tone-muted' },
}

/** Who did what and when, on which device: the owner's eye on the shop. */
export function Activity() {
  const audit = useCollection('audit')
  const users = useCollection('users')
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [user, setUser] = useState('all')
  const [action, setAction] = useState<'all' | AuditAction>('all')
  const [from, setFrom] = useState(toInputDate(addDays(Date.now(), -7)))
  const [to, setTo] = useState(toInputDate(Date.now()))
  const list = useMemo(() => {
    const f = rangeStart(from), t = rangeEnd(to)
    return Array.from(audit.values()).filter(a => a.date >= f && a.date <= t && (user === 'all' || (a.userId ?? '_') === user) && (action === 'all' || a.action === action) && matches(q, a.summary, a.userName, a.device)).sort((a, b) => b.date - a.date).slice(0, 1000)
  }, [audit, q, user, action, from, to])
  const userList = Array.from(users.values())
  return (
    <div className="stack">
      <div className="toolbar">
        <div className="search"><SearchInput value={q} onChange={setQ} placeholder="بحث في السجل…" /></div>
        <select className="select" style={{ width: 'auto' }} value={user} onChange={e => setUser(e.target.value)}><option value="all">كل المستخدمين</option>{userList.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}<option value="_">بدون مستخدم</option></select>
        <DateRange from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b) }} />
        <button className="btn" onClick={() => exportSheet(`سجل-النشاط-${from}-${to}`, list.map(a => ({ 'التاريخ': fmtDateExcel(a.date), 'المستخدم': a.userName, 'العملية': ACTIONS[a.action]?.label ?? a.action, 'البيان': a.summary, 'الجهاز': a.device })), 'السجل')}><FileSpreadsheet /></button>
      </div>
      <Chips value={action} onChange={setAction} items={[{ id: 'all', label: 'الكل' }, ...(Object.keys(ACTIONS) as AuditAction[]).map(k => ({ id: k, label: ACTIONS[k].label }))]} />
      <div className="card">
        {list.length === 0 ? <Empty title="لا نشاط في هذه الفترة" icon={<History />} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>البيان</th><th className="hide-mobile">الجهاز</th></tr></thead>
            <tbody>{list.map(a => (
              <tr key={a.id} className={a.collection === 'sales' && a.refId && a.action !== 'delete' ? 'click' : ''} onClick={() => { if (a.collection === 'sales' && a.refId && a.action !== 'delete') nav(`/sales?open=${a.refId}`) }}>
                <td className="small muted" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(a.date)}</td>
                <td className="bold">{a.userName}</td>
                <td><span className={`badge ${ACTIONS[a.action]?.tone ?? 'tone-muted'}`}>{ACTIONS[a.action]?.label ?? a.action}</span></td>
                <td>{a.summary}</td>
                <td className="hide-mobile small muted">{a.device}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      <p className="help">يُسجَّل تلقائياً: الفواتير والمرتجعات والمشتريات والدفعات والمصاريف والجرد وتعديل الأسعار والمستخدمين وسعر الدولار وتسجيل الدخول والاستعادة من المحذوفات.</p>
    </div>
  )
}
