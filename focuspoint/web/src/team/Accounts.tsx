// /team/accounts — الحسابات (admin): the month's income (paid bookings + other income), expenses, net; what is owed to
// the centre (إلي) and what it owes (عليّ). Booking income comes from the bookings themselves (paid_at); the rest is
// typed here. Online only: the figures must be the server's.
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AccountsMonth, Booking, Currency, LedgerEntry, LedgerKind, Money } from '@shared/types'
import { fmtMoney } from '@shared/pricing'
import { api } from '../api'
import { fmtDate, todayLocal } from '../format'
import { Badge, Button, Card, Empty, Field, Icon, Input, Segmented, Select, Sheet, Spinner, Textarea, useToast } from '../ui'
import { Confirm, PageHead } from './common'
import { store } from './store'
import { describeError, downloadText, parseInt10, toCSV } from './util'

export const CATEGORIES: { id: string; label: string }[] = [
  { id: 'rent', label: 'إيجار' }, { id: 'salaries', label: 'رواتب' }, { id: 'electricity', label: 'كهرباء وأمبيرات' },
  { id: 'internet', label: 'إنترنت' }, { id: 'hospitality', label: 'ضيافة وقهوة' }, { id: 'maintenance', label: 'صيانة' },
  { id: 'supplies', label: 'مستلزمات' }, { id: 'marketing', label: 'تسويق' }, { id: 'courses', label: 'كورسات' }, { id: 'other', label: 'أخرى' },
]
const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id
const KIND_LABEL: Record<LedgerKind, string> = { expense: 'مصروف', income: 'دخل آخر', payable: 'دين عليّ', receivable: 'دين إلي' }
const GROUP_LABEL: Record<AccountsMonth['by_kind'][number]['key'], string> = {
  hourly: 'حجوزات بالساعة', subscription: 'اشتراكات', hall_org: 'القاعة — جهات خاصة ومنظمات', hall_gov: 'القاعة — جهات حكومية',
}
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول']
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
const shiftMonth = (m: string, d: number) => {
  const [y, mo] = m.split('-').map(Number)
  const t = y * 12 + (mo - 1) + d
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}
/** "12,500 ل.س + 30 $" (only the currencies that are not zero; "0 ل.س" when both are). */
export function money(m: Money): string {
  const one = (n: number, c: Currency) => (n < 0 ? `\u2212${fmtMoney(-n, c)}` : fmtMoney(n, c))   // a real minus sign, placed right in RTL
  const parts = [m.SYP ? one(m.SYP, 'SYP') : '', m.USD ? one(m.USD, 'USD') : ''].filter(Boolean)
  return parts.length ? parts.join(' + ') : fmtMoney(0)
}

export function Accounts() {
  const toast = useToast()
  const [month, setMonth] = useState(() => todayLocal().slice(0, 7))
  const [data, setData] = useState<AccountsMonth | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Partial<LedgerEntry> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await api.get<AccountsMonth>(`/v1/admin/accounts?month=${month}`)); setError(null) }
    catch (e) { setError(describeError(e)) } finally { setLoading(false) }
  }, [month])
  useEffect(() => { void load() }, [load])

  async function settle(e: LedgerEntry, settled: boolean) {
    try { await api.patch(`/v1/admin/ledger/${e.id}`, { settled }); toast.show(settled ? 'تم التسجيل كمدفوع' : 'رجع مفتوحاً', 'ok'); void load() }
    catch (err) { toast.show(describeError(err), 'error') }
  }
  async function bookingPaid(b: Booking) {
    try { await api.post(`/v1/team/bookings/${b.id}/paid`, { paid: true }); toast.show(`تم تسجيل دفعة ${b.customer_name}`, 'ok'); void load(); void store.refetch() }
    catch (err) { toast.show(describeError(err), 'error') }
  }

  function csv() {
    if (!data) return
    const rows: (string | number | null)[][] = [['النوع', 'التصنيف', 'المبلغ', 'العملة', 'التاريخ', 'الجهة', 'ملاحظة', 'سُدّد']]
    for (const e of data.entries) rows.push([KIND_LABEL[e.kind], catLabel(e.category), e.amount, e.currency, e.date, e.party, e.note, e.settled_at ? e.settled_at.slice(0, 10) : ''])
    rows.push([], ['الدخل من الحجوزات', '', data.income.bookings.SYP, 'SYP'], ['', '', data.income.bookings.USD, 'USD'],
      ['المصاريف', '', data.expenses.SYP, 'SYP'], ['', '', data.expenses.USD, 'USD'], ['الصافي', '', data.net.SYP, 'SYP'], ['', '', data.net.USD, 'USD'])
    downloadText(`focuspoint-accounts-${month}.csv`, toCSV(rows), 'text/csv;charset=utf-8')
  }

  return (
    <>
      <PageHead title="الحسابات" sub="الدخل والمصاريف وشو إلك وشو عليك">
        <Button size="sm" onClick={() => setEditing({ kind: 'expense', category: 'rent', currency: 'SYP', date: todayLocal() })}><Icon name="plus" size={18} /> قيد جديد</Button>
      </PageHead>

      <div className="acc-month">
        <button type="button" className="icon-btn" aria-label="الشهر السابق" onClick={() => setMonth(shiftMonth(month, -1))}><Icon name="arrowRight" /></button>
        <b>{monthLabel(month)}</b>
        <button type="button" className="icon-btn" aria-label="الشهر التالي" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= todayLocal().slice(0, 7)}><Icon name="arrowLeft" /></button>
        {loading && <Spinner size="sm" />}
      </div>

      {error && !data && <div className="alert alert-error">{error}</div>}
      {!data && !error && <div className="center center-pad"><Spinner /></div>}

      {data && (
        <div className="acc">
          <div className="acc-kpis">
            <div className="acc-kpi is-in"><span>الدخل</span><b>{money(data.income.total)}</b><small>حجوزات {money(data.income.bookings)}{(data.income.other.SYP || data.income.other.USD) ? ` · أخرى ${money(data.income.other)}` : ''}</small></div>
            <div className="acc-kpi is-out"><span>المصاريف</span><b>{money(data.expenses)}</b></div>
            <div className={`acc-kpi ${data.net.SYP < 0 || data.net.USD < 0 ? 'is-neg' : 'is-net'}`}><span>الصافي</span><b>{money(data.net)}</b></div>
          </div>

          <div className="acc-two">
            <Card>
              <div className="card-title">إلي <span className="muted small">(مبالغ لسا ما وصلت)</span></div>
              <p className="acc-total">{money(data.owed_to_me.total)}</p>
              {data.owed_to_me.bookings.length === 0 && data.owed_to_me.entries.length === 0 && <p className="muted small">ما في شي معلّق.</p>}
              <ul className="acc-list">
                {data.owed_to_me.bookings.map((b) => (
                  <li key={`b${b.id}`}>
                    <span><b>{b.customer_name}</b><small>{b.room_name} · {fmtDate(b.start)}{b.tier === 'org' ? ' · جهة خاصة/منظمة' : b.tier === 'gov' ? ' · جهة حكومية' : ''}</small></span>
                    <span className="acc-amt">{fmtMoney(b.price, b.currency)}<Button size="sm" variant="soft" onClick={() => void bookingPaid(b)}>وصل</Button></span>
                  </li>
                ))}
                {data.owed_to_me.entries.map((e) => (
                  <li key={`e${e.id}`}>
                    <span><b>{e.party || catLabel(e.category)}</b><small>{e.note || 'دين'} · {fmtDate(e.date + 'T12:00:00Z')}</small></span>
                    <span className="acc-amt">{fmtMoney(e.amount, e.currency)}<Button size="sm" variant="soft" onClick={() => void settle(e, true)}>وصل</Button></span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <div className="card-title">عليّ <span className="muted small">(فواتير وديون لازم تندفع)</span></div>
              <p className="acc-total is-out">{money(data.i_owe.total)}</p>
              {data.i_owe.entries.length === 0 && <p className="muted small">ما عليك شي مسجّل.</p>}
              <ul className="acc-list">
                {data.i_owe.entries.map((e) => (
                  <li key={e.id}>
                    <span><b>{e.party || catLabel(e.category)}</b><small>{catLabel(e.category)}{e.note ? ` · ${e.note}` : ''} · {fmtDate(e.date + 'T12:00:00Z')}</small></span>
                    <span className="acc-amt">{fmtMoney(e.amount, e.currency)}<Button size="sm" variant="soft" onClick={() => void settle(e, true)}>دفعت</Button></span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="acc-two">
            <Card>
              <div className="card-title">الدخل حسب النوع</div>
              {data.by_kind.length === 0 ? <p className="muted small">ما في حجوزات مدفوعة بهالشهر.</p> : (
                <ul className="acc-list">{data.by_kind.map((k) => <li key={k.key}><span><b>{GROUP_LABEL[k.key]}</b><small>{k.bookings} حجز</small></span><span className="acc-amt">{money(k.amount)}</span></li>)}</ul>
              )}
              {data.by_room.length > 0 && <>
                <div className="card-title mt">حسب المكان</div>
                <ul className="acc-list">{data.by_room.map((r) => <li key={r.room}><span><b>{r.room}</b><small>{r.bookings} حجز</small></span><span className="acc-amt">{money(r.amount)}</span></li>)}</ul>
              </>}
            </Card>
            <Card>
              <div className="card-title">المصاريف حسب التصنيف</div>
              {data.by_category.length === 0 ? <p className="muted small">ما في مصاريف مسجّلة بهالشهر.</p> : (
                <ul className="acc-list">{data.by_category.map((c) => <li key={c.category}><span><b>{catLabel(c.category)}</b></span><span className="acc-amt">{money(c.amount)}</span></li>)}</ul>
              )}
            </Card>
          </div>

          <Card>
            <div className="row between gap wrap" style={{ marginBottom: 8 }}>
              <div className="card-title" style={{ margin: 0 }}>قيود الشهر</div>
              <Button size="sm" variant="ghost" onClick={csv}><Icon name="download" size={18} /> تصدير CSV</Button>
            </div>
            {data.entries.length === 0 ? <Empty title="ما في قيود بهالشهر" hint="سجّل المصاريف (إيجار، رواتب، كهرباء…) والديون من «قيد جديد»." /> : (
              <ul className="acc-list">
                {data.entries.map((e) => (
                  <li key={e.id}>
                    <button type="button" className="acc-row" onClick={() => setEditing(e)}>
                      <span><b>{e.party || catLabel(e.category)}</b><small>{KIND_LABEL[e.kind]} · {catLabel(e.category)} · {fmtDate(e.date + 'T12:00:00Z')}{e.note ? ` · ${e.note}` : ''}</small></span>
                      <span className="acc-amt">
                        <span className={e.kind === 'expense' || e.kind === 'payable' ? 'is-out' : 'is-in'}>{e.kind === 'expense' || e.kind === 'payable' ? '−' : '+'}{fmtMoney(e.amount, e.currency)}</span>
                        {(e.kind === 'payable' || e.kind === 'receivable') && <Badge tone={e.settled_at ? 'green' : 'gold'}>{e.settled_at ? 'مسدَّد' : 'مفتوح'}</Badge>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <p className="muted tiny">دخل الحجوزات بينحسب لحاله من الحجوزات المؤكدة والمدفوعة، بشهر الدفع. الدين بينحسب مصروف أو دخل بالشهر اللي بينسدّ فيه.</p>
        </div>
      )}

      <EntrySheet entry={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} />
    </>
  )
}

function EntrySheet({ entry, onClose, onSaved }: { entry: Partial<LedgerEntry> | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [d, setD] = useState<Partial<LedgerEntry>>({})
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { if (entry) { setD(entry); setAmount(entry.amount !== undefined ? String(entry.amount) : ''); setErr(null) } }, [entry])
  const isNew = !entry?.id
  const kind = (d.kind ?? 'expense') as LedgerKind
  const set = <K extends keyof LedgerEntry>(k: K, v: LedgerEntry[K]) => setD((x) => ({ ...x, [k]: v }))
  const cats = useMemo(() => CATEGORIES, [])

  async function save() {
    const n = parseInt10(amount)
    if (n === null || n < 0) { setErr('اكتب المبلغ'); return }
    if (!d.date) { setErr('اختر التاريخ'); return }
    setBusy(true)
    const body = { kind, category: d.category ?? 'other', amount: n, currency: d.currency ?? 'SYP', date: d.date, party: d.party?.trim() || null, note: d.note?.trim() || null }
    try {
      if (isNew) await api.post('/v1/admin/ledger', body)
      else await api.patch(`/v1/admin/ledger/${entry!.id}`, body)
      toast.show('تم الحفظ', 'ok'); onSaved()
    } catch (e) { setErr(describeError(e)) } finally { setBusy(false) }
  }
  async function del() {
    setBusy(true)
    try { await api.del(`/v1/admin/ledger/${entry!.id}`); toast.show('انحذف القيد', 'ok'); setConfirmDel(false); onSaved() }
    catch (e) { toast.show(describeError(e), 'error') } finally { setBusy(false) }
  }

  return (
    <Sheet open={!!entry} onClose={onClose} title={isNew ? 'قيد جديد' : 'تعديل القيد'}>
      {entry && (
        <>
          <Field label="النوع">
            <Select value={kind} onChange={(e) => set('kind', e.target.value as LedgerKind)}>
              <option value="expense">مصروف (طلع من الصندوق)</option>
              <option value="income">دخل آخر (غير الحجوزات)</option>
              <option value="payable">دين عليّ (فاتورة لسا ما دفعتها)</option>
              <option value="receivable">دين إلي (حدا لازم يدفعلي)</option>
            </Select>
          </Field>
          <Field label="التصنيف">
            <Select value={d.category ?? 'other'} onChange={(e) => set('category', e.target.value)}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
          <div className="two">
            <Field label="المبلغ" error={err ?? undefined}><Input dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="العملة">
              <Segmented<Currency> options={[{ value: 'SYP', label: 'ل.س' }, { value: 'USD', label: '$' }]} value={(d.currency ?? 'SYP') as Currency} onChange={(v) => set('currency', v)} />
            </Field>
          </div>
          <Field label="التاريخ"><Input type="date" dir="ltr" value={d.date ?? ''} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label={kind === 'receivable' ? 'مين لازم يدفع؟' : kind === 'payable' ? 'لمين؟' : 'الجهة (اختياري)'}>
            <Input value={d.party ?? ''} onChange={(e) => set('party', e.target.value)} placeholder="مثلاً: صاحب البناء، شركة الإنترنت، منظمة…" />
          </Field>
          <Field label="ملاحظة (اختياري)"><Textarea rows={2} value={d.note ?? ''} onChange={(e) => set('note', e.target.value)} /></Field>
          {!isNew && (kind === 'payable' || kind === 'receivable') && (
            <p className="muted small">{entry.settled_at ? `مسدَّد بتاريخ ${fmtDate(entry.settled_at)}` : 'لسا مفتوح — بتسدّده من قائمة «إلي» أو «عليّ».'}</p>
          )}
          <div className="sheet-foot">
            {!isNew && <Button variant="ghost" onClick={() => setConfirmDel(true)}><Icon name="trash" size={18} /> حذف</Button>}
            <Button size="lg" loading={busy} onClick={save}>حفظ</Button>
          </div>
          <Confirm open={confirmDel} title="حذف القيد؟" danger confirmLabel="حذف" loading={busy} onConfirm={del} onClose={() => setConfirmDel(false)} />
        </>
      )}
    </Sheet>
  )
}

export default Accounts
