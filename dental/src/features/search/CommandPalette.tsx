/** Global search (Ctrl/⌘+K): patients, appointments, invoices, pages and quick actions; keyboard navigable. */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { ArrowDown, ArrowUp, CalendarDays, CalendarPlus, CornerDownLeft, FilePlus2, History, KeyRound, Lightbulb, Lock, Receipt, Search, SearchX, UserPlus, X } from 'lucide-react'
import { translate, useI18n } from '@/i18n'
import { useSession } from '@/app/session'
import { useDebounced, useMoney, useUsers } from '@/app/hooks'
import { ALL_NAV_ITEMS } from '@/app/nav'
import { useLicense } from '@/license/useLicense'
import { Avatar, Badge, EmptyState, Kbd, Skeleton, Spinner, toneFor } from '@/ui'
import type { Appointment } from '@/db/types'
import { formatPhone } from '@/lib/format'
import { ageFrom, fmtDate, fmtTime, relativeDay } from '@/lib/dates'
import { loadRecent, matchedPhone, pushRecent, removeRecent, saveRecent, scoreLabel, splitHighlight, textDir, tokens, type SearchInvoice } from './lib'
import { useSearch, type SlimPatient } from './useSearch'
import './search.css'

// Extra words each page answers to (both languages), on top of its translated labels.
const PAGE_WORDS: Record<string, string[]> = {
  '/': ['home', 'dashboard', 'الرئيسية', 'لوحة التحكم', 'ملخص'],
  '/appointments': ['calendar', 'schedule', 'booking', 'تقويم', 'حجز', 'جدول'],
  '/patients': ['files', 'records', 'ملفات', 'سجلات'],
  '/treatments': ['plans', 'procedures done', 'خطط العلاج', 'معالجات'],
  '/prescriptions': ['rx', 'drugs', 'medications', 'روشتة', 'أدوية'],
  '/lab': ['laboratory', 'crowns', 'مختبر', 'معمل', 'تيجان'],
  '/invoices': ['billing', 'invoice', 'bills', 'فاتورة', 'حسابات'],
  '/payments': ['receipts', 'cash', 'دفعات', 'مقبوضات', 'إيصالات'],
  '/expenses': ['costs', 'spending', 'نفقات', 'مصاريف'],
  '/reports': ['statistics', 'analytics', 'income', 'إحصائيات', 'أرباح'],
  '/inventory': ['stock', 'supplies', 'materials', 'مستودع', 'مواد', 'مستلزمات'],
  '/procedures': ['price list', 'services', 'fees', 'أسعار', 'خدمات', 'تسعيرة'],
  '/staff': ['users', 'team', 'doctors', 'employees', 'مستخدمين', 'موظفين', 'أطباء'],
  '/settings': ['preferences', 'backup', 'clinic', 'options', 'خيارات', 'نسخ احتياطي', 'العيادة'],
  '/settings/license': ['activation', 'subscription', 'code', 'تفعيل', 'اشتراك', 'كود'],
}

interface Item {
  key: string
  kind: 'recent' | 'patient' | 'appointment' | 'invoice' | 'action' | 'page'
  node: ReactNode
  run: () => void
  compact?: boolean
  onRemove?: () => void
}
interface Section { key: string; title: string; count?: number; items: Item[]; link?: { label: string; onClick: () => void } }

/** Opens the shell's quick-add modals through their keyboard shortcuts (Ctrl+Shift+N / Ctrl+Shift+A). */
function fireShortcut(key: 'N' | 'A') {
  window.setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { key, code: `Key${key}`, ctrlKey: true, shiftKey: true, bubbles: true })), 30)
}

function Hl({ text, q }: { text: string; q: string }) {
  const parts = useMemo(() => splitHighlight(text, q), [text, q])
  return <>{parts.map((p, i) => (p.hit ? <mark key={i} className="srch-hit">{p.text}</mark> : <span key={i}>{p.text}</span>))}</>
}
const Sep = () => <span className="sep" aria-hidden>·</span>
const Enter = () => <span className="srch-enter hide-mobile" aria-hidden><CornerDownLeft /></span>

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return <Palette onClose={onClose} />
}

function Palette({ onClose }: { onClose: () => void }) {
  const { t, lang, dir } = useI18n()
  const navigate = useNavigate()
  const session = useSession()
  const { readOnly } = useLicense()
  const money = useMoney()
  const users = useUsers(false)
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const byKeyboard = useRef(false)

  const [q, setQ] = useState('')
  const dq = useDebounced(q, 140)
  const [recent, setRecent] = useState<string[]>(() => loadRecent())
  const [activeKey, setActiveKey] = useState<string | null>(null)
  // Enter pressed before the debounced query settled: open the best result once it has
  const [enterQueued, setEnterQueued] = useState(false)

  const can = session.can
  const perms = useMemo(() => ({ patients: can('patients'), appointments: can('appointments'), billing: can('billing') }), [can])
  const doctorNames = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users])
  const res = useSearch(dq, perms, doctorNames)

  // focus the input, lock the page scroll, give focus back on close
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const id = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => { window.clearTimeout(id); document.body.style.overflow = prevOverflow; prevFocus?.focus?.() }
  }, [])

  const go = (to: string) => { onClose(); navigate(to) }

  // ---- pages & actions (both languages + synonyms) ----
  const pages = useMemo(() => {
    const list: { to: string; label: string; icon: LucideIcon }[] = ALL_NAV_ITEMS.filter(i => !i.perm || can(i.perm)).map(i => ({ to: i.to, label: i.label, icon: i.icon }))
    if (session.isAdmin) list.push({ to: '/settings/license', label: 'nav.license', icon: KeyRound })
    return list
  }, [can, session.isAdmin])
  const actions = useMemo(() => {
    const list: { key: string; label: string; sub: string; icon: LucideIcon; kbd?: string; words: string[]; run: () => void }[] = []
    if (!readOnly && can('patients')) list.push({ key: 'new-patient', label: 'nav.newPatient', sub: 'search.action.newPatient', icon: UserPlus, kbd: 'Ctrl+Shift+N', words: ['add patient', 'register', 'إضافة مريض', 'تسجيل مريض', 'ملف جديد'], run: () => { onClose(); fireShortcut('N') } })
    if (!readOnly && can('appointments')) list.push({ key: 'new-apt', label: 'nav.newAppointment', sub: 'search.action.newAppointment', icon: CalendarPlus, kbd: 'Ctrl+Shift+A', words: ['book', 'schedule', 'حجز موعد', 'إضافة موعد'], run: () => { onClose(); fireShortcut('A') } })
    if (!readOnly && can('billing')) list.push({ key: 'new-inv', label: 'nav.newInvoice', sub: 'search.action.newInvoice', icon: FilePlus2, words: ['bill', 'invoice', 'إصدار فاتورة', 'فوترة'], run: () => go('/invoices?new=1') })
    list.push({ key: 'lock', label: 'nav.lock', sub: 'search.action.lock', icon: Lock, words: ['sign out', 'logout', 'قفل', 'خروج'], run: () => { onClose(); session.lock() } })
    return list
  }, [readOnly, can, session.lock])

  const hasQuery = tokens(q).length > 0
  // results always belong to the debounced query; they stay on screen while the next keystrokes settle
  const settled = hasQuery && tokens(dq).length > 0
  const pending = hasQuery && (dq !== q || !res.ready)

  // ---- sections ----
  const sections = useMemo<Section[]>(() => {
    const out: Section[] = []
    const labelsOf = (key: string, extra: string[] = []) => [translate('ar', key), translate('en', key), ...extra]
    const actionItem = (a: typeof actions[number]): Item => ({
      key: `action:${a.key}`, kind: 'action', run: a.run, compact: !hasQuery,
      node: <>
        <span className="srch-ico tone-primary"><a.icon /></span>
        <span className="srch-text"><span className="srch-title"><Hl text={t(a.label)} q={dq} /></span><span className="srch-sub">{t(a.sub)}</span></span>
        <span className="srch-end">{a.kbd && <span className="hide-mobile"><Kbd>{a.kbd}</Kbd></span>}<Enter /></span>
      </>,
    })
    const pageItem = (p: typeof pages[number]): Item => ({
      key: `page:${p.to}`, kind: 'page', run: () => go(p.to), compact: true,
      node: <>
        <span className="srch-ico"><p.icon /></span>
        <span className="srch-text"><span className="srch-title"><Hl text={t(p.label)} q={dq} /></span></span>
        <span className="srch-end"><Enter /></span>
      </>,
    })

    if (!hasQuery) {
      if (recent.length) out.push({
        key: 'recent', title: t('search.group.recent'),
        link: { label: t('search.clearRecent'), onClick: () => { setRecent([]); saveRecent([]); inputRef.current?.focus() } },
        items: recent.map(r => ({
          key: `recent:${r}`, kind: 'recent', compact: true,
          run: () => { setQ(r); setActiveKey(null); inputRef.current?.focus() },
          onRemove: () => { const next = removeRecent(recent, r); setRecent(next); saveRecent(next); inputRef.current?.focus() },
          node: <>
            <span className="srch-ico"><History /></span>
            <span className="srch-text"><span className="srch-title"><bdi>{r}</bdi></span></span>
          </>,
        })),
      })
      if (actions.length) out.push({ key: 'actions', title: t('search.group.actions'), items: actions.map(actionItem) })
      out.push({ key: 'pages', title: t('search.group.pages'), items: pages.map(pageItem) })
      return out
    }
    if (!settled) return out

    if (res.patients.length) out.push({
      key: 'patients', title: t('search.group.patients'), count: res.patients.length,
      items: res.patients.map(({ item: p }) => patientItem(p)),
    })
    if (res.appointments.length) out.push({
      key: 'appointments', title: t('search.group.appointments'), count: res.appointments.length,
      items: res.appointments.map(a => appointmentItem(a)),
    })
    if (res.invoices.length) out.push({
      key: 'invoices', title: t('search.group.invoices'), count: res.invoices.length,
      items: res.invoices.map(({ invoice }) => invoiceItem(invoice)),
    })
    const acts = actions.map(a => ({ a, s: scoreLabel(labelsOf(a.label, a.words), dq) })).filter(x => x.s > 0).sort((x, y) => y.s - x.s)
    if (acts.length) out.push({ key: 'actions', title: t('search.group.actions'), items: acts.map(x => actionItem(x.a)) })
    const pgs = pages.map(p => ({ p, s: scoreLabel(labelsOf(p.label, PAGE_WORDS[p.to]), dq) })).filter(x => x.s > 0).sort((x, y) => y.s - x.s).slice(0, 5)
    if (pgs.length) out.push({ key: 'pages', title: t('search.group.pages'), items: pgs.map(x => pageItem(x.p)) })
    return out

    function patientItem(p: SlimPatient): Item {
      const phone = matchedPhone(p, dq)
      const age = ageFrom(p.birthDate)
      return {
        key: `patient:${p.id}`, kind: 'patient', run: () => go(`/patients/${p.id}`),
        node: <>
          <Avatar name={p.name} src={res.photos.get(p.id)} size="sm" />
          <span className="srch-text">
            <span className="srch-title"><bdi><Hl text={p.name} q={dq} /></bdi></span>
            <span className="srch-sub">
              <span className="num"><Hl text={`#${p.fileNo}`} q={dq} /></span>
              {phone && <><Sep /><span className="num"><Hl text={formatPhone(phone)} q={dq} /></span></>}
              {age !== null && <><Sep />{age} {t('years')}</>}
            </span>
          </span>
          <span className="srch-end">{p.archived && <Badge size="sm">{t('archived')}</Badge>}<Enter /></span>
        </>,
      }
    }
    function appointmentItem(a: Appointment): Item {
      const p = res.byId.get(a.patientId)
      const doctor = doctorNames.get(a.doctorId)
      return {
        key: `apt:${a.id}`, kind: 'appointment', run: () => go(`/appointments?date=${a.date}&view=day`),
        node: <>
          <span className="srch-ico status" style={{ '--st': `var(--st-${a.status})` } as CSSProperties}><CalendarDays /></span>
          <span className="srch-text">
            <span className="srch-title"><bdi><Hl text={p?.name ?? '—'} q={dq} /></bdi></span>
            <span className="srch-sub">{relativeDay(a.date, lang)}<Sep /><bdi>{fmtTime(a.start, lang)}</bdi>{doctor && <><Sep /><bdi><Hl text={doctor} q={dq} /></bdi></>}</span>
          </span>
          <span className="srch-end"><Badge size="sm" tone={toneFor(a.status)}>{t(`apt.${a.status}`)}</Badge><Enter /></span>
        </>,
      }
    }
    function invoiceItem(inv: SearchInvoice): Item {
      const p = res.byId.get(inv.patientId)
      return {
        key: `inv:${inv.id}`, kind: 'invoice', run: () => go(`/invoices/${inv.id}`),
        node: <>
          <span className="srch-ico"><Receipt /></span>
          <span className="srch-text">
            <span className="srch-title"><span className="ltr"><Hl text={inv.number} q={dq} /></span></span>
            <span className="srch-sub">{p && <><bdi><Hl text={p.name} q={dq} /></bdi><Sep /></>}<bdi>{fmtDate(inv.date, lang)}</bdi></span>
          </span>
          <span className="srch-end"><span className="srch-stack"><span className="money">{money(inv.total)}</span><Badge size="sm" tone={toneFor(inv.status)}>{t(`inv.${inv.status}`)}</Badge></span><Enter /></span>
        </>,
      }
    }
  }, [hasQuery, settled, dq, recent, actions, pages, res, doctorNames, t, lang, money])

  const flat = useMemo(() => sections.flatMap(s => s.items), [sections])
  const found = flat.findIndex(i => i.key === activeKey)
  const idx = found >= 0 ? found : 0
  const optId = (i: number) => `${listId}-o${i}`

  // keep the highlighted row in view when moving with the keyboard
  useEffect(() => {
    if (!byKeyboard.current) return
    byKeyboard.current = false
    if (idx === 0) bodyRef.current?.scrollTo({ top: 0 })
    else document.getElementById(optId(idx))?.scrollIntoView({ block: 'nearest' })
  }, [idx])

  const activate = (item: Item) => {
    if (item.kind !== 'recent' && hasQuery) { const next = pushRecent(recent, q); setRecent(next); saveRecent(next) }
    item.run()
  }
  const move = (d: number) => {
    if (!flat.length) return
    byKeyboard.current = true
    setActiveKey(flat[(idx + d + flat.length) % flat.length].key)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return }
    // a focused button (clear, remove, close) keeps its own Enter / Space
    if (e.target !== inputRef.current && (e.target as HTMLElement).closest('button')) return
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (pending) { setEnterQueued(true); return }
      const item = flat[idx]
      if (item) activate(item)
    }
  }
  useEffect(() => {
    if (!enterQueued || pending) return
    setEnterQueued(false)
    const item = flat[idx]
    if (item) activate(item)
  }, [enterQueued, pending, flat, idx]) // eslint-disable-line react-hooks/exhaustive-deps
  // clicks on the list keep the focus (and the keyboard) in the search box; buttons still get their click
  const keepFocus = (e: MouseEvent) => { if (e.target !== inputRef.current) e.preventDefault() }

  // what is typed keeps its own reading order: "0944 123 456" in the Arabic UI, "أحمد" in the English one
  const typedDir = textDir(q)
  const flip = q.trim() !== '' && typedDir !== dir
  const showSkeleton = pending && !flat.length
  const showEmpty = hasQuery && !pending && !flat.length
  let row = -1

  return createPortal(
    <div className="overlay srch-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="srch-panel" role="dialog" aria-modal="true" aria-label={t('search.label')} onKeyDown={onKeyDown} onMouseDown={keepFocus}>
        <div className="srch-head">
          <Search className="srch-glass" aria-hidden />
          <input
            ref={inputRef} className={`srch-input${flip ? ' flip' : ''}`} value={q} autoFocus dir={flip ? typedDir : undefined}
            onChange={e => { setQ(e.target.value); setActiveKey(null); setEnterQueued(false) }}
            placeholder={t('searchPlaceholder')} aria-label={t('search.label')}
            role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={flat.length ? optId(idx) : undefined}
            autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search"
          />
          {pending && flat.length > 0 && <Spinner />}
          {q && <button type="button" className="srch-clear" onClick={() => { setQ(''); setActiveKey(null); inputRef.current?.focus() }} aria-label={t('clear')} title={t('clear')}><X /></button>}
          <button type="button" className="srch-esc hide-mobile" onClick={onClose} aria-label={t('close')}><Kbd>Esc</Kbd></button>
          <button type="button" className="btn btn-ghost btn-icon srch-close" onClick={onClose} aria-label={t('close')}><X /></button>
        </div>

        <div className="srch-body" ref={bodyRef} id={listId} role="listbox" aria-label={t('search.label')}>
          {!hasQuery && !recent.length && <div className="srch-tip"><Lightbulb aria-hidden />{t('search.tip')}</div>}
          {showSkeleton && (
            <div aria-busy="true" aria-label={t('search.searching')}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="srch-skel"><Skeleton w={36} h={36} r={10} /><div className="grow col" style={{ gap: 6 }}><Skeleton w={`${55 - i * 8}%`} h={13} /><Skeleton w={`${35 - i * 4}%`} h={11} /></div></div>
              ))}
            </div>
          )}
          {showEmpty && (
            <div className="srch-empty"><EmptyState compact icon={<SearchX />} title={t('search.noResults', { q: q.trim() })} description={t('search.noResultsDesc')} /></div>
          )}
          {sections.map(s => (
            <div key={s.key} className="srch-group" role="group" aria-label={s.title}>
              <div className="srch-group-title">
                <span>{s.title}</span>
                {s.count !== undefined && <span className="srch-count num">{s.count}</span>}
                {s.link && <button type="button" className="srch-link" onClick={s.link.onClick}>{s.link.label}</button>}
              </div>
              {s.items.map(item => {
                row++
                const i = row
                const active = i === idx
                return (
                  <div
                    key={item.key} id={optId(i)} role="option" aria-selected={active}
                    className={`srch-item${active ? ' active' : ''}${item.compact ? ' compact' : ''}`}
                    onMouseMove={() => { if (!active) setActiveKey(item.key) }}
                    onClick={() => activate(item)}
                  >
                    {item.node}
                    {item.onRemove && (
                      <button type="button" className="srch-remove" aria-label={t('search.removeRecent')} title={t('search.removeRecent')} onClick={e => { e.stopPropagation(); item.onRemove!() }}><X /></button>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="srch-foot">
          <span><Kbd><ArrowUp /></Kbd><Kbd><ArrowDown /></Kbd>{t('search.hint.navigate')}</span>
          <span><Kbd><CornerDownLeft /></Kbd>{t('search.hint.open')}</span>
          <span><Kbd>Esc</Kbd>{t('search.hint.close')}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
