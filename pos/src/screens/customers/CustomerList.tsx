// The customers list: head numbers, Arabic-friendly search, sort, the "with debt" filter, and the add sheet.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Users, Search, Wallet, HandCoins } from 'lucide-react'
import { db } from '../../db'
import type { Customer } from '../../db/types'
import { useT } from '../../i18n'
import { Avatar, Button, Empty, SearchInput, Seg, Spinner, useIsMobile } from '../../components/ui'
import { formatMoney } from '../../lib/money'
import { balanceKind, customerStats, matchesCustomer, sortCustomers, type CustomerSort } from '../../lib/customers'
import { useSettings } from '../../state/store'
import { CustomerForm } from './CustomerForm'

const PAGE = 150

export function CustomerList() {
  const t = useT()
  const nav = useNavigate()
  const c = useSettings().currency
  const mobile = useIsMobile()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<CustomerSort>('name')
  const [debtOnly, setDebtOnly] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [adding, setAdding] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const customers = useLiveQuery(() => db.customers.toArray(), [])
  const stats = useMemo(() => customerStats(customers ?? [], c.decimals), [customers, c.decimals])
  const list = useMemo(() => {
    if (!customers) return undefined
    let l = customers
    if (debtOnly) l = l.filter(x => x.balance > 0)
    if (q.trim()) l = l.filter(x => matchesCustomer(x, q))
    return sortCustomers(l, sort)
  }, [customers, q, sort, debtOnly])
  useEffect(() => { setLimit(PAGE) }, [q, sort, debtOnly])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'F1') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  const visible = list ? list.slice(0, limit) : []

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t('nav.customers')}</h1>
        <div className="actions">
          {!mobile && <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAdding(true)}>{t('customers.add')}</Button>}
        </div>
      </div>
      <div className="page-body col">
        <div className="stats cu-stats">
          <div className="stat"><div className="stat-label"><Users size={14} /> {t('customers.count')}</div><div className="stat-value num">{stats.count}</div><div className="stat-sub">{t('customers.debtors', { n: stats.debtors })}</div></div>
          <div className="stat cu-stat-debt"><div className="stat-label"><Wallet size={14} /> {t('customers.totalDebt')}</div><div className="stat-value num">{formatMoney(stats.totalDebt, c)}</div></div>
          <div className="stat cu-stat-credit"><div className="stat-label"><HandCoins size={14} /> {t('customers.totalCredit')}</div><div className="stat-value num">{formatMoney(stats.totalCredit, c)}</div></div>
        </div>
        <div className="cu-toolbar">
          <SearchInput className="grow" value={q} onChange={setQ} placeholder={t('customers.search')} inputRef={searchRef} noWedge />
          <Seg value={sort} onChange={setSort} options={[{ value: 'name', label: t('customers.sort.name') }, { value: 'debt', label: t('customers.sort.debt') }, { value: 'recent', label: t('customers.sort.recent') }]} />
          <button type="button" className={`chip ${debtOnly ? 'on' : ''}`} onClick={() => setDebtOnly(v => !v)} aria-pressed={debtOnly}><Wallet size={14} /> {t('customers.filterDebt')}</button>
        </div>

        {!list ? <div className="empty"><Spinner /></div> : list.length === 0 ? (
          customers && customers.length === 0
            ? <Empty icon={<Users size={32} />} title={t('customers.empty')} text={t('customers.emptyText')} action={<Button variant="primary" icon={<Plus size={18} />} onClick={() => setAdding(true)}>{t('customers.add')}</Button>} />
            : <Empty icon={<Search size={32} />} title={t('customers.noResults')} />
        ) : (
          <div className="card list">
            {visible.map(x => <CustomerRow key={x.id} customer={x} onOpen={() => nav(`/customers/${x.id}`)} />)}
          </div>
        )}
        {list && list.length > visible.length && (
          <div className="cu-more">
            <Button variant="outline" onClick={() => setLimit(l => l + PAGE)}>{t('customers.showMore')}</Button>
            <span className="xs faint num">{t('customers.shown', { n: visible.length, total: list.length })}</span>
          </div>
        )}
      </div>
      {mobile && <button type="button" className="cu-fab" onClick={() => setAdding(true)} aria-label={t('customers.add')}><Plus size={26} /></button>}
      <CustomerForm open={adding} onClose={() => setAdding(false)} onSaved={x => nav(`/customers/${x.id}`)} />
    </div>
  )
}

function CustomerRow({ customer: x, onOpen }: { customer: Customer; onOpen: () => void }) {
  const t = useT()
  const c = useSettings().currency
  const kind = balanceKind(x.balance)
  return (
    <button type="button" className="list-row cu-row" onClick={onOpen}>
      <Avatar name={x.name} round />
      <span className="grow truncate">
        <span className="title truncate">{x.name}</span>
        <span className="sub truncate">{x.phone ? <span className="num">{x.phone}</span> : x.address ? x.address : <span className="faint">{t('customers.noPhone')}</span>}</span>
      </span>
      <span className="end">
        <span className={`cu-bal num ${kind}`}>{kind === 'zero' ? '—' : formatMoney(Math.abs(x.balance), c)}</span>
        {kind !== 'zero' && <span className="cu-bal-tag">{t(`customers.balance.${kind}`)}</span>}
      </span>
    </button>
  )
}
